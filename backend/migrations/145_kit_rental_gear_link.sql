-- Migration 145: Add Gear House integration to Kit Rentals
-- Allows kit rentals to optionally link to Gear House assets or kits

-- Add gear link fields to kit rentals
ALTER TABLE backlot_kit_rentals
  ADD COLUMN IF NOT EXISTS gear_source_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gear_organization_id UUID,
  ADD COLUMN IF NOT EXISTS gear_asset_id UUID,
  ADD COLUMN IF NOT EXISTS gear_kit_instance_id UUID;

-- Add foreign key constraints (only if referenced tables exist)
DO $$
BEGIN
  -- Check if organizations table exists before adding FK
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_kit_rental_gear_org'
    ) THEN
      ALTER TABLE backlot_kit_rentals
        ADD CONSTRAINT fk_kit_rental_gear_org
        FOREIGN KEY (gear_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Check if gear_assets table exists before adding FK
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gear_assets') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_kit_rental_gear_asset'
    ) THEN
      ALTER TABLE backlot_kit_rentals
        ADD CONSTRAINT fk_kit_rental_gear_asset
        FOREIGN KEY (gear_asset_id) REFERENCES gear_assets(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Check if gear_kit_instances table exists before adding FK
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gear_kit_instances') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_kit_rental_gear_kit'
    ) THEN
      ALTER TABLE backlot_kit_rentals
        ADD CONSTRAINT fk_kit_rental_gear_kit
        FOREIGN KEY (gear_kit_instance_id) REFERENCES gear_kit_instances(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Add check constraint for gear_source_type values
ALTER TABLE backlot_kit_rentals
  DROP CONSTRAINT IF EXISTS chk_kit_rental_gear_source_type;

ALTER TABLE backlot_kit_rentals
  ADD CONSTRAINT chk_kit_rental_gear_source_type
  CHECK (gear_source_type IS NULL OR gear_source_type IN ('asset', 'kit', 'lite'));

-- Add index for gear lookups
CREATE INDEX IF NOT EXISTS idx_kit_rentals_gear_asset ON backlot_kit_rentals(gear_asset_id) WHERE gear_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kit_rentals_gear_kit ON backlot_kit_rentals(gear_kit_instance_id) WHERE gear_kit_instance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kit_rentals_gear_org ON backlot_kit_rentals(gear_organization_id) WHERE gear_organization_id IS NOT NULL;

COMMENT ON COLUMN backlot_kit_rentals.gear_source_type IS 'Source type: asset (Gear House asset), kit (Gear House kit), lite (Personal Gear), or NULL for independent';
COMMENT ON COLUMN backlot_kit_rentals.gear_organization_id IS 'Link to Gear House organization (if from Gear House)';
COMMENT ON COLUMN backlot_kit_rentals.gear_asset_id IS 'Link to Gear House asset (if source_type is asset or lite)';
COMMENT ON COLUMN backlot_kit_rentals.gear_kit_instance_id IS 'Link to Gear House kit instance (if source_type is kit)';
