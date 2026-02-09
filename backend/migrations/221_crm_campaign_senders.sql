-- Migration 221: Campaign sender rotation support
-- Junction table: which email accounts are assigned to each campaign
CREATE TABLE IF NOT EXISTS crm_campaign_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES crm_email_campaigns(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES crm_email_accounts(id) ON DELETE CASCADE,
    send_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_campaign_senders_campaign ON crm_campaign_senders(campaign_id);

-- Track which sender sent each individual email + Resend ID for tracking
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS sender_account_id UUID REFERENCES crm_email_accounts(id);
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS resend_message_id TEXT;

-- Per-campaign rate control
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 10;
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS send_delay_seconds INTEGER DEFAULT 5;
