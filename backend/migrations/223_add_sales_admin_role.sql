-- Migration 223: Add sales_admin role
-- A CRM management role with full CRM access without platform-wide admin access

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_sales_admin BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_sales_admin ON profiles(is_sales_admin) WHERE is_sales_admin = true;
