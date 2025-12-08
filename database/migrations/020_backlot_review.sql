-- =====================================================
-- Migration 020: Backlot Review System (Frame.io-style)
-- Per-project review assets with versions, time-coded notes,
-- and Vimeo-ready video provider abstraction
-- =====================================================

-- =====================================================
-- Review Versions (version stack per asset)
-- Created FIRST so we can reference from assets
-- video_provider: 'placeholder', 'vimeo', 'youtube', 'local', etc.
-- external_video_id: Vimeo ID, YouTube ID, etc. for external providers
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_review_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL, -- FK added after backlot_review_assets is created
    version_number INTEGER NOT NULL DEFAULT 1, -- Auto-increment version number
    name TEXT, -- Optional label like "Final Cut", "Music Pass"
    video_provider TEXT NOT NULL DEFAULT 'placeholder',
    video_url TEXT NOT NULL, -- Direct video URL for placeholder provider
    external_video_id TEXT, -- Vimeo ID, YouTube ID for external providers
    duration_seconds NUMERIC, -- cached duration if available
    thumbnail_url TEXT, -- optional thumbnail
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Review Assets (per project)
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_review_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT, -- optional thumbnail for the asset card
    linked_scene_id UUID, -- optional link to backlot_scenes
    linked_shot_list_id UUID, -- optional link to shot list
    active_version_id UUID REFERENCES backlot_review_versions(id) ON DELETE SET NULL,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now add the FK constraint from versions to assets
ALTER TABLE backlot_review_versions
    ADD CONSTRAINT fk_review_versions_asset
    FOREIGN KEY (asset_id) REFERENCES backlot_review_assets(id) ON DELETE CASCADE;

-- Indexes for review assets
CREATE INDEX IF NOT EXISTS idx_backlot_review_assets_project
    ON backlot_review_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_assets_created_by
    ON backlot_review_assets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_assets_created_at
    ON backlot_review_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backlot_review_assets_active_version
    ON backlot_review_assets(active_version_id) WHERE active_version_id IS NOT NULL;

-- Indexes for review versions
CREATE INDEX IF NOT EXISTS idx_backlot_review_versions_asset
    ON backlot_review_versions(asset_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_versions_created_at
    ON backlot_review_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backlot_review_versions_number
    ON backlot_review_versions(asset_id, version_number DESC);

-- =====================================================
-- Time-coded Notes
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_review_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES backlot_review_versions(id) ON DELETE CASCADE,
    timecode_seconds NUMERIC, -- timestamp in seconds (null for general notes)
    timecode_end_seconds NUMERIC, -- optional end time for range notes
    author_user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    note_type TEXT DEFAULT 'general', -- "general", "audio", "color", "vfx", "continuity", etc.
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by_user_id UUID REFERENCES profiles(id),
    drawing_data JSONB, -- annotation data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for review notes
CREATE INDEX IF NOT EXISTS idx_backlot_review_notes_version
    ON backlot_review_notes(version_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_notes_author
    ON backlot_review_notes(author_user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_notes_time
    ON backlot_review_notes(version_id, timecode_seconds);
CREATE INDEX IF NOT EXISTS idx_backlot_review_notes_resolved
    ON backlot_review_notes(version_id, is_resolved);

-- =====================================================
-- Note Replies (threads)
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_review_note_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES backlot_review_notes(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for note replies
CREATE INDEX IF NOT EXISTS idx_backlot_review_note_replies_note
    ON backlot_review_note_replies(note_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_note_replies_author
    ON backlot_review_note_replies(author_user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_review_note_replies_created
    ON backlot_review_note_replies(note_id, created_at);

-- =====================================================
-- Trigger to update updated_at timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_backlot_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all review tables
DROP TRIGGER IF EXISTS trigger_review_assets_updated_at ON backlot_review_assets;
CREATE TRIGGER trigger_review_assets_updated_at
    BEFORE UPDATE ON backlot_review_assets
    FOR EACH ROW EXECUTE FUNCTION update_backlot_review_updated_at();

DROP TRIGGER IF EXISTS trigger_review_versions_updated_at ON backlot_review_versions;
CREATE TRIGGER trigger_review_versions_updated_at
    BEFORE UPDATE ON backlot_review_versions
    FOR EACH ROW EXECUTE FUNCTION update_backlot_review_updated_at();

DROP TRIGGER IF EXISTS trigger_review_notes_updated_at ON backlot_review_notes;
CREATE TRIGGER trigger_review_notes_updated_at
    BEFORE UPDATE ON backlot_review_notes
    FOR EACH ROW EXECUTE FUNCTION update_backlot_review_updated_at();

DROP TRIGGER IF EXISTS trigger_review_note_replies_updated_at ON backlot_review_note_replies;
CREATE TRIGGER trigger_review_note_replies_updated_at
    BEFORE UPDATE ON backlot_review_note_replies
    FOR EACH ROW EXECUTE FUNCTION update_backlot_review_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS on all review tables
ALTER TABLE backlot_review_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_review_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_review_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_review_note_replies ENABLE ROW LEVEL SECURITY;

-- Review Assets Policies
DROP POLICY IF EXISTS review_assets_select ON backlot_review_assets;
CREATE POLICY review_assets_select ON backlot_review_assets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = backlot_review_assets.project_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_assets_insert ON backlot_review_assets;
CREATE POLICY review_assets_insert ON backlot_review_assets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = backlot_review_assets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('admin', 'producer', 'director', 'editor')
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_assets_update ON backlot_review_assets;
CREATE POLICY review_assets_update ON backlot_review_assets
    FOR UPDATE USING (
        created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = backlot_review_assets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_assets_delete ON backlot_review_assets;
CREATE POLICY review_assets_delete ON backlot_review_assets
    FOR DELETE USING (
        created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = backlot_review_assets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

-- Review Versions Policies
DROP POLICY IF EXISTS review_versions_select ON backlot_review_versions;
CREATE POLICY review_versions_select ON backlot_review_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_review_assets ra
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE ra.id = backlot_review_versions.asset_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_versions_insert ON backlot_review_versions;
CREATE POLICY review_versions_insert ON backlot_review_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_review_assets ra
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE ra.id = backlot_review_versions.asset_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('admin', 'producer', 'director', 'editor')
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_versions_update ON backlot_review_versions;
CREATE POLICY review_versions_update ON backlot_review_versions
    FOR UPDATE USING (
        created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_review_assets ra
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE ra.id = backlot_review_versions.asset_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_versions_delete ON backlot_review_versions;
CREATE POLICY review_versions_delete ON backlot_review_versions
    FOR DELETE USING (
        created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_review_assets ra
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE ra.id = backlot_review_versions.asset_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

-- Review Notes Policies (access via version -> asset -> project)
DROP POLICY IF EXISTS review_notes_select ON backlot_review_notes;
CREATE POLICY review_notes_select ON backlot_review_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_review_versions rv
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rv.id = backlot_review_notes.version_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_notes_insert ON backlot_review_notes;
CREATE POLICY review_notes_insert ON backlot_review_notes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_review_versions rv
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rv.id = backlot_review_notes.version_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_notes_update ON backlot_review_notes;
CREATE POLICY review_notes_update ON backlot_review_notes
    FOR UPDATE USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_review_versions rv
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rv.id = backlot_review_notes.version_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_notes_delete ON backlot_review_notes;
CREATE POLICY review_notes_delete ON backlot_review_notes
    FOR DELETE USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_review_versions rv
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rv.id = backlot_review_notes.version_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

-- Note Replies Policies
DROP POLICY IF EXISTS review_note_replies_select ON backlot_review_note_replies;
CREATE POLICY review_note_replies_select ON backlot_review_note_replies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_review_notes rn
            JOIN backlot_review_versions rv ON rv.id = rn.version_id
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rn.id = backlot_review_note_replies.note_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_note_replies_insert ON backlot_review_note_replies;
CREATE POLICY review_note_replies_insert ON backlot_review_note_replies
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_review_notes rn
            JOIN backlot_review_versions rv ON rv.id = rn.version_id
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rn.id = backlot_review_note_replies.note_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_note_replies_update ON backlot_review_note_replies;
CREATE POLICY review_note_replies_update ON backlot_review_note_replies
    FOR UPDATE USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

DROP POLICY IF EXISTS review_note_replies_delete ON backlot_review_note_replies;
CREATE POLICY review_note_replies_delete ON backlot_review_note_replies
    FOR DELETE USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_review_notes rn
            JOIN backlot_review_versions rv ON rv.id = rn.version_id
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            JOIN backlot_project_members pm ON pm.project_id = ra.project_id
            WHERE rn.id = backlot_review_note_replies.note_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_superadmin = TRUE
        )
    );

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE backlot_review_assets IS 'Review assets (cuts/clips) for Frame.io-style review workflow';
COMMENT ON TABLE backlot_review_versions IS 'Version stack for review assets with Vimeo-ready video provider abstraction';
COMMENT ON COLUMN backlot_review_versions.video_provider IS 'Video provider: placeholder, vimeo, youtube, local, etc.';
COMMENT ON COLUMN backlot_review_versions.video_url IS 'Video URL for placeholder provider, external ID for other providers';
COMMENT ON TABLE backlot_review_notes IS 'Time-coded notes/comments on review versions';
COMMENT ON COLUMN backlot_review_notes.drawing_json IS 'JSON data for annotation drawings (placeholder for future implementation)';
COMMENT ON TABLE backlot_review_note_replies IS 'Threaded replies on review notes';
