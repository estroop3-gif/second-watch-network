-- Migration: Make page_number nullable for text-based script viewer highlights
-- The text-based viewer uses character offsets instead of page numbers

ALTER TABLE backlot_script_highlight_breakdowns
ALTER COLUMN page_number DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN backlot_script_highlight_breakdowns.page_number IS 
'Page number where highlight appears. NULL for text-based viewer highlights (which use start_offset/end_offset instead).';
