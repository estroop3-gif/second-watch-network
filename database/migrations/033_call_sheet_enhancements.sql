-- Migration 033: Call Sheet Enhancements
-- Adds new template-specific fields and crew presets table

-- ============================================
-- PART 1: New template-specific fields for call sheets
-- ============================================

-- Privacy/Compliance fields (Medical/Corporate template)
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS hipaa_officer TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS privacy_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS release_status TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS restricted_areas TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS dress_code TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS facility_contact TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS facility_phone TEXT;

-- News/ENG specific fields
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS deadline_time TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS story_angle TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS reporter_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS reporter_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS subject_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS location_2_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS location_2_address TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS location_3_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS location_3_address TEXT;

-- Live Event/Multi-cam specific fields
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS load_in_time TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS rehearsal_time TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS doors_time TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS intermission_time TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS strike_time TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS truck_location TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS video_village TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS comm_channel TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS td_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS td_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS stage_manager_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS stage_manager_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS camera_plot TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS show_rundown TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS rain_plan TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS client_notes TEXT;

-- Additional department notes for specific templates
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS broadcast_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS playback_notes TEXT;

-- ============================================
-- PART 2: Crew Presets table
-- ============================================

CREATE TABLE IF NOT EXISTS backlot_crew_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership: either project-level OR user-level
  project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Preset metadata
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT,  -- Optional: feature, documentary, music_video, commercial, etc.

  -- Crew configuration stored as JSONB array
  -- Format: [{
  --   name: string,
  --   role: string,
  --   department: string,
  --   default_call_time: string (HH:MM),
  --   phone?: string,
  --   email?: string,
  --   is_cast?: boolean,
  --   cast_number?: string,
  --   character_name?: string
  -- }]
  crew_members JSONB NOT NULL DEFAULT '[]',

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: must have either project_id OR user_id (at least one, can have both)
  CONSTRAINT crew_preset_ownership CHECK (project_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Indexes for crew presets
CREATE INDEX IF NOT EXISTS idx_crew_presets_project ON backlot_crew_presets(project_id);
CREATE INDEX IF NOT EXISTS idx_crew_presets_user ON backlot_crew_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_presets_template ON backlot_crew_presets(template_type);

-- ============================================
-- PART 3: Row Level Security for crew presets
-- ============================================

ALTER TABLE backlot_crew_presets ENABLE ROW LEVEL SECURITY;

-- Users can view presets they own or belong to projects they have access to
CREATE POLICY "crew_presets_select" ON backlot_crew_presets
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR project_id IN (
      SELECT project_id FROM backlot_project_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert presets for themselves or projects they can edit
CREATE POLICY "crew_presets_insert" ON backlot_crew_presets
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR project_id IN (
      SELECT project_id FROM backlot_project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- Users can update their own presets or project presets if they have edit access
CREATE POLICY "crew_presets_update" ON backlot_crew_presets
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR project_id IN (
      SELECT project_id FROM backlot_project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- Users can delete their own presets or project presets if they have edit access
CREATE POLICY "crew_presets_delete" ON backlot_crew_presets
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR project_id IN (
      SELECT project_id FROM backlot_project_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- PART 4: Updated_at trigger for crew presets
-- ============================================

CREATE OR REPLACE FUNCTION update_crew_preset_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crew_presets_updated_at ON backlot_crew_presets;
CREATE TRIGGER crew_presets_updated_at
  BEFORE UPDATE ON backlot_crew_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_crew_preset_updated_at();
