-- Migration 022: Dailies System (Cloud and Local Drive)
-- Dailies workflow for post-production with support for cloud-hosted
-- proxies and local drive-based media metadata tracking

-- =============================================================================
-- DAILIES DAYS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_dailies_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    shoot_date DATE NOT NULL,
    label TEXT NOT NULL,
    unit TEXT NULL,
    notes TEXT NULL,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, shoot_date, unit)
);

CREATE INDEX IF NOT EXISTS idx_dailies_days_project ON backlot_dailies_days(project_id);
CREATE INDEX IF NOT EXISTS idx_dailies_days_shoot_date ON backlot_dailies_days(shoot_date);
CREATE INDEX IF NOT EXISTS idx_dailies_days_project_date ON backlot_dailies_days(project_id, shoot_date);

-- =============================================================================
-- DAILIES CARDS (ROLLS) TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_dailies_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dailies_day_id UUID NOT NULL REFERENCES backlot_dailies_days(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    camera_label TEXT NOT NULL,
    roll_name TEXT NOT NULL,
    storage_mode TEXT NOT NULL DEFAULT 'cloud' CHECK (storage_mode IN ('cloud', 'local_drive')),
    media_root_path TEXT NULL,
    storage_location TEXT NULL,
    checksum_verified BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NULL,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(dailies_day_id, camera_label, roll_name)
);

CREATE INDEX IF NOT EXISTS idx_dailies_cards_day ON backlot_dailies_cards(dailies_day_id);
CREATE INDEX IF NOT EXISTS idx_dailies_cards_project ON backlot_dailies_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_dailies_cards_camera ON backlot_dailies_cards(camera_label);

-- =============================================================================
-- DAILIES CLIPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_dailies_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dailies_card_id UUID NOT NULL REFERENCES backlot_dailies_cards(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    relative_path TEXT NULL,
    storage_mode TEXT NOT NULL DEFAULT 'cloud' CHECK (storage_mode IN ('cloud', 'local_drive')),
    cloud_url TEXT NULL,
    duration_seconds NUMERIC NULL,
    timecode_start TEXT NULL,
    frame_rate NUMERIC NULL,
    resolution TEXT NULL,
    codec TEXT NULL,
    camera_label TEXT NULL,
    scene_number TEXT NULL,
    take_number INTEGER NULL,
    is_circle_take BOOLEAN NOT NULL DEFAULT FALSE,
    rating INTEGER NULL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
    script_scene_id UUID NULL REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    shot_id UUID NULL,
    notes TEXT NULL,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dailies_clips_card ON backlot_dailies_clips(dailies_card_id);
CREATE INDEX IF NOT EXISTS idx_dailies_clips_project ON backlot_dailies_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_dailies_clips_scene ON backlot_dailies_clips(scene_number);
CREATE INDEX IF NOT EXISTS idx_dailies_clips_take ON backlot_dailies_clips(take_number);
CREATE INDEX IF NOT EXISTS idx_dailies_clips_circle ON backlot_dailies_clips(is_circle_take) WHERE is_circle_take = TRUE;
CREATE INDEX IF NOT EXISTS idx_dailies_clips_rating ON backlot_dailies_clips(rating);
CREATE INDEX IF NOT EXISTS idx_dailies_clips_script_scene ON backlot_dailies_clips(script_scene_id);

-- =============================================================================
-- DAILIES CLIP NOTES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_dailies_clip_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dailies_clip_id UUID NOT NULL REFERENCES backlot_dailies_clips(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id),
    time_seconds NUMERIC NULL,
    note_text TEXT NOT NULL,
    category TEXT NULL CHECK (category IS NULL OR category IN (
        'performance', 'camera', 'sound', 'technical', 'continuity', 'vfx', 'general'
    )),
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dailies_clip_notes_clip ON backlot_dailies_clip_notes(dailies_clip_id);
CREATE INDEX IF NOT EXISTS idx_dailies_clip_notes_author ON backlot_dailies_clip_notes(author_user_id);
CREATE INDEX IF NOT EXISTS idx_dailies_clip_notes_category ON backlot_dailies_clip_notes(category);
CREATE INDEX IF NOT EXISTS idx_dailies_clip_notes_resolved ON backlot_dailies_clip_notes(is_resolved);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_dailies_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dailies_days_updated_at ON backlot_dailies_days;
CREATE TRIGGER dailies_days_updated_at
    BEFORE UPDATE ON backlot_dailies_days
    FOR EACH ROW
    EXECUTE FUNCTION update_dailies_timestamp();

DROP TRIGGER IF EXISTS dailies_cards_updated_at ON backlot_dailies_cards;
CREATE TRIGGER dailies_cards_updated_at
    BEFORE UPDATE ON backlot_dailies_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_dailies_timestamp();

DROP TRIGGER IF EXISTS dailies_clips_updated_at ON backlot_dailies_clips;
CREATE TRIGGER dailies_clips_updated_at
    BEFORE UPDATE ON backlot_dailies_clips
    FOR EACH ROW
    EXECUTE FUNCTION update_dailies_timestamp();

DROP TRIGGER IF EXISTS dailies_clip_notes_updated_at ON backlot_dailies_clip_notes;
CREATE TRIGGER dailies_clip_notes_updated_at
    BEFORE UPDATE ON backlot_dailies_clip_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_dailies_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_dailies_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_dailies_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_dailies_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_dailies_clip_notes ENABLE ROW LEVEL SECURITY;

-- Dailies Days: Project members can view, editors and above can modify
CREATE POLICY "dailies_days_select" ON backlot_dailies_days
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_days.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "dailies_days_insert" ON backlot_dailies_days
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_days.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "dailies_days_update" ON backlot_dailies_days
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_days.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "dailies_days_delete" ON backlot_dailies_days
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_days.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'producer')
        )
    );

-- Dailies Cards: Same as days
CREATE POLICY "dailies_cards_select" ON backlot_dailies_cards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_cards.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "dailies_cards_insert" ON backlot_dailies_cards
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_cards.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "dailies_cards_update" ON backlot_dailies_cards
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_cards.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "dailies_cards_delete" ON backlot_dailies_cards
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_cards.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'producer')
        )
    );

-- Dailies Clips: Same as cards
CREATE POLICY "dailies_clips_select" ON backlot_dailies_clips
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_clips.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "dailies_clips_insert" ON backlot_dailies_clips
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_clips.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "dailies_clips_update" ON backlot_dailies_clips
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_clips.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor', 'producer')
        )
    );

CREATE POLICY "dailies_clips_delete" ON backlot_dailies_clips
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_dailies_clips.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'producer')
        )
    );

-- Clip Notes: Any member can add notes, only author or admin can edit/delete
CREATE POLICY "dailies_clip_notes_select" ON backlot_dailies_clip_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_dailies_clips c
            JOIN backlot_projects p ON p.id = c.project_id
            WHERE c.id = dailies_clip_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = c.project_id AND user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "dailies_clip_notes_insert" ON backlot_dailies_clip_notes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_dailies_clips c
            JOIN backlot_projects p ON p.id = c.project_id
            WHERE c.id = dailies_clip_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = c.project_id AND user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "dailies_clip_notes_update" ON backlot_dailies_clip_notes
    FOR UPDATE USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_dailies_clips c
            JOIN backlot_projects p ON p.id = c.project_id
            WHERE c.id = dailies_clip_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = c.project_id
                    AND user_id = auth.uid()
                    AND role = 'admin'
                )
            )
        )
    );

CREATE POLICY "dailies_clip_notes_delete" ON backlot_dailies_clip_notes
    FOR DELETE USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_dailies_clips c
            JOIN backlot_projects p ON p.id = c.project_id
            WHERE c.id = dailies_clip_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = c.project_id
                    AND user_id = auth.uid()
                    AND role = 'admin'
                )
            )
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get dailies summary for a project
CREATE OR REPLACE FUNCTION get_project_dailies_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_days', (SELECT COUNT(*) FROM backlot_dailies_days WHERE project_id = p_project_id),
        'total_cards', (SELECT COUNT(*) FROM backlot_dailies_cards WHERE project_id = p_project_id),
        'total_clips', (SELECT COUNT(*) FROM backlot_dailies_clips WHERE project_id = p_project_id),
        'circle_takes', (SELECT COUNT(*) FROM backlot_dailies_clips WHERE project_id = p_project_id AND is_circle_take = TRUE),
        'cloud_clips', (SELECT COUNT(*) FROM backlot_dailies_clips WHERE project_id = p_project_id AND storage_mode = 'cloud'),
        'local_clips', (SELECT COUNT(*) FROM backlot_dailies_clips WHERE project_id = p_project_id AND storage_mode = 'local_drive'),
        'total_notes', (
            SELECT COUNT(*) FROM backlot_dailies_clip_notes n
            JOIN backlot_dailies_clips c ON c.id = n.dailies_clip_id
            WHERE c.project_id = p_project_id
        ),
        'unresolved_notes', (
            SELECT COUNT(*) FROM backlot_dailies_clip_notes n
            JOIN backlot_dailies_clips c ON c.id = n.dailies_clip_id
            WHERE c.project_id = p_project_id AND n.is_resolved = FALSE
        )
    ) INTO result;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get dailies day summary with counts
CREATE OR REPLACE FUNCTION get_dailies_day_summary(p_day_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'card_count', (SELECT COUNT(*) FROM backlot_dailies_cards WHERE dailies_day_id = p_day_id),
        'clip_count', (
            SELECT COUNT(*) FROM backlot_dailies_clips c
            JOIN backlot_dailies_cards card ON card.id = c.dailies_card_id
            WHERE card.dailies_day_id = p_day_id
        ),
        'circle_take_count', (
            SELECT COUNT(*) FROM backlot_dailies_clips c
            JOIN backlot_dailies_cards card ON card.id = c.dailies_card_id
            WHERE card.dailies_day_id = p_day_id AND c.is_circle_take = TRUE
        ),
        'total_duration_seconds', (
            SELECT COALESCE(SUM(c.duration_seconds), 0) FROM backlot_dailies_clips c
            JOIN backlot_dailies_cards card ON card.id = c.dailies_card_id
            WHERE card.dailies_day_id = p_day_id
        )
    ) INTO result;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_dailies_days IS 'Shoot days for dailies organization';
COMMENT ON TABLE backlot_dailies_cards IS 'Camera cards/rolls containing dailies clips';
COMMENT ON TABLE backlot_dailies_clips IS 'Individual dailies clips with metadata';
COMMENT ON TABLE backlot_dailies_clip_notes IS 'Timestamped notes on dailies clips';
COMMENT ON COLUMN backlot_dailies_cards.storage_mode IS 'cloud = proxies in cloud storage, local_drive = metadata only, media on physical drive';
COMMENT ON COLUMN backlot_dailies_clips.relative_path IS 'Path relative to media_root_path for local drive mode';
COMMENT ON COLUMN backlot_dailies_clips.cloud_url IS 'URL to proxy or streaming asset for cloud mode';
