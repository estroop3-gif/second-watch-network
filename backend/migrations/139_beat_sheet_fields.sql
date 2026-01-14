-- Enhanced beat fields for professional beat sheets
-- Adds page range, emotional tone, and primary character focus

-- Add page range fields
ALTER TABLE backlot_story_beats
ADD COLUMN IF NOT EXISTS page_start INTEGER,
ADD COLUMN IF NOT EXISTS page_end INTEGER;

-- Add emotional tone field
ALTER TABLE backlot_story_beats
ADD COLUMN IF NOT EXISTS emotional_tone TEXT;

-- Add primary character focus
ALTER TABLE backlot_story_beats
ADD COLUMN IF NOT EXISTS primary_character_id UUID REFERENCES backlot_story_characters(id) ON DELETE SET NULL;

-- Index for character lookup
CREATE INDEX IF NOT EXISTS idx_story_beats_primary_character ON backlot_story_beats(primary_character_id);
