-- Migration 032: Add visibility column to backlot_locations
-- Allows locations to be: public (in library), unlisted (link only), or private (owner only)

-- Add visibility column
ALTER TABLE backlot_locations
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';

-- Migrate existing data: set visibility based on is_public
UPDATE backlot_locations
SET visibility = CASE
    WHEN is_public = true THEN 'public'
    ELSE 'private'
END
WHERE visibility IS NULL;

-- Add check constraint for valid visibility values
ALTER TABLE backlot_locations
DROP CONSTRAINT IF EXISTS backlot_locations_visibility_check;

ALTER TABLE backlot_locations
ADD CONSTRAINT backlot_locations_visibility_check
CHECK (visibility IN ('public', 'unlisted', 'private'));

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_backlot_locations_visibility
ON backlot_locations(visibility);

-- Comment
COMMENT ON COLUMN backlot_locations.visibility IS 'Location visibility: public (in library), unlisted (link only), private (owner only)';
