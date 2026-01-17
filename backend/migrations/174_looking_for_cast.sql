-- Migration: Add "Looking for Cast" support with tape workflow
-- Adds cast-specific fields to community_collabs, backlot_project_roles, and application tables

-- =====================================================
-- Add cast fields to community_collabs
-- =====================================================
ALTER TABLE community_collabs
ADD COLUMN IF NOT EXISTS requires_reel BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_headshot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_self_tape BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tape_instructions TEXT,
ADD COLUMN IF NOT EXISTS tape_format_preferences TEXT,
ADD COLUMN IF NOT EXISTS tape_workflow VARCHAR(20) DEFAULT 'upfront';

-- =====================================================
-- Add cast fields to backlot_project_roles
-- =====================================================
ALTER TABLE backlot_project_roles
ADD COLUMN IF NOT EXISTS requires_reel BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_headshot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_self_tape BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tape_instructions TEXT,
ADD COLUMN IF NOT EXISTS tape_format_preferences TEXT,
ADD COLUMN IF NOT EXISTS tape_workflow VARCHAR(20) DEFAULT 'upfront';

-- =====================================================
-- Add cast-specific fields to community_collab_applications
-- =====================================================
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS demo_reel_url TEXT,
ADD COLUMN IF NOT EXISTS self_tape_url TEXT,
ADD COLUMN IF NOT EXISTS special_skills TEXT[],
ADD COLUMN IF NOT EXISTS tape_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tape_submitted_at TIMESTAMPTZ;

-- =====================================================
-- Add cast-specific fields to backlot_project_role_applications
-- =====================================================
ALTER TABLE backlot_project_role_applications
ADD COLUMN IF NOT EXISTS demo_reel_url TEXT,
ADD COLUMN IF NOT EXISTS self_tape_url TEXT,
ADD COLUMN IF NOT EXISTS special_skills TEXT[],
ADD COLUMN IF NOT EXISTS tape_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tape_submitted_at TIMESTAMPTZ;

-- =====================================================
-- Add comments for documentation
-- =====================================================
COMMENT ON COLUMN community_collabs.tape_workflow IS 'upfront = tape required with application, after_shortlist = tape requested after shortlisting';
COMMENT ON COLUMN backlot_project_roles.tape_workflow IS 'upfront = tape required with application, after_shortlist = tape requested after shortlisting';
COMMENT ON COLUMN community_collab_applications.tape_requested_at IS 'Timestamp when tape was requested from shortlisted applicant';
COMMENT ON COLUMN community_collab_applications.tape_submitted_at IS 'Timestamp when applicant submitted their tape after request';
COMMENT ON COLUMN backlot_project_role_applications.tape_requested_at IS 'Timestamp when tape was requested from shortlisted applicant';
COMMENT ON COLUMN backlot_project_role_applications.tape_submitted_at IS 'Timestamp when applicant submitted their tape after request';
