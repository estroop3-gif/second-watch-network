-- Migration: 052_timecard_live_tracking.sql
-- Description: Add live time tracking fields to timecard entries and project settings
-- Run: 2024-12-24

-- Add live tracking fields to timecard entries
ALTER TABLE backlot_timecard_entries
ADD COLUMN IF NOT EXISTS is_clocked_in BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS clock_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_on_lunch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lunch_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lunch_end_time TIMESTAMPTZ;

-- Add index for finding active clock-ins
CREATE INDEX IF NOT EXISTS idx_timecard_entries_clocked_in
ON backlot_timecard_entries(project_id, is_clocked_in)
WHERE is_clocked_in = TRUE;

-- Add timecard settings to projects
ALTER TABLE backlot_projects
ADD COLUMN IF NOT EXISTS timecard_settings JSONB DEFAULT '{
  "auto_lunch_enabled": true,
  "auto_lunch_minutes": 30,
  "auto_lunch_after_hours": 6,
  "default_day_rate": null,
  "default_hourly_rate": null,
  "ot_threshold_hours": 8,
  "dt_threshold_hours": 12
}'::jsonb;

-- Add rate override fields to timecards (crew rates stored in backlot_crew_rates table)
ALTER TABLE backlot_timecards
ADD COLUMN IF NOT EXISTS rate_type TEXT,
ADD COLUMN IF NOT EXISTS rate_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS rate_currency TEXT DEFAULT 'USD';
