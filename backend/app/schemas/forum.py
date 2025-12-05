"""
Forum Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ForumCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    slug: str


class ForumCategory(ForumCategoryBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ForumThreadBase(BaseModel):
    title: str
    content: str
    category_id: Optional[str] = None
    is_anonymous: bool = False
    is_pinned: bool = False


class ForumThreadCreate(ForumThreadBase):
    pass


class ForumThreadUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[str] = None
    is_pinned: Optional[bool] = None


class ForumThread(ForumThreadBase):
    id: str
    author_id: str
    reply_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ForumReplyBase(BaseModel):
    content: str
    is_anonymous: bool = False


class ForumReplyCreate(ForumReplyBase):
    thread_id: str


class ForumReply(ForumReplyBase):
    id: str
    thread_id: str
    author_id: str
    created_at: datetime

    class Config:
        from_attributes = True
