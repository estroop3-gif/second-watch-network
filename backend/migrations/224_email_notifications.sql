-- Migration 224: Email notification system
-- Adds notification preferences to email accounts and a digest queue

-- Notification preferences on email accounts
ALTER TABLE crm_email_accounts
  ADD COLUMN IF NOT EXISTS notification_email TEXT,
  ADD COLUMN IF NOT EXISTS notification_mode TEXT DEFAULT 'off'
    CHECK (notification_mode IN ('off', 'instant', 'digest')),
  ADD COLUMN IF NOT EXISTS notification_digest_interval TEXT DEFAULT 'hourly'
    CHECK (notification_digest_interval IN ('hourly', 'daily')),
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- Digest queue for batching notifications
CREATE TABLE IF NOT EXISTS crm_email_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES crm_email_accounts(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES crm_email_threads(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES crm_email_messages(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_queue_unsent
  ON crm_email_notification_queue(account_id, created_at)
  WHERE sent_at IS NULL;
