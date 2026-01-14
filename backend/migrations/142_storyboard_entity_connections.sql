-- Migration 142: Storyboard Entity Connections
-- Adds scene, shot list, and moodboard links to storyboards and sections
-- Also adds call sheet linking for on-set storyboard access

-- ============================================
-- STORYBOARD ENTITY CONNECTIONS
-- ============================================

-- Add scene_id to storyboards
ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_storyboards_scene ON storyboards(scene_id);

-- Add shot_list_id to storyboards
ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS shot_list_id UUID REFERENCES backlot_shot_lists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_storyboards_shot_list ON storyboards(shot_list_id);

-- Add moodboard_id to storyboards
ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS moodboard_id UUID REFERENCES moodboards(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_storyboards_moodboard ON storyboards(moodboard_id);

-- ============================================
-- SECTION-LEVEL ENTITY CONNECTIONS
-- ============================================

-- Add scene_id to sections (for per-section scene linking)
ALTER TABLE storyboard_sections ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_storyboard_sections_scene ON storyboard_sections(scene_id);

-- Add shot_list_id to sections
ALTER TABLE storyboard_sections ADD COLUMN IF NOT EXISTS shot_list_id UUID REFERENCES backlot_shot_lists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_storyboard_sections_shot_list ON storyboard_sections(shot_list_id);

-- ============================================
-- CALL SHEET STORYBOARD LINKING
-- ============================================

-- Junction table for many-to-many storyboard-to-call-sheet links
CREATE TABLE IF NOT EXISTS storyboard_call_sheet_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT storyboard_call_sheet_unique UNIQUE(storyboard_id, call_sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_storyboard_call_sheet_storyboard ON storyboard_call_sheet_links(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_call_sheet_call_sheet ON storyboard_call_sheet_links(call_sheet_id);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN storyboards.scene_id IS 'Link storyboard to a specific scene for scene-based storyboards';
COMMENT ON COLUMN storyboards.shot_list_id IS 'Link storyboard to a shot list for cross-reference';
COMMENT ON COLUMN storyboards.moodboard_id IS 'Link storyboard to a moodboard for visual reference';
COMMENT ON COLUMN storyboard_sections.scene_id IS 'Optional per-section scene link for multi-scene storyboards';
COMMENT ON COLUMN storyboard_sections.shot_list_id IS 'Optional per-section shot list link';
COMMENT ON TABLE storyboard_call_sheet_links IS 'Links storyboards to call sheets for on-set reference';
