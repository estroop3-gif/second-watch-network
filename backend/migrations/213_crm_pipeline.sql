-- Migration 213: CRM Pipeline & Deal Management
-- Deals with stage tracking and history for sales pipeline

-- ============================================================================
-- Table: crm_deals
-- Sales deals / opportunities tied to contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    assigned_rep_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Deal info
    title TEXT NOT NULL,
    description TEXT,

    -- Product
    product_type TEXT NOT NULL DEFAULT 'backlot_membership'
        CHECK (product_type IN (
            'backlot_membership', 'premium_membership', 'production_service',
            'gear_rental', 'ad_deal', 'sponsorship', 'other'
        )),
    product_detail JSONB DEFAULT '{}',

    -- Pipeline stage
    stage TEXT NOT NULL DEFAULT 'lead'
        CHECK (stage IN (
            'lead', 'contacted', 'qualified', 'proposal',
            'negotiation', 'closed_won', 'closed_lost'
        )),

    -- Financials
    amount_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    probability INTEGER DEFAULT 0
        CHECK (probability >= 0 AND probability <= 100),

    -- Dates
    expected_close_date DATE,
    actual_close_date DATE,

    -- Close details
    close_reason TEXT,
    competitor TEXT,

    -- Audit
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for crm_deals
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_rep ON crm_deals(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_product ON crm_deals(product_type);
CREATE INDEX IF NOT EXISTS idx_crm_deals_created ON crm_deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_deals_expected_close ON crm_deals(expected_close_date)
    WHERE expected_close_date IS NOT NULL;

-- ============================================================================
-- Table: crm_deal_stage_history
-- Track every stage transition for reporting and auditing
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_deal_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_deal_stage_history_deal
    ON crm_deal_stage_history(deal_id, changed_at DESC);

-- ============================================================================
-- Add deal_id FK on crm_activities now that crm_deals exists
-- (The column already exists from migration 212, just add the FK)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'crm_activities_deal_id_fkey'
        AND table_name = 'crm_activities'
    ) THEN
        ALTER TABLE crm_activities
            ADD CONSTRAINT crm_activities_deal_id_fkey
            FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;
    END IF;
END $$;
