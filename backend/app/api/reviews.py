from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.dynamodb import get_table, scan_with_optional_filter, serialize_dynamo
from app.core.security import get_current_user
from app.schemas.review import CreateReviewRequest, ReviewResponse

router = APIRouter(prefix="/reviews", tags=["reviews"])
settings = get_settings()


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: CreateReviewRequest,
    current_user: dict = Depends(get_current_user),
) -> ReviewResponse:
    current_user_id = str(current_user.get("sub") or "")
    offers_table = get_table(settings.offers_table_name)
    offer = offers_table.get_item(Key={"offer_id": payload.offer_id}).get("Item")
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found")

    offer_status = str(offer.get("status") or "")
    if offer_status != "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reviews are available only after a completed deal")

    buyer_user_id = str(offer.get("buyer_user_id") or "")
    seller_user_id = str(offer.get("seller_user_id") or "")
    participants = {buyer_user_id, seller_user_id}
    if current_user_id not in participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only offer participants can review this deal")

    reviewee_user_id = seller_user_id if current_user_id == buyer_user_id else buyer_user_id
    if not reviewee_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Offer is missing participant info")

    table = get_table(settings.reviews_table_name)
    existing_reviews = scan_with_optional_filter(
        table,
        {"offer_id": payload.offer_id, "reviewer_user_id": current_user_id},
    ).get("Items", [])
    if existing_reviews:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already reviewed this deal")

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "review_id": str(uuid4()),
        "offer_id": payload.offer_id,
        "reviewer_user_id": current_user_id,
        "reviewee_user_id": reviewee_user_id,
        "rating": payload.rating,
        "comment": payload.comment,
        "created_at": now,
    }
    table.put_item(Item=item)
    return ReviewResponse(**serialize_dynamo(item))


@router.get("", response_model=list[ReviewResponse])
def list_reviews(
    user_id: str = Query(..., min_length=3),
    current_user: dict = Depends(get_current_user),
) -> list[ReviewResponse]:
    del current_user
    table = get_table(settings.reviews_table_name)
    items = scan_with_optional_filter(table, {"reviewee_user_id": user_id}).get("Items", [])
    sorted_items = sorted(items, key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return [ReviewResponse(**serialize_dynamo(item)) for item in sorted_items]
