-- Migration 016: Shot Lists, Storyboards, and Coverage
-- Shot list builder and on-set coverage tracking for the Script/Scenes system

-- =============================================================================
-- SCENE SHOTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_scene_shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,

    -- Shot identification
    shot_number TEXT NOT NULL,  -- "1", "1A", "2", etc.

    -- Shot details
    shot_type TEXT NOT NULL CHECK (shot_type IN (
        'ECU',   -- Extreme Close-Up
        'CU',    -- Close-Up
        'MCU',   -- Medium Close-Up
        'MS',    -- Medium Shot
        'MLS',   -- Medium Long Shot
        'LS',    -- Long Shot / Wide Shot
        'WS',    -- Wide Shot
        'EWS',   -- Extreme Wide Shot
        'POV',   -- Point of View
        'OTS',   -- Over the Shoulder
        'INSERT',-- Insert shot
        '2SHOT', -- Two Shot
        'GROUP', -- Group Shot
        'OTHER'  -- Custom/Other
    )),

    lens TEXT NULL,  -- "50mm", "85mm", "24-70mm", etc.

    camera_movement TEXT NULL CHECK (camera_movement IS NULL OR camera_movement IN (
        'static',
        'pan',
        'tilt',
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
        'zoom',
        'whip_pan',
        'rack_focus',
        'other'
    )),

    description TEXT NULL,  -- Shot description
    est_time_minutes NUMERIC(5,2) NULL,  -- Estimated time to shoot

    priority TEXT NULL CHECK (priority IS NULL OR priority IN (
        'must_have',
        'nice_to_have'
    )),

    -- Coverage tracking
    coverage_status TEXT NOT NULL DEFAULT 'not_shot' CHECK (coverage_status IN (
        'not_shot',
        'shot',
        'alt_needed',
        'dropped'
    )),

    -- When was this shot marked as covered
    covered_at TIMESTAMPTZ NULL,
    covered_by_user_id UUID NULL REFERENCES auth.users(id),

    notes TEXT NULL,

    -- Ordering within scene
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scene_shots_project ON backlot_scene_shots(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_shots_scene ON backlot_scene_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_shots_coverage ON backlot_scene_shots(coverage_status);
CREATE INDEX IF NOT EXISTS idx_scene_shots_project_scene ON backlot_scene_shots(project_id, scene_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_shots_scene_number ON backlot_scene_shots(scene_id, shot_number);

-- =============================================================================
-- SHOT IMAGES TABLE (Storyboards / Reference Stills)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_scene_shot_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_shot_id UUID NOT NULL REFERENCES backlot_scene_shots(id) ON DELETE CASCADE,

    image_url TEXT NOT NULL,
    thumbnail_url TEXT NULL,

    description TEXT NULL,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shot_images_shot ON backlot_scene_shot_images(scene_shot_id);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_scene_shot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scene_shots_updated_at ON backlot_scene_shots;
CREATE TRIGGER scene_shots_updated_at
    BEFORE UPDATE ON backlot_scene_shots
    FOR EACH ROW
    EXECUTE FUNCTION update_scene_shot_timestamp();

DROP TRIGGER IF EXISTS shot_images_updated_at ON backlot_scene_shot_images;
CREATE TRIGGER shot_images_updated_at
    BEFORE UPDATE ON backlot_scene_shot_images
    FOR EACH ROW
    EXECUTE FUNCTION update_scene_shot_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_scene_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_scene_shot_images ENABLE ROW LEVEL SECURITY;

-- Scene shots: project members can view, editors/admins can modify
CREATE POLICY "scene_shots_select" ON backlot_scene_shots
    FOR SELECT USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project member
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_scene_shots.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "scene_shots_insert" ON backlot_scene_shots
    FOR INSERT WITH CHECK (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin/editor
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_scene_shots.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

CREATE POLICY "scene_shots_update" ON backlot_scene_shots
    FOR UPDATE USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin/editor
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_scene_shots.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

CREATE POLICY "scene_shots_delete" ON backlot_scene_shots
    FOR DELETE USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin only
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_scene_shots.project_id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Shot images: inherit from parent shot
CREATE POLICY "shot_images_select" ON backlot_scene_shot_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_scene_shots s
            JOIN backlot_projects p ON p.id = s.project_id
            WHERE s.id = scene_shot_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id AND user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "shot_images_insert" ON backlot_scene_shot_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_scene_shots s
            JOIN backlot_projects p ON p.id = s.project_id
            WHERE s.id = scene_shot_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND role IN ('admin', 'editor')
                )
            )
        )
    );

CREATE POLICY "shot_images_update" ON backlot_scene_shot_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_scene_shots s
            JOIN backlot_projects p ON p.id = s.project_id
            WHERE s.id = scene_shot_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND role IN ('admin', 'editor')
                )
            )
        )
    );

CREATE POLICY "shot_images_delete" ON backlot_scene_shot_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_scene_shots s
            JOIN backlot_projects p ON p.id = s.project_id
            WHERE s.id = scene_shot_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND role = 'admin'
                )
            )
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get coverage summary for a scene
CREATE OR REPLACE FUNCTION get_scene_coverage_summary(p_scene_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_shots', COUNT(*),
        'shot', COUNT(*) FILTER (WHERE coverage_status = 'shot'),
        'not_shot', COUNT(*) FILTER (WHERE coverage_status = 'not_shot'),
        'alt_needed', COUNT(*) FILTER (WHERE coverage_status = 'alt_needed'),
        'dropped', COUNT(*) FILTER (WHERE coverage_status = 'dropped'),
        'must_have_total', COUNT(*) FILTER (WHERE priority = 'must_have'),
        'must_have_shot', COUNT(*) FILTER (WHERE priority = 'must_have' AND coverage_status = 'shot'),
        'est_time_minutes', COALESCE(SUM(est_time_minutes), 0),
        'shot_time_minutes', COALESCE(SUM(est_time_minutes) FILTER (WHERE coverage_status = 'shot'), 0)
    ) INTO result
    FROM backlot_scene_shots
    WHERE scene_id = p_scene_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get coverage summary for entire project
CREATE OR REPLACE FUNCTION get_project_coverage_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_scenes', (
            SELECT COUNT(DISTINCT scene_id)
            FROM backlot_scene_shots
            WHERE project_id = p_project_id
        ),
        'total_shots', COUNT(*),
        'shot', COUNT(*) FILTER (WHERE coverage_status = 'shot'),
        'not_shot', COUNT(*) FILTER (WHERE coverage_status = 'not_shot'),
        'alt_needed', COUNT(*) FILTER (WHERE coverage_status = 'alt_needed'),
        'dropped', COUNT(*) FILTER (WHERE coverage_status = 'dropped'),
        'coverage_percentage', CASE
            WHEN COUNT(*) > 0
            THEN ROUND(100.0 * COUNT(*) FILTER (WHERE coverage_status = 'shot') / COUNT(*), 1)
            ELSE 0
        END,
        'must_have_coverage', CASE
            WHEN COUNT(*) FILTER (WHERE priority = 'must_have') > 0
            THEN ROUND(100.0 * COUNT(*) FILTER (WHERE priority = 'must_have' AND coverage_status = 'shot') / COUNT(*) FILTER (WHERE priority = 'must_have'), 1)
            ELSE 100
        END,
        'est_total_minutes', COALESCE(SUM(est_time_minutes), 0),
        'est_remaining_minutes', COALESCE(SUM(est_time_minutes) FILTER (WHERE coverage_status = 'not_shot'), 0),
        'by_type', (
            SELECT jsonb_object_agg(shot_type, type_count)
            FROM (
                SELECT shot_type, COUNT(*) as type_count
                FROM backlot_scene_shots
                WHERE project_id = p_project_id
                GROUP BY shot_type
            ) type_stats
        )
    ) INTO result
    FROM backlot_scene_shots
    WHERE project_id = p_project_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get next shot number for a scene
CREATE OR REPLACE FUNCTION get_next_shot_number(p_scene_id UUID)
RETURNS TEXT AS $$
DECLARE
    max_num INTEGER;
BEGIN
    -- Try to extract numeric part from existing shot numbers
    SELECT MAX(
        CASE
            WHEN shot_number ~ '^[0-9]+$' THEN shot_number::INTEGER
            WHEN shot_number ~ '^[0-9]+' THEN (regexp_match(shot_number, '^([0-9]+)'))[1]::INTEGER
            ELSE 0
        END
    ) INTO max_num
    FROM backlot_scene_shots
    WHERE scene_id = p_scene_id;

    RETURN COALESCE((max_num + 1)::TEXT, '1');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_scene_shots IS 'Shot list entries for script scenes - used for planning and coverage tracking';
COMMENT ON TABLE backlot_scene_shot_images IS 'Storyboard frames and reference images for shots';
COMMENT ON FUNCTION get_scene_coverage_summary IS 'Returns coverage statistics for a single scene';
COMMENT ON FUNCTION get_project_coverage_summary IS 'Returns coverage statistics for an entire project';
COMMENT ON FUNCTION get_next_shot_number IS 'Suggests the next shot number for a scene';
