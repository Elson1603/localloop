from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    aws_region: str = Field(alias="AWS_REGION")
    cognito_user_pool_id: str = Field(alias="COGNITO_USER_POOL_ID")
    cognito_app_client_id: str = Field(alias="COGNITO_APP_CLIENT_ID")
    cognito_app_client_secret: str = Field(default="", alias="COGNITO_APP_CLIENT_SECRET")
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
