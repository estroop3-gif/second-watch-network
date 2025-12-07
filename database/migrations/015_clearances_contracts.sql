-- Migration 015: Releases, Contracts, and Clearances
-- Tracks all releases, licenses, contracts for delivery/sales clearance

-- =============================================================================
-- CLEARANCE ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_clearance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Type of clearance/release
    type TEXT NOT NULL CHECK (type IN (
        'talent_release',
        'location_release',
        'appearance_release',
        'nda',
        'music_license',
        'stock_license',
        'other_contract'
    )),

    -- Related entities (nullable based on type)
    related_person_id UUID NULL,  -- Can be a user_id or contact reference
    related_person_name TEXT NULL,  -- Denormalized name for display
    related_location_id UUID NULL REFERENCES backlot_locations(id) ON DELETE SET NULL,
    related_project_location_id UUID NULL,  -- For project-attached locations
    related_asset_label TEXT NULL,  -- e.g., song title, stock clip ID, etc.

    -- Details
    title TEXT NOT NULL,  -- Short title for the item
    description TEXT NULL,  -- Detailed description
    file_url TEXT NULL,  -- Uploaded contract/release PDF
    file_name TEXT NULL,  -- Original filename
    file_is_sensitive BOOLEAN DEFAULT FALSE,  -- Restrict download to admins only

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started',
        'requested',
        'signed',
        'expired',
        'rejected'
    )),

    -- Important dates
    requested_date DATE NULL,
    signed_date DATE NULL,
    expiration_date DATE NULL,

    -- Additional info
    notes TEXT NULL,
    contact_email TEXT NULL,  -- For follow-up
    contact_phone TEXT NULL,

    -- Audit
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clearance_items_project ON backlot_clearance_items(project_id);
CREATE INDEX IF NOT EXISTS idx_clearance_items_type ON backlot_clearance_items(type);
CREATE INDEX IF NOT EXISTS idx_clearance_items_status ON backlot_clearance_items(status);
CREATE INDEX IF NOT EXISTS idx_clearance_items_location ON backlot_clearance_items(related_location_id);
CREATE INDEX IF NOT EXISTS idx_clearance_items_person ON backlot_clearance_items(related_person_id);
CREATE INDEX IF NOT EXISTS idx_clearance_items_project_type ON backlot_clearance_items(project_id, type);

-- =============================================================================
-- CLEARANCE TEMPLATES (Optional - for common release types)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_clearance_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership: null = system template, user_id = user's custom template
    owner_user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'talent_release',
        'location_release',
        'appearance_release',
        'nda',
        'music_license',
        'stock_license',
        'other_contract'
    )),

    -- Template content
    description TEXT NULL,
    template_file_url TEXT NULL,  -- Blank template PDF
    default_notes TEXT NULL,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clearance_templates_type ON backlot_clearance_templates(type);
CREATE INDEX IF NOT EXISTS idx_clearance_templates_owner ON backlot_clearance_templates(owner_user_id);

-- =============================================================================
-- TRIGGER: Auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_clearance_item_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clearance_items_updated_at ON backlot_clearance_items;
CREATE TRIGGER clearance_items_updated_at
    BEFORE UPDATE ON backlot_clearance_items
    FOR EACH ROW
    EXECUTE FUNCTION update_clearance_item_timestamp();

DROP TRIGGER IF EXISTS clearance_templates_updated_at ON backlot_clearance_templates;
CREATE TRIGGER clearance_templates_updated_at
    BEFORE UPDATE ON backlot_clearance_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_clearance_item_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_clearance_templates ENABLE ROW LEVEL SECURITY;

-- Clearance items: project members can view, admins/producers can edit
CREATE POLICY "clearance_items_select" ON backlot_clearance_items
    FOR SELECT USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project member
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_clearance_items.project_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "clearance_items_insert" ON backlot_clearance_items
    FOR INSERT WITH CHECK (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin/editor
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_clearance_items.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

CREATE POLICY "clearance_items_update" ON backlot_clearance_items
    FOR UPDATE USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin/editor
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_clearance_items.project_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'editor')
        )
    );

CREATE POLICY "clearance_items_delete" ON backlot_clearance_items
    FOR DELETE USING (
        -- Project owner
        EXISTS (
            SELECT 1 FROM backlot_projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
        OR
        -- Project admin only
        EXISTS (
            SELECT 1 FROM backlot_project_members
            WHERE project_id = backlot_clearance_items.project_id
            AND user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Templates: anyone can view system templates, owners see their own
CREATE POLICY "clearance_templates_select" ON backlot_clearance_templates
    FOR SELECT USING (
        owner_user_id IS NULL  -- System templates
        OR owner_user_id = auth.uid()  -- User's own templates
    );

CREATE POLICY "clearance_templates_insert" ON backlot_clearance_templates
    FOR INSERT WITH CHECK (
        owner_user_id = auth.uid()
    );

CREATE POLICY "clearance_templates_update" ON backlot_clearance_templates
    FOR UPDATE USING (
        owner_user_id = auth.uid()
    );

CREATE POLICY "clearance_templates_delete" ON backlot_clearance_templates
    FOR DELETE USING (
        owner_user_id = auth.uid()
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get clearance summary for a project
CREATE OR REPLACE FUNCTION get_project_clearance_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'by_status', jsonb_object_agg(
            COALESCE(status, 'unknown'),
            status_count
        ),
        'by_type', (
            SELECT jsonb_object_agg(type, type_data)
            FROM (
                SELECT
                    type,
                    jsonb_build_object(
                        'total', COUNT(*),
                        'signed', COUNT(*) FILTER (WHERE status = 'signed'),
                        'requested', COUNT(*) FILTER (WHERE status = 'requested'),
                        'not_started', COUNT(*) FILTER (WHERE status = 'not_started'),
                        'expired', COUNT(*) FILTER (WHERE status = 'expired')
                    ) as type_data
                FROM backlot_clearance_items
                WHERE project_id = p_project_id
                GROUP BY type
            ) type_summary
        ),
        'expiring_soon', (
            SELECT COUNT(*)
            FROM backlot_clearance_items
            WHERE project_id = p_project_id
            AND status = 'signed'
            AND expiration_date IS NOT NULL
            AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
        )
    ) INTO result
    FROM (
        SELECT status, COUNT(*) as status_count
        FROM backlot_clearance_items
        WHERE project_id = p_project_id
        GROUP BY status
    ) status_summary;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a location has a signed release
CREATE OR REPLACE FUNCTION location_has_signed_release(p_location_id UUID, p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM backlot_clearance_items
        WHERE project_id = p_project_id
        AND (related_location_id = p_location_id OR related_project_location_id = p_location_id)
        AND type = 'location_release'
        AND status = 'signed'
        AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a person has a signed release
CREATE OR REPLACE FUNCTION person_has_signed_release(
    p_person_id UUID,
    p_project_id UUID,
    p_release_type TEXT DEFAULT 'talent_release'
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM backlot_clearance_items
        WHERE project_id = p_project_id
        AND related_person_id = p_person_id
        AND type = p_release_type
        AND status = 'signed'
        AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get release status for a location
CREATE OR REPLACE FUNCTION get_location_release_status(p_location_id UUID, p_project_id UUID)
RETURNS TEXT AS $$
DECLARE
    release_status TEXT;
BEGIN
    SELECT status INTO release_status
    FROM backlot_clearance_items
    WHERE project_id = p_project_id
    AND (related_location_id = p_location_id OR related_project_location_id = p_location_id)
    AND type = 'location_release'
    ORDER BY
        CASE status
            WHEN 'signed' THEN 1
            WHEN 'requested' THEN 2
            WHEN 'not_started' THEN 3
            WHEN 'expired' THEN 4
            ELSE 5
        END
    LIMIT 1;

    RETURN COALESCE(release_status, 'missing');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get release status for a person
CREATE OR REPLACE FUNCTION get_person_release_status(
    p_person_id UUID,
    p_project_id UUID,
    p_release_type TEXT DEFAULT 'talent_release'
)
RETURNS TEXT AS $$
DECLARE
    release_status TEXT;
BEGIN
    SELECT status INTO release_status
    FROM backlot_clearance_items
    WHERE project_id = p_project_id
    AND related_person_id = p_person_id
    AND type = p_release_type
    ORDER BY
        CASE status
            WHEN 'signed' THEN 1
            WHEN 'requested' THEN 2
            WHEN 'not_started' THEN 3
            WHEN 'expired' THEN 4
            ELSE 5
        END
    LIMIT 1;

    RETURN COALESCE(release_status, 'missing');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INSERT SOME DEFAULT TEMPLATES
-- =============================================================================

INSERT INTO backlot_clearance_templates (owner_user_id, name, type, description, default_notes)
VALUES
    (NULL, 'Standard Talent Release', 'talent_release',
     'Standard release form for on-camera talent granting rights to use their likeness.',
     'Ensure talent receives a copy of the signed release.'),
    (NULL, 'Location Release Agreement', 'location_release',
     'Permission to film at a specific location with liability provisions.',
     'Verify insurance requirements before shoot date.'),
    (NULL, 'Appearance Release (Background)', 'appearance_release',
     'Release for background extras and incidental appearances.',
     'Can be signed on-set with witness.'),
    (NULL, 'Non-Disclosure Agreement', 'nda',
     'Confidentiality agreement for cast, crew, and vendors.',
     'Should be signed before sharing script or sensitive materials.'),
    (NULL, 'Music Synchronization License', 'music_license',
     'License to synchronize music with visual media.',
     'Verify term, territory, and media rights before signing.'),
    (NULL, 'Stock Footage License', 'stock_license',
     'License for stock footage, images, or other media assets.',
     'Keep license documentation for delivery requirements.')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_clearance_items IS 'Tracks releases, contracts, licenses, and clearances for projects';
COMMENT ON TABLE backlot_clearance_templates IS 'Reusable templates for common clearance types';
COMMENT ON FUNCTION get_project_clearance_summary IS 'Returns summary statistics for project clearances';
COMMENT ON FUNCTION location_has_signed_release IS 'Checks if a location has a valid signed release';
COMMENT ON FUNCTION person_has_signed_release IS 'Checks if a person has a valid signed release of specified type';
