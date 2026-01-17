-- Migration 173: Add missing columns to call sheet scenes
-- The backend code expects these columns that don't exist yet

ALTER TABLE backlot_call_sheet_scenes
  ADD COLUMN IF NOT EXISTS page_count DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS int_ext VARCHAR(10),
  ADD COLUMN IF NOT EXISTS linked_scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;

-- Add index for linked scene lookups
CREATE INDEX IF NOT EXISTS idx_call_sheet_scenes_linked_scene
  ON backlot_call_sheet_scenes(linked_scene_id);

-- Add comments
COMMENT ON COLUMN backlot_call_sheet_scenes.page_count IS 'Page count for this scene';
COMMENT ON COLUMN backlot_call_sheet_scenes.int_ext IS 'INT or EXT indicator';
COMMENT ON COLUMN backlot_call_sheet_scenes.linked_scene_id IS 'Reference to the source scene in backlot_scenes';
