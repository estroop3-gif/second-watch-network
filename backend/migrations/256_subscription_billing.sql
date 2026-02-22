-- Migration 256: Subscription Billing Schema
-- Self-service subscription checkout, plan configs, billing events, and paid tiers

-- =============================================================================
-- 1a. backlot_subscription_configs — links org to Stripe subscription + plan config
-- =============================================================================
CREATE TABLE IF NOT EXISTS backlot_subscription_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Plan type
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('tier', 'a_la_carte')),
    tier_name VARCHAR(50),  -- nullable for a la carte

    -- Resource config
    owner_seats INTEGER NOT NULL DEFAULT 1,
    collaborative_seats INTEGER NOT NULL DEFAULT 2,
    active_projects INTEGER NOT NULL DEFAULT 5,
    non_collaborative_per_project INTEGER NOT NULL DEFAULT 3,
    view_only_per_project INTEGER NOT NULL DEFAULT 3,
    active_storage_tb NUMERIC(6,2) NOT NULL DEFAULT 1,
    archive_storage_tb NUMERIC(6,2) NOT NULL DEFAULT 2,
    bandwidth_gb INTEGER NOT NULL DEFAULT 500,

    -- Pricing
    monthly_total_cents INTEGER NOT NULL,
    annual_prepay BOOLEAN NOT NULL DEFAULT FALSE,
    effective_monthly_cents INTEGER NOT NULL,

    -- Stripe references
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),

    -- Status lifecycle: pending_checkout → active → past_due → canceled
    status VARCHAR(30) NOT NULL DEFAULT 'pending_checkout'
        CHECK (status IN ('pending_checkout', 'active', 'past_due', 'canceled')),
    past_due_since TIMESTAMPTZ,

    -- Metadata
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_configs_org
    ON backlot_subscription_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_configs_stripe_sub
    ON backlot_subscription_configs(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_configs_status
    ON backlot_subscription_configs(status);


-- =============================================================================
-- 1b. Extend organizations table
-- =============================================================================
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS active_subscription_config_id UUID;

-- FK to subscription_configs (deferred to avoid circular issues)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_org_active_subscription_config'
    ) THEN
        ALTER TABLE organizations
            ADD CONSTRAINT fk_org_active_subscription_config
            FOREIGN KEY (active_subscription_config_id)
            REFERENCES backlot_subscription_configs(id)
            ON DELETE SET NULL;
    END IF;
END $$;


-- =============================================================================
-- 1c. backlot_billing_events — audit log for billing state changes
-- =============================================================================
CREATE TABLE IF NOT EXISTS backlot_billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_config_id UUID REFERENCES backlot_subscription_configs(id),
    event_type VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    stripe_event_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org
    ON backlot_billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type
    ON backlot_billing_events(event_type);


-- =============================================================================
-- 1d. Ensure is_paid column exists, then upsert paid tiers
-- =============================================================================
ALTER TABLE organization_tiers
    ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

INSERT INTO organization_tiers (name, display_name, price_cents,
    owner_seats, collaborative_seats, active_projects_limit,
    freelancer_seats_per_project, view_only_seats_per_project,
    active_storage_bytes, archive_storage_bytes, monthly_bandwidth_bytes,
    is_paid)
VALUES
    ('starter', 'Starter', 100000,
     1, 2, 5,
     3, 3,
     1099511627776, 2199023255552, 536870912000,
     TRUE),
    ('studio', 'Studio', 400000,
     1, 14, 15,
     6, 10,
     3298534883328, 8796093022208, 2147483648000,
     TRUE),
    ('enterprise', 'Enterprise', 800000,
     2, 28, 30,
     10, 20,
     6597069766656, 21990232555520, 5368709120000,
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
