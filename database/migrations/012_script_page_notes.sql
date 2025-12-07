-- Migration: 012_script_page_notes.sql
-- Description: Add script page notes for Acrobat-style annotations on script PDFs
-- Date: 2025-12-06

-- ============================================================================
-- PHASE 1: Create backlot_script_page_notes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_script_page_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES backlot_scripts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Page and position
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  position_x NUMERIC(5,4) CHECK (position_x >= 0 AND position_x <= 1), -- Normalized 0-1 across page width
  position_y NUMERIC(5,4) CHECK (position_y >= 0 AND position_y <= 1), -- Normalized 0-1 down page height

  -- Note content
  note_text TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN (
    'general',      -- General note
    'direction',    -- Director's note
    'production',   -- Production note
    'character',    -- Character note
    'blocking',     -- Blocking/staging note
    'camera',       -- Camera/shot note
    'continuity',   -- Continuity note
    'sound',        -- Sound/audio note
    'vfx',          -- VFX note
    'prop',         -- Prop note
    'wardrobe',     -- Wardrobe note
    'makeup',       -- Makeup/hair note
    'location',     -- Location note
    'safety',       -- Safety note
    'other'         -- Other
  )),

  -- Optional scene link
  scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,

  -- Status
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Author
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_script_page_notes_script ON backlot_script_page_notes(script_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_project ON backlot_script_page_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_page ON backlot_script_page_notes(script_id, page_number);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_author ON backlot_script_page_notes(author_user_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_scene ON backlot_script_page_notes(scene_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_type ON backlot_script_page_notes(script_id, note_type);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_resolved ON backlot_script_page_notes(script_id, resolved);

-- ============================================================================
-- PHASE 3: Enable RLS and create policies
-- ============================================================================

ALTER TABLE backlot_script_page_notes ENABLE ROW LEVEL SECURITY;

-- All project members can view notes
CREATE POLICY "Members can view script page notes"
  ON backlot_script_page_notes FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

-- All project members can create notes
CREATE POLICY "Members can create script page notes"
  ON backlot_script_page_notes FOR INSERT
  WITH CHECK (
    is_backlot_project_member(project_id, auth.uid())
    AND author_user_id = auth.uid()
  );

-- Authors and editors can update notes
CREATE POLICY "Authors and editors can update script page notes"
  ON backlot_script_page_notes FOR UPDATE
  USING (
    author_user_id = auth.uid()
    OR can_edit_backlot_project(project_id, auth.uid())
  );

-- Authors and editors can delete notes
CREATE POLICY "Authors and editors can delete script page notes"
  ON backlot_script_page_notes FOR DELETE
  USING (
    author_user_id = auth.uid()
    OR can_edit_backlot_project(project_id, auth.uid())
  );

-- ============================================================================
-- PHASE 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER backlot_script_page_notes_updated_at
  BEFORE UPDATE ON backlot_script_page_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 5: Add page_count column to backlot_scripts if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'page_count'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN page_count INTEGER;
  END IF;
END $$;

-- ============================================================================
-- PHASE 6: Helper function to get notes for a script
-- ============================================================================

CREATE OR REPLACE FUNCTION get_script_page_notes_summary(p_script_id UUID)
RETURNS TABLE (
  page_number INTEGER,
  note_count BIGINT,
  unresolved_count BIGINT,
  note_types TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.page_number,
    COUNT(*)::BIGINT as note_count,
    COUNT(*) FILTER (WHERE NOT n.resolved)::BIGINT as unresolved_count,
    ARRAY_AGG(DISTINCT n.note_type) as note_types
  FROM backlot_script_page_notes n
  WHERE n.script_id = p_script_id
  GROUP BY n.page_number
  ORDER BY n.page_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_script_page_notes_summary TO authenticated;

-- ============================================================================
-- PHASE 7: Comments
-- ============================================================================

COMMENT ON TABLE backlot_script_page_notes IS 'Annotations/notes on script PDF pages, positioned at specific coordinates';
COMMENT ON COLUMN backlot_script_page_notes.position_x IS 'Normalized X position (0-1) from left edge of page';
COMMENT ON COLUMN backlot_script_page_notes.position_y IS 'Normalized Y position (0-1) from top edge of page';
COMMENT ON COLUMN backlot_script_page_notes.note_type IS 'Category of note for filtering and organization';
