-- Migration 266: Ensure credits table has production_id and description columns
-- These columns are referenced in credits.py and profiles.py but may have been added manually

ALTER TABLE credits ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id) ON DELETE SET NULL;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS description TEXT;
CREATE INDEX IF NOT EXISTS idx_credits_production_id ON credits(production_id);
