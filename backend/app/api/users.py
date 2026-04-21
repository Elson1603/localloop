from datetime import datetime, timezone
import re

from fastapi import HTTPException, status
from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.dynamodb import get_table, serialize_dynamo
from app.core.security import get_current_user
from app.schemas.user import PublicUserProfileResponse, UpsertUserProfileRequest, UserProfileResponse

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()

UUID_PATTERN = re.compile(r"^[0-9a-f]{8}[ \-][0-9a-f]{4}[ \-][0-9a-f]{4}[ \-][0-9a-f]{4}[ \-][0-9a-f]{12}$", re.IGNORECASE)


def _is_uuid_like(value: str | None) -> bool:
    normalized = (value or "").strip()
    return bool(normalized) and bool(UUID_PATTERN.match(normalized))


def _humanize_identifier(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""

    identifier = raw.split("@")[0].strip() if "@" in raw else raw
    if _is_uuid_like(identifier):
        return ""

    normalized = re.sub(r"[._-]+", " ", identifier)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized or _is_uuid_like(normalized) or normalized.isdigit():
        return ""

    parts = [part for part in normalized.split(" ") if part]
    return " ".join(part[:1].upper() + part[1:] for part in parts)


def _resolve_username(username: str | None, email: str | None, user_id: str | None) -> str:
    raw_username = (username or "").strip()
    if raw_username and not _is_uuid_like(raw_username):
        return raw_username
    if (email or "").strip():
        return str(email).strip()
    return (user_id or "").strip()


def _resolve_public_username(username: str | None, email: str | None) -> str:
    raw_username = (username or "").strip()
    if raw_username and not _is_uuid_like(raw_username):
        return raw_username.split("@")[0].strip() or raw_username

    email_prefix = (email or "").split("@")[0].strip()
    if email_prefix and not _is_uuid_like(email_prefix):
        return email_prefix

    return "member"


def _is_placeholder_display_name(display_name: str | None, email: str | None) -> bool:
    normalized = (display_name or "").strip().lower()
    if not normalized or normalized in {"localloop user", "user", "seller", "member"}:
        return True

    if _is_uuid_like(normalized):
        return True

    email_prefix = (email or "").split("@")[0].strip().lower()
    return bool(email_prefix) and normalized == email_prefix


def _resolve_display_name(current_user: dict, fallback_email: str) -> str:
    token_name = str(current_user.get("name") or "").strip()
    if token_name:
        return token_name

    email_name = _humanize_identifier(fallback_email)
    if email_name:
        return email_name

    username_name = _humanize_identifier(str(current_user.get("username") or ""))
    if username_name:
        return username_name

    return "User"


@router.put("/me", response_model=UserProfileResponse)
def upsert_my_profile(
    payload: UpsertUserProfileRequest,
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    now = datetime.now(timezone.utc).isoformat()
    user_id = current_user.get("sub", "")
    email = current_user.get("email", "")
    username = _resolve_username(current_user.get("username"), email, user_id)

    table = get_table(settings.users_table_name)
    existing = table.get_item(Key={"user_id": user_id}).get("Item", {})
    created_at = existing.get("created_at", now)

    item = {
        "user_id": user_id,
        "email": email,
        "username": username,
        "display_name": payload.display_name,
        "phone": payload.phone,
        "location": payload.location,
        "created_at": created_at,
        "updated_at": now,
    }
    table.put_item(Item=item)
    return UserProfileResponse(**serialize_dynamo(item))


@router.get("/me", response_model=UserProfileResponse)
def get_my_profile(current_user: dict = Depends(get_current_user)) -> UserProfileResponse:
    user_id = current_user.get("sub", "")
    email = current_user.get("email", "")
    username = _resolve_username(current_user.get("username"), email, user_id)
    now = datetime.now(timezone.utc).isoformat()

    table = get_table(settings.users_table_name)
    item = table.get_item(Key={"user_id": user_id}).get("Item")

    if not item:
        item = {
            "user_id": user_id,
            "email": email,
            "username": username,
            "display_name": _resolve_display_name(current_user, email),
            "phone": None,
            "location": None,
            "created_at": now,
            "updated_at": now,
        }
        table.put_item(Item=item)
    else:
        existing_email = str(item.get("email") or email)
        existing_display_name = str(item.get("display_name") or "")
        resolved_display_name = _resolve_display_name(current_user, existing_email)

        if _is_placeholder_display_name(existing_display_name, existing_email) and resolved_display_name:
            item["display_name"] = resolved_display_name
            item["updated_at"] = now
            table.put_item(Item=item)

    return UserProfileResponse(**serialize_dynamo(item))


@router.get("/{user_id}", response_model=PublicUserProfileResponse)
def get_user_public_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> PublicUserProfileResponse:
    table = get_table(settings.users_table_name)
    item = table.get_item(Key={"user_id": user_id}).get("Item")
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = datetime.now(timezone.utc).isoformat()
    if str(current_user.get("sub") or "") == user_id:
        existing_email = str(item.get("email") or current_user.get("email") or "")
        existing_display_name = str(item.get("display_name") or "")
        resolved_display_name = _resolve_display_name(current_user, existing_email)
        if _is_placeholder_display_name(existing_display_name, existing_email) and resolved_display_name:
            item["display_name"] = resolved_display_name
            item["updated_at"] = now
            table.put_item(Item=item)

    data = serialize_dynamo(item)
    data_email = str(data.get("email") or "")
    data_username = str(data.get("username") or "")
    data_display_name = str(data.get("display_name") or "")

    resolved_display_name = data_display_name
    if _is_placeholder_display_name(data_display_name, data_email):
        resolved_display_name = (
            _humanize_identifier(data_email)
            or _humanize_identifier(data_username)
            or "Seller"
        )
        if resolved_display_name != data_display_name:
            item["display_name"] = resolved_display_name
            item["updated_at"] = now
            table.put_item(Item=item)
            data["display_name"] = resolved_display_name

    return PublicUserProfileResponse(
        user_id=data.get("user_id", user_id),
        username=_resolve_public_username(data_username, data_email),
        display_name=resolved_display_name or "Seller",
    )
