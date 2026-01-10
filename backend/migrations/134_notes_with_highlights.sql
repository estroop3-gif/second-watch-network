-- Migration 134: Add highlight rectangle to notes
-- Notes now have a highlight area (like highlights) plus note text
-- The anchor_x/anchor_y become the note indicator position

-- Add highlight rectangle fields to notes
ALTER TABLE backlot_continuity_export_notes
ADD COLUMN IF NOT EXISTS x FLOAT,
ADD COLUMN IF NOT EXISTS y FLOAT,
ADD COLUMN IF NOT EXISTS width FLOAT,
ADD COLUMN IF NOT EXISTS height FLOAT,
ADD COLUMN IF NOT EXISTS highlight_color VARCHAR(20) DEFAULT '#FFEB3B';

-- Comment
COMMENT ON COLUMN backlot_continuity_export_notes.x IS 'Highlight rectangle X position (percentage of page width)';
COMMENT ON COLUMN backlot_continuity_export_notes.y IS 'Highlight rectangle Y position (percentage of page height)';
COMMENT ON COLUMN backlot_continuity_export_notes.width IS 'Highlight rectangle width (percentage of page width)';
COMMENT ON COLUMN backlot_continuity_export_notes.height IS 'Highlight rectangle height (percentage of page height)';
COMMENT ON COLUMN backlot_continuity_export_notes.highlight_color IS 'Highlight color for the note area';
