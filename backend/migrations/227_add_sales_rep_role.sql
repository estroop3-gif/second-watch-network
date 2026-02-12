-- Migration 227: Add sales_rep role
-- Sales representative with broad platform + CRM access (no admin)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_sales_rep BOOLEAN DEFAULT FALSE;

-- Set Mack Aldi's role
UPDATE profiles SET is_sales_rep = true WHERE email = 'mackaldi@yahoo.com';
