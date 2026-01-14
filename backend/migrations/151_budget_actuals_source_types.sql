-- Migration 151: Extend budget actuals source types and add deduplication
-- This allows tracking all expense types (mileage, kit_rental, per_diem, purchase_order, invoice_line_item)
-- and prevents double-counting with a unique constraint on source_type + source_id

-- Drop any existing check constraint on source_type
ALTER TABLE backlot_budget_actuals
DROP CONSTRAINT IF EXISTS backlot_budget_actuals_source_type_check;

-- Add new check constraint with all source types
ALTER TABLE backlot_budget_actuals
ADD CONSTRAINT backlot_budget_actuals_source_type_check
CHECK (source_type IN ('receipt', 'mileage', 'kit_rental', 'per_diem', 'purchase_order', 'invoice_line_item', 'manual'));

-- Prevent double-counting: unique constraint on source_type + source_id (partial, where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_actuals_unique_source
ON backlot_budget_actuals(source_type, source_id)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- Add budget_id column for easier querying if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backlot_budget_actuals' AND column_name = 'budget_id'
    ) THEN
        ALTER TABLE backlot_budget_actuals
        ADD COLUMN budget_id UUID REFERENCES backlot_budgets(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for budget-level queries
CREATE INDEX IF NOT EXISTS idx_budget_actuals_budget ON backlot_budget_actuals(budget_id);

-- Create index for project + source queries
CREATE INDEX IF NOT EXISTS idx_budget_actuals_project_source ON backlot_budget_actuals(project_id, source_type);

COMMENT ON TABLE backlot_budget_actuals IS 'Tracks actual budget spend from approved expenses, invoices, and manual entries. source_type/source_id uniqueness prevents double-counting.';
COMMENT ON COLUMN backlot_budget_actuals.source_type IS 'Type of source: receipt, mileage, kit_rental, per_diem, purchase_order, invoice_line_item, manual';
COMMENT ON COLUMN backlot_budget_actuals.source_id IS 'ID of the source record (receipt_id, mileage_id, etc.)';
COMMENT ON COLUMN backlot_budget_actuals.budget_id IS 'Direct link to budget for easier aggregation queries';
