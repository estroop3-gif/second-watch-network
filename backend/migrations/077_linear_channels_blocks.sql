-- Migration 077: Linear Channels and Blocks
-- Phase 2A: Network layer for 24/7 linear streaming experience
--
-- This migration creates the foundation for linear channels that stitch together
-- curated blocks of content (episodes, companion compilations, slates) into
-- scheduled 24-hour programming.

-- =============================================================================
-- BLOCKS: Curated sequences of content with a theme and target duration
-- =============================================================================

CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Classification
    theme TEXT, -- e.g., 'action', 'drama', 'behind-the-scenes', 'holiday', 'premiere'
    category TEXT CHECK (category IN ('programming', 'interstitial', 'special', 'ad_break')) DEFAULT 'programming',

    -- Duration targeting
    target_duration_seconds INTEGER NOT NULL DEFAULT 3600, -- Default 1 hour
    computed_duration_seconds INTEGER DEFAULT 0, -- Sum of items, updated by trigger

    -- Status
    status TEXT CHECK (status IN ('draft', 'ready', 'active', 'archived')) DEFAULT 'draft',

    -- Metadata
    thumbnail_url TEXT,
    tags JSONB DEFAULT '[]'::jsonb,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE blocks IS 'Curated content sequences for linear channel programming';
COMMENT ON COLUMN blocks.target_duration_seconds IS 'Desired block length for scheduling (actual may vary)';
COMMENT ON COLUMN blocks.computed_duration_seconds IS 'Actual sum of item durations, auto-updated';

CREATE INDEX idx_blocks_slug ON blocks(slug);
CREATE INDEX idx_blocks_status ON blocks(status) WHERE status = 'active';
CREATE INDEX idx_blocks_theme ON blocks(theme) WHERE theme IS NOT NULL;
CREATE INDEX idx_blocks_category ON blocks(category);

-- =============================================================================
-- BLOCK ITEMS: Individual content pieces within a block
-- =============================================================================

CREATE TABLE IF NOT EXISTS block_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,

    -- Content reference (polymorphic)
    item_type TEXT NOT NULL CHECK (item_type IN (
        'world_episode',      -- References episodes table
        'world_companion',    -- References world_content table (BTS, vlogs, etc.)
        'custom_slate',       -- Static image/video slate (bumpers, station IDs)
        'promo',              -- Promotional content
        'ad_placeholder'      -- Marker for ad insertion points
    )),
    item_id UUID, -- NULL for custom_slate/ad_placeholder, references appropriate table otherwise

    -- For custom slates
    slate_asset_url TEXT,     -- S3 URL for slate image/video
    slate_duration_seconds INTEGER, -- Duration for static slates
    slate_metadata JSONB,     -- Additional slate config (text overlay, branding, etc.)

    -- Timing overrides
    start_offset_seconds INTEGER DEFAULT 0, -- Skip into the source asset
    explicit_duration_seconds INTEGER,       -- Override the natural duration

    -- Computed duration (from source or explicit)
    effective_duration_seconds INTEGER NOT NULL DEFAULT 0,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    transition_type TEXT CHECK (transition_type IN ('cut', 'fade', 'dissolve')) DEFAULT 'cut',
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE block_items IS 'Individual content pieces within a programming block';
COMMENT ON COLUMN block_items.item_type IS 'Type of content: episode, companion, slate, promo, or ad marker';
COMMENT ON COLUMN block_items.effective_duration_seconds IS 'Actual playback duration accounting for overrides';

CREATE INDEX idx_block_items_block_id ON block_items(block_id);
CREATE INDEX idx_block_items_sort ON block_items(block_id, sort_order);
CREATE INDEX idx_block_items_type ON block_items(item_type);
CREATE INDEX idx_block_items_item_id ON block_items(item_id) WHERE item_id IS NOT NULL;

-- =============================================================================
-- LINEAR CHANNELS: 24/7 or scheduled streams
-- =============================================================================

CREATE TABLE IF NOT EXISTS linear_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tagline TEXT, -- Short description for UI

    -- Classification
    category TEXT CHECK (category IN (
        'main',           -- Primary network channel
        'genre',          -- Genre-specific (action, drama, comedy)
        'lodge',          -- Order-exclusive content
        'creator',        -- Creator-curated channel
        'event',          -- Special event/festival channel
        'experimental'    -- Testing/beta channels
    )) DEFAULT 'genre',

    -- Scheduling mode
    is_24_7 BOOLEAN DEFAULT true, -- True = continuous loop, False = scheduled windows
    timezone TEXT DEFAULT 'America/Los_Angeles', -- For schedule interpretation

    -- Access control
    visibility TEXT CHECK (visibility IN ('public', 'order_only', 'premium', 'internal')) DEFAULT 'public',
    required_role TEXT, -- Optional: specific role requirement beyond visibility

    -- Branding
    logo_url TEXT,
    background_url TEXT,
    accent_color TEXT, -- Hex color for UI theming

    -- Status
    status TEXT CHECK (status IN ('draft', 'scheduled', 'live', 'paused', 'archived')) DEFAULT 'draft',

    -- Stream info (for future SSAI/live integration)
    -- NOTE: For Phase 2A, we use client-side playback offset into VOD assets.
    -- These fields are placeholders for future server-side assembly.
    stream_url TEXT,           -- Future: HLS endpoint for assembled stream
    stream_type TEXT CHECK (stream_type IN ('vod_simulation', 'live_linear', 'hybrid')) DEFAULT 'vod_simulation',

    -- Fallback content
    default_block_id UUID REFERENCES blocks(id), -- Used when schedule has gaps
    offline_slate_url TEXT,    -- Shown when channel is offline/paused

    -- Metrics (denormalized for quick access)
    current_viewers INTEGER DEFAULT 0,
    peak_viewers_today INTEGER DEFAULT 0,
    total_watch_minutes_today INTEGER DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete
    archived_at TIMESTAMPTZ
);

COMMENT ON TABLE linear_channels IS '24/7 or scheduled linear streaming channels';
COMMENT ON COLUMN linear_channels.stream_type IS 'vod_simulation = client seeks into VOD, live_linear = server-assembled stream';
COMMENT ON COLUMN linear_channels.default_block_id IS 'Fallback block played during schedule gaps or as 24/7 loop source';

CREATE INDEX idx_linear_channels_slug ON linear_channels(slug);
CREATE INDEX idx_linear_channels_status ON linear_channels(status) WHERE status IN ('live', 'scheduled');
CREATE INDEX idx_linear_channels_visibility ON linear_channels(visibility);
CREATE INDEX idx_linear_channels_category ON linear_channels(category);

-- =============================================================================
-- CHANNEL SCHEDULE ENTRIES: When blocks play on channels
-- =============================================================================

CREATE TABLE IF NOT EXISTS channel_schedule_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES linear_channels(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE RESTRICT,

    -- Timing (all times in UTC for consistency)
    start_time_utc TIMESTAMPTZ NOT NULL,
    end_time_utc TIMESTAMPTZ, -- Computed from block duration, but can be explicit

    -- Recurrence
    recurrence_type TEXT CHECK (recurrence_type IN (
        'none',     -- One-time scheduling
        'daily',    -- Same time every day
        'weekly',   -- Same time/day each week
        'weekday',  -- Mon-Fri only
        'weekend'   -- Sat-Sun only
    )) DEFAULT 'none',
    recurrence_end_date DATE, -- When recurring schedule stops

    -- Priority (higher wins conflicts)
    priority INTEGER DEFAULT 0,

    -- Status
    status TEXT CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',

    -- Metadata
    override_reason TEXT, -- Why this entry exists (e.g., "Holiday Marathon")
    notes TEXT,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE channel_schedule_entries IS 'Schedule of when blocks play on linear channels';
COMMENT ON COLUMN channel_schedule_entries.recurrence_type IS 'How this entry repeats: none, daily, weekly, weekday, weekend';

CREATE INDEX idx_channel_schedule_channel ON channel_schedule_entries(channel_id);
CREATE INDEX idx_channel_schedule_time ON channel_schedule_entries(channel_id, start_time_utc);
CREATE INDEX idx_channel_schedule_block ON channel_schedule_entries(block_id);
CREATE INDEX idx_channel_schedule_active ON channel_schedule_entries(channel_id, start_time_utc)
    WHERE status IN ('scheduled', 'active');

-- =============================================================================
-- CHANNEL VIEWER SESSIONS: Track who's watching linear channels
-- =============================================================================

CREATE TABLE IF NOT EXISTS channel_viewer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES linear_channels(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES profiles(id), -- NULL for anonymous viewers

    -- Session timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),

    -- What they watched
    blocks_viewed UUID[] DEFAULT '{}', -- Array of block_ids seen
    total_watch_seconds INTEGER DEFAULT 0,

    -- Device info
    device_type TEXT,
    device_id TEXT, -- Hashed device identifier
    ip_hash TEXT,   -- Hashed IP for geo (privacy-preserving)

    -- Quality metrics
    average_bitrate INTEGER,
    buffer_events INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE channel_viewer_sessions IS 'Active and historical viewer sessions on linear channels';

CREATE INDEX idx_channel_viewers_channel ON channel_viewer_sessions(channel_id);
CREATE INDEX idx_channel_viewers_active ON channel_viewer_sessions(channel_id, last_heartbeat_at)
    WHERE ended_at IS NULL;
CREATE INDEX idx_channel_viewers_viewer ON channel_viewer_sessions(viewer_id) WHERE viewer_id IS NOT NULL;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update block's computed duration when items change
CREATE OR REPLACE FUNCTION update_block_duration()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE blocks
    SET computed_duration_seconds = (
        SELECT COALESCE(SUM(effective_duration_seconds), 0)
        FROM block_items
        WHERE block_id = COALESCE(NEW.block_id, OLD.block_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.block_id, OLD.block_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_items_duration
AFTER INSERT OR UPDATE OR DELETE ON block_items
FOR EACH ROW EXECUTE FUNCTION update_block_duration();

-- Function to compute effective duration for block items
CREATE OR REPLACE FUNCTION compute_block_item_duration()
RETURNS TRIGGER AS $$
DECLARE
    source_duration INTEGER;
BEGIN
    -- If explicit duration is set, use it
    IF NEW.explicit_duration_seconds IS NOT NULL THEN
        NEW.effective_duration_seconds := NEW.explicit_duration_seconds;
        RETURN NEW;
    END IF;

    -- For custom slates, use slate_duration_seconds
    IF NEW.item_type = 'custom_slate' THEN
        NEW.effective_duration_seconds := COALESCE(NEW.slate_duration_seconds, 30);
        RETURN NEW;
    END IF;

    -- For ad placeholders, default to 30 seconds
    IF NEW.item_type = 'ad_placeholder' THEN
        NEW.effective_duration_seconds := 30;
        RETURN NEW;
    END IF;

    -- For episodes, look up duration
    IF NEW.item_type = 'world_episode' AND NEW.item_id IS NOT NULL THEN
        SELECT duration_seconds INTO source_duration
        FROM episodes WHERE id = NEW.item_id;

        NEW.effective_duration_seconds := COALESCE(source_duration, 0) - COALESCE(NEW.start_offset_seconds, 0);
        RETURN NEW;
    END IF;

    -- For companion content, look up duration
    IF NEW.item_type = 'world_companion' AND NEW.item_id IS NOT NULL THEN
        SELECT duration_seconds INTO source_duration
        FROM world_content WHERE id = NEW.item_id;

        NEW.effective_duration_seconds := COALESCE(source_duration, 0) - COALESCE(NEW.start_offset_seconds, 0);
        RETURN NEW;
    END IF;

    -- Default fallback
    NEW.effective_duration_seconds := 0;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_item_duration
BEFORE INSERT OR UPDATE ON block_items
FOR EACH ROW EXECUTE FUNCTION compute_block_item_duration();

-- Auto-update timestamps
CREATE TRIGGER trg_blocks_updated_at
BEFORE UPDATE ON blocks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_block_items_updated_at
BEFORE UPDATE ON block_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_linear_channels_updated_at
BEFORE UPDATE ON linear_channels
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_channel_schedule_updated_at
BEFORE UPDATE ON channel_schedule_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View: Current schedule for all live channels
CREATE OR REPLACE VIEW v_channel_current_schedule AS
SELECT
    lc.id as channel_id,
    lc.slug as channel_slug,
    lc.name as channel_name,
    lc.visibility,
    cse.id as schedule_entry_id,
    cse.block_id,
    b.name as block_name,
    b.theme as block_theme,
    cse.start_time_utc,
    cse.end_time_utc,
    b.computed_duration_seconds as block_duration_seconds
FROM linear_channels lc
LEFT JOIN channel_schedule_entries cse ON cse.channel_id = lc.id
    AND cse.start_time_utc <= NOW()
    AND (cse.end_time_utc IS NULL OR cse.end_time_utc > NOW())
    AND cse.status IN ('scheduled', 'active')
LEFT JOIN blocks b ON b.id = cse.block_id
WHERE lc.status = 'live';

-- View: Block items with resolved content details
CREATE OR REPLACE VIEW v_block_items_resolved AS
SELECT
    bi.id,
    bi.block_id,
    bi.item_type,
    bi.item_id,
    bi.sort_order,
    bi.effective_duration_seconds,
    bi.start_offset_seconds,
    bi.transition_type,
    -- Episode details
    CASE WHEN bi.item_type = 'world_episode' THEN e.title END as episode_title,
    CASE WHEN bi.item_type = 'world_episode' THEN e.world_id END as world_id,
    CASE WHEN bi.item_type = 'world_episode' THEN w.title END as world_title,
    CASE WHEN bi.item_type = 'world_episode' THEN e.video_asset_id END as video_asset_id,
    CASE WHEN bi.item_type = 'world_episode' THEN e.thumbnail_url END as thumbnail_url,
    -- Companion details
    CASE WHEN bi.item_type = 'world_companion' THEN wc.title END as companion_title,
    CASE WHEN bi.item_type = 'world_companion' THEN wc.world_id END as companion_world_id,
    CASE WHEN bi.item_type = 'world_companion' THEN wc.video_asset_id END as companion_video_asset_id,
    -- Slate details
    CASE WHEN bi.item_type = 'custom_slate' THEN bi.slate_asset_url END as slate_url,
    CASE WHEN bi.item_type = 'custom_slate' THEN bi.slate_metadata END as slate_metadata
FROM block_items bi
LEFT JOIN episodes e ON bi.item_type = 'world_episode' AND bi.item_id = e.id
LEFT JOIN worlds w ON e.world_id = w.id
LEFT JOIN world_content wc ON bi.item_type = 'world_companion' AND bi.item_id = wc.id
ORDER BY bi.block_id, bi.sort_order;

-- =============================================================================
-- SEED DATA: Default blocks and a main channel
-- =============================================================================

-- Create a default "offline" slate block
INSERT INTO blocks (slug, name, description, theme, category, target_duration_seconds, status)
VALUES (
    'system-offline-slate',
    'Offline Slate',
    'Displayed when a channel is offline or during technical difficulties',
    'system',
    'interstitial',
    30,
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- Create a default "coming up next" interstitial block
INSERT INTO blocks (slug, name, description, theme, category, target_duration_seconds, status)
VALUES (
    'system-coming-up-next',
    'Coming Up Next',
    'Interstitial shown between programming blocks',
    'system',
    'interstitial',
    15,
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- Create the main SWN channel (draft status until content is added)
INSERT INTO linear_channels (slug, name, description, tagline, category, visibility, status)
VALUES (
    'swn-main',
    'Second Watch Network',
    'The flagship channel featuring the best of independent faith-driven filmmaking',
    'Stories Worth Watching Twice',
    'main',
    'public',
    'draft'
) ON CONFLICT (slug) DO NOTHING;

-- Create an Order-exclusive channel
INSERT INTO linear_channels (slug, name, description, tagline, category, visibility, status)
VALUES (
    'the-lodge',
    'The Lodge',
    'Exclusive content and premieres for Order members',
    'Member Premieres & Exclusives',
    'lodge',
    'order_only',
    'draft'
) ON CONFLICT (slug) DO NOTHING;
