-- Migration 156: Create expense audit log for tracking changes to expenses
-- Tracks all modifications to expense items for full audit trail

CREATE TABLE IF NOT EXISTS expense_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,  -- 'created', 'updated', 'submitted', 'approved', 'rejected', 'reimbursed', 'notes_added', 'receipt_added', 'receipt_removed'
    target_type TEXT NOT NULL,  -- 'mileage', 'kit_rental', 'per_diem', 'receipt', 'purchase_order', 'budget_actual'
    target_id UUID NOT NULL,
    previous_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_expense_audit_target ON expense_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_expense_audit_project ON expense_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_audit_user ON expense_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_audit_created ON expense_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_audit_action ON expense_audit_log(action);

-- Composite index for filtering by project and target
CREATE INDEX IF NOT EXISTS idx_expense_audit_project_target
ON expense_audit_log(project_id, target_type, target_id);

COMMENT ON TABLE expense_audit_log IS 'Tracks all changes to expense items for audit trail';
COMMENT ON COLUMN expense_audit_log.action IS 'Type of action: created, updated, submitted, approved, rejected, reimbursed, notes_added, receipt_added, receipt_removed';
COMMENT ON COLUMN expense_audit_log.target_type IS 'Type of expense: mileage, kit_rental, per_diem, receipt, purchase_order, budget_actual';
COMMENT ON COLUMN expense_audit_log.previous_values IS 'JSON object containing previous field values before change';
COMMENT ON COLUMN expense_audit_log.new_values IS 'JSON object containing new field values after change';
