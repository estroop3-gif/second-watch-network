-- Migration 238: Add visibility column to crm_contacts
-- Default 'team' = visible to all reps; 'private' = only assigned rep + admins

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team'
    CHECK (visibility IN ('private', 'team'));

-- Partial index for fast filtering on private contacts
CREATE INDEX IF NOT EXISTS idx_crm_contacts_visibility ON crm_contacts(visibility) WHERE visibility = 'private';
