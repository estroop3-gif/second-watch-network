-- Migration: 011_script_breakdown.sql
-- Description: Add script breakdown system - the spine of Backlot production management
-- Date: 2025-12-06

-- ============================================================================
-- PHASE 1: Create backlot_scripts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Script info
  title TEXT NOT NULL,
  file_url TEXT, -- PDF or FDX file URL
  format TEXT CHECK (format IN ('pdf', 'fdx', 'fountain', 'manual')), -- Script format
  version TEXT, -- "Draft 1", "Final", etc.

  -- Parsing status
  parse_status TEXT DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsing', 'completed', 'failed', 'manual')),
  parse_error TEXT,

  -- Stats (auto-calculated)
  total_scenes INTEGER DEFAULT 0,
  total_pages NUMERIC(6,2) DEFAULT 0,

  -- Meta
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Create backlot_scenes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  script_id UUID REFERENCES backlot_scripts(id) ON DELETE CASCADE,

  -- Scene identification
  scene_number TEXT NOT NULL, -- Supports "1", "1A", "2B", etc.
  slugline TEXT, -- "INT. WAREHOUSE - NIGHT"
  description TEXT, -- Scene summary/action

  -- Page tracking
  page_length NUMERIC(6,3) DEFAULT 0, -- Pages as decimal (1.125 = 1 1/8 page)
  page_start NUMERIC(6,2), -- Starting page number
  page_end NUMERIC(6,2), -- Ending page number

  -- Location hints (for linking to locations later)
  location_hint TEXT, -- Raw location from slugline
  int_ext TEXT CHECK (int_ext IN ('INT', 'EXT', 'INT/EXT', 'EXT/INT')),
  day_night TEXT CHECK (day_night IN ('DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER', 'SAME')),

  -- Linked location (optional, set by user)
  location_id UUID REFERENCES backlot_locations(id) ON DELETE SET NULL,

  -- Ordering
  sequence INTEGER NOT NULL DEFAULT 0,

  -- Coverage tracking
  is_scheduled BOOLEAN DEFAULT FALSE,
  is_shot BOOLEAN DEFAULT FALSE,
  needs_pickup BOOLEAN DEFAULT FALSE,
  pickup_notes TEXT,

  -- Scheduling info
  scheduled_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,
  shot_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,

  -- Notes
  director_notes TEXT,
  ad_notes TEXT,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 3: Create backlot_scene_breakdown_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_scene_breakdown_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,

  -- Breakdown item type
  type TEXT NOT NULL CHECK (type IN (
    'cast',           -- Speaking roles
    'background',     -- Background/extras
    'stunt',          -- Stunt performers
    'location',       -- Location requirements
    'prop',           -- Props
    'set_dressing',   -- Set dressing items
    'wardrobe',       -- Costume/wardrobe
    'makeup',         -- Makeup/hair
    'sfx',            -- Special effects (practical)
    'vfx',            -- Visual effects
    'vehicle',        -- Vehicles
    'animal',         -- Animals/handlers
    'greenery',       -- Plants/greenery
    'special_equipment', -- Special equipment needs
    'sound',          -- Sound requirements
    'music',          -- Music/playback
    'other'           -- Other
  )),

  -- Item details
  label TEXT NOT NULL, -- "Elias", "Police car", "Glass shatter FX"
  quantity INTEGER DEFAULT 1,
  notes TEXT,

  -- Linking to existing entities (optional)
  linked_entity_id UUID, -- For future linking to cast/props/location records
  linked_entity_type TEXT, -- 'cast_member', 'prop_item', 'location', etc.

  -- Task generation tracking
  task_generated BOOLEAN DEFAULT FALSE,
  task_id UUID, -- Reference to generated task

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 4: Create backlot_budget_suggestions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_budget_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Source reference
  scene_id UUID REFERENCES backlot_scenes(id) ON DELETE CASCADE,
  breakdown_item_id UUID REFERENCES backlot_scene_breakdown_items(id) ON DELETE CASCADE,

  -- Suggestion details
  suggestion_type TEXT NOT NULL, -- 'prop', 'sfx', 'extra_crew', 'rental', etc.
  department TEXT, -- 'Art', 'Camera', 'Grip', etc.
  description TEXT NOT NULL,
  estimated_amount NUMERIC(12,2),
  notes TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'deferred')),
  linked_budget_line_id UUID, -- Reference to created budget line item

  -- Meta
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 5: Create backlot_call_sheet_scene_links junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_call_sheet_scene_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,

  -- Ordering within call sheet
  sequence INTEGER NOT NULL DEFAULT 0,

  -- Override info for this call sheet
  estimated_time_minutes INTEGER, -- Estimated shoot time
  notes TEXT,

  -- Status for this shoot day
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'moved', 'cut')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(call_sheet_id, scene_id)
);

-- ============================================================================
-- PHASE 6: Create indexes
-- ============================================================================

-- Scripts indexes
CREATE INDEX IF NOT EXISTS idx_scripts_project ON backlot_scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_created_by ON backlot_scripts(created_by_user_id);

-- Scenes indexes
CREATE INDEX IF NOT EXISTS idx_scenes_project ON backlot_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_script ON backlot_scenes(script_id);
CREATE INDEX IF NOT EXISTS idx_scenes_sequence ON backlot_scenes(project_id, sequence);
CREATE INDEX IF NOT EXISTS idx_scenes_location ON backlot_scenes(location_id);
CREATE INDEX IF NOT EXISTS idx_scenes_scheduled_day ON backlot_scenes(scheduled_day_id);
CREATE INDEX IF NOT EXISTS idx_scenes_coverage ON backlot_scenes(project_id, is_scheduled, is_shot, needs_pickup);

-- Breakdown items indexes
CREATE INDEX IF NOT EXISTS idx_breakdown_items_scene ON backlot_scene_breakdown_items(scene_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_items_type ON backlot_scene_breakdown_items(scene_id, type);

-- Budget suggestions indexes
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_project ON backlot_budget_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_scene ON backlot_budget_suggestions(scene_id);
CREATE INDEX IF NOT EXISTS idx_budget_suggestions_status ON backlot_budget_suggestions(project_id, status);

-- Call sheet scene links indexes
CREATE INDEX IF NOT EXISTS idx_call_sheet_scene_links_call_sheet ON backlot_call_sheet_scene_links(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_scene_links_scene ON backlot_call_sheet_scene_links(scene_id);

-- ============================================================================
-- PHASE 7: Enable RLS and create policies
-- ============================================================================

ALTER TABLE backlot_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_scene_breakdown_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_budget_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_call_sheet_scene_links ENABLE ROW LEVEL SECURITY;

-- Scripts policies
CREATE POLICY "Members can view scripts"
  ON backlot_scripts FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can manage scripts"
  ON backlot_scripts FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update scripts"
  ON backlot_scripts FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete scripts"
  ON backlot_scripts FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- Scenes policies
CREATE POLICY "Members can view scenes"
  ON backlot_scenes FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can manage scenes"
  ON backlot_scenes FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update scenes"
  ON backlot_scenes FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete scenes"
  ON backlot_scenes FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- Breakdown items policies
CREATE POLICY "Members can view breakdown items"
  ON backlot_scene_breakdown_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scenes s
      WHERE s.id = scene_id
      AND is_backlot_project_member(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can manage breakdown items"
  ON backlot_scene_breakdown_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_scenes s
      WHERE s.id = scene_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can update breakdown items"
  ON backlot_scene_breakdown_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scenes s
      WHERE s.id = scene_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete breakdown items"
  ON backlot_scene_breakdown_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_scenes s
      WHERE s.id = scene_id
      AND can_edit_backlot_project(s.project_id, auth.uid())
    )
  );

-- Budget suggestions policies
CREATE POLICY "Members can view budget suggestions"
  ON backlot_budget_suggestions FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can manage budget suggestions"
  ON backlot_budget_suggestions FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update budget suggestions"
  ON backlot_budget_suggestions FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete budget suggestions"
  ON backlot_budget_suggestions FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- Call sheet scene links policies
CREATE POLICY "Members can view call sheet scene links"
  ON backlot_call_sheet_scene_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND is_backlot_project_member(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can manage call sheet scene links"
  ON backlot_call_sheet_scene_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can update call sheet scene links"
  ON backlot_call_sheet_scene_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete call sheet scene links"
  ON backlot_call_sheet_scene_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

-- ============================================================================
-- PHASE 8: Create updated_at triggers
-- ============================================================================

CREATE TRIGGER backlot_scripts_updated_at
  BEFORE UPDATE ON backlot_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER backlot_scenes_updated_at
  BEFORE UPDATE ON backlot_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER backlot_scene_breakdown_items_updated_at
  BEFORE UPDATE ON backlot_scene_breakdown_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER backlot_budget_suggestions_updated_at
  BEFORE UPDATE ON backlot_budget_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 9: Helper functions
-- ============================================================================

-- Function to get scene coverage stats for a project
CREATE OR REPLACE FUNCTION get_project_scene_coverage(p_project_id UUID)
RETURNS TABLE (
  total_scenes BIGINT,
  total_pages NUMERIC,
  scenes_scheduled BIGINT,
  pages_scheduled NUMERIC,
  scenes_shot BIGINT,
  pages_shot NUMERIC,
  scenes_pickup BIGINT,
  pages_pickup NUMERIC,
  scenes_remaining BIGINT,
  pages_remaining NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_scenes,
    COALESCE(SUM(page_length), 0) as total_pages,
    COUNT(*) FILTER (WHERE is_scheduled)::BIGINT as scenes_scheduled,
    COALESCE(SUM(page_length) FILTER (WHERE is_scheduled), 0) as pages_scheduled,
    COUNT(*) FILTER (WHERE is_shot)::BIGINT as scenes_shot,
    COALESCE(SUM(page_length) FILTER (WHERE is_shot), 0) as pages_shot,
    COUNT(*) FILTER (WHERE needs_pickup)::BIGINT as scenes_pickup,
    COALESCE(SUM(page_length) FILTER (WHERE needs_pickup), 0) as pages_pickup,
    COUNT(*) FILTER (WHERE NOT is_shot AND NOT needs_pickup)::BIGINT as scenes_remaining,
    COALESCE(SUM(page_length) FILTER (WHERE NOT is_shot AND NOT needs_pickup), 0) as pages_remaining
  FROM backlot_scenes
  WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_project_scene_coverage TO authenticated;

-- Function to get breakdown summary for a scene
CREATE OR REPLACE FUNCTION get_scene_breakdown_summary(p_scene_id UUID)
RETURNS TABLE (
  type TEXT,
  count BIGINT,
  items TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.type,
    COUNT(*)::BIGINT,
    ARRAY_AGG(bi.label ORDER BY bi.label)
  FROM backlot_scene_breakdown_items bi
  WHERE bi.scene_id = p_scene_id
  GROUP BY bi.type
  ORDER BY bi.type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_scene_breakdown_summary TO authenticated;

-- Function to get location needs grouped by location hint
CREATE OR REPLACE FUNCTION get_project_location_needs(p_project_id UUID)
RETURNS TABLE (
  location_hint TEXT,
  int_ext TEXT,
  day_night TEXT,
  scene_count BIGINT,
  total_pages NUMERIC,
  scene_numbers TEXT[],
  linked_location_id UUID,
  linked_location_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.location_hint,
    s.int_ext,
    s.day_night,
    COUNT(*)::BIGINT as scene_count,
    COALESCE(SUM(s.page_length), 0) as total_pages,
    ARRAY_AGG(s.scene_number ORDER BY s.sequence) as scene_numbers,
    s.location_id as linked_location_id,
    l.name as linked_location_name
  FROM backlot_scenes s
  LEFT JOIN backlot_locations l ON l.id = s.location_id
  WHERE s.project_id = p_project_id
    AND s.location_hint IS NOT NULL
  GROUP BY s.location_hint, s.int_ext, s.day_night, s.location_id, l.name
  ORDER BY scene_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_project_location_needs TO authenticated;

-- ============================================================================
-- PHASE 10: Comments for documentation
-- ============================================================================

COMMENT ON TABLE backlot_scripts IS 'Script files imported into a project for breakdown';
COMMENT ON TABLE backlot_scenes IS 'Individual scenes extracted from scripts with coverage tracking';
COMMENT ON TABLE backlot_scene_breakdown_items IS 'Breakdown elements (cast, props, etc.) for each scene';
COMMENT ON TABLE backlot_budget_suggestions IS 'Auto-generated budget suggestions from breakdown analysis';
COMMENT ON TABLE backlot_call_sheet_scene_links IS 'Links scenes to call sheets for scheduling';

COMMENT ON COLUMN backlot_scenes.scene_number IS 'Scene number supporting A/B/C suffixes (e.g., "1A", "23B")';
COMMENT ON COLUMN backlot_scenes.page_length IS 'Scene length in pages as decimal (e.g., 1.125 = 1 1/8 page)';
COMMENT ON COLUMN backlot_scenes.is_scheduled IS 'True when scene is assigned to a production day';
COMMENT ON COLUMN backlot_scenes.is_shot IS 'True when scene has been filmed';
COMMENT ON COLUMN backlot_scenes.needs_pickup IS 'True when scene needs additional coverage/pickup shots';
