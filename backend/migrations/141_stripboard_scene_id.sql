-- Migration 141: Add scene_id to backlot_strips for schedule/call sheet generation
-- This allows strips to reference scenes from backlot_scenes (schedule) in addition to
-- backlot_script_scenes (script documents)

-- Add scene_id column
ALTER TABLE backlot_strips
ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_backlot_strips_scene_id ON backlot_strips(scene_id);

-- Drop existing constraint if it exists
ALTER TABLE backlot_strips
DROP CONSTRAINT IF EXISTS strip_needs_scene_or_title;

-- Add updated constraint: strip needs at least one source
ALTER TABLE backlot_strips
ADD CONSTRAINT strip_needs_source CHECK (
  script_scene_id IS NOT NULL OR
  scene_id IS NOT NULL OR
  custom_title IS NOT NULL
);
