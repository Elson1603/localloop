from datetime import datetime, timezone
import logging
from uuid import uuid4

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.core.dynamodb import scan_with_optional_filter, serialize_dynamo, get_table
from app.core.security import get_current_user
from app.schemas.chat import ChatMessageResponse, CreateChatMessageRequest

router = APIRouter(prefix="/chats", tags=["chats"])
settings = get_settings()
logger = logging.getLogger(__name__)


def _store_notification(notification_item: dict) -> None:
    notifications_table = get_table(settings.notifications_table_name)
    notifications_table.put_item(Item=notification_item)

    recipient_user_id = str(notification_item.get("recipient_user_id") or "").strip()
    notification_id = str(notification_item.get("notification_id") or "").strip()
    if not recipient_user_id or not notification_id:
        return

    users_table = get_table(settings.users_table_name)
    try:
        users_table.update_item(
            Key={"user_id": recipient_user_id},
            UpdateExpression=(
                "SET notification_ids = list_append(if_not_exists(notification_ids, :empty), :new_ids), "
                "updated_at = :updated_at"
            ),
            ExpressionAttributeValues={
                ":empty": [],
                ":new_ids": [notification_id],
                ":updated_at": datetime.now(timezone.utc).isoformat(),
            },
            ConditionExpression="attribute_exists(user_id)",
        )
    except ClientError as error:
        code = str(error.response.get("Error", {}).get("Code", ""))
        if code == "ConditionalCheckFailedException":
            return
        logger.warning("Failed to append notification ID to user index", exc_info=error)


@router.post("/messages", response_model=ChatMessageResponse)
def create_chat_message(
    payload: CreateChatMessageRequest,
    current_user: dict = Depends(get_current_user),
) -> ChatMessageResponse:
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "message_id": str(uuid4()),
        "chat_id": payload.chat_id,
        "sender_user_id": current_user.get("sub", ""),
        "recipient_user_id": payload.recipient_user_id,
        "message": payload.message,
        "created_at": now,
    }

    table = get_table(settings.chats_table_name)
    table.put_item(Item=item)
    
    if payload.recipient_user_id and payload.recipient_user_id != current_user.get("sub", ""):
        notification_item = {
            "notification_id": str(uuid4()),
            "recipient_user_id": payload.recipient_user_id,
            "title": "New Message",
            "message": "You received a new chat message.",
            "reference_id": payload.chat_id,
            "reference_type": "chat",
            "is_read": False,
            "created_at": now,
        }
        _store_notification(notification_item)

    return ChatMessageResponse(**serialize_dynamo(item))


@router.get("/messages", response_model=list[ChatMessageResponse])
def list_chat_messages(
    chat_id: str | None = Query(default=None),
    sender_user_id: str | None = Query(default=None),
    recipient_user_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[ChatMessageResponse]:
    current_user_id = current_user.get("sub", "")

    if sender_user_id and sender_user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only read your own messages")
    if recipient_user_id and recipient_user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only read your own messages")

    table = get_table(settings.chats_table_name)
    response = scan_with_optional_filter(
        table,
        {
            "chat_id": chat_id,
            "sender_user_id": sender_user_id,
            "recipient_user_id": recipient_user_id,
        },
    )
    items = response.get("Items", [])
    visible_items = [
        item
        for item in items
        if item.get("sender_user_id") == current_user_id or item.get("recipient_user_id") == current_user_id
    ]
    sorted_items = sorted(visible_items, key=lambda item: item.get("created_at", ""))
    return [ChatMessageResponse(**serialize_dynamo(item)) for item in sorted_items]
