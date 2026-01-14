-- Add submitter tracking to budget actuals for grouping
-- This allows us to group expenses by who submitted them (e.g., "Parker's Per Diem")

ALTER TABLE backlot_budget_actuals
ADD COLUMN IF NOT EXISTS submitter_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitter_name TEXT;

CREATE INDEX IF NOT EXISTS idx_budget_actuals_submitter
ON backlot_budget_actuals(submitter_user_id)
WHERE submitter_user_id IS NOT NULL;

COMMENT ON COLUMN backlot_budget_actuals.submitter_user_id IS 'User who submitted the original expense';
COMMENT ON COLUMN backlot_budget_actuals.submitter_name IS 'Cached name of submitter for display';
