-- Migration 262: Notifications performance indexes
-- Fixes 503 timeouts on notifications endpoint caused by missing composite index

-- Composite index for the primary query pattern: filter by user + read status, sort by created_at
-- Note: Run outside transaction if using CONCURRENTLY
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
ON notifications(user_id, is_read, created_at DESC);

-- Index on type for filtered count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_type
ON notifications(user_id, type);
