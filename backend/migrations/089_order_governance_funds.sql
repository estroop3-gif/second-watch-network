-- Migration 089: Order Governance, Funds, and Transparency
-- Phase 6A: Turn The Order from "membership + perks" into a transparent guild with funds and decision-making
-- Created: 2025-01-04

-- =============================================================================
-- PART 1: ORDER FUNDS
-- =============================================================================

-- Fund types enum
DO $$ BEGIN
    CREATE TYPE order_fund_type AS ENUM (
        'micro_fund',           -- Small production grants
        'gear_fund',            -- Equipment purchases/loans
        'lodge_operations',     -- Lodge operating expenses
        'emergency_support',    -- Member emergency assistance
        'education',            -- Training and workshops
        'platform_allocation',  -- Platform revenue allocation
        'general'               -- General purpose fund
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fund source types
DO $$ BEGIN
    CREATE TYPE fund_source_type AS ENUM (
        'membership_dues',      -- Portion of Order dues
        'platform_allocation',  -- % of platform share
        'donation',             -- One-off donations
        'grant',                -- External grants
        'sponsorship',          -- Corporate sponsorship
        'event_revenue',        -- Revenue from events
        'interest',             -- Investment interest
        'transfer_in',          -- Transfer from another fund
        'refund'                -- Refunded allocation
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fund allocation target types
DO $$ BEGIN
    CREATE TYPE fund_allocation_target_type AS ENUM (
        'world',                -- Production/World grant
        'project',              -- Backlot project
        'lodge',                -- Lodge operations
        'member_support',       -- Individual member support
        'event',                -- Event funding
        'equipment',            -- Equipment purchase
        'education',            -- Training/workshop
        'transfer_out',         -- Transfer to another fund
        'expense'               -- General expense
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allocation decision method
DO $$ BEGIN
    CREATE TYPE allocation_decision_method AS ENUM (
        'vote',                 -- Member vote
        'committee',            -- Committee decision
        'leader',               -- Officer decision
        'automatic',            -- Rule-based automatic
        'emergency'             -- Emergency officer action
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order funds table
CREATE TABLE IF NOT EXISTS order_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    fund_type order_fund_type NOT NULL,

    -- Scope (null = Order-wide, lodge_id = lodge-specific)
    lodge_id UUID REFERENCES order_lodges(id) ON DELETE SET NULL,

    -- Balance tracking (cached, computed from flows)
    current_balance_cents BIGINT DEFAULT 0,
    total_inflows_cents BIGINT DEFAULT 0,
    total_outflows_cents BIGINT DEFAULT 0,

    -- Configuration
    min_balance_cents BIGINT DEFAULT 0,
    max_balance_cents BIGINT, -- null = no limit
    auto_allocation_rules JSONB DEFAULT '{}'::jsonb,
    -- e.g., {"type": "percentage", "source": "dues", "percentage": 5}

    -- Governance
    requires_vote_for_allocation BOOLEAN DEFAULT false,
    min_allocation_for_vote_cents BIGINT DEFAULT 50000, -- $500
    committee_approvers JSONB DEFAULT '[]'::jsonb, -- list of profile IDs

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_order_funds_lodge ON order_funds(lodge_id) WHERE lodge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_funds_type ON order_funds(fund_type);
CREATE INDEX IF NOT EXISTS idx_order_funds_active ON order_funds(is_active) WHERE is_active = true;

-- Fund inflows and outflows (immutable ledger)
CREATE TABLE IF NOT EXISTS order_fund_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id UUID NOT NULL REFERENCES order_funds(id) ON DELETE CASCADE,

    -- Flow direction and amount
    flow_direction TEXT NOT NULL CHECK (flow_direction IN ('inflow', 'outflow')),
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),

    -- Source (for inflows)
    source_type fund_source_type,
    source_reference_type TEXT, -- 'dues_payment', 'donation', 'platform_revenue', etc.
    source_reference_id UUID,   -- ID of source record

    -- Destination (for outflows, links to allocation)
    allocation_id UUID, -- REFERENCES order_fund_allocations(id) - added after table creation

    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES profiles(id),

    -- Computed balance after this flow
    balance_after_cents BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fund_flows_fund ON order_fund_flows(fund_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_flows_source ON order_fund_flows(source_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_flows_direction ON order_fund_flows(fund_id, flow_direction, occurred_at DESC);

-- Fund allocations (approved spending)
CREATE TABLE IF NOT EXISTS order_fund_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id UUID NOT NULL REFERENCES order_funds(id) ON DELETE CASCADE,

    -- What the allocation is for
    target_type fund_allocation_target_type NOT NULL,
    target_id UUID, -- ID of world, project, lodge, member, etc.
    target_description TEXT,

    -- Amount
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),

    -- Decision tracking
    decision_method allocation_decision_method NOT NULL,
    proposal_id UUID, -- REFERENCES order_governance_proposals(id) - if decided by vote
    decided_by UUID REFERENCES profiles(id), -- if decided by leader/committee
    decision_notes TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Awaiting approval
        'approved',     -- Approved, ready to disburse
        'disbursed',    -- Funds sent
        'partially_disbursed', -- Some funds sent
        'rejected',     -- Rejected
        'cancelled',    -- Cancelled
        'refunded'      -- Refunded to fund
    )),

    -- Disbursement tracking
    disbursed_cents BIGINT DEFAULT 0,
    disbursed_at TIMESTAMPTZ,

    -- Audit
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_allocations_fund ON order_fund_allocations(fund_id, status);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_target ON order_fund_allocations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_status ON order_fund_allocations(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_proposal ON order_fund_allocations(proposal_id) WHERE proposal_id IS NOT NULL;

-- Add FK from flows to allocations
ALTER TABLE order_fund_flows
ADD CONSTRAINT fk_fund_flows_allocation
FOREIGN KEY (allocation_id) REFERENCES order_fund_allocations(id) ON DELETE SET NULL;

-- =============================================================================
-- PART 2: GOVERNANCE CYCLES AND VOTING
-- =============================================================================

-- Governance cycle types
DO $$ BEGIN
    CREATE TYPE governance_cycle_type AS ENUM (
        'fund_allocation',      -- Voting on fund allocations
        'policy_input',         -- Input on policies
        'leadership_feedback',  -- Officer feedback/elections
        'initiative',           -- Member initiatives
        'lodge_decision',       -- Lodge-specific decisions
        'budget_approval'       -- Budget cycle approval
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Proposal types
DO $$ BEGIN
    CREATE TYPE governance_proposal_type AS ENUM (
        'fund_request',         -- Request funds from a fund
        'initiative',           -- General initiative
        'policy_suggestion',    -- Policy change suggestion
        'officer_nomination',   -- Nominate officer
        'budget_item',          -- Budget line item
        'lodge_initiative',     -- Lodge-specific initiative
        'rule_change'           -- Order rule change
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vote values
DO $$ BEGIN
    CREATE TYPE governance_vote_value AS ENUM (
        'for',
        'against',
        'abstain'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Governance cycles
CREATE TABLE IF NOT EXISTS order_governance_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,
    description TEXT,
    cycle_type governance_cycle_type NOT NULL,

    -- Scope (null = Order-wide)
    lodge_id UUID REFERENCES order_lodges(id) ON DELETE CASCADE,
    craft_house_id UUID REFERENCES order_craft_houses(id) ON DELETE CASCADE,

    -- Timeline
    nominations_start TIMESTAMPTZ,
    nominations_end TIMESTAMPTZ,
    voting_start TIMESTAMPTZ NOT NULL,
    voting_end TIMESTAMPTZ NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',        -- Being configured
        'nominations',  -- Accepting nominations/proposals
        'voting',       -- Voting open
        'tallying',     -- Counting votes
        'completed',    -- Finished
        'cancelled'     -- Cancelled
    )),

    -- Voting rules
    quorum_percentage INTEGER DEFAULT 25 CHECK (quorum_percentage BETWEEN 0 AND 100),
    approval_threshold_percentage INTEGER DEFAULT 50 CHECK (approval_threshold_percentage BETWEEN 0 AND 100),
    allow_weighted_votes BOOLEAN DEFAULT false,
    weight_by TEXT, -- 'tier', 'tenure', 'contribution'

    -- Who can participate
    eligible_roles JSONB DEFAULT '["order_member"]'::jsonb,
    min_membership_days INTEGER DEFAULT 30,

    -- Results (computed after voting)
    total_eligible_voters INTEGER,
    total_votes_cast INTEGER DEFAULT 0,
    quorum_met BOOLEAN,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_governance_cycles_status ON order_governance_cycles(status, voting_end);
CREATE INDEX IF NOT EXISTS idx_governance_cycles_type ON order_governance_cycles(cycle_type, status);
CREATE INDEX IF NOT EXISTS idx_governance_cycles_lodge ON order_governance_cycles(lodge_id) WHERE lodge_id IS NOT NULL;

-- Governance proposals
CREATE TABLE IF NOT EXISTS order_governance_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES order_governance_cycles(id) ON DELETE CASCADE,

    -- Proposer
    proposer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Proposal details
    proposal_type governance_proposal_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    supporting_materials JSONB DEFAULT '[]'::jsonb, -- URLs, documents

    -- For fund requests
    target_fund_id UUID REFERENCES order_funds(id) ON DELETE SET NULL,
    requested_amount_cents BIGINT,
    target_type fund_allocation_target_type,
    target_id UUID,
    target_description TEXT,

    -- For officer nominations
    nominee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    position_type TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'draft',
        'submitted',
        'under_review',
        'approved_for_voting',
        'rejected_from_voting',
        'voting',
        'passed',
        'failed',
        'withdrawn',
        'implemented'
    )),

    -- Review
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Voting results (computed)
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    weighted_votes_for NUMERIC(12,2) DEFAULT 0,
    weighted_votes_against NUMERIC(12,2) DEFAULT 0,
    final_percentage NUMERIC(5,2),

    -- Implementation
    implemented_at TIMESTAMPTZ,
    implementation_notes TEXT,
    allocation_id UUID REFERENCES order_fund_allocations(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_cycle ON order_governance_proposals(cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_proposer ON order_governance_proposals(proposer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON order_governance_proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_fund ON order_governance_proposals(target_fund_id) WHERE target_fund_id IS NOT NULL;

-- Governance votes
CREATE TABLE IF NOT EXISTS order_governance_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES order_governance_proposals(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    vote_value governance_vote_value NOT NULL,

    -- Optional weighted vote (computed based on cycle rules)
    vote_weight NUMERIC(5,2) DEFAULT 1.0,
    weight_factors JSONB DEFAULT '{}'::jsonb, -- {"tier": 1.5, "tenure_months": 24}

    -- Optional comment (public or private based on cycle rules)
    comment TEXT,
    comment_is_public BOOLEAN DEFAULT false,

    -- Audit
    voted_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(proposal_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal ON order_governance_votes(proposal_id, vote_value);
CREATE INDEX IF NOT EXISTS idx_governance_votes_member ON order_governance_votes(member_id, voted_at DESC);

-- Proposal comments/discussion
CREATE TABLE IF NOT EXISTS order_governance_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES order_governance_proposals(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    parent_id UUID REFERENCES order_governance_comments(id) ON DELETE CASCADE,

    content TEXT NOT NULL,

    -- Moderation
    is_pinned BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT false,
    hidden_by UUID REFERENCES profiles(id),
    hidden_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_comments_proposal ON order_governance_comments(proposal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_governance_comments_author ON order_governance_comments(author_id, created_at DESC);

-- =============================================================================
-- PART 3: DUES ALLOCATION TO FUNDS
-- =============================================================================

-- Configure how dues are split across funds
CREATE TABLE IF NOT EXISTS order_dues_fund_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    fund_id UUID NOT NULL REFERENCES order_funds(id) ON DELETE CASCADE,

    -- Which dues tier this applies to (null = all tiers)
    membership_tier TEXT, -- 'BASE', 'STEWARD', 'PATRON', or null for all

    -- Allocation rule
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('percentage', 'fixed_cents')),
    allocation_value NUMERIC(10,4) NOT NULL, -- percentage (0-100) or cents

    -- Priority for applying rules (lower = first)
    priority INTEGER DEFAULT 100,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(fund_id, membership_tier)
);

CREATE INDEX IF NOT EXISTS idx_dues_fund_rules_fund ON order_dues_fund_rules(fund_id, is_active);

-- =============================================================================
-- PART 4: TRANSPARENCY VIEWS
-- =============================================================================

-- Fund summary view (public transparency)
CREATE OR REPLACE VIEW v_order_fund_summaries AS
SELECT
    f.id,
    f.name,
    f.slug,
    f.description,
    f.fund_type,
    f.lodge_id,
    l.name as lodge_name,
    f.current_balance_cents,
    f.total_inflows_cents,
    f.total_outflows_cents,
    f.is_active,
    (
        SELECT COUNT(*) FROM order_fund_allocations a
        WHERE a.fund_id = f.id AND a.status = 'disbursed'
    ) as total_allocations,
    (
        SELECT COALESCE(SUM(a.disbursed_cents), 0) FROM order_fund_allocations a
        WHERE a.fund_id = f.id AND a.status = 'disbursed'
    ) as total_disbursed_cents,
    f.created_at
FROM order_funds f
LEFT JOIN order_lodges l ON f.lodge_id = l.id
WHERE f.is_active = true;

-- Governance cycle summary
CREATE OR REPLACE VIEW v_governance_cycle_summary AS
SELECT
    c.id,
    c.name,
    c.cycle_type,
    c.lodge_id,
    l.name as lodge_name,
    c.status,
    c.voting_start,
    c.voting_end,
    c.quorum_percentage,
    c.approval_threshold_percentage,
    c.total_eligible_voters,
    c.total_votes_cast,
    c.quorum_met,
    (
        SELECT COUNT(*) FROM order_governance_proposals p
        WHERE p.cycle_id = c.id
    ) as total_proposals,
    (
        SELECT COUNT(*) FROM order_governance_proposals p
        WHERE p.cycle_id = c.id AND p.status = 'passed'
    ) as passed_proposals,
    c.created_at
FROM order_governance_cycles c
LEFT JOIN order_lodges l ON c.lodge_id = l.id;

-- Recent fund activity view (for transparency dashboards)
CREATE OR REPLACE VIEW v_order_fund_recent_activity AS
SELECT
    ff.id,
    ff.fund_id,
    f.name as fund_name,
    f.fund_type,
    ff.flow_direction,
    ff.amount_cents,
    ff.source_type,
    ff.description,
    ff.occurred_at,
    CASE
        WHEN ff.flow_direction = 'outflow' AND a.id IS NOT NULL THEN a.target_type::text
        ELSE NULL
    END as allocation_target_type,
    CASE
        WHEN ff.flow_direction = 'outflow' AND a.id IS NOT NULL THEN a.target_description
        ELSE NULL
    END as allocation_target
FROM order_fund_flows ff
JOIN order_funds f ON ff.fund_id = f.id
LEFT JOIN order_fund_allocations a ON ff.allocation_id = a.id
WHERE f.is_active = true
ORDER BY ff.occurred_at DESC;

-- =============================================================================
-- PART 5: HELPER FUNCTIONS
-- =============================================================================

-- Function to record a fund inflow
CREATE OR REPLACE FUNCTION record_fund_inflow(
    p_fund_id UUID,
    p_amount_cents BIGINT,
    p_source_type fund_source_type,
    p_source_reference_type TEXT DEFAULT NULL,
    p_source_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_current_balance BIGINT;
    v_new_balance BIGINT;
    v_flow_id UUID;
BEGIN
    -- Lock the fund for update
    SELECT current_balance_cents INTO v_current_balance
    FROM order_funds WHERE id = p_fund_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fund not found: %', p_fund_id;
    END IF;

    v_new_balance := v_current_balance + p_amount_cents;

    -- Insert flow record
    INSERT INTO order_fund_flows (
        fund_id, flow_direction, amount_cents, source_type,
        source_reference_type, source_reference_id, description,
        recorded_by, balance_after_cents
    ) VALUES (
        p_fund_id, 'inflow', p_amount_cents, p_source_type,
        p_source_reference_type, p_source_reference_id, p_description,
        p_recorded_by, v_new_balance
    ) RETURNING id INTO v_flow_id;

    -- Update fund balance
    UPDATE order_funds SET
        current_balance_cents = v_new_balance,
        total_inflows_cents = total_inflows_cents + p_amount_cents,
        updated_at = NOW()
    WHERE id = p_fund_id;

    RETURN v_flow_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record a fund outflow (from allocation)
CREATE OR REPLACE FUNCTION record_fund_outflow(
    p_fund_id UUID,
    p_allocation_id UUID,
    p_amount_cents BIGINT,
    p_description TEXT DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_current_balance BIGINT;
    v_new_balance BIGINT;
    v_flow_id UUID;
BEGIN
    -- Lock the fund for update
    SELECT current_balance_cents INTO v_current_balance
    FROM order_funds WHERE id = p_fund_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fund not found: %', p_fund_id;
    END IF;

    IF v_current_balance < p_amount_cents THEN
        RAISE EXCEPTION 'Insufficient fund balance: have %, need %', v_current_balance, p_amount_cents;
    END IF;

    v_new_balance := v_current_balance - p_amount_cents;

    -- Insert flow record
    INSERT INTO order_fund_flows (
        fund_id, flow_direction, amount_cents, allocation_id,
        description, recorded_by, balance_after_cents
    ) VALUES (
        p_fund_id, 'outflow', p_amount_cents, p_allocation_id,
        p_description, p_recorded_by, v_new_balance
    ) RETURNING id INTO v_flow_id;

    -- Update fund balance
    UPDATE order_funds SET
        current_balance_cents = v_new_balance,
        total_outflows_cents = total_outflows_cents + p_amount_cents,
        updated_at = NOW()
    WHERE id = p_fund_id;

    RETURN v_flow_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a member is eligible to vote in a cycle
CREATE OR REPLACE FUNCTION is_eligible_to_vote(
    p_cycle_id UUID,
    p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_cycle RECORD;
    v_member RECORD;
    v_membership_days INTEGER;
BEGIN
    -- Get cycle details
    SELECT * INTO v_cycle FROM order_governance_cycles WHERE id = p_cycle_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Get member Order profile
    SELECT * INTO v_member FROM order_member_profiles WHERE user_id = p_member_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Check membership status
    IF v_member.status != 'active' THEN RETURN FALSE; END IF;

    -- Check membership duration
    v_membership_days := EXTRACT(DAY FROM NOW() - v_member.joined_at);
    IF v_membership_days < v_cycle.min_membership_days THEN RETURN FALSE; END IF;

    -- Check lodge scope if applicable
    IF v_cycle.lodge_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM order_lodge_memberships
            WHERE lodge_id = v_cycle.lodge_id AND member_id = p_member_id AND status = 'active'
        ) THEN RETURN FALSE; END IF;
    END IF;

    -- Check craft house scope if applicable
    IF v_cycle.craft_house_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM order_craft_house_memberships
            WHERE craft_house_id = v_cycle.craft_house_id AND member_id = p_member_id AND status = 'active'
        ) THEN RETURN FALSE; END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate vote weight for a member
CREATE OR REPLACE FUNCTION calculate_vote_weight(
    p_cycle_id UUID,
    p_member_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_cycle RECORD;
    v_member RECORD;
    v_weight NUMERIC := 1.0;
    v_tenure_months INTEGER;
BEGIN
    SELECT * INTO v_cycle FROM order_governance_cycles WHERE id = p_cycle_id;
    IF NOT FOUND OR NOT v_cycle.allow_weighted_votes THEN
        RETURN 1.0;
    END IF;

    SELECT * INTO v_member FROM order_member_profiles WHERE user_id = p_member_id;
    IF NOT FOUND THEN RETURN 1.0; END IF;

    -- Weight by tier
    IF v_cycle.weight_by = 'tier' OR v_cycle.weight_by IS NULL THEN
        CASE v_member.membership_tier
            WHEN 'PATRON' THEN v_weight := v_weight * 2.0;
            WHEN 'STEWARD' THEN v_weight := v_weight * 1.5;
            ELSE v_weight := v_weight * 1.0; -- BASE
        END CASE;
    END IF;

    -- Weight by tenure
    IF v_cycle.weight_by = 'tenure' THEN
        v_tenure_months := EXTRACT(MONTH FROM AGE(NOW(), v_member.joined_at));
        IF v_tenure_months >= 24 THEN
            v_weight := v_weight * 1.5;
        ELSIF v_tenure_months >= 12 THEN
            v_weight := v_weight * 1.25;
        END IF;
    END IF;

    RETURN v_weight;
END;
$$ LANGUAGE plpgsql;

-- Function to tally votes for a proposal
CREATE OR REPLACE FUNCTION tally_proposal_votes(p_proposal_id UUID)
RETURNS void AS $$
DECLARE
    v_for INTEGER;
    v_against INTEGER;
    v_abstain INTEGER;
    v_weighted_for NUMERIC;
    v_weighted_against NUMERIC;
    v_total_votes INTEGER;
    v_percentage NUMERIC;
BEGIN
    SELECT
        COALESCE(SUM(CASE WHEN vote_value = 'for' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN vote_value = 'against' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN vote_value = 'abstain' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN vote_value = 'for' THEN vote_weight ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN vote_value = 'against' THEN vote_weight ELSE 0 END), 0)
    INTO v_for, v_against, v_abstain, v_weighted_for, v_weighted_against
    FROM order_governance_votes WHERE proposal_id = p_proposal_id;

    v_total_votes := v_for + v_against; -- Abstains don't count toward percentage

    IF v_total_votes > 0 THEN
        v_percentage := (v_weighted_for / (v_weighted_for + v_weighted_against)) * 100;
    ELSE
        v_percentage := 0;
    END IF;

    UPDATE order_governance_proposals SET
        votes_for = v_for,
        votes_against = v_against,
        votes_abstain = v_abstain,
        weighted_votes_for = v_weighted_for,
        weighted_votes_against = v_weighted_against,
        final_percentage = v_percentage,
        updated_at = NOW()
    WHERE id = p_proposal_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 6: SEED DEFAULT FUNDS
-- =============================================================================

-- Insert default Order funds (run once)
INSERT INTO order_funds (name, slug, description, fund_type, requires_vote_for_allocation, min_allocation_for_vote_cents)
VALUES
    ('Micro-Production Fund', 'micro-fund', 'Small grants for independent productions (up to $5,000)', 'micro_fund', true, 50000),
    ('Gear Library Fund', 'gear-fund', 'Equipment purchases for member borrowing program', 'gear_fund', true, 100000),
    ('Member Emergency Fund', 'emergency-fund', 'Emergency support for members facing hardship', 'emergency_support', false, 0),
    ('Education & Training Fund', 'education-fund', 'Workshops, training, and educational programs', 'education', true, 25000),
    ('General Operating Fund', 'general-fund', 'General Order operations and overhead', 'general', false, 0)
ON CONFLICT (slug) DO NOTHING;

-- Grant permissions
GRANT SELECT ON v_order_fund_summaries TO authenticated;
GRANT SELECT ON v_governance_cycle_summary TO authenticated;
GRANT SELECT ON v_order_fund_recent_activity TO authenticated;
