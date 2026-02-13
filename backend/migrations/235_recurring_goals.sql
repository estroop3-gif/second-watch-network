-- Migration 235: Add recurring goals support
ALTER TABLE crm_sales_goals ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
