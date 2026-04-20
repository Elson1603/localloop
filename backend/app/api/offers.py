from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.dynamodb import get_table, scan_with_optional_filter, serialize_dynamo, to_decimal
from app.core.security import get_current_user
from app.schemas.offer import CreateOfferRequest, OfferResponse

router = APIRouter(prefix="/offers", tags=["offers"])
settings = get_settings()


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

    table = get_table(settings.offers_table_name)
    effective_buyer_user_id = buyer_user_id or (None if product_id else current_user_id)
    response = scan_with_optional_filter(table, {"product_id": product_id, "buyer_user_id": effective_buyer_user_id})
    items = response.get("Items", [])
    return [OfferResponse(**serialize_dynamo(item)) for item in items]
