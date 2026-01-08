-- Migration: 106_gear_checkin_workflow.sql
-- Description: Add check-in workflow settings and transaction fields
-- Date: 2026-01-07

-- ============================================================================
-- CHECK-IN SETTINGS FOR ORGANIZATIONS
-- ============================================================================

-- Check-in permission levels
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS checkin_permission_level TEXT DEFAULT 'anyone';
-- Values: 'anyone', 'custodian_only', 'custodian_and_admins'

-- Add constraint for permission levels
ALTER TABLE gear_organization_settings
DROP CONSTRAINT IF EXISTS checkin_permission_level_check;
ALTER TABLE gear_organization_settings
ADD CONSTRAINT checkin_permission_level_check
  CHECK (checkin_permission_level IN ('anyone', 'custodian_only', 'custodian_and_admins'));

-- Check-in verification settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS checkin_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checkin_verify_method TEXT DEFAULT 'scan_or_checkoff',
ADD COLUMN IF NOT EXISTS checkin_kit_verification TEXT DEFAULT 'kit_only',
ADD COLUMN IF NOT EXISTS checkin_discrepancy_action TEXT DEFAULT 'warn';

-- Add constraints for verification settings
ALTER TABLE gear_organization_settings
DROP CONSTRAINT IF EXISTS checkin_verify_method_check;
ALTER TABLE gear_organization_settings
ADD CONSTRAINT checkin_verify_method_check
  CHECK (checkin_verify_method IN ('scan_only', 'scan_or_checkoff'));

ALTER TABLE gear_organization_settings
DROP CONSTRAINT IF EXISTS checkin_kit_verification_check;
ALTER TABLE gear_organization_settings
ADD CONSTRAINT checkin_kit_verification_check
  CHECK (checkin_kit_verification IN ('kit_only', 'verify_contents'));

ALTER TABLE gear_organization_settings
DROP CONSTRAINT IF EXISTS checkin_discrepancy_action_check;
ALTER TABLE gear_organization_settings
ADD CONSTRAINT checkin_discrepancy_action_check
  CHECK (checkin_discrepancy_action IN ('block', 'warn'));

-- Condition assessment on check-in
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS require_condition_on_checkin BOOLEAN DEFAULT FALSE;

-- Partial return policy
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS partial_return_policy TEXT DEFAULT 'allow';

ALTER TABLE gear_organization_settings
DROP CONSTRAINT IF EXISTS partial_return_policy_check;
ALTER TABLE gear_organization_settings
ADD CONSTRAINT partial_return_policy_check
  CHECK (partial_return_policy IN ('allow', 'warn', 'block'));

-- Late/overdue settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS late_return_auto_incident BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS late_fee_per_day DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_grace_period_hours INTEGER DEFAULT 0;

-- Check-in notification settings
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS notify_on_checkin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_late_return BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_damage_found BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- TRANSACTION FIELDS FOR CHECK-IN TRACKING
-- ============================================================================

-- Check-in location (where items are being returned to)
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS checkin_location_id UUID REFERENCES gear_locations(id);

-- Overdue/late tracking
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS late_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_fee_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_incident_id UUID;

-- Damage charges (for rentals)
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS damage_charge_amount DECIMAL(10,2) DEFAULT 0;

-- Partial return tracking
ALTER TABLE gear_transactions
ADD COLUMN IF NOT EXISTS partial_return BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS items_not_returned INTEGER DEFAULT 0;

-- Add foreign key for late_incident_id if gear_incidents table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gear_incidents') THEN
    ALTER TABLE gear_transactions
    DROP CONSTRAINT IF EXISTS gear_transactions_late_incident_fk;

    ALTER TABLE gear_transactions
    ADD CONSTRAINT gear_transactions_late_incident_fk
      FOREIGN KEY (late_incident_id) REFERENCES gear_incidents(id);
  END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding overdue transactions
CREATE INDEX IF NOT EXISTS idx_gear_transactions_overdue
  ON gear_transactions(organization_id, is_overdue)
  WHERE is_overdue = TRUE;

-- Index for check-in location queries
CREATE INDEX IF NOT EXISTS idx_gear_transactions_checkin_location
  ON gear_transactions(checkin_location_id)
  WHERE checkin_location_id IS NOT NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN gear_organization_settings.checkin_permission_level IS
  'Who can process check-ins: anyone, custodian_only, custodian_and_admins';

COMMENT ON COLUMN gear_organization_settings.checkin_verification_required IS
  'Whether check-in requires verification/scanning of returned items';

COMMENT ON COLUMN gear_organization_settings.require_condition_on_checkin IS
  'Whether condition assessment is required for each returned item';

COMMENT ON COLUMN gear_organization_settings.partial_return_policy IS
  'How to handle partial returns: allow, warn, or block';

COMMENT ON COLUMN gear_organization_settings.late_fee_per_day IS
  'Daily late fee amount for rentals (0 = no late fees)';

COMMENT ON COLUMN gear_organization_settings.late_grace_period_hours IS
  'Grace period in hours before late fees apply';

COMMENT ON COLUMN gear_transactions.checkin_location_id IS
  'Location where items are being returned to (defaults to asset home location)';

COMMENT ON COLUMN gear_transactions.is_overdue IS
  'Whether this transaction was returned late';

COMMENT ON COLUMN gear_transactions.late_days IS
  'Number of days the return was late';

COMMENT ON COLUMN gear_transactions.late_fee_amount IS
  'Total late fee charged (for rentals)';

COMMENT ON COLUMN gear_transactions.partial_return IS
  'Whether this was a partial return (not all items returned)';

COMMENT ON COLUMN gear_transactions.items_not_returned IS
  'Count of items that were not returned (for partial returns)';
