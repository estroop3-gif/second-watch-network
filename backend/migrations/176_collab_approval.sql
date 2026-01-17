-- Migration: Add approval workflow for community collabs
-- This adds support for admin approval of collab postings

-- Add approval fields to community_collabs
ALTER TABLE community_collabs ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE community_collabs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE community_collabs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE community_collabs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add backlot_project_id if it doesn't exist (for linking collabs to Backlot projects)
ALTER TABLE community_collabs ADD COLUMN IF NOT EXISTS backlot_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL;

-- Add site setting for requiring approval
INSERT INTO settings (key, value)
VALUES ('require_collab_approval', '"false"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_collabs_approval_status ON community_collabs(approval_status);
CREATE INDEX IF NOT EXISTS idx_community_collabs_backlot_project_id ON community_collabs(backlot_project_id);

-- Update existing collabs to have 'approved' status (backwards compatibility)
UPDATE community_collabs SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN community_collabs.approval_status IS 'pending, approved, or rejected';
COMMENT ON COLUMN community_collabs.backlot_project_id IS 'Links collab to a Backlot project when posted from Casting & Crew tab';
