"""
Status and Type Enumerations for Second Watch Network

This module provides centralized enum definitions used across the platform.
These enums match database constraints and provide type safety throughout
the codebase.

Usage:
    from app.core.enums import ProjectStatus, MediaStatus, ContentType

    project.status = ProjectStatus.IN_PRODUCTION
    if media.status == MediaStatus.PROCESSING:
        ...
"""
from enum import Enum


# ============================================================================
# Backlot Project Statuses
# ============================================================================

class ProjectStatus(str, Enum):
    """
    Backlot project lifecycle statuses.

    Flow: DEVELOPMENT -> PRE_PRODUCTION -> IN_PRODUCTION -> POST_PRODUCTION -> COMPLETED
    Can be PAUSED at any stage, ARCHIVED when inactive.
    """
    DEVELOPMENT = "development"
    PRE_PRODUCTION = "pre_production"
    IN_PRODUCTION = "in_production"
    POST_PRODUCTION = "post_production"
    COMPLETED = "completed"
    PAUSED = "paused"
    ARCHIVED = "archived"


class ProjectVisibility(str, Enum):
    """Project visibility settings."""
    PRIVATE = "private"       # Only team members
    INVITE_ONLY = "invite_only"  # Specific invites required
    PUBLIC = "public"         # Discoverable by others


class ProjectType(str, Enum):
    """Types of backlot projects."""
    FEATURE = "feature"
    SHORT = "short"
    SERIES = "series"
    DOCUMENTARY = "documentary"
    COMMERCIAL = "commercial"
    MUSIC_VIDEO = "music_video"
    WEB_SERIES = "web_series"
    OTHER = "other"


# ============================================================================
# Media Processing Statuses
# ============================================================================

class MediaStatus(str, Enum):
    """
    Media file processing statuses.

    Flow: PENDING -> PROCESSING -> READY
    Can fail to ERROR at any stage.
    """
    PENDING = "pending"           # Uploaded, awaiting processing
    PROCESSING = "processing"     # Being transcoded/processed
    READY = "ready"               # Processing complete, playable
    ERROR = "error"               # Processing failed
    ARCHIVED = "archived"         # No longer active


class MediaType(str, Enum):
    """Types of media files."""
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"
    DOCUMENT = "document"


class TranscodePreset(str, Enum):
    """FFmpeg transcoding presets for HLS output."""
    HLS_1080P = "hls_1080p"
    HLS_720P = "hls_720p"
    HLS_480P = "hls_480p"
    HLS_AUDIO = "hls_audio"
    THUMBNAIL = "thumbnail"
    PROXY = "proxy"           # Low-res editing proxy


# ============================================================================
# Worlds (Consumer Platform) Statuses
# ============================================================================

class WorldStatus(str, Enum):
    """Status of a World (creator's channel/show)."""
    DRAFT = "draft"           # Not yet published
    PUBLISHED = "published"   # Live and visible
    PAUSED = "paused"         # Temporarily hidden
    ARCHIVED = "archived"     # No longer active


class WorldVisibility(str, Enum):
    """World visibility settings."""
    PUBLIC = "public"         # Anyone can view
    UNLISTED = "unlisted"     # Only with direct link
    FOLLOWERS_ONLY = "followers_only"  # Must follow to view
    PRIVATE = "private"       # Creator only


class EpisodeStatus(str, Enum):
    """Episode publishing status."""
    DRAFT = "draft"           # Being created
    SCHEDULED = "scheduled"   # Will publish at future date
    PUBLISHED = "published"   # Live
    UNLISTED = "unlisted"     # Available but not listed
    ARCHIVED = "archived"     # Hidden


# ============================================================================
# Shorts Statuses
# ============================================================================

class ShortStatus(str, Enum):
    """Status of a Short video."""
    PROCESSING = "processing"
    PUBLISHED = "published"
    UNLISTED = "unlisted"
    REMOVED = "removed"


# ============================================================================
# Live Events
# ============================================================================

class LiveEventStatus(str, Enum):
    """Live event lifecycle status."""
    SCHEDULED = "scheduled"   # Upcoming
    LIVE = "live"             # Currently broadcasting
    ENDED = "ended"           # Finished
    CANCELLED = "cancelled"   # Not happening


class LiveEventType(str, Enum):
    """Types of live events."""
    PREMIERE = "premiere"
    WATCH_PARTY = "watch_party"
    QA = "qa"
    BEHIND_SCENES = "behind_scenes"
    ANNOUNCEMENT = "announcement"
    LIVE_STREAM = "live_stream"
    TABLE_READ = "table_read"
    COMMENTARY = "commentary"
    OTHER = "other"


# ============================================================================
# Green Room Submissions
# ============================================================================

class SubmissionStatus(str, Enum):
    """Green Room submission status."""
    PENDING = "pending"       # Awaiting review
    IN_REVIEW = "in_review"   # Being evaluated
    APPROVED = "approved"     # Moving forward
    REJECTED = "rejected"     # Not accepted
    WITHDRAWN = "withdrawn"   # Creator pulled back


class VotingCycleStatus(str, Enum):
    """Green Room voting cycle status."""
    UPCOMING = "upcoming"
    ACTIVE = "active"
    VOTING = "voting"
    CLOSED = "closed"


# ============================================================================
# Order (Guild) Statuses
# ============================================================================

class MembershipStatus(str, Enum):
    """Order membership status."""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    ALUMNI = "alumni"


class CraftRank(str, Enum):
    """Craft House progression ranks."""
    APPRENTICE = "apprentice"
    ASSOCIATE = "associate"
    MEMBER = "member"
    STEWARD = "steward"


# ============================================================================
# Backlot Specific
# ============================================================================

class ShootDayStatus(str, Enum):
    """Shoot day status."""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    WRAPPED = "wrapped"
    CANCELLED = "cancelled"


class CallSheetStatus(str, Enum):
    """Call sheet status."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SENT = "sent"
    FINAL = "final"


class InvoiceStatus(str, Enum):
    """Backlot invoice status."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ExpenseStatus(str, Enum):
    """Expense/receipt status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REIMBURSED = "reimbursed"


class CastingStatus(str, Enum):
    """Casting application status."""
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    SHORTLISTED = "shortlisted"
    CALLBACK = "callback"
    CAST = "cast"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ClearanceStatus(str, Enum):
    """Clearance/rights status."""
    PENDING = "pending"
    REQUESTED = "requested"
    APPROVED = "approved"
    DENIED = "denied"
    EXPIRED = "expired"
    NOT_NEEDED = "not_needed"


class TaskStatus(str, Enum):
    """Task/todo status."""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    """Task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# ============================================================================
# Media Job Orchestration
# ============================================================================

class MediaJobStatus(str, Enum):
    """
    Status of a media processing job.

    Flow: QUEUED -> PROCESSING -> COMPLETED
    Can transition to FAILED at any point.
    """
    QUEUED = "queued"         # In SQS, awaiting worker
    PROCESSING = "processing"  # Worker picked it up
    COMPLETED = "completed"    # Successfully finished
    FAILED = "failed"          # Error occurred
    CANCELLED = "cancelled"    # Manually cancelled
    RETRYING = "retrying"      # Failed, trying again


class MediaJobType(str, Enum):
    """Types of media processing jobs."""
    TRANSCODE_HLS = "transcode_hls"
    GENERATE_THUMBNAIL = "generate_thumbnail"
    GENERATE_PROXY = "generate_proxy"
    EXTRACT_AUDIO = "extract_audio"
    CONCAT_VIDEOS = "concat_videos"
    GENERATE_WAVEFORM = "generate_waveform"


# ============================================================================
# User & Profile
# ============================================================================

class UserStatus(str, Enum):
    """User account status."""
    PENDING = "pending"       # Email not verified
    ACTIVE = "active"         # Normal state
    SUSPENDED = "suspended"   # Temporarily disabled
    BANNED = "banned"         # Permanently disabled
    DELETED = "deleted"       # Soft deleted


class OnboardingStep(str, Enum):
    """Onboarding progress steps."""
    CREATED = "created"
    PROFILE_SETUP = "profile_setup"
    INTERESTS = "interests"
    AVATAR = "avatar"
    COMPLETED = "completed"


# ============================================================================
# Notifications
# ============================================================================

class NotificationType(str, Enum):
    """Types of notifications."""
    SYSTEM = "system"
    MESSAGE = "message"
    MENTION = "mention"
    FOLLOW = "follow"
    LIKE = "like"
    COMMENT = "comment"
    PROJECT_INVITE = "project_invite"
    PROJECT_UPDATE = "project_update"
    SUBMISSION = "submission"
    EVENT = "event"
    ORDER = "order"
