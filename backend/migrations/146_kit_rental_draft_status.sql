-- Migration 146: Add 'draft' status to kit rentals
-- This allows kit rentals to start as drafts before being submitted for approval

-- Drop existing status constraint if it exists
ALTER TABLE backlot_kit_rentals DROP CONSTRAINT IF EXISTS backlot_kit_rentals_status_check;

-- Add new constraint that includes 'draft'
ALTER TABLE backlot_kit_rentals ADD CONSTRAINT backlot_kit_rentals_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'denied', 'active', 'completed', 'reimbursed'));

COMMENT ON COLUMN backlot_kit_rentals.status IS 'Status: draft (not submitted), pending (awaiting approval), approved, rejected, denied, active, completed, reimbursed';
