-- Migration 110: Gear Sales and Photo Requirements
-- Adds sale functionality to marketplace listings and creates gear_sales table
-- Photo validation is enforced at application level, not database level

-- ============================================================================
-- ADD LISTING TYPE AND SALE FIELDS TO MARKETPLACE LISTINGS
-- ============================================================================

-- Listing type: rent, sale, or both
ALTER TABLE gear_marketplace_listings ADD COLUMN IF NOT EXISTS
    listing_type TEXT DEFAULT 'rent' CHECK (listing_type IN ('rent', 'sale', 'both'));

-- Sale-specific fields
ALTER TABLE gear_marketplace_listings ADD COLUMN IF NOT EXISTS
    sale_price DECIMAL(10,2);
ALTER TABLE gear_marketplace_listings ADD COLUMN IF NOT EXISTS
    sale_condition TEXT CHECK (sale_condition IN ('new', 'like_new', 'good', 'fair', 'parts'));
ALTER TABLE gear_marketplace_listings ADD COLUMN IF NOT EXISTS
    sale_includes TEXT; -- Description of what's included with the sale
ALTER TABLE gear_marketplace_listings ADD COLUMN IF NOT EXISTS
    sale_negotiable BOOLEAN DEFAULT TRUE;

-- Add constraint: sale listings must have sale_price
ALTER TABLE gear_marketplace_listings DROP CONSTRAINT IF EXISTS chk_listing_has_required_pricing;
ALTER TABLE gear_marketplace_listings ADD CONSTRAINT chk_listing_has_required_pricing CHECK (
    (listing_type = 'rent' AND daily_rate IS NOT NULL) OR
    (listing_type = 'sale' AND sale_price IS NOT NULL) OR
    (listing_type = 'both' AND daily_rate IS NOT NULL AND sale_price IS NOT NULL)
);

-- Index for filtering by listing type
CREATE INDEX IF NOT EXISTS idx_gear_listings_type
    ON gear_marketplace_listings(listing_type) WHERE is_listed = TRUE;

-- ============================================================================
-- GEAR SALES TABLE - For purchase transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links to listing and asset
    listing_id UUID NOT NULL REFERENCES gear_marketplace_listings(id) ON DELETE RESTRICT,
    asset_id UUID NOT NULL REFERENCES gear_assets(id) ON DELETE RESTRICT,

    -- Seller info
    seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    seller_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

    -- Buyer info
    buyer_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL, -- NULL for individual buyers
    buyer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

    -- Pricing
    asking_price DECIMAL(10,2) NOT NULL, -- Original listing price
    offer_price DECIMAL(10,2) NOT NULL, -- Buyer's offer
    final_price DECIMAL(10,2), -- Agreed price after negotiation
    platform_fee DECIMAL(10,2) DEFAULT 0,
    seller_payout DECIMAL(10,2),

    -- Status workflow: offered -> [countered*] -> accepted -> paid -> shipped -> completed
    -- Or: offered -> rejected/cancelled/expired
    status TEXT DEFAULT 'offered' CHECK (status IN (
        'offered',        -- Buyer made an offer
        'countered',      -- Seller countered
        'accepted',       -- Both parties agreed
        'payment_pending',-- Awaiting payment
        'paid',           -- Payment received
        'shipped',        -- Item shipped
        'delivered',      -- Item delivered
        'completed',      -- Sale finalized, asset transferred
        'cancelled',      -- Cancelled by either party
        'rejected',       -- Seller rejected offer
        'expired',        -- Offer expired
        'disputed'        -- Under dispute
    )),

    -- Negotiation history (array of {from, to, price, message, timestamp})
    negotiation_history JSONB DEFAULT '[]',

    -- Payment
    payment_method TEXT CHECK (payment_method IN ('stripe', 'invoice', 'cash', 'external')),
    stripe_payment_intent_id TEXT,
    invoice_id UUID, -- Link to backlot_invoices if using invoice
    paid_at TIMESTAMPTZ,
    payment_notes TEXT,

    -- Delivery
    delivery_method TEXT DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'shipping')),
    shipping_address JSONB, -- Buyer's shipping address
    shipment_id UUID, -- Link to gear_shipments

    -- Messages and notes
    buyer_message TEXT, -- Initial message with offer
    seller_notes TEXT, -- Internal seller notes

    -- Offer expiration
    offer_expires_at TIMESTAMPTZ, -- When offer expires if not responded to

    -- Timestamps
    offered_at TIMESTAMPTZ DEFAULT NOW(),
    countered_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES profiles(id),
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for shipment after gear_shipments exists
ALTER TABLE gear_sales DROP CONSTRAINT IF EXISTS gear_sales_shipment_id_fkey;
ALTER TABLE gear_sales ADD CONSTRAINT gear_sales_shipment_id_fkey
    FOREIGN KEY (shipment_id) REFERENCES gear_shipments(id) ON DELETE SET NULL;

-- Add sale_id to gear_shipments for reverse lookup
ALTER TABLE gear_shipments ADD COLUMN IF NOT EXISTS
    sale_id UUID REFERENCES gear_sales(id) ON DELETE SET NULL;

-- Indexes for gear_sales
CREATE INDEX IF NOT EXISTS idx_gear_sales_listing ON gear_sales(listing_id);
CREATE INDEX IF NOT EXISTS idx_gear_sales_asset ON gear_sales(asset_id);
CREATE INDEX IF NOT EXISTS idx_gear_sales_seller_org ON gear_sales(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_gear_sales_seller_user ON gear_sales(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_gear_sales_buyer_user ON gear_sales(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_gear_sales_status ON gear_sales(status);
CREATE INDEX IF NOT EXISTS idx_gear_sales_pending ON gear_sales(status, offered_at)
    WHERE status IN ('offered', 'countered', 'payment_pending');

-- ============================================================================
-- ASSET OWNERSHIP TRANSFER TRACKING
-- ============================================================================

-- Track when an asset was sold and to whom
ALTER TABLE gear_assets ADD COLUMN IF NOT EXISTS
    sold_via_sale_id UUID REFERENCES gear_sales(id) ON DELETE SET NULL;
ALTER TABLE gear_assets ADD COLUMN IF NOT EXISTS
    sold_at TIMESTAMPTZ;
ALTER TABLE gear_assets ADD COLUMN IF NOT EXISTS
    previous_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- ============================================================================
-- UPDATE TRIGGER FOR GEAR_SALES
-- ============================================================================

DROP TRIGGER IF EXISTS trg_gear_sales_updated ON gear_sales;
CREATE TRIGGER trg_gear_sales_updated
    BEFORE UPDATE ON gear_sales
    FOR EACH ROW EXECUTE FUNCTION update_gear_marketplace_updated_at();

-- ============================================================================
-- SELLER REPUTATION FOR SALES
-- ============================================================================

-- Add sale-specific reputation fields to existing reputation table
ALTER TABLE gear_renter_reputation ADD COLUMN IF NOT EXISTS
    total_sales INTEGER DEFAULT 0;
ALTER TABLE gear_renter_reputation ADD COLUMN IF NOT EXISTS
    successful_sales INTEGER DEFAULT 0;
ALTER TABLE gear_renter_reputation ADD COLUMN IF NOT EXISTS
    total_purchases INTEGER DEFAULT 0;
ALTER TABLE gear_renter_reputation ADD COLUMN IF NOT EXISTS
    successful_purchases INTEGER DEFAULT 0;

-- Rename table to be more generic if needed (optional - keep for now)
COMMENT ON TABLE gear_renter_reputation IS
'Reputation tracking for both rental and sale transactions. Covers:
- total_rentals/successful_rentals: Rentals as a renter
- total_sales/successful_sales: Sales as a seller
- total_purchases/successful_purchases: Purchases as a buyer';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE gear_sales IS
'Tracks gear purchase transactions from offer through completion.
Flow: offered -> countered* -> accepted -> paid -> shipped -> delivered -> completed
On completion, asset ownership transfers to buyer organization.';

COMMENT ON COLUMN gear_marketplace_listings.listing_type IS
'Type of listing: rent (rental only), sale (sale only), both (available for rent or purchase)';

COMMENT ON COLUMN gear_marketplace_listings.sale_condition IS
'Condition of item for sale: new, like_new, good, fair, parts';

COMMENT ON COLUMN gear_sales.negotiation_history IS
'Array of negotiation steps: [{from: uuid, to: uuid, price: decimal, message: text, timestamp: timestamptz}]';
