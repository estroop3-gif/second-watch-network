-- Migration 171: Add created_by column to call sheets
-- Tracks which user created the call sheet

ALTER TABLE backlot_call_sheets
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Add comment for documentation
COMMENT ON COLUMN backlot_call_sheets.created_by IS 'User who created this call sheet';
