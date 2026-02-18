-- Migration 252: Admin Email System
-- Extends CRM email infrastructure to support admin/system email accounts with inboxes

-- 1a. Allow admin/system accounts without a profile owner
ALTER TABLE crm_email_accounts ALTER COLUMN profile_id DROP NOT NULL;

-- 1b. Account type discriminator
ALTER TABLE crm_email_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'rep'
  CHECK (account_type IN ('rep', 'admin', 'system'));
CREATE INDEX IF NOT EXISTS idx_crm_email_accounts_type ON crm_email_accounts(account_type);

-- 1c. Junction table for user access grants to admin/system email accounts
CREATE TABLE IF NOT EXISTS admin_email_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES crm_email_accounts(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    granted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_email_access_profile ON admin_email_access(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_email_access_account ON admin_email_access(account_id);
