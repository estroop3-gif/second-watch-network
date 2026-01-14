-- Migration 149: Add require_mileage_locations to expense settings
-- This allows projects to require start/end addresses for mileage entries

ALTER TABLE backlot_project_expense_settings
ADD COLUMN IF NOT EXISTS require_mileage_locations BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN backlot_project_expense_settings.require_mileage_locations IS 'Whether to require start and end addresses for mileage entries';
