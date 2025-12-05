"""
Green Room Pydantic Schemas
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime
from app.models.greenroom import CycleStatus, ProjectStatus, PaymentStatus


# ============ Cycle Schemas ============

class CycleBase(BaseModel):
    """Base cycle schema"""
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    max_tickets_per_user: int = Field(default=100, ge=1, le=1000)
    ticket_price: float = Field(default=10.0, ge=0)


class CycleCreate(CycleBase):
    """Create new cycle"""
    pass


class CycleUpdate(BaseModel):
    """Update existing cycle"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_tickets_per_user: Optional[int] = Field(None, ge=1, le=1000)
    ticket_price: Optional[float] = Field(None, ge=0)
    status: Optional[CycleStatus] = None


class CycleResponse(CycleBase):
    """Cycle response"""
    id: int
    status: CycleStatus
    created_at: datetime
    updated_at: datetime
    project_count: Optional[int] = 0  # Total projects in cycle
    total_votes: Optional[int] = 0  # Total votes cast

    class Config:
        from_attributes = True


# ============ Project Schemas ============

class ProjectBase(BaseModel):
    """Base project schema"""
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    video_url: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None


class ProjectSubmit(ProjectBase):
    """Submit new project"""
    cycle_id: int


class ProjectUpdate(BaseModel):
    """Update project (only if pending)"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=10)
    category: Optional[str] = Field(None, max_length=100)
    video_url: Optional[HttpUrl] = None
    image_url: Optional[HttpUrl] = None


class ProjectResponse(ProjectBase):
    """Project response"""
    id: int
    cycle_id: int
    filmmaker_id: str
    status: ProjectStatus
    vote_count: int
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None

    # Additional computed fields
    filmmaker_name: Optional[str] = None  # From User table
    user_vote_count: Optional[int] = None  # Current user's votes on this project

    class Config:
        from_attributes = True


class ProjectApproval(BaseModel):
    """Approve or reject project"""
    status: ProjectStatus = Field(..., description="approved or rejected")


# ============ Voting Ticket Schemas ============

class TicketPurchaseRequest(BaseModel):
    """Request to purchase voting tickets"""
    cycle_id: int
    ticket_count: int = Field(ge=1, le=100)


class TicketPurchaseResponse(BaseModel):
    """Response for ticket purchase (Stripe session)"""
    checkout_session_id: str
    checkout_url: str
    amount: float
    ticket_count: int


class VotingTicketResponse(BaseModel):
    """User's voting tickets for a cycle"""
    id: int
    user_id: str
    cycle_id: int
    tickets_purchased: int
    tickets_used: int
    tickets_available: int
    payment_status: PaymentStatus
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Vote Schemas ============

class VoteCast(BaseModel):
    """Cast vote on a project"""
    project_id: int
    tickets_allocated: int = Field(ge=1, description="Number of tickets to allocate")


class VoteResponse(BaseModel):
    """Vote response"""
    id: int
    user_id: str
    project_id: int
    cycle_id: int
    tickets_allocated: int
    created_at: datetime

    # Additional fields
    project_title: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Results Schemas ============

class ProjectResult(BaseModel):
    """Project with vote results"""
    project_id: int
    title: str
    filmmaker_id: str
    filmmaker_name: Optional[str] = None
    vote_count: int
    rank: int


class CycleResults(BaseModel):
    """Cycle voting results"""
    cycle_id: int
    cycle_name: str
    status: CycleStatus
    total_projects: int
    total_votes: int
    total_voters: int
    projects: list[ProjectResult]


# ============ Stats Schemas ============

class UserGreenRoomStats(BaseModel):
    """User's Green Room statistics"""
    total_tickets_purchased: int
    total_tickets_used: int
    total_votes_cast: int
    projects_submitted: int
    projects_approved: int


class CycleStats(BaseModel):
    """Cycle statistics"""
    cycle_id: int
    total_projects: int
    approved_projects: int
    pending_projects: int
    rejected_projects: int
    total_tickets_sold: int
    total_votes_cast: int
    unique_voters: int
    revenue: float  # Total ticket sales
