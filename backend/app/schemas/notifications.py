"""
Notification Schemas
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class NotificationBase(BaseModel):
    title: str
    body: Optional[str] = None
    type: str  # message, connection_request, connection_accepted, submission_update
    related_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    user_id: str


class Notification(NotificationBase):
    id: str
    user_id: str
    status: str = "unread"  # unread, read
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCounts(BaseModel):
    total: int = 0
    messages: int = 0
    connection_requests: int = 0
    submission_updates: int = 0
    crm: int = 0
