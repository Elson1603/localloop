from pydantic import BaseModel, Field


class CreateReviewRequest(BaseModel):
    offer_id: str = Field(min_length=3, max_length=80)
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class ReviewResponse(BaseModel):
    review_id: str
    offer_id: str
    reviewer_user_id: str
    reviewee_user_id: str
    rating: int
    comment: str | None = None
    created_at: str
