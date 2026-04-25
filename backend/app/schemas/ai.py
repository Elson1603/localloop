from pydantic import BaseModel, Field


class PriceSuggestionRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    category: str = Field(min_length=2, max_length=50)
    condition: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=1000)
    currency: str = Field(default="INR", min_length=3, max_length=8)


class PriceSuggestionResponse(BaseModel):
    min_price: float = Field(gt=0)
    max_price: float = Field(gt=0)
    reason: str = Field(min_length=8, max_length=500)


class ProductDescriptionSuggestionResponse(BaseModel):
    description: str = Field(min_length=20, max_length=500)
    keywords: list[str] = Field(default_factory=list)
