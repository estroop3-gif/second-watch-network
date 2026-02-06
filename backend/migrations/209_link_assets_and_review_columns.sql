-- Migration 209: Link assets and review column fixes
-- Adds missing columns to backlot_review_assets (defined in migration 020 but never applied)
-- Extends standalone assets to support URL-based assets (video links)

-- Add missing columns to backlot_review_assets
ALTER TABLE backlot_review_assets
  ADD COLUMN IF NOT EXISTS linked_scene_id UUID,
  ADD COLUMN IF NOT EXISTS linked_shot_list_id UUID;

-- Extend standalone assets to support URL-based assets
ALTER TABLE backlot_standalone_assets
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS video_provider TEXT,
  ADD COLUMN IF NOT EXISTS external_video_id TEXT;

-- Make file_name and s3_key nullable (link assets don't have files)
ALTER TABLE backlot_standalone_assets
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN s3_key DROP NOT NULL;

-- Update asset_type constraint to include video types
ALTER TABLE backlot_standalone_assets DROP CONSTRAINT IF EXISTS standalone_assets_type_check;
ALTER TABLE backlot_standalone_assets
  ADD CONSTRAINT standalone_assets_type_check
  CHECK (asset_type IN ('audio', '3d_model', 'image', 'document', 'graphics', 'music', 'sfx', 'video', 'video_link', 'other'));

-- Ensure either s3_key or source_url is provided
ALTER TABLE backlot_standalone_assets
  ADD CONSTRAINT standalone_assets_has_source
  CHECK (s3_key IS NOT NULL OR source_url IS NOT NULL);

-- Update unified assets view to include source_url
CREATE OR REPLACE VIEW backlot_unified_assets AS
  -- Dailies clips
  SELECT c.id, c.project_id, 'dailies'::TEXT as source, c.file_name as name,
    'video'::TEXT as asset_type, c.thumbnail_url, c.duration_seconds,
    c.file_size_bytes, c.created_at
  FROM backlot_dailies_clips c WHERE c.storage_mode = 'cloud'
  UNION ALL
  -- Review versions (active only)
  SELECT v.id, a.project_id, 'review'::TEXT as source, a.name,
    'video'::TEXT as asset_type, v.thumbnail_url,
    COALESCE(v.duration_seconds, NULL)::NUMERIC as duration_seconds,
    COALESCE(v.file_size_bytes, NULL)::BIGINT as file_size_bytes, v.created_at
  FROM backlot_review_versions v
  JOIN backlot_review_assets a ON v.asset_id = a.id WHERE v.id = a.active_version_id
  UNION ALL
  -- Standalone assets (files AND links)
  SELECT id, project_id, 'standalone'::TEXT as source, name, asset_type,
    thumbnail_url, duration_seconds, file_size_bytes, created_at
  FROM backlot_standalone_assets;
