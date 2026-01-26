-- Migration 201: Add timezone support to Hot Set sessions
-- Enables proper local time display based on production location

-- 1. Add timezone columns to backlot_hot_set_sessions
ALTER TABLE backlot_hot_set_sessions
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS timezone_offset VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_address TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN backlot_hot_set_sessions.timezone IS 'IANA timezone string e.g. America/Los_Angeles - imported from call sheet or user preference';
COMMENT ON COLUMN backlot_hot_set_sessions.timezone_offset IS 'UTC offset e.g. -08:00';
COMMENT ON COLUMN backlot_hot_set_sessions.location_name IS 'Location name from call sheet for display';
COMMENT ON COLUMN backlot_hot_set_sessions.location_address IS 'Full location address from call sheet';

-- 2. Create index for timezone lookups
CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_timezone
ON backlot_hot_set_sessions(timezone);
