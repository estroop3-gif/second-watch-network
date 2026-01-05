-- Migration 080: Community Scoping and Career Extensions
-- Phase 3A: Scope community to Worlds/Lodges/Craft Houses and tie jobs/credits into careers
--
-- This migration:
-- 1. Adds scope fields to community posts for World, Lodge, Craft House contexts
-- 2. Creates community_threads table for threaded discussions (separate from feed posts)
-- 3. Extends order_jobs with World and Backlot project associations
-- 4. Adds career-related views and indexes

BEGIN;

-- =============================================================================
-- PART 1: Community Post Scoping
-- =============================================================================

-- Add scope fields to community_posts for contextual discussions
ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS scope_type TEXT DEFAULT 'global',
    ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES order_lodges(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS craft_house_id UUID REFERENCES order_craft_houses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Add check constraint for valid scope types
ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS community_posts_scope_type_check;
ALTER TABLE community_posts ADD CONSTRAINT community_posts_scope_type_check
    CHECK (scope_type IN ('global', 'world', 'lodge', 'craft_house'));

-- Ensure scope consistency: if scope_type is set, corresponding ID should exist
CREATE OR REPLACE FUNCTION validate_community_post_scope()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scope_type = 'world' AND NEW.world_id IS NULL THEN
        RAISE EXCEPTION 'world_id required when scope_type is world';
    END IF;
    IF NEW.scope_type = 'lodge' AND NEW.lodge_id IS NULL THEN
        RAISE EXCEPTION 'lodge_id required when scope_type is lodge';
    END IF;
    IF NEW.scope_type = 'craft_house' AND NEW.craft_house_id IS NULL THEN
        RAISE EXCEPTION 'craft_house_id required when scope_type is craft_house';
    END IF;
    -- Clear unrelated scope IDs
    IF NEW.scope_type != 'world' THEN NEW.world_id := NULL; END IF;
    IF NEW.scope_type != 'lodge' THEN NEW.lodge_id := NULL; END IF;
    IF NEW.scope_type != 'craft_house' THEN NEW.craft_house_id := NULL; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_community_post_scope ON community_posts;
CREATE TRIGGER trg_validate_community_post_scope
    BEFORE INSERT OR UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION validate_community_post_scope();

-- Indexes for scoped queries
CREATE INDEX IF NOT EXISTS idx_community_posts_world ON community_posts(world_id) WHERE world_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_lodge ON community_posts(lodge_id) WHERE lodge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_craft_house ON community_posts(craft_house_id) WHERE craft_house_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_scope_type ON community_posts(scope_type);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(is_pinned) WHERE is_pinned = true;

-- =============================================================================
-- PART 2: Community Threads (Discussion Forums)
-- =============================================================================

-- Thread-based discussions separate from feed posts
-- These are more structured conversations (episode discussions, BTS talk, etc.)
CREATE TABLE IF NOT EXISTS community_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scoping (required - no global threads)
    scope_type TEXT NOT NULL,
    world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
    lodge_id UUID REFERENCES order_lodges(id) ON DELETE CASCADE,
    craft_house_id UUID REFERENCES order_craft_houses(id) ON DELETE CASCADE,

    -- Optional episode/season context for world threads
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,

    -- Thread content
    title TEXT NOT NULL,
    body TEXT,
    author_id UUID NOT NULL REFERENCES profiles(id),

    -- Thread type for categorization
    thread_type TEXT DEFAULT 'discussion',

    -- Moderation
    is_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES profiles(id),
    locked_at TIMESTAMPTZ,
    lock_reason TEXT,

    is_pinned BOOLEAN DEFAULT false,
    pinned_by UUID REFERENCES profiles(id),
    pinned_at TIMESTAMPTZ,
    pin_expires_at TIMESTAMPTZ,

    is_hidden BOOLEAN DEFAULT false,
    hidden_by UUID REFERENCES profiles(id),
    hidden_at TIMESTAMPTZ,
    hidden_reason TEXT,

    -- Engagement (denormalized)
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    last_reply_by UUID REFERENCES profiles(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT community_threads_scope_type_check
        CHECK (scope_type IN ('world', 'lodge', 'craft_house'))
);

-- Thread replies
CREATE TABLE IF NOT EXISTS community_thread_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),

    -- Reply content
    body TEXT NOT NULL,

    -- Reply threading (optional parent for nested replies)
    parent_reply_id UUID REFERENCES community_thread_replies(id) ON DELETE CASCADE,

    -- Moderation
    is_hidden BOOLEAN DEFAULT false,
    hidden_by UUID REFERENCES profiles(id),
    hidden_at TIMESTAMPTZ,
    hidden_reason TEXT,

    -- Engagement
    like_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thread reply likes
CREATE TABLE IF NOT EXISTS community_thread_reply_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reply_id UUID NOT NULL REFERENCES community_thread_replies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reply_id, user_id)
);

-- Thread follows (subscribe to notifications)
CREATE TABLE IF NOT EXISTS community_thread_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notify_replies BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(thread_id, user_id)
);

-- Trigger to update reply count
CREATE OR REPLACE FUNCTION update_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_threads
        SET reply_count = reply_count + 1,
            last_reply_at = NEW.created_at,
            last_reply_by = NEW.author_id,
            updated_at = NOW()
        WHERE id = NEW.thread_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_threads
        SET reply_count = GREATEST(0, reply_count - 1),
            updated_at = NOW()
        WHERE id = OLD.thread_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_thread_reply_count ON community_thread_replies;
CREATE TRIGGER trg_update_thread_reply_count
    AFTER INSERT OR DELETE ON community_thread_replies
    FOR EACH ROW EXECUTE FUNCTION update_thread_reply_count();

-- Trigger to update reply like count
CREATE OR REPLACE FUNCTION update_thread_reply_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_thread_replies SET like_count = like_count + 1 WHERE id = NEW.reply_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_thread_replies SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.reply_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_thread_reply_like_count ON community_thread_reply_likes;
CREATE TRIGGER trg_update_thread_reply_like_count
    AFTER INSERT OR DELETE ON community_thread_reply_likes
    FOR EACH ROW EXECUTE FUNCTION update_thread_reply_like_count();

-- Indexes for thread queries
CREATE INDEX IF NOT EXISTS idx_community_threads_world ON community_threads(world_id) WHERE world_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_threads_lodge ON community_threads(lodge_id) WHERE lodge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_threads_craft_house ON community_threads(craft_house_id) WHERE craft_house_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_threads_episode ON community_threads(episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_threads_author ON community_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_community_threads_pinned ON community_threads(is_pinned, scope_type) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_community_threads_recent ON community_threads(last_reply_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_community_thread_replies_thread ON community_thread_replies(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_thread_replies_author ON community_thread_replies(author_id);

-- =============================================================================
-- PART 3: Order Jobs Extensions
-- =============================================================================

-- Add World and Backlot project associations to jobs
ALTER TABLE order_jobs
    ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS backlot_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS preferred_lodge_id UUID REFERENCES order_lodges(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS required_lodge_id UUID REFERENCES order_lodges(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS craft_house_id UUID REFERENCES order_craft_houses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS compensation_type TEXT DEFAULT 'negotiable',
    ADD COLUMN IF NOT EXISTS compensation_range_min INTEGER,
    ADD COLUMN IF NOT EXISTS compensation_range_max INTEGER,
    ADD COLUMN IF NOT EXISTS is_union BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS union_name TEXT,
    ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'any';

-- Add check constraints
ALTER TABLE order_jobs DROP CONSTRAINT IF EXISTS order_jobs_compensation_type_check;
ALTER TABLE order_jobs ADD CONSTRAINT order_jobs_compensation_type_check
    CHECK (compensation_type IN ('negotiable', 'flat_rate', 'hourly', 'daily', 'weekly', 'deferred', 'volunteer'));

ALTER TABLE order_jobs DROP CONSTRAINT IF EXISTS order_jobs_experience_level_check;
ALTER TABLE order_jobs ADD CONSTRAINT order_jobs_experience_level_check
    CHECK (experience_level IN ('any', 'entry', 'mid', 'senior', 'lead'));

-- Indexes for job queries
CREATE INDEX IF NOT EXISTS idx_order_jobs_world ON order_jobs(world_id) WHERE world_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_jobs_backlot_project ON order_jobs(backlot_project_id) WHERE backlot_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_jobs_preferred_lodge ON order_jobs(preferred_lodge_id) WHERE preferred_lodge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_jobs_required_lodge ON order_jobs(required_lodge_id) WHERE required_lodge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_jobs_craft_house ON order_jobs(craft_house_id) WHERE craft_house_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_jobs_department ON order_jobs(department) WHERE department IS NOT NULL;

-- =============================================================================
-- PART 4: Career/Credits Extensions
-- =============================================================================

-- Add Order member link to world_credits for verified credits
ALTER TABLE world_credits
    ADD COLUMN IF NOT EXISTS order_member_id UUID REFERENCES order_member_profiles(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- Create index for member credits lookup
CREATE INDEX IF NOT EXISTS idx_world_credits_order_member ON world_credits(order_member_id) WHERE order_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_world_credits_user ON world_credits(user_id) WHERE user_id IS NOT NULL;

-- Add similar fields to episode_credits
ALTER TABLE episode_credits
    ADD COLUMN IF NOT EXISTS order_member_id UUID REFERENCES order_member_profiles(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_episode_credits_order_member ON episode_credits(order_member_id) WHERE order_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_episode_credits_user ON episode_credits(user_id) WHERE user_id IS NOT NULL;

-- =============================================================================
-- PART 5: Career Views
-- =============================================================================

-- Member filmography view (credits across all Worlds)
CREATE OR REPLACE VIEW v_member_filmography AS
SELECT
    COALESCE(wc.user_id, wc.order_member_id) as member_id,
    wc.id as credit_id,
    'world' as credit_type,
    wc.world_id,
    NULL::UUID as episode_id,
    w.title as project_title,
    w.cover_art_url as project_image,
    w.content_format,
    w.premiere_date,
    wc.department,
    wc.role,
    wc.character_name,
    wc.is_featured,
    wc.is_top_billed,
    wc.is_verified,
    wc.billing_order,
    wc.created_at
FROM world_credits wc
JOIN worlds w ON wc.world_id = w.id
WHERE wc.is_public = true
  AND (wc.user_id IS NOT NULL OR wc.order_member_id IS NOT NULL)

UNION ALL

SELECT
    COALESCE(ec.user_id, ec.order_member_id) as member_id,
    ec.id as credit_id,
    'episode' as credit_type,
    e.world_id,
    ec.episode_id,
    w.title || ' - ' || e.title as project_title,
    COALESCE(e.thumbnail_url, w.cover_art_url) as project_image,
    w.content_format,
    e.published_at as premiere_date,
    ec.department,
    ec.role,
    ec.character_name,
    ec.is_featured,
    ec.is_top_billed,
    ec.is_verified,
    ec.billing_order,
    ec.created_at
FROM episode_credits ec
JOIN episodes e ON ec.episode_id = e.id
JOIN worlds w ON e.world_id = w.id
WHERE ec.is_public = true
  AND (ec.user_id IS NOT NULL OR ec.order_member_id IS NOT NULL);

-- World crew network view (all people who worked on a World)
CREATE OR REPLACE VIEW v_world_crew_network AS
SELECT
    wc.world_id,
    wc.id as credit_id,
    COALESCE(wc.user_id, wc.order_member_id) as member_id,
    p.display_name as member_name,
    p.avatar_url as member_avatar,
    omp.primary_track,
    omp.city as member_city,
    ol.name as lodge_name,
    ol.id as lodge_id,
    wc.department,
    wc.role,
    wc.character_name,
    wc.is_featured,
    wc.is_top_billed,
    wc.is_verified,
    wc.billing_order
FROM world_credits wc
LEFT JOIN profiles p ON COALESCE(wc.user_id, wc.order_member_id) = p.id
LEFT JOIN order_member_profiles omp ON COALESCE(wc.user_id, wc.order_member_id) = omp.user_id
LEFT JOIN order_lodges ol ON omp.lodge_id = ol.id
WHERE wc.is_public = true
ORDER BY wc.billing_order NULLS LAST, wc.is_top_billed DESC, wc.is_featured DESC;

-- Member job activity view
CREATE OR REPLACE VIEW v_member_job_activity AS
SELECT
    oja.user_id as member_id,
    oja.id as application_id,
    oja.status as application_status,
    oja.created_at as applied_at,
    oj.id as job_id,
    oj.title as job_title,
    oj.location as job_location,
    oj.job_type,
    oj.department,
    oj.compensation_type,
    oj.is_active as job_is_active,
    oj.starts_at as job_starts_at,
    oj.world_id,
    w.title as world_title,
    oj.backlot_project_id,
    bp.title as project_title,
    oj.lodge_id,
    ol.name as lodge_name
FROM order_job_applications oja
JOIN order_jobs oj ON oja.job_id = oj.id
LEFT JOIN worlds w ON oj.world_id = w.id
LEFT JOIN backlot_projects bp ON oj.backlot_project_id = bp.id
LEFT JOIN order_lodges ol ON oj.lodge_id = ol.id;

-- =============================================================================
-- PART 6: Thread Type Seed Data
-- =============================================================================

-- Common thread types for categorization
COMMENT ON COLUMN community_threads.thread_type IS
'Thread types: discussion, question, announcement, episode_reaction, bts_talk,
festival_reaction, review, showcase, feedback, poll, event';

COMMIT;
