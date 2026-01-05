-- Migration: 070_streaming_rls.sql
-- Description: Row Level Security Policies and Helper Functions for Streaming Platform
-- Part of: Consumer Streaming Platform

-- =============================================================================
-- ENABLE RLS ON ALL STREAMING TABLES
-- =============================================================================
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_renditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hls_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_thumbnails ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_sprite_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_content_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_event_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_event_viewer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE genre_tags ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER: Check if user is admin
-- =============================================================================
CREATE OR REPLACE FUNCTION is_streaming_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = p_user_id
        AND (is_admin = TRUE OR is_superadmin = TRUE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- WORLDS RLS POLICIES
-- =============================================================================

-- Anyone can view public worlds
DROP POLICY IF EXISTS worlds_select_public ON worlds;
CREATE POLICY worlds_select_public ON worlds
    FOR SELECT USING (visibility = 'public' AND status IN ('active', 'complete', 'coming_soon'));

-- Creators can view their own worlds (any visibility/status)
DROP POLICY IF EXISTS worlds_select_own ON worlds;
CREATE POLICY worlds_select_own ON worlds
    FOR SELECT USING (creator_id = auth.uid());

-- Admins can view all
DROP POLICY IF EXISTS worlds_select_admin ON worlds;
CREATE POLICY worlds_select_admin ON worlds
    FOR SELECT USING (is_streaming_admin(auth.uid()));

-- Creators can insert their own worlds
DROP POLICY IF EXISTS worlds_insert ON worlds;
CREATE POLICY worlds_insert ON worlds
    FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Creators can update their own worlds
DROP POLICY IF EXISTS worlds_update_own ON worlds;
CREATE POLICY worlds_update_own ON worlds
    FOR UPDATE USING (creator_id = auth.uid());

-- Admins can update any world
DROP POLICY IF EXISTS worlds_update_admin ON worlds;
CREATE POLICY worlds_update_admin ON worlds
    FOR UPDATE USING (is_streaming_admin(auth.uid()));

-- =============================================================================
-- SEASONS RLS POLICIES
-- =============================================================================

-- Public seasons of public worlds
DROP POLICY IF EXISTS seasons_select_public ON seasons;
CREATE POLICY seasons_select_public ON seasons
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.visibility = 'public')
    );

-- Creators can manage their world's seasons
DROP POLICY IF EXISTS seasons_manage_own ON seasons;
CREATE POLICY seasons_manage_own ON seasons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.creator_id = auth.uid())
    );

-- =============================================================================
-- EPISODES RLS POLICIES
-- =============================================================================

-- Public episodes of public worlds
DROP POLICY IF EXISTS episodes_select_public ON episodes;
CREATE POLICY episodes_select_public ON episodes
    FOR SELECT USING (
        visibility = 'public' AND status = 'published'
        AND EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.visibility = 'public')
    );

-- Premium episodes for premium users
DROP POLICY IF EXISTS episodes_select_premium ON episodes;
CREATE POLICY episodes_select_premium ON episodes
    FOR SELECT USING (
        visibility = 'premium' AND status = 'published'
        AND EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.visibility = 'public')
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_premium = TRUE)
    );

-- Creators can manage their world's episodes
DROP POLICY IF EXISTS episodes_manage_own ON episodes;
CREATE POLICY episodes_manage_own ON episodes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.creator_id = auth.uid())
    );

-- =============================================================================
-- VIDEO ASSETS RLS POLICIES
-- =============================================================================

-- Owners can manage their assets
DROP POLICY IF EXISTS video_assets_owner ON video_assets;
CREATE POLICY video_assets_owner ON video_assets
    FOR ALL USING (owner_id = auth.uid());

-- Public episodes grant read access to their video assets
DROP POLICY IF EXISTS video_assets_public_episode ON video_assets;
CREATE POLICY video_assets_public_episode ON video_assets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM episodes e
            JOIN worlds w ON w.id = e.world_id
            WHERE e.video_asset_id = video_assets.id
            AND e.status = 'published' AND e.visibility IN ('public', 'premium')
            AND w.visibility = 'public'
        )
    );

-- =============================================================================
-- VIDEO RENDITIONS / HLS / THUMBNAILS - Follow video_assets access
-- =============================================================================

DROP POLICY IF EXISTS video_renditions_access ON video_renditions;
CREATE POLICY video_renditions_access ON video_renditions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM video_assets va WHERE va.id = video_asset_id AND (
            va.owner_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM episodes e
                JOIN worlds w ON w.id = e.world_id
                WHERE e.video_asset_id = va.id
                AND e.status = 'published'
                AND w.visibility = 'public'
            )
        ))
    );

DROP POLICY IF EXISTS hls_manifests_access ON hls_manifests;
CREATE POLICY hls_manifests_access ON hls_manifests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM video_assets va WHERE va.id = video_asset_id AND (
            va.owner_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM episodes e
                JOIN worlds w ON w.id = e.world_id
                WHERE e.video_asset_id = va.id
                AND e.status = 'published'
                AND w.visibility = 'public'
            )
        ))
    );

DROP POLICY IF EXISTS video_thumbnails_access ON video_thumbnails;
CREATE POLICY video_thumbnails_access ON video_thumbnails
    FOR SELECT USING (TRUE); -- Thumbnails are public

DROP POLICY IF EXISTS video_subtitles_access ON video_subtitles;
CREATE POLICY video_subtitles_access ON video_subtitles
    FOR SELECT USING (TRUE); -- Subtitles are public

-- =============================================================================
-- WORLD CONTENT RLS POLICIES
-- =============================================================================

-- Public content of public worlds
DROP POLICY IF EXISTS world_content_select_public ON world_content;
CREATE POLICY world_content_select_public ON world_content
    FOR SELECT USING (
        status = 'published' AND visibility = 'public'
        AND EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.visibility = 'public')
    );

-- Followers can see followers-only content
DROP POLICY IF EXISTS world_content_select_followers ON world_content;
CREATE POLICY world_content_select_followers ON world_content
    FOR SELECT USING (
        status = 'published' AND visibility = 'followers_only'
        AND EXISTS (SELECT 1 FROM world_follows wf WHERE wf.world_id = world_content.world_id AND wf.user_id = auth.uid())
    );

-- Creators can manage their content
DROP POLICY IF EXISTS world_content_manage_creator ON world_content;
CREATE POLICY world_content_manage_creator ON world_content
    FOR ALL USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.creator_id = auth.uid())
    );

-- =============================================================================
-- FOLLOWS & WATCHLIST RLS POLICIES
-- =============================================================================

-- Users can see their own follows
DROP POLICY IF EXISTS world_follows_select_own ON world_follows;
CREATE POLICY world_follows_select_own ON world_follows
    FOR SELECT USING (user_id = auth.uid());

-- Users can manage their own follows
DROP POLICY IF EXISTS world_follows_manage ON world_follows;
CREATE POLICY world_follows_manage ON world_follows
    FOR ALL USING (user_id = auth.uid());

-- Watchlist - users can only see and manage their own
DROP POLICY IF EXISTS world_watchlist_own ON world_watchlist;
CREATE POLICY world_watchlist_own ON world_watchlist
    FOR ALL USING (user_id = auth.uid());

-- Watch history - users can only see and manage their own
DROP POLICY IF EXISTS watch_history_own ON watch_history;
CREATE POLICY watch_history_own ON watch_history
    FOR ALL USING (user_id = auth.uid());

-- =============================================================================
-- CREDITS RLS POLICIES
-- =============================================================================

-- World credits are public for public worlds
DROP POLICY IF EXISTS world_credits_public ON world_credits;
CREATE POLICY world_credits_public ON world_credits
    FOR SELECT USING (
        is_public = TRUE
        AND EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.visibility = 'public')
    );

-- Creators can manage their world's credits
DROP POLICY IF EXISTS world_credits_manage ON world_credits;
CREATE POLICY world_credits_manage ON world_credits
    FOR ALL USING (
        EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.creator_id = auth.uid())
    );

-- Episode credits follow same pattern
DROP POLICY IF EXISTS episode_credits_public ON episode_credits;
CREATE POLICY episode_credits_public ON episode_credits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM episodes e
            JOIN worlds w ON w.id = e.world_id
            WHERE e.id = episode_id
            AND e.status = 'published'
            AND w.visibility = 'public'
        )
    );

-- =============================================================================
-- LIVE EVENTS RLS POLICIES
-- =============================================================================

-- Public events of public worlds
DROP POLICY IF EXISTS live_events_select_public ON live_events;
CREATE POLICY live_events_select_public ON live_events
    FOR SELECT USING (
        visibility = 'public'
        AND EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.visibility = 'public')
    );

-- Followers can see followers-only events
DROP POLICY IF EXISTS live_events_select_followers ON live_events;
CREATE POLICY live_events_select_followers ON live_events
    FOR SELECT USING (
        visibility = 'followers_only'
        AND EXISTS (SELECT 1 FROM world_follows wf WHERE wf.world_id = live_events.world_id AND wf.user_id = auth.uid())
    );

-- Creators can manage their events
DROP POLICY IF EXISTS live_events_manage ON live_events;
CREATE POLICY live_events_manage ON live_events
    FOR ALL USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM worlds w WHERE w.id = world_id AND w.creator_id = auth.uid())
    );

-- RSVPs - users can manage their own
DROP POLICY IF EXISTS live_event_rsvps_own ON live_event_rsvps;
CREATE POLICY live_event_rsvps_own ON live_event_rsvps
    FOR ALL USING (user_id = auth.uid());

-- Chat - public for event participants
DROP POLICY IF EXISTS live_event_chat_view ON live_event_chat;
CREATE POLICY live_event_chat_view ON live_event_chat
    FOR SELECT USING (
        NOT is_hidden
        AND EXISTS (
            SELECT 1 FROM live_events le
            JOIN worlds w ON w.id = le.world_id
            WHERE le.id = event_id
            AND (le.visibility = 'public' OR EXISTS (
                SELECT 1 FROM world_follows wf WHERE wf.world_id = w.id AND wf.user_id = auth.uid()
            ))
        )
    );

-- Users can insert their own chat messages
DROP POLICY IF EXISTS live_event_chat_insert ON live_event_chat;
CREATE POLICY live_event_chat_insert ON live_event_chat
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- MODERATION QUEUE RLS POLICIES
-- =============================================================================

-- Admins can view and manage all
DROP POLICY IF EXISTS moderation_queue_admin ON content_moderation_queue;
CREATE POLICY moderation_queue_admin ON content_moderation_queue
    FOR ALL USING (is_streaming_admin(auth.uid()));

-- Submitters can view their own submissions
DROP POLICY IF EXISTS moderation_queue_submitter ON content_moderation_queue;
CREATE POLICY moderation_queue_submitter ON content_moderation_queue
    FOR SELECT USING (submitted_by = auth.uid());

-- =============================================================================
-- GENRE TAGS - Public read
-- =============================================================================

DROP POLICY IF EXISTS genre_tags_select ON genre_tags;
CREATE POLICY genre_tags_select ON genre_tags
    FOR SELECT USING (is_active = TRUE);

-- =============================================================================
-- LIKES & BOOKMARKS RLS POLICIES
-- =============================================================================

-- Users can manage their own likes
DROP POLICY IF EXISTS world_content_likes_own ON world_content_likes;
CREATE POLICY world_content_likes_own ON world_content_likes
    FOR ALL USING (user_id = auth.uid());

-- Users can manage their own bookmarks
DROP POLICY IF EXISTS world_content_bookmarks_own ON world_content_bookmarks;
CREATE POLICY world_content_bookmarks_own ON world_content_bookmarks
    FOR ALL USING (user_id = auth.uid());

-- =============================================================================
-- HELPER FUNCTIONS FOR STREAMING PLATFORM
-- =============================================================================

-- Get World details with stats
CREATE OR REPLACE FUNCTION get_world_details(p_world_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'world', row_to_json(w),
        'genres', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', g.id,
                'name', g.name,
                'slug', g.slug,
                'is_primary', wg.is_primary
            )), '[]'::jsonb)
            FROM world_genres wg
            JOIN genre_tags g ON g.id = wg.genre_id
            WHERE wg.world_id = p_world_id
        ),
        'seasons', (
            SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.season_number), '[]'::jsonb)
            FROM seasons s WHERE s.world_id = p_world_id
        ),
        'featured_credits', (
            SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.billing_order, c.sort_order), '[]'::jsonb)
            FROM world_credits c
            WHERE c.world_id = p_world_id AND c.is_featured = TRUE
            LIMIT 10
        ),
        'is_following', (
            SELECT EXISTS (SELECT 1 FROM world_follows wf WHERE wf.world_id = p_world_id AND wf.user_id = p_user_id)
        ),
        'is_in_watchlist', (
            SELECT EXISTS (SELECT 1 FROM world_watchlist ww WHERE ww.world_id = p_world_id AND ww.user_id = p_user_id)
        ),
        'upcoming_events', (
            SELECT COALESCE(jsonb_agg(row_to_json(le) ORDER BY le.scheduled_start), '[]'::jsonb)
            FROM live_events le
            WHERE le.world_id = p_world_id AND le.status = 'scheduled' AND le.scheduled_start > NOW()
            LIMIT 3
        )
    ) INTO result
    FROM worlds w
    WHERE w.id = p_world_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get episodes for a season
CREATE OR REPLACE FUNCTION get_season_episodes(p_season_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', e.id,
            'episode_number', e.episode_number,
            'title', e.title,
            'description', e.description,
            'thumbnail_url', e.thumbnail_url,
            'duration_seconds', e.duration_seconds,
            'runtime_display', e.runtime_display,
            'status', e.status,
            'visibility', e.visibility,
            'published_at', e.published_at,
            'view_count', e.view_count,
            'watch_progress', (
                SELECT jsonb_build_object(
                    'position', wh.position_seconds,
                    'completed', wh.completed
                )
                FROM watch_history wh
                WHERE wh.episode_id = e.id AND wh.user_id = p_user_id
            )
        ) ORDER BY e.episode_number), '[]'::jsonb)
        FROM episodes e
        WHERE e.season_id = p_season_id
        AND e.status = 'published'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search worlds
CREATE OR REPLACE FUNCTION search_worlds(
    p_query TEXT DEFAULT NULL,
    p_genre_slug TEXT DEFAULT NULL,
    p_format TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    slug TEXT,
    logline TEXT,
    thumbnail_url TEXT,
    cover_art_url TEXT,
    content_format TEXT,
    maturity_rating TEXT,
    follower_count INTEGER,
    episode_count INTEGER,
    genres JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.title,
        w.slug,
        w.logline,
        w.thumbnail_url,
        w.cover_art_url,
        w.content_format,
        w.maturity_rating,
        w.follower_count,
        w.episode_count,
        (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('name', g.name, 'slug', g.slug)), '[]'::jsonb)
            FROM world_genres wg
            JOIN genre_tags g ON g.id = wg.genre_id
            WHERE wg.world_id = w.id
        )
    FROM worlds w
    WHERE w.visibility = 'public'
    AND w.status IN ('active', 'complete', 'coming_soon')
    AND (p_query IS NULL OR (
        w.title ILIKE '%' || p_query || '%'
        OR w.logline ILIKE '%' || p_query || '%'
    ))
    AND (p_format IS NULL OR w.content_format = p_format)
    AND (p_genre_slug IS NULL OR EXISTS (
        SELECT 1 FROM world_genres wg
        JOIN genre_tags g ON g.id = wg.genre_id
        WHERE wg.world_id = w.id AND g.slug = p_genre_slug
    ))
    ORDER BY w.follower_count DESC, w.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get shorts feed (TikTok-style)
CREATE OR REPLACE FUNCTION get_shorts_feed(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    view_count BIGINT,
    like_count INTEGER,
    world_id UUID,
    world_title TEXT,
    world_slug TEXT,
    world_thumbnail TEXT,
    is_liked BOOLEAN,
    is_bookmarked BOOLEAN,
    published_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        wc.id,
        wc.title,
        wc.description,
        wc.thumbnail_url,
        wc.duration_seconds,
        wc.view_count,
        wc.like_count,
        w.id,
        w.title,
        w.slug,
        w.thumbnail_url,
        EXISTS (SELECT 1 FROM world_content_likes l WHERE l.content_id = wc.id AND l.user_id = p_user_id),
        EXISTS (SELECT 1 FROM world_content_bookmarks b WHERE b.content_id = wc.id AND b.user_id = p_user_id),
        wc.published_at
    FROM world_content wc
    JOIN worlds w ON w.id = wc.world_id
    WHERE wc.content_type = 'short'
    AND wc.status = 'published'
    AND w.visibility = 'public'
    AND (p_cursor IS NULL OR wc.published_at < p_cursor)
    ORDER BY wc.published_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
