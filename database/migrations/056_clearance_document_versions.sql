-- Migration: 056_clearance_document_versions.sql
-- Description: Add document versioning for clearance items
-- Date: 2025-12-28

-- Document versions table for clearance items
CREATE TABLE IF NOT EXISTS backlot_clearance_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES backlot_clearance_items(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    content_type TEXT,
    uploaded_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    notes TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(clearance_id, version_number)
);

-- Index for fetching versions by clearance
CREATE INDEX IF NOT EXISTS idx_clearance_doc_versions_clearance
    ON backlot_clearance_document_versions(clearance_id);

-- Index for finding current version quickly
CREATE INDEX IF NOT EXISTS idx_clearance_doc_versions_current
    ON backlot_clearance_document_versions(clearance_id)
    WHERE is_current = TRUE;

-- Migrate existing documents to version 1
-- Only insert if there's a file_url and the clearance doesn't already have versions
INSERT INTO backlot_clearance_document_versions (
    clearance_id,
    version_number,
    file_url,
    file_name,
    is_current,
    created_at
)
SELECT
    id,
    1,
    file_url,
    COALESCE(file_name, 'document'),
    TRUE,
    COALESCE(updated_at, NOW())
FROM backlot_clearance_items
WHERE file_url IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM backlot_clearance_document_versions v
    WHERE v.clearance_id = backlot_clearance_items.id
);
