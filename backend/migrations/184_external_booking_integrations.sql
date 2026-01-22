-- =============================================================================
-- Migration 184: External Booking Platform Integration for Set House
-- =============================================================================
-- Adds support for integrating external space rental platforms:
-- - Peerspace, Giggster, Splacer, Spacetoco via iCal sync
-- - CSV import for manual bulk import
-- - Tracking external booking IDs on transactions
-- =============================================================================

-- =============================================================================
-- PART 1: EXTERNAL PLATFORM ENUM
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE set_house_external_platform_type AS ENUM (
    'peerspace',
    'giggster',
    'splacer',
    'spacetoco',
    'ical',      -- Generic iCal feed
    'csv',       -- CSV import source
    'manual'     -- Manually entered external booking
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE set_house_sync_status AS ENUM (
    'pending',
    'syncing',
    'success',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 2: EXTERNAL PLATFORM CONNECTIONS
-- =============================================================================

-- External platform connection settings (per org)
CREATE TABLE IF NOT EXISTS set_house_external_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Platform identification
  platform_type TEXT NOT NULL, -- 'peerspace', 'giggster', 'splacer', 'spacetoco', 'ical', 'manual'
  platform_name TEXT NOT NULL, -- Display name (e.g., "My Peerspace Account")

  -- iCal sync configuration
  ical_url TEXT,
  ical_url_hash TEXT, -- SHA256 hash for change detection

  -- Future API support (encrypted at rest)
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  external_org_id TEXT,
  webhook_secret TEXT,

  -- Space mapping (which space does this platform feed apply to)
  default_space_id UUID REFERENCES set_house_spaces(id) ON DELETE SET NULL,
  space_name_mapping JSONB DEFAULT '{}', -- Maps platform location names to space IDs

  -- Sync configuration
  is_active BOOLEAN DEFAULT TRUE,
  sync_frequency_minutes INT DEFAULT 60,
  auto_create_transactions BOOLEAN DEFAULT TRUE, -- Create transactions automatically or just notify

  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
  last_sync_error TEXT,
  last_sync_bookings_found INT DEFAULT 0,
  last_sync_bookings_created INT DEFAULT 0,
  last_sync_bookings_updated INT DEFAULT 0,
  next_sync_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Unique index to prevent duplicate platform connections (allows multiple of same type with different URLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_set_house_external_platforms_unique
  ON set_house_external_platforms(organization_id, platform_type, COALESCE(ical_url, ''), COALESCE(external_org_id, ''));

CREATE INDEX IF NOT EXISTS idx_set_house_external_platforms_org
  ON set_house_external_platforms(organization_id);

CREATE INDEX IF NOT EXISTS idx_set_house_external_platforms_active
  ON set_house_external_platforms(organization_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_set_house_external_platforms_next_sync
  ON set_house_external_platforms(next_sync_at)
  WHERE is_active = TRUE AND next_sync_at IS NOT NULL;

-- =============================================================================
-- PART 3: EXTERNAL BOOKING TRACKING ON TRANSACTIONS
-- =============================================================================

-- Add external tracking fields to transactions
ALTER TABLE set_house_transactions
  ADD COLUMN IF NOT EXISTS external_platform_id UUID REFERENCES set_house_external_platforms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_booking_id TEXT,
  ADD COLUMN IF NOT EXISTS external_booking_url TEXT,
  ADD COLUMN IF NOT EXISTS external_event_uid TEXT, -- iCal UID for deduplication
  ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_external_booking BOOLEAN DEFAULT FALSE;

-- Index for finding transactions by external platform
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_external_platform
  ON set_house_transactions(external_platform_id)
  WHERE external_platform_id IS NOT NULL;

-- Index for deduplication by external booking ID
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_external_booking
  ON set_house_transactions(external_platform_id, external_booking_id)
  WHERE external_booking_id IS NOT NULL;

-- Index for deduplication by iCal UID
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_external_uid
  ON set_house_transactions(organization_id, external_event_uid)
  WHERE external_event_uid IS NOT NULL;

-- =============================================================================
-- PART 4: SYNC LOG
-- =============================================================================

-- Import/sync history log for auditing and debugging
CREATE TABLE IF NOT EXISTS set_house_external_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES set_house_external_platforms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Sync details
  sync_type TEXT NOT NULL, -- 'auto', 'manual', 'ical', 'csv'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'

  -- Sync results
  bookings_found INT DEFAULT 0,
  bookings_created INT DEFAULT 0,
  bookings_updated INT DEFAULT 0,
  bookings_skipped INT DEFAULT 0,
  bookings_errors INT DEFAULT 0,

  -- Error details
  error_message TEXT,
  error_details JSONB DEFAULT '{}',

  -- Detailed results for each booking processed
  sync_details JSONB DEFAULT '[]', -- Array of {external_id, action, error, transaction_id}

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Who triggered it
  triggered_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_sync_log_platform
  ON set_house_external_sync_log(platform_id);

CREATE INDEX IF NOT EXISTS idx_set_house_sync_log_org
  ON set_house_external_sync_log(organization_id);

CREATE INDEX IF NOT EXISTS idx_set_house_sync_log_started
  ON set_house_external_sync_log(started_at DESC);

-- =============================================================================
-- PART 5: CSV IMPORT TEMPLATES
-- =============================================================================

-- Store CSV import templates for each organization
CREATE TABLE IF NOT EXISTS set_house_csv_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL DEFAULT 'Default Template',
  description TEXT,

  -- Column mappings
  column_mappings JSONB NOT NULL DEFAULT '{}',
  -- Example: {
  --   "external_booking_id": "Booking ID",
  --   "client_name": "Customer Name",
  --   "start_date": "Check-in Date",
  --   "end_date": "Check-out Date",
  --   "space_name": "Location",
  --   "total_amount": "Total",
  --   "notes": "Notes"
  -- }

  -- Date/time format settings
  date_format TEXT DEFAULT 'YYYY-MM-DD', -- e.g., 'MM/DD/YYYY', 'DD-MM-YYYY'
  time_format TEXT DEFAULT 'HH:mm', -- e.g., 'hh:mm A', 'HH:mm:ss'
  timezone TEXT DEFAULT 'UTC',

  -- CSV parsing settings
  delimiter TEXT DEFAULT ',',
  has_header_row BOOLEAN DEFAULT TRUE,
  skip_rows INT DEFAULT 0,

  -- Metadata
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_csv_templates_org
  ON set_house_csv_templates(organization_id);

-- =============================================================================
-- PART 6: TRIGGERS
-- =============================================================================

-- Update updated_at on external_platforms changes
CREATE OR REPLACE FUNCTION update_set_house_external_platforms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_house_external_platforms_updated_at ON set_house_external_platforms;
CREATE TRIGGER set_house_external_platforms_updated_at
  BEFORE UPDATE ON set_house_external_platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_set_house_external_platforms_updated_at();

-- Update updated_at on csv_templates changes
CREATE OR REPLACE FUNCTION update_set_house_csv_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_house_csv_templates_updated_at ON set_house_csv_templates;
CREATE TRIGGER set_house_csv_templates_updated_at
  BEFORE UPDATE ON set_house_csv_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_set_house_csv_templates_updated_at();

-- Calculate sync log duration on completion
CREATE OR REPLACE FUNCTION update_sync_log_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_house_sync_log_duration ON set_house_external_sync_log;
CREATE TRIGGER set_house_sync_log_duration
  BEFORE UPDATE ON set_house_external_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_log_duration();
