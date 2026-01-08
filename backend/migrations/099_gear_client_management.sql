-- Migration 099: Gear Client Management System
-- Adds client companies and enhanced contact fields for rentals

-- =============================================================================
-- CLIENT COMPANIES TABLE
-- =============================================================================
-- Group rental clients by production company/organization

CREATE TABLE IF NOT EXISTS gear_client_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,

    -- Contact Info
    email TEXT,
    phone TEXT,
    website TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'US',

    -- Company-Level Documents
    insurance_file_url TEXT,
    insurance_file_name TEXT,
    insurance_expiry DATE,
    coi_file_url TEXT,
    coi_file_name TEXT,
    coi_expiry DATE,

    -- Metadata
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for client companies
CREATE INDEX IF NOT EXISTS idx_gear_client_companies_org_id
    ON gear_client_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_client_companies_active
    ON gear_client_companies(organization_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_gear_client_companies_name
    ON gear_client_companies(organization_id, name);

-- =============================================================================
-- ENHANCED CONTACTS
-- =============================================================================
-- Add new columns to existing gear_organization_contacts table

-- Link to client company
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES gear_client_companies(id) ON DELETE SET NULL;

-- Link to platform user (for project fetching)
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Personal ID documents
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS id_photo_url TEXT;
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS id_photo_file_name TEXT;
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS id_type TEXT; -- 'drivers_license', 'passport', 'state_id', 'other'
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS id_expiry DATE;

-- Personal insurance at contact level (optional, in addition to company insurance)
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS personal_insurance_url TEXT;
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS personal_insurance_file_name TEXT;
ALTER TABLE gear_organization_contacts
    ADD COLUMN IF NOT EXISTS personal_insurance_expiry DATE;

-- Indexes for enhanced contacts
CREATE INDEX IF NOT EXISTS idx_gear_contacts_company
    ON gear_organization_contacts(client_company_id);
CREATE INDEX IF NOT EXISTS idx_gear_contacts_linked_user
    ON gear_organization_contacts(linked_user_id);

-- =============================================================================
-- UPDATED_AT TRIGGER FOR CLIENT COMPANIES
-- =============================================================================

CREATE OR REPLACE FUNCTION update_gear_client_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gear_client_companies_updated_at ON gear_client_companies;
CREATE TRIGGER gear_client_companies_updated_at
    BEFORE UPDATE ON gear_client_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_gear_client_companies_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE gear_client_companies IS 'Production companies and organizations that rent equipment';
COMMENT ON COLUMN gear_client_companies.insurance_file_url IS 'Company general liability insurance certificate';
COMMENT ON COLUMN gear_client_companies.coi_file_url IS 'Certificate of Insurance naming gear org as additional insured';
COMMENT ON COLUMN gear_organization_contacts.client_company_id IS 'Optional link to client company this contact belongs to';
COMMENT ON COLUMN gear_organization_contacts.linked_user_id IS 'Optional link to platform user for project integration';
COMMENT ON COLUMN gear_organization_contacts.id_type IS 'Type of ID: drivers_license, passport, state_id, other';
