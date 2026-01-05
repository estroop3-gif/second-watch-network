-- Migration 086: Distribution Policies and Export Pipeline
-- Phase 5A: Third-party distribution, export jobs, and partner integration scaffolding
--
-- This migration:
-- 1. Adds distribution policy configuration per World
-- 2. Extends media_jobs for export packaging
-- 3. Creates export artifact tracking
-- 4. Adds partner/platform templates

BEGIN;

-- =============================================================================
-- PART 1: Distribution Policy Enums and Types
-- =============================================================================

-- Distribution policy levels
CREATE TYPE distribution_policy AS ENUM (
    'internal_only',           -- Only on Second Watch
    'internal_plus_third_party', -- SWN + approved partners
    'open_export'              -- Creator can export anywhere
);

-- Export status tracking
CREATE TYPE export_status AS ENUM (
    'pending',
    'validating',
    'preparing',
    'encoding',
    'packaging',
    'uploading',
    'completed',
    'failed',
    'cancelled'
);

-- Target platform categories
CREATE TYPE export_platform_type AS ENUM (
    'social_avod',       -- YouTube, Vimeo, etc.
    'fast_channel',      -- FAST/linear syndication
    'venue_theatrical',  -- DCP for theaters
    'venue_event',       -- Event screening packages
    'airline',           -- In-flight entertainment
    'educational',       -- Educational platforms
    'custom'             -- Custom partner
);

-- =============================================================================
-- PART 2: World Distribution Policies
-- =============================================================================

-- Distribution policies per World
CREATE TABLE IF NOT EXISTS world_distribution_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Policy settings
    distribution_policy distribution_policy DEFAULT 'internal_only',

    -- Allowed platforms (JSON list of platform identifiers)
    allowed_platforms JSONB DEFAULT '[]'::jsonb,

    -- Export requirements and restrictions
    export_requirements JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "max_resolution": "1080p",
    --   "watermark_required": true,
    --   "watermark_position": "bottom_right",
    --   "slate_required": true,
    --   "formats_allowed": ["mp4", "mov", "mxf"]
    -- }

    -- Exclusivity windows (respects festival/venue deals)
    exclusivity_overrides JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "youtube": {"blocked_until": "2025-06-01"},
    --   "fast_channel": {"requires_approval": true}
    -- }

    -- Revenue share for third-party (if applicable)
    third_party_revenue_share_pct NUMERIC(5,2) DEFAULT 0,

    -- Approval requirements
    requires_org_approval BOOLEAN DEFAULT false,
    requires_platform_approval BOOLEAN DEFAULT false,

    -- Notes and metadata
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    UNIQUE(world_id)
);

CREATE INDEX IF NOT EXISTS idx_world_distribution_policies_world
    ON world_distribution_policies(world_id);
CREATE INDEX IF NOT EXISTS idx_world_distribution_policies_policy
    ON world_distribution_policies(distribution_policy);

-- =============================================================================
-- PART 3: Export Platform Templates
-- =============================================================================

-- Platform templates define export requirements per target
CREATE TABLE IF NOT EXISTS export_platform_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Platform identification
    platform_key TEXT NOT NULL UNIQUE,  -- e.g., 'youtube', 'fast_plutotv', 'venue_dcp'
    platform_name TEXT NOT NULL,
    platform_type export_platform_type NOT NULL,

    -- Display
    description TEXT,
    icon_url TEXT,

    -- Technical requirements (JSON)
    video_specs JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "codecs": ["h264", "h265"],
    --   "containers": ["mp4", "mov"],
    --   "max_resolution": "4k",
    --   "max_bitrate_mbps": 50,
    --   "color_space": "rec709"
    -- }

    audio_specs JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "codecs": ["aac", "ac3"],
    --   "channels": [2, 6],
    --   "sample_rate": 48000
    -- }

    -- Metadata requirements
    required_metadata JSONB DEFAULT '[]'::jsonb,
    -- Example: ["title", "description", "thumbnail", "captions"]

    -- Delivery specs
    delivery_specs JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "package_format": "single_file" | "folder_structure" | "dcp",
    --   "naming_convention": "{title}_{resolution}_{date}",
    --   "include_sidecar": true
    -- }

    -- Watermarking rules
    watermark_specs JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_beta BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common platform templates
INSERT INTO export_platform_templates (platform_key, platform_name, platform_type, description, video_specs, audio_specs, required_metadata, delivery_specs) VALUES
-- Social/AVOD
('youtube', 'YouTube', 'social_avod', 'Export for YouTube upload',
 '{"codecs": ["h264"], "containers": ["mp4"], "max_resolution": "4k", "max_bitrate_mbps": 50}',
 '{"codecs": ["aac"], "channels": [2], "sample_rate": 48000}',
 '["title", "description", "thumbnail", "tags", "captions"]',
 '{"package_format": "single_file", "naming_convention": "{title}_{resolution}"}'),

('vimeo', 'Vimeo', 'social_avod', 'Export for Vimeo upload',
 '{"codecs": ["h264", "h265"], "containers": ["mp4", "mov"], "max_resolution": "4k", "max_bitrate_mbps": 80}',
 '{"codecs": ["aac"], "channels": [2, 6], "sample_rate": 48000}',
 '["title", "description", "thumbnail", "captions"]',
 '{"package_format": "single_file"}'),

-- FAST Channels
('fast_generic', 'FAST Channel (Generic)', 'fast_channel', 'Generic FAST channel export with playlist',
 '{"codecs": ["h264"], "containers": ["ts", "mp4"], "max_resolution": "1080p", "max_bitrate_mbps": 15}',
 '{"codecs": ["aac", "ac3"], "channels": [2], "sample_rate": 48000}',
 '["title", "description", "thumbnail", "content_rating", "duration"]',
 '{"package_format": "folder_structure", "include_manifest": true}'),

('fast_plutotv', 'Pluto TV', 'fast_channel', 'Pluto TV FAST channel specs',
 '{"codecs": ["h264"], "containers": ["mp4"], "resolution": "1080p", "bitrate_mbps": 8}',
 '{"codecs": ["aac"], "channels": [2], "sample_rate": 48000}',
 '["title", "description", "thumbnail", "content_rating", "genre", "duration"]',
 '{"package_format": "folder_structure", "naming_convention": "plutotv_{content_id}"}'),

-- Venue/Theatrical
('venue_dcp', 'DCP (Digital Cinema Package)', 'venue_theatrical', 'DCP for theatrical exhibition',
 '{"codecs": ["jpeg2000"], "containers": ["mxf"], "resolution": "2k_dci", "color_space": "xyz", "frame_rate": 24}',
 '{"codecs": ["pcm"], "channels": [6], "sample_rate": 48000, "bit_depth": 24}',
 '["title", "content_rating", "duration", "credits"]',
 '{"package_format": "dcp", "include_kdf": true}'),

('venue_prores', 'ProRes Master', 'venue_event', 'ProRes master for event screenings',
 '{"codecs": ["prores_422_hq", "prores_4444"], "containers": ["mov"], "max_resolution": "4k"}',
 '{"codecs": ["pcm"], "channels": [2, 6], "sample_rate": 48000}',
 '["title", "duration"]',
 '{"package_format": "single_file"}'),

-- Airline
('airline_generic', 'Airline IFE', 'airline', 'In-flight entertainment export',
 '{"codecs": ["h264"], "containers": ["mp4"], "resolution": "720p", "max_bitrate_mbps": 4}',
 '{"codecs": ["aac"], "channels": [2], "sample_rate": 48000}',
 '["title", "description", "content_rating", "duration", "subtitles"]',
 '{"package_format": "folder_structure", "include_multiple_languages": true}')

ON CONFLICT (platform_key) DO NOTHING;

-- =============================================================================
-- PART 4: Export Jobs and Artifacts
-- =============================================================================

-- Export jobs (extends media_jobs concept)
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What we're exporting
    world_id UUID NOT NULL REFERENCES worlds(id),
    episode_id UUID REFERENCES episodes(id),  -- NULL = export entire World

    -- Target platform
    platform_template_id UUID REFERENCES export_platform_templates(id),
    platform_key TEXT NOT NULL,  -- Denormalized for quick access

    -- Job configuration
    export_config JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "resolution": "1080p",
    --   "include_captions": true,
    --   "caption_languages": ["en", "es"],
    --   "watermark": true,
    --   "slate_text": "For Screening Only"
    -- }

    -- Status tracking
    status export_status DEFAULT 'pending',
    progress_pct INTEGER DEFAULT 0,
    status_message TEXT,

    -- Linked media job (for actual encoding work)
    media_job_id UUID,

    -- Validation results
    validation_results JSONB DEFAULT '{}'::jsonb,
    validation_passed BOOLEAN,

    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Who requested
    requested_by UUID NOT NULL REFERENCES profiles(id),
    organization_id UUID REFERENCES organizations(id),

    -- Approval workflow (if required)
    requires_approval BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES profiles(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_world ON export_jobs(world_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_episode ON export_jobs(episode_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_platform ON export_jobs(platform_key);
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested_by ON export_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_pending ON export_jobs(status)
    WHERE status IN ('pending', 'validating', 'preparing', 'encoding', 'packaging');

-- Export artifacts (deliverables produced)
CREATE TABLE IF NOT EXISTS export_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,

    -- Artifact details
    artifact_type TEXT NOT NULL,  -- 'video', 'audio', 'manifest', 'thumbnail', 'captions', 'metadata', 'package'
    filename TEXT NOT NULL,

    -- Storage
    s3_bucket TEXT,
    s3_key TEXT,
    file_size_bytes BIGINT,
    checksum_md5 TEXT,
    checksum_sha256 TEXT,

    -- Technical metadata
    technical_metadata JSONB DEFAULT '{}'::jsonb,
    -- Example for video: {"codec": "h264", "resolution": "1920x1080", "duration_seconds": 5400}

    -- Expiration (for temporary exports)
    expires_at TIMESTAMPTZ,

    -- Status
    is_primary BOOLEAN DEFAULT false,  -- Main deliverable

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_artifacts_job ON export_artifacts(export_job_id);
CREATE INDEX IF NOT EXISTS idx_export_artifacts_type ON export_artifacts(artifact_type);

-- =============================================================================
-- PART 5: Export History and Delivery Tracking
-- =============================================================================

-- Track where exports have been delivered
CREATE TABLE IF NOT EXISTS export_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_job_id UUID NOT NULL REFERENCES export_jobs(id),

    -- Delivery details
    delivery_method TEXT NOT NULL,  -- 'download', 's3_transfer', 'api_upload', 'manual'
    destination TEXT,  -- URL, bucket, or description

    -- Status
    status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, failed
    delivered_at TIMESTAMPTZ,

    -- External references
    external_id TEXT,  -- ID on target platform if uploaded via API
    external_url TEXT, -- URL on target platform

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_deliveries_job ON export_deliveries(export_job_id);

-- =============================================================================
-- PART 6: Rights and Availability Integration
-- =============================================================================

-- Function to check if export is allowed for a World/Episode
CREATE OR REPLACE FUNCTION can_export_world(
    p_world_id UUID,
    p_platform_key TEXT,
    p_check_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_policy RECORD;
    v_world RECORD;
    v_festival_block RECORD;
    v_venue_block RECORD;
    v_result JSONB;
BEGIN
    -- Get World status
    SELECT id, status, creator_id, organization_id INTO v_world
    FROM worlds WHERE id = p_world_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'World not found');
    END IF;

    -- World must be published
    IF v_world.status != 'published' THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'World is not published');
    END IF;

    -- Get distribution policy
    SELECT * INTO v_policy
    FROM world_distribution_policies
    WHERE world_id = p_world_id;

    -- Default to internal_only if no policy set
    IF NOT FOUND OR v_policy.distribution_policy = 'internal_only' THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Distribution policy is internal only');
    END IF;

    -- Check if platform is allowed
    IF v_policy.distribution_policy = 'internal_plus_third_party' THEN
        IF NOT (v_policy.allowed_platforms ? p_platform_key) THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'Platform not in allowed list');
        END IF;
    END IF;

    -- Check exclusivity overrides
    IF v_policy.exclusivity_overrides ? p_platform_key THEN
        DECLARE
            v_override JSONB := v_policy.exclusivity_overrides -> p_platform_key;
        BEGIN
            IF v_override ? 'blocked_until' THEN
                IF p_check_date < (v_override ->> 'blocked_until')::TIMESTAMPTZ THEN
                    RETURN jsonb_build_object(
                        'allowed', false,
                        'reason', 'Platform blocked until ' || (v_override ->> 'blocked_until')
                    );
                END IF;
            END IF;
        END;
    END IF;

    -- Check for active festival exclusivity windows
    SELECT fr.id INTO v_festival_block
    FROM festival_runs fr
    JOIN festival_submissions fs ON fr.id = fs.run_id
    WHERE fs.world_id = p_world_id
      AND fr.status = 'active'
      AND fs.status = 'accepted'
      AND fr.end_date > p_check_date
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'World has active festival exclusivity window'
        );
    END IF;

    -- Check for venue exclusivity
    SELECT vb.id INTO v_venue_block
    FROM venue_bookings vb
    WHERE vb.world_id = p_world_id
      AND vb.status = 'confirmed'
      AND vb.booking_end > p_check_date
      AND (vb.exclusivity_type = 'exclusive' OR vb.exclusivity_type = 'semi_exclusive')
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'World has active venue exclusivity'
        );
    END IF;

    -- All checks passed
    v_result := jsonb_build_object(
        'allowed', true,
        'requirements', v_policy.export_requirements,
        'requires_org_approval', v_policy.requires_org_approval,
        'requires_platform_approval', v_policy.requires_platform_approval
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 7: Views
-- =============================================================================

-- View for pending exports needing attention
CREATE OR REPLACE VIEW v_export_queue AS
SELECT
    ej.id as job_id,
    ej.world_id,
    w.title as world_title,
    ej.episode_id,
    e.title as episode_title,
    ej.platform_key,
    ept.platform_name,
    ej.status,
    ej.progress_pct,
    ej.requested_at,
    ej.requested_by,
    p.display_name as requester_name,
    ej.requires_approval,
    ej.approved_at,
    ej.retry_count
FROM export_jobs ej
JOIN worlds w ON ej.world_id = w.id
LEFT JOIN episodes e ON ej.episode_id = e.id
LEFT JOIN export_platform_templates ept ON ej.platform_template_id = ept.id
JOIN profiles p ON ej.requested_by = p.id
WHERE ej.status IN ('pending', 'validating', 'preparing', 'encoding', 'packaging', 'uploading')
ORDER BY ej.requested_at;

-- View for export history per World
CREATE OR REPLACE VIEW v_world_export_history AS
SELECT
    ej.world_id,
    ej.id as job_id,
    ej.platform_key,
    ept.platform_name,
    ej.status,
    ej.completed_at,
    ej.requested_by,
    p.display_name as requester_name,
    COUNT(ea.id) as artifact_count,
    SUM(ea.file_size_bytes) as total_size_bytes,
    MAX(ed.external_url) as delivery_url
FROM export_jobs ej
LEFT JOIN export_platform_templates ept ON ej.platform_template_id = ept.id
LEFT JOIN profiles p ON ej.requested_by = p.id
LEFT JOIN export_artifacts ea ON ej.id = ea.export_job_id
LEFT JOIN export_deliveries ed ON ej.id = ed.export_job_id AND ed.status = 'completed'
GROUP BY ej.id, ej.world_id, ej.platform_key, ept.platform_name, ej.status,
         ej.completed_at, ej.requested_by, p.display_name
ORDER BY ej.completed_at DESC NULLS LAST;

-- =============================================================================
-- PART 8: Triggers
-- =============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_export_job_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_export_jobs_updated ON export_jobs;
CREATE TRIGGER trg_export_jobs_updated
    BEFORE UPDATE ON export_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_export_job_timestamp();

-- Log status changes
CREATE TABLE IF NOT EXISTS export_job_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
    previous_status export_status,
    new_status export_status NOT NULL,
    message TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_export_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO export_job_history (export_job_id, previous_status, new_status, message)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.status_message);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_export_status_log ON export_jobs;
CREATE TRIGGER trg_export_status_log
    AFTER UPDATE OF status ON export_jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_export_status_change();

COMMIT;
