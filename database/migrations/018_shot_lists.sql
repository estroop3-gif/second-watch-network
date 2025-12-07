-- Migration 018: Professional Shot Lists for Producers/DPs
-- Separate from scene-bound shots - these are flexible lists organized by day/sequence/custom

-- =============================================================================
-- SHOT LISTS TABLE (Headers)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_shot_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Basic info
    title TEXT NOT NULL,
    description TEXT NULL,

    -- List type - flexible, not enum
    list_type TEXT NULL CHECK (list_type IS NULL OR list_type IN (
        'scene_based',
        'day_based',
        'sequence_based',
        'location_based',
        'custom'
    )),

    -- Optional links
    production_day_id UUID NULL REFERENCES backlot_production_days(id) ON DELETE SET NULL,
    scene_id UUID NULL REFERENCES backlot_scenes(id) ON DELETE SET NULL,

    -- Status
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shot_lists_project ON backlot_shot_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_production_day ON backlot_shot_lists(production_day_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_scene ON backlot_shot_lists(scene_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_archived ON backlot_shot_lists(project_id, is_archived);

-- =============================================================================
-- SHOTS TABLE (Individual shots within a list)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    shot_list_id UUID NOT NULL REFERENCES backlot_shot_lists(id) ON DELETE CASCADE,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Shot identification
    shot_number TEXT NOT NULL,  -- "1", "1A", "2B", etc.
    scene_number TEXT NULL,     -- Display scene number (even if scene_id is null)
    scene_id UUID NULL REFERENCES backlot_scenes(id) ON DELETE SET NULL,

    -- Camera info
    camera_label TEXT NULL,     -- "A Cam", "B Cam", "Drone"
    frame_size TEXT NULL CHECK (frame_size IS NULL OR frame_size IN (
        'ECU',   -- Extreme Close-Up
        'BCU',   -- Big Close-Up
        'CU',    -- Close-Up
        'MCU',   -- Medium Close-Up
        'MS',    -- Medium Shot
        'MWS',   -- Medium Wide Shot
        'MLS',   -- Medium Long Shot
        'LS',    -- Long Shot
        'WS',    -- Wide Shot
        'EWS',   -- Extreme Wide Shot
        'POV',   -- Point of View
        'OTS',   -- Over the Shoulder
        'INSERT',-- Insert
        '2SHOT', -- Two Shot
        'GROUP', -- Group Shot
        'AERIAL',-- Aerial/Drone
        'ESTAB', -- Establishing
        'OTHER'  -- Other
    )),

    -- Lens info
    lens TEXT NULL,              -- Free text: "35mm Prime", "24-70 Fujinon", etc.
    focal_length_mm NUMERIC(6,2) NULL,  -- Focal length number

    -- Camera angle/height
    camera_height TEXT NULL CHECK (camera_height IS NULL OR camera_height IN (
        'floor_level',
        'low_angle',
        'eye_level',
        'high_angle',
        'overhead',
        'birds_eye',
        'dutch',
        'other'
    )),

    -- Movement
    movement TEXT NULL CHECK (movement IS NULL OR movement IN (
        'static',
        'pan',
        'pan_left',
        'pan_right',
        'tilt',
        'tilt_up',
        'tilt_down',
        'dolly',
        'dolly_in',
        'dolly_out',
        'tracking',
        'handheld',
        'gimbal',
        'steadicam',
        'crane',
        'drone',
        'push_in',
        'pull_out',
        'zoom_in',
        'zoom_out',
        'whip_pan',
        'rack_focus',
        'roll',
        'combination',
        'other'
    )),

    -- Context
    location_hint TEXT NULL,    -- e.g. "Main Sanctuary", "Hallway B"
    time_of_day TEXT NULL CHECK (time_of_day IS NULL OR time_of_day IN (
        'DAY',
        'NIGHT',
        'DAWN',
        'DUSK',
        'MAGIC_HOUR',
        'CONTINUOUS',
        'SAME',
        'LATER',
        'OTHER'
    )),

    -- Descriptions
    description TEXT NULL,           -- What happens in the shot
    technical_notes TEXT NULL,       -- Exposure, filtration, LUT, special rigs
    performance_notes TEXT NULL,     -- Actor direction, emotional beats

    -- Timing
    est_time_minutes NUMERIC(5,2) NULL,

    -- Status
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shots_project ON backlot_shots(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_shot_list ON backlot_shots(shot_list_id);
CREATE INDEX IF NOT EXISTS idx_shots_scene ON backlot_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_shots_list_order ON backlot_shots(shot_list_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_shots_completed ON backlot_shots(shot_list_id, is_completed);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_shot_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shot_lists_updated_at ON backlot_shot_lists;
CREATE TRIGGER shot_lists_updated_at
    BEFORE UPDATE ON backlot_shot_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_shot_list_timestamp();

DROP TRIGGER IF EXISTS shots_updated_at ON backlot_shots;
CREATE TRIGGER shots_updated_at
    BEFORE UPDATE ON backlot_shots
    FOR EACH ROW
    EXECUTE FUNCTION update_shot_list_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_shot_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_shots ENABLE ROW LEVEL SECURITY;

-- Shot lists: project members can view, editors/admins can modify
CREATE POLICY "shot_lists_select" ON backlot_shot_lists
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_shot_lists.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "shot_lists_insert" ON backlot_shot_lists
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_shot_lists.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "shot_lists_update" ON backlot_shot_lists
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_shot_lists.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "shot_lists_delete" ON backlot_shot_lists
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_shot_lists.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'producer')
        )
    );

-- Shots: inherit permissions from shot list
CREATE POLICY "shots_select" ON backlot_shots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_shot_lists sl
            JOIN backlot_projects p ON p.id = sl.project_id
            WHERE sl.id = shot_list_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id AND user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "shots_insert" ON backlot_shots
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_shot_lists sl
            JOIN backlot_projects p ON p.id = sl.project_id
            WHERE sl.id = shot_list_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND role IN ('admin', 'editor', 'producer')
                )
            )
        )
    );

CREATE POLICY "shots_update" ON backlot_shots
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_shot_lists sl
            JOIN backlot_projects p ON p.id = sl.project_id
            WHERE sl.id = shot_list_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND role IN ('admin', 'editor', 'producer')
                )
            )
        )
    );

CREATE POLICY "shots_delete" ON backlot_shots
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_shot_lists sl
            JOIN backlot_projects p ON p.id = sl.project_id
            WHERE sl.id = shot_list_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND role IN ('admin', 'producer')
                )
            )
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get shot list summary stats
CREATE OR REPLACE FUNCTION get_shot_list_summary(p_shot_list_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_shots', COUNT(*),
        'completed_shots', COUNT(*) FILTER (WHERE is_completed = TRUE),
        'remaining_shots', COUNT(*) FILTER (WHERE is_completed = FALSE),
        'completion_percentage', CASE
            WHEN COUNT(*) > 0
            THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_completed = TRUE) / COUNT(*), 1)
            ELSE 0
        END,
        'est_total_minutes', COALESCE(SUM(est_time_minutes), 0),
        'est_remaining_minutes', COALESCE(SUM(est_time_minutes) FILTER (WHERE is_completed = FALSE), 0)
    ) INTO result
    FROM backlot_shots
    WHERE shot_list_id = p_shot_list_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get next shot number for a shot list
CREATE OR REPLACE FUNCTION get_next_shot_list_shot_number(p_shot_list_id UUID)
RETURNS TEXT AS $$
DECLARE
    max_num INTEGER;
BEGIN
    SELECT MAX(
        CASE
            WHEN shot_number ~ '^[0-9]+$' THEN shot_number::INTEGER
            WHEN shot_number ~ '^[0-9]+' THEN (regexp_match(shot_number, '^([0-9]+)'))[1]::INTEGER
            ELSE 0
        END
    ) INTO max_num
    FROM backlot_shots
    WHERE shot_list_id = p_shot_list_id;

    RETURN COALESCE((max_num + 1)::TEXT, '1');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_shot_lists IS 'Shot list headers - organizes shots by day, sequence, location, or custom grouping';
COMMENT ON TABLE backlot_shots IS 'Individual shots within a shot list - detailed DP/1st AD planning tool';
COMMENT ON FUNCTION get_shot_list_summary IS 'Returns summary statistics for a shot list';
COMMENT ON FUNCTION get_next_shot_list_shot_number IS 'Suggests the next shot number for a shot list';
