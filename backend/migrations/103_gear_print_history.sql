-- =============================================================================
-- Migration 103: Gear Label Print History
-- =============================================================================
-- Tracks all label printing activity for analytics and reprint functionality.
-- Stores denormalized data so history remains intact even if items are deleted.
-- =============================================================================

-- Print history table
CREATE TABLE IF NOT EXISTS gear_label_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

  -- Item Reference (nullable for history preservation)
  asset_id UUID REFERENCES gear_assets(id) ON DELETE SET NULL,
  kit_id UUID REFERENCES gear_kit_instances(id) ON DELETE SET NULL,

  -- Denormalized item data (preserved even if item deleted)
  item_name TEXT NOT NULL,
  item_internal_id TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('asset', 'kit')),
  item_category TEXT,

  -- Template Reference
  template_id UUID REFERENCES gear_label_templates(id) ON DELETE SET NULL,
  template_name TEXT,

  -- Print Settings Used (denormalized for history)
  label_size TEXT NOT NULL,
  print_mode TEXT NOT NULL,
  printer_type TEXT NOT NULL,
  code_type TEXT NOT NULL,

  -- Print Details
  quantity INTEGER NOT NULL DEFAULT 1,
  included_kit_contents BOOLEAN DEFAULT FALSE,

  -- Code Generation (if codes were auto-generated)
  barcode_generated TEXT,
  qr_code_generated TEXT,

  -- Metadata
  printed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_gear_print_history_org
  ON gear_label_print_history(organization_id, printed_at DESC);

CREATE INDEX IF NOT EXISTS idx_gear_print_history_user
  ON gear_label_print_history(user_id, printed_at DESC);

CREATE INDEX IF NOT EXISTS idx_gear_print_history_asset
  ON gear_label_print_history(asset_id)
  WHERE asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_print_history_kit
  ON gear_label_print_history(kit_id)
  WHERE kit_id IS NOT NULL;

-- Index for analytics queries (using printed_at directly, can filter by month in queries)
CREATE INDEX IF NOT EXISTS idx_gear_print_history_date
  ON gear_label_print_history(organization_id, printed_at);

-- Comments
COMMENT ON TABLE gear_label_print_history IS 'Complete history of all label prints for analytics and reprinting';
COMMENT ON COLUMN gear_label_print_history.item_name IS 'Stored item name at time of print (preserved if item deleted)';
COMMENT ON COLUMN gear_label_print_history.template_name IS 'Template name at time of print (preserved if template deleted)';
COMMENT ON COLUMN gear_label_print_history.barcode_generated IS 'If barcode was auto-generated during print, stored here';
COMMENT ON COLUMN gear_label_print_history.qr_code_generated IS 'If QR code was auto-generated during print, stored here';
