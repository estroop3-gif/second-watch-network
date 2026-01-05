-- Migration: 064_seasons_episodes.sql
-- Description: Season and Episode structure for Worlds
-- Part of: Consumer Streaming Platform

-- =============================================================================
-- SEASONS - Container for episodic content
-- =============================================================================
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Identification
    season_number INTEGER NOT NULL,
    title TEXT, -- Optional title like "The Beginning"
    description TEXT,

    -- Visual Assets
    cover_art_url TEXT,
    thumbnail_url TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'unreleased' CHECK (status IN ('unreleased', 'releasing', 'complete')),

    -- Dates
    premiere_date DATE,
    finale_date DATE,

    -- Metrics (denormalized)
    episode_count INTEGER DEFAULT 0,
    total_runtime_minutes INTEGER DEFAULT 0,

    -- Ordering
    sort_order INTEGER DEFAULT 0, -- For non-sequential season ordering

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_seasons_world ON seasons(world_id);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_premiere ON seasons(premiere_date);

-- =============================================================================
-- EPISODES - Individual episode content
-- =============================================================================
CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE, -- Denormalized for queries

    -- Identification
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,

    -- Video Asset (FK added after video_assets table created)
    video_asset_id UUID,

    -- Visual Assets
    thumbnail_url TEXT,
    still_images JSONB DEFAULT '[]', -- Array of still image URLs

    -- Technical
    duration_seconds INTEGER,
    runtime_display TEXT, -- Formatted runtime "42:15"

    -- Status & Visibility
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'processing', 'qc_pending', 'qc_approved', 'qc_rejected',
        'scheduled', 'published', 'unlisted', 'archived'
    )),
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'unlisted', 'private', 'premium')),

    -- QC Workflow
    qc_status TEXT CHECK (qc_status IN ('pending', 'in_review', 'approved', 'rejected', 'revision_requested')),
    qc_notes TEXT,
    qc_reviewed_by UUID REFERENCES profiles(id),
    qc_reviewed_at TIMESTAMPTZ,

    -- Release Schedule
    scheduled_release TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Playback Markers (for skip intro, credits, etc.)
    intro_start_seconds INTEGER,
    intro_end_seconds INTEGER,
    credits_start_seconds INTEGER,
    recap_end_seconds INTEGER,

    -- Metrics (denormalized)
    view_count BIGINT DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    UNIQUE(season_id, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_episodes_world ON episodes(world_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);
CREATE INDEX IF NOT EXISTS idx_episodes_visibility_public ON episodes(visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_episodes_published ON episodes(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_scheduled ON episodes(scheduled_release) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_episodes_qc_status ON episodes(qc_status);

-- =============================================================================
-- TRIGGER: Update season/world counters when episodes change
-- =============================================================================
CREATE OR REPLACE FUNCTION update_episode_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update season episode count
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE seasons SET
            episode_count = (SELECT COUNT(*) FROM episodes WHERE season_id = NEW.season_id AND status = 'published'),
            total_runtime_minutes = (SELECT COALESCE(SUM(duration_seconds), 0) / 60 FROM episodes WHERE season_id = NEW.season_id AND status = 'published'),
            updated_at = NOW()
        WHERE id = NEW.season_id;

        -- Update world counters
        UPDATE worlds SET
            episode_count = (SELECT COUNT(*) FROM episodes WHERE world_id = NEW.world_id AND status = 'published'),
            season_count = (SELECT COUNT(DISTINCT season_id) FROM episodes WHERE world_id = NEW.world_id AND status = 'published'),
            last_content_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = NEW.world_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE seasons SET
            episode_count = (SELECT COUNT(*) FROM episodes WHERE season_id = OLD.season_id AND status = 'published'),
            total_runtime_minutes = (SELECT COALESCE(SUM(duration_seconds), 0) / 60 FROM episodes WHERE season_id = OLD.season_id AND status = 'published'),
            updated_at = NOW()
        WHERE id = OLD.season_id;

        UPDATE worlds SET
            episode_count = (SELECT COUNT(*) FROM episodes WHERE world_id = OLD.world_id AND status = 'published'),
            season_count = (SELECT COUNT(DISTINCT season_id) FROM episodes WHERE world_id = OLD.world_id AND status = 'published'),
            updated_at = NOW()
        WHERE id = OLD.world_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS episodes_update_counts ON episodes;
CREATE TRIGGER episodes_update_counts
    AFTER INSERT OR UPDATE OR DELETE ON episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_episode_counts();

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_seasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seasons_updated_at ON seasons;
CREATE TRIGGER seasons_updated_at
    BEFORE UPDATE ON seasons
    FOR EACH ROW
    EXECUTE FUNCTION update_seasons_updated_at();

CREATE OR REPLACE FUNCTION update_episodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS episodes_updated_at ON episodes;
CREATE TRIGGER episodes_updated_at
    BEFORE UPDATE ON episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_episodes_updated_at();
