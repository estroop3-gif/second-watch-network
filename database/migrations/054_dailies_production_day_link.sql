-- Migration 054: Dailies Production Day Link & Offload Manifests
-- Links dailies system to production days for workflow integration
-- Adds 'footage' asset type and offload manifest tracking

-- =============================================================================
-- PART 1: Add 'footage' asset type
-- =============================================================================

-- Drop and recreate the check constraint to add 'footage' type
ALTER TABLE backlot_assets DROP CONSTRAINT IF EXISTS backlot_assets_asset_type_check;

ALTER TABLE backlot_assets ADD CONSTRAINT backlot_assets_asset_type_check
CHECK (asset_type IN (
    'episode',
    'feature',
    'trailer',
    'teaser',
    'social',
    'bts',
    'footage',
    'other'
));

-- Update the summary function to include footage type
CREATE OR REPLACE FUNCTION get_project_assets_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'by_type', jsonb_build_object(
            'episode', COUNT(*) FILTER (WHERE asset_type = 'episode'),
            'feature', COUNT(*) FILTER (WHERE asset_type = 'feature'),
            'trailer', COUNT(*) FILTER (WHERE asset_type = 'trailer'),
            'teaser', COUNT(*) FILTER (WHERE asset_type = 'teaser'),
            'social', COUNT(*) FILTER (WHERE asset_type = 'social'),
            'bts', COUNT(*) FILTER (WHERE asset_type = 'bts'),
            'footage', COUNT(*) FILTER (WHERE asset_type = 'footage'),
            'other', COUNT(*) FILTER (WHERE asset_type = 'other')
        ),
        'by_status', jsonb_build_object(
            'not_started', COUNT(*) FILTER (WHERE status = 'not_started'),
            'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
            'in_review', COUNT(*) FILTER (WHERE status = 'in_review'),
            'approved', COUNT(*) FILTER (WHERE status = 'approved'),
            'delivered', COUNT(*) FILTER (WHERE status = 'delivered')
        )
    ) INTO result
    FROM backlot_assets
    WHERE project_id = p_project_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 2: Create offload manifests table for Desktop Helper tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_offload_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,
    dailies_day_id UUID REFERENCES backlot_dailies_days(id) ON DELETE SET NULL,

    -- Manifest info
    manifest_name TEXT NOT NULL,
    source_device TEXT NULL,  -- "CFexpress A", "SSD-01", "Camera A Card"
    camera_label TEXT NULL,   -- "A", "B", "C"
    roll_name TEXT NULL,      -- "A001", "B002"

    -- File tracking
    total_files INTEGER NOT NULL DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,

    -- Status tracking
    offload_status TEXT NOT NULL DEFAULT 'pending' CHECK (offload_status IN (
        'pending',      -- Not started
        'in_progress',  -- Offload in progress
        'completed',    -- Offload finished
        'failed'        -- Offload failed
    )),
    upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN (
        'pending',      -- Not started / queued
        'uploading',    -- Upload in progress
        'completed',    -- Upload finished
        'skipped',      -- User chose local-only
        'failed'        -- Upload failed
    )),

    -- Options
    create_footage_asset BOOLEAN NOT NULL DEFAULT FALSE,
    created_footage_asset_id UUID REFERENCES backlot_assets(id) ON DELETE SET NULL,

    -- Timing
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offload_manifests_project ON backlot_offload_manifests(project_id);
CREATE INDEX IF NOT EXISTS idx_offload_manifests_production_day ON backlot_offload_manifests(production_day_id);
CREATE INDEX IF NOT EXISTS idx_offload_manifests_dailies_day ON backlot_offload_manifests(dailies_day_id);
CREATE INDEX IF NOT EXISTS idx_offload_manifests_offload_status ON backlot_offload_manifests(offload_status);
CREATE INDEX IF NOT EXISTS idx_offload_manifests_upload_status ON backlot_offload_manifests(upload_status);

-- =============================================================================
-- PART 3: Create offload manifest files table (individual files in manifest)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_offload_manifest_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID NOT NULL REFERENCES backlot_offload_manifests(id) ON DELETE CASCADE,

    -- File info
    file_name TEXT NOT NULL,
    relative_path TEXT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    content_type TEXT NULL,

    -- Status
    offload_status TEXT NOT NULL DEFAULT 'pending' CHECK (offload_status IN (
        'pending', 'in_progress', 'completed', 'failed', 'skipped'
    )),
    upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN (
        'pending', 'uploading', 'completed', 'failed', 'skipped'
    )),

    -- Checksums
    source_checksum TEXT NULL,    -- XXH64 of original
    dest_checksum TEXT NULL,      -- XXH64 after copy (verification)
    checksum_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Link to dailies clip if created
    dailies_clip_id UUID REFERENCES backlot_dailies_clips(id) ON DELETE SET NULL,

    -- Error tracking
    error_message TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offload_manifest_files_manifest ON backlot_offload_manifest_files(manifest_id);
CREATE INDEX IF NOT EXISTS idx_offload_manifest_files_clip ON backlot_offload_manifest_files(dailies_clip_id);
CREATE INDEX IF NOT EXISTS idx_offload_manifest_files_status ON backlot_offload_manifest_files(offload_status);

-- =============================================================================
-- PART 4: Add index for production day lookup on dailies_days
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_dailies_days_production_day ON backlot_dailies_days(production_day_id);

-- =============================================================================
-- PART 5: Triggers for updated_at
-- =============================================================================

DROP TRIGGER IF EXISTS offload_manifests_updated_at ON backlot_offload_manifests;
CREATE TRIGGER offload_manifests_updated_at
    BEFORE UPDATE ON backlot_offload_manifests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS offload_manifest_files_updated_at ON backlot_offload_manifest_files;
CREATE TRIGGER offload_manifest_files_updated_at
    BEFORE UPDATE ON backlot_offload_manifest_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PART 6: RLS Policies (Skipped - RDS without Supabase Auth)
-- =============================================================================
-- Note: RLS policies are defined in migration files but not applied on RDS.
-- Access control is handled at the application layer via API authentication.

-- =============================================================================
-- PART 7: Helper functions
-- =============================================================================

-- Get manifest summary
CREATE OR REPLACE FUNCTION get_offload_manifest_summary(p_manifest_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_files', COUNT(*),
        'total_bytes', COALESCE(SUM(file_size_bytes), 0),
        'pending_files', COUNT(*) FILTER (WHERE offload_status = 'pending'),
        'completed_files', COUNT(*) FILTER (WHERE offload_status = 'completed'),
        'failed_files', COUNT(*) FILTER (WHERE offload_status = 'failed'),
        'verified_files', COUNT(*) FILTER (WHERE checksum_verified = TRUE),
        'uploaded_files', COUNT(*) FILTER (WHERE upload_status = 'completed'),
        'clips_created', COUNT(*) FILTER (WHERE dailies_clip_id IS NOT NULL)
    ) INTO result
    FROM backlot_offload_manifest_files
    WHERE manifest_id = p_manifest_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- PART 8: Comments
-- =============================================================================

COMMENT ON TABLE backlot_offload_manifests IS 'Tracks card/drive offload operations from Desktop Helper';
COMMENT ON TABLE backlot_offload_manifest_files IS 'Individual files within an offload manifest';
COMMENT ON COLUMN backlot_offload_manifests.source_device IS 'Device label like CFexpress A, SSD-01';
COMMENT ON COLUMN backlot_offload_manifests.create_footage_asset IS 'Whether to auto-create a footage asset in Assets tab';
COMMENT ON COLUMN backlot_offload_manifest_files.source_checksum IS 'XXH64 hash of file before copy';
COMMENT ON COLUMN backlot_offload_manifest_files.dest_checksum IS 'XXH64 hash after copy for verification';
