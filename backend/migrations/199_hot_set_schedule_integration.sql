-- Migration: Hot Set Schedule Integration
-- Adds hour schedule import support to Hot Set sessions

-- Add new columns to backlot_hot_set_sessions
ALTER TABLE backlot_hot_set_sessions
ADD COLUMN IF NOT EXISTS imported_schedule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS imported_schedule_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS schedule_import_source VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS schedule_tracking_mode VARCHAR(20) DEFAULT 'auto_reorder';

-- Add expected time columns to backlot_hot_set_scene_logs
ALTER TABLE backlot_hot_set_scene_logs
ADD COLUMN IF NOT EXISTS expected_start_time VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expected_end_time VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expected_duration_minutes INTEGER DEFAULT NULL;

-- Create schedule blocks table for non-scene items (meals, moves, activities)
CREATE TABLE IF NOT EXISTS backlot_hot_set_schedule_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,
    block_type VARCHAR(20) NOT NULL, -- 'meal', 'company_move', 'activity', 'crew_call', 'first_shot', 'wrap'

    -- Expected times from imported schedule
    expected_start_time VARCHAR(10) NOT NULL, -- HH:MM format
    expected_end_time VARCHAR(10) NOT NULL,
    expected_duration_minutes INTEGER NOT NULL,

    -- Actual times
    actual_start_time TIMESTAMPTZ DEFAULT NULL,
    actual_end_time TIMESTAMPTZ DEFAULT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'

    -- Display
    name VARCHAR(255) NOT NULL,
    location_name VARCHAR(255) DEFAULT NULL,
    notes TEXT DEFAULT NULL,

    -- Links
    linked_marker_id UUID DEFAULT NULL REFERENCES backlot_hot_set_markers(id) ON DELETE SET NULL,
    original_schedule_block_id VARCHAR(100) DEFAULT NULL, -- ID from the imported hour_schedule block

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_session_id
ON backlot_hot_set_schedule_blocks(session_id);

CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_status
ON backlot_hot_set_schedule_blocks(status);

CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_sort_order
ON backlot_hot_set_schedule_blocks(session_id, sort_order);

-- Add comment
COMMENT ON TABLE backlot_hot_set_schedule_blocks IS 'Non-scene schedule items (meals, moves, activities) for Hot Set sessions imported from hour schedule';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_hot_set_schedule_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_hot_set_schedule_blocks_updated_at ON backlot_hot_set_schedule_blocks;
CREATE TRIGGER trigger_hot_set_schedule_blocks_updated_at
    BEFORE UPDATE ON backlot_hot_set_schedule_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_schedule_blocks_updated_at();
