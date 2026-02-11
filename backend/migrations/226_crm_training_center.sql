-- Migration 226: CRM Training Center - resources and discussion board

-- Training resources (videos + presentations)
CREATE TABLE IF NOT EXISTS crm_training_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('video', 'presentation')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes BIGINT,
  duration_seconds INT,
  category TEXT DEFAULT 'general',
  is_pinned BOOLEAN DEFAULT FALSE,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_training_resources_type ON crm_training_resources(resource_type, created_at DESC);

-- Discussion board categories
CREATE TABLE IF NOT EXISTS crm_discussion_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion threads
CREATE TABLE IF NOT EXISTS crm_discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES crm_discussion_categories(id),
  author_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  reply_count INT DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  resource_id UUID REFERENCES crm_training_resources(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_disc_threads_cat ON crm_discussion_threads(category_id, created_at DESC);

-- Discussion replies
CREATE TABLE IF NOT EXISTS crm_discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES crm_discussion_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_disc_replies_thread ON crm_discussion_replies(thread_id, created_at);

-- Auto-increment reply_count trigger
CREATE OR REPLACE FUNCTION update_crm_discussion_reply_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE crm_discussion_threads SET reply_count = reply_count + 1, last_reply_at = NOW() WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crm_discussion_threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_discussion_reply_count ON crm_discussion_replies;
CREATE TRIGGER trg_crm_discussion_reply_count
  AFTER INSERT OR DELETE ON crm_discussion_replies
  FOR EACH ROW EXECUTE FUNCTION update_crm_discussion_reply_count();

-- Seed default categories
INSERT INTO crm_discussion_categories (name, description, slug, is_default, sort_order) VALUES
  ('General', 'General sales team discussion', 'general', true, 1),
  ('Best Practices', 'Share tips and strategies', 'best-practices', true, 2),
  ('Tool Help', 'Questions about CRM tools', 'tool-help', true, 3),
  ('Wins & Celebrations', 'Share your wins', 'wins', true, 4)
ON CONFLICT (slug) DO NOTHING;
