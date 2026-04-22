from typing import Literal

from pydantic import BaseModel, Field


ProductStatus = Literal["active", "reserved", "sold", "archived"]


class CreateProductRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=8, max_length=2000)
    category: str = Field(min_length=2, max_length=50)
    price: float = Field(gt=0)
    location: str = Field(min_length=2, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    image_urls: list[str] = Field(default_factory=list)


class UpdateProductRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=8, max_length=2000)
    category: str = Field(min_length=2, max_length=50)
    price: float = Field(gt=0)
    location: str = Field(min_length=2, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    image_urls: list[str] = Field(default_factory=list)


class ProductResponse(BaseModel):
    product_id: str
    owner_id: str
    title: str
    description: str
    category: str
    price: float
    location: str
    latitude: float | None = None
    longitude: float | None = None
    image_refs: list[str] = Field(default_factory=list)
    image_urls: list[str]
    status: ProductStatus
    created_at: str
    updated_at: str


class UpdateProductStatusRequest(BaseModel):
    status: ProductStatus
