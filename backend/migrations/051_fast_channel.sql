-- Migration: 051_fast_channel.sql
-- Description: Create tables for Fast Channel content management (Linear + VOD)

-- Fast Channel Content Library
CREATE TABLE IF NOT EXISTS fast_channel_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('film', 'short', 'episode', 'trailer', 'promo', 'interstitial')),
    genre TEXT[],
    rating TEXT,
    year INTEGER,
    director TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Linear Channel Configuration
CREATE TABLE IF NOT EXISTS fast_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_live BOOLEAN DEFAULT false,
    stream_url TEXT,
    current_program_id UUID REFERENCES fast_channel_content(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programming Schedule (for linear channel)
CREATE TABLE IF NOT EXISTS fast_channel_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES fast_channels(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES fast_channel_content(id) ON DELETE CASCADE,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT, -- 'daily', 'weekly', 'weekdays', 'weekends'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOD Playlists/Categories
CREATE TABLE IF NOT EXISTS fast_channel_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist Items (content in playlists)
CREATE TABLE IF NOT EXISTS fast_channel_playlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES fast_channel_playlists(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES fast_channel_content(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, content_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_type ON fast_channel_content(content_type);
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_active ON fast_channel_content(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fast_channel_content_created ON fast_channel_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fast_channel_schedule_time ON fast_channel_schedule(channel_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_fast_channel_schedule_content ON fast_channel_schedule(content_id);
CREATE INDEX IF NOT EXISTS idx_fast_channel_playlist_items_playlist ON fast_channel_playlist_items(playlist_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_fast_channel_playlist_items_content ON fast_channel_playlist_items(content_id);
CREATE INDEX IF NOT EXISTS idx_fast_channels_live ON fast_channels(is_live) WHERE is_live = true;

-- Insert default channel
INSERT INTO fast_channels (name, slug, description)
VALUES ('Second Watch Network', 'swn-main', 'The main Second Watch Network linear channel')
ON CONFLICT (slug) DO NOTHING;
