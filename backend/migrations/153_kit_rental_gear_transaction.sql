-- Migration 153: Link kit rentals to gear transactions
-- When a kit rental is approved, a checkout transaction is created in Gear House.
-- This column tracks that relationship.

-- Add gear_transaction_id to track the checkout created on approval
ALTER TABLE backlot_kit_rentals
ADD COLUMN IF NOT EXISTS gear_transaction_id UUID
    REFERENCES gear_transactions(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_kit_rentals_gear_tx
ON backlot_kit_rentals(gear_transaction_id)
WHERE gear_transaction_id IS NOT NULL;

-- Documentation
COMMENT ON COLUMN backlot_kit_rentals.gear_transaction_id IS
    'Gear House checkout transaction created when this kit rental was approved';
