-- Migration 147: Add 'draft' status to mileage entries
-- This allows mileage entries to start as drafts before being submitted for approval

-- Drop existing status constraint if it exists
ALTER TABLE backlot_mileage_entries DROP CONSTRAINT IF EXISTS backlot_mileage_entries_status_check;

-- Add new constraint that includes 'draft'
ALTER TABLE backlot_mileage_entries ADD CONSTRAINT backlot_mileage_entries_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'denied', 'reimbursed'));

COMMENT ON COLUMN backlot_mileage_entries.status IS 'Status: draft (not submitted), pending (awaiting approval), approved, rejected, denied, reimbursed';
