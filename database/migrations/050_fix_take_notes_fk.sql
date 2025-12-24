-- =====================================================
-- Migration 050: Fix Take Notes Foreign Key
-- Add scripty_take_id to reference backlot_takes (script supervisor takes)
-- Keep existing take_id for backward compatibility with backlot_slate_logs
-- =====================================================

-- Add scripty_take_id column for script supervisor takes
ALTER TABLE backlot_take_notes
  ADD COLUMN IF NOT EXISTS scripty_take_id UUID REFERENCES backlot_takes(id) ON DELETE CASCADE;

-- Make take_id nullable (it was NOT NULL before)
-- This allows notes to be linked to either slate_logs OR backlot_takes
ALTER TABLE backlot_take_notes
  ALTER COLUMN take_id DROP NOT NULL;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_take_notes_scripty_take ON backlot_take_notes(scripty_take_id);

-- Add a check constraint to ensure at least one FK is set
-- (either take_id for camera dept OR scripty_take_id for script supervisor)
ALTER TABLE backlot_take_notes
  DROP CONSTRAINT IF EXISTS take_notes_at_least_one_take;

ALTER TABLE backlot_take_notes
  ADD CONSTRAINT take_notes_at_least_one_take
  CHECK (take_id IS NOT NULL OR scripty_take_id IS NOT NULL);
