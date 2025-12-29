-- Migration: Review Tab & Assets System
-- Creates folder structure, external reviewer access, and standalone assets

-- ============================================================================
-- PHASE 1: Review Folders
-- ============================================================================

-- Review folders table (nested folder structure)
CREATE TABLE IF NOT EXISTS backlot_review_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES backlot_review_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,  -- Folder color for visual organization (hex code)
  sort_order INTEGER DEFAULT 0,
  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_parent CHECK (id != parent_folder_id)
);

CREATE INDEX IF NOT EXISTS idx_review_folders_project ON backlot_review_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_review_folders_parent ON backlot_review_folders(parent_folder_id);

-- Modify review_assets table
ALTER TABLE backlot_review_assets
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES backlot_review_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT;

-- Add constraints if they don't exist (handle gracefully)
DO $$
BEGIN
  ALTER TABLE backlot_review_assets
    ADD CONSTRAINT review_assets_status_check
    CHECK (status IN ('draft', 'in_review', 'changes_requested', 'approved', 'final'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE backlot_review_assets
    ADD CONSTRAINT review_assets_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_review_assets_folder ON backlot_review_assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_review_assets_status ON backlot_review_assets(status);

-- ============================================================================
-- PHASE 3: S3 Storage for Review Versions
-- ============================================================================

-- Modify review_versions for S3 storage
ALTER TABLE backlot_review_versions
  ADD COLUMN IF NOT EXISTS storage_mode TEXT DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS s3_key TEXT,
  ADD COLUMN IF NOT EXISTS renditions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS codec TEXT,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS frame_rate NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS transcode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transcode_error TEXT;

DO $$
BEGIN
  ALTER TABLE backlot_review_versions
    ADD CONSTRAINT review_versions_storage_mode_check
    CHECK (storage_mode IN ('external', 's3'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE backlot_review_versions
    ADD CONSTRAINT review_versions_transcode_status_check
    CHECK (transcode_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_review_versions_storage ON backlot_review_versions(storage_mode);
CREATE INDEX IF NOT EXISTS idx_review_versions_transcode ON backlot_review_versions(transcode_status)
  WHERE transcode_status IN ('pending', 'processing');

-- ============================================================================
-- PHASE 4: External Reviewer Access
-- ============================================================================

-- External review links
CREATE TABLE IF NOT EXISTS backlot_review_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES backlot_review_assets(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES backlot_review_folders(id) ON DELETE CASCADE,

  -- Link properties
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,

  -- Permissions
  can_comment BOOLEAN DEFAULT TRUE,
  can_download BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE,

  -- Expiration
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,

  -- Audit
  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  -- Either asset_id or folder_id must be set (or neither for whole project)
  CONSTRAINT link_target CHECK (
    (asset_id IS NOT NULL AND folder_id IS NULL) OR
    (asset_id IS NULL AND folder_id IS NOT NULL) OR
    (asset_id IS NULL AND folder_id IS NULL)  -- Whole project link
  )
);

CREATE INDEX IF NOT EXISTS idx_external_links_token ON backlot_review_external_links(token);
CREATE INDEX IF NOT EXISTS idx_external_links_project ON backlot_review_external_links(project_id);
CREATE INDEX IF NOT EXISTS idx_external_links_active ON backlot_review_external_links(is_active, expires_at)
  WHERE is_active = TRUE;

-- External reviewer sessions
CREATE TABLE IF NOT EXISTS backlot_review_external_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES backlot_review_external_links(id) ON DELETE CASCADE,

  -- Session info
  session_token TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,

  -- Tracking
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_sessions_token ON backlot_review_external_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_external_sessions_link ON backlot_review_external_sessions(link_id);
CREATE INDEX IF NOT EXISTS idx_external_sessions_expires ON backlot_review_external_sessions(expires_at);

-- Modify review_notes for external authors
ALTER TABLE backlot_review_notes
  ADD COLUMN IF NOT EXISTS external_session_id UUID REFERENCES backlot_review_external_sessions(id),
  ADD COLUMN IF NOT EXISTS external_author_name TEXT;

CREATE INDEX IF NOT EXISTS idx_review_notes_external ON backlot_review_notes(external_session_id)
  WHERE external_session_id IS NOT NULL;

-- ============================================================================
-- PHASE 5: Standalone Assets
-- ============================================================================

-- Asset folders (separate from review folders)
CREATE TABLE IF NOT EXISTS backlot_asset_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES backlot_asset_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  folder_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_parent_assets CHECK (id != parent_folder_id)
);

DO $$
BEGIN
  ALTER TABLE backlot_asset_folders
    ADD CONSTRAINT asset_folders_type_check
    CHECK (folder_type IN ('audio', '3d', 'graphics', 'documents', 'mixed'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_asset_folders_project ON backlot_asset_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_folders_parent ON backlot_asset_folders(parent_folder_id);

-- Standalone assets (non-video)
CREATE TABLE IF NOT EXISTS backlot_standalone_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES backlot_asset_folders(id) ON DELETE SET NULL,

  -- Asset info
  name TEXT NOT NULL,
  description TEXT,
  asset_type TEXT NOT NULL,

  -- File info
  file_name TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  duration_seconds NUMERIC,  -- For audio
  dimensions TEXT,           -- For images (WxH)

  -- Metadata
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  thumbnail_url TEXT,

  -- Audit
  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE backlot_standalone_assets
    ADD CONSTRAINT standalone_assets_type_check
    CHECK (asset_type IN ('audio', '3d_model', 'image', 'document', 'graphics', 'music', 'sfx', 'other'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_standalone_assets_project ON backlot_standalone_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_standalone_assets_folder ON backlot_standalone_assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_standalone_assets_type ON backlot_standalone_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_standalone_assets_tags ON backlot_standalone_assets USING GIN(tags);

-- ============================================================================
-- Unified Assets View (for Assets tab)
-- ============================================================================

CREATE OR REPLACE VIEW backlot_unified_assets AS
  -- Dailies clips
  SELECT
    c.id,
    c.project_id,
    'dailies'::TEXT as source,
    c.file_name as name,
    'video'::TEXT as asset_type,
    c.thumbnail_url,
    c.duration_seconds,
    c.file_size_bytes,
    c.created_at
  FROM backlot_dailies_clips c
  WHERE c.storage_mode = 'cloud'  -- Only cloud-synced clips

  UNION ALL

  -- Review versions (active only)
  SELECT
    v.id,
    a.project_id,
    'review'::TEXT as source,
    a.name,
    'video'::TEXT as asset_type,
    v.thumbnail_url,
    COALESCE(v.duration_seconds, NULL)::NUMERIC as duration_seconds,
    COALESCE(v.file_size_bytes, NULL)::BIGINT as file_size_bytes,
    v.created_at
  FROM backlot_review_versions v
  JOIN backlot_review_assets a ON v.asset_id = a.id
  WHERE v.id = a.active_version_id

  UNION ALL

  -- Standalone assets
  SELECT
    id,
    project_id,
    'standalone'::TEXT as source,
    name,
    asset_type,
    thumbnail_url,
    duration_seconds,
    file_size_bytes,
    created_at
  FROM backlot_standalone_assets;

-- ============================================================================
-- Updated timestamps triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_review_folders_updated_at ON backlot_review_folders;
CREATE TRIGGER update_review_folders_updated_at
    BEFORE UPDATE ON backlot_review_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_asset_folders_updated_at ON backlot_asset_folders;
CREATE TRIGGER update_asset_folders_updated_at
    BEFORE UPDATE ON backlot_asset_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_standalone_assets_updated_at ON backlot_standalone_assets;
CREATE TRIGGER update_standalone_assets_updated_at
    BEFORE UPDATE ON backlot_standalone_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper function for folder path (breadcrumbs)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_review_folder_path(folder_id UUID)
RETURNS TABLE(id UUID, name TEXT, depth INT) AS $$
WITH RECURSIVE folder_path AS (
  SELECT f.id, f.name, f.parent_folder_id, 0 as depth
  FROM backlot_review_folders f
  WHERE f.id = folder_id

  UNION ALL

  SELECT f.id, f.name, f.parent_folder_id, fp.depth + 1
  FROM backlot_review_folders f
  JOIN folder_path fp ON f.id = fp.parent_folder_id
)
SELECT fp.id, fp.name, fp.depth
FROM folder_path fp
ORDER BY fp.depth DESC;
$$ LANGUAGE SQL;
