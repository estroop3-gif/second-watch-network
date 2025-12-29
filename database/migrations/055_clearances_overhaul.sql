-- =============================================================================
-- Migration 055: Clearances System Professional Overhaul
-- =============================================================================
-- Transforms clearances into a professional-grade production clearance system
-- with document handling, workflow automation, and comprehensive rights tracking.
-- =============================================================================

-- =============================================================================
-- PART 1: ADD NEW COLUMNS TO BACKLOT_CLEARANCE_ITEMS
-- =============================================================================

-- Assignment & workflow tracking
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Priority for sorting
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Add priority constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'backlot_clearance_items_priority_check'
    ) THEN
        ALTER TABLE backlot_clearance_items
        ADD CONSTRAINT backlot_clearance_items_priority_check
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;
END $$;

-- Usage rights (flexible JSONB for media types, territories, terms, music details)
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS usage_rights JSONB DEFAULT '{}'::jsonb;

-- E&O (Errors & Omissions) insurance tracking
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS is_eo_critical BOOLEAN DEFAULT FALSE;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS chain_of_title_url TEXT;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS chain_of_title_notes TEXT;

-- Scene linking for scene-specific clearances
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;

-- Reminder tracking
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- =============================================================================
-- PART 2: CREATE INDEXES FOR NEW COLUMNS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_clearance_items_assigned_to
ON backlot_clearance_items(assigned_to_user_id)
WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clearance_items_eo_critical
ON backlot_clearance_items(project_id, is_eo_critical)
WHERE is_eo_critical = TRUE;

CREATE INDEX IF NOT EXISTS idx_clearance_items_priority
ON backlot_clearance_items(project_id, priority);

CREATE INDEX IF NOT EXISTS idx_clearance_items_scene
ON backlot_clearance_items(scene_id)
WHERE scene_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clearance_items_usage_rights
ON backlot_clearance_items USING GIN (usage_rights);

-- =============================================================================
-- PART 3: CREATE AUDIT HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_clearance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES backlot_clearance_items(id) ON DELETE CASCADE,

    -- What changed
    action TEXT NOT NULL CHECK (action IN (
        'created',
        'status_changed',
        'assigned',
        'unassigned',
        'file_uploaded',
        'file_removed',
        'edited',
        'rejected',
        'reminder_sent',
        'expired',
        'reviewed',
        'usage_rights_updated',
        'eo_flagged'
    )),

    -- Status change tracking
    old_status TEXT,
    new_status TEXT,

    -- Who made the change
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name TEXT,  -- Denormalized for display when user deleted

    -- Additional context
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clearance_history_clearance
ON backlot_clearance_history(clearance_id);

CREATE INDEX IF NOT EXISTS idx_clearance_history_created
ON backlot_clearance_history(clearance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clearance_history_action
ON backlot_clearance_history(action);

-- =============================================================================
-- PART 4: CREATE E&O REQUIREMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_eo_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Requirement definition
    clearance_type TEXT NOT NULL CHECK (clearance_type IN (
        'talent_release',
        'location_release',
        'appearance_release',
        'nda',
        'music_license',
        'stock_license',
        'other_contract'
    )),

    -- Details
    requirement_name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,

    -- Linked clearance (when satisfied)
    linked_clearance_id UUID REFERENCES backlot_clearance_items(id) ON DELETE SET NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN (
        'missing',
        'partial',
        'complete',
        'waived'
    )),

    -- Waiver tracking
    waived_reason TEXT,
    waived_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    waived_at TIMESTAMPTZ,

    -- Ordering
    sort_order INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eo_requirements_project
ON backlot_eo_requirements(project_id);

CREATE INDEX IF NOT EXISTS idx_eo_requirements_status
ON backlot_eo_requirements(project_id, status);

CREATE INDEX IF NOT EXISTS idx_eo_requirements_type
ON backlot_eo_requirements(project_id, clearance_type);

-- =============================================================================
-- PART 5: CREATE E&O REQUIREMENT TEMPLATES (Default checklists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_eo_requirement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template scope (NULL = universal)
    project_type TEXT,

    -- Requirement definition
    clearance_type TEXT NOT NULL,
    requirement_name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default E&O requirements
INSERT INTO backlot_eo_requirement_templates
(project_type, clearance_type, requirement_name, description, is_required, sort_order)
VALUES
    (NULL, 'talent_release', 'Lead Talent Releases', 'Signed releases for all principal cast members', TRUE, 1),
    (NULL, 'talent_release', 'Supporting Talent Releases', 'Signed releases for supporting cast', TRUE, 2),
    (NULL, 'appearance_release', 'Background/Extra Releases', 'Signed releases for all recognizable extras', TRUE, 3),
    (NULL, 'location_release', 'Primary Location Releases', 'Releases for all primary filming locations', TRUE, 4),
    (NULL, 'location_release', 'Secondary Location Releases', 'Releases for secondary/B-roll locations', FALSE, 5),
    (NULL, 'music_license', 'Sync Licenses', 'Synchronization licenses for all music used', TRUE, 6),
    (NULL, 'music_license', 'Master Use Licenses', 'Master recording licenses for all music', TRUE, 7),
    (NULL, 'stock_license', 'Stock Footage Licenses', 'Licenses for all stock footage and images', TRUE, 8),
    (NULL, 'nda', 'Key Crew NDAs', 'NDAs for key crew members with access to sensitive material', FALSE, 9),
    (NULL, 'other_contract', 'Chain of Title', 'Complete chain of title for underlying material', TRUE, 10)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PART 6: HELPER FUNCTIONS
-- =============================================================================

-- Function to auto-expire clearances
CREATE OR REPLACE FUNCTION expire_clearances()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE backlot_clearance_items
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'signed'
        AND expiration_date IS NOT NULL
        AND expiration_date < CURRENT_DATE
        RETURNING id, project_id
    ),
    history_inserts AS (
        INSERT INTO backlot_clearance_history (clearance_id, action, old_status, new_status, notes)
        SELECT id, 'expired', 'signed', 'expired', 'Auto-expired due to passed expiration date'
        FROM expired
    )
    SELECT COUNT(*) INTO expired_count FROM expired;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get E&O summary for a project
CREATE OR REPLACE FUNCTION get_project_eo_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_required INTEGER;
    total_complete INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE is_required = TRUE),
        COUNT(*) FILTER (WHERE is_required = TRUE AND status = 'complete')
    INTO total_required, total_complete
    FROM backlot_eo_requirements
    WHERE project_id = p_project_id;

    SELECT jsonb_build_object(
        'total_requirements', COUNT(*),
        'required_count', COUNT(*) FILTER (WHERE is_required = TRUE),
        'complete_count', COUNT(*) FILTER (WHERE status = 'complete'),
        'partial_count', COUNT(*) FILTER (WHERE status = 'partial'),
        'missing_count', COUNT(*) FILTER (WHERE status = 'missing'),
        'waived_count', COUNT(*) FILTER (WHERE status = 'waived'),
        'readiness_percentage', CASE
            WHEN total_required = 0 THEN 100
            ELSE ROUND((total_complete::NUMERIC / NULLIF(total_required, 0)::NUMERIC) * 100, 1)
        END,
        'is_delivery_ready', (
            COUNT(*) FILTER (WHERE is_required = TRUE AND status NOT IN ('complete', 'waived')) = 0
        ),
        'by_type', (
            SELECT COALESCE(jsonb_object_agg(clearance_type, type_data), '{}'::jsonb)
            FROM (
                SELECT
                    clearance_type,
                    jsonb_build_object(
                        'total', COUNT(*),
                        'complete', COUNT(*) FILTER (WHERE status = 'complete'),
                        'missing', COUNT(*) FILTER (WHERE status = 'missing'),
                        'partial', COUNT(*) FILTER (WHERE status = 'partial')
                    ) as type_data
                FROM backlot_eo_requirements
                WHERE project_id = p_project_id AND is_required = TRUE
                GROUP BY clearance_type
            ) type_summary
        ),
        'missing_critical', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', id,
                'requirement_name', requirement_name,
                'clearance_type', clearance_type
            )), '[]'::jsonb)
            FROM backlot_eo_requirements
            WHERE project_id = p_project_id
            AND is_required = TRUE
            AND status IN ('missing', 'partial')
            ORDER BY sort_order
        )
    ) INTO result
    FROM backlot_eo_requirements
    WHERE project_id = p_project_id;

    RETURN COALESCE(result, jsonb_build_object(
        'total_requirements', 0,
        'required_count', 0,
        'complete_count', 0,
        'readiness_percentage', 100,
        'is_delivery_ready', true,
        'by_type', '{}',
        'missing_critical', '[]'
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get expiring clearances
CREATE OR REPLACE FUNCTION get_expiring_clearances(
    p_project_id UUID,
    p_days_ahead INTEGER DEFAULT 90
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    type TEXT,
    status TEXT,
    expiration_date DATE,
    days_until_expiry INTEGER,
    is_eo_critical BOOLEAN,
    related_name TEXT,
    assigned_to_user_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.type,
        c.status,
        c.expiration_date,
        (c.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry,
        c.is_eo_critical,
        COALESCE(c.related_person_name, c.related_asset_label, l.name) as related_name,
        c.assigned_to_user_id
    FROM backlot_clearance_items c
    LEFT JOIN backlot_locations l ON c.related_location_id = l.id
    WHERE c.project_id = p_project_id
    AND c.status = 'signed'
    AND c.expiration_date IS NOT NULL
    AND c.expiration_date <= CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
    AND c.expiration_date >= CURRENT_DATE
    ORDER BY c.expiration_date ASC, c.is_eo_critical DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize E&O requirements from templates
CREATE OR REPLACE FUNCTION initialize_eo_requirements(p_project_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    WITH inserted AS (
        INSERT INTO backlot_eo_requirements (
            project_id, clearance_type, requirement_name, description,
            is_required, sort_order, status
        )
        SELECT
            p_project_id,
            t.clearance_type,
            t.requirement_name,
            t.description,
            t.is_required,
            t.sort_order,
            'missing'
        FROM backlot_eo_requirement_templates t
        WHERE t.is_active = TRUE
        AND (t.project_type IS NULL)  -- Only universal templates for now
        AND NOT EXISTS (
            SELECT 1 FROM backlot_eo_requirements r
            WHERE r.project_id = p_project_id
            AND r.requirement_name = t.requirement_name
            AND r.clearance_type = t.clearance_type
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 7: ACCESS CONTROL NOTE
-- =============================================================================
-- Row Level Security is NOT enabled on these tables.
-- Access control is handled at the application layer via the FastAPI backend,
-- which validates project membership before allowing CRUD operations.
-- This approach is used because we're not using Supabase's auth.uid() function.

-- =============================================================================
-- PART 8: ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN backlot_clearance_items.usage_rights IS
'JSONB storing flexible usage rights: {media_types: [], territories: {scope, regions, countries}, term: {type, start_date, end_date}, exclusivity, music_details: {license_type, usage_context, duration_limit, pro_affiliation}}';

COMMENT ON COLUMN backlot_clearance_items.is_eo_critical IS
'Whether this clearance is required for E&O insurance delivery';

COMMENT ON COLUMN backlot_clearance_items.priority IS
'Priority level for sorting: low, normal, high, urgent';

COMMENT ON TABLE backlot_clearance_history IS
'Audit trail for all clearance item changes including status changes, assignments, and file operations';

COMMENT ON TABLE backlot_eo_requirements IS
'E&O insurance requirement checklist for project delivery readiness';

COMMENT ON TABLE backlot_eo_requirement_templates IS
'Default E&O requirement templates used to initialize project checklists';
