-- Migration 159: Organization Location Fields
-- Adds org_type and address fields to organizations table for gear house location

-- Add org_type column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS org_type TEXT DEFAULT 'production_company'
    CHECK (org_type IN ('production_company', 'rental_house', 'hybrid'));

-- Add address fields
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';

-- Comments
COMMENT ON COLUMN organizations.org_type IS 'Type of organization: production_company, rental_house, or hybrid';
COMMENT ON COLUMN organizations.address_line1 IS 'Street address for the organization location';
COMMENT ON COLUMN organizations.city IS 'City of the organization';
COMMENT ON COLUMN organizations.state IS 'State/region code (e.g., CA, NY)';
COMMENT ON COLUMN organizations.postal_code IS 'ZIP/postal code';
COMMENT ON COLUMN organizations.country IS 'Country code (default: US)';
