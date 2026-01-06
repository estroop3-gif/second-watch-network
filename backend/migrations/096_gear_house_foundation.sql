-- =============================================================================
-- Migration 096: Gear House Foundation
-- =============================================================================
-- Implements the Gear House module as a separate bounded context:
-- - Platform-wide organizations (shared across modules)
-- - Gear House core tables (assets, kits, transactions, conditions, incidents, repairs, strikes)
-- - Backlot integration hooks
-- =============================================================================

-- =============================================================================
-- PART 1: PLATFORM-WIDE ORGANIZATIONS
-- =============================================================================

-- Organization types enum
DO $$ BEGIN
  CREATE TYPE organization_type AS ENUM (
    'production_company',
    'rental_house',
    'hybrid',
    'studio',
    'agency',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organization status enum
DO $$ BEGIN
  CREATE TYPE organization_status AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending_verification'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organization member roles enum
DO $$ BEGIN
  CREATE TYPE organization_member_role AS ENUM (
    'owner',
    'admin',
    'manager',
    'member',
    'contractor',
    'client'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organizations table (platform-wide)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  org_type organization_type NOT NULL DEFAULT 'production_company',
  status organization_status NOT NULL DEFAULT 'active',

  -- Contact
  email TEXT,
  phone TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Branding
  logo_url TEXT,
  banner_url TEXT,

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Role & Permissions
  role organization_member_role NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}', -- Fine-grained permission overrides

  -- Profile within org
  title TEXT,
  department TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

-- =============================================================================
-- PART 2: GEAR HOUSE ENUMS
-- =============================================================================

-- Asset types
DO $$ BEGIN
  CREATE TYPE gear_asset_type AS ENUM (
    'serialized',      -- Individually tracked items
    'consumable',      -- Lots with quantities (tape, gels, etc.)
    'expendable',      -- Like consumables but with return/billing logic
    'component'        -- Trackable individually and as part of kits
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Asset status
DO $$ BEGIN
  CREATE TYPE gear_asset_status AS ENUM (
    'available',
    'reserved',
    'checked_out',
    'in_transit',
    'quarantined',
    'under_repair',
    'retired',
    'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Transaction types
DO $$ BEGIN
  CREATE TYPE gear_transaction_type AS ENUM (
    'internal_checkout',
    'internal_checkin',
    'transfer',
    'rental_reservation',
    'rental_pickup',
    'rental_return',
    'write_off',
    'maintenance_send',
    'maintenance_return',
    'inventory_adjustment',
    'initial_intake'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Scan mode requirements
DO $$ BEGIN
  CREATE TYPE gear_scan_mode AS ENUM (
    'case_only',       -- Trust case scan
    'case_plus_items', -- Scan case, then items
    'items_required'   -- Must scan every item
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Condition grades
DO $$ BEGIN
  CREATE TYPE gear_condition_grade AS ENUM (
    'excellent',
    'good',
    'fair',
    'poor',
    'damaged',
    'non_functional'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Damage tiers
DO $$ BEGIN
  CREATE TYPE gear_damage_tier AS ENUM (
    'cosmetic',
    'functional',
    'unsafe',
    'out_of_service'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Incident types
DO $$ BEGIN
  CREATE TYPE gear_incident_type AS ENUM (
    'damage',
    'missing_item',
    'late_return',
    'policy_violation',
    'unsafe_behavior'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Repair ticket status
DO $$ BEGIN
  CREATE TYPE gear_repair_status AS ENUM (
    'open',
    'diagnosing',
    'awaiting_approval',
    'in_repair',
    'ready_for_qc',
    'closed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Strike severity
DO $$ BEGIN
  CREATE TYPE gear_strike_severity AS ENUM (
    'warning',
    'minor',
    'major',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rental request status
DO $$ BEGIN
  CREATE TYPE gear_request_status AS ENUM (
    'draft',
    'submitted',
    'quoted',
    'approved',
    'rejected',
    'cancelled',
    'converted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rental order status
DO $$ BEGIN
  CREATE TYPE gear_order_status AS ENUM (
    'draft',
    'confirmed',
    'building',
    'packed',
    'ready_for_pickup',
    'picked_up',
    'in_use',
    'returned',
    'reconciling',
    'closed',
    'cancelled',
    'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Consumable return condition
DO $$ BEGIN
  CREATE TYPE gear_consumable_condition AS ENUM (
    'untouched',
    'opened',
    'partially_used',
    'fully_used'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 3: GEAR HOUSE CORE TABLES
-- =============================================================================

-- Gear organization settings (extends organizations for gear-specific config)
CREATE TABLE IF NOT EXISTS gear_organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,

  -- Barcode/QR Settings
  barcode_format TEXT DEFAULT 'CODE128', -- CODE128, CODE39, EAN13, etc.
  qr_enabled BOOLEAN DEFAULT TRUE,
  label_prefix TEXT, -- e.g., "RH-" for rental house

  -- Scan Requirements
  default_scan_mode gear_scan_mode DEFAULT 'case_plus_items',

  -- Photo Requirements
  require_photos_on_intake BOOLEAN DEFAULT TRUE,
  require_photos_on_checkout BOOLEAN DEFAULT FALSE,
  require_photos_on_checkin BOOLEAN DEFAULT TRUE,
  require_photos_on_damage BOOLEAN DEFAULT TRUE,

  -- Signature Requirements
  require_signature_on_handoff BOOLEAN DEFAULT FALSE,
  require_signature_on_return BOOLEAN DEFAULT FALSE,

  -- Strike Rules
  strikes_enabled BOOLEAN DEFAULT TRUE,
  strikes_before_escalation INTEGER DEFAULT 3,
  auto_strike_on_damage BOOLEAN DEFAULT TRUE,
  auto_strike_on_missing BOOLEAN DEFAULT TRUE,

  -- Consumables Policy
  consumables_billing_model TEXT DEFAULT 'charge_dispatch_buyback', -- charge_dispatch_buyback, charge_dispatch_reimburse
  consumables_buyback_rate DECIMAL(5, 2) DEFAULT 0.50, -- 50% buyback

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gear categories (per-org customizable)
CREATE TABLE IF NOT EXISTS gear_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES gear_categories(id),

  -- Display
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Settings
  default_scan_mode gear_scan_mode,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

-- Gear locations (warehouses, stages, vehicles, etc.)
CREATE TABLE IF NOT EXISTS gear_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  location_type TEXT DEFAULT 'warehouse', -- warehouse, stage, vehicle, client_site, other

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Coordinates
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Contact
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- Settings
  is_default_home BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gear vendors (repair shops, rental partners, etc.)
CREATE TABLE IF NOT EXISTS gear_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  vendor_type TEXT DEFAULT 'repair', -- repair, rental, supplier, other

  -- Contact
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Settings
  is_preferred BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 4: ASSETS AND KITS
-- =============================================================================

-- Gear assets (the core asset table)
CREATE TABLE IF NOT EXISTS gear_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  internal_id TEXT NOT NULL, -- Human-readable internal ID (e.g., "CAM-001")
  barcode TEXT,
  qr_code TEXT,
  primary_scan_code TEXT, -- Active scan code (barcode or QR)

  -- Asset Info
  asset_type gear_asset_type NOT NULL DEFAULT 'serialized',
  name TEXT NOT NULL,
  make TEXT,
  model TEXT,
  description TEXT,

  -- Categorization
  category_id UUID REFERENCES gear_categories(id),
  subcategory TEXT,
  tags TEXT[],

  -- Manufacturer Info
  manufacturer_serial TEXT,
  manufacturer_date DATE,
  firmware_version TEXT,

  -- Status & Location
  status gear_asset_status NOT NULL DEFAULT 'available',
  current_location_id UUID REFERENCES gear_locations(id),
  current_custodian_user_id UUID REFERENCES profiles(id),
  default_home_location_id UUID REFERENCES gear_locations(id),

  -- Kit Association
  default_home_kit_id UUID, -- FK added after gear_kit_instances created

  -- For Consumables/Expendables
  quantity_on_hand INTEGER DEFAULT 1,
  quantity_reserved INTEGER DEFAULT 0,
  reorder_point INTEGER,
  unit_of_measure TEXT DEFAULT 'each',
  lot_number TEXT,
  expiration_date DATE,

  -- Purchase/Value Info
  purchase_date DATE,
  purchase_price DECIMAL(12, 2),
  purchase_vendor TEXT,
  current_value DECIMAL(12, 2),
  replacement_cost DECIMAL(12, 2),

  -- Rental Info (for rental house inventory)
  daily_rate DECIMAL(10, 2),
  weekly_rate DECIMAL(10, 2),
  monthly_rate DECIMAL(10, 2),

  -- Insurance
  insurance_policy_id TEXT,
  insured_value DECIMAL(12, 2),

  -- Maintenance
  last_maintenance_date DATE,
  next_maintenance_due DATE,
  maintenance_interval_days INTEGER,
  total_repair_cost DECIMAL(12, 2) DEFAULT 0,

  -- Condition
  current_condition gear_condition_grade DEFAULT 'good',
  condition_notes TEXT,

  -- Photos
  photos_baseline JSONB DEFAULT '[]', -- Array of {url, caption, taken_at}
  photos_current JSONB DEFAULT '[]',

  -- Notes
  notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  UNIQUE(organization_id, internal_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_gear_assets_org ON gear_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_assets_status ON gear_assets(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_gear_assets_barcode ON gear_assets(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_assets_qr ON gear_assets(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_assets_scan_code ON gear_assets(primary_scan_code) WHERE primary_scan_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_assets_custodian ON gear_assets(current_custodian_user_id) WHERE current_custodian_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_assets_category ON gear_assets(category_id);

-- Asset labels (an asset can have multiple labels, one is primary)
CREATE TABLE IF NOT EXISTS gear_asset_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES gear_assets(id) ON DELETE CASCADE,

  label_type TEXT NOT NULL, -- barcode, qr, rfid
  label_value TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,

  -- Print tracking
  last_printed_at TIMESTAMPTZ,
  print_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  UNIQUE(asset_id, label_value)
);

-- Kit templates (reusable packing lists)
CREATE TABLE IF NOT EXISTS gear_kit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES gear_categories(id),

  -- Settings
  scan_mode_required gear_scan_mode DEFAULT 'case_plus_items',
  allow_substitutions BOOLEAN DEFAULT TRUE,

  -- Photos
  reference_photo_url TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Kit template items (what should be in the kit)
CREATE TABLE IF NOT EXISTS gear_kit_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES gear_kit_templates(id) ON DELETE CASCADE,

  -- Item specification (can be specific asset or category-based)
  asset_id UUID REFERENCES gear_assets(id), -- Specific asset
  category_id UUID REFERENCES gear_categories(id), -- Or category
  item_description TEXT, -- Freeform description if neither

  quantity INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT TRUE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Nested kit support
  nested_template_id UUID REFERENCES gear_kit_templates(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kit instances (actual kits, e.g., "FS7 Kit Blue")
CREATE TABLE IF NOT EXISTS gear_kit_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Kit Info
  name TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  template_id UUID REFERENCES gear_kit_templates(id),

  -- Identification
  barcode TEXT,
  qr_code TEXT,
  primary_scan_code TEXT,

  -- Case Info (the container)
  case_asset_id UUID REFERENCES gear_assets(id), -- The case itself is an asset

  -- Status
  status gear_asset_status NOT NULL DEFAULT 'available',
  current_location_id UUID REFERENCES gear_locations(id),
  current_custodian_user_id UUID REFERENCES profiles(id),

  -- Settings
  scan_mode_required gear_scan_mode DEFAULT 'case_plus_items',

  -- Notes
  notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  UNIQUE(organization_id, internal_id)
);

-- Add FK for default_home_kit_id now that gear_kit_instances exists
ALTER TABLE gear_assets
  ADD CONSTRAINT fk_gear_assets_home_kit
  FOREIGN KEY (default_home_kit_id)
  REFERENCES gear_kit_instances(id) ON DELETE SET NULL;

-- Kit membership (assets in kit instances)
CREATE TABLE IF NOT EXISTS gear_kit_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_instance_id UUID NOT NULL REFERENCES gear_kit_instances(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES gear_assets(id) ON DELETE CASCADE,

  -- Position in kit
  slot_name TEXT, -- e.g., "Lens 1", "Battery Slot A"
  sort_order INTEGER DEFAULT 0,

  -- For nested kits
  nested_kit_id UUID REFERENCES gear_kit_instances(id),

  -- Status
  is_present BOOLEAN DEFAULT TRUE, -- Currently in kit
  last_verified_at TIMESTAMPTZ,

  -- Metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),

  UNIQUE(kit_instance_id, asset_id)
);

-- =============================================================================
-- PART 5: TRANSACTIONS (CHAIN OF CUSTODY)
-- =============================================================================

-- Gear transactions (every movement is a transaction)
CREATE TABLE IF NOT EXISTS gear_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Transaction Type
  transaction_type gear_transaction_type NOT NULL,

  -- Counterparty (for rental flows)
  counterparty_org_id UUID REFERENCES organizations(id),

  -- Project Link (Backlot integration)
  backlot_project_id UUID, -- FK added later to avoid circular dependency

  -- People
  initiated_by_user_id UUID NOT NULL REFERENCES profiles(id),
  primary_custodian_user_id UUID REFERENCES profiles(id), -- Who has custody
  secondary_custodian_user_id UUID REFERENCES profiles(id), -- Witness/backup

  -- Destination
  destination_location_id UUID REFERENCES gear_locations(id),
  destination_address JSONB, -- Full address if not a known location

  -- Timing
  scheduled_at TIMESTAMPTZ,
  expected_return_at TIMESTAMPTZ,

  -- Workflow Timestamps
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  packed_at TIMESTAMPTZ,
  handed_off_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,

  -- Scan Requirements
  scan_mode_required gear_scan_mode DEFAULT 'case_plus_items',

  -- Signatures
  initiator_signature_url TEXT,
  custodian_signature_url TEXT,

  -- Reference
  reference_number TEXT, -- External reference (PO, invoice, etc.)
  notes TEXT,

  -- Status (computed from timestamps, but cached for queries)
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for transaction queries
CREATE INDEX IF NOT EXISTS idx_gear_transactions_org ON gear_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_transactions_type ON gear_transactions(organization_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_gear_transactions_custodian ON gear_transactions(primary_custodian_user_id);
CREATE INDEX IF NOT EXISTS idx_gear_transactions_project ON gear_transactions(backlot_project_id) WHERE backlot_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_transactions_status ON gear_transactions(status);

-- Transaction line items (assets in transaction)
CREATE TABLE IF NOT EXISTS gear_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES gear_transactions(id) ON DELETE CASCADE,

  -- Asset or Kit
  asset_id UUID REFERENCES gear_assets(id),
  kit_instance_id UUID REFERENCES gear_kit_instances(id),

  -- For consumables
  quantity INTEGER DEFAULT 1,
  quantity_returned INTEGER,
  consumable_return_condition gear_consumable_condition,

  -- Scan tracking
  scanned_out_at TIMESTAMPTZ,
  scanned_out_by UUID REFERENCES profiles(id),
  scanned_in_at TIMESTAMPTZ,
  scanned_in_by UUID REFERENCES profiles(id),

  -- Condition at checkout/checkin
  condition_out gear_condition_grade,
  condition_in gear_condition_grade,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_asset_or_kit CHECK (
    (asset_id IS NOT NULL AND kit_instance_id IS NULL) OR
    (asset_id IS NULL AND kit_instance_id IS NOT NULL)
  )
);

-- =============================================================================
-- PART 6: CONDITION REPORTS
-- =============================================================================

-- Condition reports (captured at checkpoints)
CREATE TABLE IF NOT EXISTS gear_condition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Context
  transaction_id UUID REFERENCES gear_transactions(id),
  checkpoint_type TEXT NOT NULL, -- checkout, checkin, handoff, on_demand

  -- Who/When
  reported_by_user_id UUID NOT NULL REFERENCES profiles(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),

  -- Overall
  overall_notes TEXT,

  -- Mode used
  scan_mode_used gear_scan_mode,
  photos_captured BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Condition report line items (per-asset condition)
CREATE TABLE IF NOT EXISTS gear_condition_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES gear_condition_reports(id) ON DELETE CASCADE,

  -- Asset
  asset_id UUID NOT NULL REFERENCES gear_assets(id),

  -- Condition
  condition_grade gear_condition_grade NOT NULL,
  notes TEXT,

  -- Damage flags
  has_cosmetic_damage BOOLEAN DEFAULT FALSE,
  has_functional_damage BOOLEAN DEFAULT FALSE,
  is_unsafe BOOLEAN DEFAULT FALSE,

  -- Photos
  photos JSONB DEFAULT '[]', -- Array of {url, caption}

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 7: INCIDENTS AND REPAIR TICKETS
-- =============================================================================

-- Incidents (damage, missing items, etc.)
CREATE TABLE IF NOT EXISTS gear_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Type
  incident_type gear_incident_type NOT NULL,

  -- Context
  transaction_id UUID REFERENCES gear_transactions(id),
  condition_report_id UUID REFERENCES gear_condition_reports(id),

  -- Asset
  asset_id UUID REFERENCES gear_assets(id),
  kit_instance_id UUID REFERENCES gear_kit_instances(id),

  -- Damage specific
  damage_tier gear_damage_tier,
  damage_description TEXT,

  -- Missing item specific
  last_seen_transaction_id UUID REFERENCES gear_transactions(id),
  last_custodian_user_id UUID REFERENCES profiles(id),
  last_seen_at TIMESTAMPTZ,

  -- Investigation
  reported_by_user_id UUID NOT NULL REFERENCES profiles(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to_user_id UUID REFERENCES profiles(id),

  -- Resolution
  status TEXT DEFAULT 'open', -- open, investigating, resolved, closed
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES profiles(id),

  -- Financial
  estimated_cost DECIMAL(12, 2),
  actual_cost DECIMAL(12, 2),

  -- Photos
  photos JSONB DEFAULT '[]',

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_incidents_org ON gear_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_incidents_asset ON gear_incidents(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gear_incidents_status ON gear_incidents(status);

-- Repair tickets
CREATE TABLE IF NOT EXISTS gear_repair_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Asset
  asset_id UUID NOT NULL REFERENCES gear_assets(id),

  -- Source
  incident_id UUID REFERENCES gear_incidents(id),

  -- Ticket Info
  ticket_number TEXT,
  title TEXT NOT NULL,
  description TEXT,

  -- Status
  status gear_repair_status NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent

  -- Vendor
  vendor_id UUID REFERENCES gear_vendors(id),
  vendor_reference TEXT,
  sent_to_vendor_at TIMESTAMPTZ,
  received_from_vendor_at TIMESTAMPTZ,

  -- Diagnosis
  diagnosis TEXT,
  diagnosed_at TIMESTAMPTZ,
  diagnosed_by_user_id UUID REFERENCES profiles(id),

  -- Quote/Cost
  quote_amount DECIMAL(12, 2),
  quote_approved_at TIMESTAMPTZ,
  quote_approved_by_user_id UUID REFERENCES profiles(id),
  parts_cost DECIMAL(12, 2),
  labor_cost DECIMAL(12, 2),
  total_cost DECIMAL(12, 2),

  -- Timeline
  estimated_completion_date DATE,
  actual_completion_date DATE,
  downtime_days INTEGER,

  -- QC
  qc_passed BOOLEAN,
  qc_notes TEXT,
  qc_by_user_id UUID REFERENCES profiles(id),
  qc_at TIMESTAMPTZ,

  -- People
  created_by_user_id UUID NOT NULL REFERENCES profiles(id),
  assigned_to_user_id UUID REFERENCES profiles(id),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_repair_tickets_org ON gear_repair_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_repair_tickets_asset ON gear_repair_tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_gear_repair_tickets_status ON gear_repair_tickets(status);

-- Repair ticket history (audit trail)
CREATE TABLE IF NOT EXISTS gear_repair_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES gear_repair_tickets(id) ON DELETE CASCADE,

  -- Change
  previous_status gear_repair_status,
  new_status gear_repair_status,
  action TEXT NOT NULL, -- status_change, note_added, quote_updated, etc.
  notes TEXT,

  -- Who/When
  changed_by_user_id UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 8: STRIKES AND RULES
-- =============================================================================

-- Strike rules (per-org configuration)
CREATE TABLE IF NOT EXISTS gear_strike_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Trigger
  trigger_type gear_incident_type NOT NULL,
  trigger_damage_tier gear_damage_tier, -- For damage incidents

  -- Action
  strike_severity gear_strike_severity NOT NULL,
  strike_points INTEGER DEFAULT 1,

  -- Conditions
  is_auto_applied BOOLEAN DEFAULT TRUE,
  requires_review BOOLEAN DEFAULT FALSE,

  -- Notes
  description TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User strikes
CREATE TABLE IF NOT EXISTS gear_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- User
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Context
  incident_id UUID REFERENCES gear_incidents(id),
  repair_ticket_id UUID REFERENCES gear_repair_tickets(id),
  transaction_id UUID REFERENCES gear_transactions(id),

  -- Backlot link (optional)
  backlot_project_id UUID,

  -- Strike Info
  severity gear_strike_severity NOT NULL,
  points INTEGER DEFAULT 1,
  reason TEXT NOT NULL,

  -- Auto-applied or manual
  rule_id UUID REFERENCES gear_strike_rules(id),
  is_auto_applied BOOLEAN DEFAULT FALSE,

  -- Photos/Evidence
  photos JSONB DEFAULT '[]',

  -- Review
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by_user_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Expiration (strikes can expire)
  expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  voided_at TIMESTAMPTZ,
  voided_by_user_id UUID REFERENCES profiles(id),
  void_reason TEXT,

  -- Issuer
  issued_by_user_id UUID NOT NULL REFERENCES profiles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_strikes_org ON gear_strikes(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_strikes_user ON gear_strikes(user_id);
CREATE INDEX IF NOT EXISTS idx_gear_strikes_active ON gear_strikes(user_id, is_active) WHERE is_active = TRUE;

-- User escalation status (computed from strikes)
CREATE TABLE IF NOT EXISTS gear_user_escalation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Strike totals
  total_strikes INTEGER DEFAULT 0,
  active_strike_points INTEGER DEFAULT 0,

  -- Escalation
  is_escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,

  -- Manager review required
  requires_manager_review BOOLEAN DEFAULT FALSE,
  reviewed_by_user_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_decision TEXT, -- approved, probation, suspended

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

-- =============================================================================
-- PART 9: RENTAL WORKFLOWS (MVP 2 Foundation)
-- =============================================================================

-- Rental requests (production company → rental house)
CREATE TABLE IF NOT EXISTS gear_rental_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organizations
  requesting_org_id UUID NOT NULL REFERENCES organizations(id),
  rental_house_org_id UUID REFERENCES organizations(id), -- NULL = marketplace/any

  -- Project
  backlot_project_id UUID,
  project_name TEXT, -- Fallback if no Backlot project

  -- Request Info
  request_number TEXT,
  title TEXT NOT NULL,
  description TEXT,

  -- Dates
  rental_start_date DATE NOT NULL,
  rental_end_date DATE NOT NULL,

  -- Delivery
  delivery_location_id UUID REFERENCES gear_locations(id),
  delivery_address JSONB,
  delivery_notes TEXT,

  -- Status
  status gear_request_status NOT NULL DEFAULT 'draft',

  -- Requester
  requested_by_user_id UUID NOT NULL REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental request items (what they want)
CREATE TABLE IF NOT EXISTS gear_rental_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES gear_rental_requests(id) ON DELETE CASCADE,

  -- Specification (specific or category-based)
  asset_id UUID REFERENCES gear_assets(id), -- Specific item wanted
  category_id UUID REFERENCES gear_categories(id), -- Or category
  item_description TEXT, -- Or freeform

  quantity INTEGER DEFAULT 1,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental quotes (rental house → production company)
CREATE TABLE IF NOT EXISTS gear_rental_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES gear_rental_requests(id),

  -- Rental house
  rental_house_org_id UUID NOT NULL REFERENCES organizations(id),

  -- Quote Info
  quote_number TEXT,

  -- Dates (may differ from request)
  rental_start_date DATE NOT NULL,
  rental_end_date DATE NOT NULL,

  -- Pricing
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  insurance_amount DECIMAL(12, 2),
  delivery_fee DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),

  -- Terms
  payment_terms TEXT,
  cancellation_policy TEXT,
  insurance_requirements TEXT,
  damage_policy TEXT,

  -- Status
  status TEXT DEFAULT 'draft', -- draft, sent, approved, rejected, expired

  -- Validity
  valid_until TIMESTAMPTZ,

  -- Soft hold
  inventory_held BOOLEAN DEFAULT FALSE,
  hold_expires_at TIMESTAMPTZ,

  -- Prepared by
  prepared_by_user_id UUID NOT NULL REFERENCES profiles(id),
  sent_at TIMESTAMPTZ,

  -- Approval
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental quote line items
CREATE TABLE IF NOT EXISTS gear_rental_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES gear_rental_quotes(id) ON DELETE CASCADE,
  request_item_id UUID REFERENCES gear_rental_request_items(id),

  -- Asset offered
  asset_id UUID REFERENCES gear_assets(id),
  kit_instance_id UUID REFERENCES gear_kit_instances(id),
  item_description TEXT,

  quantity INTEGER DEFAULT 1,

  -- Pricing
  daily_rate DECIMAL(10, 2),
  weekly_rate DECIMAL(10, 2),
  quoted_rate DECIMAL(10, 2), -- Actual rate being charged
  rate_type TEXT DEFAULT 'daily', -- daily, weekly, flat
  line_total DECIMAL(12, 2),

  -- Substitution
  is_substitution BOOLEAN DEFAULT FALSE,
  substitution_notes TEXT,

  -- Notes
  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental orders (approved quote → order)
CREATE TABLE IF NOT EXISTS gear_rental_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES gear_rental_quotes(id),

  -- Organizations
  rental_house_org_id UUID NOT NULL REFERENCES organizations(id),
  client_org_id UUID NOT NULL REFERENCES organizations(id),

  -- Project
  backlot_project_id UUID,

  -- Order Info
  order_number TEXT UNIQUE,

  -- Dates
  rental_start_date DATE NOT NULL,
  rental_end_date DATE NOT NULL,

  -- Status
  status gear_order_status NOT NULL DEFAULT 'confirmed',

  -- Delivery
  delivery_location_id UUID REFERENCES gear_locations(id),
  delivery_address JSONB,

  -- Pricing (from quote)
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  insurance_amount DECIMAL(12, 2),
  delivery_fee DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),

  -- Adjustments (after reconciliation)
  damage_charges DECIMAL(12, 2) DEFAULT 0,
  late_fees DECIMAL(12, 2) DEFAULT 0,
  consumables_charged DECIMAL(12, 2) DEFAULT 0,
  consumables_credited DECIMAL(12, 2) DEFAULT 0,
  final_amount DECIMAL(12, 2),

  -- Workflow timestamps
  built_at TIMESTAMPTZ,
  built_by_user_id UUID REFERENCES profiles(id),
  packed_at TIMESTAMPTZ,
  packed_by_user_id UUID REFERENCES profiles(id),
  picked_up_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  reconciled_by_user_id UUID REFERENCES profiles(id),
  closed_at TIMESTAMPTZ,

  -- Notes
  build_notes TEXT,
  pack_notes TEXT,
  reconciliation_notes TEXT,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_gear_rental_orders_rental_house ON gear_rental_orders(rental_house_org_id);
CREATE INDEX IF NOT EXISTS idx_gear_rental_orders_client ON gear_rental_orders(client_org_id);
CREATE INDEX IF NOT EXISTS idx_gear_rental_orders_status ON gear_rental_orders(status);
CREATE INDEX IF NOT EXISTS idx_gear_rental_orders_project ON gear_rental_orders(backlot_project_id) WHERE backlot_project_id IS NOT NULL;

-- Rental order items (assigned assets)
CREATE TABLE IF NOT EXISTS gear_rental_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES gear_rental_orders(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES gear_rental_quote_items(id),

  -- Assigned asset
  asset_id UUID REFERENCES gear_assets(id),
  kit_instance_id UUID REFERENCES gear_kit_instances(id),
  item_description TEXT,

  quantity INTEGER DEFAULT 1,

  -- For consumables
  quantity_dispatched INTEGER,
  quantity_returned INTEGER,
  return_condition gear_consumable_condition,

  -- Pricing
  quoted_rate DECIMAL(10, 2),
  line_total DECIMAL(12, 2),

  -- Pack status
  is_packed BOOLEAN DEFAULT FALSE,
  packed_at TIMESTAMPTZ,
  pack_photo_url TEXT,

  -- Checkout/return
  checkout_transaction_id UUID REFERENCES gear_transactions(id),
  return_transaction_id UUID REFERENCES gear_transactions(id),

  -- Notes
  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 10: BACKLOT INTEGRATION
-- =============================================================================

-- Add FK from transactions to backlot_projects (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backlot_projects') THEN
    ALTER TABLE gear_transactions
      ADD CONSTRAINT fk_gear_transactions_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE gear_strikes
      ADD CONSTRAINT fk_gear_strikes_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE gear_rental_requests
      ADD CONSTRAINT fk_gear_rental_requests_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE gear_rental_orders
      ADD CONSTRAINT fk_gear_rental_orders_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backlot project gear links (link projects to gear orders/assets)
CREATE TABLE IF NOT EXISTS backlot_project_gear_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Gear House references
  gear_organization_id UUID REFERENCES organizations(id),
  gear_order_id UUID REFERENCES gear_rental_orders(id),
  gear_transaction_id UUID REFERENCES gear_transactions(id),

  -- Link type
  link_type TEXT NOT NULL, -- rental_order, owned_inventory, transaction

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_gear_links_project ON backlot_project_gear_links(project_id);

-- =============================================================================
-- PART 11: AUDIT LOG
-- =============================================================================

-- Gear audit log (comprehensive audit trail)
CREATE TABLE IF NOT EXISTS gear_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Action
  action TEXT NOT NULL, -- create, update, delete, status_change, checkout, checkin, etc.
  entity_type TEXT NOT NULL, -- asset, kit, transaction, incident, etc.
  entity_id UUID NOT NULL,

  -- Actor
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Details
  previous_state JSONB,
  new_state JSONB,
  changes JSONB, -- Diff of what changed

  -- Context
  transaction_id UUID,
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gear_audit_log_org ON gear_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_gear_audit_log_entity ON gear_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_gear_audit_log_user ON gear_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_gear_audit_log_created ON gear_audit_log(created_at);

-- =============================================================================
-- PART 12: TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Auto-generate internal_id for assets
CREATE OR REPLACE FUNCTION generate_gear_internal_id()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  -- Get prefix from org settings or use default
  SELECT COALESCE(label_prefix, 'GH-') INTO prefix
  FROM gear_organization_settings
  WHERE organization_id = NEW.organization_id;

  IF prefix IS NULL THEN
    prefix := 'GH-';
  END IF;

  -- Get next number for this org
  SELECT COALESCE(MAX(
    CASE
      WHEN internal_id ~ ('^' || prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(internal_id FROM LENGTH(prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM gear_assets
  WHERE organization_id = NEW.organization_id;

  NEW.internal_id := prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only apply trigger if internal_id is not provided
CREATE OR REPLACE FUNCTION maybe_generate_internal_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.internal_id IS NULL OR NEW.internal_id = '' THEN
    RETURN generate_gear_internal_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gear_assets_internal_id ON gear_assets;
CREATE TRIGGER trg_gear_assets_internal_id
  BEFORE INSERT ON gear_assets
  FOR EACH ROW
  WHEN (NEW.internal_id IS NULL OR NEW.internal_id = '')
  EXECUTE FUNCTION generate_gear_internal_id();

-- Auto-quarantine on unsafe damage
CREATE OR REPLACE FUNCTION auto_quarantine_on_damage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.damage_tier IN ('unsafe', 'out_of_service') AND NEW.asset_id IS NOT NULL THEN
    UPDATE gear_assets
    SET status = 'quarantined',
        updated_at = NOW()
    WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gear_incidents_quarantine ON gear_incidents;
CREATE TRIGGER trg_gear_incidents_quarantine
  AFTER INSERT ON gear_incidents
  FOR EACH ROW
  EXECUTE FUNCTION auto_quarantine_on_damage();

-- Update asset status on repair ticket status change
CREATE OR REPLACE FUNCTION update_asset_on_repair_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- Asset goes under repair when ticket opens
    IF NEW.status IN ('open', 'diagnosing', 'awaiting_approval', 'in_repair') THEN
      UPDATE gear_assets
      SET status = 'under_repair',
          updated_at = NOW()
      WHERE id = NEW.asset_id AND status != 'under_repair';
    -- Asset becomes available after QC passes
    ELSIF NEW.status = 'closed' AND NEW.qc_passed = TRUE THEN
      UPDATE gear_assets
      SET status = 'available',
          last_maintenance_date = NOW(),
          total_repair_cost = COALESCE(total_repair_cost, 0) + COALESCE(NEW.total_cost, 0),
          updated_at = NOW()
      WHERE id = NEW.asset_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gear_repair_ticket_status ON gear_repair_tickets;
CREATE TRIGGER trg_gear_repair_ticket_status
  AFTER UPDATE ON gear_repair_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_on_repair_status();

-- Updated_at triggers for all gear tables
CREATE OR REPLACE FUNCTION gear_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'organizations', 'organization_members', 'gear_organization_settings',
    'gear_categories', 'gear_locations', 'gear_vendors',
    'gear_assets', 'gear_kit_templates', 'gear_kit_instances',
    'gear_transactions', 'gear_incidents', 'gear_repair_tickets',
    'gear_strikes', 'gear_user_escalation_status',
    'gear_rental_requests', 'gear_rental_quotes', 'gear_rental_orders'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION gear_update_timestamp()', tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- PART 13: DEFAULT DATA
-- =============================================================================

-- Insert default gear categories (will be copied to new orgs)
INSERT INTO gear_categories (id, organization_id, name, slug, sort_order)
SELECT
  gen_random_uuid(),
  o.id,
  c.name,
  c.slug,
  c.sort_order
FROM organizations o
CROSS JOIN (VALUES
  ('Camera', 'camera', 1),
  ('Lenses', 'lenses', 2),
  ('Lighting', 'lighting', 3),
  ('Grip', 'grip', 4),
  ('Audio', 'audio', 5),
  ('Monitors', 'monitors', 6),
  ('Power & Batteries', 'power-batteries', 7),
  ('Storage & Media', 'storage-media', 8),
  ('Tripods & Stabilizers', 'tripods-stabilizers', 9),
  ('Accessories', 'accessories', 10),
  ('Expendables', 'expendables', 11),
  ('Other', 'other', 99)
) AS c(name, slug, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM gear_categories gc
  WHERE gc.organization_id = o.id AND gc.slug = c.slug
)
ON CONFLICT DO NOTHING;

-- Insert default strike rules
INSERT INTO gear_strike_rules (id, organization_id, trigger_type, trigger_damage_tier, strike_severity, strike_points, description)
SELECT
  gen_random_uuid(),
  o.id,
  r.trigger_type::gear_incident_type,
  r.trigger_damage_tier::gear_damage_tier,
  r.strike_severity::gear_strike_severity,
  r.strike_points,
  r.description
FROM organizations o
CROSS JOIN (VALUES
  ('damage', 'functional', 'minor', 1, 'Functional damage to equipment'),
  ('damage', 'unsafe', 'major', 2, 'Unsafe equipment condition'),
  ('damage', 'out_of_service', 'critical', 3, 'Equipment rendered out of service'),
  ('missing_item', NULL, 'major', 2, 'Missing equipment item'),
  ('late_return', NULL, 'warning', 0, 'Late equipment return'),
  ('unsafe_behavior', NULL, 'critical', 3, 'Unsafe equipment handling')
) AS r(trigger_type, trigger_damage_tier, strike_severity, strike_points, description)
WHERE NOT EXISTS (
  SELECT 1 FROM gear_strike_rules gsr
  WHERE gsr.organization_id = o.id
    AND gsr.trigger_type = r.trigger_type::gear_incident_type
    AND (gsr.trigger_damage_tier = r.trigger_damage_tier::gear_damage_tier OR (gsr.trigger_damage_tier IS NULL AND r.trigger_damage_tier IS NULL))
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

COMMENT ON TABLE organizations IS 'Platform-wide organizations supporting multi-tenant architecture';
COMMENT ON TABLE gear_assets IS 'Core asset tracking for Gear House module';
COMMENT ON TABLE gear_transactions IS 'Chain of custody tracking for all gear movements';
COMMENT ON TABLE gear_incidents IS 'Damage, missing items, and other incidents';
COMMENT ON TABLE gear_repair_tickets IS 'Repair workflow management';
COMMENT ON TABLE gear_strikes IS 'User accountability tracking';
