"""
World Schemas - Consumer Streaming Platform
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class ContentFormat(str, Enum):
    series = "series"
    film = "film"
    special = "special"
    anthology = "anthology"


class WorldStatus(str, Enum):
    draft = "draft"
    coming_soon = "coming_soon"
    active = "active"
    complete = "complete"
    archived = "archived"


class WorldVisibility(str, Enum):
    public = "public"
    unlisted = "unlisted"
    private = "private"


class MaturityRating(str, Enum):
    G = "G"
    PG = "PG"
    PG_13 = "PG-13"
    R = "R"
    TV_Y = "TV-Y"
    TV_Y7 = "TV-Y7"
    TV_G = "TV-G"
    TV_PG = "TV-PG"
    TV_14 = "TV-14"
    TV_MA = "TV-MA"


# =============================================================================
# Genre Schemas
# =============================================================================

class GenreBase(BaseModel):
    name: str
    slug: str
    category: str = "primary"


class Genre(GenreBase):
    id: str
    is_primary: Optional[bool] = False

    class Config:
        from_attributes = True


# =============================================================================
# World Schemas
# =============================================================================

class WorldBase(BaseModel):
    title: str
    logline: Optional[str] = Field(None, max_length=300)
    synopsis: Optional[str] = None
    content_format: ContentFormat
    maturity_rating: Optional[MaturityRating] = None
    runtime_minutes: Optional[int] = None
    release_year: Optional[int] = None


class WorldCreate(WorldBase):
    submission_id: Optional[str] = None
    genre_ids: Optional[List[str]] = None
    cover_art_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class WorldUpdate(BaseModel):
    title: Optional[str] = None
    logline: Optional[str] = Field(None, max_length=300)
    synopsis: Optional[str] = None
    content_format: Optional[ContentFormat] = None
    maturity_rating: Optional[MaturityRating] = None
    runtime_minutes: Optional[int] = None
    release_year: Optional[int] = None
    visibility: Optional[WorldVisibility] = None
    status: Optional[WorldStatus] = None
    cover_art_url: Optional[str] = None
    cover_art_wide_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    logo_url: Optional[str] = None
    premiere_date: Optional[date] = None
    genre_ids: Optional[List[str]] = None
    external_links: Optional[dict] = None
    settings: Optional[dict] = None


class WorldSummary(BaseModel):
    """Minimal world info for lists and references"""
    id: str
    title: str
    slug: str
    thumbnail_url: Optional[str] = None
    content_format: str
    follower_count: int = 0
    episode_count: int = 0
    status: Optional[str] = None
    is_featured: Optional[bool] = False

    class Config:
        from_attributes = True


class World(WorldBase):
    id: str
    slug: str
    creator_id: str
    submission_id: Optional[str] = None
    visibility: WorldVisibility = WorldVisibility.unlisted
    status: WorldStatus = WorldStatus.draft
    cover_art_url: Optional[str] = None
    cover_art_wide_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    logo_url: Optional[str] = None
    trailer_video_id: Optional[str] = None
    announced_at: Optional[datetime] = None
    premiere_date: Optional[date] = None
    last_content_date: Optional[date] = None
    follower_count: int = 0
    total_view_count: int = 0
    episode_count: int = 0
    season_count: int = 0
    external_links: Optional[dict] = None
    settings: Optional[dict] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    # Enriched fields
    genres: Optional[List[Genre]] = None
    creator: Optional[dict] = None
    is_following: Optional[bool] = None
    is_in_watchlist: Optional[bool] = None

    class Config:
        from_attributes = True


class WorldWithSeasons(World):
    """World with full season/episode data"""
    seasons: Optional[List["Season"]] = None


# =============================================================================
# Season Schemas
# =============================================================================

class SeasonStatus(str, Enum):
    unreleased = "unreleased"
    releasing = "releasing"
    complete = "complete"


class SeasonBase(BaseModel):
    season_number: int
    title: Optional[str] = None
    description: Optional[str] = None


class SeasonCreate(SeasonBase):
    world_id: str
    cover_art_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    premiere_date: Optional[date] = None


class SeasonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[SeasonStatus] = None
    cover_art_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    premiere_date: Optional[date] = None
    finale_date: Optional[date] = None
    sort_order: Optional[int] = None


class Season(SeasonBase):
    id: str
    world_id: str
    status: SeasonStatus = SeasonStatus.unreleased
    cover_art_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    premiere_date: Optional[date] = None
    finale_date: Optional[date] = None
    episode_count: int = 0
    total_runtime_minutes: int = 0
    sort_order: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Enriched
    episodes: Optional[List["Episode"]] = None

    class Config:
        from_attributes = True


# =============================================================================
# Episode Schemas
# =============================================================================

class EpisodeStatus(str, Enum):
    draft = "draft"
    processing = "processing"
    qc_pending = "qc_pending"
    qc_approved = "qc_approved"
    qc_rejected = "qc_rejected"
    scheduled = "scheduled"
    published = "published"
    unlisted = "unlisted"
    archived = "archived"


class EpisodeVisibility(str, Enum):
    public = "public"
    unlisted = "unlisted"
    private = "private"
    premium = "premium"


class EpisodeBase(BaseModel):
    episode_number: int
    title: str
    description: Optional[str] = None


class EpisodeCreate(EpisodeBase):
    season_id: str
    world_id: str
    thumbnail_url: Optional[str] = None
    video_asset_id: Optional[str] = None
    scheduled_release: Optional[datetime] = None


class EpisodeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_asset_id: Optional[str] = None
    status: Optional[EpisodeStatus] = None
    visibility: Optional[EpisodeVisibility] = None
    scheduled_release: Optional[datetime] = None
    intro_start_seconds: Optional[int] = None
    intro_end_seconds: Optional[int] = None
    credits_start_seconds: Optional[int] = None
    recap_end_seconds: Optional[int] = None


class Episode(EpisodeBase):
    id: str
    season_id: str
    world_id: str
    video_asset_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    still_images: Optional[List[str]] = None
    duration_seconds: Optional[int] = None
    runtime_display: Optional[str] = None
    status: EpisodeStatus = EpisodeStatus.draft
    visibility: EpisodeVisibility = EpisodeVisibility.private
    qc_status: Optional[str] = None
    qc_notes: Optional[str] = None
    scheduled_release: Optional[datetime] = None
    published_at: Optional[datetime] = None
    intro_start_seconds: Optional[int] = None
    intro_end_seconds: Optional[int] = None
    credits_start_seconds: Optional[int] = None
    recap_end_seconds: Optional[int] = None
    view_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Enriched
    watch_progress: Optional[dict] = None  # {position, completed}

    class Config:
        from_attributes = True


# =============================================================================
# Follow/Watchlist Schemas
# =============================================================================

class WorldFollowCreate(BaseModel):
    world_id: str
    notify_new_episodes: bool = True
    notify_companion_drops: bool = True
    notify_live_events: bool = True
    notify_announcements: bool = True


class WorldFollowUpdate(BaseModel):
    notify_new_episodes: Optional[bool] = None
    notify_companion_drops: Optional[bool] = None
    notify_live_events: Optional[bool] = None
    notify_announcements: Optional[bool] = None
    notify_shorts: Optional[bool] = None
    notifications_enabled: Optional[bool] = None


class WorldFollow(BaseModel):
    id: str
    world_id: str
    user_id: str
    notify_new_episodes: bool = True
    notify_companion_drops: bool = True
    notify_live_events: bool = True
    notify_announcements: bool = True
    notify_shorts: bool = False
    notifications_enabled: bool = True
    followed_at: datetime

    class Config:
        from_attributes = True


class WorldWatchlistItem(BaseModel):
    id: str
    world_id: str
    user_id: str
    notes: Optional[str] = None
    added_at: datetime
    world: Optional[WorldSummary] = None

    class Config:
        from_attributes = True


# =============================================================================
# Watch History Schema
# =============================================================================

class WatchProgressUpdate(BaseModel):
    position_seconds: float
    duration_seconds: Optional[float] = None
    device_type: Optional[str] = None


class WatchHistoryEpisode(BaseModel):
    """Slim episode info returned by continue-watching query"""
    id: str
    title: str
    episode_number: int
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    season_id: Optional[str] = None
    world_id: Optional[str] = None
    created_at: Optional[datetime] = None

class WatchHistoryWorld(BaseModel):
    """Slim world info returned by continue-watching query"""
    id: str
    title: str
    slug: str
    thumbnail_url: Optional[str] = None
    content_format: Optional[str] = None

class WatchHistoryItem(BaseModel):
    id: str
    user_id: str
    episode_id: Optional[str] = None
    world_content_id: Optional[str] = None
    world_id: str
    position_seconds: float
    duration_seconds: Optional[float] = None
    completed: bool = False
    completed_at: Optional[datetime] = None
    device_type: Optional[str] = None
    last_watched_at: datetime
    # Enriched
    episode: Optional[WatchHistoryEpisode] = None
    world: Optional[WatchHistoryWorld] = None

    class Config:
        from_attributes = True


# =============================================================================
# Search/Browse Schemas
# =============================================================================

class WorldSearchParams(BaseModel):
    query: Optional[str] = None
    genre_slug: Optional[str] = None
    content_format: Optional[ContentFormat] = None
    status: Optional[WorldStatus] = None
    limit: int = Field(default=20, le=100)
    offset: int = 0


class WorldSearchResult(BaseModel):
    worlds: List[WorldSummary]
    total: int
    limit: int
    offset: int


# Forward references
WorldWithSeasons.model_rebuild()
Season.model_rebuild()
