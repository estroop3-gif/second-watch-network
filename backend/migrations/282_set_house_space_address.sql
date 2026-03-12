-- Migration 282: Add address fields to set_house_spaces
-- Allows spaces to store a full address with option to hide it on marketplace listings,
-- showing only city/state as a general location instead.

ALTER TABLE set_house_spaces
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS hide_address BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN set_house_spaces.hide_address IS 'When true, marketplace listings show only city/state instead of full address';
