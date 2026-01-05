-- Migration: 068_live_events.sql
-- Description: Live Events - Premieres, Watch Parties, Q&A Sessions
-- Part of: Consumer Streaming Platform

-- =============================================================================
-- LIVE EVENTS - Scheduled live content tied to Worlds
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Event Info
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'premiere', 'watch_party', 'qa', 'behind_scenes', 'announcement', 'live_stream', 'table_read', 'commentary', 'other'
    )),

    -- Visual Assets
    cover_image_url TEXT,
    thumbnail_url TEXT,

    -- Linked Content (for premieres/watch parties)
    linked_episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    linked_content_id UUID REFERENCES world_content(id) ON DELETE SET NULL,

    -- Scheduling
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',

    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'draft', 'scheduled', 'starting', 'live', 'ended', 'cancelled', 'archived'
    )),

    -- Streaming Configuration
    stream_type TEXT DEFAULT 'vod_premiere' CHECK (stream_type IN ('vod_premiere', 'live_input', 'watch_party', 'external')),
    stream_url TEXT, -- HLS or WebRTC URL when live
    stream_key TEXT, -- For live input (MediaLive)
    stream_provider TEXT DEFAULT 'internal', -- 'internal', 'youtube', 'twitch'
    external_stream_id TEXT, -- For external providers

    -- Recording
    is_recording_available BOOLEAN DEFAULT FALSE,
    recording_video_id UUID REFERENCES video_assets(id) ON DELETE SET NULL,
    recording_available_at TIMESTAMPTZ,

    -- Watch Party Sync
    sync_enabled BOOLEAN DEFAULT FALSE, -- For watch parties
    sync_position_seconds NUMERIC(10,3) DEFAULT 0,
    sync_is_playing BOOLEAN DEFAULT FALSE,
    sync_updated_at TIMESTAMPTZ,

    -- Interaction Features
    chat_enabled BOOLEAN DEFAULT TRUE,
    reactions_enabled BOOLEAN DEFAULT TRUE,
    qa_enabled BOOLEAN DEFAULT FALSE, -- Formal Q&A mode with question queue
    comments_enabled BOOLEAN DEFAULT TRUE,

    -- Hosts
    host_ids UUID[] DEFAULT '{}', -- Profiles who can control the event

    -- Metrics (denormalized)
    rsvp_count INTEGER DEFAULT 0,
    peak_concurrent_viewers INTEGER DEFAULT 0,
    total_viewers INTEGER DEFAULT 0,
    total_chat_messages INTEGER DEFAULT 0,

    -- Visibility & Access
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers_only', 'unlisted', 'private')),
    requires_premium BOOLEAN DEFAULT FALSE,

    -- Reminder settings
    reminder_sent_24h BOOLEAN DEFAULT FALSE,
    reminder_sent_1h BOOLEAN DEFAULT FALSE,
    reminder_sent_start BOOLEAN DEFAULT FALSE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_live_events_world ON live_events(world_id);
CREATE INDEX IF NOT EXISTS idx_live_events_scheduled ON live_events(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_live_events_status ON live_events(status);
CREATE INDEX IF NOT EXISTS idx_live_events_type ON live_events(event_type);
CREATE INDEX IF NOT EXISTS idx_live_events_upcoming ON live_events(scheduled_start) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_live_events_live ON live_events(status) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_live_events_episode ON live_events(linked_episode_id);

-- =============================================================================
-- EVENT RSVPs - Track interest/attendance
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- RSVP Status
    rsvp_status TEXT NOT NULL DEFAULT 'interested' CHECK (rsvp_status IN ('interested', 'going', 'declined')),

    -- Notification Preferences
    notify_before_24h BOOLEAN DEFAULT TRUE,
    notify_before_1h BOOLEAN DEFAULT TRUE,
    notify_when_live BOOLEAN DEFAULT TRUE,
    notify_recording_available BOOLEAN DEFAULT TRUE,

    -- Attendance (filled during/after event)
    attended BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    watch_duration_seconds INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_event_rsvps_event ON live_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_live_event_rsvps_user ON live_event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_live_event_rsvps_status ON live_event_rsvps(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_live_event_rsvps_going ON live_event_rsvps(event_id) WHERE rsvp_status IN ('interested', 'going');

-- =============================================================================
-- EVENT CHAT MESSAGES - Live chat during events
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_event_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Message
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'question', 'reaction', 'system', 'pinned')),

    -- For Q&A
    is_answered BOOLEAN DEFAULT FALSE,
    answered_at TIMESTAMPTZ,
    answer_text TEXT,

    -- Moderation
    is_hidden BOOLEAN DEFAULT FALSE,
    hidden_by UUID REFERENCES profiles(id),
    hidden_at TIMESTAMPTZ,
    hidden_reason TEXT,

    -- Pinned messages
    is_pinned BOOLEAN DEFAULT FALSE,
    pinned_by UUID REFERENCES profiles(id),
    pinned_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_event_chat_event ON live_event_chat(event_id);
CREATE INDEX IF NOT EXISTS idx_live_event_chat_user ON live_event_chat(user_id);
CREATE INDEX IF NOT EXISTS idx_live_event_chat_time ON live_event_chat(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_event_chat_questions ON live_event_chat(event_id, is_answered) WHERE message_type = 'question';
CREATE INDEX IF NOT EXISTS idx_live_event_chat_pinned ON live_event_chat(event_id, is_pinned) WHERE is_pinned = TRUE;

-- =============================================================================
-- EVENT VIEWER SESSIONS - Track who's watching
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_event_viewer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for anonymous
    session_id TEXT NOT NULL, -- Client-generated session ID

    -- Device info
    device_type TEXT,
    user_agent TEXT,
    ip_hash TEXT, -- Hashed IP for uniqueness without storing IP

    -- Session timing
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,

    -- Watch metrics
    total_watch_seconds INTEGER DEFAULT 0,
    buffering_count INTEGER DEFAULT 0,
    quality_changes INTEGER DEFAULT 0,
    average_quality TEXT
);

CREATE INDEX IF NOT EXISTS idx_viewer_sessions_event ON live_event_viewer_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_user ON live_event_viewer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_active ON live_event_viewer_sessions(event_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_session ON live_event_viewer_sessions(session_id);

-- =============================================================================
-- TRIGGER: Update RSVP count
-- =============================================================================
CREATE OR REPLACE FUNCTION update_live_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE live_events SET
        rsvp_count = (
            SELECT COUNT(*) FROM live_event_rsvps
            WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
            AND rsvp_status IN ('interested', 'going')
        )
    WHERE id = COALESCE(NEW.event_id, OLD.event_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_event_rsvps_count ON live_event_rsvps;
CREATE TRIGGER live_event_rsvps_count
    AFTER INSERT OR UPDATE OR DELETE ON live_event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION update_live_event_rsvp_count();

-- =============================================================================
-- TRIGGER: Update chat message count
-- =============================================================================
CREATE OR REPLACE FUNCTION update_live_event_chat_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE live_events SET total_chat_messages = total_chat_messages + 1
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE live_events SET total_chat_messages = GREATEST(total_chat_messages - 1, 0)
        WHERE id = OLD.event_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_event_chat_count ON live_event_chat;
CREATE TRIGGER live_event_chat_count
    AFTER INSERT OR DELETE ON live_event_chat
    FOR EACH ROW
    EXECUTE FUNCTION update_live_event_chat_count();

-- =============================================================================
-- FUNCTION: Update concurrent viewer count
-- =============================================================================
CREATE OR REPLACE FUNCTION update_live_event_viewer_count(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO current_count
    FROM live_event_viewer_sessions
    WHERE event_id = p_event_id
    AND is_active = TRUE
    AND last_heartbeat > NOW() - INTERVAL '30 seconds';

    UPDATE live_events SET
        peak_concurrent_viewers = GREATEST(peak_concurrent_viewers, current_count)
    WHERE id = p_event_id;

    RETURN current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get upcoming events for a user's followed worlds
-- =============================================================================
CREATE OR REPLACE FUNCTION get_upcoming_events_for_user(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    event_id UUID,
    world_id UUID,
    world_title TEXT,
    world_slug TEXT,
    event_title TEXT,
    event_type TEXT,
    scheduled_start TIMESTAMPTZ,
    thumbnail_url TEXT,
    rsvp_status TEXT,
    rsvp_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        le.id,
        w.id,
        w.title,
        w.slug,
        le.title,
        le.event_type,
        le.scheduled_start,
        COALESCE(le.thumbnail_url, w.thumbnail_url),
        r.rsvp_status,
        le.rsvp_count
    FROM live_events le
    JOIN worlds w ON w.id = le.world_id
    LEFT JOIN live_event_rsvps r ON r.event_id = le.id AND r.user_id = p_user_id
    WHERE le.status = 'scheduled'
    AND le.scheduled_start > NOW()
    AND le.visibility IN ('public', 'followers_only')
    AND (
        le.visibility = 'public'
        OR EXISTS (SELECT 1 FROM world_follows wf WHERE wf.world_id = w.id AND wf.user_id = p_user_id)
    )
    ORDER BY le.scheduled_start ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_live_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_events_updated_at ON live_events;
CREATE TRIGGER live_events_updated_at
    BEFORE UPDATE ON live_events
    FOR EACH ROW
    EXECUTE FUNCTION update_live_events_updated_at();

DROP TRIGGER IF EXISTS live_event_rsvps_updated_at ON live_event_rsvps;
CREATE TRIGGER live_event_rsvps_updated_at
    BEFORE UPDATE ON live_event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION update_live_events_updated_at();
