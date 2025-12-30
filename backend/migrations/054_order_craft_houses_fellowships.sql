-- Order of the Second Watch: Craft Houses, Fellowships, and Governance
-- Migration 054

-- ============================================================
-- CRAFT HOUSES - Department-based professional groups
-- ============================================================

CREATE TABLE IF NOT EXISTS order_craft_houses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- Lucide icon name
    primary_tracks TEXT[], -- Array of PrimaryTrack values that map to this house
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'forming')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_craft_houses_status ON order_craft_houses(status);
CREATE INDEX idx_order_craft_houses_slug ON order_craft_houses(slug);

-- Craft House Membership
CREATE TABLE IF NOT EXISTS order_craft_house_memberships (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    craft_house_id INT NOT NULL REFERENCES order_craft_houses(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'deputy', 'master')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, craft_house_id)
);

CREATE INDEX idx_craft_house_memberships_user ON order_craft_house_memberships(user_id);
CREATE INDEX idx_craft_house_memberships_house ON order_craft_house_memberships(craft_house_id);
CREATE INDEX idx_craft_house_memberships_role ON order_craft_house_memberships(role);

-- ============================================================
-- FELLOWSHIPS - Cross-craft special interest groups
-- ============================================================

CREATE TABLE IF NOT EXISTS order_fellowships (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    fellowship_type VARCHAR(50) NOT NULL CHECK (fellowship_type IN ('entry_level', 'faith_based', 'special_interest', 'regional')),
    description TEXT,
    requirements TEXT, -- Description of membership requirements
    is_opt_in BOOLEAN DEFAULT true, -- Whether members choose to join (vs auto-assigned)
    is_visible BOOLEAN DEFAULT true, -- Whether shown publicly
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'forming')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_fellowships_type ON order_fellowships(fellowship_type);
CREATE INDEX idx_order_fellowships_status ON order_fellowships(status);
CREATE INDEX idx_order_fellowships_slug ON order_fellowships(slug);

-- Fellowship Membership
CREATE TABLE IF NOT EXISTS order_fellowship_memberships (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    fellowship_id INT NOT NULL REFERENCES order_fellowships(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'leader', 'coordinator')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, fellowship_id)
);

CREATE INDEX idx_fellowship_memberships_user ON order_fellowship_memberships(user_id);
CREATE INDEX idx_fellowship_memberships_fellowship ON order_fellowship_memberships(fellowship_id);

-- ============================================================
-- GOVERNANCE POSITIONS - Leadership roles
-- ============================================================

CREATE TABLE IF NOT EXISTS order_governance_positions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    position_type VARCHAR(50) NOT NULL CHECK (position_type IN (
        'high_council',      -- Order-wide leadership (5-7 members)
        'grand_master',      -- Head of the Order
        'lodge_master',      -- Lodge leader
        'lodge_council',     -- Lodge leadership team
        'craft_master',      -- Head of a Craft House
        'craft_deputy',      -- Deputy of a Craft House
        'fellowship_leader', -- Head of a Fellowship
        'regional_director'  -- Oversees multiple lodges
    )),
    scope_type VARCHAR(50) CHECK (scope_type IN ('order', 'lodge', 'craft_house', 'fellowship', 'region')),
    scope_id INT, -- lodge_id, craft_house_id, or fellowship_id depending on scope_type
    title VARCHAR(200) NOT NULL, -- Display title (e.g., "Grand Master", "Lodge Master of LA", "Camera Guild Master")
    description TEXT, -- Role description
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ, -- NULL if currently active
    is_active BOOLEAN DEFAULT true,
    appointed_by UUID, -- User who appointed them
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_governance_positions_user ON order_governance_positions(user_id);
CREATE INDEX idx_governance_positions_type ON order_governance_positions(position_type);
CREATE INDEX idx_governance_positions_scope ON order_governance_positions(scope_type, scope_id);
CREATE INDEX idx_governance_positions_active ON order_governance_positions(is_active) WHERE is_active = true;

-- ============================================================
-- MEMBERSHIP TIERS - Extend order_member_profiles
-- ============================================================

-- Add membership tier columns to existing table
ALTER TABLE order_member_profiles
    ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(50) DEFAULT 'base'
    CHECK (membership_tier IN ('base', 'steward', 'patron'));

ALTER TABLE order_member_profiles
    ADD COLUMN IF NOT EXISTS tier_started_at TIMESTAMPTZ;

-- Add Stripe product/price IDs for subscription tracking
ALTER TABLE order_member_profiles
    ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100);

-- ============================================================
-- EXTENDED PRIMARY TRACKS
-- ============================================================

-- Update the check constraint on order_member_profiles to include new tracks
-- (We'll handle this in the model since PostgreSQL enum extension is complex)

-- ============================================================
-- MEMBERSHIP DUES HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS order_dues_payments (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    amount_cents INT NOT NULL,
    tier VARCHAR(50) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dues_payments_user ON order_dues_payments(user_id);
CREATE INDEX idx_dues_payments_status ON order_dues_payments(status);
CREATE INDEX idx_dues_payments_stripe ON order_dues_payments(stripe_payment_intent_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER order_craft_houses_updated_at
    BEFORE UPDATE ON order_craft_houses
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

CREATE TRIGGER order_craft_house_memberships_updated_at
    BEFORE UPDATE ON order_craft_house_memberships
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

CREATE TRIGGER order_fellowships_updated_at
    BEFORE UPDATE ON order_fellowships
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

CREATE TRIGGER order_fellowship_memberships_updated_at
    BEFORE UPDATE ON order_fellowship_memberships
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

CREATE TRIGGER order_governance_positions_updated_at
    BEFORE UPDATE ON order_governance_positions
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE order_craft_houses IS 'Department-based professional groups within the Order (Camera Guild, Post House, etc.)';
COMMENT ON TABLE order_craft_house_memberships IS 'Tracks which members belong to which Craft Houses';
COMMENT ON TABLE order_fellowships IS 'Cross-craft special interest groups (First Watch Order, Kingdom Builders, etc.)';
COMMENT ON TABLE order_fellowship_memberships IS 'Tracks which members belong to which Fellowships';
COMMENT ON TABLE order_governance_positions IS 'Leadership and governance roles within the Order';
COMMENT ON TABLE order_dues_payments IS 'History of membership dues payments';
