-- Migration 037: Call Sheet Comments
-- Adds comments/notes functionality for call sheets

-- =====================================================
-- TABLE: backlot_call_sheet_comments
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES backlot_call_sheet_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Comment content
  content TEXT NOT NULL,

  -- Optional field reference (which field this comment is about)
  field_reference TEXT,

  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_sheet_comments_call_sheet ON backlot_call_sheet_comments(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_comments_parent ON backlot_call_sheet_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_comments_user ON backlot_call_sheet_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_comments_resolved ON backlot_call_sheet_comments(is_resolved) WHERE is_resolved = FALSE;

-- =====================================================
-- TABLE: backlot_comment_mentions
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES backlot_call_sheet_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON backlot_comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_notified ON backlot_comment_mentions(notified) WHERE notified = FALSE;
