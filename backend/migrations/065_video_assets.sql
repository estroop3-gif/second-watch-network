-- Migration: 065_video_assets.sql
-- Description: Video Assets with Multi-Resolution Renditions and HLS
-- Part of: Consumer Streaming Platform
-- Key convention: /asset/{assetId}/version/{versionId}/

-- =============================================================================
-- VIDEO ASSETS - Master file tracking with versioning
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    world_id UUID REFERENCES worlds(id) ON DELETE SET NULL, -- Optional world association

    -- Version tracking (immutable outputs)
    version_id UUID DEFAULT gen_random_uuid(),
    is_current_version BOOLEAN DEFAULT TRUE,
    previous_version_id UUID REFERENCES video_assets(id) ON DELETE SET NULL,

    -- Source/Master File
    master_bucket TEXT NOT NULL DEFAULT 'swn-raw-ingest',
    master_file_key TEXT NOT NULL, -- S3 key: /asset/{assetId}/version/{versionId}/raw/{filename}
    master_file_size_bytes BIGINT,
    master_checksum TEXT, -- MD5 or SHA256 for verification
    original_filename TEXT,

    -- Technical Metadata (extracted from master via ffprobe)
    duration_seconds NUMERIC(10,3),
    frame_rate NUMERIC(6,3),
    resolution_width INTEGER,
    resolution_height INTEGER,
    aspect_ratio TEXT, -- '16:9', '9:16', '4:3', '21:9'
    codec TEXT,
    audio_channels INTEGER,
    audio_codec TEXT,
    bitrate_kbps INTEGER,

    -- Processing Status
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'validating', 'transcoding', 'packaging', 'qc', 'completed', 'failed', 'cancelled'
    )),
    processing_progress INTEGER DEFAULT 0, -- 0-100
    processing_error TEXT,
    processing_job_id TEXT, -- Step Functions execution ID
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,

    -- Validation Results
    validation_passed BOOLEAN,
    validation_errors JSONB DEFAULT '[]', -- Array of validation error messages
    loudness_lufs NUMERIC(5,2), -- Measured loudness

    -- Metadata
    title TEXT,
    description TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_video_assets_owner ON video_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_world ON video_assets(world_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_processing ON video_assets(processing_status);
CREATE INDEX IF NOT EXISTS idx_video_assets_current ON video_assets(id, is_current_version) WHERE is_current_version = TRUE;
CREATE INDEX IF NOT EXISTS idx_video_assets_created ON video_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_assets_job ON video_assets(processing_job_id);

-- =============================================================================
-- VIDEO RENDITIONS - Transcoded versions for adaptive streaming
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_renditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Quality Profile
    quality_label TEXT NOT NULL, -- '2160p', '1080p', '720p', '480p', '360p', 'audio_only'
    resolution_width INTEGER,
    resolution_height INTEGER,
    bitrate_kbps INTEGER,
    frame_rate NUMERIC(6,3),

    -- Storage (publish bucket)
    file_bucket TEXT NOT NULL DEFAULT 'swn-publish',
    file_key TEXT NOT NULL, -- /asset/{assetId}/version/{versionId}/hls/{quality}/
    file_size_bytes BIGINT,

    -- Codec/Format
    video_codec TEXT, -- 'h264', 'h265', 'vp9', 'av1'
    audio_codec TEXT, -- 'aac', 'opus'
    container TEXT NOT NULL DEFAULT 'ts', -- 'ts', 'mp4', 'fmp4'

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    error_message TEXT,

    -- Segment info (for HLS)
    segment_duration_seconds INTEGER DEFAULT 6,
    segment_count INTEGER,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(video_asset_id, quality_label, video_codec)
);

CREATE INDEX IF NOT EXISTS idx_video_renditions_asset ON video_renditions(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_renditions_quality ON video_renditions(quality_label);
CREATE INDEX IF NOT EXISTS idx_video_renditions_status ON video_renditions(status) WHERE status = 'ready';

-- =============================================================================
-- HLS MANIFESTS - Adaptive bitrate streaming manifests
-- =============================================================================
CREATE TABLE IF NOT EXISTS hls_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Manifest Storage
    manifest_bucket TEXT NOT NULL DEFAULT 'swn-publish',
    master_manifest_key TEXT NOT NULL, -- /asset/{assetId}/version/{versionId}/hls/master.m3u8

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),

    -- CDN URL (CloudFront)
    cdn_base_url TEXT, -- https://d123.cloudfront.net/asset/{assetId}/version/{versionId}/hls/
    playback_url TEXT, -- Full URL to master.m3u8 (without signature)

    -- Renditions included (for quick reference)
    included_qualities TEXT[] DEFAULT '{}', -- ['2160p', '1080p', '720p', '480p']

    -- DRM (if enabled)
    drm_enabled BOOLEAN DEFAULT FALSE,
    drm_key_id TEXT,
    drm_type TEXT, -- 'widevine', 'fairplay', 'playready', 'clear'

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hls_manifests_asset ON hls_manifests(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_hls_manifests_status ON hls_manifests(status) WHERE status = 'ready';

-- =============================================================================
-- VIDEO THUMBNAILS - Generated preview images
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_thumbnails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Thumbnail Info
    timecode_seconds NUMERIC(10,3) NOT NULL, -- Position in video
    thumbnail_bucket TEXT NOT NULL DEFAULT 'swn-publish',
    thumbnail_key TEXT NOT NULL, -- /asset/{assetId}/version/{versionId}/art/thumbs/thumb_{index}.jpg
    image_url TEXT, -- CDN URL

    -- Dimensions
    width INTEGER,
    height INTEGER,

    -- Selection
    is_primary BOOLEAN DEFAULT FALSE, -- Used as main thumbnail
    is_auto_generated BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_thumbnails_asset ON video_thumbnails(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_thumbnails_primary ON video_thumbnails(video_asset_id, is_primary) WHERE is_primary = TRUE;

-- =============================================================================
-- THUMBNAIL SPRITE SHEETS - For video scrubbing
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_sprite_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Sprite info
    sprite_bucket TEXT NOT NULL DEFAULT 'swn-publish',
    sprite_key TEXT NOT NULL, -- /asset/{assetId}/version/{versionId}/art/sprite.jpg
    sprite_url TEXT, -- CDN URL
    vtt_key TEXT, -- WebVTT file for sprite timing
    vtt_url TEXT,

    -- Sprite grid
    columns INTEGER NOT NULL, -- Number of columns in sprite
    rows INTEGER NOT NULL, -- Number of rows
    thumbnail_width INTEGER, -- Individual thumb width
    thumbnail_height INTEGER, -- Individual thumb height
    interval_seconds INTEGER NOT NULL DEFAULT 10, -- Seconds between thumbs

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_sprite_sheets_asset ON video_sprite_sheets(video_asset_id);

-- =============================================================================
-- SUBTITLES/CAPTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_subtitles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Language
    language_code TEXT NOT NULL, -- 'en', 'es', 'fr', 'en-US'
    language_name TEXT NOT NULL, -- 'English', 'Spanish', 'French'

    -- Type
    subtitle_type TEXT NOT NULL DEFAULT 'subtitles' CHECK (subtitle_type IN ('subtitles', 'captions', 'sdh', 'forced')),

    -- Storage
    subtitle_bucket TEXT NOT NULL DEFAULT 'swn-publish',
    subtitle_key TEXT NOT NULL, -- /asset/{assetId}/version/{versionId}/captions/{lang}.vtt
    subtitle_url TEXT, -- CDN URL
    format TEXT NOT NULL DEFAULT 'vtt', -- 'vtt', 'srt', 'ttml'

    -- Flags
    is_default BOOLEAN DEFAULT FALSE,
    is_auto_generated BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(video_asset_id, language_code, subtitle_type)
);

CREATE INDEX IF NOT EXISTS idx_video_subtitles_asset ON video_subtitles(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_subtitles_default ON video_subtitles(video_asset_id, is_default) WHERE is_default = TRUE;

-- =============================================================================
-- ADD FK FROM EPISODES TO VIDEO_ASSETS
-- =============================================================================
ALTER TABLE episodes
    ADD CONSTRAINT fk_episodes_video_asset
    FOREIGN KEY (video_asset_id) REFERENCES video_assets(id) ON DELETE SET NULL;

-- =============================================================================
-- ADD FK FROM WORLDS TO VIDEO_ASSETS (for trailer)
-- =============================================================================
ALTER TABLE worlds
    ADD COLUMN IF NOT EXISTS trailer_video_id UUID REFERENCES video_assets(id) ON DELETE SET NULL;

-- =============================================================================
-- UPLOAD SESSIONS - Track multipart uploads
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Uploader
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Upload details
    original_filename TEXT NOT NULL,
    content_type TEXT,
    file_size_bytes BIGINT NOT NULL,

    -- S3 multipart upload
    upload_id TEXT, -- S3 multipart upload ID
    bucket TEXT NOT NULL DEFAULT 'swn-raw-ingest',
    key TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
        'initiated', 'uploading', 'completing', 'completed', 'failed', 'cancelled', 'expired'
    )),

    -- Parts tracking
    parts_expected INTEGER,
    parts_uploaded INTEGER DEFAULT 0,
    parts_info JSONB DEFAULT '[]', -- Array of {partNumber, etag, size}

    -- Checksums
    expected_checksum TEXT,
    actual_checksum TEXT,

    -- Timing
    expires_at TIMESTAMPTZ NOT NULL, -- Presigned URL expiry
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON video_upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_asset ON video_upload_sessions(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON video_upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON video_upload_sessions(expires_at) WHERE status IN ('initiated', 'uploading');

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_video_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS video_assets_updated_at ON video_assets;
CREATE TRIGGER video_assets_updated_at
    BEFORE UPDATE ON video_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_video_assets_updated_at();

DROP TRIGGER IF EXISTS hls_manifests_updated_at ON hls_manifests;
CREATE TRIGGER hls_manifests_updated_at
    BEFORE UPDATE ON hls_manifests
    FOR EACH ROW
    EXECUTE FUNCTION update_video_assets_updated_at();

DROP TRIGGER IF EXISTS upload_sessions_updated_at ON video_upload_sessions;
CREATE TRIGGER upload_sessions_updated_at
    BEFORE UPDATE ON video_upload_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_video_assets_updated_at();
