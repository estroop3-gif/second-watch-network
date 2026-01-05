-- Migration: 069_fast_channel_bridge.sql
-- Description: Bridge between Worlds and existing FAST channel system
-- Part of: Consumer Streaming Platform

-- =============================================================================
-- EXTEND FAST_CHANNEL_CONTENT WITH WORLD REFERENCES
-- Links FAST channel content to Worlds and Episodes
-- =============================================================================

-- Add world_id column to link content to Worlds
ALTER TABLE fast_channel_content
    ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES worlds(id) ON DELETE SET NULL;

-- Add episode_id column to link content to Episodes
ALTER TABLE fast_channel_content
    ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL;

-- Add source_type to track origin
ALTER TABLE fast_channel_content
    ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('world', 'episode', 'clip', 'promo', 'standalone'));

-- Add video_asset_id for HLS playback
ALTER TABLE fast_channel_content
    ADD COLUMN IF NOT EXISTS video_asset_id UUID REFERENCES video_assets(id) ON DELETE SET NULL;

-- Add maturity rating
ALTER TABLE fast_channel_content
    ADD COLUMN IF NOT EXISTS maturity_rating TEXT CHECK (maturity_rating IN ('G', 'PG', 'PG-13', 'R', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'));

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_world ON fast_channel_content(world_id);
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_episode ON fast_channel_content(episode_id);
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_source ON fast_channel_content(source_type);
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_video_asset ON fast_channel_content(video_asset_id);

-- =============================================================================
-- FAST CHANNEL PROGRAMMING BLOCKS
-- Group content into themed blocks for scheduling
-- =============================================================================
CREATE TABLE IF NOT EXISTS fast_channel_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES fast_channels(id) ON DELETE CASCADE,

    -- Block info
    name TEXT NOT NULL, -- "Prime Time Drama", "Faith Family Hour", etc.
    description TEXT,
    block_type TEXT CHECK (block_type IN ('series', 'movie', 'mixed', 'special', 'interstitial')),

    -- Timing
    start_time TIME NOT NULL, -- Block start time (e.g., 20:00)
    duration_minutes INTEGER NOT NULL,

    -- Recurrence
    days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday, 6=Saturday
    is_active BOOLEAN DEFAULT TRUE,

    -- World association (optional - for World-themed blocks)
    featured_world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fast_channel_blocks_channel ON fast_channel_blocks(channel_id);
CREATE INDEX IF NOT EXISTS idx_fast_channel_blocks_time ON fast_channel_blocks(start_time);
CREATE INDEX IF NOT EXISTS idx_fast_channel_blocks_active ON fast_channel_blocks(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- FAST CHANNEL BLOCK ITEMS
-- Content within programming blocks
-- =============================================================================
CREATE TABLE IF NOT EXISTS fast_channel_block_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES fast_channel_blocks(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES fast_channel_content(id) ON DELETE CASCADE,

    -- Ordering within block
    position INTEGER NOT NULL,

    -- Timing (relative to block start)
    offset_minutes INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fast_channel_block_items_block ON fast_channel_block_items(block_id);
CREATE INDEX IF NOT EXISTS idx_fast_channel_block_items_content ON fast_channel_block_items(content_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fast_channel_block_items_position ON fast_channel_block_items(block_id, position);

-- =============================================================================
-- EXTEND FAST_CHANNELS WITH ADDITIONAL CONFIG
-- =============================================================================

-- Add channel category
ALTER TABLE fast_channels
    ADD COLUMN IF NOT EXISTS channel_category TEXT DEFAULT 'general' CHECK (channel_category IN ('general', 'movies', 'series', 'faith', 'family', 'documentary', 'shorts'));

-- Add timezone
ALTER TABLE fast_channels
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add 24/7 loop mode
ALTER TABLE fast_channels
    ADD COLUMN IF NOT EXISTS is_24_7 BOOLEAN DEFAULT TRUE;

-- =============================================================================
-- VIEW: FAST Channel Content with World enrichment
-- =============================================================================
CREATE OR REPLACE VIEW fast_channel_world_content AS
SELECT
    fcc.id,
    fcc.title,
    fcc.description,
    fcc.thumbnail_url,
    fcc.video_url,
    fcc.duration_seconds,
    fcc.content_type,
    fcc.genre,
    fcc.rating,
    fcc.year,
    fcc.director,
    fcc.is_active,
    fcc.metadata,
    fcc.world_id,
    fcc.episode_id,
    fcc.source_type,
    fcc.video_asset_id,
    fcc.maturity_rating,
    fcc.created_at,
    fcc.updated_at,
    -- World info
    w.title AS world_title,
    w.slug AS world_slug,
    w.cover_art_url AS world_cover,
    w.content_format AS world_format,
    w.maturity_rating AS world_maturity_rating,
    -- Episode info (if applicable)
    e.title AS episode_title,
    e.episode_number,
    s.season_number,
    s.title AS season_title
FROM fast_channel_content fcc
LEFT JOIN worlds w ON fcc.world_id = w.id
LEFT JOIN episodes e ON fcc.episode_id = e.id
LEFT JOIN seasons s ON e.season_id = s.id
WHERE fcc.is_active = TRUE;

-- =============================================================================
-- VIEW: Current programming for a channel
-- =============================================================================
CREATE OR REPLACE VIEW fast_channel_now_playing AS
SELECT
    fc.id AS channel_id,
    fc.name AS channel_name,
    fc.slug AS channel_slug,
    fc.stream_url,
    fcs.id AS schedule_id,
    fcs.scheduled_start,
    fcs.scheduled_end,
    fcc.id AS content_id,
    fcc.title,
    fcc.description,
    fcc.thumbnail_url,
    fcc.duration_seconds,
    fcc.content_type,
    w.id AS world_id,
    w.title AS world_title,
    w.slug AS world_slug
FROM fast_channels fc
LEFT JOIN fast_channel_schedule fcs ON fcs.channel_id = fc.id
    AND fcs.scheduled_start <= NOW()
    AND fcs.scheduled_end > NOW()
LEFT JOIN fast_channel_content fcc ON fcs.content_id = fcc.id
LEFT JOIN worlds w ON fcc.world_id = w.id
WHERE fc.is_live = TRUE;

-- =============================================================================
-- VIEW: Upcoming programming
-- =============================================================================
CREATE OR REPLACE VIEW fast_channel_upcoming AS
SELECT
    fc.id AS channel_id,
    fc.name AS channel_name,
    fcs.id AS schedule_id,
    fcs.scheduled_start,
    fcs.scheduled_end,
    fcc.id AS content_id,
    fcc.title,
    fcc.description,
    fcc.thumbnail_url,
    fcc.duration_seconds,
    fcc.content_type,
    w.id AS world_id,
    w.title AS world_title,
    w.slug AS world_slug
FROM fast_channels fc
JOIN fast_channel_schedule fcs ON fcs.channel_id = fc.id
    AND fcs.scheduled_start > NOW()
    AND fcs.scheduled_start < NOW() + INTERVAL '24 hours'
JOIN fast_channel_content fcc ON fcs.content_id = fcc.id
LEFT JOIN worlds w ON fcc.world_id = w.id
WHERE fc.is_live = TRUE
ORDER BY fcs.scheduled_start ASC;

-- =============================================================================
-- FUNCTION: Get EPG (Electronic Program Guide) for a channel
-- =============================================================================
CREATE OR REPLACE FUNCTION get_channel_epg(
    p_channel_id UUID,
    p_start_time TIMESTAMPTZ DEFAULT NOW(),
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    schedule_id UUID,
    content_id UUID,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    content_type TEXT,
    duration_seconds INTEGER,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    world_id UUID,
    world_title TEXT,
    world_slug TEXT,
    is_current BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fcs.id,
        fcc.id,
        fcc.title,
        fcc.description,
        fcc.thumbnail_url,
        fcc.content_type,
        fcc.duration_seconds,
        fcs.scheduled_start,
        fcs.scheduled_end,
        w.id,
        w.title,
        w.slug,
        (fcs.scheduled_start <= NOW() AND fcs.scheduled_end > NOW())
    FROM fast_channel_schedule fcs
    JOIN fast_channel_content fcc ON fcs.content_id = fcc.id
    LEFT JOIN worlds w ON fcc.world_id = w.id
    WHERE fcs.channel_id = p_channel_id
    AND fcs.scheduled_start >= p_start_time
    AND fcs.scheduled_start < p_start_time + (p_hours || ' hours')::INTERVAL
    ORDER BY fcs.scheduled_start ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Create schedule entries from episodes in a World
-- Useful for scheduling all episodes of a series
-- =============================================================================
CREATE OR REPLACE FUNCTION schedule_world_episodes(
    p_channel_id UUID,
    p_world_id UUID,
    p_start_time TIMESTAMPTZ,
    p_gap_minutes INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
    v_current_time TIMESTAMPTZ := p_start_time;
    v_episode RECORD;
    v_count INTEGER := 0;
    v_content_id UUID;
BEGIN
    FOR v_episode IN
        SELECT e.id, e.title, e.description, e.thumbnail_url, e.duration_seconds, e.video_asset_id
        FROM episodes e
        JOIN seasons s ON s.id = e.season_id
        WHERE e.world_id = p_world_id
        AND e.status = 'published'
        ORDER BY s.season_number, e.episode_number
    LOOP
        -- Create or get fast_channel_content entry
        INSERT INTO fast_channel_content (
            title, description, thumbnail_url, video_url, duration_seconds,
            content_type, world_id, episode_id, source_type, video_asset_id
        ) VALUES (
            v_episode.title,
            v_episode.description,
            v_episode.thumbnail_url,
            '', -- video_url handled by video_asset
            v_episode.duration_seconds,
            'episode',
            p_world_id,
            v_episode.id,
            'episode',
            v_episode.video_asset_id
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_content_id;

        -- If insert didn't happen, find existing
        IF v_content_id IS NULL THEN
            SELECT id INTO v_content_id FROM fast_channel_content
            WHERE episode_id = v_episode.id LIMIT 1;
        END IF;

        -- Create schedule entry
        INSERT INTO fast_channel_schedule (
            channel_id, content_id, scheduled_start, scheduled_end
        ) VALUES (
            p_channel_id,
            v_content_id,
            v_current_time,
            v_current_time + (v_episode.duration_seconds || ' seconds')::INTERVAL
        );

        v_current_time := v_current_time + (v_episode.duration_seconds || ' seconds')::INTERVAL + (p_gap_minutes || ' minutes')::INTERVAL;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
