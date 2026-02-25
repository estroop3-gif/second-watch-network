-- Migration 273: Filmmaker Applications Table
-- Creates table for tracking filmmaker application requests
-- This table was missing, causing DB errors on form submission

CREATE TABLE IF NOT EXISTS filmmaker_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    display_name TEXT,
    email TEXT,
    location TEXT,
    portfolio_link TEXT,
    professional_profile_link TEXT,
    years_of_experience TEXT,
    primary_roles JSONB DEFAULT '[]',
    top_projects JSONB DEFAULT '[]',
    join_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_filmmaker_applications_user_id ON filmmaker_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_filmmaker_applications_status ON filmmaker_applications(status);
CREATE INDEX IF NOT EXISTS idx_filmmaker_applications_created_at ON filmmaker_applications(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE filmmaker_applications IS 'Applications from users wanting to become filmmakers';
COMMENT ON COLUMN filmmaker_applications.status IS 'Application status: pending, approved, rejected';
