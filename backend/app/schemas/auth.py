from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=2, max_length=80)


class ConfirmSignUpRequest(BaseModel):
    email: EmailStr
    confirmation_code: str = Field(min_length=4, max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class AuthTokensResponse(BaseModel):
    access_token: str
    id_token: str
    refresh_token: str | None = None
    expires_in: int
    token_type: str


class MessageResponse(BaseModel):
    message: str


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    sub: str
    email: EmailStr | None = None
    username: str | None = None
