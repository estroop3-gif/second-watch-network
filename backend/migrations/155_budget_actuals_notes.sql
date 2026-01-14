-- Migration 155: Add notes and reimbursement tracking to budget actuals
-- Allows users to add notes to budget actual entries with sync option
-- Also tracks reimbursement status directly on actuals

ALTER TABLE backlot_budget_actuals
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes_synced_to_source BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_reimbursed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reimbursed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reimbursed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for finding reimbursed items
CREATE INDEX IF NOT EXISTS idx_budget_actuals_reimbursed
ON backlot_budget_actuals(is_reimbursed)
WHERE is_reimbursed = TRUE;

COMMENT ON COLUMN backlot_budget_actuals.notes IS 'User notes attached to this budget actual';
COMMENT ON COLUMN backlot_budget_actuals.notes_updated_at IS 'When notes were last modified';
COMMENT ON COLUMN backlot_budget_actuals.notes_synced_to_source IS 'Whether notes have been synced to the source expense';
COMMENT ON COLUMN backlot_budget_actuals.is_reimbursed IS 'Whether this expense has been reimbursed';
COMMENT ON COLUMN backlot_budget_actuals.reimbursed_at IS 'When the expense was marked as reimbursed';
COMMENT ON COLUMN backlot_budget_actuals.reimbursed_by IS 'User who marked the expense as reimbursed';
