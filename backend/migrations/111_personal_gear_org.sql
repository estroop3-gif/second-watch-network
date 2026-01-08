-- Migration: 111_personal_gear_org.sql
-- Description: Add personal gear organization support for Gear House Lite
-- This enables ALL users (including FREE role) to have a personal gear org
-- for listing equipment on the marketplace

-- Add personal_gear flag to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
    is_personal_gear_org BOOLEAN DEFAULT FALSE;

-- Add personal_gear_org_id to profiles for quick lookup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
    personal_gear_org_id UUID REFERENCES organizations(id);

-- Index for quick personal org lookup
CREATE INDEX IF NOT EXISTS idx_profiles_personal_gear_org
    ON profiles(personal_gear_org_id) WHERE personal_gear_org_id IS NOT NULL;

-- Index for finding personal orgs
CREATE INDEX IF NOT EXISTS idx_organizations_personal_gear
    ON organizations(is_personal_gear_org) WHERE is_personal_gear_org = TRUE;

-- Comment on columns
COMMENT ON COLUMN organizations.is_personal_gear_org IS 'True if this is a user''s personal "My Gear" organization for marketplace listings';
COMMENT ON COLUMN profiles.personal_gear_org_id IS 'Reference to the user''s personal gear organization for quick lookup';
