-- Migration 025: Per-User View Overrides
-- Allows showrunners to customize view/edit permissions for individual users

-- Per-User View Overrides Table
CREATE TABLE IF NOT EXISTS backlot_project_view_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_backlot_view_overrides_project ON backlot_project_view_overrides(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_view_overrides_user ON backlot_project_view_overrides(user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS backlot_view_overrides_updated_at ON backlot_project_view_overrides;
CREATE TRIGGER backlot_view_overrides_updated_at
    BEFORE UPDATE ON backlot_project_view_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_roles_timestamp();

-- RLS Policies
ALTER TABLE backlot_project_view_overrides ENABLE ROW LEVEL SECURITY;

-- View Overrides: View for project members (they can see their own overrides)
CREATE POLICY "backlot_view_overrides_select" ON backlot_project_view_overrides
    FOR SELECT USING (
        -- Project owner can see all
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        -- Showrunners can see all
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_overrides.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        -- Admins can see all
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_overrides.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
        -- Users can see their own overrides
        OR user_id = auth.uid()
    );

-- View Overrides: Insert for showrunners and admins only
CREATE POLICY "backlot_view_overrides_insert" ON backlot_project_view_overrides
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_overrides.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_overrides.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- View Overrides: Update for showrunners and admins only
CREATE POLICY "backlot_view_overrides_update" ON backlot_project_view_overrides
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_overrides.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_overrides.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- View Overrides: Delete for showrunners and admins only
CREATE POLICY "backlot_view_overrides_delete" ON backlot_project_view_overrides
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_view_overrides.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role = 'showrunner'
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_view_overrides.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Updated helper function to get user's effective view config with overrides
-- This replaces the previous version and supports view/edit object format
CREATE OR REPLACE FUNCTION get_user_view_config(p_project_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_backlot_role TEXT;
    v_base_config JSONB;
    v_override_config JSONB;
    v_is_owner BOOLEAN;
    v_merged_tabs JSONB;
    v_merged_sections JSONB;
    v_tab_key TEXT;
    v_section_key TEXT;
    v_base_value JSONB;
    v_override_value JSONB;
BEGIN
    -- Check if user is project owner (full access with edit)
    SELECT EXISTS(
        SELECT 1 FROM backlot_projects WHERE id = p_project_id AND owner_id = p_user_id
    ) INTO v_is_owner;

    IF v_is_owner THEN
        RETURN jsonb_build_object(
            'role', 'owner',
            'tabs', jsonb_build_object(
                'overview', jsonb_build_object('view', true, 'edit', true),
                'script', jsonb_build_object('view', true, 'edit', true),
                'shot-lists', jsonb_build_object('view', true, 'edit', true),
                'coverage', jsonb_build_object('view', true, 'edit', true),
                'schedule', jsonb_build_object('view', true, 'edit', true),
                'call-sheets', jsonb_build_object('view', true, 'edit', true),
                'casting', jsonb_build_object('view', true, 'edit', true),
                'locations', jsonb_build_object('view', true, 'edit', true),
                'gear', jsonb_build_object('view', true, 'edit', true),
                'dailies', jsonb_build_object('view', true, 'edit', true),
                'review', jsonb_build_object('view', true, 'edit', true),
                'assets', jsonb_build_object('view', true, 'edit', true),
                'budget', jsonb_build_object('view', true, 'edit', true),
                'daily-budget', jsonb_build_object('view', true, 'edit', true),
                'receipts', jsonb_build_object('view', true, 'edit', true),
                'analytics', jsonb_build_object('view', true, 'edit', true),
                'tasks', jsonb_build_object('view', true, 'edit', true),
                'updates', jsonb_build_object('view', true, 'edit', true),
                'contacts', jsonb_build_object('view', true, 'edit', true),
                'clearances', jsonb_build_object('view', true, 'edit', true),
                'credits', jsonb_build_object('view', true, 'edit', true),
                'settings', jsonb_build_object('view', true, 'edit', true),
                'timecards', jsonb_build_object('view', true, 'edit', true),
                'scene-view', jsonb_build_object('view', true, 'edit', true),
                'day-view', jsonb_build_object('view', true, 'edit', true),
                'person-view', jsonb_build_object('view', true, 'edit', true),
                'access', jsonb_build_object('view', true, 'edit', true)
            ),
            'sections', jsonb_build_object(
                'budget_numbers', jsonb_build_object('view', true, 'edit', true),
                'admin_tools', jsonb_build_object('view', true, 'edit', true)
            )
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

    -- Get the default view profile for this role (from project-specific profile first)
    SELECT config INTO v_base_config
    FROM backlot_project_view_profiles
    WHERE project_id = p_project_id AND backlot_role = v_backlot_role AND is_default = TRUE
    LIMIT 1;

    -- If no custom profile, get hardcoded defaults with view/edit format
    IF v_base_config IS NULL THEN
        v_base_config := get_default_view_config_v2(v_backlot_role);
    END IF;

    -- Get user-specific overrides
    SELECT config INTO v_override_config
    FROM backlot_project_view_overrides
    WHERE project_id = p_project_id AND user_id = p_user_id;

    -- If no overrides, return base config
    IF v_override_config IS NULL THEN
        RETURN jsonb_build_object('role', v_backlot_role, 'config', v_base_config);
    END IF;

    -- Merge overrides into base config (overrides take precedence)
    -- Merge tabs
    v_merged_tabs := COALESCE(v_base_config->'tabs', '{}'::jsonb);
    IF v_override_config ? 'tabs' THEN
        FOR v_tab_key IN SELECT jsonb_object_keys(v_override_config->'tabs')
        LOOP
            v_merged_tabs := jsonb_set(v_merged_tabs, ARRAY[v_tab_key], v_override_config->'tabs'->v_tab_key);
        END LOOP;
    END IF;

    -- Merge sections
    v_merged_sections := COALESCE(v_base_config->'sections', '{}'::jsonb);
    IF v_override_config ? 'sections' THEN
        FOR v_section_key IN SELECT jsonb_object_keys(v_override_config->'sections')
        LOOP
            v_merged_sections := jsonb_set(v_merged_sections, ARRAY[v_section_key], v_override_config->'sections'->v_section_key);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'role', v_backlot_role,
        'has_overrides', true,
        'config', jsonb_build_object('tabs', v_merged_tabs, 'sections', v_merged_sections)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New version of default view config that returns view/edit objects
CREATE OR REPLACE FUNCTION get_default_view_config_v2(p_role TEXT)
RETURNS JSONB AS $$
DECLARE
    v_old_config JSONB;
    v_new_tabs JSONB := '{}'::jsonb;
    v_new_sections JSONB := '{}'::jsonb;
    v_key TEXT;
    v_value BOOLEAN;
BEGIN
    -- Get the old boolean-based config
    v_old_config := get_default_view_config(p_role);

    -- Convert tabs from boolean to {view, edit} objects
    -- For most roles: view = old value, edit = true only for showrunner/producer
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(v_old_config->'tabs')
    LOOP
        IF v_value::boolean THEN
            -- Has view access - edit depends on role
            IF p_role IN ('showrunner', 'producer') THEN
                v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', true));
            ELSIF p_role IN ('director', 'first_ad') THEN
                -- Directors and 1st ADs can edit schedule, shot-lists, etc but not budget
                IF v_key IN ('shot-lists', 'coverage', 'schedule', 'call-sheets', 'casting', 'tasks') THEN
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', true));
                ELSE
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', false));
                END IF;
            ELSIF p_role = 'dp' THEN
                -- DP can edit camera/gear related tabs
                IF v_key IN ('shot-lists', 'coverage', 'gear', 'dailies') THEN
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', true));
                ELSE
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', false));
                END IF;
            ELSIF p_role = 'editor' THEN
                -- Editor can edit dailies and review
                IF v_key IN ('dailies', 'review', 'assets') THEN
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', true));
                ELSE
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', false));
                END IF;
            ELSIF p_role = 'department_head' THEN
                -- Department heads can edit tasks
                IF v_key IN ('tasks', 'schedule') THEN
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', true));
                ELSE
                    v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', false));
                END IF;
            ELSE
                -- Crew: view only
                v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', true, 'edit', false));
            END IF;
        ELSE
            -- No access
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY[v_key], jsonb_build_object('view', false, 'edit', false));
        END IF;
    END LOOP;

    -- Add new tabs that weren't in the old config
    IF NOT v_new_tabs ? 'timecards' THEN
        IF p_role IN ('showrunner', 'producer', 'first_ad') THEN
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['timecards'], jsonb_build_object('view', true, 'edit', true));
        ELSIF p_role IN ('director', 'dp', 'editor', 'department_head') THEN
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['timecards'], jsonb_build_object('view', true, 'edit', false));
        ELSE
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['timecards'], jsonb_build_object('view', true, 'edit', false));
        END IF;
    END IF;

    IF NOT v_new_tabs ? 'scene-view' THEN
        v_new_tabs := jsonb_set(v_new_tabs, ARRAY['scene-view'], jsonb_build_object('view', true, 'edit', false));
    END IF;

    IF NOT v_new_tabs ? 'day-view' THEN
        v_new_tabs := jsonb_set(v_new_tabs, ARRAY['day-view'], jsonb_build_object('view', true, 'edit', false));
    END IF;

    IF NOT v_new_tabs ? 'person-view' THEN
        IF p_role IN ('showrunner', 'producer', 'first_ad') THEN
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['person-view'], jsonb_build_object('view', true, 'edit', false));
        ELSE
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['person-view'], jsonb_build_object('view', false, 'edit', false));
        END IF;
    END IF;

    IF NOT v_new_tabs ? 'access' THEN
        IF p_role = 'showrunner' THEN
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['access'], jsonb_build_object('view', true, 'edit', true));
        ELSE
            v_new_tabs := jsonb_set(v_new_tabs, ARRAY['access'], jsonb_build_object('view', false, 'edit', false));
        END IF;
    END IF;

    -- Convert sections
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(v_old_config->'sections')
    LOOP
        IF v_value::boolean THEN
            IF p_role IN ('showrunner', 'producer') THEN
                v_new_sections := jsonb_set(v_new_sections, ARRAY[v_key], jsonb_build_object('view', true, 'edit', true));
            ELSE
                v_new_sections := jsonb_set(v_new_sections, ARRAY[v_key], jsonb_build_object('view', true, 'edit', false));
            END IF;
        ELSE
            v_new_sections := jsonb_set(v_new_sections, ARRAY[v_key], jsonb_build_object('view', false, 'edit', false));
        END IF;
    END LOOP;

    RETURN jsonb_build_object('tabs', v_new_tabs, 'sections', v_new_sections);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments
COMMENT ON TABLE backlot_project_view_overrides IS 'Per-user view/edit permission overrides that merge with role-based profiles';
COMMENT ON FUNCTION get_default_view_config_v2(TEXT) IS 'Returns view config with view/edit objects instead of booleans';
