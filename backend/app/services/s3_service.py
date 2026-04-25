from pathlib import PurePosixPath
from uuid import uuid4

import boto3
from botocore.config import Config

from app.core.config import get_settings

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class S3Service:
    def __init__(self) -> None:
        get_settings.cache_clear()
        self.settings = get_settings()
        kwargs: dict[str, str] = {"region_name": self.settings.aws_region}
        if self.settings.aws_access_key_id and self.settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = self.settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = self.settings.aws_secret_access_key
            if self.settings.aws_session_token:
                kwargs["aws_session_token"] = self.settings.aws_session_token

        self.client = boto3.client(
            "s3",
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
            **kwargs,
        )

    def validate_content_type(self, content_type: str) -> None:
        if content_type not in _ALLOWED_CONTENT_TYPES:
            raise ValueError("Unsupported image type. Allowed: image/jpeg, image/png, image/webp")

    def build_object_key(self, user_id: str, file_name: str) -> str:
        safe_name = PurePosixPath(file_name).name.replace(" ", "-")
        return f"products/{user_id}/{uuid4()}-{safe_name}"

    def create_presigned_upload_url(self, object_key: str, content_type: str) -> str:
        return self.client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.settings.s3_bucket_name,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=self.settings.s3_presigned_expiry_seconds,
        )

    def create_presigned_view_url(self, object_key: str) -> str:
        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": self.settings.s3_bucket_name,
                "Key": object_key,
            },
            ExpiresIn=self.settings.s3_presigned_expiry_seconds,
        )

    def upload_bytes(self, object_key: str, body: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.settings.s3_bucket_name,
            Key=object_key,
            Body=body,
            ContentType=content_type,
        )

    def to_display_url(self, image_reference: str) -> str:
        if image_reference.startswith("http://") or image_reference.startswith("https://"):
            return image_reference

        object_key = image_reference
        if image_reference.startswith("s3://"):
            parts = image_reference.split("/", 3)
            object_key = parts[3] if len(parts) > 3 else image_reference

        return self.create_presigned_view_url(object_key)
