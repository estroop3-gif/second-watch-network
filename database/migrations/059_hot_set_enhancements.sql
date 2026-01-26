-- Migration: 059_hot_set_enhancements.sql
-- Description: Hot Set System Rework - Auto-start, dual variance tracking, notifications, settings
-- Created: 2026-01-26
-- Related to: 043_hot_set_system.sql

-- ============================================================================
-- HOT SET SETTINGS
-- Project-level configuration for Hot Set features
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Auto-start Configuration
    auto_start_enabled BOOLEAN DEFAULT true,
    auto_start_minutes_before_call INTEGER DEFAULT 30,

    -- Notification Configuration
    notifications_enabled BOOLEAN DEFAULT true,
    notify_minutes_before_call INTEGER DEFAULT 30,
    notify_crew_on_auto_start BOOLEAN DEFAULT true,

    -- Catch-Up Suggestion Triggers
    suggestion_trigger_minutes_behind INTEGER DEFAULT 15,
    suggestion_trigger_meal_penalty_minutes INTEGER DEFAULT 30,
    suggestion_trigger_wrap_extension_minutes INTEGER DEFAULT 30,

    -- Default View Preferences
    default_schedule_view VARCHAR(20) DEFAULT 'current' CHECK (default_schedule_view IN ('current', 'full', 'completed')),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Only one settings record per project
    CONSTRAINT unique_settings_per_project UNIQUE(project_id)
);

-- ============================================================================
-- HOT SET SCHEDULE BLOCKS
-- Track non-scene schedule items with planned vs actual times
-- (Crew call, first shot, meals, moves, activities, wrap)
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_schedule_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,

    -- Block Type
    block_type VARCHAR(30) NOT NULL CHECK (block_type IN (
        'crew_call', 'first_shot', 'meal', 'company_move',
        'activity', 'camera_wrap', 'wrap', 'custom'
    )),

    -- Block Info
    name VARCHAR(255) NOT NULL,
    location_name VARCHAR(255),
    description TEXT,

    -- Planned Times (from imported schedule)
    planned_start_time TIMESTAMPTZ NOT NULL,
    planned_end_time TIMESTAMPTZ NOT NULL,
    planned_duration_minutes INTEGER NOT NULL,

    -- Actual Times
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    actual_duration_minutes INTEGER,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'skipped'
    )),

    -- Variance Tracking
    cumulative_variance_minutes INTEGER DEFAULT 0,  -- Total variance up to this point
    realtime_deviation_minutes INTEGER DEFAULT 0,   -- How far behind/ahead of schedule

    -- Reference to original imported block (for sync)
    original_schedule_block_id VARCHAR(100),

    -- Linked marker (when block is completed, a marker may be created)
    linked_marker_id UUID REFERENCES backlot_hot_set_markers(id) ON DELETE SET NULL,

    -- Order
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HOT SET NOTIFICATIONS
-- Track notifications sent to crew about sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,

    -- Notification Type
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN (
        'pre_crew_call', 'auto_start', 'crew_call_confirmed',
        'first_shot_confirmed', 'meal_penalty_warning',
        'wrap_extension_warning', 'catch_up_suggestion', 'custom'
    )),

    -- Recipients
    recipient_profile_ids UUID[] NOT NULL,  -- Array of profile IDs who received it
    recipient_count INTEGER NOT NULL,

    -- Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Delivery
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_method VARCHAR(20) DEFAULT 'in_app' CHECK (delivery_method IN ('in_app', 'email', 'sms', 'push')),

    -- Metadata
    metadata JSONB,  -- Additional data (e.g., suggestion details)

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ALTER EXISTING TABLES
-- Add new columns to support auto-start and confirmations
-- ============================================================================

-- Add confirmation timestamps and auto-start flag to sessions
ALTER TABLE backlot_hot_set_sessions
ADD COLUMN IF NOT EXISTS crew_call_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS crew_call_confirmed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS first_shot_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_shot_confirmed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS auto_started BOOLEAN DEFAULT false;

-- Add real-time deviation tracking to scene logs
ALTER TABLE backlot_hot_set_scene_logs
ADD COLUMN IF NOT EXISTS cumulative_variance_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS realtime_deviation_minutes INTEGER DEFAULT 0;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hot_set_settings_project ON backlot_hot_set_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_session ON backlot_hot_set_schedule_blocks(session_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_status ON backlot_hot_set_schedule_blocks(status);
CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_type ON backlot_hot_set_schedule_blocks(block_type);
CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_sort ON backlot_hot_set_schedule_blocks(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_hot_set_notifications_session ON backlot_hot_set_notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_notifications_type ON backlot_hot_set_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_status_started ON backlot_hot_set_sessions(status, started_at);

-- Composite index for finding sessions to auto-start
CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_auto_start
ON backlot_hot_set_sessions(status, actual_call_time)
WHERE status = 'not_started' AND auto_started = false;

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE TRIGGER trigger_hot_set_settings_updated_at
    BEFORE UPDATE ON backlot_hot_set_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_updated_at();

CREATE TRIGGER trigger_hot_set_schedule_blocks_updated_at
    BEFORE UPDATE ON backlot_hot_set_schedule_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE backlot_hot_set_settings IS 'Project-level Hot Set configuration (auto-start, notifications, suggestions)';
COMMENT ON TABLE backlot_hot_set_schedule_blocks IS 'Non-scene schedule blocks with planned vs actual times for dual variance tracking';
COMMENT ON TABLE backlot_hot_set_notifications IS 'Notifications sent to crew about Hot Set session events';

COMMENT ON COLUMN backlot_hot_set_settings.auto_start_minutes_before_call IS 'How many minutes before crew call to auto-start the session';
COMMENT ON COLUMN backlot_hot_set_settings.suggestion_trigger_minutes_behind IS 'Trigger catch-up suggestions when this many minutes behind schedule';

COMMENT ON COLUMN backlot_hot_set_schedule_blocks.cumulative_variance_minutes IS 'Total variance accumulated up to this block (positive = ahead, negative = behind)';
COMMENT ON COLUMN backlot_hot_set_schedule_blocks.realtime_deviation_minutes IS 'Real-time comparison: minutes behind/ahead of where schedule says we should be';

COMMENT ON COLUMN backlot_hot_set_sessions.crew_call_confirmed_at IS '1st AD manually confirmed crew call arrival';
COMMENT ON COLUMN backlot_hot_set_sessions.first_shot_confirmed_at IS '1st AD manually confirmed first shot (cameras rolling)';
COMMENT ON COLUMN backlot_hot_set_sessions.auto_started IS 'Whether session was auto-started at crew call time';

COMMENT ON COLUMN backlot_hot_set_scene_logs.cumulative_variance_minutes IS 'Total variance accumulated up to this scene';
COMMENT ON COLUMN backlot_hot_set_scene_logs.realtime_deviation_minutes IS 'Real-time comparison: minutes behind/ahead of schedule';
