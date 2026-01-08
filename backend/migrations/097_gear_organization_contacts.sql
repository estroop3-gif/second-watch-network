-- Migration 097: Gear Organization Contacts
-- Non-user custodians/contacts for gear checkout

-- Table for storing external contacts per organization
CREATE TABLE IF NOT EXISTS gear_organization_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    job_title TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'US',

    -- Additional info
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gear_org_contacts_org_id ON gear_organization_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_org_contacts_active ON gear_organization_contacts(organization_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_gear_org_contacts_email ON gear_organization_contacts(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_org_contacts_name ON gear_organization_contacts(organization_id, last_name, first_name);

-- Update gear_transactions to allow contact as custodian (nullable foreign key)
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS custodian_contact_id UUID REFERENCES gear_organization_contacts(id);

-- Index for contact-based lookups
CREATE INDEX IF NOT EXISTS idx_gear_transactions_contact ON gear_transactions(custodian_contact_id) WHERE custodian_contact_id IS NOT NULL;

-- Comment
COMMENT ON TABLE gear_organization_contacts IS 'External contacts (non-users) who can be custodians for gear checkouts';
COMMENT ON COLUMN gear_transactions.custodian_contact_id IS 'External contact custodian (alternative to primary_custodian_id for non-users)';
