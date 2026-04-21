from datetime import datetime, timedelta, timezone
import logging
from typing import Literal
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
ACTIVE_NEGOTIATION_STATUSES = {"pending", "countered"}
FINAL_OFFER_STATUSES = {"completed", "cancelled", "rejected", "expired"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_iso_timestamp(value: str | None) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _compute_offer_expiry(now: datetime) -> str:
    expiry = now + timedelta(hours=max(1, int(settings.offer_expiry_hours)))
    return _to_iso(expiry)


def _is_offer_expired(item: dict, now: datetime) -> bool:
    status = str(item.get("status") or "pending")
    if status not in ACTIVE_NEGOTIATION_STATUSES:
        return False
    expires_at = _parse_iso_timestamp(str(item.get("expires_at") or ""))
    if not expires_at:
        return False
    return expires_at <= now


def _expire_offer_if_needed(item: dict, offers_table) -> dict:
    now = _utc_now()
    if not _is_offer_expired(item, now):
        return item
    item["status"] = "expired"
    item["updated_at"] = _to_iso(now)
    offers_table.put_item(Item=item)
    return item


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
    now = _utc_now()
    now_iso = _to_iso(now)
    current_user_id = str(current_user.get("sub", ""))

    products_table = get_table(settings.products_table_name)
    product = products_table.get_item(Key={"product_id": payload.product_id}).get("Item")
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    seller_user_id = str(product.get("owner_id") or "")
    if not seller_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product is missing seller")
    if seller_user_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot place an offer on your own listing")

    item = {
        "offer_id": str(uuid4()),
        "product_id": payload.product_id,
        "buyer_user_id": current_user_id,
        "seller_user_id": seller_user_id,
        "offered_price": to_decimal(payload.offered_price),
        "original_offer_price": to_decimal(payload.offered_price),
        "note": payload.note,
        "status": "pending",
        "expires_at": _compute_offer_expiry(now),
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    table = get_table(settings.offers_table_name)
    table.put_item(Item=item)

    # Send notification to product owner
    if product and product.get("owner_id") and product.get("owner_id") != current_user_id:
        notification_item = {
            "notification_id": str(uuid4()),
            "recipient_user_id": product.get("owner_id"),
            "title": "New Offer Received",
            "message": f"You received a new offer of {payload.offered_price} on your product.",
            "reference_id": payload.product_id,
            "reference_type": "product",
            "is_read": False,
            "created_at": now_iso,
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
    items = [_expire_offer_if_needed(item, table) for item in response.get("Items", [])]
    return [OfferResponse(**serialize_dynamo(item)) for item in items]


def _require_transition(allowed: set[str], current_status: str, next_status: str) -> None:
    if current_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot set offer to '{next_status}' from '{current_status}'",
        )


def _resolve_offer_participants(item: dict) -> tuple[str, str]:
    buyer_user_id = str(item.get("buyer_user_id") or "")
    seller_user_id = str(item.get("seller_user_id") or "")
    if not buyer_user_id or not seller_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer has incomplete participants")
    return buyer_user_id, seller_user_id


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
    item = _expire_offer_if_needed(item, offers_table)

    product_id = str(item.get("product_id") or "")
    if not product_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer is missing product reference")

    products_table = get_table(settings.products_table_name)
    product = products_table.get_item(Key={"product_id": product_id}).get("Item")
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product_owner_id = str(product.get("owner_id") or "")
    if product_owner_id:
        item["seller_user_id"] = product_owner_id

    buyer_user_id, seller_user_id = _resolve_offer_participants(item)
    if current_user_id not in {buyer_user_id, seller_user_id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only offer participants can update this offer")

    current_status = str(item.get("status") or "pending")
    if current_status in FINAL_OFFER_STATUSES and current_status != payload.status:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Offer status is already finalized")
    if current_status == payload.status:
        return OfferResponse(**serialize_dynamo(item))

    next_status: Literal["countered", "accepted", "scheduled_pickup", "completed", "cancelled", "rejected"] = payload.status
    countered_by = str(item.get("counter_offer_by_user_id") or "")
    if next_status == "countered":
        _require_transition({"pending", "countered", "accepted"}, current_status, next_status)
        if payload.counter_offer_price is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="counter_offer_price is required for countered status")
        previous_offered_price = item.get("offered_price")
        now = _utc_now()
        item["status"] = "countered"
        item["offered_price"] = to_decimal(payload.counter_offer_price)
        if item.get("original_offer_price") is None:
            item["original_offer_price"] = previous_offered_price
        item["counter_offer_by_user_id"] = current_user_id
        item["countered_at"] = _to_iso(now)
        item["expires_at"] = _compute_offer_expiry(now)
    elif next_status == "accepted":
        if current_status == "pending" and current_user_id != seller_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can accept a pending offer")
        if current_status == "countered" and countered_by and current_user_id == countered_by:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The other participant must accept a counter-offer")
        _require_transition({"pending", "countered"}, current_status, next_status)
        item["status"] = "accepted"
    elif next_status == "scheduled_pickup":
        _require_transition({"accepted"}, current_status, next_status)
        item["status"] = "scheduled_pickup"
    elif next_status == "completed":
        _require_transition({"scheduled_pickup"}, current_status, next_status)
        item["status"] = "completed"
    elif next_status == "cancelled":
        _require_transition({"pending", "countered", "accepted", "scheduled_pickup"}, current_status, next_status)
        item["status"] = "cancelled"
    elif next_status == "rejected":
        if current_user_id != seller_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can reject an offer")
        _require_transition({"pending", "countered"}, current_status, next_status)
        item["status"] = "rejected"

    if payload.note is not None:
        item["note"] = payload.note
    now_iso = _to_iso(_utc_now())
    item["updated_at"] = now_iso
    offers_table.put_item(Item=item)

    serialized_item = serialize_dynamo(item)
    recipient_user_id = seller_user_id if current_user_id == buyer_user_id else buyer_user_id
    if recipient_user_id and recipient_user_id != current_user_id:
        offer_amount = serialized_item.get("offered_price")
        status_word = payload.status.replace("_", " ")
        notification_item = {
            "notification_id": str(uuid4()),
            "recipient_user_id": recipient_user_id,
            "title": f"Offer {payload.status.replace('_', ' ').title()}",
            "message": f"Offer updated to {status_word} at {offer_amount}.",
            "reference_id": product_id,
            "reference_type": "product",
            "is_read": False,
            "created_at": now_iso,
        }
        _store_notification(notification_item)

    return OfferResponse(**serialized_item)
