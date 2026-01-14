-- Migration 160: Add changes_requested status and rejection_reason to all expense tables
-- Allows managers to request changes on expenses with a reason

-- Add rejection_reason column to receipts
ALTER TABLE backlot_receipts
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
COMMENT ON COLUMN backlot_receipts.rejection_reason IS 'Reason provided when requesting changes or denying the receipt';

-- Add rejection_reason column to mileage
ALTER TABLE backlot_mileage_entries
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
COMMENT ON COLUMN backlot_mileage_entries.rejection_reason IS 'Reason provided when requesting changes or denying the mileage entry';

-- Add rejection_reason column to kit rentals
ALTER TABLE backlot_kit_rentals
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
COMMENT ON COLUMN backlot_kit_rentals.rejection_reason IS 'Reason provided when requesting changes or denying the kit rental';

-- Add rejection_reason column to purchase orders
ALTER TABLE backlot_purchase_orders
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
COMMENT ON COLUMN backlot_purchase_orders.rejection_reason IS 'Reason provided when requesting changes or denying the purchase order';
