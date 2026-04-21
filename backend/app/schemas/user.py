from pydantic import BaseModel, Field


class UpsertUserProfileRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    phone: str | None = Field(default=None, max_length=20)
    location: str | None = Field(default=None, max_length=80)


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: str
    display_name: str
    phone: str | None = None
    location: str | None = None
    created_at: str
    updated_at: str


class PublicUserProfileResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
