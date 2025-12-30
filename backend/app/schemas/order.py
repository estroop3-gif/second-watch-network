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
    MembershipTier,
    CraftHouseStatus,
    CraftHouseRole,
    FellowshipType,
    FellowshipRole,
    GovernancePositionType,
    GovernanceScopeType,
    DuesPaymentStatus,
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


class OrderMemberTierUpdate(BaseModel):
    """Admin update for member tier"""
    membership_tier: MembershipTier
    reason: Optional[str] = Field(None, max_length=500)


class OrderMemberLodgeAssignment(BaseModel):
    """Admin assignment of member to lodge"""
    lodge_id: int
    is_officer: bool = False
    officer_title: Optional[str] = Field(None, max_length=100)


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


class LodgeOfficerAppoint(BaseModel):
    """Appoint an officer to a lodge (admin only)"""
    user_id: str
    officer_title: str = Field(min_length=2, max_length=100)


class LodgeMembershipUpdate(BaseModel):
    """Update a lodge membership (admin only)"""
    is_officer: Optional[bool] = None
    officer_title: Optional[str] = Field(None, max_length=100)
    status: Optional[LodgeMembershipStatus] = None


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


# ============ Craft House Schemas ============

class CraftHouseCreate(BaseModel):
    """Create a new Craft House (admin only)"""
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=100, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = Field(None, max_length=2000)
    icon: Optional[str] = Field(None, max_length=50)
    primary_tracks: Optional[List[PrimaryTrack]] = None
    status: CraftHouseStatus = CraftHouseStatus.ACTIVE


class CraftHouseUpdate(BaseModel):
    """Update Craft House (admin only)"""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    icon: Optional[str] = Field(None, max_length=50)
    primary_tracks: Optional[List[PrimaryTrack]] = None
    status: Optional[CraftHouseStatus] = None


class CraftHouseResponse(BaseModel):
    """Craft House response"""
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    primary_tracks: Optional[List[str]] = None
    status: CraftHouseStatus
    created_at: datetime
    updated_at: datetime

    # Computed fields
    member_count: Optional[int] = 0
    steward_name: Optional[str] = None  # Craft Steward name

    class Config:
        from_attributes = True


class CraftHouseListResponse(BaseModel):
    """List of craft houses"""
    craft_houses: List[CraftHouseResponse]
    total: int


class CraftHouseMembershipResponse(BaseModel):
    """Craft House membership response"""
    id: int
    user_id: str
    craft_house_id: int
    role: CraftHouseRole
    joined_at: datetime
    created_at: datetime

    # Joined fields
    craft_house_name: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class CraftHouseMemberResponse(BaseModel):
    """Member within a Craft House"""
    user_id: str
    user_name: Optional[str] = None
    role: CraftHouseRole
    primary_track: Optional[PrimaryTrack] = None
    city: Optional[str] = None
    joined_at: datetime


class CraftHouseMemberListResponse(BaseModel):
    """List of members in a Craft House"""
    members: List[CraftHouseMemberResponse]
    total: int


class CraftHouseLeadershipAppoint(BaseModel):
    """Appoint leadership to a Craft House (admin only)"""
    user_id: str
    role: CraftHouseRole = CraftHouseRole.STEWARD


class CraftHouseMembershipUpdate(BaseModel):
    """Update a craft house membership (admin only)"""
    role: Optional[CraftHouseRole] = None


# ============ Fellowship Schemas ============

class FellowshipCreate(BaseModel):
    """Create a new Fellowship (admin only)"""
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=100, pattern=r'^[a-z0-9-]+$')
    fellowship_type: FellowshipType
    description: Optional[str] = Field(None, max_length=2000)
    requirements: Optional[str] = Field(None, max_length=1000)
    is_opt_in: bool = True
    is_visible: bool = True


class FellowshipUpdate(BaseModel):
    """Update Fellowship (admin only)"""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    requirements: Optional[str] = Field(None, max_length=1000)
    fellowship_type: Optional[FellowshipType] = None
    is_opt_in: Optional[bool] = None
    is_visible: Optional[bool] = None
    status: Optional[CraftHouseStatus] = None


class FellowshipResponse(BaseModel):
    """Fellowship response"""
    id: int
    name: str
    slug: str
    fellowship_type: FellowshipType
    description: Optional[str] = None
    requirements: Optional[str] = None
    is_opt_in: bool
    is_visible: bool
    status: CraftHouseStatus
    created_at: datetime
    updated_at: datetime

    # Computed fields
    member_count: Optional[int] = 0

    class Config:
        from_attributes = True


class FellowshipListResponse(BaseModel):
    """List of fellowships"""
    fellowships: List[FellowshipResponse]
    total: int


class FellowshipMembershipResponse(BaseModel):
    """Fellowship membership response"""
    id: int
    user_id: str
    fellowship_id: int
    role: FellowshipRole
    joined_at: datetime
    created_at: datetime

    # Joined fields
    fellowship_name: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class FellowshipLeadershipAppoint(BaseModel):
    """Appoint leadership to a Fellowship (admin only)"""
    user_id: str
    role: FellowshipRole = FellowshipRole.LEADER


class FellowshipMembershipUpdate(BaseModel):
    """Update a fellowship membership (admin only)"""
    role: Optional[FellowshipRole] = None


# ============ Governance Schemas ============

class GovernancePositionCreate(BaseModel):
    """Create a governance position (admin only)"""
    user_id: str
    position_type: GovernancePositionType
    scope_type: Optional[GovernanceScopeType] = None
    scope_id: Optional[int] = None
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class GovernancePositionUpdate(BaseModel):
    """Update governance position"""
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None
    ended_at: Optional[datetime] = None


class GovernancePositionResponse(BaseModel):
    """Governance position response"""
    id: int
    user_id: str
    position_type: GovernancePositionType
    scope_type: Optional[GovernanceScopeType] = None
    scope_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    is_active: bool
    appointed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    user_name: Optional[str] = None
    scope_name: Optional[str] = None  # Lodge name, Craft House name, etc.

    class Config:
        from_attributes = True


class GovernancePositionListResponse(BaseModel):
    """List of governance positions"""
    positions: List[GovernancePositionResponse]
    total: int


class HighCouncilResponse(BaseModel):
    """High Council leadership"""
    grand_master: Optional[GovernancePositionResponse] = None
    council_members: List[GovernancePositionResponse]


# ============ Membership Tier Schemas ============

class MembershipTierInfo(BaseModel):
    """Information about a membership tier"""
    tier: MembershipTier
    name: str
    price_cents: int
    description: str
    benefits: List[str]


class MembershipStatusResponse(BaseModel):
    """Current membership status for a user"""
    is_order_member: bool
    membership_status: Optional[OrderMemberStatus] = None
    membership_tier: Optional[MembershipTier] = None
    tier_started_at: Optional[datetime] = None
    dues_status: Optional[str] = None
    next_billing_date: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None


class MembershipUpgradeRequest(BaseModel):
    """Request to upgrade membership tier"""
    target_tier: MembershipTier
    return_url: Optional[str] = None  # Where to redirect after checkout


class MembershipUpgradeResponse(BaseModel):
    """Response for membership upgrade request"""
    checkout_url: str  # Stripe checkout URL
    session_id: str


# ============ Dues Payment Schemas ============

class DuesPaymentResponse(BaseModel):
    """Dues payment record"""
    id: int
    user_id: str
    amount_cents: int
    tier: MembershipTier
    stripe_payment_intent_id: Optional[str] = None
    stripe_invoice_id: Optional[str] = None
    status: DuesPaymentStatus
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DuesPaymentListResponse(BaseModel):
    """List of dues payments"""
    payments: List[DuesPaymentResponse]
    total: int


# ============ Extended Dashboard Stats ============

class OrderDashboardStatsExtended(BaseModel):
    """Extended Order dashboard stats with craft house and fellowship info"""
    is_order_member: bool
    membership_status: Optional[OrderMemberStatus] = None
    membership_tier: Optional[MembershipTier] = None
    dues_status: Optional[str] = None
    primary_track: Optional[PrimaryTrack] = None

    # Lodge
    lodge_id: Optional[int] = None
    lodge_name: Optional[str] = None

    # Craft Houses
    craft_houses: List[CraftHouseMembershipResponse] = []

    # Fellowships
    fellowships: List[FellowshipMembershipResponse] = []

    # Activity
    joined_at: Optional[datetime] = None
    pending_booking_requests: int = 0
    active_job_applications: int = 0

    # Governance (if any)
    governance_positions: List[GovernancePositionResponse] = []


# ============ Order Event Schemas ============

class OrderEventType(str):
    """Event type values"""
    MEETUP = "meetup"
    WORKSHOP = "workshop"
    ONLINE = "online"
    SCREENING = "screening"
    REGIONAL = "regional"
    CONFERENCE = "conference"


class OrderEventCreate(BaseModel):
    """Create a new Order event"""
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    event_type: str = Field(...)  # meetup, workshop, online, screening, regional, conference
    start_date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    is_online: bool = False
    online_link: Optional[str] = Field(None, max_length=500)
    lodge_id: Optional[int] = None
    craft_house_id: Optional[int] = None
    fellowship_id: Optional[int] = None
    max_attendees: Optional[int] = Field(None, ge=1)


class OrderEventUpdate(BaseModel):
    """Update an Order event"""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    event_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    is_online: Optional[bool] = None
    online_link: Optional[str] = Field(None, max_length=500)
    max_attendees: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class OrderEventResponse(BaseModel):
    """Order event response"""
    id: int
    title: str
    description: Optional[str] = None
    event_type: str
    start_date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    is_online: bool = False
    online_link: Optional[str] = None
    lodge_id: Optional[int] = None
    lodge_name: Optional[str] = None
    craft_house_id: Optional[int] = None
    craft_house_name: Optional[str] = None
    fellowship_id: Optional[int] = None
    fellowship_name: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    is_active: bool = True
    max_attendees: Optional[int] = None
    rsvp_count: int = 0
    user_rsvp_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderEventListResponse(BaseModel):
    """List of events with pagination info"""
    events: List[OrderEventResponse]
    total: int
    skip: int
    limit: int


class OrderEventRSVPCreate(BaseModel):
    """RSVP to an event"""
    status: str = Field("attending", pattern="^(attending|maybe|declined)$")


class OrderEventRSVPResponse(BaseModel):
    """Event RSVP response"""
    id: int
    event_id: int
    user_id: str
    user_name: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Craft House Discussion Schemas ============

class CraftHouseTopicCreate(BaseModel):
    """Create a new discussion topic in a craft house"""
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=100, pattern="^[a-z0-9-]+$")
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = 0
    is_members_only: bool = False


class CraftHouseTopicUpdate(BaseModel):
    """Update a discussion topic"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None
    is_members_only: Optional[bool] = None
    is_active: Optional[bool] = None


class CraftHouseTopicResponse(BaseModel):
    """Discussion topic response"""
    id: str
    craft_house_id: int
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    is_members_only: bool = False
    is_active: bool = True
    thread_count: int = 0
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CraftHouseTopicListResponse(BaseModel):
    """List of discussion topics"""
    topics: List[CraftHouseTopicResponse]
    craft_house_id: int
    craft_house_name: str


class CraftHouseThreadCreate(BaseModel):
    """Create a new discussion thread"""
    topic_id: str
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    is_announcement: bool = False


class CraftHouseThreadUpdate(BaseModel):
    """Update a discussion thread"""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    is_pinned: Optional[bool] = None
    is_locked: Optional[bool] = None


class CraftHouseThreadResponse(BaseModel):
    """Discussion thread response"""
    id: str
    topic_id: str
    topic_name: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    title: str
    content: str
    is_pinned: bool = False
    is_announcement: bool = False
    is_locked: bool = False
    reply_count: int = 0
    view_count: int = 0
    last_activity_at: datetime
    last_reply_by: Optional[str] = None
    last_reply_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CraftHouseThreadListResponse(BaseModel):
    """List of discussion threads"""
    threads: List[CraftHouseThreadResponse]
    total: int
    skip: int
    limit: int


class CraftHouseReplyCreate(BaseModel):
    """Create a new reply to a thread"""
    content: str = Field(..., min_length=1)
    parent_reply_id: Optional[str] = None


class CraftHouseReplyUpdate(BaseModel):
    """Update a reply"""
    content: str = Field(..., min_length=1)


class CraftHouseReplyResponse(BaseModel):
    """Discussion reply response"""
    id: str
    thread_id: str
    user_id: str
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    content: str
    parent_reply_id: Optional[str] = None
    is_edited: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CraftHouseReplyListResponse(BaseModel):
    """List of replies"""
    replies: List[CraftHouseReplyResponse]
    total: int


class CraftHouseThreadDetailResponse(BaseModel):
    """Full thread with replies"""
    thread: CraftHouseThreadResponse
    replies: List[CraftHouseReplyResponse]
    total_replies: int


class CraftHouseMemberRoleUpdate(BaseModel):
    """Update a member's role in the craft house"""
    role: CraftHouseRole
