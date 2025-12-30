-- Migration: 060_community_feed.sql
-- Community Feed feature: posts, likes, comments

-- =========================================
-- POSTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]',  -- Array of {url, alt, width, height}

    -- Link preview (optional)
    link_url TEXT,
    link_title TEXT,
    link_description TEXT,
    link_image TEXT,
    link_site_name TEXT,

    -- Visibility: 'public' or 'connections'
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'connections')),

    -- Engagement counters (denormalized for performance)
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,

    -- Moderation
    is_hidden BOOLEAN DEFAULT false,
    hidden_reason TEXT,
    hidden_by UUID REFERENCES profiles(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON community_posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_public_feed ON community_posts(created_at DESC)
    WHERE visibility = 'public' AND is_hidden = false;

-- =========================================
-- POST LIKES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS community_post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one like per user per post
    UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_likes_post ON community_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_likes_user ON community_post_likes(user_id);

-- =========================================
-- POST COMMENTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS community_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES community_post_comments(id) ON DELETE CASCADE,

    content TEXT NOT NULL,

    -- Moderation
    is_hidden BOOLEAN DEFAULT false,
    hidden_reason TEXT,
    hidden_by UUID REFERENCES profiles(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_post_comments_post ON community_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_comments_user ON community_post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_post_comments_parent ON community_post_comments(parent_comment_id);

-- =========================================
-- TRIGGERS FOR COUNTER UPDATES
-- =========================================

-- Function to update like count
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_post_like_count ON community_post_likes;
CREATE TRIGGER trg_update_post_like_count
    AFTER INSERT OR DELETE ON community_post_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_post_like_count();

-- Function to update comment count
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_post_comment_count ON community_post_comments;
CREATE TRIGGER trg_update_post_comment_count
    AFTER INSERT OR DELETE ON community_post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();

-- Updated_at trigger for posts
CREATE OR REPLACE FUNCTION update_community_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_community_posts_updated_at();

-- Updated_at trigger for comments
DROP TRIGGER IF EXISTS trg_community_post_comments_updated_at ON community_post_comments;
CREATE TRIGGER trg_community_post_comments_updated_at
    BEFORE UPDATE ON community_post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_community_posts_updated_at();
