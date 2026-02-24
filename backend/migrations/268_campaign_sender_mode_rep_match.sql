-- Migration 268: Add rep_match sender mode to campaigns
-- rep_match: each contact receives email from their assigned rep's email account

ALTER TABLE crm_email_campaigns DROP CONSTRAINT IF EXISTS crm_email_campaigns_sender_mode_check;
ALTER TABLE crm_email_campaigns ADD CONSTRAINT crm_email_campaigns_sender_mode_check
  CHECK (sender_mode IN ('rotate_all', 'single', 'select', 'rep_match'));
