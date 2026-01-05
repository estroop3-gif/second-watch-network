-- Migration: 071_consumer_transcode_jobs.sql
-- Description: Consumer Video Transcoding Job Queue for HLS Processing
-- Part of: Consumer Streaming Platform - Video Pipeline

-- =============================================================================
-- CONSUMER TRANSCODE JOBS - Queue for HLS transcoding
-- =============================================================================
CREATE TABLE IF NOT EXISTS consumer_transcode_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Asset reference
    asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,

    -- Source file
    source_bucket TEXT NOT NULL,
    source_key TEXT NOT NULL,

    -- Target configuration
    target_qualities JSONB NOT NULL DEFAULT '["1080p", "720p", "480p", "360p"]',
    segment_duration INTEGER DEFAULT 6,

    -- Priority (higher = more urgent)
    priority INTEGER DEFAULT 0,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    stage TEXT, -- 'downloading', 'transcoding', 'uploading', 'finalizing'
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Worker assignment
    worker_id TEXT,
    attempts INTEGER DEFAULT 0,

    -- Output info (set on completion)
    output_info JSONB, -- {version_id, manifest_key, qualities, files_count}

    -- Error handling
    error_message TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consumer_transcode_jobs_asset ON consumer_transcode_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_consumer_transcode_jobs_status ON consumer_transcode_jobs(status);
CREATE INDEX IF NOT EXISTS idx_consumer_transcode_jobs_pending ON consumer_transcode_jobs(priority DESC, created_at ASC)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_consumer_transcode_jobs_processing ON consumer_transcode_jobs(worker_id)
    WHERE status = 'processing';

-- =============================================================================
-- ADD HLS MANIFEST URL TO VIDEO_ASSETS (if not exists)
-- =============================================================================
ALTER TABLE video_assets
    ADD COLUMN IF NOT EXISTS hls_manifest_url TEXT;

-- =============================================================================
-- UPDATE VIDEO_RENDITIONS for worker compatibility
-- =============================================================================
ALTER TABLE video_renditions
    ADD COLUMN IF NOT EXISTS version_id TEXT,
    ADD COLUMN IF NOT EXISTS quality TEXT,
    ADD COLUMN IF NOT EXISTS manifest_key TEXT;

-- Create unique constraint for worker upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_renditions_upsert
    ON video_renditions(video_asset_id, COALESCE(version_id, ''), COALESCE(quality, quality_label));

-- =============================================================================
-- PLAYBACK SESSIONS - Track active viewing for analytics and entitlements
-- =============================================================================
CREATE TABLE IF NOT EXISTS playback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who is watching
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for anonymous

    -- What they're watching
    asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,

    -- Session info
    session_token TEXT UNIQUE NOT NULL, -- For signed cookie validation

    -- Device/Client
    client_ip TEXT,
    user_agent TEXT,
    device_type TEXT, -- 'web', 'ios', 'android', 'tv'

    -- CDN access
    signed_cookies_issued_at TIMESTAMPTZ,
    cookies_expire_at TIMESTAMPTZ,

    -- Playback state
    current_position_seconds NUMERIC(10,3) DEFAULT 0,
    last_heartbeat_at TIMESTAMPTZ,

    -- Quality tracking (for analytics)
    initial_quality TEXT,
    current_quality TEXT,
    quality_switches INTEGER DEFAULT 0,
    rebuffer_count INTEGER DEFAULT 0,

    -- Session lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_user ON playback_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_asset ON playback_sessions(asset_id);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_active ON playback_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_playback_sessions_token ON playback_sessions(session_token);

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================
CREATE OR REPLACE FUNCTION update_consumer_transcode_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consumer_transcode_jobs_updated_at ON consumer_transcode_jobs;
CREATE TRIGGER consumer_transcode_jobs_updated_at
    BEFORE UPDATE ON consumer_transcode_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_consumer_transcode_jobs_updated_at();
