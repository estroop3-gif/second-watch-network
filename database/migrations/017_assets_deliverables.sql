-- Migration 017: Assets, Media, and Deliverables Tracker
-- Metadata tracking for episodes, cuts, trailers, deliverables to various platforms

-- =============================================================================
-- ASSETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Asset identification
    asset_type TEXT NOT NULL CHECK (asset_type IN (
        'episode',
        'feature',
        'trailer',
        'teaser',
        'social',
        'bts',
        'other'
    )),

    title TEXT NOT NULL,
    description TEXT NULL,

    -- Technical metadata
    duration_seconds INTEGER NULL,
    version_label TEXT NULL,  -- "v1", "v2", "director's cut", etc.

    -- External reference (not storing files, just metadata/URL reference)
    file_reference TEXT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started',
        'in_progress',
        'in_review',
        'approved',
        'delivered'
    )),

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_by_user_id UUID NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assets_project ON backlot_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON backlot_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON backlot_assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_project_type ON backlot_assets(project_id, asset_type);

-- =============================================================================
-- DELIVERABLE TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_deliverable_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template identification
    name TEXT NOT NULL,
    description TEXT NULL,
    target_platform TEXT NOT NULL,

    -- Technical specifications (JSONB for flexibility)
    specs JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Whether this is a system template (available to all) or custom
    is_system_template BOOLEAN NOT NULL DEFAULT false,
    owner_user_id UUID NULL REFERENCES auth.users(id),

    -- Active/inactive
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deliverable_templates_platform ON backlot_deliverable_templates(target_platform);
CREATE INDEX IF NOT EXISTS idx_deliverable_templates_active ON backlot_deliverable_templates(is_active);

-- =============================================================================
-- PROJECT DELIVERABLES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_project_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES backlot_assets(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES backlot_deliverable_templates(id) ON DELETE RESTRICT,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started',
        'in_progress',
        'in_review',
        'approved',
        'delivered'
    )),

    -- Dates
    due_date DATE NULL,
    delivered_date DATE NULL,

    -- Review info
    reviewer_name TEXT NULL,
    notes TEXT NULL,

    -- Custom specs override (if different from template)
    custom_specs JSONB NULL,

    -- Audit
    created_by_user_id UUID NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_deliverables_project ON backlot_project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_asset ON backlot_project_deliverables(asset_id);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_template ON backlot_project_deliverables(template_id);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_status ON backlot_project_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_due ON backlot_project_deliverables(due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_deliverables_unique ON backlot_project_deliverables(asset_id, template_id);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_assets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assets_updated_at ON backlot_assets;
CREATE TRIGGER assets_updated_at
    BEFORE UPDATE ON backlot_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_assets_timestamp();

DROP TRIGGER IF EXISTS deliverable_templates_updated_at ON backlot_deliverable_templates;
CREATE TRIGGER deliverable_templates_updated_at
    BEFORE UPDATE ON backlot_deliverable_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_assets_timestamp();

DROP TRIGGER IF EXISTS project_deliverables_updated_at ON backlot_project_deliverables;
CREATE TRIGGER project_deliverables_updated_at
    BEFORE UPDATE ON backlot_project_deliverables
    FOR EACH ROW
    EXECUTE FUNCTION update_assets_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_deliverable_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_deliverables ENABLE ROW LEVEL SECURITY;

-- Assets: project members can view, producer/post supervisor/admin can modify
CREATE POLICY "assets_select" ON backlot_assets
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
            WHERE project_id = backlot_assets.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "assets_insert" ON backlot_assets
    FOR INSERT WITH CHECK (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin/editor or specific roles
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_assets.project_id
            AND user_id = auth.uid()
            AND (role IN ('admin', 'editor') OR production_role IN ('producer', 'post_supervisor'))
        )
    );

CREATE POLICY "assets_update" ON backlot_assets
    FOR UPDATE USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin/editor or specific roles
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_assets.project_id
            AND user_id = auth.uid()
            AND (role IN ('admin', 'editor') OR production_role IN ('producer', 'post_supervisor'))
        )
    );

CREATE POLICY "assets_delete" ON backlot_assets
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
            WHERE project_id = backlot_assets.project_id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Deliverable templates: all can view system templates, users can manage their own
CREATE POLICY "templates_select" ON backlot_deliverable_templates
    FOR SELECT USING (
        is_system_template = true
        OR owner_user_id = auth.uid()
        OR owner_user_id IS NULL
    );

CREATE POLICY "templates_insert" ON backlot_deliverable_templates
    FOR INSERT WITH CHECK (
        -- Users can create their own templates
        owner_user_id = auth.uid()
        OR owner_user_id IS NULL
    );

CREATE POLICY "templates_update" ON backlot_deliverable_templates
    FOR UPDATE USING (
        -- Users can update their own templates
        owner_user_id = auth.uid()
        -- System templates can only be updated by admins (handled at app level)
    );

CREATE POLICY "templates_delete" ON backlot_deliverable_templates
    FOR DELETE USING (
        -- Users can delete their own templates
        owner_user_id = auth.uid()
        AND is_system_template = false
    );

-- Project deliverables: inherit from project permissions
CREATE POLICY "project_deliverables_select" ON backlot_project_deliverables
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_assets a
            JOIN backlot_projects p ON p.id = a.project_id
            WHERE a.id = asset_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id AND user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "project_deliverables_insert" ON backlot_project_deliverables
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_assets a
            JOIN backlot_projects p ON p.id = a.project_id
            WHERE a.id = asset_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND (role IN ('admin', 'editor') OR production_role IN ('producer', 'post_supervisor'))
                )
            )
        )
    );

CREATE POLICY "project_deliverables_update" ON backlot_project_deliverables
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_assets a
            JOIN backlot_projects p ON p.id = a.project_id
            WHERE a.id = asset_id
            AND (
                p.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM backlot_project_members
                    WHERE project_id = p.id
                    AND user_id = auth.uid()
                    AND (role IN ('admin', 'editor') OR production_role IN ('producer', 'post_supervisor'))
                )
            )
        )
    );

CREATE POLICY "project_deliverables_delete" ON backlot_project_deliverables
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_assets a
            JOIN backlot_projects p ON p.id = a.project_id
            WHERE a.id = asset_id
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
-- SEED DEFAULT DELIVERABLE TEMPLATES
-- =============================================================================

INSERT INTO backlot_deliverable_templates (name, description, target_platform, specs, is_system_template)
VALUES
    (
        'Second Watch Platform – Series',
        'Standard deliverable specs for episodic content on Second Watch',
        'Second Watch',
        '{
            "resolution": "1920x1080",
            "codec": "H.264",
            "bitrate": "15-20 Mbps",
            "audio": "AAC 48kHz Stereo",
            "container": "MP4",
            "captions": "SRT or VTT required",
            "aspect_ratio": "16:9"
        }'::jsonb,
        true
    ),
    (
        'Second Watch Platform – Feature',
        'Feature film deliverable specs for Second Watch',
        'Second Watch',
        '{
            "resolution": "1920x1080 or 3840x2160",
            "codec": "H.264 or H.265",
            "bitrate": "20-50 Mbps",
            "audio": "AAC 48kHz 5.1 Surround",
            "container": "MP4",
            "captions": "SRT or VTT required",
            "aspect_ratio": "varies"
        }'::jsonb,
        true
    ),
    (
        'YouTube 4K',
        'Optimized for YouTube 4K uploads',
        'YouTube',
        '{
            "resolution": "3840x2160",
            "codec": "H.264 or VP9",
            "bitrate": "35-45 Mbps",
            "audio": "AAC 48kHz Stereo",
            "container": "MP4 or WebM",
            "captions": "SRT for auto-sync",
            "aspect_ratio": "16:9"
        }'::jsonb,
        true
    ),
    (
        'YouTube HD',
        'Standard HD deliverable for YouTube',
        'YouTube',
        '{
            "resolution": "1920x1080",
            "codec": "H.264",
            "bitrate": "8-12 Mbps",
            "audio": "AAC 48kHz Stereo",
            "container": "MP4",
            "captions": "SRT for auto-sync",
            "aspect_ratio": "16:9"
        }'::jsonb,
        true
    ),
    (
        'Instagram Reels',
        'Vertical format for Instagram Reels',
        'Instagram',
        '{
            "resolution": "1080x1920",
            "codec": "H.264",
            "bitrate": "3.5 Mbps",
            "audio": "AAC 48kHz Stereo",
            "container": "MP4",
            "max_duration": "90 seconds",
            "aspect_ratio": "9:16"
        }'::jsonb,
        true
    ),
    (
        'TikTok',
        'Vertical format for TikTok',
        'TikTok',
        '{
            "resolution": "1080x1920",
            "codec": "H.264",
            "bitrate": "2-4 Mbps",
            "audio": "AAC 44.1kHz Stereo",
            "container": "MP4",
            "max_duration": "180 seconds",
            "aspect_ratio": "9:16"
        }'::jsonb,
        true
    ),
    (
        'Film Festival DCP',
        'Digital Cinema Package for festival screenings',
        'Festival',
        '{
            "resolution": "2048x1080 (2K) or 4096x2160 (4K)",
            "codec": "JPEG2000",
            "bitrate": "250 Mbps",
            "audio": "PCM 48kHz or 96kHz 5.1/7.1",
            "container": "MXF",
            "color_space": "XYZ",
            "aspect_ratio": "varies (Flat 1.85:1 or Scope 2.39:1)"
        }'::jsonb,
        true
    ),
    (
        'Film Festival ProRes',
        'ProRes master for festival submissions',
        'Festival',
        '{
            "resolution": "1920x1080 or native",
            "codec": "ProRes 422 HQ or ProRes 4444",
            "audio": "PCM 48kHz",
            "container": "MOV",
            "color_space": "Rec.709",
            "aspect_ratio": "native"
        }'::jsonb,
        true
    ),
    (
        'Broadcast HD (US)',
        'US broadcast television standards',
        'Broadcast',
        '{
            "resolution": "1920x1080i or 1280x720p",
            "codec": "XDCAM HD or DNxHD",
            "bitrate": "50 Mbps",
            "audio": "PCM 48kHz Stereo + M&E",
            "container": "MXF",
            "captions": "CEA-608/708 embedded",
            "loudness": "-24 LKFS"
        }'::jsonb,
        true
    ),
    (
        'Vimeo HD',
        'Optimized for Vimeo hosting',
        'Vimeo',
        '{
            "resolution": "1920x1080",
            "codec": "H.264",
            "bitrate": "10-20 Mbps",
            "audio": "AAC 48kHz Stereo",
            "container": "MP4",
            "captions": "SRT or VTT",
            "aspect_ratio": "16:9"
        }'::jsonb,
        true
    ),
    (
        'Twitter/X Video',
        'Optimized for Twitter/X uploads',
        'Twitter',
        '{
            "resolution": "1280x720 or 1920x1080",
            "codec": "H.264",
            "bitrate": "5 Mbps max",
            "audio": "AAC",
            "container": "MP4",
            "max_duration": "140 seconds",
            "aspect_ratio": "16:9 or 1:1"
        }'::jsonb,
        true
    ),
    (
        'Podcast Video',
        'Video podcast format',
        'Podcast',
        '{
            "resolution": "1920x1080",
            "codec": "H.264",
            "bitrate": "5-10 Mbps",
            "audio": "AAC 48kHz Stereo, -16 LUFS",
            "container": "MP4",
            "aspect_ratio": "16:9"
        }'::jsonb,
        true
    )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get deliverables summary for a project
CREATE OR REPLACE FUNCTION get_project_deliverables_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_assets', (
            SELECT COUNT(*) FROM backlot_assets WHERE project_id = p_project_id
        ),
        'total_deliverables', COUNT(*),
        'by_status', jsonb_build_object(
            'not_started', COUNT(*) FILTER (WHERE status = 'not_started'),
            'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
            'in_review', COUNT(*) FILTER (WHERE status = 'in_review'),
            'approved', COUNT(*) FILTER (WHERE status = 'approved'),
            'delivered', COUNT(*) FILTER (WHERE status = 'delivered')
        ),
        'delivered_count', COUNT(*) FILTER (WHERE status = 'delivered'),
        'upcoming_deadlines', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', pd.id,
                'asset_title', a.title,
                'template_name', t.name,
                'due_date', pd.due_date,
                'status', pd.status
            ) ORDER BY pd.due_date), '[]'::jsonb)
            FROM backlot_project_deliverables pd
            JOIN backlot_assets a ON a.id = pd.asset_id
            JOIN backlot_deliverable_templates t ON t.id = pd.template_id
            WHERE pd.project_id = p_project_id
            AND pd.due_date IS NOT NULL
            AND pd.due_date >= CURRENT_DATE
            AND pd.status NOT IN ('delivered', 'approved')
            ORDER BY pd.due_date
            LIMIT 5
        ),
        'overdue_count', COUNT(*) FILTER (
            WHERE due_date < CURRENT_DATE
            AND status NOT IN ('delivered', 'approved')
        )
    ) INTO result
    FROM backlot_project_deliverables
    WHERE project_id = p_project_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get assets summary for a project
CREATE OR REPLACE FUNCTION get_project_assets_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'by_type', jsonb_build_object(
            'episode', COUNT(*) FILTER (WHERE asset_type = 'episode'),
            'feature', COUNT(*) FILTER (WHERE asset_type = 'feature'),
            'trailer', COUNT(*) FILTER (WHERE asset_type = 'trailer'),
            'teaser', COUNT(*) FILTER (WHERE asset_type = 'teaser'),
            'social', COUNT(*) FILTER (WHERE asset_type = 'social'),
            'bts', COUNT(*) FILTER (WHERE asset_type = 'bts'),
            'other', COUNT(*) FILTER (WHERE asset_type = 'other')
        ),
        'by_status', jsonb_build_object(
            'not_started', COUNT(*) FILTER (WHERE status = 'not_started'),
            'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
            'in_review', COUNT(*) FILTER (WHERE status = 'in_review'),
            'approved', COUNT(*) FILTER (WHERE status = 'approved'),
            'delivered', COUNT(*) FILTER (WHERE status = 'delivered')
        )
    ) INTO result
    FROM backlot_assets
    WHERE project_id = p_project_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_assets IS 'Master list of project assets (episodes, features, trailers, etc.) - metadata only';
COMMENT ON TABLE backlot_deliverable_templates IS 'Templates defining deliverable specs for different platforms';
COMMENT ON TABLE backlot_project_deliverables IS 'Tracks specific deliverables for each asset to each platform';
COMMENT ON FUNCTION get_project_deliverables_summary IS 'Returns summary statistics for project deliverables';
COMMENT ON FUNCTION get_project_assets_summary IS 'Returns summary statistics for project assets';
