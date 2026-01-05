-- Migration: 063_streaming_worlds.sql
-- Description: Core streaming platform - Worlds and Genre taxonomy
-- Part of: Consumer Streaming Platform (separate from Backlot/Community/Green Room)

-- =============================================================================
-- GENRE TAGS (Normalized taxonomy for content classification)
-- =============================================================================
CREATE TABLE IF NOT EXISTS genre_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('primary', 'subgenre', 'mood', 'theme')),
    parent_id UUID REFERENCES genre_tags(id) ON DELETE SET NULL,
    icon_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genre_tags_category ON genre_tags(category);
CREATE INDEX IF NOT EXISTS idx_genre_tags_parent ON genre_tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_genre_tags_slug ON genre_tags(slug);
CREATE INDEX IF NOT EXISTS idx_genre_tags_active ON genre_tags(is_active) WHERE is_active = TRUE;

-- Seed initial genres
INSERT INTO genre_tags (name, slug, category, sort_order) VALUES
    ('Drama', 'drama', 'primary', 1),
    ('Comedy', 'comedy', 'primary', 2),
    ('Documentary', 'documentary', 'primary', 3),
    ('Faith', 'faith', 'primary', 4),
    ('Family', 'family', 'primary', 5),
    ('Action', 'action', 'primary', 6),
    ('Thriller', 'thriller', 'primary', 7),
    ('Sci-Fi', 'sci-fi', 'primary', 8),
    ('Horror', 'horror', 'primary', 9),
    ('Romance', 'romance', 'primary', 10),
    ('Animation', 'animation', 'primary', 11),
    ('Western', 'western', 'primary', 12),
    ('Musical', 'musical', 'primary', 13),
    ('Historical', 'historical', 'primary', 14),
    ('Sports', 'sports', 'primary', 15)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- WORLDS - Central Hub for Series/Films
-- Created when submission is approved for distribution
-- =============================================================================
CREATE TABLE IF NOT EXISTS worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Origin tracking
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,

    -- Creator/Owner
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Basic Info
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logline TEXT, -- One-sentence hook (max ~200 chars)
    synopsis TEXT, -- Full description

    -- Visual Assets
    cover_art_url TEXT, -- Main poster/banner (16:9 or 2:3)
    cover_art_wide_url TEXT, -- Wide banner for hero sections (21:9)
    thumbnail_url TEXT, -- Small card thumbnail (16:9)
    logo_url TEXT, -- Series/Film logo for overlays
    trailer_video_id UUID, -- FK to video_assets (added later)

    -- Classification
    content_format TEXT NOT NULL CHECK (content_format IN ('series', 'film', 'special', 'anthology')),
    maturity_rating TEXT CHECK (maturity_rating IN ('G', 'PG', 'PG-13', 'R', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA')),
    runtime_minutes INTEGER, -- For films/specials; NULL for series
    release_year INTEGER,

    -- Visibility & Status
    visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('public', 'unlisted', 'private')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'coming_soon', 'active', 'complete', 'archived')),

    -- Distribution Dates
    announced_at TIMESTAMPTZ,
    premiere_date DATE,
    last_content_date DATE, -- Last episode/update; for "recently updated" sorting

    -- Engagement Metrics (denormalized for performance)
    follower_count INTEGER DEFAULT 0,
    total_view_count BIGINT DEFAULT 0,
    episode_count INTEGER DEFAULT 0,
    season_count INTEGER DEFAULT 0,

    -- Settings & Metadata
    settings JSONB DEFAULT '{}', -- Custom display options, featured order, etc.
    external_links JSONB DEFAULT '{}', -- IMDb, social media, website links

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Indexes for worlds
CREATE INDEX IF NOT EXISTS idx_worlds_creator ON worlds(creator_id);
CREATE INDEX IF NOT EXISTS idx_worlds_slug ON worlds(slug);
CREATE INDEX IF NOT EXISTS idx_worlds_visibility_public ON worlds(visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_worlds_status ON worlds(status);
CREATE INDEX IF NOT EXISTS idx_worlds_format ON worlds(content_format);
CREATE INDEX IF NOT EXISTS idx_worlds_premiere ON worlds(premiere_date DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_last_content ON worlds(last_content_date DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_follower_count ON worlds(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_worlds_submission ON worlds(submission_id);
CREATE INDEX IF NOT EXISTS idx_worlds_created ON worlds(created_at DESC);

-- =============================================================================
-- WORLD GENRE LINKS (Many-to-Many)
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_genres (
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genre_tags(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE, -- Primary genre for sorting
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (world_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_world_genres_genre ON world_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_world_genres_primary ON world_genres(world_id, is_primary) WHERE is_primary = TRUE;

-- =============================================================================
-- SLUG GENERATION
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_world_slug(title TEXT, world_id UUID)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert to lowercase, replace non-alphanumeric with dashes
    base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;

    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM worlds WHERE slug = final_slug AND id != COALESCE(world_id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;

    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate slug trigger
CREATE OR REPLACE FUNCTION worlds_set_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_world_slug(NEW.title, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS worlds_slug_trigger ON worlds;
CREATE TRIGGER worlds_slug_trigger
    BEFORE INSERT ON worlds
    FOR EACH ROW
    EXECUTE FUNCTION worlds_set_slug();

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION update_worlds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS worlds_updated_at ON worlds;
CREATE TRIGGER worlds_updated_at
    BEFORE UPDATE ON worlds
    FOR EACH ROW
    EXECUTE FUNCTION update_worlds_updated_at();
