from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.dynamodb import get_table, scan_with_optional_filter, serialize_dynamo, to_decimal
from app.core.security import get_current_user
from app.schemas.product import (
    CreateProductRequest,
    ProductResponse,
    UpdateProductRequest,
    UpdateProductStatusRequest,
)
from app.services.s3_service import S3Service

router = APIRouter(prefix="/products", tags=["products"])


def _get_products_settings():
    get_settings.cache_clear()
    return get_settings()


def _get_s3_service() -> S3Service:
    return S3Service()


def _with_displayable_images(item: dict) -> dict:
    mapped = dict(item)
    images = mapped.get("image_urls", [])
    s3_service = _get_s3_service()
    mapped["image_refs"] = [str(image_ref) for image_ref in images]
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
        "latitude": to_decimal(payload.latitude),
        "longitude": to_decimal(payload.longitude),
        "image_urls": payload.image_urls,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }

    settings = _get_products_settings()
    table = get_table(settings.products_table_name)
    table.put_item(Item=item)
    return ProductResponse(**serialize_dynamo(_with_displayable_images(item)))


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    payload: UpdateProductRequest,
    current_user: dict = Depends(get_current_user),
) -> ProductResponse:
    settings = _get_products_settings()
    table = get_table(settings.products_table_name)
    existing = table.get_item(Key={"product_id": product_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    current_user_id = current_user.get("sub", "")
    owner_id = str(existing.get("owner_id", ""))
    if owner_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own products")

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "product_id": product_id,
        "owner_id": owner_id,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "price": to_decimal(payload.price),
        "location": payload.location,
        "latitude": to_decimal(payload.latitude),
        "longitude": to_decimal(payload.longitude),
        "image_urls": payload.image_urls,
        "status": existing.get("status", "active"),
        "created_at": existing.get("created_at", now),
        "updated_at": now,
    }

    table.put_item(Item=item)
    return ProductResponse(**serialize_dynamo(_with_displayable_images(item)))


@router.get("", response_model=list[ProductResponse])
def list_products(
    owner_id: str | None = Query(default=None),
    listing_status: str | None = Query(default=None, alias="status"),
) -> list[ProductResponse]:
    settings = _get_products_settings()
    table = get_table(settings.products_table_name)
    effective_status = listing_status
    if owner_id is None and listing_status is None:
        effective_status = "active"

    response = scan_with_optional_filter(table, {"owner_id": owner_id, "status": effective_status})
    items = response.get("Items", [])
    return [ProductResponse(**serialize_dynamo(_with_displayable_images(item))) for item in items]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str) -> ProductResponse:
    settings = _get_products_settings()
    table = get_table(settings.products_table_name)
    item = table.get_item(Key={"product_id": product_id}).get("Item")
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductResponse(**serialize_dynamo(_with_displayable_images(item)))


@router.put("/{product_id}/status", response_model=ProductResponse)
def update_product_status(
    product_id: str,
    payload: UpdateProductStatusRequest,
    current_user: dict = Depends(get_current_user),
) -> ProductResponse:
    settings = _get_products_settings()
    table = get_table(settings.products_table_name)
    existing = table.get_item(Key={"product_id": product_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    current_user_id = current_user.get("sub", "")
    owner_id = str(existing.get("owner_id", ""))
    if owner_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own products")

    existing["status"] = payload.status
    existing["updated_at"] = datetime.now(timezone.utc).isoformat()
    table.put_item(Item=existing)
    return ProductResponse(**serialize_dynamo(_with_displayable_images(existing)))
