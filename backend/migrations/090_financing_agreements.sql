-- Migration 090: Financing Agreements, Recoupment, and Multi-party Splits
-- Phase 6B: Support sophisticated financing structures while keeping clear creator-friendly visibility
-- Created: 2025-01-04

-- =============================================================================
-- PART 1: FINANCING AGREEMENT CORE
-- =============================================================================

-- Agreement status
DO $$ BEGIN
    CREATE TYPE financing_agreement_status AS ENUM (
        'draft',            -- Being configured
        'pending_approval', -- Awaiting party signatures
        'active',           -- In effect
        'recouped',         -- All recoupment complete
        'closed',           -- Manually closed
        'cancelled'         -- Cancelled before activation
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Party types in financing
DO $$ BEGIN
    CREATE TYPE financing_party_type AS ENUM (
        'creator',          -- Individual creator
        'organization',     -- Production company / studio
        'investor',         -- External investor
        'order_fund',       -- Order fund (micro-fund, etc.)
        'lodge',            -- Lodge contribution
        'platform',         -- Platform contribution
        'distributor'       -- Distribution partner
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Share calculation type
DO $$ BEGIN
    CREATE TYPE share_type AS ENUM (
        'percentage',       -- Fixed percentage of revenue
        'fixed_recoup',     -- Fixed amount until recouped
        'percentage_after_recoup',  -- Percentage after others recoup
        'bonus_pool',       -- Percentage of bonus pool (after all recoup)
        'first_dollar',     -- Percentage from first dollar (no recoup priority)
        'last_money_out'    -- Last to receive (after all other parties)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Financing agreements
CREATE TABLE IF NOT EXISTS financing_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What this agreement covers
    world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
    backlot_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,

    -- Agreement details
    name TEXT NOT NULL,
    description TEXT,
    agreement_type TEXT NOT NULL DEFAULT 'production_financing',
    -- Types: 'production_financing', 'distribution_advance', 'equity_split', 'grant', 'loan'

    -- Status
    status financing_agreement_status DEFAULT 'draft',

    -- Financial summary (cached)
    total_budget_cents BIGINT DEFAULT 0,
    total_contributed_cents BIGINT DEFAULT 0,
    total_revenue_cents BIGINT DEFAULT 0,
    total_distributed_cents BIGINT DEFAULT 0,
    recoupment_complete BOOLEAN DEFAULT false,

    -- Configuration
    revenue_sources JSONB DEFAULT '["subscription_watch_share", "direct_sales", "distribution"]'::jsonb,
    distribution_frequency TEXT DEFAULT 'monthly', -- monthly, quarterly, upon_recoup
    minimum_distribution_cents BIGINT DEFAULT 10000, -- $100 minimum

    -- Dates
    effective_date DATE,
    end_date DATE,

    -- Documents
    contract_document_url TEXT,
    supporting_documents JSONB DEFAULT '[]'::jsonb,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_financing_agreements_world ON financing_agreements(world_id) WHERE world_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financing_agreements_project ON financing_agreements(backlot_project_id) WHERE backlot_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financing_agreements_status ON financing_agreements(status);

-- Financing parties (who participates in the agreement)
CREATE TABLE IF NOT EXISTS financing_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES financing_agreements(id) ON DELETE CASCADE,

    -- Party identification
    party_type financing_party_type NOT NULL,
    party_id UUID NOT NULL, -- Links to profiles, organizations, order_funds, order_lodges
    party_name TEXT, -- Cached for display

    -- Role in the agreement
    role TEXT NOT NULL DEFAULT 'contributor',
    -- Roles: 'lead_producer', 'producer', 'investor', 'contributor', 'talent', 'distributor'

    -- Contribution
    contribution_cents BIGINT DEFAULT 0,
    contribution_type TEXT, -- 'cash', 'services', 'equipment', 'ip', 'distribution_advance'
    contribution_description TEXT,

    -- Signature/acceptance
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES profiles(id),

    -- Payout information (for non-creator/org parties)
    payout_method TEXT, -- 'platform', 'wire', 'check', 'order_fund'
    payout_details JSONB DEFAULT '{}'::jsonb,

    -- Running totals (cached)
    total_received_cents BIGINT DEFAULT 0,
    total_pending_cents BIGINT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agreement_id, party_type, party_id)
);

CREATE INDEX IF NOT EXISTS idx_financing_parties_agreement ON financing_parties(agreement_id);
CREATE INDEX IF NOT EXISTS idx_financing_parties_party ON financing_parties(party_type, party_id);

-- Financing terms (the waterfall)
CREATE TABLE IF NOT EXISTS financing_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES financing_agreements(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES financing_parties(id) ON DELETE CASCADE,

    -- Position in the waterfall (lower = paid first)
    recoupment_order INTEGER NOT NULL,

    -- How this party gets paid
    share_type share_type NOT NULL,

    -- Share value (interpretation depends on share_type)
    share_value NUMERIC(10,4) NOT NULL,
    -- For percentage: 0-100 (e.g., 10.00 = 10%)
    -- For fixed_recoup: amount in cents
    -- For percentage_after_recoup: percentage after reaching recoup

    -- Cap (optional)
    cap_cents BIGINT, -- Maximum this party can receive
    cap_multiplier NUMERIC(5,2), -- Max as multiplier of contribution (e.g., 1.5x)

    -- Recoupment tracking
    recoup_target_cents BIGINT, -- Amount to recoup before moving to next
    recouped_cents BIGINT DEFAULT 0,
    recoupment_complete BOOLEAN DEFAULT false,

    -- Description
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agreement_id, recoupment_order, party_id)
);

CREATE INDEX IF NOT EXISTS idx_financing_terms_agreement ON financing_terms(agreement_id, recoupment_order);
CREATE INDEX IF NOT EXISTS idx_financing_terms_party ON financing_terms(party_id);

-- =============================================================================
-- PART 2: SETTLEMENT AND DISTRIBUTION
-- =============================================================================

-- Financing settlements (how each period's earnings were distributed)
CREATE TABLE IF NOT EXISTS financing_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES financing_agreements(id) ON DELETE CASCADE,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Source of revenue
    world_earning_id UUID REFERENCES world_earnings(id) ON DELETE SET NULL,

    -- Amounts
    gross_revenue_cents BIGINT NOT NULL,
    platform_fees_cents BIGINT DEFAULT 0,
    net_distributable_cents BIGINT NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Awaiting calculation
        'calculated',   -- Amounts calculated
        'approved',     -- Approved for distribution
        'distributed',  -- Funds sent
        'failed'        -- Distribution failed
    )),

    -- Metadata
    calculation_details JSONB DEFAULT '{}'::jsonb,
    distributed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financing_settlements_agreement ON financing_settlements(agreement_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_financing_settlements_status ON financing_settlements(status);
CREATE INDEX IF NOT EXISTS idx_financing_settlements_earning ON financing_settlements(world_earning_id);

-- Settlement line items (per-party breakdown)
CREATE TABLE IF NOT EXISTS financing_settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES financing_settlements(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES financing_parties(id) ON DELETE CASCADE,
    term_id UUID REFERENCES financing_terms(id) ON DELETE SET NULL,

    -- Distribution amount
    amount_cents BIGINT NOT NULL,

    -- How it was calculated
    share_type share_type NOT NULL,
    share_value NUMERIC(10,4) NOT NULL,
    calculation_notes TEXT,

    -- Recoupment impact
    recouped_in_period_cents BIGINT DEFAULT 0,
    recoupment_remaining_cents BIGINT,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'paid', 'failed', 'held'
    )),
    paid_at TIMESTAMPTZ,
    payout_reference TEXT, -- Stripe transfer ID, etc.

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON financing_settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_party ON financing_settlement_items(party_id);

-- =============================================================================
-- PART 3: AGREEMENT TEMPLATES
-- =============================================================================

-- Pre-defined agreement templates for common structures
CREATE TABLE IF NOT EXISTS financing_agreement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    agreement_type TEXT NOT NULL,

    -- Template structure
    template_structure JSONB NOT NULL,
    -- {
    --   "parties": [{"role": "investor", "share_type": "fixed_recoup", "order": 1}],
    --   "terms": [{"share_type": "percentage", "value": 50, "order": 2}],
    --   "defaults": {"distribution_frequency": "quarterly"}
    -- }

    -- Usage
    is_active BOOLEAN DEFAULT true,
    is_recommended BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common templates
INSERT INTO financing_agreement_templates (name, slug, description, agreement_type, template_structure, is_recommended)
VALUES
    (
        'Simple Investor Recoup',
        'simple-investor-recoup',
        'Investor recoups contribution 1.5x, then creator gets 100%',
        'production_financing',
        '{
            "parties": [
                {"role": "investor", "placeholder": true},
                {"role": "creator", "placeholder": true}
            ],
            "terms": [
                {"party_role": "investor", "share_type": "fixed_recoup", "cap_multiplier": 1.5, "order": 1},
                {"party_role": "creator", "share_type": "percentage_after_recoup", "value": 100, "order": 2}
            ],
            "defaults": {"distribution_frequency": "quarterly"}
        }'::jsonb,
        true
    ),
    (
        'Order Fund Grant',
        'order-fund-grant',
        'Order fund provides grant, no recoupment, creator gets 100%',
        'grant',
        '{
            "parties": [
                {"role": "contributor", "party_type": "order_fund", "placeholder": true},
                {"role": "creator", "placeholder": true}
            ],
            "terms": [
                {"party_role": "creator", "share_type": "percentage", "value": 100, "order": 1}
            ],
            "defaults": {"distribution_frequency": "monthly"}
        }'::jsonb,
        true
    ),
    (
        '50/50 Split',
        '50-50-split',
        'Equal split between two parties from first dollar',
        'equity_split',
        '{
            "parties": [
                {"role": "producer", "placeholder": true},
                {"role": "producer", "placeholder": true}
            ],
            "terms": [
                {"party_role": "producer", "share_type": "first_dollar", "value": 50, "order": 1, "all_with_role": true}
            ],
            "defaults": {"distribution_frequency": "monthly"}
        }'::jsonb,
        false
    ),
    (
        'Distribution Advance Recoup',
        'distribution-advance',
        'Distributor recoups advance, then split with creator',
        'distribution_advance',
        '{
            "parties": [
                {"role": "distributor", "party_type": "distributor", "placeholder": true},
                {"role": "creator", "placeholder": true}
            ],
            "terms": [
                {"party_role": "distributor", "share_type": "fixed_recoup", "order": 1},
                {"party_role": "distributor", "share_type": "percentage_after_recoup", "value": 30, "order": 2},
                {"party_role": "creator", "share_type": "percentage_after_recoup", "value": 70, "order": 2}
            ],
            "defaults": {"distribution_frequency": "quarterly"}
        }'::jsonb,
        false
    )
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- PART 4: VIEWS FOR TRANSPARENCY
-- =============================================================================

-- Agreement summary view
CREATE OR REPLACE VIEW v_financing_agreement_summary AS
SELECT
    fa.id,
    fa.name,
    fa.agreement_type,
    fa.status,
    fa.world_id,
    w.title as world_title,
    fa.backlot_project_id,
    bp.title as project_title,
    fa.total_budget_cents,
    fa.total_contributed_cents,
    fa.total_revenue_cents,
    fa.total_distributed_cents,
    fa.recoupment_complete,
    (
        SELECT COUNT(*) FROM financing_parties fp WHERE fp.agreement_id = fa.id
    ) as party_count,
    (
        SELECT COALESCE(SUM(ft.recouped_cents), 0) FROM financing_terms ft
        WHERE ft.agreement_id = fa.id
    ) as total_recouped_cents,
    fa.created_at,
    fa.effective_date
FROM financing_agreements fa
LEFT JOIN worlds w ON fa.world_id = w.id
LEFT JOIN backlot_projects bp ON fa.backlot_project_id = bp.id;

-- Party position view (waterfall position)
CREATE OR REPLACE VIEW v_financing_waterfall AS
SELECT
    ft.agreement_id,
    ft.recoupment_order,
    fp.party_type,
    fp.party_name,
    fp.role,
    ft.share_type,
    ft.share_value,
    ft.recoup_target_cents,
    ft.recouped_cents,
    ft.recoupment_complete,
    ft.cap_cents,
    fp.total_received_cents,
    fp.contribution_cents
FROM financing_terms ft
JOIN financing_parties fp ON ft.party_id = fp.id
ORDER BY ft.agreement_id, ft.recoupment_order;

-- =============================================================================
-- PART 5: HELPER FUNCTIONS
-- =============================================================================

-- Calculate distribution for an agreement
CREATE OR REPLACE FUNCTION calculate_financing_distribution(
    p_agreement_id UUID,
    p_revenue_cents BIGINT,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS TABLE (
    party_id UUID,
    amount_cents BIGINT,
    share_type share_type,
    recouped_cents BIGINT
) AS $$
DECLARE
    v_remaining BIGINT := p_revenue_cents;
    v_term RECORD;
    v_party_amount BIGINT;
    v_recoup_amount BIGINT;
BEGIN
    -- Process waterfall in order
    FOR v_term IN
        SELECT ft.*, fp.contribution_cents
        FROM financing_terms ft
        JOIN financing_parties fp ON ft.party_id = fp.id
        WHERE ft.agreement_id = p_agreement_id
          AND NOT ft.recoupment_complete
        ORDER BY ft.recoupment_order
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_party_amount := 0;
        v_recoup_amount := 0;

        CASE v_term.share_type
            -- Fixed recoupment until target is met
            WHEN 'fixed_recoup' THEN
                v_recoup_amount := LEAST(
                    v_remaining,
                    COALESCE(v_term.recoup_target_cents, v_term.contribution_cents) - v_term.recouped_cents
                );
                v_party_amount := v_recoup_amount;

            -- Percentage from first dollar
            WHEN 'first_dollar' THEN
                v_party_amount := (p_revenue_cents * v_term.share_value / 100)::BIGINT;
                v_party_amount := LEAST(v_party_amount, v_remaining);

            -- Simple percentage
            WHEN 'percentage' THEN
                v_party_amount := (v_remaining * v_term.share_value / 100)::BIGINT;

            -- Percentage after recoupment (only if no prior recoupment pending)
            WHEN 'percentage_after_recoup' THEN
                -- Check if any prior positions still need recouping
                IF NOT EXISTS (
                    SELECT 1 FROM financing_terms
                    WHERE agreement_id = p_agreement_id
                      AND recoupment_order < v_term.recoupment_order
                      AND NOT recoupment_complete
                      AND share_type IN ('fixed_recoup')
                ) THEN
                    v_party_amount := (v_remaining * v_term.share_value / 100)::BIGINT;
                END IF;

            -- Last money out
            WHEN 'last_money_out' THEN
                -- Only gets money if all others are satisfied
                IF NOT EXISTS (
                    SELECT 1 FROM financing_terms
                    WHERE agreement_id = p_agreement_id
                      AND id != v_term.id
                      AND NOT recoupment_complete
                ) THEN
                    v_party_amount := v_remaining;
                END IF;

            ELSE
                v_party_amount := 0;
        END CASE;

        -- Apply cap if set
        IF v_term.cap_cents IS NOT NULL THEN
            DECLARE
                v_already_received BIGINT;
            BEGIN
                SELECT total_received_cents INTO v_already_received
                FROM financing_parties WHERE id = v_term.party_id;
                v_party_amount := LEAST(v_party_amount, v_term.cap_cents - COALESCE(v_already_received, 0));
                IF v_party_amount < 0 THEN v_party_amount := 0; END IF;
            END;
        END IF;

        IF v_term.cap_multiplier IS NOT NULL THEN
            DECLARE
                v_already_received BIGINT;
                v_max_from_mult BIGINT;
            BEGIN
                SELECT total_received_cents INTO v_already_received
                FROM financing_parties WHERE id = v_term.party_id;
                v_max_from_mult := (v_term.contribution_cents * v_term.cap_multiplier)::BIGINT;
                v_party_amount := LEAST(v_party_amount, v_max_from_mult - COALESCE(v_already_received, 0));
                IF v_party_amount < 0 THEN v_party_amount := 0; END IF;
            END;
        END IF;

        IF v_party_amount > 0 THEN
            RETURN QUERY SELECT v_term.party_id, v_party_amount, v_term.share_type, v_recoup_amount;
            v_remaining := v_remaining - v_party_amount;
        END IF;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Update recoupment status after distribution
CREATE OR REPLACE FUNCTION update_financing_recoupment(
    p_agreement_id UUID,
    p_settlement_id UUID
)
RETURNS void AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Update each party's recoupment based on settlement items
    FOR v_item IN
        SELECT si.party_id, si.term_id, si.amount_cents, si.recouped_in_period_cents
        FROM financing_settlement_items si
        WHERE si.settlement_id = p_settlement_id
    LOOP
        -- Update term recoupment
        IF v_item.term_id IS NOT NULL AND v_item.recouped_in_period_cents > 0 THEN
            UPDATE financing_terms SET
                recouped_cents = recouped_cents + v_item.recouped_in_period_cents,
                recoupment_complete = (recouped_cents + v_item.recouped_in_period_cents >= COALESCE(recoup_target_cents, 0)),
                updated_at = NOW()
            WHERE id = v_item.term_id;
        END IF;

        -- Update party totals
        UPDATE financing_parties SET
            total_received_cents = total_received_cents + v_item.amount_cents,
            updated_at = NOW()
        WHERE id = v_item.party_id;
    END LOOP;

    -- Update agreement totals
    UPDATE financing_agreements SET
        total_distributed_cents = total_distributed_cents + (
            SELECT COALESCE(SUM(amount_cents), 0) FROM financing_settlement_items WHERE settlement_id = p_settlement_id
        ),
        recoupment_complete = NOT EXISTS (
            SELECT 1 FROM financing_terms
            WHERE agreement_id = p_agreement_id
              AND share_type IN ('fixed_recoup')
              AND NOT recoupment_complete
        ),
        updated_at = NOW()
    WHERE id = p_agreement_id;
END;
$$ LANGUAGE plpgsql;

-- Get plain-English summary of financing agreement
CREATE OR REPLACE FUNCTION get_financing_summary(p_agreement_id UUID)
RETURNS TABLE (
    summary_line TEXT,
    party_name TEXT,
    position INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE ft.share_type
            WHEN 'fixed_recoup' THEN
                fp.party_name || ' recoups ' ||
                COALESCE('$' || (ft.recoup_target_cents / 100.0)::TEXT, 'contribution') ||
                CASE WHEN ft.cap_multiplier IS NOT NULL THEN ' (up to ' || ft.cap_multiplier || 'x)' ELSE '' END
            WHEN 'percentage' THEN
                fp.party_name || ' receives ' || ft.share_value || '% of remaining revenue'
            WHEN 'first_dollar' THEN
                fp.party_name || ' receives ' || ft.share_value || '% from first dollar'
            WHEN 'percentage_after_recoup' THEN
                fp.party_name || ' receives ' || ft.share_value || '% after recoupment'
            WHEN 'last_money_out' THEN
                fp.party_name || ' receives remainder after all other parties'
            ELSE
                fp.party_name || ' participates'
        END as summary_line,
        fp.party_name,
        ft.recoupment_order,
        ft.description
    FROM financing_terms ft
    JOIN financing_parties fp ON ft.party_id = fp.id
    WHERE ft.agreement_id = p_agreement_id
    ORDER BY ft.recoupment_order;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON v_financing_agreement_summary TO authenticated;
GRANT SELECT ON v_financing_waterfall TO authenticated;
