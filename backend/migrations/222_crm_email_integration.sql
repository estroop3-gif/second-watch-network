-- Migration 222: CRM Email Deep Integration
-- Auto-counting, activity logging, deal-email linking, source attribution, avatars

-- New interaction count columns
ALTER TABLE crm_interaction_counts
  ADD COLUMN IF NOT EXISTS campaign_emails INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crm_interaction_counts
  ADD COLUMN IF NOT EXISTS emails_received INTEGER NOT NULL DEFAULT 0;

-- New activity types for email events
ALTER TABLE crm_activities DROP CONSTRAINT IF EXISTS crm_activities_activity_type_check;
ALTER TABLE crm_activities ADD CONSTRAINT crm_activities_activity_type_check
  CHECK (activity_type IN (
    'call','email','email_received','email_campaign','email_sequence',
    'sequence_enrolled','sequence_unenrolled',
    'text','meeting','demo','follow_up','proposal_sent','note','other'
  ));

-- Deal-email linking
ALTER TABLE crm_email_threads ADD COLUMN IF NOT EXISTS deal_id UUID;
DO $$ BEGIN
  ALTER TABLE crm_email_threads ADD CONSTRAINT fk_crm_email_threads_deal
    FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_deal_id
  ON crm_email_threads(deal_id) WHERE deal_id IS NOT NULL;

-- Message source attribution
ALTER TABLE crm_email_messages ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE crm_email_messages ADD COLUMN IF NOT EXISTS source_id UUID;

-- Email account avatar
ALTER TABLE crm_email_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Analytics index
CREATE INDEX IF NOT EXISTS idx_crm_email_messages_direction_created
  ON crm_email_messages(thread_id, direction, created_at);
