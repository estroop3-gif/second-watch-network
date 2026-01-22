-- Application Templates table for users to save and reuse application templates
CREATE TABLE IF NOT EXISTS application_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    cover_letter TEXT,
    elevator_pitch VARCHAR(100),
    rate_expectation VARCHAR(255),
    availability_notes TEXT,
    default_reel_url TEXT,
    default_headshot_url TEXT,
    default_resume_url TEXT,
    default_resume_id UUID,
    default_credit_ids UUID[] DEFAULT '{}',
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for application_templates
CREATE INDEX IF NOT EXISTS idx_application_templates_user_id ON application_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_application_templates_default ON application_templates(user_id, is_default) WHERE is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_application_templates_unique_default
ON application_templates(user_id) WHERE is_default = true;


-- User Resumes table for storing uploaded resume files
CREATE TABLE IF NOT EXISTS user_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    file_key TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_resumes
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id ON user_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resumes_default ON user_resumes(user_id, is_default) WHERE is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_resumes_unique_default
ON user_resumes(user_id) WHERE is_default = true;
