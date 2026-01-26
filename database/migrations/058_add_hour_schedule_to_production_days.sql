-- Migration: Add hour schedule support to production days
-- Enables hour-by-hour schedule generation with scene timing and activity blocks

-- Add hour_schedule column to production days (JSONB array of schedule blocks)
ALTER TABLE backlot_production_days
ADD COLUMN IF NOT EXISTS hour_schedule JSONB DEFAULT '[]';

-- Add schedule configuration (pages per hour, meal rules, etc.)
ALTER TABLE backlot_production_days
ADD COLUMN IF NOT EXISTS schedule_config JSONB DEFAULT NULL;

-- Track when hour schedule was last updated for sync purposes
ALTER TABLE backlot_production_days
ADD COLUMN IF NOT EXISTS hour_schedule_updated_at TIMESTAMPTZ;

-- Track when call sheet schedule blocks were last updated for bidirectional sync
ALTER TABLE backlot_call_sheets
ADD COLUMN IF NOT EXISTS schedule_blocks_updated_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN backlot_production_days.hour_schedule IS 'Hour-by-hour schedule blocks (scenes, activities, meals, etc.)';
COMMENT ON COLUMN backlot_production_days.schedule_config IS 'Configuration used to generate the schedule (pages_per_hour, meal_rules, etc.)';
COMMENT ON COLUMN backlot_production_days.hour_schedule_updated_at IS 'Timestamp of last hour schedule modification for sync tracking';
COMMENT ON COLUMN backlot_call_sheets.schedule_blocks_updated_at IS 'Timestamp of last schedule_blocks modification for sync tracking';

-- Create trigger function to auto-update hour_schedule_updated_at
CREATE OR REPLACE FUNCTION update_hour_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.hour_schedule IS DISTINCT FROM NEW.hour_schedule) THEN
        NEW.hour_schedule_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for production days
DROP TRIGGER IF EXISTS trigger_hour_schedule_updated_at ON backlot_production_days;
CREATE TRIGGER trigger_hour_schedule_updated_at
    BEFORE UPDATE ON backlot_production_days
    FOR EACH ROW
    EXECUTE FUNCTION update_hour_schedule_timestamp();

-- Create trigger function for call sheet schedule_blocks
CREATE OR REPLACE FUNCTION update_schedule_blocks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.schedule_blocks IS DISTINCT FROM NEW.schedule_blocks) THEN
        NEW.schedule_blocks_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for call sheets
DROP TRIGGER IF EXISTS trigger_schedule_blocks_updated_at ON backlot_call_sheets;
CREATE TRIGGER trigger_schedule_blocks_updated_at
    BEFORE UPDATE ON backlot_call_sheets
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_blocks_timestamp();
