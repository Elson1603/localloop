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
    cognito_user_pool_id: str = Field(alias="COGNITO_USER_POOL_ID")
    cognito_app_client_id: str = Field(
        validation_alias=AliasChoices("COGNITO_APP_CLIENT_ID", "COGNITO_CLIENT_ID")
    )
    cognito_app_client_secret: str = Field(default="", alias="COGNITO_APP_CLIENT_SECRET")
    users_table_name: str = Field(default="LocalLoopUsers", alias="DYNAMODB_USERS_TABLE")
    products_table_name: str = Field(default="LocalLoopProducts", alias="DYNAMODB_PRODUCTS_TABLE")
    chats_table_name: str = Field(default="LocalLoopChats", alias="DYNAMODB_CHATS_TABLE")
    offers_table_name: str = Field(default="LocalLoopOffers", alias="DYNAMODB_OFFERS_TABLE")
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
