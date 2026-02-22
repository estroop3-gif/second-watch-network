-- Migration 257: Pricing Model v2 — Competitive Self-Service Pricing
-- 5-tier model: Free / Indie / Pro / Business / Enterprise
-- Premium module add-on system
-- Storage units changed from TB to GB for finer granularity at lower tiers

-- =============================================================================
-- 1. Update organization_tiers with new 5-tier structure
-- =============================================================================

-- Update existing tiers and insert new ones
INSERT INTO organization_tiers (name, display_name, price_cents,
    owner_seats, collaborative_seats, active_projects_limit,
    freelancer_seats_per_project, view_only_seats_per_project,
    active_storage_bytes, archive_storage_bytes, monthly_bandwidth_bytes,
    is_paid)
VALUES
    -- Free: $0/mo, 1 owner, 0 collab, 1 project, 5GB active, 0 archive, 10GB bw
    ('free', 'Free', 0,
     1, 0, 1,
     0, 2,
     5368709120, 0, 10737418240,
     FALSE),
    -- Indie: $29/mo, 1 owner + 3 collab, 3 projects, 100GB active, 50GB archive, 200GB bw
    ('indie', 'Indie', 2900,
     1, 3, 3,
     3, 5,
     107374182400, 53687091200, 214748364800,
     TRUE),
    -- Pro: $79/mo, 1 owner + 10 collab, 10 projects, 500GB active, 500GB archive, 1TB bw
    ('pro', 'Pro', 7900,
     1, 10, 10,
     5, 10,
     536870912000, 536870912000, 1099511627776,
     TRUE),
    -- Business: $199/mo, 2 owner + 25 collab, 25 projects, 2TB active, 5TB archive, 5TB bw
    ('business', 'Business', 19900,
     2, 25, 25,
     10, 25,
     2199023255552, 5497558138880, 5368709120000,
     TRUE),
    -- Enterprise: $499/mo, 5 owner + unlimited collab (-1), unlimited projects (-1), 10TB active, 25TB archive, 25TB bw
    ('enterprise', 'Enterprise', 49900,
     5, -1, -1,
     20, -1,
     10995116277760, 27487790694400, 26843545600000,
     TRUE)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_cents = EXCLUDED.price_cents,
    owner_seats = EXCLUDED.owner_seats,
    collaborative_seats = EXCLUDED.collaborative_seats,
    active_projects_limit = EXCLUDED.active_projects_limit,
    freelancer_seats_per_project = EXCLUDED.freelancer_seats_per_project,
    view_only_seats_per_project = EXCLUDED.view_only_seats_per_project,
    active_storage_bytes = EXCLUDED.active_storage_bytes,
    archive_storage_bytes = EXCLUDED.archive_storage_bytes,
    monthly_bandwidth_bytes = EXCLUDED.monthly_bandwidth_bytes,
    is_paid = EXCLUDED.is_paid;

-- =============================================================================
-- 1b. Reassign orgs on old tiers BEFORE deleting those tiers
-- =============================================================================

-- Organizations on trial → free billing status
UPDATE organizations
SET backlot_billing_status = 'free'
WHERE backlot_billing_status = 'trial';

-- Reassign orgs on Trial (capital T) or trial tier to free tier
UPDATE organizations o
SET tier_id = (SELECT id FROM organization_tiers WHERE name = 'free' LIMIT 1)
WHERE EXISTS (
    SELECT 1 FROM organization_tiers t
    WHERE o.tier_id = t.id AND t.name IN ('trial', 'Trial')
);

-- Reassign orgs on starter → indie
UPDATE organizations o
SET tier_id = (SELECT id FROM organization_tiers WHERE name = 'indie' LIMIT 1)
WHERE EXISTS (
    SELECT 1 FROM organization_tiers t
    WHERE o.tier_id = t.id AND t.name = 'starter'
);

-- Reassign orgs on team → pro
UPDATE organizations o
SET tier_id = (SELECT id FROM organization_tiers WHERE name = 'pro' LIMIT 1)
WHERE EXISTS (
    SELECT 1 FROM organization_tiers t
    WHERE o.tier_id = t.id AND t.name = 'team'
);

-- Reassign orgs on studio → business
UPDATE organizations o
SET tier_id = (SELECT id FROM organization_tiers WHERE name = 'business' LIMIT 1)
WHERE EXISTS (
    SELECT 1 FROM organization_tiers t
    WHERE o.tier_id = t.id AND t.name = 'studio'
);

-- Now safe to remove old tiers
DELETE FROM organization_tiers WHERE name IN ('starter', 'studio', 'team', 'Trial');


-- =============================================================================
-- 2. backlot_subscription_modules — tracks active module add-ons per org
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_subscription_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_config_id UUID REFERENCES backlot_subscription_configs(id) ON DELETE SET NULL,

    module_key VARCHAR(50) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    monthly_price_cents INTEGER NOT NULL,
    is_bundle BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'canceled', 'pending')),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate active modules per org
    CONSTRAINT uq_org_module_active UNIQUE (organization_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_sub_modules_org
    ON backlot_subscription_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_modules_config
    ON backlot_subscription_modules(subscription_config_id);
CREATE INDEX IF NOT EXISTS idx_sub_modules_status
    ON backlot_subscription_modules(status);


-- =============================================================================
-- 3. Add module_config JSONB to subscription_configs
-- =============================================================================

ALTER TABLE backlot_subscription_configs
    ADD COLUMN IF NOT EXISTS module_config JSONB DEFAULT '{}';

-- Add active_storage_gb and archive_storage_gb columns for GB-granularity
ALTER TABLE backlot_subscription_configs
    ADD COLUMN IF NOT EXISTS active_storage_gb INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS archive_storage_gb INTEGER NOT NULL DEFAULT 0;


-- =============================================================================
-- 4. (Trial→free conversion already done in section 1b above)
-- =============================================================================


-- =============================================================================
-- 5. Update subscription config status to allow 'free' status
-- =============================================================================

ALTER TABLE backlot_subscription_configs
    DROP CONSTRAINT IF EXISTS backlot_subscription_configs_status_check;

ALTER TABLE backlot_subscription_configs
    ADD CONSTRAINT backlot_subscription_configs_status_check
    CHECK (status IN ('pending_checkout', 'active', 'past_due', 'canceled', 'free'));


-- =============================================================================
-- 6. Add billing_status 'free' to organizations
-- =============================================================================

-- Ensure organizations.backlot_billing_status can hold 'free'
-- (VARCHAR column, no constraint to update — just document the new value)

COMMENT ON TABLE backlot_subscription_modules IS
    'Tracks active premium module add-ons per organization. Modules: budgeting, expenses, po_invoicing, timecards, dailies, continuity, doc_signing, custom_branding.';
