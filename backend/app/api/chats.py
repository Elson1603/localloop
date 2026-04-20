from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from app.core.config import get_settings
from app.core.dynamodb import scan_with_optional_filter, serialize_dynamo, get_table
from app.core.security import get_current_user
from app.schemas.chat import ChatMessageResponse, CreateChatMessageRequest

router = APIRouter(prefix="/chats", tags=["chats"])
settings = get_settings()


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
    return ChatMessageResponse(**serialize_dynamo(item))


@router.get("/messages", response_model=list[ChatMessageResponse])
def list_chat_messages(chat_id: str | None = Query(default=None)) -> list[ChatMessageResponse]:
    table = get_table(settings.chats_table_name)
    response = scan_with_optional_filter(table, {"chat_id": chat_id})
    items = response.get("Items", [])
    sorted_items = sorted(items, key=lambda item: item.get("created_at", ""))
    return [ChatMessageResponse(**serialize_dynamo(item)) for item in sorted_items]
