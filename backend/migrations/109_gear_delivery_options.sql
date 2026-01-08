-- Migration 109: Gear House Expanded Delivery Options
-- Adds customer pickup, local delivery expansion, and carrier shipping (FedEx, UPS, USPS)
-- with EasyPost integration for label generation and tracking

-- ============================================================================
-- EXPAND GEAR_MARKETPLACE_SETTINGS FOR DELIVERY OPTIONS
-- ============================================================================

-- Customer Pickup
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    allows_customer_pickup BOOLEAN DEFAULT TRUE;
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    pickup_address TEXT;
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    pickup_instructions TEXT;
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    pickup_hours JSONB; -- {"mon": "9am-5pm", "tue": "9am-5pm", ...}

-- Local delivery expansion (offers_delivery, delivery_radius_miles, delivery_base_fee, delivery_per_mile_fee already exist)
-- Just add explicit enabled flag for clarity
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    local_delivery_enabled BOOLEAN DEFAULT FALSE;

-- Carrier Shipping Options
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    shipping_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    shipping_carriers JSONB DEFAULT '["usps", "ups", "fedex"]'; -- enabled carriers
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    shipping_pricing_mode TEXT DEFAULT 'real_time' CHECK (shipping_pricing_mode IN ('real_time', 'flat_rate', 'both'));
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    flat_rate_shipping JSONB; -- {"ground": 15.00, "express": 35.00, "overnight": 75.00}
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    free_shipping_threshold DECIMAL(10,2); -- Orders over $X get free shipping
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    ships_from_address JSONB; -- {name, street1, street2, city, state, zip, country, phone}
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    package_defaults JSONB; -- Default package dimensions per category

-- EasyPost Integration
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    easypost_api_key_encrypted TEXT; -- Encrypted API key
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    easypost_carrier_accounts JSONB; -- Linked carrier account IDs
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    use_platform_easypost BOOLEAN DEFAULT TRUE; -- Use platform's EasyPost account

-- Return shipping policy
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    return_shipping_paid_by TEXT DEFAULT 'renter' CHECK (return_shipping_paid_by IN ('renter', 'rental_house', 'split'));
ALTER TABLE gear_marketplace_settings ADD COLUMN IF NOT EXISTS
    auto_insurance_threshold DECIMAL(10,2); -- Auto-add insurance for items over this value

-- ============================================================================
-- GEAR SHIPMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    quote_id UUID REFERENCES gear_rental_quotes(id) ON DELETE SET NULL,
    order_id UUID REFERENCES gear_rental_orders(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES gear_transactions(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Direction
    shipment_type TEXT NOT NULL CHECK (shipment_type IN ('outbound', 'return')),

    -- EasyPost IDs
    easypost_shipment_id TEXT,
    easypost_rate_id TEXT,
    easypost_tracker_id TEXT,

    -- Carrier info
    carrier TEXT NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
    service TEXT NOT NULL, -- ground, express, priority, overnight, etc.
    service_name TEXT, -- Human-readable: "USPS Priority Mail"
    tracking_number TEXT,
    tracking_url TEXT,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'label_created', 'label_purchased', 'shipped',
        'in_transit', 'out_for_delivery', 'delivered',
        'return_to_sender', 'failure', 'cancelled'
    )),

    -- Addresses (stored as snapshots)
    from_address JSONB NOT NULL,
    to_address JSONB NOT NULL,

    -- Package details
    package_type TEXT, -- parcel, softpack, letter, etc.
    package_dimensions JSONB, -- {length, width, height, weight, weight_unit, dimension_unit}

    -- Costs
    quoted_rate DECIMAL(10,2), -- Original quoted rate
    shipping_cost DECIMAL(10,2), -- Actual cost
    insurance_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2),

    -- Who pays
    paid_by TEXT DEFAULT 'renter' CHECK (paid_by IN ('renter', 'rental_house', 'split')),

    -- Label
    label_url TEXT,
    label_format TEXT DEFAULT 'pdf' CHECK (label_format IN ('pdf', 'png', 'zpl', 'epl2')),
    label_size TEXT DEFAULT '4x6', -- 4x6, 4x8, etc.
    label_created_at TIMESTAMPTZ,

    -- Insurance
    insured_value DECIMAL(10,2),
    insurance_provider TEXT, -- easypost, carrier, third_party

    -- Timestamps and tracking events
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    tracking_events JSONB DEFAULT '[]', -- Array of tracking updates

    -- Metadata
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for gear_shipments
CREATE INDEX IF NOT EXISTS idx_gear_shipments_quote ON gear_shipments(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_shipments_order ON gear_shipments(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_shipments_transaction ON gear_shipments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_shipments_org ON gear_shipments(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_shipments_tracking ON gear_shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_shipments_status ON gear_shipments(status);
CREATE INDEX IF NOT EXISTS idx_gear_shipments_type_status ON gear_shipments(shipment_type, status);
CREATE INDEX IF NOT EXISTS idx_gear_shipments_easypost ON gear_shipments(easypost_shipment_id) WHERE easypost_shipment_id IS NOT NULL;

-- ============================================================================
-- EXPAND GEAR_RENTAL_QUOTES FOR DELIVERY METHOD
-- ============================================================================

ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    delivery_method TEXT DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'local_delivery', 'shipping'));
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    shipping_carrier TEXT;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    shipping_service TEXT;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    shipping_cost DECIMAL(10,2);
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    return_shipping_cost DECIMAL(10,2);
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    renter_shipping_address JSONB;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS
    selected_rate_id TEXT; -- EasyPost rate ID selected by renter

-- ============================================================================
-- EXPAND GEAR_RENTAL_ORDERS FOR DELIVERY
-- ============================================================================

ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS
    delivery_method TEXT DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'local_delivery', 'shipping'));
ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS
    shipping_address JSONB;
ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS
    outbound_shipment_id UUID REFERENCES gear_shipments(id);
ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS
    return_shipment_id UUID REFERENCES gear_shipments(id);

-- ============================================================================
-- UPDATE TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS trg_gear_shipments_updated ON gear_shipments;
CREATE TRIGGER trg_gear_shipments_updated
    BEFORE UPDATE ON gear_shipments
    FOR EACH ROW EXECUTE FUNCTION update_gear_marketplace_updated_at();

-- ============================================================================
-- ADD PACKAGE DEFAULTS FOR CATEGORIES
-- ============================================================================

-- Default package dimensions by gear category (can be customized per org)
COMMENT ON COLUMN gear_marketplace_settings.package_defaults IS
'Default package dimensions per category. Format:
{
  "camera": {"length": 18, "width": 14, "height": 12, "weight": 15},
  "lens": {"length": 8, "width": 6, "height": 6, "weight": 3},
  "lighting": {"length": 24, "width": 12, "height": 12, "weight": 20},
  "audio": {"length": 12, "width": 10, "height": 8, "weight": 5},
  "grip": {"length": 48, "width": 8, "height": 8, "weight": 25},
  "default": {"length": 16, "width": 12, "height": 10, "weight": 10}
}
Dimensions in inches, weight in lbs.';
