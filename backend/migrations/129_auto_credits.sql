-- Auto Credits - Auto-generate credits from Crew/Casting
-- Adds columns to track auto-generated credits and project settings

-- Add auto_created flag to track auto-generated credits
ALTER TABLE backlot_project_credits
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT false;

-- Add source_role_id to link credit back to the project role that created it
ALTER TABLE backlot_project_credits
  ADD COLUMN IF NOT EXISTS source_role_id UUID REFERENCES backlot_project_roles(id) ON DELETE SET NULL;

-- Add credit_settings to projects for configuring credit generation
ALTER TABLE backlot_projects
  ADD COLUMN IF NOT EXISTS credit_settings JSONB NOT NULL DEFAULT '{"show_character_name": true}'::jsonb;

-- Index for finding credits by source role (for sync updates)
CREATE INDEX IF NOT EXISTS idx_backlot_project_credits_source_role
  ON backlot_project_credits(source_role_id)
  WHERE source_role_id IS NOT NULL;

-- Index for finding auto-created credits
CREATE INDEX IF NOT EXISTS idx_backlot_project_credits_auto
  ON backlot_project_credits(project_id, auto_created)
  WHERE auto_created = true;

-- Comments for documentation
COMMENT ON COLUMN backlot_project_credits.auto_created IS 'Whether this credit was auto-generated from crew/casting data';
COMMENT ON COLUMN backlot_project_credits.source_role_id IS 'Link to the project role that created this credit (for sync updates)';
COMMENT ON COLUMN backlot_projects.credit_settings IS 'JSON settings for credit generation: {show_character_name: boolean}';
