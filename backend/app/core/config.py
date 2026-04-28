from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env.example", BASE_DIR / ".env"),
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
    ai_provider: str = Field(default="google", alias="AI_PROVIDER")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="google/gemma-3-9b-it:free", alias="OPENROUTER_MODEL")
    openrouter_site_url: str = Field(default="http://localhost:5173", alias="OPENROUTER_SITE_URL")
    openrouter_app_name: str = Field(default="LocalLoop", alias="OPENROUTER_APP_NAME")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")
    project_name: str = Field(default="LocalLoop Backend", alias="PROJECT_NAME")
    frontend_url: str = Field(
        default="",
        validation_alias=AliasChoices("FRONTEND_URL", "APP_URL", "WEB_APP_URL"),
    )
    cors_allowed_origins: str = Field(default="", alias="CORS_ALLOWED_ORIGINS")
    cors_allowed_origin_regex: str = Field(default="", alias="CORS_ALLOWED_ORIGIN_REGEX")
    cors_allow_localhost: bool = Field(default=True, alias="CORS_ALLOW_LOCALHOST")

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        parsed: list[str] = []
        if self.frontend_url.strip():
            parsed.append(self.frontend_url.strip())

        raw = self.cors_allowed_origins
        if raw:
            parsed.extend(origin.strip() for origin in raw.split(",") if origin.strip())

        return parsed

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
