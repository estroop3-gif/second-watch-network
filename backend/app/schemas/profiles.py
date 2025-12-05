"""
Profile Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class ProfileBase(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = "user"
    status: Optional[str] = "active"


class ProfileCreate(ProfileBase):
    email: EmailStr


class ProfileUpdate(ProfileBase):
    pass


class Profile(ProfileBase):
    id: str
    email: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FilmmakerProfileBase(BaseModel):
    bio: Optional[str] = None
    skills: Optional[list[str]] = None
    experience_level: Optional[str] = None
    department: Optional[str] = None
    portfolio_url: Optional[str] = None
    reel_url: Optional[str] = None
    location: Optional[str] = None
    accepting_work: bool = True
    status_message: Optional[str] = None


class FilmmakerProfileCreate(FilmmakerProfileBase):
    user_id: str


class FilmmakerProfileUpdate(FilmmakerProfileBase):
    pass


class FilmmakerProfile(FilmmakerProfileBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FilmmakerProfileWithUser(FilmmakerProfile):
    profile: Profile
