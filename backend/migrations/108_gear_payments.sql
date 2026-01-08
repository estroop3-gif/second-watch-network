-- Migration 108: Gear Marketplace Payments
-- Adds payment tracking infrastructure for marketplace rentals

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================

-- Payment records for rental transactions
CREATE TABLE IF NOT EXISTS gear_rental_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES gear_rental_quotes(id),
    order_id UUID REFERENCES gear_rental_orders(id),

    -- Stripe
    payment_intent_id TEXT,
    charge_id TEXT,
    refund_id TEXT,

    -- Payment details
    payment_type TEXT NOT NULL, -- deposit, full, balance, deposit_refund
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending', -- pending, processing, succeeded, failed, refunded

    -- Timestamps
    paid_at TIMESTAMPTZ,
    paid_by_user_id UUID REFERENCES profiles(id),

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_rental_payments_quote ON gear_rental_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_gear_rental_payments_order ON gear_rental_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_gear_rental_payments_intent ON gear_rental_payments(payment_intent_id);

-- ============================================================================
-- QUOTE PAYMENT COLUMNS
-- ============================================================================

-- Stripe payment tracking
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS deposit_payment_intent_id TEXT;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS payment_type TEXT; -- deposit, full

-- Payment completion
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS payment_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS payment_method TEXT; -- stripe, invoice

-- Backlot invoice link
ALTER TABLE gear_rental_quotes ADD COLUMN IF NOT EXISTS backlot_invoice_id UUID REFERENCES backlot_invoices(id);

-- ============================================================================
-- ORDER DEPOSIT TRACKING
-- ============================================================================

ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS deposit_refunded BOOLEAN DEFAULT FALSE;
ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS deposit_refunded_at TIMESTAMPTZ;
ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS deposit_refund_amount DECIMAL(10,2);
ALTER TABLE gear_rental_orders ADD COLUMN IF NOT EXISTS deposit_payment_id UUID REFERENCES gear_rental_payments(id);

-- ============================================================================
-- ORGANIZATION STRIPE CUSTOMER
-- ============================================================================

-- Add Stripe customer ID to organizations for B2B payments
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gear_quotes_payment_intent ON gear_rental_quotes(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_gear_quotes_invoice ON gear_rental_quotes(backlot_invoice_id);
CREATE INDEX IF NOT EXISTS idx_gear_orders_deposit_refund ON gear_rental_orders(deposit_refunded) WHERE deposit_refunded = FALSE;
