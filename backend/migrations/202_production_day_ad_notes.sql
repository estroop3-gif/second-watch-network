-- Migration: Add AD notes to production days
-- Allows AD notes to persist at the production day level (not just session)

-- ============================================================================
-- Add ad_notes column to backlot_production_days table
-- ============================================================================

ALTER TABLE backlot_production_days
ADD COLUMN IF NOT EXISTS ad_notes TEXT;

COMMENT ON COLUMN backlot_production_days.ad_notes IS 'AD notes for the production day, persists independently of Hot Set sessions';
