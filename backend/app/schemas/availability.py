"""
Availability Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class AvailabilityBase(BaseModel):
    start_date: date
    end_date: Optional[date] = None
    is_available: bool = True
    notes: Optional[str] = None


class AvailabilityCreate(AvailabilityBase):
    pass


class AvailabilityUpdate(AvailabilityBase):
    pass


class Availability(AvailabilityBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
