from pydantic import BaseModel, Field


class CreateOfferRequest(BaseModel):
    product_id: str = Field(min_length=3, max_length=80)
    offered_price: float = Field(gt=0)
    note: str | None = Field(default=None, max_length=500)


class OfferResponse(BaseModel):
    offer_id: str
    product_id: str
    buyer_user_id: str
    offered_price: float
    note: str | None = None
    status: str
    created_at: str
    updated_at: str
