-- Migration 254: Media Hub Phase 2 — Events/Meetups + Creative Discussions
-- Adds 7 tables, 2 triggers, and seed data for discussion categories

-- ============================================================================
-- EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('content_shoot', 'meetup', 'premiere', 'watch_party', 'interview', 'photoshoot', 'livestream', 'other')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    duration_minutes INTEGER,
    venue_name TEXT,
    address TEXT,
    virtual_link TEXT,
    is_virtual BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    request_id UUID REFERENCES media_content_requests(id) ON DELETE SET NULL,
    color TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_events_start_date ON media_events(start_date);
CREATE INDEX IF NOT EXISTS idx_media_events_status ON media_events(status);
CREATE INDEX IF NOT EXISTS idx_media_events_event_type ON media_events(event_type);
CREATE INDEX IF NOT EXISTS idx_media_events_created_by ON media_events(created_by);
CREATE INDEX IF NOT EXISTS idx_media_events_request_id ON media_events(request_id);

CREATE TABLE IF NOT EXISTS media_event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES media_events(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rsvp_status TEXT NOT NULL DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'accepted', 'declined', 'maybe', 'attended')),
    role TEXT,
    notes TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, profile_id)
);

CREATE TABLE IF NOT EXISTS media_event_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES media_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    assigned_to UUID REFERENCES profiles(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_event_agenda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES media_events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DISCUSSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_discussion_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    created_by UUID REFERENCES profiles(id),
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    thread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_discussion_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES media_discussion_categories(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    last_reply_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_disc_threads_category ON media_discussion_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_media_disc_threads_author ON media_discussion_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_media_disc_threads_last_activity ON media_discussion_threads(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS media_discussion_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES media_discussion_threads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    parent_reply_id UUID REFERENCES media_discussion_replies(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_disc_replies_thread ON media_discussion_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_media_disc_replies_parent ON media_discussion_replies(parent_reply_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Thread count on categories
CREATE OR REPLACE FUNCTION update_media_disc_category_thread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE media_discussion_categories SET thread_count = thread_count + 1 WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE media_discussion_categories SET thread_count = GREATEST(thread_count - 1, 0) WHERE id = OLD.category_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_media_disc_category_thread_count ON media_discussion_threads;
CREATE TRIGGER trg_media_disc_category_thread_count
    AFTER INSERT OR DELETE ON media_discussion_threads
    FOR EACH ROW EXECUTE FUNCTION update_media_disc_category_thread_count();

-- Reply count + last_activity on threads
CREATE OR REPLACE FUNCTION update_media_disc_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE media_discussion_threads
        SET reply_count = reply_count + 1,
            last_activity_at = NOW(),
            last_reply_by = NEW.author_id
        WHERE id = NEW.thread_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE media_discussion_threads
        SET reply_count = GREATEST(reply_count - 1, 0),
            last_activity_at = NOW()
        WHERE id = OLD.thread_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_media_disc_thread_reply_count ON media_discussion_replies;
CREATE TRIGGER trg_media_disc_thread_reply_count
    AFTER INSERT OR DELETE ON media_discussion_replies
    FOR EACH ROW EXECUTE FUNCTION update_media_disc_thread_reply_count();

-- ============================================================================
-- SEED DATA — Default discussion categories
-- ============================================================================

INSERT INTO media_discussion_categories (name, description, slug, icon, is_default, sort_order)
VALUES
    ('Content Ideas', 'Share and discuss content ideas for upcoming projects', 'content-ideas', 'lightbulb', TRUE, 0),
    ('Feedback', 'Give and receive feedback on content and processes', 'feedback', 'message-circle', TRUE, 1),
    ('Brainstorming', 'Open brainstorming sessions for creative concepts', 'brainstorming', 'brain', TRUE, 2),
    ('General', 'General discussions about the media team and projects', 'general', 'message-square', TRUE, 3)
ON CONFLICT (slug) DO NOTHING;
