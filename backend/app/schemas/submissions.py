"""
Submission Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SubmissionBase(BaseModel):
    project_title: str
    project_type: str
    logline: Optional[str] = None
    description: Optional[str] = None
    youtube_link: Optional[str] = None


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(BaseModel):
    project_title: Optional[str] = None
    project_type: Optional[str] = None
    logline: Optional[str] = None
    description: Optional[str] = None
    youtube_link: Optional[str] = None
    status: Optional[str] = None
    admin_notes: Optional[str] = None


class Submission(SubmissionBase):
    id: str
    user_id: str
    status: str = "pending"
    admin_notes: Optional[str] = None
    has_unread_user_messages: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
