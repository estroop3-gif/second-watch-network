-- Migration: 046_invoice_approval_workflow.sql
-- Description: Add approval workflow for invoices
-- Created: 2024-12-22

-- ============================================================================
-- UPDATE STATUS CONSTRAINT
-- Add new statuses: pending_approval, approved, changes_requested
-- ============================================================================

-- Drop existing constraint
ALTER TABLE backlot_invoices DROP CONSTRAINT IF EXISTS backlot_invoices_status_check;

-- Add new constraint with all statuses
ALTER TABLE backlot_invoices ADD CONSTRAINT backlot_invoices_status_check
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'changes_requested', 'sent', 'paid', 'overdue', 'cancelled'));

-- ============================================================================
-- ADD APPROVAL TRACKING COLUMNS
-- ============================================================================

-- When invoice was submitted for approval
ALTER TABLE backlot_invoices ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ;

-- Approval tracking
ALTER TABLE backlot_invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE backlot_invoices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- Changes requested tracking
ALTER TABLE backlot_invoices ADD COLUMN IF NOT EXISTS changes_requested_at TIMESTAMPTZ;
ALTER TABLE backlot_invoices ADD COLUMN IF NOT EXISTS changes_requested_by UUID REFERENCES profiles(id);
ALTER TABLE backlot_invoices ADD COLUMN IF NOT EXISTS change_request_reason TEXT;

-- ============================================================================
-- INDEXES FOR NEW STATUSES
-- ============================================================================

-- Index for manager review queue (pending approval invoices)
CREATE INDEX IF NOT EXISTS idx_backlot_invoices_pending_approval
  ON backlot_invoices(project_id, status) WHERE status = 'pending_approval';

-- Index for approved invoices ready to send
CREATE INDEX IF NOT EXISTS idx_backlot_invoices_approved
  ON backlot_invoices(project_id, status) WHERE status = 'approved';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN backlot_invoices.status IS 'Workflow status: draft=editable, pending_approval=awaiting manager review, approved=ready to send externally, changes_requested=needs revision, sent=submitted to production, paid=payment received, overdue=past due date, cancelled=voided';
COMMENT ON COLUMN backlot_invoices.submitted_for_approval_at IS 'When the invoice was submitted for internal approval';
COMMENT ON COLUMN backlot_invoices.approved_at IS 'When the invoice was approved by a manager';
COMMENT ON COLUMN backlot_invoices.approved_by IS 'Manager who approved the invoice';
COMMENT ON COLUMN backlot_invoices.changes_requested_at IS 'When changes were last requested';
COMMENT ON COLUMN backlot_invoices.changes_requested_by IS 'Manager who requested changes';
COMMENT ON COLUMN backlot_invoices.change_request_reason IS 'Reason/feedback for requested changes';
