-- Migration 152: Add budget_type field to distinguish estimated vs actual budgets
-- 'estimated' = manually created by user in Budget tab (planned costs)
-- 'actual' = auto-created from approved expenses (real costs only)

-- Add budget_type column with default 'estimated' for existing budgets
ALTER TABLE backlot_budgets
ADD COLUMN IF NOT EXISTS budget_type VARCHAR(20) DEFAULT 'estimated';

-- Add check constraint for valid types
ALTER TABLE backlot_budgets
DROP CONSTRAINT IF EXISTS backlot_budgets_budget_type_check;

ALTER TABLE backlot_budgets
ADD CONSTRAINT backlot_budgets_budget_type_check
CHECK (budget_type IN ('estimated', 'actual'));

-- Create index for querying by type
CREATE INDEX IF NOT EXISTS idx_budgets_project_type ON backlot_budgets(project_id, budget_type);

COMMENT ON COLUMN backlot_budgets.budget_type IS 'Budget type: estimated (user-created with planned costs) or actual (auto-created from approved expenses)';
