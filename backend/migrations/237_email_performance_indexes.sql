-- Migration 237: Email Performance Indexes
-- Optimizes inbox loading, thread detail, and account lookups

-- Composite index for inbox default view (non-deleted, non-archived, ordered by last_message_at)
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_inbox
    ON crm_email_threads(account_id, last_message_at DESC)
    WHERE COALESCE(is_deleted, false) = false AND is_archived = false;

-- Composite index for email account lookup (used by every email endpoint)
CREATE INDEX IF NOT EXISTS idx_crm_email_accounts_profile_active
    ON crm_email_accounts(profile_id, is_active) WHERE is_active = true;

-- Index for thread labels subquery in inbox
CREATE INDEX IF NOT EXISTS idx_crm_email_thread_labels_thread
    ON crm_email_thread_labels(thread_id);

-- Composite index for message opens aggregation (used in thread detail)
CREATE INDEX IF NOT EXISTS idx_crm_email_opens_message_at
    ON crm_email_opens(message_id, opened_at);

-- Index for unread count query
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_unread
    ON crm_email_threads(account_id)
    WHERE COALESCE(is_deleted, false) = false AND is_archived = false AND unread_count > 0;
