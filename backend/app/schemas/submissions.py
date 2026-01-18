"""
Submission Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SubmissionBase(BaseModel):
    project_title: str
    project_type: str
    logline: Optional[str] = None
    description: Optional[str] = None
    youtube_link: Optional[str] = None
    # Professional profile fields
    company_name: Optional[str] = None
    submitter_role: Optional[str] = None
    years_experience: Optional[int] = None


class SubmissionCreate(SubmissionBase):
    name: Optional[str] = None
    email: Optional[str] = None
    terms_accepted: bool = False


class SubmissionUpdate(BaseModel):
    project_title: Optional[str] = None
    project_type: Optional[str] = None
    logline: Optional[str] = None
    description: Optional[str] = None
    youtube_link: Optional[str] = None
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    company_name: Optional[str] = None
    submitter_role: Optional[str] = None
    years_experience: Optional[int] = None


class SubmissionUserUpdate(BaseModel):
    """Schema for user updating their own pending submission"""
    project_title: Optional[str] = None
    project_type: Optional[str] = None
    logline: Optional[str] = None
    description: Optional[str] = None
    youtube_link: Optional[str] = None
    company_name: Optional[str] = None
    submitter_role: Optional[str] = None
    years_experience: Optional[int] = None


class Submission(SubmissionBase):
    id: str
    user_id: Optional[str] = None
    status: str = "pending"
    admin_notes: Optional[str] = None
    has_unread_user_messages: bool = False
    terms_accepted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    name: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


# Admin-specific schemas
class SubmitterProfile(BaseModel):
    """Profile information for a submitter"""
    id: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActivityLogEntry(BaseModel):
    """User activity log entry"""
    id: str
    activity_type: str
    activity_details: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True


class SubmitterFullProfile(BaseModel):
    """Full submitter profile with activity history and all submissions"""
    profile: SubmitterProfile
    submissions: List[Submission] = []
    activity_history: List[ActivityLogEntry] = []
    total_submissions: int = 0
    approved_submissions: int = 0

    class Config:
        from_attributes = True
