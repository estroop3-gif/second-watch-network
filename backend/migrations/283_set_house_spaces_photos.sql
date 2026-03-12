-- Migration 283: Add photos column to set_house_spaces
-- The quick-add endpoint was inserting photos but the column was missing.

ALTER TABLE set_house_spaces
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
