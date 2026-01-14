-- Migration: 161_gear_cart_and_work_order_requests.sql
-- Description: Add tables for persistent gear cart and work order request system
-- Date: 2026-01-12

-- ============================================================================
-- GEAR CART ITEMS
-- Persistent shopping cart for gear rentals
-- ============================================================================

CREATE TABLE gear_cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES gear_marketplace_listings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  backlot_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One entry per listing per user
  UNIQUE(profile_id, listing_id)
);

-- Indexes for cart queries
CREATE INDEX idx_gear_cart_items_profile ON gear_cart_items(profile_id);
CREATE INDEX idx_gear_cart_items_listing ON gear_cart_items(listing_id);
CREATE INDEX idx_gear_cart_items_organization ON gear_cart_items(organization_id);
CREATE INDEX idx_gear_cart_items_project ON gear_cart_items(backlot_project_id) WHERE backlot_project_id IS NOT NULL;

-- ============================================================================
-- GEAR WORK ORDER REQUESTS
-- Requests from renters to gear houses (pending approval)
-- ============================================================================

CREATE TABLE gear_work_order_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number VARCHAR(50),

  -- Parties
  requesting_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requesting_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  gear_house_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  backlot_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,

  -- Request details
  title VARCHAR(255),
  notes TEXT,
  rental_start_date DATE,
  rental_end_date DATE,

  -- Status: pending, approved, rejected
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Approval tracking
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Created work order (on approval)
  created_work_order_id UUID REFERENCES gear_work_orders(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for request queries
CREATE INDEX idx_gear_work_order_requests_requesting_profile ON gear_work_order_requests(requesting_profile_id);
CREATE INDEX idx_gear_work_order_requests_gear_house ON gear_work_order_requests(gear_house_org_id);
CREATE INDEX idx_gear_work_order_requests_status ON gear_work_order_requests(status);
CREATE INDEX idx_gear_work_order_requests_project ON gear_work_order_requests(backlot_project_id) WHERE backlot_project_id IS NOT NULL;

-- ============================================================================
-- GEAR WORK ORDER REQUEST ITEMS
-- Items included in a work order request
-- ============================================================================

CREATE TABLE gear_work_order_request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES gear_work_order_requests(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES gear_marketplace_listings(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES gear_assets(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  daily_rate NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for request items
CREATE INDEX idx_gear_work_order_request_items_request ON gear_work_order_request_items(request_id);
CREATE INDEX idx_gear_work_order_request_items_listing ON gear_work_order_request_items(listing_id);

-- ============================================================================
-- SEQUENCE FOR REFERENCE NUMBERS
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS gear_work_order_request_ref_seq START WITH 1000;

-- Function to generate reference number on insert
CREATE OR REPLACE FUNCTION generate_work_order_request_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := 'WOR-' || LPAD(nextval('gear_work_order_request_ref_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gear_work_order_request_ref
  BEFORE INSERT ON gear_work_order_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_work_order_request_ref();

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_gear_cart_items_updated_at
  BEFORE UPDATE ON gear_cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gear_work_order_requests_updated_at
  BEFORE UPDATE ON gear_work_order_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Note: RLS policies commented out as backend uses service-level access
-- Uncomment and adjust if using Supabase client-side access
-- ============================================================================

-- RLS can be enabled manually if needed:
-- ALTER TABLE gear_cart_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE gear_work_order_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE gear_work_order_request_items ENABLE ROW LEVEL SECURITY;

-- Grant access for backend operations (only if service_role exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON gear_cart_items TO service_role';
    EXECUTE 'GRANT ALL ON gear_work_order_requests TO service_role';
    EXECUTE 'GRANT ALL ON gear_work_order_request_items TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE gear_work_order_request_ref_seq TO service_role';
  END IF;
END
$$;
