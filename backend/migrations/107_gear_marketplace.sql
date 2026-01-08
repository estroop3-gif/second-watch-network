-- Migration 107: Gear House Rental Marketplace
-- Extends existing rental system with marketplace listings, extensions, and reputation

-- ============================================================================
-- MARKETPLACE SETTINGS (per organization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_marketplace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Lister tier
    lister_type TEXT DEFAULT 'production_company' CHECK (lister_type IN ('individual', 'production_company', 'rental_house')),

    -- Marketplace visibility
    is_marketplace_enabled BOOLEAN DEFAULT FALSE,
    marketplace_name TEXT,
    marketplace_description TEXT,
    marketplace_logo_url TEXT,
    marketplace_location TEXT,
    marketplace_website TEXT,

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    successful_rentals_count INTEGER DEFAULT 0,

    -- Default rental settings
    default_deposit_percent DECIMAL(5,2) DEFAULT 0,
    require_deposit BOOLEAN DEFAULT FALSE,
    default_insurance_required BOOLEAN DEFAULT FALSE,
    offers_delivery BOOLEAN DEFAULT FALSE,
    delivery_radius_miles INTEGER,
    delivery_base_fee DECIMAL(10,2),
    delivery_per_mile_fee DECIMAL(10,2),

    -- Extension policy
    extension_policy TEXT DEFAULT 'request_approve' CHECK (extension_policy IN ('request_approve', 'auto_extend', 'negotiated')),
    auto_extend_max_days INTEGER DEFAULT 3,

    -- Payment preferences
    accepts_stripe BOOLEAN DEFAULT TRUE,
    accepts_invoice BOOLEAN DEFAULT TRUE,
    stripe_account_id TEXT,

    -- Contact preferences
    contact_email TEXT,
    contact_phone TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_gear_marketplace_settings_org ON gear_marketplace_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_settings_enabled ON gear_marketplace_settings(is_marketplace_enabled) WHERE is_marketplace_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_settings_type ON gear_marketplace_settings(lister_type);

-- ============================================================================
-- MARKETPLACE LISTINGS (extends gear_assets with rental pricing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES gear_assets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Listing status
    is_listed BOOLEAN DEFAULT TRUE,
    listed_at TIMESTAMPTZ DEFAULT NOW(),
    delisted_at TIMESTAMPTZ,

    -- Pricing
    daily_rate DECIMAL(10,2) NOT NULL,
    weekly_rate DECIMAL(10,2),  -- If NULL, calculated as daily * 5 (industry standard)
    monthly_rate DECIMAL(10,2), -- If NULL, calculated as daily * 20

    -- Discounts
    weekly_discount_percent DECIMAL(5,2) DEFAULT 0,
    monthly_discount_percent DECIMAL(5,2) DEFAULT 0,
    quantity_discount_threshold INTEGER,
    quantity_discount_percent DECIMAL(5,2),

    -- Deposit & Insurance
    deposit_amount DECIMAL(10,2),
    deposit_percent DECIMAL(5,2),
    insurance_required BOOLEAN DEFAULT FALSE,
    insurance_daily_rate DECIMAL(10,2),

    -- Availability
    min_rental_days INTEGER DEFAULT 1,
    max_rental_days INTEGER,
    advance_booking_days INTEGER DEFAULT 1,

    -- Blackout dates stored as JSONB array of {start, end} objects
    blackout_dates JSONB DEFAULT '[]',

    -- Notes for renters
    rental_notes TEXT,
    pickup_instructions TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(asset_id)
);

CREATE INDEX IF NOT EXISTS idx_gear_marketplace_listings_org ON gear_marketplace_listings(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_listings_asset ON gear_marketplace_listings(asset_id);
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_listings_listed ON gear_marketplace_listings(is_listed) WHERE is_listed = TRUE;
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_listings_rate ON gear_marketplace_listings(daily_rate);

-- ============================================================================
-- RENTAL EXTENSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_rental_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES gear_transactions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES gear_rental_orders(id) ON DELETE CASCADE,

    -- Extension details
    original_end_date DATE NOT NULL,
    requested_end_date DATE NOT NULL,
    approved_end_date DATE,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'auto_approved')),
    extension_type TEXT NOT NULL CHECK (extension_type IN ('request_approve', 'auto_extend', 'negotiated')),

    -- Pricing
    additional_days INTEGER NOT NULL,
    daily_rate DECIMAL(10,2),
    additional_amount DECIMAL(10,2),
    new_quote_id UUID REFERENCES gear_rental_quotes(id), -- For negotiated extensions

    -- Who/when
    requested_by UUID NOT NULL REFERENCES profiles(id),
    reviewed_by UUID REFERENCES profiles(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,

    reason TEXT,
    denial_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_rental_extensions_tx ON gear_rental_extensions(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_rental_extensions_order ON gear_rental_extensions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_rental_extensions_status ON gear_rental_extensions(status);
CREATE INDEX IF NOT EXISTS idx_gear_rental_extensions_pending ON gear_rental_extensions(status) WHERE status = 'pending';

-- ============================================================================
-- RENTER REPUTATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_renter_reputation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Stats
    total_rentals INTEGER DEFAULT 0,
    successful_rentals INTEGER DEFAULT 0,
    late_returns INTEGER DEFAULT 0,
    damage_incidents INTEGER DEFAULT 0,
    total_rental_value DECIMAL(12,2) DEFAULT 0,

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verification_threshold INTEGER DEFAULT 5, -- Successful rentals needed for verified badge

    -- Rating (optional future feature)
    average_rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_gear_renter_reputation_org ON gear_renter_reputation(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_renter_reputation_verified ON gear_renter_reputation(is_verified) WHERE is_verified = TRUE;

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================

-- Add marketplace fields to gear_transactions
ALTER TABLE gear_transactions ADD COLUMN IF NOT EXISTS rental_order_id UUID REFERENCES gear_rental_orders(id);
ALTER TABLE gear_transactions ADD COLUMN IF NOT EXISTS is_marketplace_rental BOOLEAN DEFAULT FALSE;
ALTER TABLE gear_transactions ADD COLUMN IF NOT EXISTS renter_org_id UUID REFERENCES organizations(id);
ALTER TABLE gear_transactions ADD COLUMN IF NOT EXISTS rental_house_org_id UUID REFERENCES organizations(id);

-- Add Backlot integration to gear_rental_requests
ALTER TABLE gear_rental_requests ADD COLUMN IF NOT EXISTS budget_line_item_id UUID REFERENCES backlot_budget_line_items(id);
ALTER TABLE gear_rental_requests ADD COLUMN IF NOT EXISTS auto_create_budget_line BOOLEAN DEFAULT FALSE;

-- Add deposit tracking to gear_rental_quotes
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2);
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;

-- Add rental permission settings to gear_organization_settings
ALTER TABLE gear_organization_settings ADD COLUMN IF NOT EXISTS who_can_request_rentals TEXT DEFAULT 'managers';
ALTER TABLE gear_organization_settings ADD COLUMN IF NOT EXISTS require_budget_approval BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gear_transactions_marketplace ON gear_transactions(is_marketplace_rental) WHERE is_marketplace_rental = TRUE;
CREATE INDEX IF NOT EXISTS idx_gear_transactions_renter_org ON gear_transactions(renter_org_id) WHERE renter_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_transactions_rental_house_org ON gear_transactions(rental_house_org_id) WHERE rental_house_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_transactions_rental_order ON gear_transactions(rental_order_id) WHERE rental_order_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_gear_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gear_marketplace_settings_updated ON gear_marketplace_settings;
CREATE TRIGGER trg_gear_marketplace_settings_updated
    BEFORE UPDATE ON gear_marketplace_settings
    FOR EACH ROW EXECUTE FUNCTION update_gear_marketplace_updated_at();

DROP TRIGGER IF EXISTS trg_gear_marketplace_listings_updated ON gear_marketplace_listings;
CREATE TRIGGER trg_gear_marketplace_listings_updated
    BEFORE UPDATE ON gear_marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION update_gear_marketplace_updated_at();

DROP TRIGGER IF EXISTS trg_gear_rental_extensions_updated ON gear_rental_extensions;
CREATE TRIGGER trg_gear_rental_extensions_updated
    BEFORE UPDATE ON gear_rental_extensions
    FOR EACH ROW EXECUTE FUNCTION update_gear_marketplace_updated_at();

DROP TRIGGER IF EXISTS trg_gear_renter_reputation_updated ON gear_renter_reputation;
CREATE TRIGGER trg_gear_renter_reputation_updated
    BEFORE UPDATE ON gear_renter_reputation
    FOR EACH ROW EXECUTE FUNCTION update_gear_marketplace_updated_at();
