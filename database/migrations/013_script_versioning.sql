-- Migration: 013_script_versioning.sql
-- Description: Add script versioning system and highlight-based breakdown creation
-- Date: 2025-12-07

-- ============================================================================
-- PHASE 1: Add versioning columns to backlot_scripts
-- ============================================================================

-- Add version tracking columns if they don't exist
DO $$
BEGIN
  -- Parent version reference (for version chains)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'parent_version_id'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN parent_version_id UUID REFERENCES backlot_scripts(id) ON DELETE SET NULL;
  END IF;

  -- Version number within chain
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'version_number'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN version_number INTEGER DEFAULT 1;
  END IF;

  -- Color code for version (for visual identification)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'color_code'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN color_code TEXT DEFAULT 'white';
  END IF;

  -- Revision notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'revision_notes'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN revision_notes TEXT;
  END IF;

  -- Lock status for approved versions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
  END IF;

  -- Locked by/at tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'locked_by_user_id'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN locked_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  -- Is current active version
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'is_current'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN is_current BOOLEAN DEFAULT TRUE;
  END IF;

  -- Script text content (for editable scripts)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'text_content'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN text_content TEXT;
  END IF;
END $$;

-- Index for version chain traversal
CREATE INDEX IF NOT EXISTS idx_scripts_parent_version ON backlot_scripts(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_scripts_version_chain ON backlot_scripts(project_id, parent_version_id, version_number);
CREATE INDEX IF NOT EXISTS idx_scripts_current ON backlot_scripts(project_id, is_current) WHERE is_current = TRUE;

-- ============================================================================
-- PHASE 2: Create backlot_script_highlight_breakdowns table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_script_highlight_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES backlot_scripts(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,

  -- Page and text selection
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  start_offset INTEGER NOT NULL, -- Character offset in page text
  end_offset INTEGER NOT NULL,   -- Character offset in page text
  highlighted_text TEXT NOT NULL,

  -- Visual position for rendering
  rect_x NUMERIC(5,4),     -- Normalized 0-1
  rect_y NUMERIC(5,4),     -- Normalized 0-1
  rect_width NUMERIC(5,4), -- Normalized 0-1
  rect_height NUMERIC(5,4),-- Normalized 0-1

  -- Breakdown category (maps to breakdown item types)
  category TEXT NOT NULL CHECK (category IN (
    'cast',           -- Speaking roles (red)
    'background',     -- Background/extras (green)
    'stunt',          -- Stunt performers (orange)
    'location',       -- Location requirements (not typically highlighted)
    'prop',           -- Props (purple)
    'set_dressing',   -- Set dressing items (cyan)
    'wardrobe',       -- Costume/wardrobe (circle/special)
    'makeup',         -- Makeup/hair (asterisk)
    'sfx',            -- Special effects (pink)
    'vfx',            -- Visual effects (pink)
    'vehicle',        -- Vehicles (brown)
    'animal',         -- Animals/handlers (special mark)
    'greenery',       -- Plants/greenery
    'special_equipment', -- Special equipment needs
    'sound',          -- Sound requirements
    'music',          -- Music/playback
    'other'           -- Other
  )),

  -- Display color (hex code for visual consistency)
  color TEXT DEFAULT '#FFFF00',

  -- Extracted/suggested label for breakdown item
  suggested_label TEXT,

  -- Link to created breakdown item (after confirmation)
  breakdown_item_id UUID REFERENCES backlot_scene_breakdown_items(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),

  -- Who created this highlight
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_highlight_breakdowns_script ON backlot_script_highlight_breakdowns(script_id);
CREATE INDEX IF NOT EXISTS idx_highlight_breakdowns_scene ON backlot_script_highlight_breakdowns(scene_id);
CREATE INDEX IF NOT EXISTS idx_highlight_breakdowns_page ON backlot_script_highlight_breakdowns(script_id, page_number);
CREATE INDEX IF NOT EXISTS idx_highlight_breakdowns_category ON backlot_script_highlight_breakdowns(script_id, category);
CREATE INDEX IF NOT EXISTS idx_highlight_breakdowns_status ON backlot_script_highlight_breakdowns(script_id, status);

-- ============================================================================
-- PHASE 3: Create backlot_scene_page_mappings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_scene_page_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES backlot_scripts(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,

  -- Page range for this scene
  page_start INTEGER NOT NULL CHECK (page_start >= 1),
  page_end INTEGER NOT NULL CHECK (page_end >= page_start),

  -- Optional: text bounds within page (for partial pages)
  start_y NUMERIC(5,4), -- Normalized Y position on start page
  end_y NUMERIC(5,4),   -- Normalized Y position on end page

  -- Auto-detected or manual
  mapping_source TEXT DEFAULT 'manual' CHECK (mapping_source IN ('auto', 'manual', 'ai')),

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(script_id, scene_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scene_page_mappings_script ON backlot_scene_page_mappings(script_id);
CREATE INDEX IF NOT EXISTS idx_scene_page_mappings_scene ON backlot_scene_page_mappings(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_page_mappings_pages ON backlot_scene_page_mappings(script_id, page_start, page_end);

-- ============================================================================
-- PHASE 4: Enable RLS on new tables
-- ============================================================================

ALTER TABLE backlot_script_highlight_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_scene_page_mappings ENABLE ROW LEVEL SECURITY;

-- Highlight breakdowns policies
CREATE POLICY "Members can view highlight breakdowns"
  ON backlot_script_highlight_breakdowns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND is_backlot_project_member(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can create highlight breakdowns"
  ON backlot_script_highlight_breakdowns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Editors can update highlight breakdowns"
  ON backlot_script_highlight_breakdowns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete highlight breakdowns"
  ON backlot_script_highlight_breakdowns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

-- Scene page mappings policies
CREATE POLICY "Members can view scene page mappings"
  ON backlot_scene_page_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND is_backlot_project_member(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can create scene page mappings"
  ON backlot_scene_page_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can update scene page mappings"
  ON backlot_scene_page_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete scene page mappings"
  ON backlot_scene_page_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scripts s
      WHERE s.id = script_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

-- ============================================================================
-- PHASE 5: Create updated_at triggers
-- ============================================================================

CREATE TRIGGER backlot_script_highlight_breakdowns_updated_at
  BEFORE UPDATE ON backlot_script_highlight_breakdowns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER backlot_scene_page_mappings_updated_at
  BEFORE UPDATE ON backlot_scene_page_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 6: Helper functions
-- ============================================================================

-- Function to get script version history
CREATE OR REPLACE FUNCTION get_script_version_history(p_script_id UUID)
RETURNS TABLE (
  id UUID,
  version TEXT,
  version_number INTEGER,
  color_code TEXT,
  is_current BOOLEAN,
  is_locked BOOLEAN,
  revision_notes TEXT,
  created_at TIMESTAMPTZ,
  created_by_user_id UUID
) AS $$
DECLARE
  v_root_id UUID;
BEGIN
  -- Find the root of the version chain
  SELECT COALESCE(
    (WITH RECURSIVE chain AS (
      SELECT s.id, s.parent_version_id
      FROM backlot_scripts s
      WHERE s.id = p_script_id
      UNION ALL
      SELECT s.id, s.parent_version_id
      FROM backlot_scripts s
      JOIN chain c ON s.id = c.parent_version_id
    )
    SELECT id FROM chain WHERE parent_version_id IS NULL),
    p_script_id
  ) INTO v_root_id;

  -- Get all versions in the chain
  RETURN QUERY
  WITH RECURSIVE version_tree AS (
    SELECT s.id, s.version, s.version_number, s.color_code, s.is_current, s.is_locked,
           s.revision_notes, s.created_at, s.created_by_user_id, s.parent_version_id
    FROM backlot_scripts s
    WHERE s.id = v_root_id
    UNION ALL
    SELECT s.id, s.version, s.version_number, s.color_code, s.is_current, s.is_locked,
           s.revision_notes, s.created_at, s.created_by_user_id, s.parent_version_id
    FROM backlot_scripts s
    JOIN version_tree vt ON s.parent_version_id = vt.id
  )
  SELECT vt.id, vt.version, vt.version_number, vt.color_code, vt.is_current, vt.is_locked,
         vt.revision_notes, vt.created_at, vt.created_by_user_id
  FROM version_tree vt
  ORDER BY vt.version_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_script_version_history TO authenticated;

-- Function to get highlight breakdown summary by category
CREATE OR REPLACE FUNCTION get_script_highlight_summary(p_script_id UUID)
RETURNS TABLE (
  category TEXT,
  total_count BIGINT,
  pending_count BIGINT,
  confirmed_count BIGINT,
  labels TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.category,
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE h.status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE h.status = 'confirmed')::BIGINT as confirmed_count,
    ARRAY_AGG(DISTINCT COALESCE(h.suggested_label, h.highlighted_text) ORDER BY COALESCE(h.suggested_label, h.highlighted_text)) as labels
  FROM backlot_script_highlight_breakdowns h
  WHERE h.script_id = p_script_id
  GROUP BY h.category
  ORDER BY h.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_script_highlight_summary TO authenticated;

-- Standard industry color codes for script revisions
COMMENT ON COLUMN backlot_scripts.color_code IS 'Industry standard revision colors: white (first draft), blue, pink, yellow, green, goldenrod, buff, salmon, cherry, tan, gray, ivory';

-- ============================================================================
-- PHASE 7: Comments
-- ============================================================================

COMMENT ON TABLE backlot_script_highlight_breakdowns IS 'Text highlights on script pages that create breakdown items';
COMMENT ON TABLE backlot_scene_page_mappings IS 'Maps scenes to their page ranges in the script PDF';

COMMENT ON COLUMN backlot_script_highlight_breakdowns.category IS 'Breakdown category - determines highlight color and breakdown item type';
COMMENT ON COLUMN backlot_script_highlight_breakdowns.suggested_label IS 'Extracted or AI-suggested label for the breakdown item';
COMMENT ON COLUMN backlot_scene_page_mappings.mapping_source IS 'How this mapping was created: auto (from import), manual (user set), or ai (AI detected)';
