-- =====================================================
-- Migration 049: Backlot Takes Table
-- Separate takes table for Script Supervisor continuity tracking
-- Distinct from backlot_slate_logs which is used for camera dept
-- =====================================================

-- =====================================================
-- 1. BACKLOT TAKES (Script Supervisor Takes)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_takes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,

    -- Take identification
    scene_number TEXT NOT NULL,
    take_number INTEGER NOT NULL DEFAULT 1,

    -- Status tracking
    status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'print', 'circled', 'hold', 'ng', 'wild', 'mos', 'false_start')),

    -- Timecode info
    timecode_in TEXT,
    timecode_out TEXT,

    -- Camera info
    camera_label TEXT,
    setup_label TEXT,
    camera_roll TEXT,

    -- Additional metadata
    time_of_day TEXT,
    duration_seconds INTEGER,
    notes TEXT,

    -- Tracking
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_takes_project ON backlot_takes(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_takes_scene ON backlot_takes(scene_id);
CREATE INDEX IF NOT EXISTS idx_backlot_takes_production_day ON backlot_takes(production_day_id);
CREATE INDEX IF NOT EXISTS idx_backlot_takes_scene_number ON backlot_takes(project_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_backlot_takes_created ON backlot_takes(project_id, created_at DESC);

-- Update trigger
CREATE OR REPLACE TRIGGER update_backlot_takes_updated_at
    BEFORE UPDATE ON backlot_takes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE backlot_takes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "backlot_takes_select" ON backlot_takes
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "backlot_takes_insert" ON backlot_takes
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "backlot_takes_update" ON backlot_takes
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "backlot_takes_delete" ON backlot_takes
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON backlot_takes TO authenticated;
