from datetime import datetime, timezone
import logging
from uuid import uuid4

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.dynamodb import get_table, scan_with_optional_filter, serialize_dynamo, to_decimal
from app.core.security import get_current_user
from app.schemas.offer import CreateOfferRequest, OfferResponse, UpdateOfferStatusRequest

router = APIRouter(prefix="/offers", tags=["offers"])
settings = get_settings()
logger = logging.getLogger(__name__)


def _store_notification(notification_item: dict) -> None:
    notifications_table = get_table(settings.notifications_table_name)
    notifications_table.put_item(Item=notification_item)

    recipient_user_id = str(notification_item.get("recipient_user_id") or "").strip()
    notification_id = str(notification_item.get("notification_id") or "").strip()
    if not recipient_user_id or not notification_id:
        return

    users_table = get_table(settings.users_table_name)
    try:
        users_table.update_item(
            Key={"user_id": recipient_user_id},
            UpdateExpression=(
                "SET notification_ids = list_append(if_not_exists(notification_ids, :empty), :new_ids), "
                "updated_at = :updated_at"
            ),
            ExpressionAttributeValues={
                ":empty": [],
                ":new_ids": [notification_id],
                ":updated_at": datetime.now(timezone.utc).isoformat(),
            },
            ConditionExpression="attribute_exists(user_id)",
        )
    except ClientError as error:
        code = str(error.response.get("Error", {}).get("Code", ""))
        if code == "ConditionalCheckFailedException":
            return
        logger.warning("Failed to append notification ID to user index", exc_info=error)


@router.post("", response_model=OfferResponse, status_code=status.HTTP_201_CREATED)
def create_offer(
    payload: CreateOfferRequest,
    current_user: dict = Depends(get_current_user),
) -> OfferResponse:
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "offer_id": str(uuid4()),
        "product_id": payload.product_id,
        "buyer_user_id": current_user.get("sub", ""),
        "offered_price": to_decimal(payload.offered_price),
        "note": payload.note,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }

    table = get_table(settings.offers_table_name)
    table.put_item(Item=item)
    
    # Send notification to product owner
    products_table = get_table(settings.products_table_name)
    product = products_table.get_item(Key={"product_id": payload.product_id}).get("Item")
    if product and product.get("owner_id") and product.get("owner_id") != current_user.get("sub", ""):
        notification_item = {
            "notification_id": str(uuid4()),
            "recipient_user_id": product.get("owner_id"),
            "title": "New Offer Received",
            "message": f"You received a new offer of {payload.offered_price} on your product.",
            "reference_id": payload.product_id,
            "reference_type": "product",
            "is_read": False,
            "created_at": now,
        }
        _store_notification(notification_item)

    return OfferResponse(**serialize_dynamo(item))


@router.get("", response_model=list[OfferResponse])
def list_offers(
    product_id: str | None = Query(default=None),
    buyer_user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[OfferResponse]:
    current_user_id = current_user.get("sub", "")
    if buyer_user_id and buyer_user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own offers")

    if product_id:
        products_table = get_table(settings.products_table_name)
        product = products_table.get_item(Key={"product_id": product_id}).get("Item")
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        product_owner_id = str(product.get("owner_id", ""))
        if product_owner_id != current_user_id and buyer_user_id != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to view offers for this product")

    table = get_table(settings.offers_table_name)
    effective_buyer_user_id = buyer_user_id or (None if product_id else current_user_id)
    response = scan_with_optional_filter(table, {"product_id": product_id, "buyer_user_id": effective_buyer_user_id})
    items = response.get("Items", [])
    return [OfferResponse(**serialize_dynamo(item)) for item in items]


@router.put("/{offer_id}/status", response_model=OfferResponse)
def update_offer_status(
    offer_id: str,
    payload: UpdateOfferStatusRequest,
    current_user: dict = Depends(get_current_user),
) -> OfferResponse:
    current_user_id = str(current_user.get("sub", ""))
    offers_table = get_table(settings.offers_table_name)
    item = offers_table.get_item(Key={"offer_id": offer_id}).get("Item")
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found")

    product_id = str(item.get("product_id") or "")
    if not product_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer is missing product reference")

    products_table = get_table(settings.products_table_name)
    product = products_table.get_item(Key={"product_id": product_id}).get("Item")
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product_owner_id = str(product.get("owner_id") or "")
    if product_owner_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can update this offer")

    current_status = str(item.get("status") or "pending")
    if current_status in {"accepted", "rejected"} and current_status != payload.status:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Offer status is already finalized")
    if current_status == payload.status:
        return OfferResponse(**serialize_dynamo(item))

    now = datetime.now(timezone.utc).isoformat()
    item["status"] = payload.status
    item["updated_at"] = now
    offers_table.put_item(Item=item)

    serialized_item = serialize_dynamo(item)
    buyer_user_id = str(item.get("buyer_user_id") or "")
    if buyer_user_id and buyer_user_id != current_user_id:
        offer_amount = serialized_item.get("offered_price")
        status_word = "accepted" if payload.status == "accepted" else "rejected"
        notification_item = {
            "notification_id": str(uuid4()),
            "recipient_user_id": buyer_user_id,
            "title": f"Offer {payload.status.title()}",
            "message": f"Your offer of {offer_amount} has been {status_word}.",
            "reference_id": product_id,
            "reference_type": "product",
            "is_read": False,
            "created_at": now,
        }
        _store_notification(notification_item)

    return OfferResponse(**serialized_item)
