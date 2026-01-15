-- Migration 168: Project Settings for Original Quality Playback
-- Adds settings JSONB column to backlot_projects for project-level settings
-- Primary use: allow_original_playback toggle (off by default to save bandwidth)

-- Add settings JSONB column to backlot_projects if not exists
ALTER TABLE backlot_projects
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Set default allow_original_playback to false for existing projects
UPDATE backlot_projects
SET settings = COALESCE(settings, '{}') || '{"allow_original_playback": false}'::jsonb
WHERE settings IS NULL OR NOT settings ? 'allow_original_playback';

-- Create index on settings for faster queries
CREATE INDEX IF NOT EXISTS idx_backlot_projects_settings
  ON backlot_projects USING gin(settings);

-- Add comment for documentation
COMMENT ON COLUMN backlot_projects.settings IS 'Project-level settings JSONB. Keys: allow_original_playback (bool)';
