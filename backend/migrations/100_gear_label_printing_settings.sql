-- Migration 100: Add label printing settings to gear_organization_settings
-- Adds columns for configuring batch label printing preferences

-- Label size and printing mode defaults
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS default_label_size TEXT DEFAULT '2x1';

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS default_print_mode TEXT DEFAULT 'sheet';

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS default_printer_type TEXT DEFAULT 'generic';

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS default_code_type TEXT DEFAULT 'both';

-- Sheet mode configuration
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS sheet_rows INTEGER DEFAULT 10;

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS sheet_columns INTEGER DEFAULT 3;

-- Custom label size (in mm)
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS custom_label_width_mm DECIMAL(6,2);

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS custom_label_height_mm DECIMAL(6,2);

-- Add comments for documentation
COMMENT ON COLUMN gear_organization_settings.default_label_size IS 'Default label size: 2x1, 1.5x0.5, 3x2, or custom';
COMMENT ON COLUMN gear_organization_settings.default_print_mode IS 'Default print mode: sheet or roll';
COMMENT ON COLUMN gear_organization_settings.default_printer_type IS 'Default printer: generic, zebra, dymo, or brother';
COMMENT ON COLUMN gear_organization_settings.default_code_type IS 'Default code type: barcode, qr, or both';
COMMENT ON COLUMN gear_organization_settings.sheet_rows IS 'Number of rows for sheet printing';
COMMENT ON COLUMN gear_organization_settings.sheet_columns IS 'Number of columns for sheet printing';
COMMENT ON COLUMN gear_organization_settings.custom_label_width_mm IS 'Custom label width in millimeters';
COMMENT ON COLUMN gear_organization_settings.custom_label_height_mm IS 'Custom label height in millimeters';
