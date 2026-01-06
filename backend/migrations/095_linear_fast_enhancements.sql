-- Migration 095: FAST Linear Channel Enhancements
-- Adds free/ads columns, midroll configuration, and linear watch tracking
-- Part of FAST Linear Channels Implementation

BEGIN;

-- ============================================================================
-- L1a: Add free/ads columns to linear_channels
-- ============================================================================

-- is_free: Whether channel is accessible without subscription
ALTER TABLE linear_channels ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT true;

-- has_ads: Whether channel shows advertisements
ALTER TABLE linear_channels ADD COLUMN IF NOT EXISTS has_ads BOOLEAN DEFAULT true;

-- Midroll configuration (in seconds, default 30 minutes)
ALTER TABLE linear_channels ADD COLUMN IF NOT EXISTS midroll_interval_seconds INTEGER DEFAULT 1800;

COMMENT ON COLUMN linear_channels.is_free IS 'Whether channel is accessible to non-subscribers';
COMMENT ON COLUMN linear_channels.has_ads IS 'Whether channel displays advertisements';
COMMENT ON COLUMN linear_channels.midroll_interval_seconds IS 'Interval for mid-roll ads (default 1800 = 30 min)';

-- ============================================================================
-- L1b: Add linear tracking to playback_sessions
-- ============================================================================

-- Link playback sessions to linear channel/block for watch tracking
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES linear_channels(id) ON DELETE SET NULL;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES blocks(id) ON DELETE SET NULL;

-- Add columns needed for watch aggregation (may exist already in some form)
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS duration_watched_seconds INTEGER DEFAULT 0;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER DEFAULT 0;

-- Make asset_id nullable for linear sessions (they track by episode_id instead)
ALTER TABLE playback_sessions ALTER COLUMN asset_id DROP NOT NULL;

-- Index for querying linear sessions
CREATE INDEX IF NOT EXISTS idx_playback_sessions_channel
  ON playback_sessions(channel_id) WHERE channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playback_sessions_block
  ON playback_sessions(block_id) WHERE block_id IS NOT NULL;

-- Index for watch aggregation queries by started_at
CREATE INDEX IF NOT EXISTS idx_playback_sessions_started_at
  ON playback_sessions(started_at);

COMMENT ON COLUMN playback_sessions.channel_id IS 'Linear channel ID if watching linear content';
COMMENT ON COLUMN playback_sessions.block_id IS 'Current block ID if watching linear content';
COMMENT ON COLUMN playback_sessions.duration_watched_seconds IS 'Total seconds watched in this session';
COMMENT ON COLUMN playback_sessions.started_at IS 'When the playback session started';

-- ============================================================================
-- L1c: Update existing channels
-- ============================================================================

-- Main network channel: Free with ads
UPDATE linear_channels
SET is_free = true,
    has_ads = true,
    status = 'live',
    midroll_interval_seconds = 1800
WHERE slug = 'swn-main';

-- The Lodge channel: Premium (Order members only), no ads
UPDATE linear_channels
SET is_free = false,
    has_ads = false,
    status = 'draft',
    midroll_interval_seconds = NULL
WHERE slug = 'the-lodge';

-- ============================================================================
-- L1d: Add view for linear watch aggregation
-- ============================================================================

-- View to identify linear playback sessions for aggregation
CREATE OR REPLACE VIEW v_linear_playback_sessions AS
SELECT
    ps.id,
    ps.user_id,
    ps.episode_id,
    ps.world_id,
    ps.channel_id,
    ps.block_id,
    ps.duration_watched_seconds,
    ps.current_position_seconds,
    ps.created_at,
    ps.started_at,
    lc.slug AS channel_slug,
    lc.is_free,
    lc.has_ads
FROM playback_sessions ps
JOIN linear_channels lc ON ps.channel_id = lc.id
WHERE ps.channel_id IS NOT NULL;

COMMENT ON VIEW v_linear_playback_sessions IS 'Linear channel playback sessions with channel and block metadata';

-- ============================================================================
-- L1e: Add function to check if midroll is due
-- ============================================================================

CREATE OR REPLACE FUNCTION check_midroll_due(
    p_channel_id UUID,
    p_block_start_time TIMESTAMPTZ,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    v_midroll_interval INTEGER;
    v_elapsed_seconds INTEGER;
BEGIN
    -- Get channel's midroll interval
    SELECT midroll_interval_seconds INTO v_midroll_interval
    FROM linear_channels
    WHERE id = p_channel_id;

    -- No midroll if interval is null or 0
    IF v_midroll_interval IS NULL OR v_midroll_interval = 0 THEN
        RETURN FALSE;
    END IF;

    -- Calculate elapsed time in current block
    v_elapsed_seconds := EXTRACT(EPOCH FROM (p_current_time - p_block_start_time))::INTEGER;

    -- Check if we've crossed a midroll boundary
    -- Returns true if elapsed time is a multiple of the interval (with 30-second grace window)
    RETURN v_elapsed_seconds > 0
       AND (v_elapsed_seconds % v_midroll_interval) < 30;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_midroll_due IS 'Check if a mid-roll ad break is due based on block position';

COMMIT;
