-- Migration 261: Budget Actual Architecture
-- Expands budget_type to support estimate/actual/draft, enforces one actual per project,
-- adds wrap_cost_mode to projects for configurable Hot Set wrap flow.

-- 1. Drop old constraint
ALTER TABLE backlot_budgets DROP CONSTRAINT IF EXISTS backlot_budgets_budget_type_check;

-- 2. Rename 'estimated' → 'estimate' for cleaner naming
UPDATE backlot_budgets SET budget_type = 'estimate' WHERE budget_type = 'estimated' OR budget_type IS NULL;

-- 3. New constraint with three types
ALTER TABLE backlot_budgets ADD CONSTRAINT backlot_budgets_budget_type_check
CHECK (budget_type IN ('estimate', 'actual', 'draft'));

-- 4. One actual budget per project (DB-enforced)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_actual_per_project
ON backlot_budgets(project_id) WHERE budget_type = 'actual';

-- 5. Wrap cost mode on projects
ALTER TABLE backlot_projects ADD COLUMN IF NOT EXISTS wrap_cost_mode VARCHAR(20) DEFAULT 'review';

-- Add constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'backlot_projects_wrap_cost_mode_check'
    ) THEN
        ALTER TABLE backlot_projects ADD CONSTRAINT backlot_projects_wrap_cost_mode_check
        CHECK (wrap_cost_mode IN ('auto', 'review'));
    END IF;
END $$;
