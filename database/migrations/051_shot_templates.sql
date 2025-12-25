-- Migration 051: Shot Templates
-- Reusable templates for common shot setups that users can apply when creating shots

-- =============================================================================
-- SHOT TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_shot_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,  -- null = global (user's personal templates)

    -- Template info
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,

    -- Shot configuration (matches backlot_shots fields)
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Expected structure:
    -- {
    --   "frame_size": "CU",
    --   "lens": "50mm Prime",
    --   "focal_length_mm": 50,
    --   "camera_height": "eye_level",
    --   "movement": "static",
    --   "est_time_minutes": 5,
    --   "technical_notes": "...",
    --   "performance_notes": "..."
    -- }

    -- Flags
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,  -- Built-in templates

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shot_templates_user ON backlot_shot_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_shot_templates_project ON backlot_shot_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_templates_default ON backlot_shot_templates(user_id, is_default);

-- =============================================================================
-- TRIGGERS: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_shot_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shot_templates_updated_at ON backlot_shot_templates;
CREATE TRIGGER shot_templates_updated_at
    BEFORE UPDATE ON backlot_shot_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_shot_templates_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- Note: RLS policies use auth.uid() which requires Supabase auth schema
-- These are skipped for non-Supabase deployments - security enforced at API level
-- =============================================================================

-- ALTER TABLE backlot_shot_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies commented out for AWS deployment (security enforced at API level)
-- Uncomment for Supabase deployment:
-- CREATE POLICY "shot_templates_select" ON backlot_shot_templates FOR SELECT USING (user_id = auth.uid() OR is_system = TRUE);
-- CREATE POLICY "shot_templates_insert" ON backlot_shot_templates FOR INSERT WITH CHECK (user_id = auth.uid());
-- CREATE POLICY "shot_templates_update" ON backlot_shot_templates FOR UPDATE USING (user_id = auth.uid() AND is_system = FALSE);
-- CREATE POLICY "shot_templates_delete" ON backlot_shot_templates FOR DELETE USING (user_id = auth.uid() AND is_system = FALSE);

-- =============================================================================
-- SEED DEFAULT SYSTEM TEMPLATES
-- =============================================================================

-- We'll create a system user placeholder or use a NULL user for system templates
-- For simplicity, system templates will have is_system = TRUE but require a user_id
-- We'll populate these via application code or admin seed script

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_shot_templates IS 'Reusable shot templates for quick shot creation';
COMMENT ON COLUMN backlot_shot_templates.project_id IS 'NULL means personal global template; set means project-specific';
COMMENT ON COLUMN backlot_shot_templates.template_data IS 'JSONB containing shot field defaults (frame_size, lens, movement, etc.)';
COMMENT ON COLUMN backlot_shot_templates.is_system IS 'Built-in templates that cannot be modified or deleted';
