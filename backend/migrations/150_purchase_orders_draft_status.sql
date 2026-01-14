-- Migration 150: Add draft and denied statuses to purchase orders
-- This enables the draft→approval workflow for purchase orders

ALTER TABLE backlot_purchase_orders
DROP CONSTRAINT IF EXISTS backlot_purchase_orders_status_check;

ALTER TABLE backlot_purchase_orders
ADD CONSTRAINT backlot_purchase_orders_status_check
CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled', 'denied'));

COMMENT ON COLUMN backlot_purchase_orders.status IS 'draft=saved but not submitted, pending=awaiting approval, approved=approved, rejected=can resubmit, denied=permanent denial, completed=finished, cancelled=cancelled';
