-- Migration 172: Add set_name column to call sheet scenes
-- Stores the set/location name for each scene in a call sheet

ALTER TABLE backlot_call_sheet_scenes
  ADD COLUMN IF NOT EXISTS set_name VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN backlot_call_sheet_scenes.set_name IS 'Set or location name for the scene';
