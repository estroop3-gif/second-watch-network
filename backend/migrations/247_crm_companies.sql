-- Migration 243: CRM Companies table + company_id FK on contacts
-- Groups contacts under company entities with autocomplete support

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS crm_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    website TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT DEFAULT 'US',
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_companies_name_lower ON crm_companies(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_crm_companies_name_trgm ON crm_companies USING GIN (name gin_trgm_ops);

-- Add company_id FK to contacts
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON crm_contacts(company_id);

-- Backfill: create companies from existing contact.company text
INSERT INTO crm_companies (name, created_by)
SELECT DISTINCT ON (LOWER(TRIM(company))) TRIM(company), created_by
FROM crm_contacts
WHERE company IS NOT NULL AND TRIM(company) != ''
ORDER BY LOWER(TRIM(company)), created_at ASC
ON CONFLICT DO NOTHING;

-- Backfill: link contacts to their companies
UPDATE crm_contacts c SET company_id = cc.id
FROM crm_companies cc
WHERE c.company IS NOT NULL AND TRIM(c.company) != ''
  AND LOWER(TRIM(c.company)) = LOWER(cc.name) AND c.company_id IS NULL;
