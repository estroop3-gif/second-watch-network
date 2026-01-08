-- Migration 117: Work Order Staging Verification Settings
-- Adds configurable verification methods for staging work order items

-- Add work order staging verification settings to gear_organization_settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS work_order_staging_verify_method TEXT DEFAULT 'checkoff_only'
  CHECK (work_order_staging_verify_method IN ('checkoff_only', 'barcode_required', 'qr_required', 'scan_or_checkoff')),
ADD COLUMN IF NOT EXISTS work_order_auto_ready BOOLEAN DEFAULT TRUE;

-- Comments:
-- work_order_staging_verify_method: Controls how items are marked as staged
--   'checkoff_only' - Simple checkbox (default)
--   'barcode_required' - Must scan item's barcode
--   'qr_required' - Must scan item's QR code
--   'scan_or_checkoff' - Either scanning or checkbox works
--
-- work_order_auto_ready: When true (default), work order automatically
--   transitions to 'ready' status once all items are staged
