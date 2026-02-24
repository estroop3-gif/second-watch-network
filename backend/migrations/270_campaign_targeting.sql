-- Migration 270: Campaign multi-source targeting
-- Adds support for 3 recipient sources: CRM Contacts, Manual Emails, Site Users

-- ============================================================================
-- crm_email_campaigns: new targeting columns
-- ============================================================================

-- Source enable flags
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS source_crm_contacts BOOLEAN DEFAULT TRUE;
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS source_manual_emails BOOLEAN DEFAULT FALSE;
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS source_site_users BOOLEAN DEFAULT FALSE;

-- Manual recipients list (array of {email, first_name, last_name, company})
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS manual_recipients JSONB DEFAULT '[]';

-- Site user targeting filters
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}';
ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS target_subscription_tiers TEXT[] DEFAULT '{}';

-- ============================================================================
-- crm_email_sends: flexible for non-contact recipients
-- ============================================================================

-- Make contact_id nullable (was NOT NULL for CRM-contact-only sends)
ALTER TABLE crm_email_sends ALTER COLUMN contact_id DROP NOT NULL;

-- Resolved recipient info at send time
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- Recipient source tracking
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS recipient_source TEXT DEFAULT 'crm_contact';

-- For site-user sends, link to profiles table
ALTER TABLE crm_email_sends ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id);

-- Add check constraint for recipient_source values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'crm_email_sends_recipient_source_check'
    ) THEN
        ALTER TABLE crm_email_sends ADD CONSTRAINT crm_email_sends_recipient_source_check
            CHECK (recipient_source IN ('crm_contact', 'manual', 'site_user'));
    END IF;
END$$;

-- Index for profile_id lookups
CREATE INDEX IF NOT EXISTS idx_crm_email_sends_profile_id ON crm_email_sends(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_email_sends_recipient_source ON crm_email_sends(recipient_source);
