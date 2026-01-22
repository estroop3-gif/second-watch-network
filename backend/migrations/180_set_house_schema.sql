-- =============================================================================
-- Migration 180: Set House Foundation
-- =============================================================================
-- Implements the Set House module (studio/location rentals) as a parallel to Gear House:
-- - Set House organization settings
-- - Spaces (rentable studios/locations), packages, transactions
-- - Incidents, repairs, strikes
-- - Marketplace listings, rental workflows
-- - Work orders, verification, labels/printing, cart
-- =============================================================================

-- =============================================================================
-- PART 1: SET HOUSE ENUMS
-- =============================================================================

-- Space types (different from gear assets - focused on rentable spaces)
DO $$ BEGIN
  CREATE TYPE set_house_space_type AS ENUM (
    'sound_stage',      -- Professional sound stages
    'studio',           -- Production studios
    'location',         -- Real-world locations
    'backlot',          -- Outdoor backlot areas
    'green_screen',     -- Green/blue screen stages
    'workshop',         -- Production workshops
    'office',           -- Production offices
    'storage',          -- Storage facilities
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Space status
DO $$ BEGIN
  CREATE TYPE set_house_space_status AS ENUM (
    'available',
    'reserved',
    'booked',
    'under_maintenance',
    'retired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Transaction types for spaces
DO $$ BEGIN
  CREATE TYPE set_house_transaction_type AS ENUM (
    'booking_reservation',
    'booking_confirmed',
    'booking_started',
    'booking_ended',
    'booking_cancelled',
    'maintenance_start',
    'maintenance_end',
    'transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Condition grades for spaces
DO $$ BEGIN
  CREATE TYPE set_house_condition_grade AS ENUM (
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
  CREATE TYPE set_house_damage_tier AS ENUM (
    'cosmetic',
    'functional',
    'unsafe',
    'out_of_service'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Incident types
DO $$ BEGIN
  CREATE TYPE set_house_incident_type AS ENUM (
    'damage',
    'policy_violation',
    'late_checkout',
    'unsafe_behavior',
    'noise_complaint',
    'access_violation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Repair ticket status
DO $$ BEGIN
  CREATE TYPE set_house_repair_status AS ENUM (
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
  CREATE TYPE set_house_strike_severity AS ENUM (
    'warning',
    'minor',
    'major',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rental request status
DO $$ BEGIN
  CREATE TYPE set_house_request_status AS ENUM (
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

-- Booking order status
DO $$ BEGIN
  CREATE TYPE set_house_order_status AS ENUM (
    'draft',
    'confirmed',
    'preparing',
    'ready',
    'in_use',
    'checkout_pending',
    'completed',
    'reconciling',
    'closed',
    'cancelled',
    'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 2: SET HOUSE ORGANIZATION SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,

  -- Space Identification Settings
  space_id_prefix TEXT DEFAULT 'SH-',

  -- Photo Requirements
  require_photos_on_intake BOOLEAN DEFAULT TRUE,
  require_photos_on_booking_start BOOLEAN DEFAULT FALSE,
  require_photos_on_booking_end BOOLEAN DEFAULT TRUE,
  require_photos_on_damage BOOLEAN DEFAULT TRUE,

  -- Signature Requirements
  require_signature_on_booking_start BOOLEAN DEFAULT FALSE,
  require_signature_on_booking_end BOOLEAN DEFAULT FALSE,

  -- Strike Rules
  strikes_enabled BOOLEAN DEFAULT TRUE,
  strikes_before_escalation INTEGER DEFAULT 3,
  auto_strike_on_damage BOOLEAN DEFAULT TRUE,
  auto_strike_on_late_checkout BOOLEAN DEFAULT TRUE,

  -- Booking Settings
  default_booking_start_time TIME DEFAULT '08:00:00',
  default_booking_end_time TIME DEFAULT '18:00:00',
  minimum_booking_hours INTEGER DEFAULT 4,
  advance_booking_days INTEGER DEFAULT 1,
  max_advance_booking_days INTEGER DEFAULT 365,

  -- Cancellation Policy
  cancellation_notice_hours INTEGER DEFAULT 48,
  cancellation_fee_percent DECIMAL(5,2) DEFAULT 50.00,

  -- Work Order Settings
  work_order_statuses JSONB DEFAULT '[
    {"id": "draft", "label": "Draft", "color": "gray", "sort_order": 1},
    {"id": "in_progress", "label": "In Progress", "color": "blue", "sort_order": 2},
    {"id": "ready", "label": "Ready", "color": "green", "sort_order": 3},
    {"id": "booked", "label": "Booked", "color": "purple", "sort_order": 4}
  ]',
  work_order_reference_prefix TEXT DEFAULT 'SWO-',

  -- Verification Settings (mirroring gear)
  booking_start_verification_required BOOLEAN DEFAULT FALSE,
  booking_start_verify_method TEXT DEFAULT 'checkoff',
  booking_end_verification_required BOOLEAN DEFAULT FALSE,
  booking_end_verify_method TEXT DEFAULT 'checkoff',

  -- Label/Print Settings
  label_templates JSONB DEFAULT '[]',
  print_queue_enabled BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 3: CATEGORIES AND LOCATIONS
-- =============================================================================

-- Space categories (per-org customizable)
CREATE TABLE IF NOT EXISTS set_house_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES set_house_categories(id),

  -- Display
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

-- Storage/pickup locations (warehouses, stages, etc.)
CREATE TABLE IF NOT EXISTS set_house_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  location_type TEXT DEFAULT 'facility', -- facility, stage, office, other

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
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors (repair/maintenance, service providers)
CREATE TABLE IF NOT EXISTS set_house_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  vendor_type TEXT DEFAULT 'maintenance', -- maintenance, cleaning, security, other

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
-- PART 4: SPACES (THE CORE RENTABLE UNITS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  internal_id TEXT NOT NULL,

  -- Space Info
  space_type set_house_space_type NOT NULL DEFAULT 'studio',
  name TEXT NOT NULL,
  description TEXT,

  -- Categorization
  category_id UUID REFERENCES set_house_categories(id),
  tags TEXT[],

  -- Physical Attributes
  square_footage INTEGER,
  ceiling_height_feet DECIMAL(5,2),
  dimensions TEXT, -- e.g., "50x80x30"
  max_occupancy INTEGER,

  -- Features (stored as JSONB for flexibility)
  features JSONB DEFAULT '{}', -- e.g., {"power_capacity": "400A", "drive_in": true, "cyc_wall": true}
  amenities JSONB DEFAULT '[]', -- e.g., ["wifi", "ac", "restrooms", "kitchen", "greenroom"]

  -- Status & Location
  status set_house_space_status NOT NULL DEFAULT 'available',
  location_id UUID REFERENCES set_house_locations(id),

  -- Pricing
  hourly_rate DECIMAL(10, 2),
  half_day_rate DECIMAL(10, 2), -- 4-6 hours
  daily_rate DECIMAL(10, 2),
  weekly_rate DECIMAL(10, 2),
  monthly_rate DECIMAL(10, 2),

  -- Insurance
  insurance_required BOOLEAN DEFAULT FALSE,
  minimum_insurance_coverage DECIMAL(12, 2),

  -- Condition
  current_condition set_house_condition_grade DEFAULT 'good',
  condition_notes TEXT,

  -- Last maintenance
  last_maintenance_date DATE,
  next_maintenance_due DATE,

  -- Photos
  photos_baseline JSONB DEFAULT '[]',
  photos_current JSONB DEFAULT '[]',
  floor_plan_url TEXT,
  virtual_tour_url TEXT,

  -- Notes
  notes TEXT,
  access_instructions TEXT,
  parking_info TEXT,
  loading_dock_info TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  UNIQUE(organization_id, internal_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_set_house_spaces_org ON set_house_spaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_spaces_status ON set_house_spaces(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_set_house_spaces_category ON set_house_spaces(category_id);
CREATE INDEX IF NOT EXISTS idx_set_house_spaces_type ON set_house_spaces(space_type);

-- Space images
CREATE TABLE IF NOT EXISTS set_house_space_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES set_house_spaces(id) ON DELETE CASCADE,

  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_space_images_space ON set_house_space_images(space_id);

-- =============================================================================
-- PART 5: PACKAGES (BUNDLES OF SPACES)
-- =============================================================================

-- Package templates (reusable space bundles)
CREATE TABLE IF NOT EXISTS set_house_package_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES set_house_categories(id),

  -- Pricing (can override individual space pricing)
  package_daily_rate DECIMAL(10, 2),
  package_weekly_rate DECIMAL(10, 2),
  discount_percent DECIMAL(5, 2) DEFAULT 0,

  -- Photos
  reference_photo_url TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Package template items
CREATE TABLE IF NOT EXISTS set_house_package_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES set_house_package_templates(id) ON DELETE CASCADE,

  -- Space reference
  space_id UUID REFERENCES set_house_spaces(id),
  category_id UUID REFERENCES set_house_categories(id),
  item_description TEXT, -- Freeform if neither

  is_required BOOLEAN DEFAULT TRUE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Package instances (actual booked packages)
CREATE TABLE IF NOT EXISTS set_house_package_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Package Info
  name TEXT NOT NULL,
  internal_id TEXT NOT NULL,
  template_id UUID REFERENCES set_house_package_templates(id),

  -- Status
  status set_house_space_status NOT NULL DEFAULT 'available',

  -- Notes
  notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  UNIQUE(organization_id, internal_id)
);

-- Package membership (spaces in package instances)
CREATE TABLE IF NOT EXISTS set_house_package_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_instance_id UUID NOT NULL REFERENCES set_house_package_instances(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES set_house_spaces(id) ON DELETE CASCADE,

  slot_name TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),

  UNIQUE(package_instance_id, space_id)
);

-- =============================================================================
-- PART 6: TRANSACTIONS (BOOKING CHAIN)
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Transaction Type
  transaction_type set_house_transaction_type NOT NULL,

  -- Counterparty
  counterparty_org_id UUID REFERENCES organizations(id),

  -- Project Link (Backlot integration)
  backlot_project_id UUID,

  -- People
  initiated_by_user_id UUID NOT NULL REFERENCES profiles(id),
  primary_custodian_user_id UUID REFERENCES profiles(id),

  -- Timing
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,

  -- Workflow Timestamps
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,

  -- Signatures
  start_signature_url TEXT,
  end_signature_url TEXT,

  -- Reference
  reference_number TEXT,
  notes TEXT,

  -- Status
  status TEXT DEFAULT 'pending',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_house_transactions_org ON set_house_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_type ON set_house_transactions(organization_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_custodian ON set_house_transactions(primary_custodian_user_id);
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_status ON set_house_transactions(status);

-- Transaction line items
CREATE TABLE IF NOT EXISTS set_house_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES set_house_transactions(id) ON DELETE CASCADE,

  -- Space or Package
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),

  -- Condition at booking start/end
  condition_start set_house_condition_grade,
  condition_end set_house_condition_grade,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_space_or_package CHECK (
    (space_id IS NOT NULL AND package_instance_id IS NULL) OR
    (space_id IS NULL AND package_instance_id IS NOT NULL)
  )
);

-- =============================================================================
-- PART 7: INCIDENTS AND REPAIRS
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Type
  incident_type set_house_incident_type NOT NULL,

  -- Context
  transaction_id UUID REFERENCES set_house_transactions(id),

  -- Space
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),

  -- Damage specific
  damage_tier set_house_damage_tier,
  damage_description TEXT,
  damage_location TEXT, -- Where in the space

  -- Investigation
  reported_by_user_id UUID NOT NULL REFERENCES profiles(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to_user_id UUID REFERENCES profiles(id),

  -- Responsible Party
  responsible_user_id UUID REFERENCES profiles(id),
  responsible_org_id UUID REFERENCES organizations(id),

  -- Resolution
  status TEXT DEFAULT 'open',
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

CREATE INDEX IF NOT EXISTS idx_set_house_incidents_org ON set_house_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_incidents_space ON set_house_incidents(space_id) WHERE space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_set_house_incidents_status ON set_house_incidents(status);

-- Repair tickets
CREATE TABLE IF NOT EXISTS set_house_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Space
  space_id UUID NOT NULL REFERENCES set_house_spaces(id),

  -- Source
  incident_id UUID REFERENCES set_house_incidents(id),

  -- Ticket Info
  ticket_number TEXT,
  title TEXT NOT NULL,
  description TEXT,

  -- Status
  status set_house_repair_status NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal',

  -- Vendor
  vendor_id UUID REFERENCES set_house_vendors(id),
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

CREATE INDEX IF NOT EXISTS idx_set_house_repairs_org ON set_house_repairs(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_repairs_space ON set_house_repairs(space_id);
CREATE INDEX IF NOT EXISTS idx_set_house_repairs_status ON set_house_repairs(status);

-- =============================================================================
-- PART 8: STRIKES
-- =============================================================================

-- Strike rules
CREATE TABLE IF NOT EXISTS set_house_strike_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Trigger
  trigger_type set_house_incident_type NOT NULL,
  trigger_damage_tier set_house_damage_tier,

  -- Action
  strike_severity set_house_strike_severity NOT NULL,
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
CREATE TABLE IF NOT EXISTS set_house_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- User
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Context
  incident_id UUID REFERENCES set_house_incidents(id),
  repair_id UUID REFERENCES set_house_repairs(id),
  transaction_id UUID REFERENCES set_house_transactions(id),

  -- Backlot link
  backlot_project_id UUID,

  -- Strike Info
  severity set_house_strike_severity NOT NULL,
  points INTEGER DEFAULT 1,
  reason TEXT NOT NULL,

  -- Auto-applied or manual
  rule_id UUID REFERENCES set_house_strike_rules(id),
  is_auto_applied BOOLEAN DEFAULT FALSE,

  -- Photos/Evidence
  photos JSONB DEFAULT '[]',

  -- Review
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by_user_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Expiration
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

CREATE INDEX IF NOT EXISTS idx_set_house_strikes_org ON set_house_strikes(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_strikes_user ON set_house_strikes(user_id);
CREATE INDEX IF NOT EXISTS idx_set_house_strikes_active ON set_house_strikes(user_id, is_active) WHERE is_active = TRUE;

-- =============================================================================
-- PART 9: CLIENTS
-- =============================================================================

-- Client companies
CREATE TABLE IF NOT EXISTS set_house_client_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Contact Info
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

  -- Company-Level Documents
  insurance_file_url TEXT,
  insurance_file_name TEXT,
  insurance_expiry DATE,
  coi_file_url TEXT,
  coi_file_name TEXT,
  coi_expiry DATE,

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_house_client_companies_org ON set_house_client_companies(organization_id);

-- Client contacts
CREATE TABLE IF NOT EXISTS set_house_client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_company_id UUID REFERENCES set_house_client_companies(id) ON DELETE SET NULL,

  -- Contact Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,

  -- Link to platform user
  linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- ID Documents
  id_photo_url TEXT,
  id_photo_file_name TEXT,
  id_type TEXT,
  id_expiry DATE,

  -- Personal insurance
  personal_insurance_url TEXT,
  personal_insurance_file_name TEXT,
  personal_insurance_expiry DATE,

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_house_client_contacts_org ON set_house_client_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_client_contacts_company ON set_house_client_contacts(client_company_id);

-- =============================================================================
-- PART 10: MARKETPLACE
-- =============================================================================

-- Marketplace settings
CREATE TABLE IF NOT EXISTS set_house_marketplace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Lister tier
  lister_type TEXT DEFAULT 'studio' CHECK (lister_type IN ('individual', 'studio', 'location_house', 'hybrid')),

  -- Marketplace visibility
  is_marketplace_enabled BOOLEAN DEFAULT FALSE,
  marketplace_name TEXT,
  marketplace_description TEXT,
  marketplace_logo_url TEXT,
  marketplace_location TEXT,
  marketplace_website TEXT,

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  successful_bookings_count INTEGER DEFAULT 0,

  -- Default booking settings
  default_deposit_percent DECIMAL(5,2) DEFAULT 0,
  require_deposit BOOLEAN DEFAULT FALSE,
  default_insurance_required BOOLEAN DEFAULT FALSE,

  -- Cancellation policy
  cancellation_policy TEXT DEFAULT 'standard',
  cancellation_notice_hours INTEGER DEFAULT 48,
  cancellation_fee_percent DECIMAL(5,2) DEFAULT 50,

  -- Payment preferences
  accepts_stripe BOOLEAN DEFAULT TRUE,
  accepts_invoice BOOLEAN DEFAULT TRUE,
  stripe_account_id TEXT,

  -- Contact preferences
  contact_email TEXT,
  contact_phone TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_marketplace_settings_org ON set_house_marketplace_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_marketplace_settings_enabled ON set_house_marketplace_settings(is_marketplace_enabled) WHERE is_marketplace_enabled = TRUE;

-- Marketplace listings
CREATE TABLE IF NOT EXISTS set_house_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES set_house_spaces(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Listing status
  is_listed BOOLEAN DEFAULT TRUE,
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  delisted_at TIMESTAMPTZ,

  -- Pricing (can override space pricing)
  hourly_rate DECIMAL(10,2),
  half_day_rate DECIMAL(10,2),
  daily_rate DECIMAL(10,2) NOT NULL,
  weekly_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),

  -- Discounts
  weekly_discount_percent DECIMAL(5,2) DEFAULT 0,
  monthly_discount_percent DECIMAL(5,2) DEFAULT 0,

  -- Deposit & Insurance
  deposit_amount DECIMAL(10,2),
  deposit_percent DECIMAL(5,2),
  insurance_required BOOLEAN DEFAULT FALSE,

  -- Availability
  min_booking_hours INTEGER DEFAULT 4,
  max_booking_days INTEGER,
  advance_booking_days INTEGER DEFAULT 1,

  -- Blackout dates
  blackout_dates JSONB DEFAULT '[]',

  -- Notes
  booking_notes TEXT,
  access_instructions TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(space_id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_marketplace_listings_org ON set_house_marketplace_listings(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_marketplace_listings_space ON set_house_marketplace_listings(space_id);
CREATE INDEX IF NOT EXISTS idx_set_house_marketplace_listings_listed ON set_house_marketplace_listings(is_listed) WHERE is_listed = TRUE;

-- =============================================================================
-- PART 11: RENTAL REQUESTS, QUOTES, ORDERS
-- =============================================================================

-- Rental requests
CREATE TABLE IF NOT EXISTS set_house_rental_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organizations
  requesting_org_id UUID NOT NULL REFERENCES organizations(id),
  set_house_org_id UUID REFERENCES organizations(id),

  -- Project
  backlot_project_id UUID,
  project_name TEXT,

  -- Request Info
  request_number TEXT,
  title TEXT NOT NULL,
  description TEXT,

  -- Dates
  booking_start_date DATE NOT NULL,
  booking_end_date DATE NOT NULL,
  booking_start_time TIME,
  booking_end_time TIME,

  -- Status
  status set_house_request_status NOT NULL DEFAULT 'draft',

  -- Requester
  requested_by_user_id UUID NOT NULL REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental request items
CREATE TABLE IF NOT EXISTS set_house_rental_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES set_house_rental_requests(id) ON DELETE CASCADE,

  -- Specification
  space_id UUID REFERENCES set_house_spaces(id),
  category_id UUID REFERENCES set_house_categories(id),
  item_description TEXT,

  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental quotes
CREATE TABLE IF NOT EXISTS set_house_rental_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES set_house_rental_requests(id),

  -- Set house
  set_house_org_id UUID NOT NULL REFERENCES organizations(id),

  -- Quote Info
  quote_number TEXT,

  -- Dates
  booking_start_date DATE NOT NULL,
  booking_end_date DATE NOT NULL,
  booking_start_time TIME,
  booking_end_time TIME,

  -- Pricing
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  insurance_amount DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),

  -- Deposit
  deposit_amount DECIMAL(10,2),
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_paid_at TIMESTAMPTZ,

  -- Terms
  payment_terms TEXT,
  cancellation_policy TEXT,
  insurance_requirements TEXT,
  damage_policy TEXT,

  -- Status
  status TEXT DEFAULT 'draft',

  -- Validity
  valid_until TIMESTAMPTZ,

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

-- Rental quote items
CREATE TABLE IF NOT EXISTS set_house_rental_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES set_house_rental_quotes(id) ON DELETE CASCADE,
  request_item_id UUID REFERENCES set_house_rental_request_items(id),

  -- Space offered
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),
  item_description TEXT,

  -- Pricing
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  quoted_rate DECIMAL(10, 2),
  rate_type TEXT DEFAULT 'daily',
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

-- Rental orders
CREATE TABLE IF NOT EXISTS set_house_rental_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES set_house_rental_quotes(id),

  -- Organizations
  set_house_org_id UUID NOT NULL REFERENCES organizations(id),
  client_org_id UUID NOT NULL REFERENCES organizations(id),

  -- Project
  backlot_project_id UUID,

  -- Order Info
  order_number TEXT UNIQUE,

  -- Dates
  booking_start_date DATE NOT NULL,
  booking_end_date DATE NOT NULL,
  booking_start_time TIME,
  booking_end_time TIME,

  -- Status
  status set_house_order_status NOT NULL DEFAULT 'confirmed',

  -- Pricing
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  insurance_amount DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),

  -- Adjustments
  damage_charges DECIMAL(12, 2) DEFAULT 0,
  late_fees DECIMAL(12, 2) DEFAULT 0,
  final_amount DECIMAL(12, 2),

  -- Workflow timestamps
  prepared_at TIMESTAMPTZ,
  prepared_by_user_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  reconciled_by_user_id UUID REFERENCES profiles(id),
  closed_at TIMESTAMPTZ,

  -- Notes
  preparation_notes TEXT,
  reconciliation_notes TEXT,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_rental_orders_set_house ON set_house_rental_orders(set_house_org_id);
CREATE INDEX IF NOT EXISTS idx_set_house_rental_orders_client ON set_house_rental_orders(client_org_id);
CREATE INDEX IF NOT EXISTS idx_set_house_rental_orders_status ON set_house_rental_orders(status);

-- Rental order items
CREATE TABLE IF NOT EXISTS set_house_rental_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES set_house_rental_orders(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES set_house_rental_quote_items(id),

  -- Assigned space
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),
  item_description TEXT,

  -- Pricing
  quoted_rate DECIMAL(10, 2),
  line_total DECIMAL(12, 2),

  -- Booking tracking
  booking_transaction_id UUID REFERENCES set_house_transactions(id),

  -- Notes
  notes TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 12: WORK ORDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference_number TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Assignment
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),

  -- Custodian
  custodian_user_id UUID REFERENCES profiles(id),
  custodian_contact_id UUID REFERENCES set_house_client_contacts(id),
  backlot_project_id UUID,

  -- Dates
  due_date DATE,
  booking_date DATE,
  booking_start_time TIME,
  booking_end_time TIME,

  -- Booking link
  booking_transaction_id UUID REFERENCES set_house_transactions(id),
  booked_at TIMESTAMPTZ,
  booked_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, reference_number)
);

CREATE INDEX IF NOT EXISTS idx_set_house_work_orders_org_status ON set_house_work_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_set_house_work_orders_assigned ON set_house_work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_set_house_work_orders_due ON set_house_work_orders(organization_id, due_date);

-- Work order items
CREATE TABLE IF NOT EXISTS set_house_work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES set_house_work_orders(id) ON DELETE CASCADE,
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES profiles(id),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_work_order_item_type CHECK (
    (space_id IS NOT NULL AND package_instance_id IS NULL) OR
    (space_id IS NULL AND package_instance_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_set_house_work_order_items_order ON set_house_work_order_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_set_house_work_order_items_space ON set_house_work_order_items(space_id) WHERE space_id IS NOT NULL;

-- Work order requests (from renters)
CREATE TABLE IF NOT EXISTS set_house_work_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(50),

  -- Parties
  requesting_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requesting_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  set_house_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  backlot_project_id UUID,

  -- Request details
  title VARCHAR(255),
  notes TEXT,
  booking_start_date DATE,
  booking_end_date DATE,
  booking_start_time TIME,
  booking_end_time TIME,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Approval tracking
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Created work order
  created_work_order_id UUID REFERENCES set_house_work_orders(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_house_work_order_requests_profile ON set_house_work_order_requests(requesting_profile_id);
CREATE INDEX IF NOT EXISTS idx_set_house_work_order_requests_set_house ON set_house_work_order_requests(set_house_org_id);
CREATE INDEX IF NOT EXISTS idx_set_house_work_order_requests_status ON set_house_work_order_requests(status);

-- Work order request items
CREATE TABLE IF NOT EXISTS set_house_work_order_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES set_house_work_order_requests(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES set_house_marketplace_listings(id) ON DELETE CASCADE,
  space_id UUID REFERENCES set_house_spaces(id) ON DELETE SET NULL,
  daily_rate NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_house_work_order_request_items_request ON set_house_work_order_request_items(request_id);

-- =============================================================================
-- PART 13: VERIFICATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES set_house_transactions(id) ON DELETE CASCADE,

  -- Session type and status
  verification_type TEXT NOT NULL CHECK (verification_type IN ('booking_start', 'booking_end')),
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

  -- Condition documentation
  condition_photos JSONB DEFAULT '[]',
  condition_notes TEXT,

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

CREATE INDEX IF NOT EXISTS idx_set_house_verification_sessions_org ON set_house_verification_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_verification_sessions_transaction ON set_house_verification_sessions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_set_house_verification_sessions_token ON set_house_verification_sessions(token) WHERE token IS NOT NULL;

-- Verification items
CREATE TABLE IF NOT EXISTS set_house_verification_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES set_house_verification_sessions(id) ON DELETE CASCADE,

  -- Item being verified
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),

  -- Verification status
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),

  -- Condition
  condition_grade set_house_condition_grade,
  condition_notes TEXT,
  photos JSONB DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PART 14: LABELS AND PRINTING
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'space', -- space, package, booking

  -- Template content
  template_data JSONB NOT NULL DEFAULT '{}',

  -- Settings
  paper_size TEXT DEFAULT 'letter',
  orientation TEXT DEFAULT 'portrait',

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS set_house_print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What to print
  template_id UUID REFERENCES set_house_label_templates(id),
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),

  -- Queue status
  status TEXT DEFAULT 'pending', -- pending, printing, completed, failed
  priority INTEGER DEFAULT 0,

  -- Print data
  print_data JSONB DEFAULT '{}',
  copies INTEGER DEFAULT 1,

  -- Tracking
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  queued_by UUID NOT NULL REFERENCES profiles(id),
  printed_at TIMESTAMPTZ,
  printed_by UUID REFERENCES profiles(id),

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS set_house_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What was printed
  template_id UUID REFERENCES set_house_label_templates(id),
  space_id UUID REFERENCES set_house_spaces(id),
  package_instance_id UUID REFERENCES set_house_package_instances(id),

  -- Print details
  print_data JSONB DEFAULT '{}',
  copies INTEGER DEFAULT 1,

  -- Tracking
  printed_at TIMESTAMPTZ DEFAULT NOW(),
  printed_by UUID NOT NULL REFERENCES profiles(id)
);

-- =============================================================================
-- PART 15: CART
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES set_house_marketplace_listings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  backlot_project_id UUID,

  -- Booking details
  booking_start_date DATE,
  booking_end_date DATE,
  booking_start_time TIME,
  booking_end_time TIME,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(profile_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_cart_items_profile ON set_house_cart_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_set_house_cart_items_listing ON set_house_cart_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_set_house_cart_items_organization ON set_house_cart_items(organization_id);

-- =============================================================================
-- PART 16: SHIPMENTS (for props/equipment sent to spaces)
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Related entities
  transaction_id UUID REFERENCES set_house_transactions(id),
  order_id UUID REFERENCES set_house_rental_orders(id),

  -- Shipment details
  shipment_type TEXT DEFAULT 'delivery', -- delivery, pickup
  carrier TEXT,
  tracking_number TEXT,

  -- From/To
  from_location_id UUID REFERENCES set_house_locations(id),
  from_address JSONB,
  to_location_id UUID REFERENCES set_house_locations(id),
  to_address JSONB,

  -- Timing
  scheduled_date DATE,
  scheduled_time TIME,
  actual_date DATE,
  actual_time TIME,

  -- Status
  status TEXT DEFAULT 'pending', -- pending, in_transit, delivered, failed

  -- Costs
  shipping_cost DECIMAL(10, 2),

  -- Notes
  notes TEXT,
  special_instructions TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_set_house_shipments_org ON set_house_shipments(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_shipments_status ON set_house_shipments(status);

-- =============================================================================
-- PART 17: AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS set_house_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Action
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Actor
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Details
  previous_state JSONB,
  new_state JSONB,
  changes JSONB,

  -- Context
  transaction_id UUID,
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_house_audit_log_org ON set_house_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_set_house_audit_log_entity ON set_house_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_set_house_audit_log_user ON set_house_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_set_house_audit_log_created ON set_house_audit_log(created_at);

-- =============================================================================
-- PART 18: TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Auto-generate internal_id for spaces
CREATE OR REPLACE FUNCTION generate_set_house_space_internal_id()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  -- Get prefix from org settings or use default
  SELECT COALESCE(space_id_prefix, 'SH-') INTO prefix
  FROM set_house_organization_settings
  WHERE organization_id = NEW.organization_id;

  IF prefix IS NULL THEN
    prefix := 'SH-';
  END IF;

  -- Get next number for this org
  SELECT COALESCE(MAX(
    CASE
      WHEN internal_id ~ ('^' || prefix || '[0-9]+$')
      THEN CAST(SUBSTRING(internal_id FROM LENGTH(prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM set_house_spaces
  WHERE organization_id = NEW.organization_id;

  NEW.internal_id := prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_house_spaces_internal_id ON set_house_spaces;
CREATE TRIGGER trg_set_house_spaces_internal_id
  BEFORE INSERT ON set_house_spaces
  FOR EACH ROW
  WHEN (NEW.internal_id IS NULL OR NEW.internal_id = '')
  EXECUTE FUNCTION generate_set_house_space_internal_id();

-- Auto-generate work order reference number
CREATE OR REPLACE FUNCTION generate_set_house_work_order_reference()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  SELECT COALESCE(work_order_reference_prefix, 'SWO-') INTO prefix
  FROM set_house_organization_settings
  WHERE organization_id = NEW.organization_id;

  IF prefix IS NULL THEN
    prefix := 'SWO-';
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN reference_number ~ ('^' || regexp_replace(prefix, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '[0-9]+$')
      THEN CAST(SUBSTRING(reference_number FROM LENGTH(prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM set_house_work_orders
  WHERE organization_id = NEW.organization_id;

  NEW.reference_number := prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_house_work_orders_reference ON set_house_work_orders;
CREATE TRIGGER trg_set_house_work_orders_reference
  BEFORE INSERT ON set_house_work_orders
  FOR EACH ROW
  WHEN (NEW.reference_number IS NULL OR NEW.reference_number = '')
  EXECUTE FUNCTION generate_set_house_work_order_reference();

-- Work order request reference sequence
CREATE SEQUENCE IF NOT EXISTS set_house_work_order_request_ref_seq START WITH 1000;

CREATE OR REPLACE FUNCTION generate_set_house_work_order_request_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := 'SWOR-' || LPAD(nextval('set_house_work_order_request_ref_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_house_work_order_request_ref ON set_house_work_order_requests;
CREATE TRIGGER trg_set_house_work_order_request_ref
  BEFORE INSERT ON set_house_work_order_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_set_house_work_order_request_ref();

-- Auto-quarantine on unsafe damage
CREATE OR REPLACE FUNCTION set_house_auto_quarantine_on_damage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.damage_tier IN ('unsafe', 'out_of_service') AND NEW.space_id IS NOT NULL THEN
    UPDATE set_house_spaces
    SET status = 'under_maintenance',
        updated_at = NOW()
    WHERE id = NEW.space_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_house_incidents_quarantine ON set_house_incidents;
CREATE TRIGGER trg_set_house_incidents_quarantine
  AFTER INSERT ON set_house_incidents
  FOR EACH ROW
  EXECUTE FUNCTION set_house_auto_quarantine_on_damage();

-- Update space status on repair ticket status change
CREATE OR REPLACE FUNCTION set_house_update_space_on_repair_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF NEW.status IN ('open', 'diagnosing', 'awaiting_approval', 'in_repair') THEN
      UPDATE set_house_spaces
      SET status = 'under_maintenance',
          updated_at = NOW()
      WHERE id = NEW.space_id AND status != 'under_maintenance';
    ELSIF NEW.status = 'closed' AND NEW.qc_passed = TRUE THEN
      UPDATE set_house_spaces
      SET status = 'available',
          last_maintenance_date = NOW(),
          updated_at = NOW()
      WHERE id = NEW.space_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_house_repair_status ON set_house_repairs;
CREATE TRIGGER trg_set_house_repair_status
  AFTER UPDATE ON set_house_repairs
  FOR EACH ROW
  EXECUTE FUNCTION set_house_update_space_on_repair_status();

-- Updated_at trigger function for set house
CREATE OR REPLACE FUNCTION set_house_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all set house tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'set_house_organization_settings',
    'set_house_categories', 'set_house_locations', 'set_house_vendors',
    'set_house_spaces', 'set_house_package_templates', 'set_house_package_instances',
    'set_house_transactions', 'set_house_incidents', 'set_house_repairs',
    'set_house_strikes', 'set_house_client_companies', 'set_house_client_contacts',
    'set_house_marketplace_settings', 'set_house_marketplace_listings',
    'set_house_rental_requests', 'set_house_rental_quotes', 'set_house_rental_orders',
    'set_house_work_orders', 'set_house_work_order_requests',
    'set_house_verification_sessions', 'set_house_label_templates',
    'set_house_shipments', 'set_house_cart_items'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_house_update_timestamp()', tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- PART 19: BACKLOT INTEGRATION
-- =============================================================================

-- Add FK from transactions to backlot_projects (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backlot_projects') THEN
    ALTER TABLE set_house_transactions
      ADD CONSTRAINT fk_set_house_transactions_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE set_house_strikes
      ADD CONSTRAINT fk_set_house_strikes_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE set_house_rental_requests
      ADD CONSTRAINT fk_set_house_rental_requests_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE set_house_rental_orders
      ADD CONSTRAINT fk_set_house_rental_orders_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE set_house_work_orders
      ADD CONSTRAINT fk_set_house_work_orders_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE set_house_work_order_requests
      ADD CONSTRAINT fk_set_house_work_order_requests_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;

    ALTER TABLE set_house_cart_items
      ADD CONSTRAINT fk_set_house_cart_items_backlot_project
      FOREIGN KEY (backlot_project_id)
      REFERENCES backlot_projects(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backlot project set house links
CREATE TABLE IF NOT EXISTS backlot_project_set_house_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Set House references
  set_house_organization_id UUID REFERENCES organizations(id),
  set_house_order_id UUID REFERENCES set_house_rental_orders(id),
  set_house_transaction_id UUID REFERENCES set_house_transactions(id),

  -- Link type
  link_type TEXT NOT NULL, -- booking, owned_space, transaction

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_set_house_links_project ON backlot_project_set_house_links(project_id);

-- =============================================================================
-- PART 20: DEFAULT DATA
-- =============================================================================

-- Insert default set house categories for existing orgs
INSERT INTO set_house_categories (id, organization_id, name, slug, sort_order)
SELECT
  gen_random_uuid(),
  o.id,
  c.name,
  c.slug,
  c.sort_order
FROM organizations o
CROSS JOIN (VALUES
  ('Sound Stages', 'sound-stages', 1),
  ('Studios', 'studios', 2),
  ('Locations', 'locations', 3),
  ('Backlots', 'backlots', 4),
  ('Green Screen', 'green-screen', 5),
  ('Workshops', 'workshops', 6),
  ('Production Offices', 'production-offices', 7),
  ('Storage', 'storage', 8),
  ('Other', 'other', 99)
) AS c(name, slug, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM set_house_categories shc
  WHERE shc.organization_id = o.id AND shc.slug = c.slug
)
ON CONFLICT DO NOTHING;

-- Insert default strike rules
INSERT INTO set_house_strike_rules (id, organization_id, trigger_type, trigger_damage_tier, strike_severity, strike_points, description)
SELECT
  gen_random_uuid(),
  o.id,
  r.trigger_type::set_house_incident_type,
  r.trigger_damage_tier::set_house_damage_tier,
  r.strike_severity::set_house_strike_severity,
  r.strike_points,
  r.description
FROM organizations o
CROSS JOIN (VALUES
  ('damage', 'functional', 'minor', 1, 'Functional damage to space'),
  ('damage', 'unsafe', 'major', 2, 'Unsafe condition caused'),
  ('damage', 'out_of_service', 'critical', 3, 'Space rendered unusable'),
  ('late_checkout', NULL, 'warning', 0, 'Late checkout from space'),
  ('policy_violation', NULL, 'minor', 1, 'Policy violation'),
  ('unsafe_behavior', NULL, 'critical', 3, 'Unsafe behavior on premises')
) AS r(trigger_type, trigger_damage_tier, strike_severity, strike_points, description)
WHERE NOT EXISTS (
  SELECT 1 FROM set_house_strike_rules shsr
  WHERE shsr.organization_id = o.id
    AND shsr.trigger_type = r.trigger_type::set_house_incident_type
    AND (shsr.trigger_damage_tier = r.trigger_damage_tier::set_house_damage_tier OR (shsr.trigger_damage_tier IS NULL AND r.trigger_damage_tier IS NULL))
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

COMMENT ON TABLE set_house_organization_settings IS 'Per-org settings for Set House module';
COMMENT ON TABLE set_house_spaces IS 'Core rentable spaces for Set House module (studios, stages, locations)';
COMMENT ON TABLE set_house_transactions IS 'Booking chain tracking for all space movements';
COMMENT ON TABLE set_house_incidents IS 'Damage, policy violations, and other incidents';
COMMENT ON TABLE set_house_repairs IS 'Repair/maintenance workflow management';
COMMENT ON TABLE set_house_strikes IS 'User accountability tracking';
COMMENT ON TABLE set_house_marketplace_listings IS 'Public marketplace listings for space rentals';
