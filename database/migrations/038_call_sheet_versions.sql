-- Migration 038: Call Sheet Version History
-- Track changes to call sheets over time with ability to revert

-- =====================================================
-- TABLE: backlot_call_sheet_versions
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Full snapshot of call sheet data at this version
  snapshot JSONB NOT NULL,

  -- What changed
  changed_fields TEXT[],
  change_summary TEXT,

  -- Who made the change
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique version numbers per call sheet
  UNIQUE(call_sheet_id, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_sheet_versions_call_sheet ON backlot_call_sheet_versions(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_versions_created_at ON backlot_call_sheet_versions(created_at);

-- Add version tracking columns to call sheets table
ALTER TABLE backlot_call_sheets
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES profiles(id);

-- Index for quick version lookup
CREATE INDEX IF NOT EXISTS idx_call_sheets_current_version ON backlot_call_sheets(current_version);
