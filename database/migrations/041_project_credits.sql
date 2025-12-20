-- Migration 041: Project Credits System
-- Tracks film/project credits with linked user profiles

CREATE TABLE IF NOT EXISTS backlot_project_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    department TEXT,
    credit_role TEXT NOT NULL,
    name TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id),
    is_primary BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    endorsement_note TEXT,
    imdb_id TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_credits_project_id ON backlot_project_credits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_credits_user_id ON backlot_project_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_project_credits_department ON backlot_project_credits(department);
