-- Migration: 076_watch_tracking_monetization.sql
-- Description: Watch Tracking & Creator Monetization System
-- Phase 1A: Watch aggregation tables
-- Phase 1B: Organizations, revenue tracking, payouts
-- Phase 1C: Supporting indexes and views

-- =============================================================================
-- PHASE 1A: WATCH TRACKING AGGREGATION
-- =============================================================================

-- World-level watch aggregates for revenue calculation
-- Stores pre-computed watch time per world per period
CREATE TABLE IF NOT EXISTS world_watch_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Period classification
    period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Watch metrics
    total_watch_seconds BIGINT DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    completed_episodes INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one record per world per period
    UNIQUE(world_id, period_type, period_start)
);

-- Platform-wide totals for share calculation
-- Used as denominator when calculating world's share of creator pool
CREATE TABLE IF NOT EXISTS platform_watch_totals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Period classification
    period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Aggregate metrics
    total_watch_seconds BIGINT DEFAULT 0,
    active_worlds_count INTEGER DEFAULT 0,
    total_unique_viewers INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_type, period_start)
);

-- Indexes for watch aggregates
CREATE INDEX IF NOT EXISTS idx_world_watch_aggregates_world_period
    ON world_watch_aggregates(world_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_world_watch_aggregates_period_lookup
    ON world_watch_aggregates(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_platform_watch_totals_lookup
    ON platform_watch_totals(period_type, period_start);

-- =============================================================================
-- PHASE 1B: ORGANIZATIONS
-- =============================================================================

-- Organizations (studios/production companies) that can own Worlds
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Awaiting verification
        'verified',     -- Identity verified
        'active',       -- Fully operational
        'suspended',    -- Temporarily disabled
        'inactive'      -- Deactivated
    )),

    -- Payment info (Stripe Connect)
    stripe_connect_account_id TEXT,
    stripe_connect_onboarded BOOLEAN DEFAULT FALSE,
    payout_email TEXT,

    -- Tax info (for 1099s)
    tax_id_type TEXT,  -- 'ein' or 'ssn'
    tax_id_last_four TEXT,

    -- Metadata
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization membership
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Role within organization
    role TEXT DEFAULT 'member' CHECK (role IN (
        'owner',        -- Full control, can delete org
        'admin',        -- Manage members, settings
        'finance',      -- View/manage payouts
        'creator',      -- Create/manage content
        'member'        -- View only
    )),

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, user_id)
);

-- Add organization_id to worlds table
-- Worlds can be owned by individual (creator_id) OR organization (organization_id)
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Indexes for organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_worlds_organization ON worlds(organization_id) WHERE organization_id IS NOT NULL;

-- =============================================================================
-- PHASE 1B: REVENUE TRACKING
-- =============================================================================

-- Subscription revenue tracking (aggregated from Stripe)
-- Monthly totals for calculating creator pool
CREATE TABLE IF NOT EXISTS subscription_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Period
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Revenue breakdown (in cents)
    gross_revenue_cents BIGINT DEFAULT 0,
    refunds_cents BIGINT DEFAULT 0,
    chargebacks_cents BIGINT DEFAULT 0,
    stripe_fees_cents BIGINT DEFAULT 0,

    -- Computed values
    net_revenue_cents BIGINT GENERATED ALWAYS AS (
        gross_revenue_cents - refunds_cents - chargebacks_cents - stripe_fees_cents
    ) STORED,

    -- Creator pool (10% of net)
    creator_pool_percentage DECIMAL(5,4) DEFAULT 0.1000,
    creator_pool_cents BIGINT GENERATED ALWAYS AS (
        ROUND((gross_revenue_cents - refunds_cents - chargebacks_cents - stripe_fees_cents) * 0.10)
    ) STORED,

    -- Subscriber counts
    total_subscribers INTEGER DEFAULT 0,
    new_subscribers INTEGER DEFAULT 0,
    churned_subscribers INTEGER DEFAULT 0,

    -- Metadata
    stripe_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_type, period_start)
);

-- Per-world earnings for each period
-- Calculated from watch share * creator pool
CREATE TABLE IF NOT EXISTS world_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Period
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Watch metrics used for calculation
    world_watch_seconds BIGINT NOT NULL,
    platform_watch_seconds BIGINT NOT NULL,

    -- Share calculation
    watch_share_percentage DECIMAL(10,8) GENERATED ALWAYS AS (
        CASE WHEN platform_watch_seconds > 0
             THEN (world_watch_seconds::DECIMAL / platform_watch_seconds) * 100
             ELSE 0
        END
    ) STORED,

    -- Earnings
    creator_pool_cents BIGINT NOT NULL,  -- Total pool for this period
    gross_earnings_cents BIGINT GENERATED ALWAYS AS (
        CASE WHEN platform_watch_seconds > 0
             THEN ROUND((world_watch_seconds::DECIMAL / platform_watch_seconds) * creator_pool_cents)
             ELSE 0
        END
    ) STORED,

    -- Payout routing
    payout_to_type TEXT NOT NULL CHECK (payout_to_type IN ('creator', 'organization')),
    payout_to_id UUID NOT NULL,  -- profiles.id or organizations.id

    -- Status
    status TEXT DEFAULT 'calculated' CHECK (status IN (
        'calculated',   -- Computed, awaiting payout generation
        'pending',      -- Assigned to a pending payout
        'paid',         -- Payout completed
        'held'          -- Below threshold, held for next period
    )),

    -- Link to payout
    payout_id UUID,  -- Set when assigned to a payout

    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, period_type, period_start)
);

-- Creator/Organization payouts
-- Aggregates earnings from multiple worlds into single payment
CREATE TABLE IF NOT EXISTS creator_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recipient
    payout_to_type TEXT NOT NULL CHECK (payout_to_type IN ('creator', 'organization')),
    payout_to_id UUID NOT NULL,

    -- Period covered
    period_type TEXT NOT NULL CHECK (period_type IN ('monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Amount
    gross_amount_cents BIGINT NOT NULL,
    fees_cents BIGINT DEFAULT 0,        -- Transfer fees if any
    net_amount_cents BIGINT GENERATED ALWAYS AS (
        gross_amount_cents - fees_cents
    ) STORED,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'held',         -- Below $25 threshold
        'pending',      -- Awaiting approval
        'approved',     -- Ready to process
        'processing',   -- Transfer in progress
        'completed',    -- Payment sent
        'failed'        -- Transfer failed
    )),

    -- Stripe Connect transfer
    stripe_transfer_id TEXT,
    stripe_transfer_status TEXT,

    -- Approval tracking
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,

    -- Processing tracking
    processed_at TIMESTAMPTZ,
    failed_reason TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout line items (which worlds contributed to this payout)
CREATE TABLE IF NOT EXISTS payout_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES creator_payouts(id) ON DELETE CASCADE,
    world_earning_id UUID NOT NULL REFERENCES world_earnings(id) ON DELETE CASCADE,

    -- Denormalized for reporting
    world_id UUID NOT NULL REFERENCES worlds(id),
    world_title TEXT NOT NULL,

    -- Amount from this world
    amount_cents BIGINT NOT NULL,
    watch_share_percentage DECIMAL(10,8),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(payout_id, world_earning_id)
);

-- Add foreign key from world_earnings to creator_payouts
ALTER TABLE world_earnings
    ADD CONSTRAINT fk_world_earnings_payout
    FOREIGN KEY (payout_id) REFERENCES creator_payouts(id) ON DELETE SET NULL;

-- Indexes for revenue/payouts
CREATE INDEX IF NOT EXISTS idx_subscription_revenue_period ON subscription_revenue(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_world_earnings_world ON world_earnings(world_id);
CREATE INDEX IF NOT EXISTS idx_world_earnings_period ON world_earnings(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_world_earnings_payout_recipient ON world_earnings(payout_to_type, payout_to_id);
CREATE INDEX IF NOT EXISTS idx_world_earnings_status ON world_earnings(status);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_recipient ON creator_payouts(payout_to_type, payout_to_id);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_status ON creator_payouts(status);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_period ON creator_payouts(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payout_line_items_payout ON payout_line_items(payout_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update updated_at triggers
CREATE OR REPLACE FUNCTION update_monetization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS world_watch_aggregates_updated_at ON world_watch_aggregates;
CREATE TRIGGER world_watch_aggregates_updated_at
    BEFORE UPDATE ON world_watch_aggregates
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

DROP TRIGGER IF EXISTS platform_watch_totals_updated_at ON platform_watch_totals;
CREATE TRIGGER platform_watch_totals_updated_at
    BEFORE UPDATE ON platform_watch_totals
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

DROP TRIGGER IF EXISTS organization_members_updated_at ON organization_members;
CREATE TRIGGER organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

DROP TRIGGER IF EXISTS subscription_revenue_updated_at ON subscription_revenue;
CREATE TRIGGER subscription_revenue_updated_at
    BEFORE UPDATE ON subscription_revenue
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

DROP TRIGGER IF EXISTS world_earnings_updated_at ON world_earnings;
CREATE TRIGGER world_earnings_updated_at
    BEFORE UPDATE ON world_earnings
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

DROP TRIGGER IF EXISTS creator_payouts_updated_at ON creator_payouts;
CREATE TRIGGER creator_payouts_updated_at
    BEFORE UPDATE ON creator_payouts
    FOR EACH ROW EXECUTE FUNCTION update_monetization_updated_at();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Creator earnings summary view
CREATE OR REPLACE VIEW v_creator_earnings_summary AS
SELECT
    we.payout_to_type,
    we.payout_to_id,
    CASE
        WHEN we.payout_to_type = 'creator' THEN p.display_name
        WHEN we.payout_to_type = 'organization' THEN o.name
    END as recipient_name,
    we.period_start,
    COUNT(DISTINCT we.world_id) as worlds_count,
    SUM(we.world_watch_seconds) as total_watch_seconds,
    SUM(we.gross_earnings_cents) as total_earnings_cents,
    we.status
FROM world_earnings we
LEFT JOIN profiles p ON we.payout_to_type = 'creator' AND we.payout_to_id = p.id
LEFT JOIN organizations o ON we.payout_to_type = 'organization' AND we.payout_to_id = o.id
GROUP BY
    we.payout_to_type,
    we.payout_to_id,
    p.display_name,
    o.name,
    we.period_start,
    we.status;

-- World performance view (for creator dashboards)
CREATE OR REPLACE VIEW v_world_performance AS
SELECT
    w.id as world_id,
    w.title as world_title,
    w.creator_id,
    w.organization_id,
    COALESCE(w.organization_id::TEXT, w.creator_id::TEXT) as owner_id,
    CASE WHEN w.organization_id IS NOT NULL THEN 'organization' ELSE 'creator' END as owner_type,

    -- 30-day metrics
    COALESCE(recent.watch_seconds_30d, 0) as watch_seconds_30d,
    COALESCE(recent.unique_viewers_30d, 0) as unique_viewers_30d,

    -- Lifetime metrics
    COALESCE(lifetime.watch_seconds_total, 0) as watch_seconds_total,
    COALESCE(lifetime.unique_viewers_total, 0) as unique_viewers_total,

    -- Earnings
    COALESCE(earnings.ytd_earnings_cents, 0) as ytd_earnings_cents,
    COALESCE(earnings.lifetime_earnings_cents, 0) as lifetime_earnings_cents
FROM worlds w
LEFT JOIN LATERAL (
    SELECT
        SUM(total_watch_seconds) as watch_seconds_30d,
        SUM(unique_viewers) as unique_viewers_30d
    FROM world_watch_aggregates
    WHERE world_id = w.id
      AND period_type = 'daily'
      AND period_start >= NOW() - INTERVAL '30 days'
) recent ON true
LEFT JOIN LATERAL (
    SELECT
        SUM(total_watch_seconds) as watch_seconds_total,
        MAX(unique_viewers) as unique_viewers_total
    FROM world_watch_aggregates
    WHERE world_id = w.id
      AND period_type = 'monthly'
) lifetime ON true
LEFT JOIN LATERAL (
    SELECT
        SUM(CASE WHEN period_start >= DATE_TRUNC('year', NOW()) THEN gross_earnings_cents ELSE 0 END) as ytd_earnings_cents,
        SUM(gross_earnings_cents) as lifetime_earnings_cents
    FROM world_earnings
    WHERE world_id = w.id
) earnings ON true
WHERE w.status = 'published';

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get or create hourly aggregate
CREATE OR REPLACE FUNCTION get_or_create_hourly_aggregate(
    p_world_id UUID,
    p_hour_start TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Try to get existing
    SELECT id INTO v_id
    FROM world_watch_aggregates
    WHERE world_id = p_world_id
      AND period_type = 'hourly'
      AND period_start = p_hour_start;

    IF v_id IS NULL THEN
        -- Create new
        INSERT INTO world_watch_aggregates (
            world_id, period_type, period_start, period_end
        ) VALUES (
            p_world_id,
            'hourly',
            p_hour_start,
            p_hour_start + INTERVAL '1 hour'
        )
        ON CONFLICT (world_id, period_type, period_start) DO NOTHING
        RETURNING id INTO v_id;

        -- If conflict, get the existing one
        IF v_id IS NULL THEN
            SELECT id INTO v_id
            FROM world_watch_aggregates
            WHERE world_id = p_world_id
              AND period_type = 'hourly'
              AND period_start = p_hour_start;
        END IF;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to determine payout recipient for a world
CREATE OR REPLACE FUNCTION get_world_payout_recipient(p_world_id UUID)
RETURNS TABLE(payout_to_type TEXT, payout_to_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN w.organization_id IS NOT NULL THEN 'organization'::TEXT
            ELSE 'creator'::TEXT
        END,
        COALESCE(w.organization_id, w.creator_id)
    FROM worlds w
    WHERE w.id = p_world_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE world_watch_aggregates IS 'Pre-computed watch time per World per time period for revenue calculation';
COMMENT ON TABLE platform_watch_totals IS 'Platform-wide watch totals - denominator for share calculation';
COMMENT ON TABLE organizations IS 'Studios/production companies that can own Worlds and receive payouts';
COMMENT ON TABLE organization_members IS 'User membership in organizations with role-based access';
COMMENT ON TABLE subscription_revenue IS 'Aggregated subscription revenue from Stripe for creator pool calculation';
COMMENT ON TABLE world_earnings IS 'Per-world earnings based on watch share of creator pool';
COMMENT ON TABLE creator_payouts IS 'Aggregated payout records for creators/organizations';
COMMENT ON TABLE payout_line_items IS 'Line items showing which worlds contributed to a payout';

COMMENT ON COLUMN subscription_revenue.creator_pool_cents IS '10% of net revenue allocated to creator pool';
COMMENT ON COLUMN world_earnings.watch_share_percentage IS 'World watch time as percentage of platform total';
COMMENT ON COLUMN world_earnings.gross_earnings_cents IS 'Earnings = (world_watch / platform_watch) * creator_pool';
COMMENT ON COLUMN creator_payouts.status IS 'held = below $25, pending = ready for approval, completed = paid';
