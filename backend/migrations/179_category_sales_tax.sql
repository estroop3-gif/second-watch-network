-- Migration: Add sales tax fields to budget categories and line items
-- Allows per-category tax configuration with auto-calculated tax line items

-- Add tax fields to categories
ALTER TABLE backlot_budget_categories
ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 4) DEFAULT 0;

-- Add flag to identify auto-generated tax line items
ALTER TABLE backlot_budget_line_items
ADD COLUMN IF NOT EXISTS is_tax_line_item BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_source_category_id UUID REFERENCES backlot_budget_categories(id) ON DELETE CASCADE;

-- Index for finding tax line items by source category
CREATE INDEX IF NOT EXISTS idx_line_items_tax_source ON backlot_budget_line_items(tax_source_category_id) WHERE is_tax_line_item = TRUE;

-- Comment for documentation
COMMENT ON COLUMN backlot_budget_categories.is_taxable IS 'Whether this category should include sales tax calculation';
COMMENT ON COLUMN backlot_budget_categories.tax_rate IS 'Tax rate as decimal (e.g., 0.0825 for 8.25%)';
COMMENT ON COLUMN backlot_budget_line_items.is_tax_line_item IS 'True if this is an auto-generated tax line item';
COMMENT ON COLUMN backlot_budget_line_items.tax_source_category_id IS 'Reference to the category this tax line item belongs to';
