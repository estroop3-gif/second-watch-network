-- Migration 144: Allow creating new per diem entries when previous one was rejected/denied
-- The original UNIQUE constraint prevents creating a new entry even if the old one was rejected.
-- We replace it with a partial unique index that only enforces uniqueness for active entries.

-- Drop the existing unique constraint
ALTER TABLE backlot_per_diem DROP CONSTRAINT IF EXISTS backlot_per_diem_project_id_user_id_date_meal_type_key;

-- Create a partial unique index that only applies to non-rejected/denied entries
-- This allows creating new entries for the same date/meal_type if the previous one was rejected or denied
CREATE UNIQUE INDEX IF NOT EXISTS backlot_per_diem_active_unique
ON backlot_per_diem (project_id, user_id, date, meal_type)
WHERE status NOT IN ('rejected', 'denied');

-- Add comment explaining the constraint
COMMENT ON INDEX backlot_per_diem_active_unique IS 'Prevents duplicate active per diem claims for the same date/meal_type. Rejected/denied claims can be replaced.';
