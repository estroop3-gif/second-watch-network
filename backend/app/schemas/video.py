"""
Video Pipeline Schemas - Consumer Streaming Platform
Handles video upload, transcoding, and playback
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class ProcessingStatus(str, Enum):
    pending = "pending"
    validating = "validating"
    transcoding = "transcoding"
    packaging = "packaging"
    qc = "qc"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class RenditionStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class QualityLabel(str, Enum):
    q2160p = "2160p"
    q1080p = "1080p"
    q720p = "720p"
    q480p = "480p"
    q360p = "360p"
    audio_only = "audio_only"


class UploadSessionStatus(str, Enum):
    initiated = "initiated"
    uploading = "uploading"
    completing = "completing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
    expired = "expired"


class SubtitleType(str, Enum):
    subtitles = "subtitles"
    captions = "captions"
    sdh = "sdh"
    forced = "forced"


# =============================================================================
# Upload Schemas
# =============================================================================

class UploadInitiateRequest(BaseModel):
    """Request to start a new video upload"""
    filename: str
    file_size_bytes: int
    content_type: Optional[str] = "video/mp4"
    world_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


class UploadPartInfo(BaseModel):
    """Info about a completed upload part"""
    part_number: int
    etag: str
    size: int


class UploadPartUrl(BaseModel):
    """Presigned URL for uploading a part"""
    part_number: int
    upload_url: str
    expires_at: datetime


class UploadInitiateResponse(BaseModel):
    """Response with upload session details"""
    session_id: str
    video_asset_id: str
    upload_id: str
    bucket: str
    key: str
    part_urls: List[UploadPartUrl]
    expires_at: datetime


class UploadCompleteRequest(BaseModel):
    """Request to complete a multipart upload"""
    session_id: str
    parts: List[UploadPartInfo]


class UploadAbortRequest(BaseModel):
    """Request to abort an upload"""
    session_id: str


class UploadStatusResponse(BaseModel):
    """Upload session status"""
    session_id: str
    video_asset_id: Optional[str] = None
    status: UploadSessionStatus
    parts_expected: Optional[int] = None
    parts_uploaded: int = 0
    created_at: datetime
    expires_at: datetime


# =============================================================================
# Video Asset Schemas
# =============================================================================

class VideoAssetBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class VideoAssetCreate(VideoAssetBase):
    world_id: Optional[str] = None


class VideoAssetUpdate(VideoAssetBase):
    pass


class VideoRendition(BaseModel):
    """A transcoded rendition of a video"""
    id: str
    quality_label: str
    resolution_width: Optional[int] = None
    resolution_height: Optional[int] = None
    bitrate_kbps: Optional[int] = None
    video_codec: Optional[str] = None
    status: RenditionStatus

    class Config:
        from_attributes = True


class HLSManifest(BaseModel):
    """HLS streaming manifest info"""
    id: str
    status: str
    playback_url: Optional[str] = None
    cdn_base_url: Optional[str] = None
    included_qualities: List[str] = []
    drm_enabled: bool = False

    class Config:
        from_attributes = True


class VideoThumbnail(BaseModel):
    """Video thumbnail"""
    id: str
    timecode_seconds: float
    image_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    is_primary: bool = False

    class Config:
        from_attributes = True


class VideoSubtitle(BaseModel):
    """Subtitle/caption track"""
    id: str
    language_code: str
    language_name: str
    subtitle_type: SubtitleType
    subtitle_url: Optional[str] = None
    is_default: bool = False
    is_auto_generated: bool = False

    class Config:
        from_attributes = True


class VideoSpriteSheet(BaseModel):
    """Sprite sheet for video scrubbing"""
    id: str
    sprite_url: Optional[str] = None
    vtt_url: Optional[str] = None
    columns: int
    rows: int
    thumbnail_width: Optional[int] = None
    thumbnail_height: Optional[int] = None
    interval_seconds: int

    class Config:
        from_attributes = True


class VideoAsset(VideoAssetBase):
    """Full video asset with all metadata"""
    id: str
    owner_id: str
    world_id: Optional[str] = None
    version_id: str
    is_current_version: bool = True

    # Master file info
    original_filename: Optional[str] = None
    master_file_size_bytes: Optional[int] = None

    # Technical metadata
    duration_seconds: Optional[float] = None
    frame_rate: Optional[float] = None
    resolution_width: Optional[int] = None
    resolution_height: Optional[int] = None
    aspect_ratio: Optional[str] = None
    codec: Optional[str] = None
    audio_channels: Optional[int] = None
    bitrate_kbps: Optional[int] = None

    # Processing status
    processing_status: ProcessingStatus = ProcessingStatus.pending
    processing_progress: int = 0
    processing_error: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None

    # Validation
    validation_passed: Optional[bool] = None
    validation_errors: List[str] = []
    loudness_lufs: Optional[float] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Enriched data (optional)
    renditions: Optional[List[VideoRendition]] = None
    manifest: Optional[HLSManifest] = None
    thumbnails: Optional[List[VideoThumbnail]] = None
    subtitles: Optional[List[VideoSubtitle]] = None
    sprite_sheet: Optional[VideoSpriteSheet] = None

    class Config:
        from_attributes = True


class VideoAssetSummary(BaseModel):
    """Minimal video asset info for lists"""
    id: str
    title: Optional[str] = None
    duration_seconds: Optional[float] = None
    resolution_width: Optional[int] = None
    resolution_height: Optional[int] = None
    processing_status: ProcessingStatus
    processing_progress: int = 0
    thumbnail_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Playback Schemas
# =============================================================================

class PlaybackSessionRequest(BaseModel):
    """Request a playback session for a video"""
    video_asset_id: str
    device_type: Optional[str] = None  # 'web', 'ios', 'android', 'tv'


class PlaybackSession(BaseModel):
    """Playback session with signed URLs"""
    session_id: str
    video_asset_id: str

    # HLS playback
    playback_url: str  # Master manifest URL with auth
    cdn_base_url: str

    # Available qualities
    available_qualities: List[str]

    # Subtitles
    subtitles: List[VideoSubtitle] = []

    # Scrubbing
    sprite_sheet: Optional[VideoSpriteSheet] = None

    # Session info
    expires_at: datetime

    # Watch progress (if any)
    resume_position_seconds: Optional[float] = None


class WatchProgressUpdate(BaseModel):
    """Update watch progress"""
    position_seconds: float
    duration_seconds: Optional[float] = None
    device_type: Optional[str] = None


# =============================================================================
# Transcoding Schemas
# =============================================================================

class TranscodeRequest(BaseModel):
    """Request to start transcoding"""
    video_asset_id: str
    quality_presets: Optional[List[QualityLabel]] = None  # If None, use defaults
    generate_thumbnails: bool = True
    generate_sprite_sheet: bool = True
    priority: Optional[str] = "normal"  # 'low', 'normal', 'high'


class TranscodeStatus(BaseModel):
    """Transcoding job status"""
    video_asset_id: str
    job_id: Optional[str] = None
    status: ProcessingStatus
    progress: int = 0
    current_stage: Optional[str] = None  # 'validating', 'transcoding', 'packaging'
    error_message: Optional[str] = None
    renditions: List[VideoRendition] = []
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# =============================================================================
# Subtitle Schemas
# =============================================================================

class SubtitleUploadRequest(BaseModel):
    """Request to upload subtitles"""
    video_asset_id: str
    language_code: str
    language_name: str
    subtitle_type: SubtitleType = SubtitleType.subtitles
    is_default: bool = False


class SubtitleUploadResponse(BaseModel):
    """Response with upload URL for subtitle file"""
    subtitle_id: str
    upload_url: str
    expires_at: datetime


# =============================================================================
# Thumbnail Schemas
# =============================================================================

class ThumbnailGenerateRequest(BaseModel):
    """Request to generate thumbnails at specific times"""
    video_asset_id: str
    timecodes_seconds: List[float]


class ThumbnailSetPrimaryRequest(BaseModel):
    """Set a thumbnail as primary"""
    thumbnail_id: str


# =============================================================================
# Video List/Search Schemas
# =============================================================================

class VideoListParams(BaseModel):
    """Parameters for listing videos"""
    world_id: Optional[str] = None
    status: Optional[ProcessingStatus] = None
    limit: int = Field(default=20, le=100)
    offset: int = 0


class VideoListResponse(BaseModel):
    """Paginated video list"""
    videos: List[VideoAssetSummary]
    total: int
    limit: int
    offset: int
