-- Migration 082: World Categories and Recommendations
-- Phase 3C: Sports/motorsports world types and recommendation foundations
--
-- This migration:
-- 1. Adds world_category and sub_category to worlds
-- 2. Creates recommendation tracking tables
-- 3. Adds sports/motorsports specific fields

BEGIN;

-- =============================================================================
-- PART 1: World Categories
-- =============================================================================

-- World category enum for high-level classification
CREATE TYPE world_category AS ENUM (
    'narrative',      -- Scripted fiction (films, series, shorts)
    'documentary',    -- Non-fiction documentaries
    'sports',         -- Sports content (games, matches, competitions)
    'motorsports',    -- Motorsports (racing, rallies, stunt shows)
    'testimony',      -- Faith testimonies, inspirational stories
    'worship',        -- Worship, music, church content
    'educational',    -- Teaching, tutorials, how-to
    'experimental',   -- Art films, experimental content
    'podcast',        -- Video podcasts, talk shows
    'news',           -- News, current events
    'other'           -- Uncategorized
);

-- Add category fields to worlds
ALTER TABLE worlds
    ADD COLUMN IF NOT EXISTS world_category world_category DEFAULT 'narrative',
    ADD COLUMN IF NOT EXISTS sub_category TEXT,
    ADD COLUMN IF NOT EXISTS sport_type TEXT,
    ADD COLUMN IF NOT EXISTS sport_league TEXT,
    ADD COLUMN IF NOT EXISTS sport_team TEXT,
    ADD COLUMN IF NOT EXISTS is_live_content BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS typical_episode_duration_minutes INTEGER;

-- Index for category queries
CREATE INDEX IF NOT EXISTS idx_worlds_category ON worlds(world_category);
CREATE INDEX IF NOT EXISTS idx_worlds_sport_type ON worlds(sport_type) WHERE sport_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worlds_is_live ON worlds(is_live_content) WHERE is_live_content = true;

-- Common sport types for reference (stored as text for flexibility)
COMMENT ON COLUMN worlds.sport_type IS
'Common sport types: backyard_football, flag_football, basketball, baseball, soccer,
volleyball, wrestling, mma, boxing, skateboarding, bmx, motocross, rally, dirt_track,
drag_racing, drift, stunt_show, rodeo, fishing, hunting, hiking, climbing, other';

-- =============================================================================
-- PART 2: Recommendation Tables
-- =============================================================================

-- User watch preferences (derived from watch history)
CREATE TABLE IF NOT EXISTS user_watch_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Category preferences (from watch patterns)
    preferred_categories JSONB DEFAULT '{}',
    preferred_genres JSONB DEFAULT '{}',
    preferred_sport_types JSONB DEFAULT '{}',

    -- Viewing patterns
    avg_watch_session_minutes INTEGER,
    preferred_watch_times JSONB DEFAULT '{}',
    completion_rate DECIMAL(5,2),

    -- Content preferences
    prefers_series BOOLEAN,
    prefers_films BOOLEAN,
    prefers_shorts BOOLEAN,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Recommendation impressions (track what was recommended)
CREATE TABLE IF NOT EXISTS recommendation_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Context
    recommendation_type TEXT NOT NULL,
    recommendation_reason TEXT,
    position_in_list INTEGER,
    list_context TEXT,

    -- Engagement
    was_clicked BOOLEAN DEFAULT false,
    clicked_at TIMESTAMPTZ,
    watch_started BOOLEAN DEFAULT false,
    watch_completed BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for recommendation tracking
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_user ON recommendation_impressions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_world ON recommendation_impressions(world_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_type ON recommendation_impressions(recommendation_type);

-- World similarity scores (pre-computed)
CREATE TABLE IF NOT EXISTS world_similarity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_a_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    world_b_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Similarity metrics
    genre_similarity DECIMAL(5,4) DEFAULT 0,
    category_similarity DECIMAL(5,4) DEFAULT 0,
    creator_similarity DECIMAL(5,4) DEFAULT 0,
    audience_overlap DECIMAL(5,4) DEFAULT 0,

    -- Combined score
    total_similarity DECIMAL(5,4) DEFAULT 0,

    -- Timestamps
    computed_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_a_id, world_b_id)
);

CREATE INDEX IF NOT EXISTS idx_world_similarity_a ON world_similarity_scores(world_a_id, total_similarity DESC);
CREATE INDEX IF NOT EXISTS idx_world_similarity_b ON world_similarity_scores(world_b_id, total_similarity DESC);

-- =============================================================================
-- PART 3: Sports/Motorsports Specific Tables
-- =============================================================================

-- Sports events (for live scheduling)
CREATE TABLE IF NOT EXISTS sports_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Event details
    event_name TEXT NOT NULL,
    event_type TEXT,
    sport_type TEXT,
    league TEXT,

    -- Teams/participants
    home_team TEXT,
    away_team TEXT,
    participants JSONB DEFAULT '[]',

    -- Scheduling
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,

    -- Status
    status TEXT DEFAULT 'scheduled',

    -- Venue
    venue_name TEXT,
    venue_location TEXT,

    -- Associated episode (if recorded/archived)
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT sports_events_status_check
        CHECK (status IN ('scheduled', 'live', 'completed', 'postponed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_sports_events_world ON sports_events(world_id);
CREATE INDEX IF NOT EXISTS idx_sports_events_scheduled ON sports_events(scheduled_start) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_sports_events_live ON sports_events(status) WHERE status = 'live';

-- =============================================================================
-- PART 4: Recommendation Views
-- =============================================================================

-- View for trending Worlds (by category)
CREATE OR REPLACE VIEW v_trending_worlds AS
SELECT
    w.id as world_id,
    w.title,
    w.slug,
    w.logline,
    w.cover_art_url,
    w.world_category,
    w.sub_category,
    w.sport_type,
    w.content_format,
    w.maturity_rating,
    w.follower_count,
    w.total_view_count,
    COALESCE(
        (SELECT SUM(total_watch_seconds)
         FROM world_watch_aggregates
         WHERE world_id = w.id
           AND period_type = 'daily'
           AND period_start >= CURRENT_DATE - INTERVAL '7 days'),
        0
    ) as weekly_watch_seconds,
    COALESCE(
        (SELECT SUM(gross_earnings_cents)
         FROM world_earnings
         WHERE world_id = w.id
           AND period_start >= DATE_TRUNC('month', CURRENT_DATE)),
        0
    ) as monthly_earnings_cents
FROM worlds w
WHERE w.status = 'active'
  AND w.visibility = 'public'
ORDER BY weekly_watch_seconds DESC, follower_count DESC;

-- View for sports-specific content
CREATE OR REPLACE VIEW v_sports_worlds AS
SELECT
    w.id as world_id,
    w.title,
    w.slug,
    w.logline,
    w.cover_art_url,
    w.world_category,
    w.sport_type,
    w.sport_league,
    w.sport_team,
    w.is_live_content,
    w.content_format,
    w.episode_count,
    w.follower_count,
    w.total_view_count,
    (SELECT COUNT(*) FROM sports_events se WHERE se.world_id = w.id AND se.status = 'scheduled') as upcoming_events,
    (SELECT MIN(scheduled_start) FROM sports_events se WHERE se.world_id = w.id AND se.status = 'scheduled') as next_event
FROM worlds w
WHERE w.world_category IN ('sports', 'motorsports')
  AND w.status = 'active'
  AND w.visibility = 'public';

-- =============================================================================
-- PART 5: Functions for Recommendations
-- =============================================================================

-- Function to get related Worlds based on similarity
CREATE OR REPLACE FUNCTION get_related_worlds(
    p_world_id UUID,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    world_id UUID,
    title TEXT,
    similarity_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN wss.world_a_id = p_world_id THEN wss.world_b_id
            ELSE wss.world_a_id
        END as world_id,
        w.title,
        wss.total_similarity as similarity_score
    FROM world_similarity_scores wss
    JOIN worlds w ON w.id = CASE
        WHEN wss.world_a_id = p_world_id THEN wss.world_b_id
        ELSE wss.world_a_id
    END
    WHERE (wss.world_a_id = p_world_id OR wss.world_b_id = p_world_id)
      AND w.status = 'active'
      AND w.visibility = 'public'
    ORDER BY wss.total_similarity DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to compute world similarity (for batch processing)
CREATE OR REPLACE FUNCTION compute_world_similarity(
    p_world_a UUID,
    p_world_b UUID
) RETURNS DECIMAL AS $$
DECLARE
    v_genre_sim DECIMAL := 0;
    v_category_sim DECIMAL := 0;
    v_creator_sim DECIMAL := 0;
    v_audience_overlap DECIMAL := 0;
    v_total DECIMAL;
BEGIN
    -- Get worlds
    SELECT
        -- Category similarity (same category = 0.3)
        CASE WHEN a.world_category = b.world_category THEN 0.3 ELSE 0 END,
        -- Creator similarity (same creator = 0.2, same org = 0.1)
        CASE
            WHEN a.creator_id = b.creator_id THEN 0.2
            WHEN a.organization_id IS NOT NULL AND a.organization_id = b.organization_id THEN 0.1
            ELSE 0
        END
    INTO v_category_sim, v_creator_sim
    FROM worlds a, worlds b
    WHERE a.id = p_world_a AND b.id = p_world_b;

    -- Genre similarity (shared genres)
    SELECT COALESCE(
        (SELECT COUNT(*)::DECIMAL / GREATEST(
            (SELECT COUNT(*) FROM world_genres WHERE world_id = p_world_a),
            1
        ) * 0.3
        FROM world_genres ga
        JOIN world_genres gb ON ga.genre_id = gb.genre_id
        WHERE ga.world_id = p_world_a AND gb.world_id = p_world_b),
        0
    ) INTO v_genre_sim;

    -- Audience overlap (users who watched both)
    SELECT COALESCE(
        (SELECT COUNT(DISTINCT wh_a.user_id)::DECIMAL /
            GREATEST(
                (SELECT COUNT(DISTINCT user_id) FROM watch_history WHERE world_id = p_world_a),
                1
            ) * 0.2
        FROM watch_history wh_a
        JOIN watch_history wh_b ON wh_a.user_id = wh_b.user_id
        WHERE wh_a.world_id = p_world_a AND wh_b.world_id = p_world_b),
        0
    ) INTO v_audience_overlap;

    v_total := v_genre_sim + v_category_sim + v_creator_sim + v_audience_overlap;

    -- Store result
    INSERT INTO world_similarity_scores (
        world_a_id, world_b_id,
        genre_similarity, category_similarity, creator_similarity, audience_overlap,
        total_similarity
    ) VALUES (
        LEAST(p_world_a, p_world_b),
        GREATEST(p_world_a, p_world_b),
        v_genre_sim, v_category_sim, v_creator_sim, v_audience_overlap,
        v_total
    )
    ON CONFLICT (world_a_id, world_b_id) DO UPDATE SET
        genre_similarity = EXCLUDED.genre_similarity,
        category_similarity = EXCLUDED.category_similarity,
        creator_similarity = EXCLUDED.creator_similarity,
        audience_overlap = EXCLUDED.audience_overlap,
        total_similarity = EXCLUDED.total_similarity,
        computed_at = NOW();

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 6: Seed Data
-- =============================================================================

-- Set default categories for existing worlds based on genre hints
UPDATE worlds
SET world_category = 'documentary'
WHERE world_category IS NULL
  AND EXISTS (
      SELECT 1 FROM world_genres wg
      JOIN genres g ON wg.genre_id = g.id
      WHERE wg.world_id = worlds.id
        AND g.name ILIKE '%documentary%'
  );

-- Set remaining nulls to narrative
UPDATE worlds
SET world_category = 'narrative'
WHERE world_category IS NULL;

COMMIT;
