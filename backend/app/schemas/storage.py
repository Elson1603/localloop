from pydantic import BaseModel, Field


class PresignUploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=100)


class PresignUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int
