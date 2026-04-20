import base64
import hashlib
import hmac
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings


class CognitoService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = boto3.client("cognito-idp", region_name=self.settings.aws_region)

    def _secret_hash(self, username: str) -> str | None:
        secret = self.settings.cognito_app_client_secret
        if not secret:
            return None

        digest = hmac.new(
            secret.encode("utf-8"),
            f"{username}{self.settings.cognito_app_client_id}".encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(digest).decode("utf-8")

    def sign_up(self, email: str, password: str, name: str) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "ClientId": self.settings.cognito_app_client_id,
            "Username": email,
            "Password": password,
            "UserAttributes": [
                {"Name": "email", "Value": email},
                {"Name": "name", "Value": name},
            ],
        }
        secret_hash = self._secret_hash(email)
        if secret_hash:
            kwargs["SecretHash"] = secret_hash

        return self.client.sign_up(**kwargs)

    def confirm_sign_up(self, email: str, confirmation_code: str) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "ClientId": self.settings.cognito_app_client_id,
            "Username": email,
            "ConfirmationCode": confirmation_code,
        }
        secret_hash = self._secret_hash(email)
        if secret_hash:
            kwargs["SecretHash"] = secret_hash

        return self.client.confirm_sign_up(**kwargs)

    def login(self, email: str, password: str) -> dict[str, Any]:
        auth_parameters: dict[str, str] = {
            "USERNAME": email,
            "PASSWORD": password,
        }
        secret_hash = self._secret_hash(email)
        if secret_hash:
            auth_parameters["SECRET_HASH"] = secret_hash

        return self.client.initiate_auth(
            ClientId=self.settings.cognito_app_client_id,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters=auth_parameters,
        )


def parse_cognito_error(error: ClientError) -> str:
    data = error.response.get("Error", {})
    code = data.get("Code", "UnknownException")
    message = data.get("Message", "Unknown Cognito error")
    return f"{code}: {message}"
