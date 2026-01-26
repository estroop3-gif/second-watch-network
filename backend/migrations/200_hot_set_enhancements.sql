-- Migration: Hot Set System Enhancements
-- Adds auto-start, dual variance tracking, settings, and notifications

-- ============================================================================
-- 1. Enhance backlot_hot_set_sessions table
-- ============================================================================

-- Add auto-start and confirmation columns
ALTER TABLE backlot_hot_set_sessions
ADD COLUMN IF NOT EXISTS crew_call_confirmed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS crew_call_confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS first_shot_confirmed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS first_shot_confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS auto_started BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN backlot_hot_set_sessions.crew_call_confirmed_at IS 'Timestamp when 1st AD confirmed crew call arrival';
COMMENT ON COLUMN backlot_hot_set_sessions.first_shot_confirmed_at IS 'Timestamp when 1st AD confirmed first shot, tracking begins';
COMMENT ON COLUMN backlot_hot_set_sessions.auto_started IS 'Whether session was auto-started before crew call';

-- ============================================================================
-- 2. Enhance backlot_hot_set_scene_logs table
-- ============================================================================

-- Add variance tracking columns
ALTER TABLE backlot_hot_set_scene_logs
ADD COLUMN IF NOT EXISTS cumulative_variance_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS realtime_deviation_minutes INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN backlot_hot_set_scene_logs.cumulative_variance_minutes IS 'Total time over/under from all completed items (positive = ahead, negative = behind)';
COMMENT ON COLUMN backlot_hot_set_scene_logs.realtime_deviation_minutes IS 'Current position vs expected position on schedule (positive = ahead, negative = behind)';

-- ============================================================================
-- 3. Enhance backlot_hot_set_schedule_blocks table
-- ============================================================================

-- Add variance tracking columns (table was created in migration 199)
ALTER TABLE backlot_hot_set_schedule_blocks
ADD COLUMN IF NOT EXISTS cumulative_variance_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS realtime_deviation_minutes INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN backlot_hot_set_schedule_blocks.cumulative_variance_minutes IS 'Total time over/under from all completed items';
COMMENT ON COLUMN backlot_hot_set_schedule_blocks.realtime_deviation_minutes IS 'Current position vs expected position on schedule';

-- ============================================================================
-- 4. Create backlot_hot_set_settings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Auto-start settings
    auto_start_enabled BOOLEAN DEFAULT FALSE,
    auto_start_minutes_before_call INTEGER DEFAULT 30,

    -- Notification settings
    notifications_enabled BOOLEAN DEFAULT TRUE,
    notify_minutes_before_call INTEGER DEFAULT 60,
    notify_crew_on_auto_start BOOLEAN DEFAULT TRUE,

    -- Catch-up suggestion triggers
    suggestion_trigger_minutes_behind INTEGER DEFAULT 15,
    suggestion_trigger_meal_penalty_minutes INTEGER DEFAULT 30,
    suggestion_trigger_wrap_extension_minutes INTEGER DEFAULT 30,

    -- UI preferences
    default_schedule_view VARCHAR(20) DEFAULT 'current', -- 'current', 'full', 'completed'

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_hot_set_settings_project_id
ON backlot_hot_set_settings(project_id);

-- Add comment
COMMENT ON TABLE backlot_hot_set_settings IS 'Project-level Hot Set configuration for auto-start, notifications, and suggestions';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_hot_set_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_hot_set_settings_updated_at ON backlot_hot_set_settings;
CREATE TRIGGER trigger_hot_set_settings_updated_at
    BEFORE UPDATE ON backlot_hot_set_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_settings_updated_at();

-- ============================================================================
-- 5. Create backlot_hot_set_notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- 'pre_crew_call', 'auto_start', 'crew_call_confirmed', 'first_shot_confirmed', 'meal_penalty_warning', 'wrap_extension_warning'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Recipients
    recipient_profile_ids UUID[] NOT NULL DEFAULT '{}',

    -- Delivery
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_method VARCHAR(20) DEFAULT 'websocket', -- 'websocket', 'push', 'email', 'sms'

    -- Metadata
    metadata JSONB DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hot_set_notifications_session_id
ON backlot_hot_set_notifications(session_id);

CREATE INDEX IF NOT EXISTS idx_hot_set_notifications_project_id
ON backlot_hot_set_notifications(project_id);

CREATE INDEX IF NOT EXISTS idx_hot_set_notifications_type
ON backlot_hot_set_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_hot_set_notifications_sent_at
ON backlot_hot_set_notifications(sent_at DESC);

-- Add comment
COMMENT ON TABLE backlot_hot_set_notifications IS 'Notification history for Hot Set events (auto-start, confirmations, warnings)';

-- ============================================================================
-- 6. Create indexes for performance
-- ============================================================================

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_production_day
ON backlot_hot_set_sessions(production_day_id);

CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_status
ON backlot_hot_set_sessions(status);

-- Scene logs indexes
CREATE INDEX IF NOT EXISTS idx_hot_set_scene_logs_session_status
ON backlot_hot_set_scene_logs(session_id, status);

-- Schedule blocks indexes (some created in migration 199, adding missing ones)
CREATE INDEX IF NOT EXISTS idx_hot_set_schedule_blocks_session_status
ON backlot_hot_set_schedule_blocks(session_id, status);

-- ============================================================================
-- 7. Insert default settings for existing projects with Hot Set sessions
-- ============================================================================

INSERT INTO backlot_hot_set_settings (project_id, auto_start_enabled, auto_start_minutes_before_call, notifications_enabled)
SELECT DISTINCT p.id, FALSE, 30, TRUE
FROM backlot_projects p
INNER JOIN backlot_hot_set_sessions s ON s.project_id = p.id
ON CONFLICT (project_id) DO NOTHING;
