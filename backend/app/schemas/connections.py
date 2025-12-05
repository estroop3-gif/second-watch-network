"""
Connection/Networking Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ConnectionBase(BaseModel):
    pass


class ConnectionCreate(BaseModel):
    recipient_id: str
    message: Optional[str] = None


class ConnectionUpdate(BaseModel):
    status: str  # accepted, denied


class Connection(ConnectionBase):
    id: str
    requester_id: str
    recipient_id: str
    status: str = "pending"  # pending, accepted, denied
    message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
