-- Migration 042: Dailies System Enhancements
-- Adds API key management, clip-asset linking, and proxy tracking

-- =====================================================
-- Desktop App API Keys
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_desktop_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,  -- SHA-256 hash of the API key
    key_prefix TEXT NOT NULL,  -- First 12 chars for identification (e.g., "swn_dk_a1b2c3")
    name TEXT NOT NULL DEFAULT 'Desktop App',
    scopes TEXT[] NOT NULL DEFAULT ARRAY['dailies:write', 'dailies:read'],
    last_used_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(key_hash)
);

CREATE INDEX IF NOT EXISTS idx_desktop_api_keys_project ON backlot_desktop_api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_desktop_api_keys_user ON backlot_desktop_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_desktop_api_keys_prefix ON backlot_desktop_api_keys(key_prefix);

-- =====================================================
-- Dailies Clip to Asset Links
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_dailies_clip_asset_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID NOT NULL REFERENCES backlot_dailies_clips(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES backlot_assets(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'source' CHECK (link_type IN ('source', 'reference', 'alternate')),
    notes TEXT NULL,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(clip_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_clip_asset_links_clip ON backlot_dailies_clip_asset_links(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_asset_links_asset ON backlot_dailies_clip_asset_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_clip_asset_links_project ON backlot_dailies_clip_asset_links(project_id);

-- =====================================================
-- Extend backlot_dailies_clips with proxy/checksum tracking
-- =====================================================
ALTER TABLE backlot_dailies_clips
ADD COLUMN IF NOT EXISTS proxy_url TEXT NULL;

ALTER TABLE backlot_dailies_clips
ADD COLUMN IF NOT EXISTS original_checksum TEXT NULL;  -- XXH64 hash of original file

ALTER TABLE backlot_dailies_clips
ADD COLUMN IF NOT EXISTS proxy_checksum TEXT NULL;  -- XXH64 hash of proxy file

ALTER TABLE backlot_dailies_clips
ADD COLUMN IF NOT EXISTS upload_status TEXT NULL CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed'));

ALTER TABLE backlot_dailies_clips
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL;

-- =====================================================
-- Helper function to get clip asset links count
-- =====================================================
CREATE OR REPLACE FUNCTION get_clip_asset_link_count(p_clip_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM backlot_dailies_clip_asset_links
        WHERE clip_id = p_clip_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Helper function to get asset source clips count
-- =====================================================
CREATE OR REPLACE FUNCTION get_asset_source_clips_count(p_asset_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM backlot_dailies_clip_asset_links
        WHERE asset_id = p_asset_id
    );
END;
$$ LANGUAGE plpgsql STABLE;
