from datetime import datetime, timezone
import logging

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.dynamodb import get_table, scan_with_optional_filter, serialize_dynamo
from app.core.security import get_current_user
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)

_RECIPIENT_INDEX_CANDIDATES = (
    "recipient_user_id-index",
    "recipient-user-id-index",
    "recipientUserId-index",
)


def _get_notifications_settings():
    get_settings.cache_clear()
    return get_settings()


def _is_access_denied(error: ClientError) -> bool:
    code = str(error.response.get("Error", {}).get("Code", ""))
    return code == "AccessDeniedException"


def _try_query_by_recipient(table, recipient_user_id: str) -> list[dict]:
    for index_name in _RECIPIENT_INDEX_CANDIDATES:
        try:
            response = table.query(
                IndexName=index_name,
                KeyConditionExpression=Key("recipient_user_id").eq(recipient_user_id),
            )
            return response.get("Items", [])
        except ClientError as error:
            code = str(error.response.get("Error", {}).get("Code", ""))
            if code in {"ValidationException", "ResourceNotFoundException", "AccessDeniedException"}:
                continue
            raise

    try:
        response = table.query(KeyConditionExpression=Key("recipient_user_id").eq(recipient_user_id))
        return response.get("Items", [])
    except ClientError as error:
        code = str(error.response.get("Error", {}).get("Code", ""))
        if code in {"ValidationException", "AccessDeniedException"}:
            return []
        raise


def _get_item_with_candidate_keys(table, candidate_keys: list[dict]) -> dict | None:
    for key in candidate_keys:
        try:
            item = table.get_item(Key=key).get("Item")
            if item:
                return item
        except ClientError as error:
            code = str(error.response.get("Error", {}).get("Code", ""))
            if code == "ValidationException":
                continue
            raise
    return None


def _find_notification_item(table, recipient_user_id: str, notification_id: str) -> dict | None:
    direct_item = _get_item_with_candidate_keys(
        table,
        [
            {"notification_id": notification_id},
            {"recipient_user_id": recipient_user_id, "notification_id": notification_id},
        ],
    )
    if direct_item:
        return direct_item

    query_items = _try_query_by_recipient(table, recipient_user_id)
    for item in query_items:
        if str(item.get("notification_id") or "") == notification_id:
            return item

    indexed_items = _load_from_user_index(table, recipient_user_id)
    for item in indexed_items:
        if str(item.get("notification_id") or "") == notification_id:
            return item

    return None


def _load_from_user_index(table, recipient_user_id: str) -> list[dict]:
    settings = _get_notifications_settings()
    users_table = get_table(settings.users_table_name)
    user_item = users_table.get_item(Key={"user_id": recipient_user_id}).get("Item", {})
    raw_ids = user_item.get("notification_ids") or []
    if not isinstance(raw_ids, list):
        return []

    deduped_ids: list[str] = []
    seen: set[str] = set()
    for raw_id in raw_ids:
        notification_id = str(raw_id).strip()
        if not notification_id or notification_id in seen:
            continue
        seen.add(notification_id)
        deduped_ids.append(notification_id)

    items: list[dict] = []
    for notification_id in reversed(deduped_ids[-100:]):
        item = _get_item_with_candidate_keys(
            table,
            [
                {"notification_id": notification_id},
                {"recipient_user_id": recipient_user_id, "notification_id": notification_id},
            ],
        )
        if not item:
            continue
        if str(item.get("recipient_user_id") or "") != recipient_user_id:
            continue
        items.append(item)
    return items


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    current_user: dict = Depends(get_current_user),
) -> list[NotificationResponse]:
    current_user_id = current_user.get("sub", "")
    settings = _get_notifications_settings()
    table = get_table(settings.notifications_table_name)
    items = _try_query_by_recipient(table, current_user_id)

    if not items:
        try:
            response = scan_with_optional_filter(table, {"recipient_user_id": current_user_id})
            items = response.get("Items", [])
        except ClientError as error:
            if not _is_access_denied(error):
                raise
            logger.warning("Scan denied for notifications list; falling back to user notification index", exc_info=error)
            items = _load_from_user_index(table, current_user_id)

    sorted_items = sorted(items, key=lambda i: i.get("created_at", ""), reverse=True)
    return [NotificationResponse(**serialize_dynamo(item)) for item in sorted_items]


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
) -> NotificationResponse:
    current_user_id = current_user.get("sub", "")
    settings = _get_notifications_settings()
    table = get_table(settings.notifications_table_name)

    item = _find_notification_item(table, current_user_id, notification_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    if item.get("recipient_user_id") != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to modify this notification")

    item["is_read"] = True
    item["updated_at"] = datetime.now(timezone.utc).isoformat()
    table.put_item(Item=item)
    return NotificationResponse(**serialize_dynamo(item))
