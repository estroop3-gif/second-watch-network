-- Migration: 043_hot_set_system.sql
-- Description: Hot Set - Real-time production day management for 1st ADs
-- Created: 2024-12-22

-- ============================================================================
-- HOT SET SESSIONS
-- One active session per production day for tracking real-time shooting
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
    call_sheet_id UUID REFERENCES backlot_call_sheets(id) ON DELETE SET NULL,

    -- Day Configuration
    day_type VARCHAR(10) NOT NULL DEFAULT '10hr' CHECK (day_type IN ('4hr', '8hr', '10hr', '12hr')),

    -- Actual Times
    actual_call_time TIMESTAMPTZ,
    actual_first_shot_time TIMESTAMPTZ,
    actual_wrap_time TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'wrapped')),
    started_at TIMESTAMPTZ,
    wrapped_at TIMESTAMPTZ,

    -- Cost Configuration
    default_hourly_rate DECIMAL(10,2),
    ot_multiplier_1 DECIMAL(3,2) DEFAULT 1.5,  -- After threshold 1 (e.g., 8hr)
    ot_multiplier_2 DECIMAL(3,2) DEFAULT 2.0,  -- After threshold 2 (e.g., 10hr)
    ot_threshold_1_hours INTEGER DEFAULT 8,
    ot_threshold_2_hours INTEGER DEFAULT 10,

    -- Metadata
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Only one session per production day
    CONSTRAINT unique_session_per_day UNIQUE(production_day_id)
);

-- ============================================================================
-- HOT SET SCENE LOGS
-- Track each scene's actual timing during the shoot day
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_scene_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,
    call_sheet_scene_id UUID REFERENCES backlot_call_sheet_scenes(id) ON DELETE SET NULL,

    -- Scene Info (denormalized for historical record)
    scene_number VARCHAR(20),
    set_name VARCHAR(255),
    int_ext VARCHAR(10),
    description TEXT,

    -- Timing
    estimated_minutes INTEGER,
    scheduled_start_time TIMESTAMPTZ,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    actual_duration_minutes INTEGER,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'moved')),
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Notes
    notes TEXT,
    skip_reason TEXT,  -- If skipped or moved

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HOT SET MARKERS
-- Significant time events during the day (meals, moves, wrap, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_markers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,

    marker_type VARCHAR(30) NOT NULL CHECK (marker_type IN (
        'call_time', 'first_shot', 'meal_in', 'meal_out',
        'company_move', 'camera_wrap', 'martini', 'wrap',
        'ot_threshold_1', 'ot_threshold_2', 'custom'
    )),

    timestamp TIMESTAMPTZ NOT NULL,
    label VARCHAR(100),
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HOT SET CREW
-- Track crew members with rates for OT cost calculations
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_hot_set_crew (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_hot_set_sessions(id) ON DELETE CASCADE,

    -- Person info (from call sheet or manual entry)
    call_sheet_person_id UUID REFERENCES backlot_call_sheet_people(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    role VARCHAR(100),

    -- Rate info (pulled from timecards/deal memos or set manually)
    rate_type VARCHAR(20) DEFAULT 'hourly' CHECK (rate_type IN ('hourly', 'daily', 'weekly', 'flat')),
    rate_amount DECIMAL(10,2),

    -- Actual times (can be updated during the day)
    actual_call_time TIMESTAMPTZ,
    actual_wrap_time TIMESTAMPTZ,

    -- Calculated fields (updated on wrap or periodically)
    total_hours DECIMAL(5,2),
    regular_hours DECIMAL(5,2),
    ot_hours_1 DECIMAL(5,2),
    ot_hours_2 DECIMAL(5,2),
    calculated_cost DECIMAL(10,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_project ON backlot_hot_set_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_day ON backlot_hot_set_sessions(production_day_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_sessions_status ON backlot_hot_set_sessions(status);
CREATE INDEX IF NOT EXISTS idx_hot_set_scene_logs_session ON backlot_hot_set_scene_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_scene_logs_status ON backlot_hot_set_scene_logs(status);
CREATE INDEX IF NOT EXISTS idx_hot_set_markers_session ON backlot_hot_set_markers(session_id);
CREATE INDEX IF NOT EXISTS idx_hot_set_markers_type ON backlot_hot_set_markers(marker_type);
CREATE INDEX IF NOT EXISTS idx_hot_set_crew_session ON backlot_hot_set_crew(session_id);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_hot_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hot_set_sessions_updated_at
    BEFORE UPDATE ON backlot_hot_set_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_updated_at();

CREATE TRIGGER trigger_hot_set_scene_logs_updated_at
    BEFORE UPDATE ON backlot_hot_set_scene_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_updated_at();

CREATE TRIGGER trigger_hot_set_crew_updated_at
    BEFORE UPDATE ON backlot_hot_set_crew
    FOR EACH ROW
    EXECUTE FUNCTION update_hot_set_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE backlot_hot_set_sessions IS 'Real-time production day management sessions for 1st ADs';
COMMENT ON TABLE backlot_hot_set_scene_logs IS 'Track actual timing for each scene during shooting';
COMMENT ON TABLE backlot_hot_set_markers IS 'Significant time events during production day (meals, moves, wrap)';
COMMENT ON TABLE backlot_hot_set_crew IS 'Crew members with rates for OT cost calculations';

COMMENT ON COLUMN backlot_hot_set_sessions.day_type IS 'Day length for OT calculations: 4hr (half), 8hr, 10hr, or 12hr';
COMMENT ON COLUMN backlot_hot_set_sessions.ot_threshold_1_hours IS 'Hours before OT multiplier 1 kicks in (typically 8)';
COMMENT ON COLUMN backlot_hot_set_sessions.ot_threshold_2_hours IS 'Hours before OT multiplier 2 kicks in (typically 10)';
COMMENT ON COLUMN backlot_hot_set_scene_logs.status IS 'pending=not started, in_progress=shooting, completed=done, skipped=skipped, moved=moved to another day';
