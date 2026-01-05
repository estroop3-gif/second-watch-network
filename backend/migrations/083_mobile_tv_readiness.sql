-- Migration 083: Mobile/TV Readiness
-- Phase 4A: Device metadata, unified home feed, mobile-friendly session APIs
--
-- This migration:
-- 1. Adds device/client metadata to watch tracking
-- 2. Creates home feed cache structure
-- 3. Extends playback sessions for mobile/TV
-- 4. Adds API client tracking

BEGIN;

-- =============================================================================
-- PART 1: Device and Client Metadata
-- =============================================================================

-- Device type enum for consistent tracking
CREATE TYPE device_type AS ENUM (
    'web',
    'mobile_ios',
    'mobile_android',
    'tv_android',
    'tv_roku',
    'tv_firetv',
    'tv_appletv',
    'tv_samsung',
    'tv_lg',
    'desktop_macos',
    'desktop_windows',
    'desktop_linux',
    'unknown'
);

-- Extend watch_history with device info
ALTER TABLE watch_history
    ADD COLUMN IF NOT EXISTS device_type device_type DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS client_version TEXT,
    ADD COLUMN IF NOT EXISTS client_platform TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Extend playback_sessions with device info
ALTER TABLE playback_sessions
    ADD COLUMN IF NOT EXISTS device_type device_type DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS device_id TEXT,
    ADD COLUMN IF NOT EXISTS client_version TEXT,
    ADD COLUMN IF NOT EXISTS client_platform TEXT,
    ADD COLUMN IF NOT EXISTS ip_address INET,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS is_mobile BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_tv BOOLEAN DEFAULT false;

-- Index for device analytics
CREATE INDEX IF NOT EXISTS idx_watch_history_device ON watch_history(device_type, updated_at);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_device ON playback_sessions(device_type, started_at);

-- =============================================================================
-- PART 2: API Clients Registry
-- =============================================================================

-- Track registered API clients (for feature gating, analytics)
CREATE TABLE IF NOT EXISTS api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Client identification
    client_id TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    client_type device_type NOT NULL,

    -- Version info
    current_version TEXT,
    min_supported_version TEXT,

    -- Feature flags
    features_enabled JSONB DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'active',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT api_clients_status_check
        CHECK (status IN ('active', 'deprecated', 'disabled'))
);

-- Client usage stats (daily aggregates)
CREATE TABLE IF NOT EXISTS api_client_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    client_version TEXT,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Request counts
    total_requests INTEGER DEFAULT 0,
    auth_requests INTEGER DEFAULT 0,
    playback_requests INTEGER DEFAULT 0,
    search_requests INTEGER DEFAULT 0,

    -- User counts
    unique_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,

    -- Playback metrics
    playback_sessions_created INTEGER DEFAULT 0,
    total_watch_seconds BIGINT DEFAULT 0,

    -- Error counts
    error_4xx_count INTEGER DEFAULT 0,
    error_5xx_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(client_id, client_version, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_api_client_usage_date ON api_client_usage(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_api_client_usage_client ON api_client_usage(client_id, usage_date DESC);

-- =============================================================================
-- PART 3: Home Feed Cache
-- =============================================================================

-- Cached home feed sections (for performance)
CREATE TABLE IF NOT EXISTS home_feed_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cache key (user_id NULL = anonymous/default)
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    cache_key TEXT NOT NULL,

    -- Cached content
    sections JSONB NOT NULL DEFAULT '[]',

    -- Cache metadata
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cache_ttl_seconds INTEGER DEFAULT 300,

    -- Flags
    is_personalized BOOLEAN DEFAULT false,

    UNIQUE(user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_home_feed_cache_user ON home_feed_cache(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_home_feed_cache_expiry ON home_feed_cache(expires_at);

-- =============================================================================
-- PART 4: Enhanced Playback Sessions
-- =============================================================================

-- Add fields for mobile/TV playback
ALTER TABLE playback_sessions
    ADD COLUMN IF NOT EXISTS hls_url TEXT,
    ADD COLUMN IF NOT EXISTS hls_url_backup TEXT,
    ADD COLUMN IF NOT EXISTS drm_license_url TEXT,
    ADD COLUMN IF NOT EXISTS access_token TEXT,
    ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ad_breaks JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS heartbeat_count INTEGER DEFAULT 0;

-- Session access log (for debugging, security)
CREATE TABLE IF NOT EXISTS playback_session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES playback_sessions(id) ON DELETE CASCADE,

    -- Event details
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',

    -- Context
    device_type device_type,
    ip_address INET,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playback_session_events_session ON playback_session_events(session_id, created_at DESC);

-- Constraint for event types
ALTER TABLE playback_session_events
    ADD CONSTRAINT playback_session_events_type_check
    CHECK (event_type IN (
        'created', 'started', 'paused', 'resumed', 'seeked',
        'heartbeat', 'quality_changed', 'error', 'completed',
        'ad_started', 'ad_completed', 'ad_skipped',
        'download_started', 'download_completed'
    ));

-- =============================================================================
-- PART 5: User Device Preferences
-- =============================================================================

-- User's device-specific settings
CREATE TABLE IF NOT EXISTS user_device_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_type device_type NOT NULL,

    -- Playback preferences
    preferred_quality TEXT DEFAULT 'auto',
    autoplay_enabled BOOLEAN DEFAULT true,
    subtitles_enabled BOOLEAN DEFAULT false,
    subtitle_language TEXT DEFAULT 'en',
    audio_language TEXT DEFAULT 'en',

    -- Notification preferences
    push_notifications_enabled BOOLEAN DEFAULT true,
    new_episode_notifications BOOLEAN DEFAULT true,
    live_event_notifications BOOLEAN DEFAULT true,

    -- UI preferences
    dark_mode BOOLEAN DEFAULT true,

    -- Last used
    last_used_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, device_type)
);

-- =============================================================================
-- PART 6: Views for Client Analytics
-- =============================================================================

-- Device usage summary
CREATE OR REPLACE VIEW v_device_usage_summary AS
SELECT
    device_type,
    DATE_TRUNC('day', updated_at) as usage_date,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_records,
    SUM(position_seconds) as total_watch_seconds
FROM watch_history
WHERE updated_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY device_type, DATE_TRUNC('day', updated_at)
ORDER BY usage_date DESC, unique_users DESC;

-- Active playback sessions by device
CREATE OR REPLACE VIEW v_active_sessions_by_device AS
SELECT
    device_type,
    COUNT(*) as active_sessions,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (NOW() - started_at))) as avg_session_duration_seconds
FROM playback_sessions
WHERE status = 'active'
  AND last_heartbeat_at >= NOW() - INTERVAL '5 minutes'
GROUP BY device_type
ORDER BY active_sessions DESC;

-- Client version distribution
CREATE OR REPLACE VIEW v_client_version_distribution AS
SELECT
    client_id,
    client_version,
    usage_date,
    unique_users,
    total_requests,
    playback_sessions_created,
    error_4xx_count + error_5xx_count as total_errors
FROM api_client_usage
WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY usage_date DESC, unique_users DESC;

-- =============================================================================
-- PART 7: Functions
-- =============================================================================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_home_feed_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM home_feed_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log playback event
CREATE OR REPLACE FUNCTION log_playback_event(
    p_session_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_session RECORD;
BEGIN
    -- Get session info
    SELECT device_type, ip_address INTO v_session
    FROM playback_sessions
    WHERE id = p_session_id;

    -- Insert event
    INSERT INTO playback_session_events (
        session_id, event_type, event_data,
        device_type, ip_address
    ) VALUES (
        p_session_id, p_event_type, p_event_data,
        v_session.device_type, v_session.ip_address
    )
    RETURNING id INTO v_event_id;

    -- Update session heartbeat if applicable
    IF p_event_type IN ('heartbeat', 'started', 'resumed') THEN
        UPDATE playback_sessions
        SET last_heartbeat_at = NOW(),
            heartbeat_count = heartbeat_count + 1
        WHERE id = p_session_id;
    END IF;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 8: Seed Data
-- =============================================================================

-- Register known API clients
INSERT INTO api_clients (client_id, client_name, client_type, current_version, min_supported_version)
VALUES
    ('swn-web', 'Second Watch Web App', 'web', '1.0.0', '1.0.0'),
    ('swn-ios', 'Second Watch iOS', 'mobile_ios', '1.0.0', '1.0.0'),
    ('swn-android', 'Second Watch Android', 'mobile_android', '1.0.0', '1.0.0'),
    ('swn-tvos', 'Second Watch Apple TV', 'tv_appletv', '1.0.0', '1.0.0'),
    ('swn-roku', 'Second Watch Roku', 'tv_roku', '1.0.0', '1.0.0'),
    ('swn-firetv', 'Second Watch Fire TV', 'tv_firetv', '1.0.0', '1.0.0'),
    ('swn-androidtv', 'Second Watch Android TV', 'tv_android', '1.0.0', '1.0.0')
ON CONFLICT (client_id) DO NOTHING;

COMMIT;
