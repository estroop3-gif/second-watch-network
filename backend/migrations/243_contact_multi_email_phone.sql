-- Migration 243: Add multi-email and multi-phone array columns to crm_contacts
-- The existing email/phone fields remain as the primary contact (first value)
-- The arrays hold ALL values for display

-- Add array columns
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS emails TEXT[] DEFAULT '{}';
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS phones TEXT[] DEFAULT '{}';

-- Delete all scraped contacts (user will reimport cleanly)
DELETE FROM crm_contacts WHERE source = 'scraped';

-- Reset scraped lead statuses so they can be reimported
UPDATE crm_scraped_leads SET status = 'pending', merged_contact_id = NULL
WHERE status = 'approved';
