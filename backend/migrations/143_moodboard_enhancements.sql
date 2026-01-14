-- Migration 143: Moodboard Item Enhancements
-- Adds category, rating, color_palette, and aspect_ratio fields to moodboard_items

-- Add category column for item categorization
ALTER TABLE moodboard_items ADD COLUMN IF NOT EXISTS category TEXT;

-- Add rating column (0-5 stars)
ALTER TABLE moodboard_items ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 0 AND rating <= 5);

-- Add color_palette column for auto-extracted dominant colors (array of hex strings)
ALTER TABLE moodboard_items ADD COLUMN IF NOT EXISTS color_palette JSONB DEFAULT '[]'::jsonb;

-- Add aspect_ratio column for image orientation (landscape, portrait, square)
ALTER TABLE moodboard_items ADD COLUMN IF NOT EXISTS aspect_ratio TEXT;

-- Add index on category for filtering
CREATE INDEX IF NOT EXISTS idx_moodboard_items_category ON moodboard_items(category) WHERE category IS NOT NULL;

-- Add index on rating for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_moodboard_items_rating ON moodboard_items(rating) WHERE rating IS NOT NULL;

COMMENT ON COLUMN moodboard_items.category IS 'Item category: Lighting, Wardrobe, Location, Props, Color, Character, Mood, Other';
COMMENT ON COLUMN moodboard_items.rating IS 'Star rating 0-5';
COMMENT ON COLUMN moodboard_items.color_palette IS 'Array of hex color strings extracted from the image';
COMMENT ON COLUMN moodboard_items.aspect_ratio IS 'Image aspect ratio: landscape, portrait, or square';
