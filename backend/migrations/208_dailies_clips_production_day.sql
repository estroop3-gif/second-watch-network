-- Migration 208: Add production_day_id to dailies clips for direct clip-to-day linking
-- This allows assigning clips directly to production days without going through cards

ALTER TABLE backlot_dailies_clips
  ADD COLUMN IF NOT EXISTS production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dailies_clips_production_day
  ON backlot_dailies_clips(production_day_id);
