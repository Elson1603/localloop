from pydantic import BaseModel, Field


class CreateChatMessageRequest(BaseModel):
    chat_id: str = Field(min_length=3, max_length=80)
    recipient_user_id: str = Field(min_length=3, max_length=80)
    message: str = Field(min_length=1, max_length=2000)


class ChatMessageResponse(BaseModel):
    message_id: str
    chat_id: str
    sender_user_id: str
    recipient_user_id: str
    message: str
    created_at: str
