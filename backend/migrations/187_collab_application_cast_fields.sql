-- Add cast-specific fields to community_collab_applications
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES user_resumes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS self_tape_url TEXT,
ADD COLUMN IF NOT EXISTS special_skills TEXT[] DEFAULT '{}';

-- Add index for resume lookups
CREATE INDEX IF NOT EXISTS idx_collab_apps_resume_id ON community_collab_applications(resume_id) WHERE resume_id IS NOT NULL;

COMMENT ON COLUMN community_collab_applications.resume_id IS 'Reference to uploaded resume';
COMMENT ON COLUMN community_collab_applications.self_tape_url IS 'URL to self-tape video for cast roles';
COMMENT ON COLUMN community_collab_applications.special_skills IS 'Array of special skills for cast roles';
