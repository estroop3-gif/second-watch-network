-- Add reported_stage column to gear_incidents
-- Tracks where damage was reported: checkout, checkin, work_order, inventory

ALTER TABLE gear_incidents
ADD COLUMN IF NOT EXISTS reported_stage TEXT DEFAULT 'checkout';

-- Add check constraint for valid values
ALTER TABLE gear_incidents
ADD CONSTRAINT gear_incidents_reported_stage_check
CHECK (reported_stage IN ('checkout', 'checkin', 'work_order', 'inventory'));

-- Add index for filtering by stage
CREATE INDEX IF NOT EXISTS idx_gear_incidents_reported_stage
ON gear_incidents(reported_stage);

-- Update existing records to have 'checkout' as default (already set by default)
-- No data migration needed since DEFAULT 'checkout' handles it

COMMENT ON COLUMN gear_incidents.reported_stage IS 'Where damage was reported: checkout, checkin, work_order, inventory';
