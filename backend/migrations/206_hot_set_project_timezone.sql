-- Add project-level timezone to hot set settings
-- This allows setting a default timezone for all Hot Set sessions in a project

ALTER TABLE backlot_hot_set_settings
ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN backlot_hot_set_settings.timezone IS 'IANA timezone identifier (e.g., America/Los_Angeles) for schedule time comparisons';
