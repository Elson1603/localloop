from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.dynamodb import get_table, scan_with_optional_filter, serialize_dynamo, to_decimal
from app.core.security import get_current_user
from app.schemas.product import CreateProductRequest, ProductResponse
from app.services.s3_service import S3Service

router = APIRouter(prefix="/products", tags=["products"])
settings = get_settings()
s3_service = S3Service()


def _with_displayable_images(item: dict) -> dict:
    mapped = dict(item)
    images = mapped.get("image_urls", [])
    mapped["image_urls"] = [s3_service.to_display_url(image_ref) for image_ref in images]
    return mapped


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: CreateProductRequest,
    current_user: dict = Depends(get_current_user),
) -> ProductResponse:
    now = datetime.now(timezone.utc).isoformat()
    owner_id = current_user.get("sub", "")

    item = {
        "product_id": str(uuid4()),
        "owner_id": owner_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "price": to_decimal(payload.price),
        "location": payload.location,
        "image_urls": payload.image_urls,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }

    table = get_table(settings.products_table_name)
    table.put_item(Item=item)
    return ProductResponse(**serialize_dynamo(_with_displayable_images(item)))


@router.get("", response_model=list[ProductResponse])
def list_products(owner_id: str | None = Query(default=None)) -> list[ProductResponse]:
    table = get_table(settings.products_table_name)
    response = scan_with_optional_filter(table, {"owner_id": owner_id})
    items = response.get("Items", [])
    return [ProductResponse(**serialize_dynamo(_with_displayable_images(item))) for item in items]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str) -> ProductResponse:
    table = get_table(settings.products_table_name)
    item = table.get_item(Key={"product_id": product_id}).get("Item")
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductResponse(**serialize_dynamo(_with_displayable_images(item)))
