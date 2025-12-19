-- Migration 034: Call Sheet Templates
-- Enables users to save full call sheet configurations as reusable templates (account-level)

-- ============================================
-- PART 1: Call Sheet Templates table
-- ============================================

CREATE TABLE IF NOT EXISTS backlot_call_sheet_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership: user-level only (personal templates accessible across all projects)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT,  -- feature, documentary, music_video, commercial, medical_corporate, news_eng, live_event

  -- Full call sheet data stored as JSONB
  -- Contains all form fields except project-specific IDs
  -- Includes: title, timing, contacts, department notes, schedule blocks, custom contacts,
  -- weather, safety, locations (without IDs), scenes (without IDs), people (without IDs)
  call_sheet_data JSONB NOT NULL DEFAULT '{}',

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 2: Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_call_sheet_templates_user ON backlot_call_sheet_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_templates_type ON backlot_call_sheet_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_call_sheet_templates_use_count ON backlot_call_sheet_templates(use_count DESC);

-- ============================================
-- PART 3: Row Level Security
-- ============================================

ALTER TABLE backlot_call_sheet_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own templates
CREATE POLICY "call_sheet_templates_select" ON backlot_call_sheet_templates
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can only create templates for themselves
CREATE POLICY "call_sheet_templates_insert" ON backlot_call_sheet_templates
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own templates
CREATE POLICY "call_sheet_templates_update" ON backlot_call_sheet_templates
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can only delete their own templates
CREATE POLICY "call_sheet_templates_delete" ON backlot_call_sheet_templates
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- PART 4: Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_call_sheet_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS call_sheet_templates_updated_at ON backlot_call_sheet_templates;
CREATE TRIGGER call_sheet_templates_updated_at
  BEFORE UPDATE ON backlot_call_sheet_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_call_sheet_template_updated_at();
