-- Migration 198: Add booked_user_id to backlot_project_roles table
-- This column tracks which user was booked for a project role when booking from collab applications

-- Add booked_user_id column to backlot_project_roles
ALTER TABLE backlot_project_roles
ADD COLUMN IF NOT EXISTS booked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add booked_at timestamp column if it doesn't exist
ALTER TABLE backlot_project_roles
ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP WITH TIME ZONE;

-- Add source_collab_application_id to track which application this booking came from
ALTER TABLE backlot_project_roles
ADD COLUMN IF NOT EXISTS source_collab_application_id UUID REFERENCES collab_applications(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_booked_user_id
ON backlot_project_roles(booked_user_id);

CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_source_collab_application
ON backlot_project_roles(source_collab_application_id);

-- Add comment explaining the columns
COMMENT ON COLUMN backlot_project_roles.booked_user_id IS 'User who was booked for this role';
COMMENT ON COLUMN backlot_project_roles.booked_at IS 'Timestamp when the user was booked';
COMMENT ON COLUMN backlot_project_roles.source_collab_application_id IS 'Link to the collab application that resulted in this booking';
