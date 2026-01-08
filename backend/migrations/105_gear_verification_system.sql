-- Migration 105: Gear Checkout/Check-in Verification System
-- Adds configurable verification requirements for checkout and check-in flows

-- ============================================================================
-- Add verification settings to gear_organization_settings
-- ============================================================================

-- Team Checkout Verification Settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS team_checkout_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS team_checkout_verify_method TEXT DEFAULT 'scan_or_checkoff',
ADD COLUMN IF NOT EXISTS team_checkout_discrepancy_action TEXT DEFAULT 'warn',
ADD COLUMN IF NOT EXISTS team_checkout_kit_verification TEXT DEFAULT 'kit_only';

-- Client Rental Verification Settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS client_checkout_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_checkout_verify_method TEXT DEFAULT 'scan_or_checkoff',
ADD COLUMN IF NOT EXISTS client_checkout_discrepancy_action TEXT DEFAULT 'warn',
ADD COLUMN IF NOT EXISTS client_checkout_kit_verification TEXT DEFAULT 'kit_only';

-- Receiver Verification Settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS receiver_verification_mode TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS receiver_verification_timing TEXT DEFAULT 'same_session';

-- Check-in Verification Settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS checkin_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checkin_verify_method TEXT DEFAULT 'scan_or_checkoff',
ADD COLUMN IF NOT EXISTS checkin_kit_verification TEXT DEFAULT 'kit_only';

-- Add constraints for enum-like fields
ALTER TABLE gear_organization_settings
ADD CONSTRAINT team_checkout_verify_method_check
  CHECK (team_checkout_verify_method IN ('scan_only', 'scan_or_checkoff')),
ADD CONSTRAINT team_checkout_discrepancy_action_check
  CHECK (team_checkout_discrepancy_action IN ('block', 'warn')),
ADD CONSTRAINT team_checkout_kit_verification_check
  CHECK (team_checkout_kit_verification IN ('kit_only', 'verify_contents')),
ADD CONSTRAINT client_checkout_verify_method_check
  CHECK (client_checkout_verify_method IN ('scan_only', 'scan_or_checkoff')),
ADD CONSTRAINT client_checkout_discrepancy_action_check
  CHECK (client_checkout_discrepancy_action IN ('block', 'warn')),
ADD CONSTRAINT client_checkout_kit_verification_check
  CHECK (client_checkout_kit_verification IN ('kit_only', 'verify_contents')),
ADD CONSTRAINT receiver_verification_mode_check
  CHECK (receiver_verification_mode IN ('none', 'signature', 'scan', 'signature_and_scan')),
ADD CONSTRAINT receiver_verification_timing_check
  CHECK (receiver_verification_timing IN ('same_session', 'async_link', 'both')),
ADD CONSTRAINT checkin_verify_method_check
  CHECK (checkin_verify_method IN ('scan_only', 'scan_or_checkoff')),
ADD CONSTRAINT checkin_kit_verification_check
  CHECK (checkin_kit_verification IN ('kit_only', 'verify_contents'));

-- ============================================================================
-- Create verification sessions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES gear_transactions(id) ON DELETE CASCADE,

  -- Session type and status
  verification_type TEXT NOT NULL CHECK (verification_type IN ('sender_verification', 'receiver_verification', 'checkin_verification')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled')),

  -- Async link support
  token TEXT UNIQUE,
  link_sent_to TEXT,
  link_sent_at TIMESTAMPTZ,
  link_expires_at TIMESTAMPTZ,

  -- Verification tracking
  items_to_verify JSONB DEFAULT '[]'::jsonb,
  items_verified JSONB DEFAULT '[]'::jsonb,
  discrepancies JSONB DEFAULT '[]'::jsonb,
  discrepancy_acknowledged BOOLEAN DEFAULT FALSE,

  -- Signature capture
  signature_url TEXT,
  signature_captured_at TIMESTAMPTZ,

  -- Completion tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for verification sessions
CREATE INDEX IF NOT EXISTS idx_gear_verification_sessions_org
  ON gear_verification_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_verification_sessions_transaction
  ON gear_verification_sessions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_gear_verification_sessions_token
  ON gear_verification_sessions(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_verification_sessions_status
  ON gear_verification_sessions(status) WHERE status IN ('pending', 'in_progress');

-- ============================================================================
-- Add verification columns to gear_transactions
-- ============================================================================

-- Sender verification tracking
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS sender_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sender_verification_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sender_verification_session_id UUID REFERENCES gear_verification_sessions(id);

-- Receiver verification tracking
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS receiver_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS receiver_verification_mode TEXT,
ADD COLUMN IF NOT EXISTS receiver_verification_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS receiver_verification_session_id UUID REFERENCES gear_verification_sessions(id);

-- Check-in verification tracking
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS checkin_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checkin_verification_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checkin_verification_session_id UUID REFERENCES gear_verification_sessions(id);

-- Add constraint for receiver_verification_mode
ALTER TABLE gear_transactions
ADD CONSTRAINT transaction_receiver_verification_mode_check
  CHECK (receiver_verification_mode IS NULL OR receiver_verification_mode IN ('none', 'signature', 'scan', 'signature_and_scan'));

-- ============================================================================
-- Trigger to update updated_at on verification sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_gear_verification_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gear_verification_session_updated_at ON gear_verification_sessions;
CREATE TRIGGER gear_verification_session_updated_at
  BEFORE UPDATE ON gear_verification_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_gear_verification_session_timestamp();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE gear_verification_sessions IS 'Tracks verification sessions for checkout/check-in flows';
COMMENT ON COLUMN gear_verification_sessions.verification_type IS 'Type: sender_verification, receiver_verification, checkin_verification';
COMMENT ON COLUMN gear_verification_sessions.items_to_verify IS 'JSON array of items that need verification: [{id, type, name, internal_id, parent_kit_id}]';
COMMENT ON COLUMN gear_verification_sessions.items_verified IS 'JSON array of verified items: [{id, verified_at, verified_by, method}]';
COMMENT ON COLUMN gear_verification_sessions.discrepancies IS 'JSON array of discrepancies found: [{item_id, issue_type, notes}]';
COMMENT ON COLUMN gear_verification_sessions.token IS 'Secure token for async verification links (public access)';

COMMENT ON COLUMN gear_organization_settings.team_checkout_verify_method IS 'scan_only or scan_or_checkoff';
COMMENT ON COLUMN gear_organization_settings.team_checkout_discrepancy_action IS 'block or warn';
COMMENT ON COLUMN gear_organization_settings.team_checkout_kit_verification IS 'kit_only or verify_contents';
COMMENT ON COLUMN gear_organization_settings.receiver_verification_mode IS 'none, signature, scan, or signature_and_scan';
COMMENT ON COLUMN gear_organization_settings.receiver_verification_timing IS 'same_session, async_link, or both';
