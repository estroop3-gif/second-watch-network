-- Migration 048: Company Card Expenses
-- Adds expense type to receipts and budget actuals tracking

-- Add expense_type to receipts (personal = needs reimbursement, company_card = already paid by company)
ALTER TABLE backlot_receipts
  ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'personal'
  CHECK (expense_type IN ('personal', 'company_card'));

-- Add budget linking for company card expenses
ALTER TABLE backlot_receipts
  ADD COLUMN IF NOT EXISTS budget_category_id UUID REFERENCES backlot_budget_categories(id);

ALTER TABLE backlot_receipts
  ADD COLUMN IF NOT EXISTS budget_line_item_id UUID REFERENCES backlot_budget_line_items(id);

-- Create index for filtering by expense type
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_expense_type ON backlot_receipts(project_id, expense_type);

-- Create budget actuals table for tracking actual spend
-- This table aggregates actual spending from receipts, invoices, and manual entries
CREATE TABLE IF NOT EXISTS backlot_budget_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  budget_category_id UUID REFERENCES backlot_budget_categories(id),
  budget_line_item_id UUID REFERENCES backlot_budget_line_items(id),

  -- Source reference (receipt, manual entry, or invoice)
  source_type TEXT CHECK (source_type IN ('receipt', 'manual', 'invoice')),
  source_id UUID,

  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE,
  vendor_name TEXT,
  expense_category TEXT,

  created_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for budget actuals
CREATE INDEX IF NOT EXISTS idx_budget_actuals_project ON backlot_budget_actuals(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_actuals_category ON backlot_budget_actuals(budget_category_id);
CREATE INDEX IF NOT EXISTS idx_budget_actuals_line_item ON backlot_budget_actuals(budget_line_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_actuals_source ON backlot_budget_actuals(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_budget_actuals_date ON backlot_budget_actuals(project_id, expense_date);
