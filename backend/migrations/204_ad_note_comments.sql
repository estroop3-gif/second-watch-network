-- Migration: AD Note Comments Table
-- Creates threaded comments for AD note entries

-- ============================================================================
-- AD Note Comments Table
-- ============================================================================

CREATE TABLE backlot_ad_note_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES backlot_ad_note_entries(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES backlot_ad_note_comments(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,

    -- Metadata
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_edited BOOLEAN DEFAULT FALSE
);

-- Indexes for efficient querying
CREATE INDEX idx_ad_note_comments_entry ON backlot_ad_note_comments(entry_id);
CREATE INDEX idx_ad_note_comments_parent ON backlot_ad_note_comments(parent_comment_id);
CREATE INDEX idx_ad_note_comments_created_by ON backlot_ad_note_comments(created_by);

COMMENT ON TABLE backlot_ad_note_comments IS 'Threaded comments on AD note entries';
COMMENT ON COLUMN backlot_ad_note_comments.parent_comment_id IS 'Reference to parent comment for threading (null for top-level)';
COMMENT ON COLUMN backlot_ad_note_comments.is_edited IS 'True if comment has been edited after creation';
