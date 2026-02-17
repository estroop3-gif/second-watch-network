-- Migration 248: CRM Contacts Rework
-- Adds website column, fixes scraped contact names, backfills data, unassigns scraped contacts

-- 1a. Add website column
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS website TEXT;

-- 1b. Fix scraped contacts: use full company name from crm_companies
UPDATE crm_contacts c
SET first_name = cc.name, last_name = '', updated_at = NOW()
FROM crm_companies cc
WHERE c.last_name = '(Company)' AND c.source = 'scraped'
  AND c.company_id IS NOT NULL AND cc.id = c.company_id;

-- Fix scraped contacts without company_id but with company text
UPDATE crm_contacts
SET first_name = COALESCE(NULLIF(TRIM(company), ''), first_name),
    last_name = '', updated_at = NOW()
WHERE last_name = '(Company)' AND source = 'scraped'
  AND company_id IS NULL AND company IS NOT NULL AND TRIM(company) != '';

-- Catch remaining '(Company)' contacts
UPDATE crm_contacts SET last_name = '', updated_at = NOW()
WHERE last_name = '(Company)' AND source = 'scraped';

-- 1c. Backfill website from scraped leads via merged_contact_id
UPDATE crm_contacts c
SET website = l.website, updated_at = NOW()
FROM crm_scraped_leads l
WHERE l.merged_contact_id = c.id
  AND l.website IS NOT NULL AND TRIM(l.website) != ''
  AND (c.website IS NULL OR TRIM(c.website) = '');

-- 1d. Backfill website from linked company
UPDATE crm_contacts c
SET website = cc.website, updated_at = NOW()
FROM crm_companies cc
WHERE c.company_id = cc.id
  AND cc.website IS NOT NULL AND TRIM(cc.website) != ''
  AND (c.website IS NULL OR TRIM(c.website) = '');

-- 1e. Backfill company websites from scraped leads
UPDATE crm_companies cc
SET website = sub.website, updated_at = NOW()
FROM (
    SELECT DISTINCT ON (c.company_id) c.company_id, l.website
    FROM crm_contacts c
    JOIN crm_scraped_leads l ON l.merged_contact_id = c.id
    WHERE c.company_id IS NOT NULL
      AND l.website IS NOT NULL AND TRIM(l.website) != ''
    ORDER BY c.company_id, l.created_at DESC
) sub
WHERE cc.id = sub.company_id
  AND (cc.website IS NULL OR TRIM(cc.website) = '');

-- 1f. Unassign all scraped contacts (they should be in unassigned pool)
UPDATE crm_contacts
SET assigned_rep_id = NULL, updated_at = NOW()
WHERE source = 'scraped';
