-- Migration 113: Add responsible party tracking to gear incidents
-- This tracks the renter/custodian who was responsible for the item when an incident occurred

-- Add responsible party column to incidents
ALTER TABLE gear_incidents
ADD COLUMN IF NOT EXISTS responsible_party_user_id UUID REFERENCES profiles(id);

-- Index for querying incidents by responsible party
CREATE INDEX IF NOT EXISTS idx_gear_incidents_responsible_party
ON gear_incidents(responsible_party_user_id);

-- Comment for documentation
COMMENT ON COLUMN gear_incidents.responsible_party_user_id IS
  'The renter/custodian responsible for the item when the incident occurred (e.g., who had it checked out)';
