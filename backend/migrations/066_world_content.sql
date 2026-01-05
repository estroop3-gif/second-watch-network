-- Migration: 066_world_content.sql
-- Description: Non-Canon Content Types - Companion, Clips, Shorts + Moderation Queue
-- Part of: Consumer Streaming Platform

-- =============================================================================
-- WORLD CONTENT - All non-Canon content linked to a World
-- Companion content unlocks AFTER first Canon episode is approved
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Creator
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Classification
    content_type TEXT NOT NULL CHECK (content_type IN (
        -- Companion Content (creator posts after Canon approved)
        'bts', 'vlog', 'breakdown', 'deleted_scene', 'interview', 'commentary', 'cast_diary', 'production_journal',
        -- Clips (derived from Canon)
        'scene_clip', 'promo', 'trailer', 'teaser', 'recap',
        -- Shorts (vertical micro-content)
        'short'
    )),

    -- Computed category for queries
    content_category TEXT NOT NULL GENERATED ALWAYS AS (
        CASE
            WHEN content_type IN ('bts', 'vlog', 'breakdown', 'deleted_scene', 'interview', 'commentary', 'cast_diary', 'production_journal') THEN 'companion'
            WHEN content_type IN ('scene_clip', 'promo', 'trailer', 'teaser', 'recap') THEN 'clip'
            WHEN content_type = 'short' THEN 'short'
        END
    ) STORED,

    -- Content Info
    title TEXT NOT NULL,
    description TEXT,

    -- Video Asset
    video_asset_id UUID REFERENCES video_assets(id) ON DELETE SET NULL,

    -- Visual
    thumbnail_url TEXT,

    -- Technical
    duration_seconds INTEGER,
    aspect_ratio TEXT CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '4:5', '4:3', '21:9')),

    -- Linking (for clips derived from episodes)
    source_episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    source_timecode_start NUMERIC(10,3), -- For clips: start time in source
    source_timecode_end NUMERIC(10,3),

    -- Visibility & Status
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
        'draft', 'pending_review', 'approved', 'rejected', 'published', 'archived'
    )),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private', 'followers_only')),

    -- Moderation (queue-then-post)
    moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'auto_approved', 'auto_rejected', 'manual_approved', 'manual_rejected', 'flagged')),
    moderation_flags TEXT[] DEFAULT '{}', -- ['copyright', 'explicit', 'quality', 'spam', 'audio_issue']
    moderation_notes TEXT,
    moderated_by UUID REFERENCES profiles(id),
    moderated_at TIMESTAMPTZ,

    -- Auto-moderation results
    auto_moderation_results JSONB DEFAULT '{}', -- Results from Rekognition, audio analysis, etc.

    -- Publishing
    scheduled_publish TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Metrics (denormalized)
    view_count BIGINT DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,

    -- Ordering
    sort_order INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_content_world ON world_content(world_id);
CREATE INDEX IF NOT EXISTS idx_world_content_creator ON world_content(created_by);
CREATE INDEX IF NOT EXISTS idx_world_content_type ON world_content(content_type);
CREATE INDEX IF NOT EXISTS idx_world_content_category ON world_content(content_category);
CREATE INDEX IF NOT EXISTS idx_world_content_status ON world_content(status);
CREATE INDEX IF NOT EXISTS idx_world_content_moderation ON world_content(moderation_status) WHERE moderation_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_world_content_published ON world_content(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_world_content_source_ep ON world_content(source_episode_id);
CREATE INDEX IF NOT EXISTS idx_world_content_pinned ON world_content(world_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_world_content_featured ON world_content(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_world_content_shorts ON world_content(content_type, published_at DESC) WHERE content_type = 'short' AND status = 'published';

-- =============================================================================
-- CONTENT MODERATION QUEUE - For automated/manual review
-- Queue-then-post: content must pass checks before publishing
-- =============================================================================
CREATE TABLE IF NOT EXISTS content_moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content Reference (polymorphic)
    content_type TEXT NOT NULL CHECK (content_type IN ('world_content', 'episode', 'world', 'video_asset')),
    content_id UUID NOT NULL,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Submitter
    submitted_by UUID NOT NULL REFERENCES profiles(id),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),

    -- Queue Status
    queue_status TEXT NOT NULL DEFAULT 'pending' CHECK (queue_status IN (
        'pending', 'in_review', 'auto_approved', 'auto_rejected',
        'manual_approved', 'manual_rejected', 'escalated'
    )),
    priority INTEGER DEFAULT 0, -- Higher = more urgent

    -- Auto-moderation Results
    auto_check_started_at TIMESTAMPTZ,
    auto_check_completed_at TIMESTAMPTZ,
    auto_check_passed BOOLEAN,
    auto_check_results JSONB DEFAULT '{}', -- AI/automated check outputs

    -- Individual check results
    check_audio_levels JSONB, -- {passed, lufs, peak_db, issues}
    check_aspect_ratio JSONB, -- {passed, detected, expected, issues}
    check_content_safety JSONB, -- {passed, nudity_score, violence_score, labels}
    check_copyright JSONB, -- {passed, matches, fingerprint_id}
    check_quality JSONB, -- {passed, resolution, bitrate, issues}

    -- Manual Review
    assigned_to UUID REFERENCES profiles(id),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,

    -- Flags
    content_flags TEXT[] DEFAULT '{}', -- ['copyright', 'explicit', 'quality', 'spam', 'audio', 'aspect']
    requires_manual_review BOOLEAN DEFAULT FALSE,

    -- Appeals
    appeal_submitted BOOLEAN DEFAULT FALSE,
    appeal_notes TEXT,
    appeal_reviewed_by UUID REFERENCES profiles(id),
    appeal_reviewed_at TIMESTAMPTZ,
    appeal_result TEXT CHECK (appeal_result IN ('approved', 'rejected', 'pending')),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON content_moderation_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_priority ON content_moderation_queue(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_world ON content_moderation_queue(world_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_assigned ON content_moderation_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moderation_queue_pending ON content_moderation_queue(created_at) WHERE queue_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_moderation_queue_content ON content_moderation_queue(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_submitter ON content_moderation_queue(submitted_by);

-- =============================================================================
-- WORLD CONTENT LIKES - Track who liked what
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_content_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES world_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_world_content_likes_content ON world_content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_world_content_likes_user ON world_content_likes(user_id);

-- =============================================================================
-- WORLD CONTENT BOOKMARKS - Saved content
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_content_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES world_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_world_content_bookmarks_content ON world_content_bookmarks(content_id);
CREATE INDEX IF NOT EXISTS idx_world_content_bookmarks_user ON world_content_bookmarks(user_id);

-- =============================================================================
-- TRIGGER: Update like count when likes change
-- =============================================================================
CREATE OR REPLACE FUNCTION update_world_content_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE world_content SET like_count = like_count + 1 WHERE id = NEW.content_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE world_content SET like_count = like_count - 1 WHERE id = OLD.content_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS world_content_likes_count ON world_content_likes;
CREATE TRIGGER world_content_likes_count
    AFTER INSERT OR DELETE ON world_content_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_world_content_like_count();

-- =============================================================================
-- TRIGGER: Update bookmark count when bookmarks change
-- =============================================================================
CREATE OR REPLACE FUNCTION update_world_content_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE world_content SET bookmark_count = bookmark_count + 1 WHERE id = NEW.content_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE world_content SET bookmark_count = bookmark_count - 1 WHERE id = OLD.content_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS world_content_bookmarks_count ON world_content_bookmarks;
CREATE TRIGGER world_content_bookmarks_count
    AFTER INSERT OR DELETE ON world_content_bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_world_content_bookmark_count();

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_world_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS world_content_updated_at ON world_content;
CREATE TRIGGER world_content_updated_at
    BEFORE UPDATE ON world_content
    FOR EACH ROW
    EXECUTE FUNCTION update_world_content_updated_at();

DROP TRIGGER IF EXISTS moderation_queue_updated_at ON content_moderation_queue;
CREATE TRIGGER moderation_queue_updated_at
    BEFORE UPDATE ON content_moderation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_world_content_updated_at();

-- =============================================================================
-- FUNCTION: Check if companion posting is allowed for a World
-- Companion posting unlocks when first Canon episode is approved
-- =============================================================================
CREATE OR REPLACE FUNCTION world_allows_companion_posting(p_world_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM episodes
        WHERE world_id = p_world_id
        AND status = 'published'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
