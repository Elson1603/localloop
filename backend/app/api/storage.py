from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from botocore.exceptions import NoCredentialsError

from app.core.config import get_settings
from app.core.security import get_current_user
from app.schemas.storage import PresignUploadRequest, PresignUploadResponse
from app.services.s3_service import S3Service

router = APIRouter(prefix="/storage", tags=["storage"])


def _get_storage_context() -> tuple:
    get_settings.cache_clear()
    settings = get_settings()
    s3_service = S3Service()
    return settings, s3_service


@router.post("/presign-upload", response_model=PresignUploadResponse)
def presign_upload(
    payload: PresignUploadRequest,
    current_user: dict = Depends(get_current_user),
) -> PresignUploadResponse:
    settings, s3_service = _get_storage_context()
    if not settings.s3_bucket_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3_BUCKET_NAME is not configured",
        )

    try:
        s3_service.validate_content_type(payload.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user_id = current_user.get("sub", "anonymous")
    object_key = s3_service.build_object_key(user_id=user_id, file_name=payload.file_name)
    upload_url = s3_service.create_presigned_upload_url(object_key=object_key, content_type=payload.content_type)

    return PresignUploadResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=settings.s3_presigned_expiry_seconds,
    )


@router.post("/upload", response_model=PresignUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> PresignUploadResponse:
    settings, s3_service = _get_storage_context()
    if not settings.s3_bucket_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3_BUCKET_NAME is not configured",
        )

    content_type = file.content_type or ""
    try:
        s3_service.validate_content_type(content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user_id = current_user.get("sub", "anonymous")
    object_key = s3_service.build_object_key(user_id=user_id, file_name=file.filename or "upload.jpg")
    body = await file.read()
    try:
        s3_service.upload_bytes(object_key=object_key, body=body, content_type=content_type)
    except NoCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AWS credentials not configured for S3 upload",
        ) from exc

    return PresignUploadResponse(
        upload_url="",
        object_key=object_key,
        expires_in=settings.s3_presigned_expiry_seconds,
    )
