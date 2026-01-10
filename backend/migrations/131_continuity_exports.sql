-- Migration 131: Continuity PDF Exports
-- Stores version history of exported script PDFs for continuity view

CREATE TABLE IF NOT EXISTS backlot_continuity_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    script_id UUID REFERENCES backlot_scripts(id) ON DELETE SET NULL,

    -- PDF file storage
    file_url TEXT NOT NULL,  -- S3 URI: s3://bucket/path
    file_name TEXT NOT NULL,
    file_size BIGINT,

    -- Export metadata
    export_type TEXT NOT NULL DEFAULT 'script',  -- 'script', 'breakdown', 'sides', etc.
    content_type TEXT,  -- 'clean', 'highlights', 'notes', 'both'
    page_count INT,

    -- Version tracking
    version_number INT NOT NULL DEFAULT 1,
    version_label TEXT,  -- Optional user-friendly label like "Final Draft"

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ordering
    is_current BOOLEAN DEFAULT false  -- Mark latest as current for quick access
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_continuity_exports_project ON backlot_continuity_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_continuity_exports_script ON backlot_continuity_exports(script_id);
CREATE INDEX IF NOT EXISTS idx_continuity_exports_current ON backlot_continuity_exports(project_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_continuity_exports_created ON backlot_continuity_exports(project_id, created_at DESC);
