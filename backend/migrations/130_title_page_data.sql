-- Migration: 130_title_page_data.sql
-- Add title_page_data JSONB column to backlot_scripts for structured title page storage

-- Add the column
ALTER TABLE backlot_scripts
ADD COLUMN IF NOT EXISTS title_page_data JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN backlot_scripts.title_page_data IS 'Structured JSON containing title page metadata (title, authors, contact, draft info, copyright)';

-- Create index for faster queries on title_page_data
CREATE INDEX IF NOT EXISTS idx_backlot_scripts_title_page_data ON backlot_scripts USING gin(title_page_data) WHERE title_page_data IS NOT NULL;
