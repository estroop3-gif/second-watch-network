-- Migration: AD Note Entries Table
-- Creates version-controlled AD notes with draft support

-- ============================================================================
-- AD Note Entries Table
-- ============================================================================

CREATE TABLE backlot_ad_note_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    is_draft BOOLEAN DEFAULT FALSE,

    -- Versioning
    version_number INTEGER NOT NULL DEFAULT 1,
    parent_entry_id UUID REFERENCES backlot_ad_note_entries(id) ON DELETE SET NULL,

    -- Metadata
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_ad_note_entries_day ON backlot_ad_note_entries(production_day_id);
CREATE INDEX idx_ad_note_entries_project ON backlot_ad_note_entries(project_id);
CREATE INDEX idx_ad_note_entries_draft ON backlot_ad_note_entries(production_day_id, is_draft);
CREATE INDEX idx_ad_note_entries_created_by ON backlot_ad_note_entries(created_by);

COMMENT ON TABLE backlot_ad_note_entries IS 'Version-controlled AD notes with draft support for production days';
COMMENT ON COLUMN backlot_ad_note_entries.is_draft IS 'True if this is a working draft, false if published';
COMMENT ON COLUMN backlot_ad_note_entries.version_number IS 'Sequential version number for published notes';
COMMENT ON COLUMN backlot_ad_note_entries.parent_entry_id IS 'Reference to previous version for history tracking';
