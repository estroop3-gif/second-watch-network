-- Craft House Discussions Migration
-- Adds topics, threads, and replies for craft house community features

-- ============================================================
-- CRAFT HOUSE TOPICS (categories within a craft house)
-- ============================================================

CREATE TABLE IF NOT EXISTS craft_house_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    craft_house_id INT NOT NULL REFERENCES order_craft_houses(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    is_members_only BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    thread_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(craft_house_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ch_topics_craft_house ON craft_house_topics(craft_house_id);
CREATE INDEX IF NOT EXISTS idx_ch_topics_active ON craft_house_topics(craft_house_id, is_active);

-- ============================================================
-- CRAFT HOUSE THREADS
-- ============================================================

CREATE TABLE IF NOT EXISTS craft_house_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES craft_house_topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    title VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_announcement BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    reply_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    last_reply_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ch_threads_topic ON craft_house_threads(topic_id);
CREATE INDEX IF NOT EXISTS idx_ch_threads_user ON craft_house_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_ch_threads_pinned ON craft_house_threads(topic_id, is_pinned DESC, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_ch_threads_activity ON craft_house_threads(topic_id, last_activity_at DESC);

-- ============================================================
-- CRAFT HOUSE REPLIES
-- ============================================================

CREATE TABLE IF NOT EXISTS craft_house_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES craft_house_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    parent_reply_id UUID REFERENCES craft_house_replies(id) ON DELETE CASCADE,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ch_replies_thread ON craft_house_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_ch_replies_user ON craft_house_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_ch_replies_parent ON craft_house_replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_ch_replies_created ON craft_house_replies(thread_id, created_at);

-- ============================================================
-- TRIGGERS FOR AUTOMATIC COUNTS
-- ============================================================

-- Update thread count on topics when threads are added/removed
CREATE OR REPLACE FUNCTION update_topic_thread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE craft_house_topics SET thread_count = thread_count + 1, updated_at = NOW()
        WHERE id = NEW.topic_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE craft_house_topics SET thread_count = thread_count - 1, updated_at = NOW()
        WHERE id = OLD.topic_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_topic_thread_count ON craft_house_threads;
CREATE TRIGGER trigger_update_topic_thread_count
AFTER INSERT OR DELETE ON craft_house_threads
FOR EACH ROW EXECUTE FUNCTION update_topic_thread_count();

-- Update reply count on threads when replies are added/removed
CREATE OR REPLACE FUNCTION update_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE craft_house_threads SET
            reply_count = reply_count + 1,
            last_activity_at = NOW(),
            last_reply_by = NEW.user_id,
            updated_at = NOW()
        WHERE id = NEW.thread_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE craft_house_threads SET
            reply_count = reply_count - 1,
            updated_at = NOW()
        WHERE id = OLD.thread_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_reply_count ON craft_house_replies;
CREATE TRIGGER trigger_update_thread_reply_count
AFTER INSERT OR DELETE ON craft_house_replies
FOR EACH ROW EXECUTE FUNCTION update_thread_reply_count();

-- ============================================================
-- SEED DEFAULT TOPICS FOR EACH CRAFT HOUSE
-- ============================================================

-- Create default topics for each existing craft house
INSERT INTO craft_house_topics (craft_house_id, name, slug, description, icon, sort_order, is_members_only)
SELECT
    ch.id,
    'General Discussion',
    'general',
    'Open discussion for all topics related to our craft',
    'message-circle',
    1,
    false
FROM order_craft_houses ch
WHERE NOT EXISTS (
    SELECT 1 FROM craft_house_topics t WHERE t.craft_house_id = ch.id AND t.slug = 'general'
);

INSERT INTO craft_house_topics (craft_house_id, name, slug, description, icon, sort_order, is_members_only)
SELECT
    ch.id,
    'Announcements',
    'announcements',
    'Official announcements from house stewards',
    'megaphone',
    0,
    false
FROM order_craft_houses ch
WHERE NOT EXISTS (
    SELECT 1 FROM craft_house_topics t WHERE t.craft_house_id = ch.id AND t.slug = 'announcements'
);

INSERT INTO craft_house_topics (craft_house_id, name, slug, description, icon, sort_order, is_members_only)
SELECT
    ch.id,
    'Gear & Equipment',
    'gear',
    'Discuss tools, equipment, and techniques of our trade',
    'wrench',
    2,
    false
FROM order_craft_houses ch
WHERE NOT EXISTS (
    SELECT 1 FROM craft_house_topics t WHERE t.craft_house_id = ch.id AND t.slug = 'gear'
);

INSERT INTO craft_house_topics (craft_house_id, name, slug, description, icon, sort_order, is_members_only)
SELECT
    ch.id,
    'Members Only',
    'members-only',
    'Private discussions for house members',
    'lock',
    3,
    true
FROM order_craft_houses ch
WHERE NOT EXISTS (
    SELECT 1 FROM craft_house_topics t WHERE t.craft_house_id = ch.id AND t.slug = 'members-only'
);

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================

-- Run this after migration to verify:
-- SELECT ch.name as craft_house, COUNT(t.id) as topic_count
-- FROM order_craft_houses ch
-- LEFT JOIN craft_house_topics t ON t.craft_house_id = ch.id
-- GROUP BY ch.id, ch.name
-- ORDER BY ch.name;
