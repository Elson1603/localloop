from typing import Literal

from pydantic import BaseModel, Field


class CreateOfferRequest(BaseModel):
    product_id: str = Field(min_length=3, max_length=80)
    offered_price: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class UpdateOfferStatusRequest(BaseModel):
    status: Literal[
        "countered",
        "accepted",
        "scheduled_pickup",
        "completed",
        "cancelled",
        "rejected",
    ]
    counter_offer_price: float | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=500)


class OfferResponse(BaseModel):
    offer_id: str
    product_id: str
    buyer_user_id: str
    seller_user_id: str | None = None
    offered_price: float
    original_offer_price: float | None = None
    counter_offer_by_user_id: str | None = None
    countered_at: str | None = None
    note: str | None = None
    status: str
    expires_at: str | None = None
    created_at: str
    updated_at: str
