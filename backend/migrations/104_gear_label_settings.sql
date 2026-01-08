-- =============================================================================
-- Migration 104: Gear Label Additional Settings
-- =============================================================================
-- Adds organization-level label settings including logo and default behaviors.
-- Note: gear_categories already has a 'color' column for color coding.
-- =============================================================================

-- Add label logo URL to organization settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS label_logo_url TEXT;

-- Add auto-generate code settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS auto_generate_barcode_on_print BOOLEAN DEFAULT TRUE;

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS auto_generate_qr_on_print BOOLEAN DEFAULT TRUE;

-- Add default template settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS default_template_id UUID REFERENCES gear_label_templates(id) ON DELETE SET NULL;

-- Comments
COMMENT ON COLUMN gear_organization_settings.label_logo_url IS 'Default logo to include on labels (can be overridden per template)';
COMMENT ON COLUMN gear_organization_settings.auto_generate_barcode_on_print IS 'Auto-generate barcode for items without one when printing';
COMMENT ON COLUMN gear_organization_settings.auto_generate_qr_on_print IS 'Auto-generate QR code for items without one when printing';
COMMENT ON COLUMN gear_organization_settings.default_template_id IS 'Default label template for the organization';

-- Ensure gear_categories color column has a sensible default
-- (Already exists from migration 096, but let's add a default if null)
UPDATE gear_categories
SET color = '#4C4C4C'
WHERE color IS NULL;
