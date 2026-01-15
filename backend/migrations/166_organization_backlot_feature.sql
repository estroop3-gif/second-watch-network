-- Migration 166: Organization Backlot Feature
-- Enables organization-based Backlot access with seat management

-- =============================================================================
-- ORGANIZATIONS TABLE: Add Backlot-specific columns
-- =============================================================================

-- Backlot access enablement and billing
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS backlot_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS backlot_seat_limit INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS backlot_billing_status VARCHAR(50) DEFAULT 'none';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS backlot_stripe_subscription_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS backlot_subscription_period_end TIMESTAMPTZ;

-- Add constraint for backlot billing status
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_backlot_billing_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_backlot_billing_status_check
  CHECK (backlot_billing_status IN ('none', 'free', 'trial', 'active', 'past_due', 'canceled'));

COMMENT ON COLUMN organizations.backlot_enabled IS 'Whether organization has Backlot production management enabled';
COMMENT ON COLUMN organizations.backlot_seat_limit IS 'Number of Backlot seats available (0 = no limit for free/enterprise)';
COMMENT ON COLUMN organizations.backlot_billing_status IS 'Backlot subscription status';

-- =============================================================================
-- ORGANIZATION MEMBERS: Add collaborative seat permissions
-- =============================================================================

-- Add project creation permission toggle for collaborative seats
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS can_create_projects BOOLEAN DEFAULT FALSE;

-- Add 'collaborative' to allowed roles (keep existing roles for backwards compatibility)
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'finance', 'creator', 'member', 'collaborative'));

COMMENT ON COLUMN organization_members.can_create_projects IS 'For collaborative seats: whether user can create new Backlot projects';

-- =============================================================================
-- ORGANIZATION SEATS: Add collaborative seat type
-- =============================================================================

-- Update seat types to include collaborative
ALTER TABLE organization_seats DROP CONSTRAINT IF EXISTS organization_seats_seat_type_check;
ALTER TABLE organization_seats ADD CONSTRAINT organization_seats_seat_type_check
  CHECK (seat_type IN ('owner', 'admin', 'member', 'collaborative'));

-- =============================================================================
-- NEW TABLE: Organization Project Access
-- Tracks which Backlot projects collaborative org members can access
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_project_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Tab-level permissions (same format as backlot_project_view_overrides)
    -- Example: {"overview": {"view": true, "edit": false}, "budget": {"view": false, "edit": false}}
    tab_permissions JSONB DEFAULT '{}',

    -- Audit fields
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_org_project_access_user ON organization_project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_org_project_access_project ON organization_project_access(project_id);
CREATE INDEX IF NOT EXISTS idx_org_project_access_org ON organization_project_access(organization_id);

COMMENT ON TABLE organization_project_access IS 'Tracks which Backlot projects collaborative org members can access with custom permissions';

-- =============================================================================
-- NEW TABLE: Backlot Project External Seats
-- Non-org seats for freelancers (project seat) and clients (view-only seat)
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_project_external_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Seat type: project (freelancer) or view_only (client)
    seat_type VARCHAR(50) NOT NULL CHECK (seat_type IN ('project', 'view_only')),

    -- Display info
    display_name VARCHAR(255),
    company_name VARCHAR(255),

    -- For project seat (freelancers) - specific permissions
    can_invoice BOOLEAN DEFAULT TRUE,
    can_expense BOOLEAN DEFAULT TRUE,
    can_timecard BOOLEAN DEFAULT TRUE,

    -- For view_only seat (clients) - custom tab visibility
    -- Example: {"overview": true, "dailies": true, "budget": false}
    tab_permissions JSONB DEFAULT '{}',

    -- Status and audit
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Work transfer tracking (when removed)
    work_transferred_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    work_transferred_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_external_seats_project ON backlot_project_external_seats(project_id);
CREATE INDEX IF NOT EXISTS idx_project_external_seats_user ON backlot_project_external_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_project_external_seats_status ON backlot_project_external_seats(status) WHERE status = 'active';

COMMENT ON TABLE backlot_project_external_seats IS 'Non-org seats: freelancers (project seat) and clients (view-only seat) on specific Backlot projects';
COMMENT ON COLUMN backlot_project_external_seats.seat_type IS 'project = freelancer with invoicing/expense access; view_only = client with configurable view access';

-- =============================================================================
-- BACKLOT PROJECTS: Link to organization
-- =============================================================================

ALTER TABLE backlot_projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backlot_projects_org ON backlot_projects(organization_id) WHERE organization_id IS NOT NULL;

COMMENT ON COLUMN backlot_projects.organization_id IS 'Organization that owns this project (NULL = individual owner)';

-- =============================================================================
-- HELPER FUNCTION: Check if user has Backlot access via organization
-- =============================================================================

CREATE OR REPLACE FUNCTION check_org_backlot_access(p_user_id UUID)
RETURNS TABLE (
    has_access BOOLEAN,
    organization_id UUID,
    organization_name TEXT,
    seat_type VARCHAR(50),
    can_create_projects BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE as has_access,
        o.id as organization_id,
        o.name as organization_name,
        om.role::VARCHAR(50) as seat_type,
        om.can_create_projects
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    WHERE om.user_id = p_user_id
      AND om.status = 'active'
      AND o.backlot_enabled = TRUE
      AND o.backlot_billing_status IN ('free', 'trial', 'active')
      AND om.role IN ('owner', 'admin', 'collaborative')
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_org_backlot_access IS 'Check if user has Backlot access through any organization membership';
