-- Migration 119: Incident Workflow Enhancement
-- Adds resolution tracking, write-off fields, and purchase request system

-- ============================================================================
-- 1. Add resolution tracking to gear_incidents
-- ============================================================================

-- Resolution type when incident is resolved
ALTER TABLE gear_incidents ADD COLUMN IF NOT EXISTS resolution_type TEXT;
-- Values: 'repaired', 'replaced', 'written_off', 'no_action_needed'

-- Write-off tracking
ALTER TABLE gear_incidents ADD COLUMN IF NOT EXISTS write_off_value DECIMAL(12, 2);
ALTER TABLE gear_incidents ADD COLUMN IF NOT EXISTS write_off_reason TEXT;
ALTER TABLE gear_incidents ADD COLUMN IF NOT EXISTS write_off_at TIMESTAMPTZ;
ALTER TABLE gear_incidents ADD COLUMN IF NOT EXISTS write_off_by_user_id UUID REFERENCES profiles(id);

-- Index for write-off lookups
CREATE INDEX IF NOT EXISTS idx_gear_incidents_write_off
  ON gear_incidents(organization_id, write_off_at)
  WHERE write_off_at IS NOT NULL;

-- ============================================================================
-- 2. Create gear_purchase_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS gear_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Link to incident/asset being replaced
  incident_id UUID REFERENCES gear_incidents(id),
  original_asset_id UUID REFERENCES gear_assets(id),

  -- Request details
  request_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_cost DECIMAL(12, 2),
  quantity INTEGER DEFAULT 1,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ordered', 'received', 'cancelled')),

  -- Approval workflow
  requested_by_user_id UUID NOT NULL REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by_user_id UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Fulfillment tracking
  vendor_name TEXT,
  order_reference TEXT,
  actual_cost DECIMAL(12, 2),
  received_at TIMESTAMPTZ,
  received_by_user_id UUID REFERENCES profiles(id),
  new_asset_id UUID REFERENCES gear_assets(id), -- Link to replacement asset when added

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for purchase requests
CREATE INDEX IF NOT EXISTS idx_gear_purchase_requests_org ON gear_purchase_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_purchase_requests_incident ON gear_purchase_requests(incident_id);
CREATE INDEX IF NOT EXISTS idx_gear_purchase_requests_status ON gear_purchase_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_gear_purchase_requests_requested_by ON gear_purchase_requests(requested_by_user_id);

-- Function to generate request numbers
CREATE OR REPLACE FUNCTION generate_purchase_request_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN request_number ~ '^PR-[0-9]+$'
      THEN CAST(SUBSTRING(request_number FROM 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM gear_purchase_requests
  WHERE organization_id = org_id;

  result := 'PR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Add incident management permission to org settings
-- ============================================================================

ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS incident_management_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'manager'];
-- Roles that can: progress incidents, issue strikes, write-off assets, approve purchase requests

-- ============================================================================
-- 4. Create gear_incident_strikes table for tracking strikes from incidents
-- ============================================================================

-- Link table to track strikes issued from specific incidents
CREATE TABLE IF NOT EXISTS gear_incident_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES gear_incidents(id) ON DELETE CASCADE,
  strike_id UUID NOT NULL REFERENCES gear_strikes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(incident_id, strike_id)
);

CREATE INDEX IF NOT EXISTS idx_gear_incident_strikes_incident ON gear_incident_strikes(incident_id);
CREATE INDEX IF NOT EXISTS idx_gear_incident_strikes_strike ON gear_incident_strikes(strike_id);

-- ============================================================================
-- 5. Trigger for updated_at on purchase_requests
-- ============================================================================

CREATE OR REPLACE FUNCTION update_gear_purchase_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gear_purchase_requests_updated_at ON gear_purchase_requests;
CREATE TRIGGER gear_purchase_requests_updated_at
  BEFORE UPDATE ON gear_purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_gear_purchase_requests_updated_at();
