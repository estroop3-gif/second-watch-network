-- Migration 271: Campaign Send Frequency Modes
-- Adds pacing columns for staggered/drip delivery and send windows

-- Update send_type CHECK constraint to include new modes
ALTER TABLE crm_email_campaigns DROP CONSTRAINT IF EXISTS crm_email_campaigns_send_type_check;
ALTER TABLE crm_email_campaigns ADD CONSTRAINT crm_email_campaigns_send_type_check
    CHECK (send_type = ANY (ARRAY['blast', 'manual', 'scheduled', 'drip', 'staggered']));

-- Migrate existing send_type values: 'manual' -> 'blast'
UPDATE crm_email_campaigns SET send_type = 'blast' WHERE send_type = 'manual';

-- New columns on campaigns for pacing control
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS
    stagger_minutes_between INTEGER;

ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS
    drip_min_minutes INTEGER;

ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS
    drip_max_minutes INTEGER;

ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS
    send_window_start TIME;

ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS
    send_window_end TIME;

-- Per-send scheduling on sends table
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS
    next_send_at TIMESTAMPTZ;

-- Index for efficient scheduler queries
CREATE INDEX IF NOT EXISTS idx_crm_email_sends_next_send_at
    ON crm_email_sends(next_send_at) WHERE status = 'pending';

-- Add 'cancelled' to sends status constraint (for stopping campaigns mid-send)
ALTER TABLE crm_email_sends DROP CONSTRAINT IF EXISTS crm_email_sends_status_check;
ALTER TABLE crm_email_sends ADD CONSTRAINT crm_email_sends_status_check
    CHECK (status = ANY (ARRAY['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'cancelled']));

-- Toggle to include manually-added contacts (source='outbound') in campaign targeting
-- Default false: only scraped/imported contacts are targeted
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS
    include_manual_contacts BOOLEAN DEFAULT FALSE;
