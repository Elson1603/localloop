from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / ".env.example"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    aws_region: str = Field(alias="AWS_REGION")
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(default=None, alias="AWS_SECRET_ACCESS_KEY")
    aws_session_token: str | None = Field(default=None, alias="AWS_SESSION_TOKEN")
    cognito_user_pool_id: str = Field(alias="COGNITO_USER_POOL_ID")
    cognito_app_client_id: str = Field(
        validation_alias=AliasChoices("COGNITO_APP_CLIENT_ID", "COGNITO_CLIENT_ID")
    )
    cognito_app_client_secret: str = Field(default="", alias="COGNITO_APP_CLIENT_SECRET")
    s3_bucket_name: str = Field(default="", alias="S3_BUCKET_NAME")
    s3_presigned_expiry_seconds: int = Field(default=3600, alias="S3_PRESIGNED_EXPIRY_SECONDS")
    users_table_name: str = Field(default="LocalLoopUsers", alias="DYNAMODB_USERS_TABLE")
    products_table_name: str = Field(default="LocalLoopProducts", alias="DYNAMODB_PRODUCTS_TABLE")
    chats_table_name: str = Field(default="LocalLoopChats", alias="DYNAMODB_CHATS_TABLE")
    offers_table_name: str = Field(default="LocalLoopOffers", alias="DYNAMODB_OFFERS_TABLE")
    notifications_table_name: str = Field(default="LocalLoopNotifications", alias="DYNAMODB_NOTIFICATIONS_TABLE")
    reviews_table_name: str = Field(default="LocalLoopReviews", alias="DYNAMODB_REVIEWS_TABLE")
    offer_expiry_hours: int = Field(default=48, alias="OFFER_EXPIRY_HOURS")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")
    project_name: str = Field(default="LocalLoop Backend", alias="PROJECT_NAME")

    @property
    def cognito_issuer(self) -> str:
        return (
            f"https://cognito-idp.{self.aws_region}.amazonaws.com/"
            f"{self.cognito_user_pool_id}"
        )

    @property
    def cognito_jwks_url(self) -> str:
        return f"{self.cognito_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
