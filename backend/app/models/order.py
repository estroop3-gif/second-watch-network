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
    ART_DEPARTMENT = "art_department"
    WARDROBE = "wardrobe"
    MAKEUP_HAIR = "makeup_hair"
    OTHER = "other"


class MembershipTier(str, Enum):
    """Order membership tier levels"""
    BASE = "base"          # $50/month
    STEWARD = "steward"    # $100/month
    PATRON = "patron"      # $250+/month


class CraftHouseStatus(str, Enum):
    """Craft House status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    FORMING = "forming"


class CraftHouseRole(str, Enum):
    """Rank within a Craft House (unified ladder)"""
    APPRENTICE = "apprentice"  # Entry level / PA equivalent
    ASSOCIATE = "associate"    # Developing craftsperson
    MEMBER = "member"          # Full member status
    STEWARD = "steward"        # Leadership role (guides training, standards)


class FellowshipType(str, Enum):
    """Type of Fellowship"""
    ENTRY_LEVEL = "entry_level"
    FAITH_BASED = "faith_based"
    SPECIAL_INTEREST = "special_interest"
    REGIONAL = "regional"


class FellowshipRole(str, Enum):
    """Role within a Fellowship"""
    MEMBER = "member"
    LEADER = "leader"
    COORDINATOR = "coordinator"


class GovernancePositionType(str, Enum):
    """Types of governance positions"""
    HIGH_COUNCIL = "high_council"
    GRAND_MASTER = "grand_master"
    LODGE_MASTER = "lodge_master"
    LODGE_COUNCIL = "lodge_council"
    CRAFT_MASTER = "craft_master"
    CRAFT_DEPUTY = "craft_deputy"
    FELLOWSHIP_LEADER = "fellowship_leader"
    REGIONAL_DIRECTOR = "regional_director"


class GovernanceScopeType(str, Enum):
    """Scope of a governance position"""
    ORDER = "order"
    LODGE = "lodge"
    CRAFT_HOUSE = "craft_house"
    FELLOWSHIP = "fellowship"
    REGION = "region"


class DuesPaymentStatus(str, Enum):
    """Dues payment status"""
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


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

    # Membership tier
    membership_tier: MembershipTier = Field(default=MembershipTier.BASE, index=True)
    tier_started_at: Optional[datetime] = None

    # Stripe subscription tracking
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_price_id: Optional[str] = Field(default=None, max_length=100)  # Current subscription price
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
    applicant_role: Optional[str] = Field(default=None, max_length=200)  # Current job title/role

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


# ============ Craft House Models ============

class CraftHouse(SQLModel, table=True):
    """
    Craft House represents a department-based professional group.
    Members are grouped by their primary craft (Camera, Post, Audio, etc.)
    """
    __tablename__ = "order_craft_houses"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=200, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    description: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=50)  # Lucide icon name
    primary_tracks: Optional[str] = None  # JSON array of PrimaryTrack values
    status: CraftHouseStatus = Field(default=CraftHouseStatus.ACTIVE, index=True)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    memberships: List["CraftHouseMembership"] = Relationship(back_populates="craft_house")


class CraftHouseMembership(SQLModel, table=True):
    """
    Tracks a user's membership in a Craft House.
    Members can belong to multiple Craft Houses but have one primary.
    """
    __tablename__ = "order_craft_house_memberships"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to auth.users
    craft_house_id: int = Field(foreign_key="order_craft_houses.id", index=True)

    # Membership details
    role: CraftHouseRole = Field(default=CraftHouseRole.MEMBER, index=True)
    joined_at: datetime = Field(default_factory=datetime.utcnow)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    craft_house: CraftHouse = Relationship(back_populates="memberships")

    class Config:
        table_args = {
            "unique_constraints": [("user_id", "craft_house_id")]
        }


# ============ Fellowship Models ============

class Fellowship(SQLModel, table=True):
    """
    Fellowship is a cross-craft special interest group.
    Examples: First Watch (entry-level), Kingdom Builders (faith-based)
    """
    __tablename__ = "order_fellowships"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=200, index=True)
    slug: str = Field(max_length=100, unique=True, index=True)
    fellowship_type: FellowshipType = Field(index=True)
    description: Optional[str] = None
    requirements: Optional[str] = None  # Description of membership requirements
    is_opt_in: bool = Field(default=True)  # Whether members choose to join
    is_visible: bool = Field(default=True)  # Whether shown publicly
    status: CraftHouseStatus = Field(default=CraftHouseStatus.ACTIVE, index=True)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    memberships: List["FellowshipMembership"] = Relationship(back_populates="fellowship")


class FellowshipMembership(SQLModel, table=True):
    """
    Tracks a user's membership in a Fellowship.
    Members can belong to multiple Fellowships.
    """
    __tablename__ = "order_fellowship_memberships"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to auth.users
    fellowship_id: int = Field(foreign_key="order_fellowships.id", index=True)

    # Membership details
    role: FellowshipRole = Field(default=FellowshipRole.MEMBER)
    joined_at: datetime = Field(default_factory=datetime.utcnow)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    fellowship: Fellowship = Relationship(back_populates="memberships")

    class Config:
        table_args = {
            "unique_constraints": [("user_id", "fellowship_id")]
        }


# ============ Governance Models ============

class GovernancePosition(SQLModel, table=True):
    """
    Governance positions track leadership roles within the Order.
    Includes High Council, Lodge Masters, Craft Masters, etc.
    """
    __tablename__ = "order_governance_positions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to auth.users

    # Position details
    position_type: GovernancePositionType = Field(index=True)
    scope_type: Optional[GovernanceScopeType] = None  # order, lodge, craft_house, fellowship
    scope_id: Optional[int] = None  # ID of lodge/craft_house/fellowship if applicable
    title: str = Field(max_length=200)  # Display title
    description: Optional[str] = None  # Role description

    # Term
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None  # NULL if currently active
    is_active: bool = Field(default=True, index=True)
    appointed_by: Optional[str] = None  # User who appointed them

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============ Dues Payment Model ============

class DuesPayment(SQLModel, table=True):
    """
    Tracks membership dues payments history.
    """
    __tablename__ = "order_dues_payments"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # FK to auth.users

    # Payment details
    amount_cents: int
    tier: MembershipTier
    stripe_payment_intent_id: Optional[str] = Field(default=None, max_length=255)
    stripe_invoice_id: Optional[str] = Field(default=None, max_length=255, index=True)
    status: DuesPaymentStatus = Field(default=DuesPaymentStatus.PENDING, index=True)

    # Billing period
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
