"""
Second Watch Order Models
The Order is a professional, God-centered guild for filmmakers and crew.
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ============ Enums ============

class OrderMemberStatus(str, Enum):
    """Order member status"""
    PROBATIONARY = "probationary"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    EXPELLED = "expelled"


class OrderApplicationStatus(str, Enum):
    """Order application status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LodgeStatus(str, Enum):
    """Lodge chapter status"""
    FORMING = "forming"
    ACTIVE = "active"
    INACTIVE = "inactive"


class LodgeMembershipStatus(str, Enum):
    """Lodge membership status"""
    PENDING = "pending"
    ACTIVE = "active"
    FORMER = "former"


class OrderJobType(str, Enum):
    """Type of job/gig"""
    SHOOT = "shoot"
    EDIT = "edit"
    REMOTE = "remote"
    HYBRID = "hybrid"
    OTHER = "other"


class OrderJobVisibility(str, Enum):
    """Job visibility level"""
    ORDER_ONLY = "order_only"
    ORDER_PRIORITY = "order_priority"
    PUBLIC = "public"


class OrderJobApplicationStatus(str, Enum):
    """Job application status"""
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class PrimaryTrack(str, Enum):
    """Primary professional track for Order members"""
    CAMERA = "camera"
    POST = "post"
    AUDIO = "audio"
    LIGHTING = "lighting"
    PRODUCTION = "production"
    DIRECTING = "directing"
    WRITING = "writing"
    CHURCH_MEDIA = "church_media"
    VFX = "vfx"
    MOTION_GRAPHICS = "motion_graphics"
    COLORIST = "colorist"
    PRODUCER = "producer"
    OTHER = "other"


# ============ Models ============

class Lodge(SQLModel, table=True):
    """
    Lodge represents a city-based chapter of The Order.
    Lodges are where members gather locally for fellowship, training, and networking.
    """
    __tablename__ = "order_lodges"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=200, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    city: str = Field(max_length=100, index=True)
    region: Optional[str] = Field(default=None, max_length=100)
    status: LodgeStatus = Field(default=LodgeStatus.FORMING, index=True)
    description: Optional[str] = None

    # Dues configuration (in cents for precision)
    base_lodge_dues_cents: int = Field(default=2500)  # $25.00

    # Contact info for the lodge
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_user_id: Optional[str] = None  # Primary officer/contact

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    memberships: List["LodgeMembership"] = Relationship(back_populates="lodge")
    member_profiles: List["OrderMemberProfile"] = Relationship(back_populates="lodge")
    jobs: List["OrderJob"] = Relationship(back_populates="lodge")


class OrderMemberProfile(SQLModel, table=True):
    """
    Order Member Profile contains the professional details for an Order member.
    Created after application approval.
    """
    __tablename__ = "order_member_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(unique=True, index=True)  # FK to Supabase auth.users

    # Professional info
    primary_track: PrimaryTrack = Field(index=True)
    secondary_tracks: Optional[str] = None  # JSON array as string: ["post", "audio"]

    # Location
    city: Optional[str] = Field(default=None, max_length=100, index=True)
    region: Optional[str] = Field(default=None, max_length=100)

    # Portfolio links
    portfolio_url: Optional[str] = None
    imdb_url: Optional[str] = None
    youtube_url: Optional[str] = None
    vimeo_url: Optional[str] = None
    website_url: Optional[str] = None

    # Professional details
    gear_summary: Optional[str] = None  # Brief description of gear owned
    bio: Optional[str] = None  # Professional bio
    years_experience: Optional[int] = None
    availability_status: Optional[str] = Field(default="available", max_length=50)  # available, busy, unavailable

    # Lodge affiliation
    lodge_id: Optional[int] = Field(default=None, foreign_key="order_lodges.id", index=True)

    # Membership status
    status: OrderMemberStatus = Field(default=OrderMemberStatus.PROBATIONARY, index=True)
    joined_at: Optional[datetime] = None
    probation_ends_at: Optional[datetime] = None  # When probationary period ends

    # Stripe subscription tracking (stub for now)
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    dues_status: Optional[str] = Field(default="pending", max_length=50)  # pending, active, past_due, cancelled

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    lodge: Optional[Lodge] = Relationship(back_populates="member_profiles")


class OrderApplication(SQLModel, table=True):
    """
    Application to join The Order.
    Reviewed by admin before approval.
    """
    __tablename__ = "order_applications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to Supabase auth.users

    # Application details
    primary_track: PrimaryTrack
    city: Optional[str] = Field(default=None, max_length=100)
    region: Optional[str] = Field(default=None, max_length=100)
    portfolio_links: Optional[str] = None  # JSON array as string
    statement: Optional[str] = None  # Personal statement / why they want to join
    years_experience: Optional[int] = None
    current_role: Optional[str] = Field(default=None, max_length=200)  # Current job title/role

    # Application status
    status: OrderApplicationStatus = Field(default=OrderApplicationStatus.PENDING, index=True)
    reviewed_by_id: Optional[str] = None  # Admin user_id who reviewed
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LodgeMembership(SQLModel, table=True):
    """
    Tracks a user's membership in a specific Lodge.
    Order members can be part of one lodge at a time (primary).
    """
    __tablename__ = "order_lodge_memberships"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to Supabase auth.users
    lodge_id: int = Field(foreign_key="order_lodges.id", index=True)

    # Membership details
    status: LodgeMembershipStatus = Field(default=LodgeMembershipStatus.PENDING, index=True)
    is_officer: bool = Field(default=False)  # Lodge leadership flag
    officer_title: Optional[str] = Field(default=None, max_length=100)  # e.g., "Lodge Master", "Secretary"

    # Dates
    joined_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    # Stripe subscription for lodge dues (stub)
    stripe_subscription_id: Optional[str] = None
    dues_status: Optional[str] = Field(default="pending", max_length=50)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    lodge: Lodge = Relationship(back_populates="memberships")

    class Config:
        # Ensure one active membership per user per lodge
        table_args = {
            "unique_constraints": [("user_id", "lodge_id")]
        }


class OrderJob(SQLModel, table=True):
    """
    Job/gig posting for Order members.
    Can be posted by Second Watch, partners, or churches.
    """
    __tablename__ = "order_jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=200, index=True)
    description: str

    # Job details
    location: Optional[str] = Field(default=None, max_length=200)
    job_type: OrderJobType = Field(default=OrderJobType.OTHER, index=True)
    roles_needed: Optional[str] = None  # JSON array of PrimaryTrack values
    pay_info: Optional[str] = None  # Description of compensation
    is_paid: bool = Field(default=True)

    # Visibility
    visibility: OrderJobVisibility = Field(default=OrderJobVisibility.ORDER_ONLY, index=True)

    # Associations
    created_by_id: str = Field(index=True)  # User who posted (admin/partner)
    lodge_id: Optional[int] = Field(default=None, foreign_key="order_lodges.id", index=True)
    organization_name: Optional[str] = Field(default=None, max_length=200)  # For partner posts

    # Status and dates
    is_active: bool = Field(default=True, index=True)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    application_deadline: Optional[datetime] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    lodge: Optional[Lodge] = Relationship(back_populates="jobs")
    applications: List["OrderJobApplication"] = Relationship(back_populates="job")


class OrderJobApplication(SQLModel, table=True):
    """
    Application from an Order member to a job posting.
    """
    __tablename__ = "order_job_applications"

    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="order_jobs.id", index=True)
    user_id: str = Field(index=True)  # FK to Supabase auth.users

    # Application details
    cover_note: Optional[str] = None  # Brief message from applicant
    portfolio_url: Optional[str] = None  # Optional specific portfolio for this job

    # Status
    status: OrderJobApplicationStatus = Field(default=OrderJobApplicationStatus.SUBMITTED, index=True)
    reviewed_by_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    feedback: Optional[str] = None  # Internal feedback from reviewer

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    job: OrderJob = Relationship(back_populates="applications")

    class Config:
        # One application per user per job
        table_args = {
            "unique_constraints": [("user_id", "job_id")]
        }


class OrderBookingRequest(SQLModel, table=True):
    """
    External booking request for an Order member's services.
    Can be submitted by anyone (even non-members).
    """
    __tablename__ = "order_booking_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    target_user_id: str = Field(index=True)  # The Order member being requested

    # Requester info (may not be a platform user)
    requester_user_id: Optional[str] = None  # If logged in
    requester_name: str = Field(max_length=200)
    requester_email: str = Field(max_length=255)
    requester_phone: Optional[str] = Field(default=None, max_length=50)
    requester_org: Optional[str] = Field(default=None, max_length=200)

    # Request details
    project_title: Optional[str] = Field(default=None, max_length=200)
    details: str
    location: Optional[str] = Field(default=None, max_length=200)
    dates: Optional[str] = Field(default=None, max_length=200)  # Flexible date description
    budget_range: Optional[str] = Field(default=None, max_length=100)
    roles_needed: Optional[str] = None  # JSON array of tracks needed

    # Status
    status: str = Field(default="pending", max_length=50, index=True)  # pending, contacted, accepted, declined
    response_notes: Optional[str] = None  # Notes from the Order member

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
