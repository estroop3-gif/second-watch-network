-- Migration 211: Guided Onboarding Wizard
-- Adds onboarding sessions, steps, and project/profile extensions

-- =============================================================================
-- Onboarding Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID,  -- nullable for external crew
    access_token TEXT UNIQUE,  -- for unauthenticated access
    package_id UUID,  -- FK to document packages
    deal_memo_id UUID,  -- FK to deal memo that triggered this
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_project ON backlot_onboarding_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user ON backlot_onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_token ON backlot_onboarding_sessions(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status ON backlot_onboarding_sessions(status);

-- =============================================================================
-- Onboarding Steps
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backlot_onboarding_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('deal_memo_review', 'document_sign', 'form_fill')),
    reference_type TEXT CHECK (reference_type IN ('deal_memo', 'clearance')),
    reference_id UUID,
    form_fields JSONB DEFAULT '[]',  -- field definitions for form_fill steps
    form_data JSONB DEFAULT '{}',  -- encrypted filled data
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_session ON backlot_onboarding_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_reference ON backlot_onboarding_steps(reference_type, reference_id);

-- =============================================================================
-- Project Extensions for Onboarding
-- =============================================================================

ALTER TABLE backlot_projects
    ADD COLUMN IF NOT EXISTS default_onboarding_package_id UUID,
    ADD COLUMN IF NOT EXISTS onboarding_auto_trigger BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- Profile Extensions for Reusable Fields
-- =============================================================================

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS address_encrypted JSONB,
    ADD COLUMN IF NOT EXISTS emergency_contact_encrypted JSONB,
    ADD COLUMN IF NOT EXISTS tax_info_encrypted JSONB;
