-- Add unique partial index to prevent duplicate email messages
-- Same resend_received_id should only appear once per thread
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_resend_dedup
ON crm_email_messages (resend_received_id, thread_id)
WHERE resend_received_id IS NOT NULL;
