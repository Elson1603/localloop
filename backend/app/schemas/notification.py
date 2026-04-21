from pydantic import BaseModel

class NotificationResponse(BaseModel):
    notification_id: str
    recipient_user_id: str
    title: str
    message: str
    reference_id: str | None = None
    reference_type: str | None = None
    is_read: bool = False
    created_at: str
