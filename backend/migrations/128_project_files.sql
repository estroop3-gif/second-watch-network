-- Project Files & Folders Tables
-- File management system with S3 storage and folder hierarchy

-- Storage provider enum
DO $$ BEGIN
    CREATE TYPE storage_provider AS ENUM ('S3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Upload status enum
DO $$ BEGIN
    CREATE TYPE upload_status AS ENUM ('PENDING', 'UPLOADING', 'COMPLETE', 'FAILED', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- File link target type enum
DO $$ BEGIN
    CREATE TYPE file_link_target_type AS ENUM (
        'PROJECT', 'EPISODE', 'STORY', 'STORYBOARD',
        'SIDES_PACKET', 'STRIP', 'PROJECT_DAY', 'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Project Folders - hierarchical folder structure
CREATE TABLE IF NOT EXISTS backlot_project_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES backlot_project_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,  -- materialized path e.g. "/Root/Edits/VFX"
    sort_order INT DEFAULT 0,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_folders_project ON backlot_project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_folders_parent ON backlot_project_folders(project_id, parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_project_folders_sibling_name ON backlot_project_folders(project_id, parent_id, name)
    WHERE parent_id IS NOT NULL;
-- Special index for root folders (parent_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_project_folders_root_name ON backlot_project_folders(project_id, name)
    WHERE parent_id IS NULL;

-- Project Files - file metadata with S3 storage
CREATE TABLE IF NOT EXISTS backlot_project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES backlot_project_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    extension TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    checksum_sha256 TEXT,
    storage_provider storage_provider NOT NULL DEFAULT 'S3',
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    upload_status upload_status NOT NULL DEFAULT 'PENDING',
    upload_id TEXT,  -- S3 multipart upload ID
    etag TEXT,
    uploaded_at TIMESTAMPTZ,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_files_project ON backlot_project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_files_folder ON backlot_project_files(project_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_files_name ON backlot_project_files(project_id, name);
CREATE INDEX IF NOT EXISTS idx_backlot_project_files_status ON backlot_project_files(upload_status);
CREATE INDEX IF NOT EXISTS idx_backlot_project_files_extension ON backlot_project_files(project_id, extension);
-- GIN index for tag search
CREATE INDEX IF NOT EXISTS idx_backlot_project_files_tags ON backlot_project_files USING GIN (tags);

-- Project File Links - polymorphic links to other entities
CREATE TABLE IF NOT EXISTS backlot_project_file_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES backlot_project_files(id) ON DELETE CASCADE,
    target_type file_link_target_type NOT NULL,
    target_id UUID NOT NULL,
    label TEXT,  -- optional label like "Camera Original" or "Contract"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_file_links_file ON backlot_project_file_links(file_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_file_links_target ON backlot_project_file_links(project_id, target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_project_file_links_unique ON backlot_project_file_links(file_id, target_type, target_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_project_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_backlot_project_folders_updated_at ON backlot_project_folders;
CREATE TRIGGER trigger_backlot_project_folders_updated_at
    BEFORE UPDATE ON backlot_project_folders
    FOR EACH ROW EXECUTE FUNCTION update_project_files_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_project_files_updated_at ON backlot_project_files;
CREATE TRIGGER trigger_backlot_project_files_updated_at
    BEFORE UPDATE ON backlot_project_files
    FOR EACH ROW EXECUTE FUNCTION update_project_files_updated_at();

-- Comments for documentation
COMMENT ON TABLE backlot_project_folders IS 'Folder hierarchy for project files';
COMMENT ON COLUMN backlot_project_folders.path IS 'Materialized path for breadcrumb display, e.g. /Root/Edits/VFX';
COMMENT ON TABLE backlot_project_files IS 'File metadata with S3 storage location';
COMMENT ON COLUMN backlot_project_files.upload_id IS 'S3 multipart upload ID for resumable uploads';
COMMENT ON COLUMN backlot_project_files.tags IS 'JSON array of string tags for filtering';
COMMENT ON TABLE backlot_project_file_links IS 'Polymorphic links connecting files to project entities';
COMMENT ON COLUMN backlot_project_file_links.target_type IS 'Type of entity the file is linked to';
COMMENT ON COLUMN backlot_project_file_links.target_id IS 'UUID of the linked entity';
