-- Migration 281: Personal Set House Org support
-- Mirrors the personal gear org system for space/location listings

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS personal_set_house_org_id UUID REFERENCES organizations(id);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_personal_set_house_org BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orgs_personal_set_house
  ON organizations(created_by) WHERE is_personal_set_house_org = TRUE;
