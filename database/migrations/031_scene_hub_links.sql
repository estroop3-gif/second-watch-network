-- Migration: 031_scene_hub_links.sql
-- Description: Create tables for Scene Hub feature - locations, shots, clearances, receipts, budget
-- This enables the Scene Detail Page to be a central hub for production management

-- ============================================================================
-- LOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT DEFAULT 'USA',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    parking_notes TEXT,
    load_in_notes TEXT,
    power_available BOOLEAN DEFAULT FALSE,
    restrooms_available BOOLEAN DEFAULT FALSE,
    permit_required BOOLEAN DEFAULT FALSE,
    permit_obtained BOOLEAN DEFAULT FALSE,
    permit_notes TEXT,
    location_fee DECIMAL(12, 2),
    images JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT FALSE,
    created_by_user_id UUID REFERENCES profiles(id),
    location_type TEXT,
    amenities JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_locations_project ON backlot_locations(project_id);

-- ============================================================================
-- SCENE SHOTS TABLE (Shot Lists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_scene_shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,
    shot_number TEXT NOT NULL,
    shot_type TEXT CHECK (shot_type IN (
        'ECU', 'CU', 'MCU', 'MS', 'MLS', 'LS', 'WS', 'EWS',
        'POV', 'OTS', 'INSERT', '2SHOT', 'GROUP', 'OTHER'
    )),
    lens TEXT,
    camera_movement TEXT CHECK (camera_movement IN (
        'static', 'pan', 'tilt', 'dolly', 'tracking', 'handheld',
        'gimbal', 'crane', 'drone', 'zoom', 'push', 'pull', 'arc', 'other'
    )),
    description TEXT,
    est_time_minutes DECIMAL(5, 1),
    priority TEXT DEFAULT 'must_have' CHECK (priority IN ('must_have', 'nice_to_have')),
    coverage_status TEXT DEFAULT 'not_shot' CHECK (coverage_status IN (
        'not_shot', 'shot', 'alt_needed', 'dropped'
    )),
    covered_at TIMESTAMPTZ,
    covered_by_user_id UUID REFERENCES profiles(id),
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_scene_shots_scene ON backlot_scene_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_backlot_scene_shots_project ON backlot_scene_shots(project_id);

-- ============================================================================
-- CALL SHEETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    general_call_time TIME,
    location_name TEXT,
    location_address TEXT,
    parking_notes TEXT,
    production_contact TEXT,
    production_phone TEXT,
    schedule_blocks JSONB DEFAULT '[]',
    weather_info TEXT,
    special_instructions TEXT,
    safety_notes TEXT,
    hospital_name TEXT,
    hospital_address TEXT,
    hospital_phone TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_call_sheets_project ON backlot_call_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_call_sheets_date ON backlot_call_sheets(date);

-- ============================================================================
-- CALL SHEET SCENE LINKS (Junction table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_scene_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,
    sequence INTEGER DEFAULT 0,
    estimated_time_minutes INTEGER,
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'in_progress', 'completed', 'moved', 'cut'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(call_sheet_id, scene_id)
);

CREATE INDEX IF NOT EXISTS idx_call_sheet_scene_links_call_sheet ON backlot_call_sheet_scene_links(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_scene_links_scene ON backlot_call_sheet_scene_links(scene_id);

-- ============================================================================
-- DAILIES CLIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_dailies_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT,
    cloud_url TEXT,
    duration_seconds DECIMAL(10, 3),
    timecode_start TEXT,
    frame_rate TEXT,
    resolution TEXT,
    codec TEXT,
    camera_label TEXT,
    scene_number TEXT,
    take_number INTEGER,
    is_circle_take BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK (rating >= 0 AND rating <= 5),
    notes TEXT,
    storage_mode TEXT DEFAULT 'cloud' CHECK (storage_mode IN ('cloud', 'local_drive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_dailies_clips_project ON backlot_dailies_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_dailies_clips_scene ON backlot_dailies_clips(scene_id);
CREATE INDEX IF NOT EXISTS idx_backlot_dailies_clips_scene_number ON backlot_dailies_clips(scene_number);

-- ============================================================================
-- CLEARANCE ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_clearance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'talent_release', 'location_release', 'appearance_release',
        'nda', 'music_license', 'stock_license', 'other_contract'
    )),
    related_person_name TEXT,
    related_location_id UUID REFERENCES backlot_locations(id) ON DELETE SET NULL,
    related_asset_label TEXT,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name TEXT,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'requested', 'signed', 'expired', 'rejected'
    )),
    requested_date DATE,
    signed_date DATE,
    expiration_date DATE,
    notes TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_by_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_clearance_items_project ON backlot_clearance_items(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_clearance_items_scene ON backlot_clearance_items(scene_id);
CREATE INDEX IF NOT EXISTS idx_backlot_clearance_items_type ON backlot_clearance_items(type);
CREATE INDEX IF NOT EXISTS idx_backlot_clearance_items_location ON backlot_clearance_items(related_location_id);

-- ============================================================================
-- RECEIPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    location_id UUID REFERENCES backlot_locations(id) ON DELETE SET NULL,
    file_url TEXT,
    original_filename TEXT,
    file_type TEXT,
    file_size_bytes INTEGER,
    vendor_name TEXT,
    description TEXT,
    purchase_date DATE,
    amount DECIMAL(12, 2),
    tax_amount DECIMAL(12, 2),
    currency TEXT DEFAULT 'USD',
    ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'completed', 'failed')),
    ocr_confidence INTEGER,
    raw_ocr_json JSONB,
    extracted_text TEXT,
    is_mapped BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'check', 'wire', 'petty_cash')),
    reimbursement_status TEXT,
    reimbursement_to TEXT,
    created_by_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_receipts_project ON backlot_receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_scene ON backlot_receipts(scene_id);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_location ON backlot_receipts(location_id);

-- ============================================================================
-- BUDGET CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_budget_categories_project ON backlot_budget_categories(project_id);

-- ============================================================================
-- BUDGET LINE ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_budget_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    category_id UUID REFERENCES backlot_budget_categories(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    location_id UUID REFERENCES backlot_locations(id) ON DELETE SET NULL,
    account_code TEXT,
    description TEXT NOT NULL,
    rate_type TEXT DEFAULT 'flat' CHECK (rate_type IN ('flat', 'daily', 'weekly', 'hourly', 'per_unit')),
    rate_amount DECIMAL(12, 2) DEFAULT 0,
    quantity DECIMAL(10, 2) DEFAULT 1,
    units TEXT,
    estimated_total DECIMAL(12, 2) GENERATED ALWAYS AS (rate_amount * quantity) STORED,
    actual_total DECIMAL(12, 2) DEFAULT 0,
    vendor_name TEXT,
    po_number TEXT,
    invoice_reference TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_budget_line_items_project ON backlot_budget_line_items(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_budget_line_items_scene ON backlot_budget_line_items(scene_id);
CREATE INDEX IF NOT EXISTS idx_backlot_budget_line_items_location ON backlot_budget_line_items(location_id);
CREATE INDEX IF NOT EXISTS idx_backlot_budget_line_items_category ON backlot_budget_line_items(category_id);

-- ============================================================================
-- Add scene_id to backlot_tasks if not exists
-- ============================================================================
ALTER TABLE backlot_tasks
ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backlot_tasks_scene ON backlot_tasks(scene_id);
