"""
Messages & Conversations Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MessageBase(BaseModel):
    content: str


class MessageCreate(MessageBase):
    conversation_id: Optional[str] = None
    recipient_id: Optional[str] = None
    submission_id: Optional[str] = None


class Message(MessageBase):
    id: str
    conversation_id: str
    sender_id: str
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    pass


class Conversation(ConversationBase):
    id: str
    participant_ids: list[str]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
