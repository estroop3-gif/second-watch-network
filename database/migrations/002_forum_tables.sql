-- Second Watch Network - Forum Tables Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- FORUM CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS forum_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for forum categories
CREATE INDEX IF NOT EXISTS idx_forum_categories_slug ON forum_categories(slug);

-- ============================================================================
-- FORUM THREADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS forum_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id UUID REFERENCES forum_categories(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for forum threads
CREATE INDEX IF NOT EXISTS idx_forum_threads_author_id ON forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_category_id ON forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_is_pinned ON forum_threads(is_pinned);
CREATE INDEX IF NOT EXISTS idx_forum_threads_created_at ON forum_threads(created_at DESC);

-- ============================================================================
-- FORUM REPLIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for forum replies
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread_id ON forum_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author_id ON forum_replies(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_created_at ON forum_replies(created_at);

-- ============================================================================
-- FORUM HELPER FUNCTIONS
-- ============================================================================

-- Function to increment thread reply count
CREATE OR REPLACE FUNCTION increment_thread_replies(thread_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE forum_threads
    SET reply_count = reply_count + 1
    WHERE id = thread_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement thread reply count
CREATE OR REPLACE FUNCTION decrement_thread_replies(thread_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE forum_threads
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = thread_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update thread reply count on reply insert
CREATE OR REPLACE FUNCTION auto_increment_thread_replies()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE forum_threads
    SET reply_count = reply_count + 1
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_thread_replies
    AFTER INSERT ON forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION auto_increment_thread_replies();

-- Trigger to update thread reply count on reply delete
CREATE OR REPLACE FUNCTION auto_decrement_thread_replies()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE forum_threads
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = OLD.thread_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_thread_replies
    AFTER DELETE ON forum_replies
    FOR EACH ROW
    EXECUTE FUNCTION auto_decrement_thread_replies();

-- Create trigger for updated_at
CREATE TRIGGER update_forum_threads_updated_at BEFORE UPDATE ON forum_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT CATEGORIES
-- ============================================================================
INSERT INTO forum_categories (name, description, slug) VALUES
    ('General Discussion', 'General filmmaking discussions', 'general'),
    ('Production', 'Production-related topics', 'production'),
    ('Post-Production', 'Editing, color grading, VFX', 'post-production'),
    ('Equipment', 'Cameras, lighting, and gear', 'equipment'),
    ('Collaboration', 'Find collaborators and build teams', 'collaboration'),
    ('Showcases', 'Share your work', 'showcases')
ON CONFLICT (slug) DO NOTHING;
