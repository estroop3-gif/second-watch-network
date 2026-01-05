-- Migration: 067_follows_credits.sql
-- Description: World Following System and Public Credits
-- Part of: Consumer Streaming Platform
-- Note: World follows are ONE-WAY (unlike bidirectional Connections)

-- =============================================================================
-- WORLD FOLLOWS - One-way follow relationships
-- Users follow Worlds to get updates on content
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Notification Preferences (per-follow customization)
    notify_new_episodes BOOLEAN DEFAULT TRUE,
    notify_companion_drops BOOLEAN DEFAULT TRUE,
    notify_live_events BOOLEAN DEFAULT TRUE,
    notify_announcements BOOLEAN DEFAULT TRUE,
    notify_shorts BOOLEAN DEFAULT FALSE, -- Off by default to reduce noise

    -- Engagement tracking
    notifications_enabled BOOLEAN DEFAULT TRUE, -- Master switch

    -- Audit
    followed_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_world_follows_world ON world_follows(world_id);
CREATE INDEX IF NOT EXISTS idx_world_follows_user ON world_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_world_follows_date ON world_follows(followed_at DESC);

-- =============================================================================
-- TRIGGER: Update world follower count
-- =============================================================================
CREATE OR REPLACE FUNCTION update_world_follower_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE worlds SET follower_count = follower_count + 1 WHERE id = NEW.world_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE worlds SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.world_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS world_follows_count ON world_follows;
CREATE TRIGGER world_follows_count
    AFTER INSERT OR DELETE ON world_follows
    FOR EACH ROW
    EXECUTE FUNCTION update_world_follower_count();

-- =============================================================================
-- WATCHLIST - Saved Worlds for later viewing
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT, -- User can add personal notes
    UNIQUE(world_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_world_watchlist_world ON world_watchlist(world_id);
CREATE INDEX IF NOT EXISTS idx_world_watchlist_user ON world_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_world_watchlist_date ON world_watchlist(added_at DESC);

-- =============================================================================
-- WATCH HISTORY - Track viewing progress
-- =============================================================================
CREATE TABLE IF NOT EXISTS watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
    world_content_id UUID REFERENCES world_content(id) ON DELETE CASCADE,

    -- World for quick queries
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Progress
    position_seconds NUMERIC(10,3) NOT NULL DEFAULT 0,
    duration_seconds NUMERIC(10,3),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    -- Device tracking
    device_type TEXT, -- 'web', 'ios', 'android', 'roku', 'firetv', 'appletv', 'androidtv'
    device_id TEXT,

    -- Session tracking
    session_id UUID,
    last_watched_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints: must have either episode_id or world_content_id
    CONSTRAINT watch_history_content_check CHECK (
        (episode_id IS NOT NULL AND world_content_id IS NULL) OR
        (episode_id IS NULL AND world_content_id IS NOT NULL)
    )
);

-- Unique constraint: one progress record per user per content
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_episode ON watch_history(user_id, episode_id) WHERE episode_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_content ON watch_history(user_id, world_content_id) WHERE world_content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_world ON watch_history(world_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_last_watched ON watch_history(user_id, last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_history_continue ON watch_history(user_id, completed, last_watched_at DESC) WHERE completed = FALSE;

-- =============================================================================
-- WORLD CREDITS - Cast and Crew for public display
-- Separate from backlot_project_credits (production credits)
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Credit Info
    department TEXT NOT NULL, -- 'Cast', 'Directing', 'Writing', 'Production', 'Cinematography', 'Sound', 'Music', 'Editing', 'Art', 'VFX', 'Costume', 'Makeup'
    role TEXT NOT NULL, -- 'Director', 'Writer', 'Lead Actor', 'Supporting Actor', 'Producer', etc.
    character_name TEXT, -- For cast: character played

    -- Person
    display_name TEXT NOT NULL, -- Name as displayed in credits
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Linked profile if on platform

    -- External References
    imdb_id TEXT,
    photo_url TEXT,

    -- Visibility & Ordering
    is_featured BOOLEAN DEFAULT FALSE, -- Featured in main credits display (above the fold)
    is_top_billed BOOLEAN DEFAULT FALSE, -- Top billing for cast
    is_public BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    department_order INTEGER DEFAULT 0, -- Order within department
    billing_order INTEGER DEFAULT 0, -- For cast: billing order

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_credits_world ON world_credits(world_id);
CREATE INDEX IF NOT EXISTS idx_world_credits_user ON world_credits(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_world_credits_department ON world_credits(world_id, department);
CREATE INDEX IF NOT EXISTS idx_world_credits_featured ON world_credits(world_id, is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_world_credits_order ON world_credits(world_id, department_order, sort_order);
CREATE INDEX IF NOT EXISTS idx_world_credits_cast ON world_credits(world_id, billing_order) WHERE department = 'Cast';

-- =============================================================================
-- EPISODE CREDITS - Episode-specific credits (guest stars, special credits)
-- =============================================================================
CREATE TABLE IF NOT EXISTS episode_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE, -- Denormalized

    -- Credit Info
    department TEXT NOT NULL,
    role TEXT NOT NULL,
    character_name TEXT,
    display_name TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- External References
    imdb_id TEXT,
    photo_url TEXT,

    -- Flags
    is_guest BOOLEAN DEFAULT FALSE, -- Guest star
    is_recurring BOOLEAN DEFAULT FALSE, -- Recurring character
    is_special_appearance BOOLEAN DEFAULT FALSE, -- Special appearance/cameo

    -- Ordering
    sort_order INTEGER DEFAULT 0,
    billing_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_episode_credits_episode ON episode_credits(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_credits_world ON episode_credits(world_id);
CREATE INDEX IF NOT EXISTS idx_episode_credits_user ON episode_credits(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_episode_credits_guest ON episode_credits(episode_id, is_guest) WHERE is_guest = TRUE;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Check if user follows a world
CREATE OR REPLACE FUNCTION user_follows_world(p_user_id UUID, p_world_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM world_follows
        WHERE user_id = p_user_id AND world_id = p_world_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's followed worlds with latest activity
CREATE OR REPLACE FUNCTION get_user_followed_worlds(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    world_id UUID,
    title TEXT,
    slug TEXT,
    cover_art_url TEXT,
    thumbnail_url TEXT,
    last_content_date DATE,
    new_episode_count INTEGER,
    has_live_event BOOLEAN,
    followed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.title,
        w.slug,
        w.cover_art_url,
        w.thumbnail_url,
        w.last_content_date,
        (SELECT COUNT(*)::INTEGER FROM episodes e
         WHERE e.world_id = w.id
         AND e.published_at > wf.followed_at) AS new_episode_count,
        EXISTS (
            SELECT 1 FROM live_events le
            WHERE le.world_id = w.id
            AND le.status = 'scheduled'
            AND le.scheduled_start > NOW()
        ) AS has_live_event,
        wf.followed_at
    FROM world_follows wf
    JOIN worlds w ON w.id = wf.world_id
    WHERE wf.user_id = p_user_id
    AND w.visibility = 'public'
    AND w.status IN ('active', 'complete', 'coming_soon')
    ORDER BY w.last_content_date DESC NULLS LAST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get continue watching list for user
CREATE OR REPLACE FUNCTION get_continue_watching(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    episode_id UUID,
    episode_title TEXT,
    episode_number INTEGER,
    season_number INTEGER,
    world_id UUID,
    world_title TEXT,
    world_slug TEXT,
    thumbnail_url TEXT,
    position_seconds NUMERIC,
    duration_seconds NUMERIC,
    progress_percent INTEGER,
    last_watched_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.episode_number,
        s.season_number,
        w.id,
        w.title,
        w.slug,
        COALESCE(e.thumbnail_url, w.thumbnail_url),
        wh.position_seconds,
        wh.duration_seconds,
        CASE
            WHEN wh.duration_seconds > 0 THEN ((wh.position_seconds / wh.duration_seconds) * 100)::INTEGER
            ELSE 0
        END,
        wh.last_watched_at
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN seasons s ON s.id = e.season_id
    JOIN worlds w ON w.id = e.world_id
    WHERE wh.user_id = p_user_id
    AND wh.completed = FALSE
    AND wh.episode_id IS NOT NULL
    AND e.status = 'published'
    AND w.visibility = 'public'
    ORDER BY wh.last_watched_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS world_credits_updated_at ON world_credits;
CREATE TRIGGER world_credits_updated_at
    BEFORE UPDATE ON world_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_credits_updated_at();
