"""
Admin Schemas
"""
from pydantic import BaseModel
from typing import Optional


class FilmmakerApplication(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: str
    experience_level: str
    department: str
    portfolio_url: Optional[str] = None
    why_join: str
    status: str = "pending"
    
    class Config:
        from_attributes = True


class PartnerApplication(BaseModel):
    id: str
    company_name: str
    contact_name: str
    email: str
    website: Optional[str] = None
    partnership_type: str
    description: str
    status: str = "pending"
    
    class Config:
        from_attributes = True
