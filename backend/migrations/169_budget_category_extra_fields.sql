-- Migration 169: Add professional budget fields to budget categories
-- These fields support more detailed budget categorization for professional productions

ALTER TABLE backlot_budget_categories
    ADD COLUMN IF NOT EXISTS icon VARCHAR(100),
    ADD COLUMN IF NOT EXISTS category_type VARCHAR(50) DEFAULT 'production',
    ADD COLUMN IF NOT EXISTS account_code_prefix VARCHAR(20),
    ADD COLUMN IF NOT EXISTS phase VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_above_the_line BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN backlot_budget_categories.category_type IS 'Category type: development, pre_production, production, post_production, other';
COMMENT ON COLUMN backlot_budget_categories.phase IS 'Production phase this category belongs to';
COMMENT ON COLUMN backlot_budget_categories.is_above_the_line IS 'Whether this is an above-the-line expense category';
