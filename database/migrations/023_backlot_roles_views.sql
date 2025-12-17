-- Migration 023: Backlot Project Roles and View Profiles System
-- Implements project-level role assignments and configurable view presets

-- Backlot Roles Table: Assigns roles to users within a project
CREATE TABLE IF NOT EXISTS backlot_project_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    backlot_role TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id, backlot_role)
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_project ON backlot_project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_user ON backlot_project_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_role ON backlot_project_roles(backlot_role);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_primary ON backlot_project_roles(project_id, user_id) WHERE is_primary = TRUE;

-- View Profiles Table: Configurable tab/section visibility per role
CREATE TABLE IF NOT EXISTS backlot_project_view_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    backlot_role TEXT NOT NULL,
    label TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, backlot_role, is_default) WHERE is_default = TRUE
);

CREATE INDEX IF NOT EXISTS idx_backlot_view_profiles_project ON backlot_project_view_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_view_profiles_role ON backlot_project_view_profiles(backlot_role);
CREATE INDEX IF NOT EXISTS idx_backlot_view_profiles_default ON backlot_project_view_profiles(project_id, backlot_role) WHERE is_default = TRUE;

-- Update Reads Table: Track which users have read which updates
CREATE TABLE IF NOT EXISTS backlot_project_update_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id UUID NOT NULL REFERENCES backlot_project_updates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(update_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_backlot_update_reads_update ON backlot_project_update_reads(update_id);
CREATE INDEX IF NOT EXISTS idx_backlot_update_reads_user ON backlot_project_update_reads(user_id);

-- Add visible_to_roles column to existing updates table
ALTER TABLE backlot_project_updates
ADD COLUMN IF NOT EXISTS visible_to_roles TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_backlot_updates_visible_roles ON backlot_project_updates USING GIN (visible_to_roles);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_backlot_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backlot_project_roles_updated_at ON backlot_project_roles;
CREATE TRIGGER backlot_project_roles_updated_at
    BEFORE UPDATE ON backlot_project_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_roles_timestamp();

DROP TRIGGER IF EXISTS backlot_view_profiles_updated_at ON backlot_project_view_profiles;
CREATE TRIGGER backlot_view_profiles_updated_at
    BEFORE UPDATE ON backlot_project_view_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_roles_timestamp();

-- RLS Policies
ALTER TABLE backlot_project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_view_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_update_reads ENABLE ROW LEVEL SECURITY;

-- Project Roles: View for project members
CREATE POLICY "backlot_project_roles_select" ON backlot_project_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_roles.project_id
            AND m.user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Project Roles: Insert/Update/Delete for showrunners and admins
CREATE POLICY "backlot_project_roles_insert" ON backlot_project_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_roles.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_roles.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_project_roles_update" ON backlot_project_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_roles.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_roles.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_project_roles_delete" ON backlot_project_roles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_roles.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_roles.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- View Profiles: View for project members
CREATE POLICY "backlot_view_profiles_select" ON backlot_project_view_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_profiles.project_id
            AND m.user_id = auth.uid()
        )
    );

-- View Profiles: Modify for showrunners and admins only
CREATE POLICY "backlot_view_profiles_insert" ON backlot_project_view_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_profiles.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_profiles.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_view_profiles_update" ON backlot_project_view_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_profiles.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_profiles.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_view_profiles_delete" ON backlot_project_view_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_profiles.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_profiles.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Update Reads: Users can manage their own reads
CREATE POLICY "backlot_update_reads_select" ON backlot_project_update_reads
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "backlot_update_reads_insert" ON backlot_project_update_reads
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "backlot_update_reads_delete" ON backlot_project_update_reads
    FOR DELETE USING (user_id = auth.uid());

-- Helper function to get user's effective view config for a project
CREATE OR REPLACE FUNCTION get_user_view_config(p_project_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_backlot_role TEXT;
    v_config JSONB;
    v_is_owner BOOLEAN;
BEGIN
    -- Check if user is project owner (full access)
    SELECT EXISTS(
        SELECT 1 FROM backlot_projects WHERE id = p_project_id AND owner_id = p_user_id
    ) INTO v_is_owner;

    IF v_is_owner THEN
        RETURN jsonb_build_object(
            'role', 'owner',
            'tabs', jsonb_build_object(
                'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                'schedule', true, 'call-sheets', true, 'casting', true, 'locations', true,
                'gear', true, 'dailies', true, 'review', true, 'assets', true,
                'budget', true, 'daily-budget', true, 'receipts', true, 'analytics', true,
                'tasks', true, 'updates', true, 'contacts', true,
                'clearances', true, 'credits', true, 'settings', true
            ),
            'sections', jsonb_build_object('budget_numbers', true, 'admin_tools', true)
        );
    END IF;

    -- Get user's primary backlot role
    SELECT backlot_role INTO v_backlot_role
    FROM backlot_project_roles
    WHERE project_id = p_project_id AND user_id = p_user_id AND is_primary = TRUE
    LIMIT 1;

    -- If no primary role, get any role
    IF v_backlot_role IS NULL THEN
        SELECT backlot_role INTO v_backlot_role
        FROM backlot_project_roles
        WHERE project_id = p_project_id AND user_id = p_user_id
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- If no backlot role, default to crew
    IF v_backlot_role IS NULL THEN
        v_backlot_role := 'crew';
    END IF;

    -- Get the default view profile for this role
    SELECT config INTO v_config
    FROM backlot_project_view_profiles
    WHERE project_id = p_project_id AND backlot_role = v_backlot_role AND is_default = TRUE
    LIMIT 1;

    -- If no custom profile, return hardcoded defaults
    IF v_config IS NULL THEN
        v_config := get_default_view_config(v_backlot_role);
    END IF;

    RETURN jsonb_build_object('role', v_backlot_role, 'config', v_config);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hardcoded default view configs per role
CREATE OR REPLACE FUNCTION get_default_view_config(p_role TEXT)
RETURNS JSONB AS $$
BEGIN
    CASE p_role
        WHEN 'showrunner' THEN
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                    'schedule', true, 'call-sheets', true, 'casting', true, 'locations', true,
                    'gear', true, 'dailies', true, 'review', true, 'assets', true,
                    'budget', true, 'daily-budget', true, 'receipts', true, 'analytics', true,
                    'tasks', true, 'updates', true, 'contacts', true,
                    'clearances', true, 'credits', true, 'settings', true
                ),
                'sections', jsonb_build_object('budget_numbers', true, 'admin_tools', true)
            );
        WHEN 'producer' THEN
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                    'schedule', true, 'call-sheets', true, 'casting', true, 'locations', true,
                    'gear', true, 'dailies', true, 'review', true, 'assets', true,
                    'budget', true, 'daily-budget', true, 'receipts', true, 'analytics', true,
                    'tasks', true, 'updates', true, 'contacts', true,
                    'clearances', true, 'credits', true, 'settings', false
                ),
                'sections', jsonb_build_object('budget_numbers', true, 'admin_tools', false)
            );
        WHEN 'director' THEN
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                    'schedule', true, 'call-sheets', true, 'casting', true, 'locations', true,
                    'gear', true, 'dailies', true, 'review', true, 'assets', true,
                    'budget', false, 'daily-budget', false, 'receipts', false, 'analytics', false,
                    'tasks', true, 'updates', true, 'contacts', true,
                    'clearances', true, 'credits', true, 'settings', false
                ),
                'sections', jsonb_build_object('budget_numbers', false, 'admin_tools', false)
            );
        WHEN 'first_ad' THEN
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                    'schedule', true, 'call-sheets', true, 'casting', true, 'locations', true,
                    'gear', true, 'dailies', true, 'review', true, 'assets', false,
                    'budget', false, 'daily-budget', true, 'receipts', false, 'analytics', false,
                    'tasks', true, 'updates', true, 'contacts', true,
                    'clearances', true, 'credits', false, 'settings', false
                ),
                'sections', jsonb_build_object('budget_numbers', false, 'admin_tools', false)
            );
        WHEN 'dp' THEN
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                    'schedule', true, 'call-sheets', true, 'casting', false, 'locations', true,
                    'gear', true, 'dailies', true, 'review', true, 'assets', false,
                    'budget', false, 'daily-budget', false, 'receipts', false, 'analytics', false,
                    'tasks', true, 'updates', true, 'contacts', false,
                    'clearances', false, 'credits', false, 'settings', false
                ),
                'sections', jsonb_build_object('budget_numbers', false, 'admin_tools', false)
            );
        WHEN 'editor' THEN
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', true, 'coverage', true,
                    'schedule', false, 'call-sheets', false, 'casting', false, 'locations', false,
                    'gear', false, 'dailies', true, 'review', true, 'assets', true,
                    'budget', false, 'daily-budget', false, 'receipts', false, 'analytics', false,
                    'tasks', true, 'updates', true, 'contacts', false,
                    'clearances', false, 'credits', true, 'settings', false
                ),
                'sections', jsonb_build_object('budget_numbers', false, 'admin_tools', false)
            );
        ELSE -- 'crew' and any other role
            RETURN jsonb_build_object(
                'tabs', jsonb_build_object(
                    'overview', true, 'script', true, 'shot-lists', false, 'coverage', false,
                    'schedule', true, 'call-sheets', true, 'casting', false, 'locations', false,
                    'gear', false, 'dailies', false, 'review', false, 'assets', false,
                    'budget', false, 'daily-budget', false, 'receipts', false, 'analytics', false,
                    'tasks', true, 'updates', true, 'contacts', false,
                    'clearances', false, 'credits', false, 'settings', false
                ),
                'sections', jsonb_build_object('budget_numbers', false, 'admin_tools', false)
            );
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments
COMMENT ON TABLE backlot_project_roles IS 'Assigns backlot production roles to users within projects';
COMMENT ON TABLE backlot_project_view_profiles IS 'Configurable view presets that control tab/section visibility per role';
COMMENT ON TABLE backlot_project_update_reads IS 'Tracks which updates each user has read';
COMMENT ON COLUMN backlot_project_updates.visible_to_roles IS 'Array of backlot roles that can see this update';
