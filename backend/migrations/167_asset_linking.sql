-- Migration 167: Asset Linking
-- Adds columns to link dailies and review entries back to standalone assets
-- This enables the "upload once, link to multiple places" workflow

-- Add linked_standalone_asset_id to backlot_dailies
ALTER TABLE backlot_dailies
  ADD COLUMN IF NOT EXISTS linked_standalone_asset_id UUID REFERENCES backlot_standalone_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backlot_dailies_linked_asset
  ON backlot_dailies(linked_standalone_asset_id)
  WHERE linked_standalone_asset_id IS NOT NULL;

-- Add linked_standalone_asset_id to backlot_review_assets
ALTER TABLE backlot_review_assets
  ADD COLUMN IF NOT EXISTS linked_standalone_asset_id UUID REFERENCES backlot_standalone_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backlot_review_assets_linked_asset
  ON backlot_review_assets(linked_standalone_asset_id)
  WHERE linked_standalone_asset_id IS NOT NULL;

-- Add linked_standalone_asset_id to backlot_review_versions
ALTER TABLE backlot_review_versions
  ADD COLUMN IF NOT EXISTS linked_standalone_asset_id UUID REFERENCES backlot_standalone_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backlot_review_versions_linked_asset
  ON backlot_review_versions(linked_standalone_asset_id)
  WHERE linked_standalone_asset_id IS NOT NULL;

-- Add cloud_url to backlot_review_versions if not exists
ALTER TABLE backlot_review_versions
  ADD COLUMN IF NOT EXISTS cloud_url TEXT;
