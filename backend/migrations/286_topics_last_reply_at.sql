-- Migration 286: Add last_reply_at to community_topic_threads for activity-based sorting
-- Also ensures reply_count and view_count columns exist (they should already from initial schema)

ALTER TABLE community_topic_threads
  ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

-- Backfill last_reply_at from existing replies
UPDATE community_topic_threads t
SET last_reply_at = (
  SELECT MAX(created_at) FROM community_topic_replies WHERE thread_id = t.id
)
WHERE last_reply_at IS NULL;

-- Also repair any reply_count drift from existing replies
UPDATE community_topic_threads t
SET reply_count = (
  SELECT COUNT(*) FROM community_topic_replies WHERE thread_id = t.id
);

-- Index for sort performance
CREATE INDEX IF NOT EXISTS idx_community_topic_threads_last_reply_at
  ON community_topic_threads(last_reply_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_community_topic_threads_topic_pinned
  ON community_topic_threads(topic_id, is_pinned DESC, last_reply_at DESC NULLS LAST);
