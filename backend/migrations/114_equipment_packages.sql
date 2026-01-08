-- Equipment Packages feature
-- Adds parent_asset_id for asset-based equipment packages (grouping accessories with main assets)

-- Add parent_asset_id for asset-based equipment packages
ALTER TABLE gear_assets
ADD COLUMN IF NOT EXISTS parent_asset_id UUID REFERENCES gear_assets(id) ON DELETE SET NULL;

-- Index for efficient lookup of accessories
CREATE INDEX IF NOT EXISTS idx_gear_assets_parent
ON gear_assets(parent_asset_id) WHERE parent_asset_id IS NOT NULL;

-- Flag to quickly identify assets with accessories (equipment packages)
ALTER TABLE gear_assets
ADD COLUMN IF NOT EXISTS is_equipment_package BOOLEAN DEFAULT FALSE;

-- Index for filtering equipment packages
CREATE INDEX IF NOT EXISTS idx_gear_assets_is_equipment_package
ON gear_assets(is_equipment_package) WHERE is_equipment_package = TRUE;

-- Comment explaining the feature
COMMENT ON COLUMN gear_assets.parent_asset_id IS 'References the parent asset if this is an accessory (e.g., cables, batteries grouped with a camera)';
COMMENT ON COLUMN gear_assets.is_equipment_package IS 'True if this asset has accessories attached to it';
