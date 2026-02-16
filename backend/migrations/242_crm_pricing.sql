-- Migration 242: CRM Pricing Quotes
-- Quote objects for Backlot subscription CPQ wizard

CREATE TABLE IF NOT EXISTS pricing_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    linked_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    linked_org_id UUID,

    -- Step 1: Client & basics
    client_name TEXT NOT NULL,
    region TEXT,
    production_type TEXT,
    start_date DATE,
    end_date DATE,
    term_type TEXT NOT NULL DEFAULT 'monthly',
    term_months INT NOT NULL DEFAULT 3,
    trial_type TEXT NOT NULL DEFAULT 'none',

    -- Step 2: Tier
    tier TEXT NOT NULL DEFAULT 'starter',

    -- Full wizard inputs (JSON blob for flexibility)
    raw_input JSONB NOT NULL DEFAULT '{}',

    -- Computed outputs (stored for fast retrieval)
    line_items JSONB NOT NULL DEFAULT '[]',
    monthly_breakdown JSONB NOT NULL DEFAULT '[]',
    monthly_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_contract_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    effective_monthly_rate NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Production package
    is_production_package BOOLEAN DEFAULT FALSE,
    phase_breakdown JSONB DEFAULT '[]',

    -- Status workflow
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_quotes_created_by ON pricing_quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_status ON pricing_quotes(status);
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_contact ON pricing_quotes(linked_contact_id);
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_created ON pricing_quotes(created_at DESC);

-- Version history for audit trail
CREATE TABLE IF NOT EXISTS pricing_quote_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES pricing_quotes(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    raw_input JSONB NOT NULL DEFAULT '{}',
    line_items JSONB NOT NULL DEFAULT '[]',
    monthly_breakdown JSONB NOT NULL DEFAULT '[]',
    monthly_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_contract_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    changed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_versions_quote ON pricing_quote_versions(quote_id);
