-- Migration 255: Backlot Trial Auto-Provisioning
-- Extends backlot_trial_requests with provisioning tracking, extension fields,
-- adds trial support to organizations, and inserts a trial tier.

-- ============================================================================
-- 1. Extend backlot_trial_requests with new form fields
-- ============================================================================
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS use_case TEXT;

-- ============================================================================
-- 2. Provisioning tracking columns
-- ============================================================================
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS provisioned_profile_id UUID REFERENCES profiles(id);
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS provisioned_org_id UUID;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS provisioning_error TEXT;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ============================================================================
-- 3. Extension tracking columns
-- ============================================================================
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS extension_requested_at TIMESTAMPTZ;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS extension_approved_at TIMESTAMPTZ;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS extension_approved_by UUID REFERENCES profiles(id);
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS extension_denied_at TIMESTAMPTZ;
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS extension_denied_by UUID REFERENCES profiles(id);
ALTER TABLE backlot_trial_requests ADD COLUMN IF NOT EXISTS extension_ends_at TIMESTAMPTZ;

-- ============================================================================
-- 4. Update status CHECK constraint to include new statuses
-- ============================================================================
ALTER TABLE backlot_trial_requests DROP CONSTRAINT IF EXISTS backlot_trial_requests_status_check;
ALTER TABLE backlot_trial_requests ADD CONSTRAINT backlot_trial_requests_status_check
    CHECK (status IN ('pending', 'provisioning', 'approved', 'active', 'extension_requested', 'extended', 'expired', 'converted', 'rejected'));

-- ============================================================================
-- 5. Extend organizations table for trial tracking
-- ============================================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_source TEXT;

-- Update backlot_billing_status CHECK to include 'expired'
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_backlot_billing_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_backlot_billing_status_check
    CHECK (backlot_billing_status IN ('none', 'free', 'trial', 'active', 'past_due', 'canceled', 'expired'));

-- ============================================================================
-- 6. Insert trial tier into organization_tiers (if table exists)
-- ============================================================================
INSERT INTO organization_tiers (
    name, display_name, description, price_cents,
    owner_seats, collaborative_seats, freelancer_seats_per_project, view_only_seats_per_project,
    active_projects_limit, active_storage_bytes, archive_storage_bytes, monthly_bandwidth_bytes,
    is_active, sort_order
) SELECT
    'Trial', 'Free Trial', '14-day free trial with limited features', 0,
    1, 2, 0, 0,
    1, 5368709120, 0, 53687091200,  -- 5GB active storage, 0 archive, 50GB bandwidth
    true, 0
WHERE NOT EXISTS (SELECT 1 FROM organization_tiers WHERE name = 'Trial');

-- ============================================================================
-- 7. Indexes for background job queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_backlot_trial_requests_trial_ends_at
    ON backlot_trial_requests(trial_ends_at)
    WHERE status IN ('active', 'extended');

CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
    ON organizations(trial_ends_at)
    WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backlot_trial_requests_provisioned_profile
    ON backlot_trial_requests(provisioned_profile_id)
    WHERE provisioned_profile_id IS NOT NULL;
