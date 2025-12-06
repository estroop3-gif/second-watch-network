"""
Second Watch Order Pydantic Schemas
Request/Response schemas for Order API endpoints
"""
from pydantic import BaseModel, Field, EmailStr, HttpUrl
from typing import Optional, List
from datetime import datetime
from app.models.order import (
    OrderMemberStatus,
    OrderApplicationStatus,
    LodgeStatus,
    LodgeMembershipStatus,
    OrderJobType,
    OrderJobVisibility,
    OrderJobApplicationStatus,
    PrimaryTrack,
)


# ============ Order Application Schemas ============

class OrderApplicationCreate(BaseModel):
    """Submit application to join The Order"""
    primary_track: PrimaryTrack
    city: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    portfolio_links: Optional[str] = None  # JSON array as string
    statement: Optional[str] = Field(None, max_length=2000)
    years_experience: Optional[int] = Field(None, ge=0, le=50)
    current_role: Optional[str] = Field(None, max_length=200)


class OrderApplicationResponse(BaseModel):
    """Order application response"""
    id: int
    user_id: str
    primary_track: PrimaryTrack
    city: Optional[str] = None
    region: Optional[str] = None
    portfolio_links: Optional[str] = None
    statement: Optional[str] = None
    years_experience: Optional[int] = None
    current_role: Optional[str] = None
    status: OrderApplicationStatus
    reviewed_by_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Additional fields for admin view
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None

    class Config:
        from_attributes = True


class OrderApplicationAdminUpdate(BaseModel):
    """Admin update for application (approve/reject)"""
    status: OrderApplicationStatus
    rejection_reason: Optional[str] = Field(None, max_length=500)


class OrderApplicationListResponse(BaseModel):
    """List of applications with pagination info"""
    applications: List[OrderApplicationResponse]
    total: int
    skip: int
    limit: int


# ============ Order Member Profile Schemas ============

class OrderMemberProfileCreate(BaseModel):
    """Create or update Order member profile"""
    primary_track: PrimaryTrack
    secondary_tracks: Optional[str] = None  # JSON array as string
    city: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    portfolio_url: Optional[HttpUrl] = None
    imdb_url: Optional[HttpUrl] = None
    youtube_url: Optional[HttpUrl] = None
    vimeo_url: Optional[HttpUrl] = None
    website_url: Optional[HttpUrl] = None
    gear_summary: Optional[str] = Field(None, max_length=1000)
    bio: Optional[str] = Field(None, max_length=2000)
    years_experience: Optional[int] = Field(None, ge=0, le=50)
    availability_status: Optional[str] = Field("available", max_length=50)


class OrderMemberProfileUpdate(BaseModel):
    """Update Order member profile fields"""
    primary_track: Optional[PrimaryTrack] = None
    secondary_tracks: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    portfolio_url: Optional[HttpUrl] = None
    imdb_url: Optional[HttpUrl] = None
    youtube_url: Optional[HttpUrl] = None
    vimeo_url: Optional[HttpUrl] = None
    website_url: Optional[HttpUrl] = None
    gear_summary: Optional[str] = Field(None, max_length=1000)
    bio: Optional[str] = Field(None, max_length=2000)
    years_experience: Optional[int] = Field(None, ge=0, le=50)
    availability_status: Optional[str] = Field(None, max_length=50)


class OrderMemberProfileResponse(BaseModel):
    """Order member profile response"""
    id: int
    user_id: str
    primary_track: PrimaryTrack
    secondary_tracks: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    portfolio_url: Optional[str] = None
    imdb_url: Optional[str] = None
    youtube_url: Optional[str] = None
    vimeo_url: Optional[str] = None
    website_url: Optional[str] = None
    gear_summary: Optional[str] = None
    bio: Optional[str] = None
    years_experience: Optional[int] = None
    availability_status: Optional[str] = None
    lodge_id: Optional[int] = None
    status: OrderMemberStatus
    joined_at: Optional[datetime] = None
    dues_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Additional computed/joined fields
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    lodge_name: Optional[str] = None
    lodge_city: Optional[str] = None

    class Config:
        from_attributes = True


class OrderMemberAdminUpdate(BaseModel):
    """Admin update for member status"""
    status: OrderMemberStatus
    reason: Optional[str] = Field(None, max_length=500)


class OrderMemberListResponse(BaseModel):
    """List of Order members with pagination"""
    members: List[OrderMemberProfileResponse]
    total: int
    skip: int
    limit: int


class OrderMemberDirectoryEntry(BaseModel):
    """Simplified member entry for directory listing"""
    user_id: str
    user_name: Optional[str] = None
    primary_track: PrimaryTrack
    city: Optional[str] = None
    region: Optional[str] = None
    lodge_name: Optional[str] = None
    availability_status: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None  # Truncated for listing


# ============ Lodge Schemas ============

class LodgeCreate(BaseModel):
    """Create a new Lodge (admin only)"""
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=100, pattern=r'^[a-z0-9-]+$')
    city: str = Field(min_length=2, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    base_lodge_dues_cents: int = Field(default=2500, ge=0)
    contact_email: Optional[EmailStr] = None
    contact_user_id: Optional[str] = None


class LodgeUpdate(BaseModel):
    """Update Lodge (admin only)"""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    status: Optional[LodgeStatus] = None
    description: Optional[str] = Field(None, max_length=2000)
    base_lodge_dues_cents: Optional[int] = Field(None, ge=0)
    contact_email: Optional[EmailStr] = None
    contact_user_id: Optional[str] = None


class LodgeResponse(BaseModel):
    """Lodge response"""
    id: int
    name: str
    slug: str
    city: str
    region: Optional[str] = None
    status: LodgeStatus
    description: Optional[str] = None
    base_lodge_dues_cents: int
    contact_email: Optional[str] = None
    contact_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    member_count: Optional[int] = 0
    officer_name: Optional[str] = None  # Primary contact name

    class Config:
        from_attributes = True


class LodgeListResponse(BaseModel):
    """List of lodges"""
    lodges: List[LodgeResponse]
    total: int


# ============ Lodge Membership Schemas ============

class LodgeMembershipResponse(BaseModel):
    """Lodge membership response"""
    id: int
    user_id: str
    lodge_id: int
    status: LodgeMembershipStatus
    is_officer: bool
    officer_title: Optional[str] = None
    joined_at: Optional[datetime] = None
    dues_status: Optional[str] = None
    created_at: datetime

    # Joined fields
    lodge_name: Optional[str] = None
    lodge_city: Optional[str] = None

    class Config:
        from_attributes = True


class LodgeJoinRequest(BaseModel):
    """Request to join a lodge"""
    # No additional fields needed - lodge_id from URL, user from auth
    pass


# ============ Order Job Schemas ============

class OrderJobCreate(BaseModel):
    """Create a job posting"""
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=20)
    location: Optional[str] = Field(None, max_length=200)
    job_type: OrderJobType = OrderJobType.OTHER
    roles_needed: Optional[str] = None  # JSON array of PrimaryTrack values
    pay_info: Optional[str] = Field(None, max_length=500)
    is_paid: bool = True
    visibility: OrderJobVisibility = OrderJobVisibility.ORDER_ONLY
    lodge_id: Optional[int] = None
    organization_name: Optional[str] = Field(None, max_length=200)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    application_deadline: Optional[datetime] = None


class OrderJobUpdate(BaseModel):
    """Update a job posting"""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=20)
    location: Optional[str] = Field(None, max_length=200)
    job_type: Optional[OrderJobType] = None
    roles_needed: Optional[str] = None
    pay_info: Optional[str] = Field(None, max_length=500)
    is_paid: Optional[bool] = None
    visibility: Optional[OrderJobVisibility] = None
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    application_deadline: Optional[datetime] = None


class OrderJobResponse(BaseModel):
    """Job posting response"""
    id: int
    title: str
    description: str
    location: Optional[str] = None
    job_type: OrderJobType
    roles_needed: Optional[str] = None
    pay_info: Optional[str] = None
    is_paid: bool
    visibility: OrderJobVisibility
    created_by_id: str
    lodge_id: Optional[int] = None
    organization_name: Optional[str] = None
    is_active: bool
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    application_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    lodge_name: Optional[str] = None
    created_by_name: Optional[str] = None
    application_count: Optional[int] = 0
    user_has_applied: Optional[bool] = False

    class Config:
        from_attributes = True


class OrderJobListResponse(BaseModel):
    """List of jobs with pagination"""
    jobs: List[OrderJobResponse]
    total: int
    skip: int
    limit: int


# ============ Job Application Schemas ============

class OrderJobApplicationCreate(BaseModel):
    """Apply to a job"""
    cover_note: Optional[str] = Field(None, max_length=2000)
    portfolio_url: Optional[HttpUrl] = None


class OrderJobApplicationResponse(BaseModel):
    """Job application response"""
    id: int
    job_id: int
    user_id: str
    cover_note: Optional[str] = None
    portfolio_url: Optional[str] = None
    status: OrderJobApplicationStatus
    reviewed_by_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    feedback: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Joined fields
    job_title: Optional[str] = None
    applicant_name: Optional[str] = None
    applicant_track: Optional[PrimaryTrack] = None

    class Config:
        from_attributes = True


class OrderJobApplicationAdminUpdate(BaseModel):
    """Admin update for job application"""
    status: OrderJobApplicationStatus
    feedback: Optional[str] = Field(None, max_length=1000)


class OrderJobApplicationListResponse(BaseModel):
    """List of job applications"""
    applications: List[OrderJobApplicationResponse]
    total: int


# ============ Booking Request Schemas ============

class OrderBookingRequestCreate(BaseModel):
    """Create a booking request for an Order member"""
    target_user_id: str
    requester_name: str = Field(min_length=2, max_length=200)
    requester_email: EmailStr
    requester_phone: Optional[str] = Field(None, max_length=50)
    requester_org: Optional[str] = Field(None, max_length=200)
    project_title: Optional[str] = Field(None, max_length=200)
    details: str = Field(min_length=20, max_length=5000)
    location: Optional[str] = Field(None, max_length=200)
    dates: Optional[str] = Field(None, max_length=200)
    budget_range: Optional[str] = Field(None, max_length=100)
    roles_needed: Optional[str] = None  # JSON array


class OrderBookingRequestResponse(BaseModel):
    """Booking request response"""
    id: int
    target_user_id: str
    requester_user_id: Optional[str] = None
    requester_name: str
    requester_email: str
    requester_phone: Optional[str] = None
    requester_org: Optional[str] = None
    project_title: Optional[str] = None
    details: str
    location: Optional[str] = None
    dates: Optional[str] = None
    budget_range: Optional[str] = None
    roles_needed: Optional[str] = None
    status: str
    response_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Joined fields
    target_user_name: Optional[str] = None

    class Config:
        from_attributes = True


class OrderBookingRequestUpdate(BaseModel):
    """Update booking request (by target member)"""
    status: str = Field(max_length=50)  # pending, contacted, accepted, declined
    response_notes: Optional[str] = Field(None, max_length=1000)


# ============ Stats and Dashboard Schemas ============

class OrderDashboardStats(BaseModel):
    """User's Order dashboard stats"""
    is_order_member: bool
    membership_status: Optional[OrderMemberStatus] = None
    dues_status: Optional[str] = None
    primary_track: Optional[PrimaryTrack] = None
    lodge_id: Optional[int] = None
    lodge_name: Optional[str] = None
    joined_at: Optional[datetime] = None
    pending_booking_requests: int = 0
    active_job_applications: int = 0


class OrderAdminStats(BaseModel):
    """Admin Order statistics"""
    total_members: int
    active_members: int
    probationary_members: int
    suspended_members: int
    pending_applications: int
    total_lodges: int
    active_lodges: int
    active_jobs: int
    members_by_track: dict  # {track: count}
    members_by_city: dict  # {city: count}


class LodgeStats(BaseModel):
    """Statistics for a single lodge"""
    lodge_id: int
    lodge_name: str
    member_count: int
    officer_count: int
    pending_members: int
