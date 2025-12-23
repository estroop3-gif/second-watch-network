-- Migration: 047_invoice_auto_sync.sql
-- Description: Add auto-sync support for invoices
-- Created: 2024-12-22

-- ============================================================================
-- ADD AUTO_ADDED FLAG TO LINE ITEMS
-- Track whether items were auto-added on approval vs manually imported
-- ============================================================================

ALTER TABLE backlot_invoice_line_items
  ADD COLUMN IF NOT EXISTS auto_added BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN backlot_invoice_line_items.auto_added IS 'True if item was automatically added upon approval, false if manually imported';

-- ============================================================================
-- ADD PENDING_INVOICE_IMPORT FLAG TO EXPENSE TABLES
-- Track items that were approved but couldn't be auto-added (no draft invoice)
-- ============================================================================

ALTER TABLE backlot_mileage_entries
  ADD COLUMN IF NOT EXISTS pending_invoice_import BOOLEAN DEFAULT FALSE;

ALTER TABLE backlot_kit_rentals
  ADD COLUMN IF NOT EXISTS pending_invoice_import BOOLEAN DEFAULT FALSE;

ALTER TABLE backlot_per_diem
  ADD COLUMN IF NOT EXISTS pending_invoice_import BOOLEAN DEFAULT FALSE;

ALTER TABLE backlot_receipts
  ADD COLUMN IF NOT EXISTS pending_invoice_import BOOLEAN DEFAULT FALSE;

ALTER TABLE backlot_timecards
  ADD COLUMN IF NOT EXISTS pending_invoice_import BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN backlot_mileage_entries.pending_invoice_import IS 'True if approved but not yet added to any invoice (no draft existed at approval time)';
COMMENT ON COLUMN backlot_kit_rentals.pending_invoice_import IS 'True if approved but not yet added to any invoice (no draft existed at approval time)';
COMMENT ON COLUMN backlot_per_diem.pending_invoice_import IS 'True if approved but not yet added to any invoice (no draft existed at approval time)';
COMMENT ON COLUMN backlot_receipts.pending_invoice_import IS 'True if approved but not yet added to any invoice (no draft existed at approval time)';
COMMENT ON COLUMN backlot_timecards.pending_invoice_import IS 'True if approved but not yet added to any invoice (no draft existed at approval time)';
