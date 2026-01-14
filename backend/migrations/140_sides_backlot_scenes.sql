-- Migration 140: Add scene_id column to sides packet scenes for backlot scenes support
-- This allows linking sides packets to scenes from the Scenes tab (backlot_scenes)
-- in addition to script scenes (backlot_script_scenes)

ALTER TABLE backlot_sides_packet_scenes
ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE CASCADE;

-- Index for efficient lookup by scene_id
CREATE INDEX IF NOT EXISTS idx_sides_packet_scenes_scene_id
ON backlot_sides_packet_scenes(scene_id);

-- Make script_scene_id nullable since we can now use either
ALTER TABLE backlot_sides_packet_scenes
ALTER COLUMN script_scene_id DROP NOT NULL;
