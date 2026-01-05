-- Migration: 075_media_job_orchestration.sql
-- Description: Unified Media Job Orchestration System
-- Purpose: Centralized job tracking for all media processing (FFmpeg, thumbnails, etc.)

-- =============================================================================
-- MEDIA JOBS - Central job tracking table
-- =============================================================================
-- This table provides a unified view of all media processing jobs,
-- regardless of whether they're for Backlot dailies, World episodes, or Shorts.

CREATE TABLE IF NOT EXISTS media_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job Classification
    job_type TEXT NOT NULL CHECK (job_type IN (
        'transcode_hls',          -- Full HLS transcoding (multi-quality)
        'generate_proxy',         -- Low-res editing proxy for Backlot
        'generate_thumbnail',     -- Extract thumbnail from video
        'generate_waveform',      -- Audio waveform for editor
        'extract_audio',          -- Extract audio track
        'concat_videos',          -- Concatenate multiple clips
        'transcode_short'         -- Short-form vertical video
    )),

    -- Source content (what triggered this job)
    source_type TEXT NOT NULL CHECK (source_type IN (
        'episode',                -- World episode
        'short',                  -- Short-form video
        'daily',                  -- Backlot daily clip
        'asset'                   -- Generic asset
    )),
    source_id UUID NOT NULL,      -- ID of the source record

    -- S3 Source Location
    source_bucket TEXT NOT NULL,
    source_key TEXT NOT NULL,

    -- S3 Output Location (filled in by job config or on completion)
    output_bucket TEXT,
    output_key_prefix TEXT,       -- Base path for outputs

    -- Job Configuration (JSON for flexibility)
    config JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- transcode_hls: {"qualities": ["1080p", "720p", "480p"], "segment_duration": 6}
    -- generate_thumbnail: {"timestamp_seconds": 5, "width": 640}
    -- generate_proxy: {"width": 960, "crf": 28}

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued',                 -- Waiting in SQS
        'processing',             -- Worker picked it up
        'completed',              -- Successfully finished
        'failed',                 -- Error occurred
        'cancelled',              -- Manually cancelled
        'retrying'                -- Failed, trying again
    )),

    -- Processing details
    stage TEXT,                   -- Current stage: 'downloading', 'transcoding', 'uploading'
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Worker assignment
    worker_id TEXT,               -- Lambda request ID or ECS task ID
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Priority (higher = more urgent)
    priority INTEGER DEFAULT 0,

    -- Output metadata (set on completion)
    output_metadata JSONB,
    -- Examples:
    -- transcode_hls: {"manifest_url": "...", "qualities": [...], "duration_seconds": 123.45}
    -- generate_thumbnail: {"url": "...", "width": 640, "height": 360}

    -- Error tracking
    error_code TEXT,              -- Structured error code
    error_message TEXT,           -- Human-readable error

    -- Callback configuration (for notification on completion)
    callback_url TEXT,            -- Optional webhook URL
    callback_payload JSONB,       -- Data to include in callback

    -- Requestor tracking
    requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- For retry logic
    last_error_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_jobs_source ON media_jobs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_pending ON media_jobs(priority DESC, created_at ASC)
    WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_media_jobs_processing ON media_jobs(worker_id)
    WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_media_jobs_retrying ON media_jobs(next_retry_at)
    WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_media_jobs_user ON media_jobs(requested_by)
    WHERE requested_by IS NOT NULL;

-- =============================================================================
-- JOB HISTORY/LOGS - Detailed event log for debugging
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,

    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'created',
        'queued',
        'started',
        'progress',
        'stage_changed',
        'completed',
        'failed',
        'retrying',
        'cancelled'
    )),
    event_data JSONB,             -- Event-specific data

    -- Worker info
    worker_id TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_job_events_job ON media_job_events(job_id, created_at);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update updated_at on media_jobs changes
CREATE OR REPLACE FUNCTION update_media_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS media_jobs_updated_at ON media_jobs;
CREATE TRIGGER media_jobs_updated_at
    BEFORE UPDATE ON media_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_media_jobs_updated_at();

-- Auto-log job events on status change
CREATE OR REPLACE FUNCTION log_media_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO media_job_events (job_id, event_type, event_data, worker_id)
        VALUES (
            NEW.id,
            CASE
                WHEN NEW.status = 'queued' THEN 'queued'
                WHEN NEW.status = 'processing' THEN 'started'
                WHEN NEW.status = 'completed' THEN 'completed'
                WHEN NEW.status = 'failed' THEN 'failed'
                WHEN NEW.status = 'retrying' THEN 'retrying'
                WHEN NEW.status = 'cancelled' THEN 'cancelled'
                ELSE 'stage_changed'
            END,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'progress', NEW.progress,
                'stage', NEW.stage
            ),
            NEW.worker_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS media_jobs_status_change ON media_jobs;
CREATE TRIGGER media_jobs_status_change
    AFTER UPDATE ON media_jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_media_job_status_change();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get next job to process (called by workers)
CREATE OR REPLACE FUNCTION claim_next_media_job(
    p_worker_id TEXT,
    p_job_types TEXT[] DEFAULT NULL
)
RETURNS media_jobs AS $$
DECLARE
    v_job media_jobs;
BEGIN
    -- Select and lock the highest priority queued job
    SELECT * INTO v_job
    FROM media_jobs
    WHERE status = 'queued'
      AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF v_job.id IS NOT NULL THEN
        -- Claim the job
        UPDATE media_jobs
        SET status = 'processing',
            worker_id = p_worker_id,
            started_at = NOW(),
            attempts = attempts + 1
        WHERE id = v_job.id;

        -- Return the updated job
        SELECT * INTO v_job FROM media_jobs WHERE id = v_job.id;
    END IF;

    RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a job
CREATE OR REPLACE FUNCTION complete_media_job(
    p_job_id UUID,
    p_output_metadata JSONB,
    p_output_bucket TEXT DEFAULT NULL,
    p_output_key_prefix TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE media_jobs
    SET status = 'completed',
        completed_at = NOW(),
        progress = 100,
        output_metadata = p_output_metadata,
        output_bucket = COALESCE(p_output_bucket, output_bucket),
        output_key_prefix = COALESCE(p_output_key_prefix, output_key_prefix)
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to fail a job with retry logic
CREATE OR REPLACE FUNCTION fail_media_job(
    p_job_id UUID,
    p_error_code TEXT,
    p_error_message TEXT
)
RETURNS VOID AS $$
DECLARE
    v_job media_jobs;
BEGIN
    SELECT * INTO v_job FROM media_jobs WHERE id = p_job_id;

    IF v_job.attempts < v_job.max_attempts THEN
        -- Schedule retry with exponential backoff
        UPDATE media_jobs
        SET status = 'retrying',
            error_code = p_error_code,
            error_message = p_error_message,
            last_error_at = NOW(),
            next_retry_at = NOW() + (INTERVAL '1 minute' * POWER(2, v_job.attempts - 1)),
            worker_id = NULL
        WHERE id = p_job_id;
    ELSE
        -- Max retries exceeded
        UPDATE media_jobs
        SET status = 'failed',
            error_code = p_error_code,
            error_message = p_error_message,
            last_error_at = NOW()
        WHERE id = p_job_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active jobs by source
-- Note: This view only joins tables that exist. Add shorts join when shorts table is created.
CREATE OR REPLACE VIEW v_active_media_jobs AS
SELECT
    mj.*,
    CASE
        WHEN mj.source_type = 'episode' THEN e.title
        WHEN mj.source_type = 'daily' THEN 'Daily Clip'
        ELSE 'Asset'
    END as source_title,
    CASE
        WHEN mj.source_type = 'episode' THEN w.title
        ELSE NULL
    END as world_title
FROM media_jobs mj
LEFT JOIN episodes e ON mj.source_type = 'episode' AND mj.source_id = e.id
LEFT JOIN worlds w ON e.world_id = w.id
WHERE mj.status IN ('queued', 'processing', 'retrying');

-- Job stats for monitoring
CREATE OR REPLACE VIEW v_media_job_stats AS
SELECT
    job_type,
    status,
    COUNT(*) as job_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
    MAX(created_at) as last_created
FROM media_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type, status;

-- =============================================================================
-- RLS POLICIES (Disabled for RDS - access control handled at API layer)
-- =============================================================================
-- Note: These tables use API-level access control rather than RLS
-- since we're on RDS instead of Supabase. The backend service
-- handles permission checks via the permissions.py module.

-- If migrating to Supabase in the future, enable RLS with:
-- ALTER TABLE media_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE media_job_events ENABLE ROW LEVEL SECURITY;
-- And add policies using auth.uid() and auth.role()
