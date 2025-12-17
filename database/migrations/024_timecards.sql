-- Migration 024: Backlot Timecards System
-- Per-project timecards with weekly containers and daily entries

-- =============================================================================
-- TIMECARDS TABLE
-- Represents a timecard for one person for one week on a project
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_timecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL, -- Typically Monday
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ,
    submitted_by_user_id UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approved_by_user_id UUID REFERENCES auth.users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by_user_id UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    notes TEXT, -- High-level note on the card
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_backlot_timecards_project ON backlot_timecards(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_timecards_user ON backlot_timecards(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_timecards_week ON backlot_timecards(week_start_date);
CREATE INDEX IF NOT EXISTS idx_backlot_timecards_status ON backlot_timecards(project_id, status);
CREATE INDEX IF NOT EXISTS idx_backlot_timecards_submitted ON backlot_timecards(project_id, status) WHERE status = 'submitted';

-- =============================================================================
-- TIMECARD ENTRIES TABLE
-- Represents a single day entry on a timecard
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_timecard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timecard_id UUID NOT NULL REFERENCES backlot_timecards(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    shoot_date DATE NOT NULL,
    production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,

    -- Time tracking
    call_time TIMESTAMPTZ,
    wrap_time TIMESTAMPTZ,
    break_start TIMESTAMPTZ,
    break_end TIMESTAMPTZ,
    meal_break_minutes INTEGER DEFAULT 0,

    -- Hours (can be calculated or manually entered)
    hours_worked NUMERIC(5, 2),
    overtime_hours NUMERIC(5, 2) DEFAULT 0,
    double_time_hours NUMERIC(5, 2) DEFAULT 0,

    -- Work classification
    department TEXT,
    position TEXT, -- grip, camera op, 1st AD, etc.
    rate_type TEXT DEFAULT 'daily' CHECK (rate_type IN ('hourly', 'daily', 'weekly', 'flat')),
    rate_amount NUMERIC(10, 2),

    -- Location and context
    location_name TEXT,

    -- Special day flags
    is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    is_travel_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_prep_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_wrap_day BOOLEAN NOT NULL DEFAULT FALSE,

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(timecard_id, shoot_date)
);

CREATE INDEX IF NOT EXISTS idx_backlot_timecard_entries_timecard ON backlot_timecard_entries(timecard_id);
CREATE INDEX IF NOT EXISTS idx_backlot_timecard_entries_project ON backlot_timecard_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_timecard_entries_date ON backlot_timecard_entries(shoot_date);
CREATE INDEX IF NOT EXISTS idx_backlot_timecard_entries_day ON backlot_timecard_entries(production_day_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_backlot_timecards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backlot_timecards_updated_at ON backlot_timecards;
CREATE TRIGGER backlot_timecards_updated_at
    BEFORE UPDATE ON backlot_timecards
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_timecards_timestamp();

DROP TRIGGER IF EXISTS backlot_timecard_entries_updated_at ON backlot_timecard_entries;
CREATE TRIGGER backlot_timecard_entries_updated_at
    BEFORE UPDATE ON backlot_timecard_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_timecards_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_timecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_timecard_entries ENABLE ROW LEVEL SECURITY;

-- Timecards: Users can view their own, showrunner/producer/admin can view all
CREATE POLICY "backlot_timecards_select" ON backlot_timecards
    FOR SELECT USING (
        -- Own timecard
        user_id = auth.uid()
        -- Project owner
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        -- Showrunner or producer role
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_timecards.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        -- Admin member
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_timecards.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Timecards: Users can insert their own
CREATE POLICY "backlot_timecards_insert" ON backlot_timecards
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_timecards.project_id
            AND m.user_id = auth.uid()
        )
    );

-- Timecards: Users can update their own draft/rejected cards, admins can update any
CREATE POLICY "backlot_timecards_update" ON backlot_timecards
    FOR UPDATE USING (
        -- Own timecard that's draft or rejected
        (user_id = auth.uid() AND status IN ('draft', 'rejected'))
        -- Project owner
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        -- Showrunner or producer (for approval flow)
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_timecards.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        -- Admin member
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_timecards.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Timecards: Only admins can delete
CREATE POLICY "backlot_timecards_delete" ON backlot_timecards
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_timecards.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Timecard Entries: Same visibility as parent timecard
CREATE POLICY "backlot_timecard_entries_select" ON backlot_timecard_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_timecards t
            WHERE t.id = timecard_id
            AND (
                t.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_projects p
                    WHERE p.id = t.project_id AND p.owner_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM backlot_project_roles r
                    WHERE r.project_id = t.project_id
                    AND r.user_id = auth.uid()
                    AND r.backlot_role IN ('showrunner', 'producer')
                )
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members m
                    WHERE m.project_id = t.project_id
                    AND m.user_id = auth.uid()
                    AND m.role = 'admin'
                )
            )
        )
    );

-- Timecard Entries: Owner can insert if timecard is draft/rejected
CREATE POLICY "backlot_timecard_entries_insert" ON backlot_timecard_entries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_timecards t
            WHERE t.id = timecard_id
            AND t.user_id = auth.uid()
            AND t.status IN ('draft', 'rejected')
        )
    );

-- Timecard Entries: Owner can update if timecard is draft/rejected
CREATE POLICY "backlot_timecard_entries_update" ON backlot_timecard_entries
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_timecards t
            WHERE t.id = timecard_id
            AND t.user_id = auth.uid()
            AND t.status IN ('draft', 'rejected')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_timecards t
            JOIN backlot_projects p ON p.id = t.project_id
            WHERE t.id = timecard_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_timecards t
            JOIN backlot_project_members m ON m.project_id = t.project_id
            WHERE t.id = timecard_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Timecard Entries: Owner can delete if timecard is draft/rejected
CREATE POLICY "backlot_timecard_entries_delete" ON backlot_timecard_entries
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_timecards t
            WHERE t.id = timecard_id
            AND t.user_id = auth.uid()
            AND t.status IN ('draft', 'rejected')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_timecards t
            JOIN backlot_projects p ON p.id = t.project_id
            WHERE t.id = timecard_id AND p.owner_id = auth.uid()
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Calculate hours worked from call and wrap times
CREATE OR REPLACE FUNCTION calculate_hours_worked(
    p_call_time TIMESTAMPTZ,
    p_wrap_time TIMESTAMPTZ,
    p_meal_break_minutes INTEGER DEFAULT 0
) RETURNS NUMERIC AS $$
DECLARE
    total_minutes NUMERIC;
BEGIN
    IF p_call_time IS NULL OR p_wrap_time IS NULL THEN
        RETURN NULL;
    END IF;

    total_minutes := EXTRACT(EPOCH FROM (p_wrap_time - p_call_time)) / 60;
    total_minutes := total_minutes - COALESCE(p_meal_break_minutes, 0);

    RETURN ROUND(total_minutes / 60, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get week start date (Monday) for a given date
CREATE OR REPLACE FUNCTION get_week_start_date(p_date DATE)
RETURNS DATE AS $$
BEGIN
    RETURN p_date - (EXTRACT(DOW FROM p_date)::INTEGER + 6) % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get timecard summary for a project
CREATE OR REPLACE FUNCTION get_project_timecard_summary(p_project_id UUID)
RETURNS TABLE (
    total_timecards BIGINT,
    draft_count BIGINT,
    submitted_count BIGINT,
    approved_count BIGINT,
    rejected_count BIGINT,
    total_hours NUMERIC,
    total_overtime_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT t.id) AS total_timecards,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'draft') AS draft_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'submitted') AS submitted_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'approved') AS approved_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'rejected') AS rejected_count,
        COALESCE(SUM(e.hours_worked), 0) AS total_hours,
        COALESCE(SUM(e.overtime_hours), 0) AS total_overtime_hours
    FROM backlot_timecards t
    LEFT JOIN backlot_timecard_entries e ON e.timecard_id = t.id
    WHERE t.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_timecards IS 'Weekly timecard containers for crew members on a project';
COMMENT ON TABLE backlot_timecard_entries IS 'Daily time entries within a timecard';
COMMENT ON COLUMN backlot_timecards.week_start_date IS 'Monday of the week this timecard covers';
COMMENT ON COLUMN backlot_timecards.status IS 'Workflow status: draft, submitted, approved, rejected';
COMMENT ON COLUMN backlot_timecard_entries.hours_worked IS 'Total hours worked (can be calculated from call/wrap or manually entered)';
COMMENT ON COLUMN backlot_timecard_entries.overtime_hours IS 'Hours beyond standard day (typically 8-10 hours)';
COMMENT ON COLUMN backlot_timecard_entries.rate_type IS 'How this person is paid: hourly, daily, weekly, or flat';
