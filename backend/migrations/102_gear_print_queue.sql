-- =============================================================================
-- Migration 102: Gear Print Queue
-- =============================================================================
-- Persistent print queue for batch label printing.
-- Users can add assets/kits from anywhere and print later from Labels tab.
-- =============================================================================

-- Print queue table
CREATE TABLE IF NOT EXISTS gear_print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Item Reference (one must be set)
  asset_id UUID REFERENCES gear_assets(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES gear_kit_instances(id) ON DELETE CASCADE,

  -- Print Settings
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0 AND quantity <= 100),
  template_id UUID REFERENCES gear_label_templates(id) ON DELETE SET NULL,

  -- Kit-specific options
  include_kit_contents BOOLEAN DEFAULT FALSE,

  -- Metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: exactly one of asset_id or kit_id must be set
  CONSTRAINT queue_item_type CHECK (
    (asset_id IS NOT NULL AND kit_id IS NULL) OR
    (asset_id IS NULL AND kit_id IS NOT NULL)
  ),

  -- Prevent duplicate items in queue for same user
  CONSTRAINT unique_asset_in_queue UNIQUE (user_id, asset_id),
  CONSTRAINT unique_kit_in_queue UNIQUE (user_id, kit_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gear_print_queue_user
  ON gear_print_queue(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_gear_print_queue_asset
  ON gear_print_queue(asset_id) WHERE asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_print_queue_kit
  ON gear_print_queue(kit_id) WHERE kit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_print_queue_added
  ON gear_print_queue(user_id, added_at DESC);

-- Comments
COMMENT ON TABLE gear_print_queue IS 'Persistent print queue for batch label printing in Gear House';
COMMENT ON COLUMN gear_print_queue.quantity IS 'Number of labels to print for this item (1-100)';
COMMENT ON COLUMN gear_print_queue.include_kit_contents IS 'For kits: whether to include contents list on label';
