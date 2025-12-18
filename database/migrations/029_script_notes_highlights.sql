-- Migration: 029_script_notes_highlights.sql
-- Description: Add script breakdown items, page notes, and highlight breakdowns for AWS RDS
-- Date: 2025-12-18

-- ============================================================================
-- PHASE 1: Create backlot_scene_breakdown_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_scene_breakdown_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,

  -- Breakdown item type
  type TEXT NOT NULL CHECK (type IN (
    'cast', 'background', 'stunt', 'location', 'prop', 'set_dressing',
    'wardrobe', 'makeup', 'sfx', 'vfx', 'vehicle', 'animal',
    'greenery', 'special_equipment', 'sound', 'music', 'other'
  )),

  -- Item details
  label TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  notes TEXT,

  -- Linking to existing entities (optional)
  linked_entity_id UUID,
  linked_entity_type TEXT,

  -- Task generation tracking
  task_generated BOOLEAN DEFAULT FALSE,
  task_id UUID,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_breakdown_items_scene ON backlot_scene_breakdown_items(scene_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_items_type ON backlot_scene_breakdown_items(scene_id, type);

-- Trigger
DROP TRIGGER IF EXISTS backlot_scene_breakdown_items_updated_at ON backlot_scene_breakdown_items;
CREATE TRIGGER backlot_scene_breakdown_items_updated_at
  BEFORE UPDATE ON backlot_scene_breakdown_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 2: Create backlot_budget_suggestions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_budget_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Source reference
  scene_id UUID REFERENCES backlot_scenes(id) ON DELETE CASCADE,
  breakdown_item_id UUID REFERENCES backlot_scene_breakdown_items(id) ON DELETE CASCADE,

  -- Suggestion details
  suggestion_type TEXT NOT NULL,
  department TEXT,
  description TEXT NOT NULL,
  estimated_amount NUMERIC(12,2),
  notes TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'deferred')),
  linked_budget_line_id UUID,

  -- Meta
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_project ON backlot_budget_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_scene ON backlot_budget_suggestions(scene_id);
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_status ON backlot_budget_suggestions(project_id, status);

-- Trigger
DROP TRIGGER IF EXISTS backlot_budget_suggestions_updated_at ON backlot_budget_suggestions;
CREATE TRIGGER backlot_budget_suggestions_updated_at
  BEFORE UPDATE ON backlot_budget_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 3: Create backlot_script_page_notes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_script_page_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES backlot_scripts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Page and position
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  position_x NUMERIC(5,4) CHECK (position_x >= 0 AND position_x <= 1),
  position_y NUMERIC(5,4) CHECK (position_y >= 0 AND position_y <= 1),

  -- Note content
  note_text TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN (
    'general', 'direction', 'production', 'character', 'blocking',
    'camera', 'continuity', 'sound', 'vfx', 'prop', 'wardrobe',
    'makeup', 'location', 'safety', 'other'
  )),

  -- Optional scene link
  scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,

  -- Status
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Author
  author_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_script_page_notes_script ON backlot_script_page_notes(script_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_project ON backlot_script_page_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_page ON backlot_script_page_notes(script_id, page_number);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_author ON backlot_script_page_notes(author_user_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_scene ON backlot_script_page_notes(scene_id);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_type ON backlot_script_page_notes(script_id, note_type);
CREATE INDEX IF NOT EXISTS idx_script_page_notes_resolved ON backlot_script_page_notes(script_id, resolved);

-- Trigger
DROP TRIGGER IF EXISTS backlot_script_page_notes_updated_at ON backlot_script_page_notes;
CREATE TRIGGER backlot_script_page_notes_updated_at
  BEFORE UPDATE ON backlot_script_page_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 4: Create backlot_script_highlight_breakdowns table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_script_highlight_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES backlot_scripts(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,

  -- Page and text selection
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  highlighted_text TEXT NOT NULL,

  -- Visual position for rendering
  rect_x NUMERIC(5,4),
  rect_y NUMERIC(5,4),
  rect_width NUMERIC(5,4),
  rect_height NUMERIC(5,4),

  -- Breakdown category
  category TEXT NOT NULL CHECK (category IN (
    'cast', 'background', 'stunt', 'location', 'prop', 'set_dressing',
    'wardrobe', 'makeup', 'sfx', 'vfx', 'vehicle', 'animal',
    'greenery', 'special_equipment', 'sound', 'music', 'other'
  )),

  -- Display color
  color TEXT DEFAULT '#FFFF00',

  -- Extracted/suggested label
  suggested_label TEXT,

  -- Link to created breakdown item
  breakdown_item_id UUID REFERENCES backlot_scene_breakdown_items(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),

  -- Who created this highlight
  created_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

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

-- Trigger
DROP TRIGGER IF EXISTS backlot_script_highlight_breakdowns_updated_at ON backlot_script_highlight_breakdowns;
CREATE TRIGGER backlot_script_highlight_breakdowns_updated_at
  BEFORE UPDATE ON backlot_script_highlight_breakdowns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 5: Create backlot_scene_page_mappings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_scene_page_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES backlot_scripts(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,

  -- Page range for this scene
  page_start INTEGER NOT NULL CHECK (page_start >= 1),
  page_end INTEGER NOT NULL CHECK (page_end >= page_start),

  -- Optional: text bounds within page
  start_y NUMERIC(5,4),
  end_y NUMERIC(5,4),

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

-- Trigger
DROP TRIGGER IF EXISTS backlot_scene_page_mappings_updated_at ON backlot_scene_page_mappings;
CREATE TRIGGER backlot_scene_page_mappings_updated_at
  BEFORE UPDATE ON backlot_scene_page_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 6: Add versioning columns to backlot_scripts if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'parent_version_id'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN parent_version_id UUID REFERENCES backlot_scripts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'version_number'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN version_number INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'color_code'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN color_code TEXT DEFAULT 'white';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'revision_notes'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN revision_notes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'locked_by_user_id'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN locked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'is_current'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN is_current BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'text_content'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN text_content TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scripts' AND column_name = 'page_count'
  ) THEN
    ALTER TABLE backlot_scripts ADD COLUMN page_count INTEGER;
  END IF;
END $$;

-- Script version indexes
CREATE INDEX IF NOT EXISTS idx_scripts_parent_version ON backlot_scripts(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_scripts_version_chain ON backlot_scripts(project_id, parent_version_id, version_number);
CREATE INDEX IF NOT EXISTS idx_scripts_current ON backlot_scripts(project_id, is_current) WHERE is_current = TRUE;

-- ============================================================================
-- PHASE 7: Add additional columns to backlot_scenes if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'set_name'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN set_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'synopsis'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN synopsis TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'time_of_day'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN time_of_day TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'page_count'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN page_count NUMERIC(6,3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'is_omitted'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN is_omitted BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'coverage_status'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN coverage_status TEXT DEFAULT 'not_scheduled' CHECK (coverage_status IN ('not_scheduled', 'scheduled', 'shot', 'needs_pickup'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backlot_scenes' AND column_name = 'breakdown_count'
  ) THEN
    ALTER TABLE backlot_scenes ADD COLUMN breakdown_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- PHASE 8: Comments
-- ============================================================================

COMMENT ON TABLE backlot_scene_breakdown_items IS 'Breakdown elements (cast, props, etc.) for each scene';
COMMENT ON TABLE backlot_budget_suggestions IS 'Auto-generated budget suggestions from breakdown analysis';
COMMENT ON TABLE backlot_script_page_notes IS 'Annotations/notes on script PDF pages, positioned at specific coordinates';
COMMENT ON TABLE backlot_script_highlight_breakdowns IS 'Text highlights on script pages that create breakdown items';
COMMENT ON TABLE backlot_scene_page_mappings IS 'Maps scenes to their page ranges in the script PDF';
