from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.dynamodb import get_table, serialize_dynamo
from app.core.security import get_current_user
from app.schemas.user import UpsertUserProfileRequest, UserProfileResponse

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()


@router.put("/me", response_model=UserProfileResponse)
def upsert_my_profile(
    payload: UpsertUserProfileRequest,
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    now = datetime.now(timezone.utc).isoformat()
    user_id = current_user.get("sub", "")
    email = current_user.get("email", "")
    username = current_user.get("username") or email

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
    username = current_user.get("username") or email
    now = datetime.now(timezone.utc).isoformat()

    table = get_table(settings.users_table_name)
    item = table.get_item(Key={"user_id": user_id}).get("Item")

    if not item:
        item = {
            "user_id": user_id,
            "email": email,
            "username": username,
            "display_name": email.split("@")[0] if email else "LocalLoop User",
            "phone": None,
            "location": None,
            "created_at": now,
            "updated_at": now,
        }
        table.put_item(Item=item)

    return UserProfileResponse(**serialize_dynamo(item))
