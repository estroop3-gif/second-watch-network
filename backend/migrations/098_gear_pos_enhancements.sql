-- Migration 098: Gear POS Enhancements
-- Allows quick rentals at point-of-sale without full request/quote workflow

-- Make request_id nullable on gear_rental_quotes for POS quick rentals
ALTER TABLE gear_rental_quotes
ALTER COLUMN request_id DROP NOT NULL;

-- Add contact as an alternative to client_org on rental orders (for walk-in customers)
ALTER TABLE gear_rental_orders
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES gear_organization_contacts(id);

-- Add contact to rental quotes as well
ALTER TABLE gear_rental_quotes
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES gear_organization_contacts(id);

-- Make client_org_id nullable on rental orders (contact can be alternative)
ALTER TABLE gear_rental_orders
ALTER COLUMN client_org_id DROP NOT NULL;

-- Add constraint: must have either client_org_id or contact_id
ALTER TABLE gear_rental_orders
DROP CONSTRAINT IF EXISTS rental_orders_client_check;

ALTER TABLE gear_rental_orders
ADD CONSTRAINT rental_orders_client_check
CHECK (client_org_id IS NOT NULL OR contact_id IS NOT NULL);

-- Link rental orders to transactions
ALTER TABLE gear_rental_orders
ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES gear_transactions(id);

-- Link rental orders to invoices (for Phase 3)
ALTER TABLE gear_rental_orders
ADD COLUMN IF NOT EXISTS backlot_invoice_id UUID REFERENCES backlot_invoices(id);

-- Payment tracking table
CREATE TABLE IF NOT EXISTS gear_rental_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES gear_rental_orders(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES backlot_invoices(id),

    -- Payment details
    amount DECIMAL(12, 2) NOT NULL,
    payment_method TEXT, -- cash, card, check, transfer, invoice
    payment_reference TEXT, -- transaction ID, check number, etc.
    payment_date TIMESTAMPTZ DEFAULT NOW(),

    -- Recorded by
    recorded_by UUID REFERENCES profiles(id),
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_rental_payments_order ON gear_rental_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_gear_rental_payments_invoice ON gear_rental_payments(invoice_id) WHERE invoice_id IS NOT NULL;

-- Add indexes for contact lookups on orders
CREATE INDEX IF NOT EXISTS idx_gear_rental_orders_contact ON gear_rental_orders(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_rental_quotes_contact ON gear_rental_quotes(contact_id) WHERE contact_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN gear_rental_quotes.request_id IS 'Optional - NULL for POS quick rentals';
COMMENT ON COLUMN gear_rental_orders.contact_id IS 'External contact customer (alternative to client_org_id for walk-in rentals)';
COMMENT ON COLUMN gear_rental_orders.transaction_id IS 'The gear checkout transaction for this rental';
COMMENT ON COLUMN gear_rental_orders.backlot_invoice_id IS 'Linked invoice for billing';
COMMENT ON TABLE gear_rental_payments IS 'Tracks payments against rental orders';
