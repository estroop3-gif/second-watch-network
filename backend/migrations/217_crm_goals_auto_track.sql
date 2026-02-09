-- Migration 217: Add manual_override column to crm_sales_goals for auto-tracking
-- When non-NULL, manual_override takes precedence over auto-computed value

ALTER TABLE crm_sales_goals ADD COLUMN IF NOT EXISTS manual_override INTEGER DEFAULT NULL;
