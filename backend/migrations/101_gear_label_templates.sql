-- =============================================================================
-- Migration 101: Gear Label Templates
-- =============================================================================
-- Adds label templates system for customizable label printing configurations.
-- Templates can be user-specific or org-wide (shared templates).
-- =============================================================================

-- Label templates table
CREATE TABLE IF NOT EXISTS gear_label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = org-level (shared) template

  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,

  -- Print Settings
  label_size TEXT DEFAULT '2x1',  -- 2x1, 1.5x0.5, 3x2, custom
  print_mode TEXT DEFAULT 'sheet',  -- sheet, roll
  printer_type TEXT DEFAULT 'generic',  -- generic, zebra, dymo, brother
  code_type TEXT DEFAULT 'both',  -- barcode, qr, both

  -- Sheet Mode Settings
  sheet_rows INTEGER DEFAULT 10,
  sheet_columns INTEGER DEFAULT 3,

  -- Custom Size (in mm)
  custom_width_mm DECIMAL(6, 2),
  custom_height_mm DECIMAL(6, 2),

  -- Content Settings (what to include on label)
  include_name BOOLEAN DEFAULT TRUE,
  include_category BOOLEAN DEFAULT TRUE,
  include_internal_id BOOLEAN DEFAULT TRUE,
  include_serial_number BOOLEAN DEFAULT FALSE,
  include_manufacturer BOOLEAN DEFAULT FALSE,
  include_model BOOLEAN DEFAULT FALSE,
  include_purchase_date BOOLEAN DEFAULT FALSE,

  -- Logo Settings
  include_logo BOOLEAN DEFAULT FALSE,
  custom_logo_url TEXT,  -- NULL = use org logo

  -- Color Coding
  color_coding_enabled BOOLEAN DEFAULT FALSE,  -- Uses category colors

  -- Kit Label Settings
  kit_include_contents BOOLEAN DEFAULT FALSE,  -- Include list of kit contents on label
  kit_contents_max_items INTEGER DEFAULT 5,  -- Max items to list

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gear_label_templates_org
  ON gear_label_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_gear_label_templates_user
  ON gear_label_templates(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_label_templates_org_shared
  ON gear_label_templates(organization_id) WHERE user_id IS NULL;

-- Ensure only one default template per user or per org (if user is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gear_label_templates_user_default
  ON gear_label_templates(organization_id, user_id)
  WHERE is_default = TRUE AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gear_label_templates_org_default
  ON gear_label_templates(organization_id)
  WHERE is_default = TRUE AND user_id IS NULL;

-- Comments
COMMENT ON TABLE gear_label_templates IS 'Saved label printing templates for Gear House';
COMMENT ON COLUMN gear_label_templates.user_id IS 'NULL for org-wide shared templates, set for user-specific templates';
COMMENT ON COLUMN gear_label_templates.is_default IS 'If true, this template is auto-selected for new prints';
COMMENT ON COLUMN gear_label_templates.custom_logo_url IS 'Override org logo with custom image; NULL uses org logo';
COMMENT ON COLUMN gear_label_templates.color_coding_enabled IS 'When true, labels use category colors for visual identification';
COMMENT ON COLUMN gear_label_templates.kit_include_contents IS 'For kit labels, include a list of contents on the label';
