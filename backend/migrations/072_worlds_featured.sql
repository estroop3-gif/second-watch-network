-- Migration: 072_worlds_featured.sql
-- Add is_featured column to worlds for dashboard curation

ALTER TABLE worlds ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Index for featured worlds
CREATE INDEX IF NOT EXISTS idx_worlds_featured ON worlds(is_featured) WHERE is_featured = TRUE;

-- Add sort_priority for manual ordering on home page
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS featured_sort_order INTEGER DEFAULT 0;
