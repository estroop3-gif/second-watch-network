-- =====================================================
-- BACKLOT PRODUCTION HUB - Database Schema
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

-- Project visibility
CREATE TYPE backlot_visibility AS ENUM ('private', 'unlisted', 'public');

-- Project status
CREATE TYPE backlot_project_status AS ENUM ('pre_production', 'production', 'post_production', 'completed', 'on_hold', 'archived');

-- Member roles within a project
CREATE TYPE backlot_member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- Task status
CREATE TYPE backlot_task_status AS ENUM ('todo', 'in_progress', 'review', 'completed', 'blocked');

-- Task priority
CREATE TYPE backlot_task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Contact type
CREATE TYPE backlot_contact_type AS ENUM ('investor', 'crew', 'collaborator', 'vendor', 'talent', 'other');

-- Contact status
CREATE TYPE backlot_contact_status AS ENUM ('new', 'contacted', 'in_discussion', 'confirmed', 'declined', 'archived');

-- Update type
CREATE TYPE backlot_update_type AS ENUM ('announcement', 'milestone', 'schedule_change', 'general');

-- Gear status
CREATE TYPE backlot_gear_status AS ENUM ('available', 'in_use', 'reserved', 'maintenance', 'retired');

-- =====================================================
-- TABLE: backlot_projects
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic Info
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logline TEXT,
  description TEXT,
  cover_image_url TEXT,
  thumbnail_url TEXT,

  -- Project Details
  project_type TEXT, -- film, series, commercial, music_video, documentary, etc.
  genre TEXT,
  format TEXT, -- feature, short, pilot, etc.
  runtime_minutes INTEGER,

  -- Status & Visibility
  status backlot_project_status DEFAULT 'pre_production',
  visibility backlot_visibility DEFAULT 'private',

  -- Dates
  target_start_date DATE,
  target_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create slug from title function
CREATE OR REPLACE FUNCTION generate_backlot_slug(title TEXT, project_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert title to slug
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);

  final_slug := base_slug;

  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM backlot_projects WHERE slug = final_slug AND id != COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate slug on insert
CREATE OR REPLACE FUNCTION backlot_projects_set_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_backlot_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backlot_projects_slug_trigger
  BEFORE INSERT ON backlot_projects
  FOR EACH ROW
  EXECUTE FUNCTION backlot_projects_set_slug();

-- Update timestamp trigger
CREATE TRIGGER backlot_projects_updated_at
  BEFORE UPDATE ON backlot_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_project_members
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role & Permissions
  role backlot_member_role DEFAULT 'viewer',

  -- Production Role (Director, DP, Producer, etc.)
  production_role TEXT,
  department TEXT,

  -- Contact Info (can override profile)
  phone TEXT,
  email TEXT,

  -- Metadata
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, user_id)
);

-- =====================================================
-- TABLE: backlot_production_days
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_production_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Day Info
  day_number INTEGER NOT NULL, -- Shoot Day 1, 2, 3...
  date DATE NOT NULL,
  title TEXT, -- "EXT. BEACH - Day 1"
  description TEXT,

  -- Schedule
  general_call_time TIME,
  wrap_time TIME,

  -- Location (can reference backlot_locations)
  location_id UUID,
  location_name TEXT, -- Fallback if no location_id
  location_address TEXT,

  -- Status
  is_completed BOOLEAN DEFAULT FALSE,
  notes TEXT,

  -- Weather/Conditions (for outdoor shoots)
  weather_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, day_number)
);

CREATE TRIGGER backlot_production_days_updated_at
  BEFORE UPDATE ON backlot_production_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_call_sheets
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,

  -- Call Sheet Info
  title TEXT NOT NULL, -- "Day 1 Call Sheet"
  date DATE NOT NULL,
  general_call_time TIME,

  -- Location
  location_name TEXT,
  location_address TEXT,
  parking_notes TEXT,

  -- Contact Info
  production_contact TEXT,
  production_phone TEXT,

  -- Schedule Blocks (JSONB for flexibility)
  schedule_blocks JSONB DEFAULT '[]',
  -- Example: [{ "time": "06:00", "activity": "Crew Call" }, { "time": "07:00", "activity": "Talent Call" }]

  -- Additional Info
  weather_info TEXT,
  special_instructions TEXT,
  safety_notes TEXT,

  -- Nearest Hospital (safety requirement)
  hospital_name TEXT,
  hospital_address TEXT,
  hospital_phone TEXT,

  -- Status
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_call_sheets_updated_at
  BEFORE UPDATE ON backlot_call_sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_call_sheet_people
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,

  -- Person Info (can be member or external)
  member_id UUID REFERENCES backlot_project_members(id) ON DELETE SET NULL,

  -- If not a member, store info directly
  name TEXT NOT NULL,
  role TEXT, -- "Director", "DP", "Actor - Lead", etc.
  department TEXT,

  -- Call Time
  call_time TIME NOT NULL,

  -- Contact
  phone TEXT,
  email TEXT,

  -- Notes
  notes TEXT,
  makeup_time TIME,
  wardrobe_notes TEXT,

  -- Order for display
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: backlot_tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Task Info
  title TEXT NOT NULL,
  description TEXT,

  -- Status & Priority
  status backlot_task_status DEFAULT 'todo',
  priority backlot_task_priority DEFAULT 'medium',

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  department TEXT,

  -- Dates
  due_date DATE,
  completed_at TIMESTAMPTZ,

  -- Parent Task (for subtasks)
  parent_task_id UUID REFERENCES backlot_tasks(id) ON DELETE CASCADE,

  -- Related Items
  production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,

  -- Position for drag-and-drop
  position INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_tasks_updated_at
  BEFORE UPDATE ON backlot_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_locations
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Location Info
  name TEXT NOT NULL,
  description TEXT,
  scene_description TEXT, -- "INT. APARTMENT - NIGHT"

  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',

  -- Coordinates
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Contact
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- Logistics
  parking_notes TEXT,
  load_in_notes TEXT,
  power_available BOOLEAN DEFAULT TRUE,
  restrooms_available BOOLEAN DEFAULT TRUE,

  -- Permit Info
  permit_required BOOLEAN DEFAULT FALSE,
  permit_notes TEXT,
  permit_obtained BOOLEAN DEFAULT FALSE,

  -- Cost
  location_fee DECIMAL(10, 2),
  fee_notes TEXT,

  -- Images
  images JSONB DEFAULT '[]', -- Array of image URLs

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_locations_updated_at
  BEFORE UPDATE ON backlot_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_gear_items
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_gear_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Gear Info
  name TEXT NOT NULL,
  category TEXT, -- Camera, Lighting, Grip, Audio, etc.
  description TEXT,

  -- Identification
  serial_number TEXT,
  asset_tag TEXT,

  -- Status
  status backlot_gear_status DEFAULT 'available',

  -- Ownership
  is_owned BOOLEAN DEFAULT FALSE, -- Owned vs Rented
  rental_house TEXT,
  rental_cost_per_day DECIMAL(10, 2),

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_production_day_id UUID REFERENCES backlot_production_days(id),

  -- Dates
  pickup_date DATE,
  return_date DATE,

  -- Notes
  notes TEXT,
  condition_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_gear_items_updated_at
  BEFORE UPDATE ON backlot_gear_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_project_updates
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Update Info
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type backlot_update_type DEFAULT 'general',

  -- Visibility
  is_public BOOLEAN DEFAULT FALSE, -- Show on public project page

  -- Attachments
  attachments JSONB DEFAULT '[]', -- Array of {url, name, type}

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_project_updates_updated_at
  BEFORE UPDATE ON backlot_project_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: backlot_project_contacts
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Contact Type
  contact_type backlot_contact_type DEFAULT 'other',
  status backlot_contact_status DEFAULT 'new',

  -- Contact Info
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,

  -- Role/Interest
  role_interest TEXT, -- What they want to do/invest in

  -- Notes
  notes TEXT,

  -- Follow-up
  last_contact_date DATE,
  next_follow_up_date DATE,

  -- If they're also a platform user
  user_id UUID REFERENCES auth.users(id),

  -- Source
  source TEXT, -- "website", "referral", "cold_outreach", etc.

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_project_contacts_updated_at
  BEFORE UPDATE ON backlot_project_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================

-- Projects
CREATE INDEX idx_backlot_projects_owner ON backlot_projects(owner_id);
CREATE INDEX idx_backlot_projects_slug ON backlot_projects(slug);
CREATE INDEX idx_backlot_projects_visibility ON backlot_projects(visibility);
CREATE INDEX idx_backlot_projects_status ON backlot_projects(status);

-- Members
CREATE INDEX idx_backlot_members_project ON backlot_project_members(project_id);
CREATE INDEX idx_backlot_members_user ON backlot_project_members(user_id);

-- Production Days
CREATE INDEX idx_backlot_days_project ON backlot_production_days(project_id);
CREATE INDEX idx_backlot_days_date ON backlot_production_days(date);

-- Call Sheets
CREATE INDEX idx_backlot_call_sheets_project ON backlot_call_sheets(project_id);
CREATE INDEX idx_backlot_call_sheets_date ON backlot_call_sheets(date);

-- Tasks
CREATE INDEX idx_backlot_tasks_project ON backlot_tasks(project_id);
CREATE INDEX idx_backlot_tasks_assigned ON backlot_tasks(assigned_to);
CREATE INDEX idx_backlot_tasks_status ON backlot_tasks(status);
CREATE INDEX idx_backlot_tasks_due ON backlot_tasks(due_date);

-- Locations
CREATE INDEX idx_backlot_locations_project ON backlot_locations(project_id);

-- Gear
CREATE INDEX idx_backlot_gear_project ON backlot_gear_items(project_id);
CREATE INDEX idx_backlot_gear_status ON backlot_gear_items(status);
CREATE INDEX idx_backlot_gear_category ON backlot_gear_items(category);

-- Updates
CREATE INDEX idx_backlot_updates_project ON backlot_project_updates(project_id);
CREATE INDEX idx_backlot_updates_public ON backlot_project_updates(is_public) WHERE is_public = TRUE;

-- Contacts
CREATE INDEX idx_backlot_contacts_project ON backlot_project_contacts(project_id);
CREATE INDEX idx_backlot_contacts_type ON backlot_project_contacts(contact_type);
CREATE INDEX idx_backlot_contacts_status ON backlot_project_contacts(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE backlot_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_production_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_call_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_call_sheet_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_contacts ENABLE ROW LEVEL SECURITY;

-- Helper function to check project membership
CREATE OR REPLACE FUNCTION is_backlot_project_member(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM backlot_project_members
    WHERE project_id = project_uuid AND user_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM backlot_projects
    WHERE id = project_uuid AND owner_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can edit project
CREATE OR REPLACE FUNCTION can_edit_backlot_project(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM backlot_projects
    WHERE id = project_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM backlot_project_members
    WHERE project_id = project_uuid AND user_id = user_uuid AND role IN ('owner', 'admin', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin of project
CREATE OR REPLACE FUNCTION is_backlot_project_admin(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM backlot_projects
    WHERE id = project_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM backlot_project_members
    WHERE project_id = project_uuid AND user_id = user_uuid AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES: backlot_projects
-- =====================================================

-- Anyone can view public projects
CREATE POLICY "Public projects are viewable by anyone"
  ON backlot_projects FOR SELECT
  USING (visibility = 'public');

-- Members can view their projects
CREATE POLICY "Members can view their projects"
  ON backlot_projects FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_backlot_project_member(id, auth.uid())
  );

-- Anyone authenticated can view unlisted projects (if they have the slug)
CREATE POLICY "Unlisted projects viewable by authenticated users"
  ON backlot_projects FOR SELECT
  USING (visibility = 'unlisted' AND auth.uid() IS NOT NULL);

-- Owner can insert
CREATE POLICY "Users can create projects"
  ON backlot_projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owner/Admin can update
CREATE POLICY "Admins can update projects"
  ON backlot_projects FOR UPDATE
  USING (is_backlot_project_admin(id, auth.uid()));

-- Owner can delete
CREATE POLICY "Owners can delete projects"
  ON backlot_projects FOR DELETE
  USING (owner_id = auth.uid());

-- =====================================================
-- RLS POLICIES: backlot_project_members
-- =====================================================

CREATE POLICY "Members can view project members"
  ON backlot_project_members FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Admins can manage members"
  ON backlot_project_members FOR INSERT
  WITH CHECK (is_backlot_project_admin(project_id, auth.uid()));

CREATE POLICY "Admins can update members"
  ON backlot_project_members FOR UPDATE
  USING (is_backlot_project_admin(project_id, auth.uid()));

CREATE POLICY "Admins can remove members"
  ON backlot_project_members FOR DELETE
  USING (is_backlot_project_admin(project_id, auth.uid()) OR user_id = auth.uid());

-- =====================================================
-- RLS POLICIES: backlot_production_days
-- =====================================================

CREATE POLICY "Members can view production days"
  ON backlot_production_days FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can manage production days"
  ON backlot_production_days FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update production days"
  ON backlot_production_days FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete production days"
  ON backlot_production_days FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- RLS POLICIES: backlot_call_sheets
-- =====================================================

CREATE POLICY "Members can view call sheets"
  ON backlot_call_sheets FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create call sheets"
  ON backlot_call_sheets FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update call sheets"
  ON backlot_call_sheets FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete call sheets"
  ON backlot_call_sheets FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- RLS POLICIES: backlot_call_sheet_people
-- =====================================================

CREATE POLICY "Members can view call sheet people"
  ON backlot_call_sheet_people FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND is_backlot_project_member(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can manage call sheet people"
  ON backlot_call_sheet_people FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can update call sheet people"
  ON backlot_call_sheet_people FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete call sheet people"
  ON backlot_call_sheet_people FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

-- =====================================================
-- RLS POLICIES: backlot_tasks
-- =====================================================

CREATE POLICY "Members can view tasks"
  ON backlot_tasks FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create tasks"
  ON backlot_tasks FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update tasks"
  ON backlot_tasks FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete tasks"
  ON backlot_tasks FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- RLS POLICIES: backlot_locations
-- =====================================================

CREATE POLICY "Members can view locations"
  ON backlot_locations FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create locations"
  ON backlot_locations FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update locations"
  ON backlot_locations FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete locations"
  ON backlot_locations FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- RLS POLICIES: backlot_gear_items
-- =====================================================

CREATE POLICY "Members can view gear"
  ON backlot_gear_items FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create gear"
  ON backlot_gear_items FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update gear"
  ON backlot_gear_items FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete gear"
  ON backlot_gear_items FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- RLS POLICIES: backlot_project_updates
-- =====================================================

-- Public updates on public projects
CREATE POLICY "Public updates viewable by anyone"
  ON backlot_project_updates FOR SELECT
  USING (
    is_public = TRUE AND
    EXISTS (
      SELECT 1 FROM backlot_projects p
      WHERE p.id = project_id AND p.visibility = 'public'
    )
  );

-- Members can view all updates
CREATE POLICY "Members can view all updates"
  ON backlot_project_updates FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create updates"
  ON backlot_project_updates FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update updates"
  ON backlot_project_updates FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete updates"
  ON backlot_project_updates FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- RLS POLICIES: backlot_project_contacts
-- =====================================================

CREATE POLICY "Members can view contacts"
  ON backlot_project_contacts FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create contacts"
  ON backlot_project_contacts FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update contacts"
  ON backlot_project_contacts FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete contacts"
  ON backlot_project_contacts FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- TABLE: backlot_project_credits
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_project_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Person (can be platform user or external)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, -- Name to display (may differ from profile)

  -- Credit Info
  credit_role TEXT NOT NULL, -- "Director", "Producer", "Cinematographer", etc.
  department TEXT, -- "Direction", "Camera", "Sound", etc.

  -- Display Options
  is_primary BOOLEAN DEFAULT FALSE, -- Show prominently on public page
  is_public BOOLEAN DEFAULT TRUE, -- Show on public project page
  order_index INTEGER DEFAULT 0, -- Sort order within department

  -- Optional Details
  endorsement_note TEXT, -- Brief note like "Academy Award Winner"
  imdb_id TEXT, -- IMDB nm ID for linking

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_project_credits_updated_at
  BEFORE UPDATE ON backlot_project_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Credits Indexes
CREATE INDEX idx_backlot_credits_project ON backlot_project_credits(project_id);
CREATE INDEX idx_backlot_credits_user ON backlot_project_credits(user_id);
CREATE INDEX idx_backlot_credits_department ON backlot_project_credits(department);
CREATE INDEX idx_backlot_credits_order ON backlot_project_credits(project_id, department, order_index);

-- Credits RLS
ALTER TABLE backlot_project_credits ENABLE ROW LEVEL SECURITY;

-- Public credits viewable on public projects
CREATE POLICY "Public credits viewable by anyone"
  ON backlot_project_credits FOR SELECT
  USING (
    is_public = TRUE AND
    EXISTS (
      SELECT 1 FROM backlot_projects p
      WHERE p.id = project_id AND p.visibility IN ('public', 'unlisted')
    )
  );

-- Members can view all credits
CREATE POLICY "Members can view all credits"
  ON backlot_project_credits FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

CREATE POLICY "Editors can create credits"
  ON backlot_project_credits FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can update credits"
  ON backlot_project_credits FOR UPDATE
  USING (can_edit_backlot_project(project_id, auth.uid()));

CREATE POLICY "Editors can delete credits"
  ON backlot_project_credits FOR DELETE
  USING (can_edit_backlot_project(project_id, auth.uid()));

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL ON backlot_projects TO authenticated;
GRANT ALL ON backlot_project_members TO authenticated;
GRANT ALL ON backlot_production_days TO authenticated;
GRANT ALL ON backlot_call_sheets TO authenticated;
GRANT ALL ON backlot_call_sheet_people TO authenticated;
GRANT ALL ON backlot_tasks TO authenticated;
GRANT ALL ON backlot_locations TO authenticated;
GRANT ALL ON backlot_gear_items TO authenticated;
GRANT ALL ON backlot_project_updates TO authenticated;
GRANT ALL ON backlot_project_contacts TO authenticated;
GRANT ALL ON backlot_project_credits TO authenticated;

-- Read-only for public project pages
GRANT SELECT ON backlot_projects TO anon;
GRANT SELECT ON backlot_project_updates TO anon;
GRANT SELECT ON backlot_project_credits TO anon;

-- =====================================================
-- TABLE: backlot_call_sheet_sends (Tracking Distribution)
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Who sent it
  sent_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- When
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Recipients (JSONB for flexibility)
  -- Example: [{ "user_id": "...", "email": "...", "name": "..." }, { "email": "guest@example.com", "name": "Guest" }]
  recipients JSONB NOT NULL DEFAULT '[]',

  -- How (email, notification, or both)
  channel TEXT NOT NULL CHECK (channel IN ('email', 'notification', 'email_and_notification')),

  -- Optional message included
  message TEXT,

  -- Stats
  recipient_count INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0
);

-- Indexes for call sheet sends
CREATE INDEX idx_backlot_sends_call_sheet ON backlot_call_sheet_sends(call_sheet_id);
CREATE INDEX idx_backlot_sends_project ON backlot_call_sheet_sends(project_id);
CREATE INDEX idx_backlot_sends_sent_by ON backlot_call_sheet_sends(sent_by_user_id);
CREATE INDEX idx_backlot_sends_sent_at ON backlot_call_sheet_sends(sent_at);

-- RLS for call sheet sends
ALTER TABLE backlot_call_sheet_sends ENABLE ROW LEVEL SECURITY;

-- Members can view send history
CREATE POLICY "Members can view call sheet sends"
  ON backlot_call_sheet_sends FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

-- Editors can create sends
CREATE POLICY "Editors can create call sheet sends"
  ON backlot_call_sheet_sends FOR INSERT
  WITH CHECK (can_edit_backlot_project(project_id, auth.uid()));

-- Grant permissions
GRANT ALL ON backlot_call_sheet_sends TO authenticated;

-- =====================================================
-- CALL SHEET TEMPLATE SYSTEM - Extensions for Production-Grade Call Sheets
-- =====================================================

-- =====================================================
-- ENUM: Call Sheet Template Types
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_call_sheet_template AS ENUM ('feature', 'documentary', 'music_video', 'commercial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Interior/Exterior for scenes
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_scene_int_ext AS ENUM ('INT', 'EXT', 'INT/EXT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Time of day for scenes
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_scene_time_of_day AS ENUM ('DAY', 'NIGHT', 'DAWN', 'DUSK', 'DAY/NIGHT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ALTER TABLE: backlot_call_sheets - Add extended fields
-- =====================================================

-- Template type
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'feature';

-- Production info overrides
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_title TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_company TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS episode_or_segment_title TEXT;

-- Day numbers
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS shoot_day_number INTEGER;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS total_shoot_days INTEGER;

-- Extended timing
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS breakfast_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS lunch_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS dinner_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS estimated_wrap_time TIME;

-- Extended location
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS location_region TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS parking_instructions TEXT;

-- Weather details
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS weather_high TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS weather_low TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS weather_conditions TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS sunrise_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS sunset_time TIME;

-- Key personnel
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS director_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS producer_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS first_ad_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS upm_name TEXT;

-- Department notes
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS camera_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS g_and_e_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS sound_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS art_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS wardrobe_makeup_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS transportation_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS catering_notes TEXT;

-- Extended emergency/safety
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS medic_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS medic_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS fire_station_address TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS police_station_address TEXT;

-- Branding and output
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS header_logo_url TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;

-- Custom contacts (JSONB array for additional contacts like Location Manager, Stunt Coordinator, etc.)
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS custom_contacts JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- ALTER TABLE: backlot_call_sheet_people - Add cast fields
-- =====================================================

-- Distinguish cast from crew
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS is_cast BOOLEAN DEFAULT FALSE;
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS cast_number TEXT;
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS character_name TEXT;

-- Status and reporting
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'working'; -- working, hold, travel, wrap
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS report_to TEXT; -- Who they report to on set
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS pickup_time TIME;
ALTER TABLE backlot_call_sheet_people ADD COLUMN IF NOT EXISTS pickup_location TEXT;

-- =====================================================
-- TABLE: backlot_call_sheet_scenes - Scene/Segment Breakdown
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,

  -- Scene identification
  scene_number TEXT, -- "1", "1A", "12B", etc.
  segment_label TEXT, -- Alternative label for non-narrative: "Setup A", "Interview 1", "Performance Block 1"

  -- Scene details (narrative style)
  page_count TEXT, -- Page count in eighths: "2 3/8", "1/8", etc.
  set_name TEXT NOT NULL, -- "APARTMENT - LIVING ROOM"
  int_ext TEXT, -- 'INT', 'EXT', 'INT/EXT'
  time_of_day TEXT, -- 'DAY', 'NIGHT', 'DAWN', 'DUSK'
  description TEXT, -- Brief description of scene action

  -- Cast in scene (comma-separated cast numbers or names)
  cast_ids TEXT, -- "1, 2, 5" referring to cast numbers
  cast_names TEXT, -- Alternative: "John, Sarah, Mike"

  -- Location reference
  location_id UUID REFERENCES backlot_locations(id) ON DELETE SET NULL,
  location_notes TEXT,

  -- Scheduling
  estimated_duration_minutes INTEGER,
  script_notes TEXT,
  special_requirements TEXT, -- VFX, stunts, animals, etc.

  -- Order for display
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_call_sheet_scenes_updated_at
  BEFORE UPDATE ON backlot_call_sheet_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for scenes
CREATE INDEX IF NOT EXISTS idx_backlot_scenes_call_sheet ON backlot_call_sheet_scenes(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_backlot_scenes_sort ON backlot_call_sheet_scenes(call_sheet_id, sort_order);

-- RLS for scenes
ALTER TABLE backlot_call_sheet_scenes ENABLE ROW LEVEL SECURITY;

-- Members can view scenes
CREATE POLICY "Members can view call sheet scenes"
  ON backlot_call_sheet_scenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND is_backlot_project_member(cs.project_id, auth.uid())
    )
  );

-- Editors can manage scenes
CREATE POLICY "Editors can create call sheet scenes"
  ON backlot_call_sheet_scenes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can update call sheet scenes"
  ON backlot_call_sheet_scenes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete call sheet scenes"
  ON backlot_call_sheet_scenes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

-- Grant permissions
GRANT ALL ON backlot_call_sheet_scenes TO authenticated;

-- =====================================================
-- ALTER TABLE: backlot_projects - Add header logo for branding
-- =====================================================
ALTER TABLE backlot_projects ADD COLUMN IF NOT EXISTS header_logo_url TEXT;

-- =====================================================
-- ALTER TABLE: backlot_tasks - Add source tracking for sync
-- =====================================================
ALTER TABLE backlot_tasks ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'call_sheet', 'manual', etc.
ALTER TABLE backlot_tasks ADD COLUMN IF NOT EXISTS source_id UUID; -- Reference to source (call_sheet_id)

-- Index for source lookup
CREATE INDEX IF NOT EXISTS idx_backlot_tasks_source ON backlot_tasks(source_type, source_id);
ALTER TABLE backlot_tasks ADD COLUMN IF NOT EXISTS source_call_sheet_id UUID REFERENCES backlot_call_sheets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_backlot_tasks_source_call_sheet ON backlot_tasks(source_call_sheet_id);

-- =====================================================
-- TABLE: backlot_call_sheet_locations - Multiple locations per call sheet
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
  location_number INTEGER NOT NULL DEFAULT 1,  -- Location 1, Location 2, etc.
  location_id UUID REFERENCES backlot_locations(id) ON DELETE SET NULL,  -- Optional link to master location
  name TEXT NOT NULL,
  address TEXT,
  parking_instructions TEXT,
  basecamp_location TEXT,
  call_time TIME,  -- Specific call time for this location
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_backlot_call_sheet_locations_call_sheet ON backlot_call_sheet_locations(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_backlot_call_sheet_locations_location ON backlot_call_sheet_locations(location_id);

-- Enable RLS
ALTER TABLE backlot_call_sheet_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call sheet locations
CREATE POLICY "Users can view call sheet locations for accessible call sheets"
  ON backlot_call_sheet_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND is_backlot_project_member(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can insert call sheet locations"
  ON backlot_call_sheet_locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can update call sheet locations"
  ON backlot_call_sheet_locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

CREATE POLICY "Editors can delete call sheet locations"
  ON backlot_call_sheet_locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_call_sheets cs
      WHERE cs.id = call_sheet_id
      AND can_edit_backlot_project(cs.project_id, auth.uid())
    )
  );

-- Grant permissions
GRANT ALL ON backlot_call_sheet_locations TO authenticated;

-- =====================================================
-- BUDGET SYSTEM - Production Budgets, Daily Budgets, and Receipts
-- =====================================================

-- =====================================================
-- ENUM: Budget Status
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_budget_status AS ENUM ('draft', 'pending_approval', 'approved', 'locked', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Receipt OCR Status
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_receipt_ocr_status AS ENUM ('pending', 'processing', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLE: backlot_budgets - Main project budget
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

  -- Budget Info
  name TEXT NOT NULL DEFAULT 'Main Budget',
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Status
  status backlot_budget_status DEFAULT 'draft',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,

  -- Totals (computed/cached)
  estimated_total NUMERIC(12, 2) DEFAULT 0,
  actual_total NUMERIC(12, 2) DEFAULT 0,
  variance NUMERIC(12, 2) GENERATED ALWAYS AS (actual_total - estimated_total) STORED,

  -- Contingency
  contingency_percent NUMERIC(5, 2) DEFAULT 10.00,
  contingency_amount NUMERIC(12, 2) GENERATED ALWAYS AS (estimated_total * contingency_percent / 100) STORED,

  -- Notes
  notes TEXT,

  -- Version tracking
  version INTEGER DEFAULT 1,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active budget per project (for now)
  UNIQUE(project_id, name)
);

CREATE TRIGGER backlot_budgets_updated_at
  BEFORE UPDATE ON backlot_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_budgets_project ON backlot_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_budgets_status ON backlot_budgets(status);

-- =====================================================
-- TABLE: backlot_budget_categories - Budget category groups
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES backlot_budgets(id) ON DELETE CASCADE,

  -- Category Info
  name TEXT NOT NULL, -- "Pre-Production", "Cast", "Crew", "Equipment", "Locations", "Post-Production"
  code TEXT, -- "A", "B", "C" or "1000", "2000", "3000" for industry-standard codes
  description TEXT,

  -- Computed subtotals
  estimated_subtotal NUMERIC(12, 2) DEFAULT 0,
  actual_subtotal NUMERIC(12, 2) DEFAULT 0,

  -- Display
  sort_order INTEGER DEFAULT 0,
  color TEXT, -- Hex color for UI
  icon TEXT, -- Icon name for UI

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_budget_categories_updated_at
  BEFORE UPDATE ON backlot_budget_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_budget_categories_budget ON backlot_budget_categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_budget_categories_sort ON backlot_budget_categories(budget_id, sort_order);

-- =====================================================
-- TABLE: backlot_budget_line_items - Individual budget items
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES backlot_budgets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES backlot_budget_categories(id) ON DELETE SET NULL,

  -- Line Item Info
  account_code TEXT, -- Industry budget code: "1100", "2100", "3100"
  description TEXT NOT NULL, -- "Director Fee", "Camera Package", "Location Scout"

  -- Rate Calculation
  rate_type TEXT DEFAULT 'flat', -- 'flat', 'daily', 'weekly', 'hourly', 'per_unit'
  rate_amount NUMERIC(12, 2) DEFAULT 0, -- Per-unit rate
  quantity NUMERIC(10, 2) DEFAULT 1, -- Number of units/days/weeks
  units TEXT, -- "days", "weeks", "hours", "allow"

  -- Totals
  estimated_total NUMERIC(12, 2) GENERATED ALWAYS AS (rate_amount * quantity) STORED,
  actual_total NUMERIC(12, 2) DEFAULT 0, -- Manually entered or from receipts/daily budgets
  variance NUMERIC(12, 2) GENERATED ALWAYS AS (actual_total - (rate_amount * quantity)) STORED,

  -- Additional tracking
  vendor_name TEXT, -- Primary vendor for this line
  po_number TEXT, -- Purchase order reference
  invoice_reference TEXT, -- Invoice number

  -- Notes
  notes TEXT,
  internal_notes TEXT, -- Producer-only notes

  -- Allocation tracking (for spreading across days)
  is_allocated_to_days BOOLEAN DEFAULT FALSE,
  total_allocated NUMERIC(12, 2) DEFAULT 0,

  -- Status
  is_locked BOOLEAN DEFAULT FALSE,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_budget_line_items_updated_at
  BEFORE UPDATE ON backlot_budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_budget ON backlot_budget_line_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_category ON backlot_budget_line_items(category_id);
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_sort ON backlot_budget_line_items(budget_id, category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_account_code ON backlot_budget_line_items(budget_id, account_code);

-- =====================================================
-- TABLE: backlot_daily_budgets - Per-production-day budget summary
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_daily_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES backlot_budgets(id) ON DELETE CASCADE,
  production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,

  -- Convenience field (should match production_days.date)
  date DATE NOT NULL,

  -- Totals (aggregated from daily items + receipts)
  estimated_total NUMERIC(12, 2) DEFAULT 0,
  actual_total NUMERIC(12, 2) DEFAULT 0,
  variance NUMERIC(12, 2) GENERATED ALWAYS AS (actual_total - estimated_total) STORED,

  -- Status indicators
  variance_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
    CASE WHEN estimated_total > 0 THEN ((actual_total - estimated_total) / estimated_total * 100) ELSE 0 END
  ) STORED,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One daily budget per production day
  UNIQUE(project_id, production_day_id)
);

CREATE TRIGGER backlot_daily_budgets_updated_at
  BEFORE UPDATE ON backlot_daily_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_daily_budgets_project ON backlot_daily_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_daily_budgets_budget ON backlot_daily_budgets(budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_daily_budgets_day ON backlot_daily_budgets(production_day_id);
CREATE INDEX IF NOT EXISTS idx_backlot_daily_budgets_date ON backlot_daily_budgets(date);

-- =====================================================
-- TABLE: backlot_daily_budget_items - Per-day budget line allocations
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_daily_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_budget_id UUID NOT NULL REFERENCES backlot_daily_budgets(id) ON DELETE CASCADE,
  budget_line_item_id UUID REFERENCES backlot_budget_line_items(id) ON DELETE SET NULL,

  -- Item Info
  label TEXT NOT NULL, -- Description for this day's allocation
  category_name TEXT, -- Denormalized for display

  -- Day's allocation
  estimated_amount NUMERIC(12, 2) DEFAULT 0, -- Allocated estimate for this day
  actual_amount NUMERIC(12, 2) DEFAULT 0, -- Actual spend for this day

  -- Tracking
  vendor_name TEXT,
  notes TEXT,

  -- For ad-hoc items not linked to main budget
  is_ad_hoc BOOLEAN DEFAULT FALSE,

  -- Display
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_daily_budget_items_updated_at
  BEFORE UPDATE ON backlot_daily_budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_daily_items_daily_budget ON backlot_daily_budget_items(daily_budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_daily_items_line_item ON backlot_daily_budget_items(budget_line_item_id);

-- =====================================================
-- TABLE: backlot_budget_day_links - Link budget line items to production days
-- (For tracking which days a line item is allocated to)
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_budget_day_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES backlot_budgets(id) ON DELETE CASCADE,
  budget_line_item_id UUID NOT NULL REFERENCES backlot_budget_line_items(id) ON DELETE CASCADE,
  production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
  call_sheet_id UUID REFERENCES backlot_call_sheets(id) ON DELETE SET NULL,

  -- Allocation for this day
  estimated_share NUMERIC(12, 2) DEFAULT 0, -- Portion of line item's estimate for this day
  actual_share NUMERIC(12, 2) DEFAULT 0, -- Portion of actual for this day

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One link per line item + production day combination
  UNIQUE(budget_line_item_id, production_day_id)
);

CREATE TRIGGER backlot_budget_day_links_updated_at
  BEFORE UPDATE ON backlot_budget_day_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_day_links_project ON backlot_budget_day_links(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_day_links_budget ON backlot_budget_day_links(budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_day_links_line_item ON backlot_budget_day_links(budget_line_item_id);
CREATE INDEX IF NOT EXISTS idx_backlot_day_links_day ON backlot_budget_day_links(production_day_id);
CREATE INDEX IF NOT EXISTS idx_backlot_day_links_call_sheet ON backlot_budget_day_links(call_sheet_id);

-- =====================================================
-- TABLE: backlot_receipts - Uploaded receipts with OCR
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES backlot_budgets(id) ON DELETE SET NULL,
  daily_budget_id UUID REFERENCES backlot_daily_budgets(id) ON DELETE SET NULL,
  budget_line_item_id UUID REFERENCES backlot_budget_line_items(id) ON DELETE SET NULL,

  -- File Info
  file_url TEXT NOT NULL,
  original_filename TEXT,
  file_type TEXT, -- 'image/jpeg', 'image/png', 'application/pdf'
  file_size_bytes INTEGER,

  -- Extracted/Entered Data
  vendor_name TEXT,
  description TEXT,
  purchase_date DATE,
  amount NUMERIC(12, 2),
  tax_amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',

  -- OCR Processing
  ocr_status backlot_receipt_ocr_status DEFAULT 'pending',
  ocr_confidence NUMERIC(5, 2), -- 0-100
  raw_ocr_json JSONB, -- Full OCR response for debugging
  extracted_text TEXT, -- Plain text extraction

  -- Mapping Status
  is_mapped BOOLEAN DEFAULT FALSE, -- Has been assigned to a line item
  is_verified BOOLEAN DEFAULT FALSE, -- User confirmed the extracted data

  -- Payment tracking
  payment_method TEXT, -- 'cash', 'card', 'check', 'wire', 'petty_cash'
  reimbursement_status TEXT DEFAULT 'not_applicable', -- 'not_applicable', 'pending', 'approved', 'reimbursed'
  reimbursement_to TEXT, -- Who gets reimbursed

  -- Notes
  notes TEXT,

  -- Metadata
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER backlot_receipts_updated_at
  BEFORE UPDATE ON backlot_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_project ON backlot_receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_budget ON backlot_receipts(budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_daily_budget ON backlot_receipts(daily_budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_line_item ON backlot_receipts(budget_line_item_id);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_date ON backlot_receipts(purchase_date);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_ocr_status ON backlot_receipts(ocr_status);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_mapped ON backlot_receipts(is_mapped);
CREATE INDEX IF NOT EXISTS idx_backlot_receipts_created_by ON backlot_receipts(created_by_user_id);

-- =====================================================
-- RLS POLICIES: Budget System
-- =====================================================

ALTER TABLE backlot_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_daily_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_daily_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_budget_day_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_receipts ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user can manage budget (owner, admin, or editor with producer/PM role)
CREATE OR REPLACE FUNCTION can_manage_backlot_budget(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Project owner can always manage budget
  IF EXISTS (
    SELECT 1 FROM backlot_projects
    WHERE id = project_uuid AND owner_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check for admin role or producer/production_manager production_role
  RETURN EXISTS (
    SELECT 1 FROM backlot_project_members
    WHERE project_id = project_uuid
    AND user_id = user_uuid
    AND (
      role IN ('owner', 'admin')
      OR production_role ILIKE '%producer%'
      OR production_role ILIKE '%production%manager%'
      OR production_role ILIKE '%pm%'
      OR production_role ILIKE '%upm%'
      OR production_role ILIKE '%line%producer%'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Budget Policies
CREATE POLICY "Budget managers can view budgets"
  ON backlot_budgets FOR SELECT
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can create budgets"
  ON backlot_budgets FOR INSERT
  WITH CHECK (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can update budgets"
  ON backlot_budgets FOR UPDATE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can delete budgets"
  ON backlot_budgets FOR DELETE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

-- Budget Categories Policies
CREATE POLICY "Budget managers can view categories"
  ON backlot_budget_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can create categories"
  ON backlot_budget_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can update categories"
  ON backlot_budget_categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can delete categories"
  ON backlot_budget_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

-- Budget Line Items Policies
CREATE POLICY "Budget managers can view line items"
  ON backlot_budget_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can create line items"
  ON backlot_budget_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can update line items"
  ON backlot_budget_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can delete line items"
  ON backlot_budget_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

-- Daily Budget Policies
CREATE POLICY "Budget managers can view daily budgets"
  ON backlot_daily_budgets FOR SELECT
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can create daily budgets"
  ON backlot_daily_budgets FOR INSERT
  WITH CHECK (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can update daily budgets"
  ON backlot_daily_budgets FOR UPDATE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can delete daily budgets"
  ON backlot_daily_budgets FOR DELETE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

-- Daily Budget Items Policies
CREATE POLICY "Budget managers can view daily budget items"
  ON backlot_daily_budget_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_daily_budgets db
      WHERE db.id = daily_budget_id
      AND can_manage_backlot_budget(db.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can create daily budget items"
  ON backlot_daily_budget_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM backlot_daily_budgets db
      WHERE db.id = daily_budget_id
      AND can_manage_backlot_budget(db.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can update daily budget items"
  ON backlot_daily_budget_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_daily_budgets db
      WHERE db.id = daily_budget_id
      AND can_manage_backlot_budget(db.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can delete daily budget items"
  ON backlot_daily_budget_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM backlot_daily_budgets db
      WHERE db.id = daily_budget_id
      AND can_manage_backlot_budget(db.project_id, auth.uid())
    )
  );

-- Budget Day Links Policies
CREATE POLICY "Budget managers can view day links"
  ON backlot_budget_day_links FOR SELECT
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can create day links"
  ON backlot_budget_day_links FOR INSERT
  WITH CHECK (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can update day links"
  ON backlot_budget_day_links FOR UPDATE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can delete day links"
  ON backlot_budget_day_links FOR DELETE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

-- Receipts Policies
CREATE POLICY "Budget managers can view receipts"
  ON backlot_receipts FOR SELECT
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can create receipts"
  ON backlot_receipts FOR INSERT
  WITH CHECK (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can update receipts"
  ON backlot_receipts FOR UPDATE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

CREATE POLICY "Budget managers can delete receipts"
  ON backlot_receipts FOR DELETE
  USING (can_manage_backlot_budget(project_id, auth.uid()));

-- =====================================================
-- GRANTS for Budget System
-- =====================================================
GRANT ALL ON backlot_budgets TO authenticated;
GRANT ALL ON backlot_budget_categories TO authenticated;
GRANT ALL ON backlot_budget_line_items TO authenticated;
GRANT ALL ON backlot_daily_budgets TO authenticated;
GRANT ALL ON backlot_daily_budget_items TO authenticated;
GRANT ALL ON backlot_budget_day_links TO authenticated;
GRANT ALL ON backlot_receipts TO authenticated;

-- =====================================================
-- FUNCTIONS: Budget Aggregation/Recalculation
-- =====================================================

-- Function to recalculate budget totals
CREATE OR REPLACE FUNCTION recalculate_budget_totals(p_budget_id UUID)
RETURNS VOID AS $$
DECLARE
  v_estimated NUMERIC(12, 2);
  v_actual NUMERIC(12, 2);
BEGIN
  -- Calculate totals from line items
  SELECT
    COALESCE(SUM(estimated_total), 0),
    COALESCE(SUM(actual_total), 0)
  INTO v_estimated, v_actual
  FROM backlot_budget_line_items
  WHERE budget_id = p_budget_id;

  -- Update budget totals
  UPDATE backlot_budgets
  SET
    estimated_total = v_estimated,
    actual_total = v_actual,
    updated_at = NOW()
  WHERE id = p_budget_id;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate category subtotals
CREATE OR REPLACE FUNCTION recalculate_category_subtotals(p_category_id UUID)
RETURNS VOID AS $$
DECLARE
  v_estimated NUMERIC(12, 2);
  v_actual NUMERIC(12, 2);
BEGIN
  SELECT
    COALESCE(SUM(estimated_total), 0),
    COALESCE(SUM(actual_total), 0)
  INTO v_estimated, v_actual
  FROM backlot_budget_line_items
  WHERE category_id = p_category_id;

  UPDATE backlot_budget_categories
  SET
    estimated_subtotal = v_estimated,
    actual_subtotal = v_actual,
    updated_at = NOW()
  WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate daily budget totals
CREATE OR REPLACE FUNCTION recalculate_daily_budget_totals(p_daily_budget_id UUID)
RETURNS VOID AS $$
DECLARE
  v_estimated NUMERIC(12, 2);
  v_actual NUMERIC(12, 2);
  v_receipt_total NUMERIC(12, 2);
BEGIN
  -- Sum from daily budget items
  SELECT
    COALESCE(SUM(estimated_amount), 0),
    COALESCE(SUM(actual_amount), 0)
  INTO v_estimated, v_actual
  FROM backlot_daily_budget_items
  WHERE daily_budget_id = p_daily_budget_id;

  -- Add receipts directly linked to this daily budget
  SELECT COALESCE(SUM(amount), 0)
  INTO v_receipt_total
  FROM backlot_receipts
  WHERE daily_budget_id = p_daily_budget_id
  AND is_mapped = TRUE;

  -- Update daily budget totals
  UPDATE backlot_daily_budgets
  SET
    estimated_total = v_estimated,
    actual_total = v_actual + v_receipt_total,
    updated_at = NOW()
  WHERE id = p_daily_budget_id;
END;
$$ LANGUAGE plpgsql;

-- Function to sync line item actuals from daily allocations and receipts
CREATE OR REPLACE FUNCTION sync_line_item_actuals(p_line_item_id UUID)
RETURNS VOID AS $$
DECLARE
  v_daily_actual NUMERIC(12, 2);
  v_receipt_actual NUMERIC(12, 2);
BEGIN
  -- Sum from daily budget items
  SELECT COALESCE(SUM(dbi.actual_amount), 0)
  INTO v_daily_actual
  FROM backlot_daily_budget_items dbi
  WHERE dbi.budget_line_item_id = p_line_item_id;

  -- Sum from receipts linked to this line item
  SELECT COALESCE(SUM(r.amount), 0)
  INTO v_receipt_actual
  FROM backlot_receipts r
  WHERE r.budget_line_item_id = p_line_item_id
  AND r.is_mapped = TRUE;

  -- Update line item actual_total
  UPDATE backlot_budget_line_items
  SET
    actual_total = v_daily_actual + v_receipt_actual,
    updated_at = NOW()
  WHERE id = p_line_item_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS: Auto-update budget aggregations
-- =====================================================

-- Trigger function to update budget totals when line items change
CREATE OR REPLACE FUNCTION trigger_update_budget_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL THEN
      PERFORM recalculate_category_subtotals(OLD.category_id);
    END IF;
    PERFORM recalculate_budget_totals(OLD.budget_id);
    RETURN OLD;
  ELSE
    IF NEW.category_id IS NOT NULL THEN
      PERFORM recalculate_category_subtotals(NEW.category_id);
    END IF;
    IF OLD IS NOT NULL AND OLD.category_id IS NOT NULL AND OLD.category_id != NEW.category_id THEN
      PERFORM recalculate_category_subtotals(OLD.category_id);
    END IF;
    PERFORM recalculate_budget_totals(NEW.budget_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_line_item_budget_update
  AFTER INSERT OR UPDATE OR DELETE ON backlot_budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_budget_totals();

-- Trigger function to update daily budget totals when items change
CREATE OR REPLACE FUNCTION trigger_update_daily_budget_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_daily_budget_totals(OLD.daily_budget_id);
    IF OLD.budget_line_item_id IS NOT NULL THEN
      PERFORM sync_line_item_actuals(OLD.budget_line_item_id);
    END IF;
    RETURN OLD;
  ELSE
    PERFORM recalculate_daily_budget_totals(NEW.daily_budget_id);
    IF NEW.budget_line_item_id IS NOT NULL THEN
      PERFORM sync_line_item_actuals(NEW.budget_line_item_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_daily_item_totals_update
  AFTER INSERT OR UPDATE OR DELETE ON backlot_daily_budget_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_budget_totals();

-- Trigger function to update totals when receipts change
CREATE OR REPLACE FUNCTION trigger_update_receipt_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.daily_budget_id IS NOT NULL THEN
      PERFORM recalculate_daily_budget_totals(OLD.daily_budget_id);
    END IF;
    IF OLD.budget_line_item_id IS NOT NULL THEN
      PERFORM sync_line_item_actuals(OLD.budget_line_item_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.daily_budget_id IS NOT NULL THEN
      PERFORM recalculate_daily_budget_totals(NEW.daily_budget_id);
    END IF;
    IF NEW.budget_line_item_id IS NOT NULL THEN
      PERFORM sync_line_item_actuals(NEW.budget_line_item_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_receipt_totals_update
  AFTER INSERT OR UPDATE OR DELETE ON backlot_receipts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_receipt_totals();

-- =====================================================
-- BUDGET SYSTEM UPGRADE: Professional Film/TV Budgets
-- Template-driven budgets with Top Sheet, Account codes, and enhanced calculations
-- =====================================================

-- =====================================================
-- ENUM: Budget Project Type Template
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_budget_project_type AS ENUM (
    'feature',
    'episodic',
    'documentary',
    'music_video',
    'commercial',
    'short',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Budget Category Type (for Top Sheet grouping)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_category_type AS ENUM (
    'above_the_line',
    'production',
    'post',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Budget Phase (what production phase the item applies to)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_budget_phase AS ENUM (
    'development',
    'prep',
    'production',
    'wrap',
    'post',
    'delivery'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Calculation Mode (enhanced rate types)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE backlot_calc_mode AS ENUM (
    'flat',
    'rate_x_days',
    'rate_x_weeks',
    'rate_x_units',
    'rate_x_episodes',
    'rate_x_hours',
    'percent_of_total',
    'percent_of_subtotal'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ALTER TABLE: backlot_budgets - Add professional budget fields
-- =====================================================

-- Add project type template
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS project_type_template backlot_budget_project_type DEFAULT 'feature';

-- Add Top Sheet flag (generated when budget is complete)
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS has_top_sheet BOOLEAN DEFAULT FALSE;

-- Add PDF export fields
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS last_pdf_generated_at TIMESTAMPTZ;

-- Add fringes total (calculated from fringe items)
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS fringes_total NUMERIC(12, 2) DEFAULT 0;

-- Add Grand Total (estimated + contingency + fringes)
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) DEFAULT 0;

-- Add number of shoot days and prep days (used for calculations)
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS shoot_days INTEGER DEFAULT 0;
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS prep_days INTEGER DEFAULT 0;
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS wrap_days INTEGER DEFAULT 0;
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS post_days INTEGER DEFAULT 0;

-- Add episode count (for episodic projects)
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS episode_count INTEGER DEFAULT 1;

-- Add union type (helps determine fringe calculations)
ALTER TABLE backlot_budgets
  ADD COLUMN IF NOT EXISTS union_type TEXT DEFAULT 'non_union';

-- =====================================================
-- ALTER TABLE: backlot_budget_categories - Add professional fields
-- =====================================================

-- Add category type for Top Sheet grouping
ALTER TABLE backlot_budget_categories
  ADD COLUMN IF NOT EXISTS category_type backlot_category_type DEFAULT 'production';

-- Add account code prefix (e.g., "10" for account codes 1000-1999)
ALTER TABLE backlot_budget_categories
  ADD COLUMN IF NOT EXISTS account_code_prefix TEXT;

-- Add phase marker
ALTER TABLE backlot_budget_categories
  ADD COLUMN IF NOT EXISTS phase backlot_budget_phase;

-- Add subtotal for Above-the-Line / Below-the-Line breakdowns
ALTER TABLE backlot_budget_categories
  ADD COLUMN IF NOT EXISTS is_above_the_line BOOLEAN DEFAULT FALSE;

-- =====================================================
-- ALTER TABLE: backlot_budget_line_items - Add professional calculation fields
-- =====================================================

-- Add enhanced calculation mode
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS calc_mode backlot_calc_mode DEFAULT 'flat';

-- Add separate tracking for days/weeks/episodes/units
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS days NUMERIC(6, 2);
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS weeks NUMERIC(6, 2);
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS episodes INTEGER;

-- Add union code for labor items
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS union_code TEXT;

-- Add fringe tracking
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS is_fringe BOOLEAN DEFAULT FALSE;
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS fringe_base_item_id UUID REFERENCES backlot_budget_line_items(id) ON DELETE SET NULL;
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS fringe_percent NUMERIC(5, 2);

-- Add source tracking (for items auto-created from main budget)
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'manual', 'template', 'auto_daily'
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- Add sub-account code for hierarchical codes (e.g., "1100.10")
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS sub_account_code TEXT;

-- Add phase tracking for line items
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS phase backlot_budget_phase;

-- Add department for grouping
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Add calculated total override (allows manual override of generated total)
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS manual_total_override NUMERIC(12, 2);
ALTER TABLE backlot_budget_line_items
  ADD COLUMN IF NOT EXISTS use_manual_total BOOLEAN DEFAULT FALSE;

-- Add index for fringe lookups
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_fringe_base ON backlot_budget_line_items(fringe_base_item_id);
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_is_fringe ON backlot_budget_line_items(is_fringe);
CREATE INDEX IF NOT EXISTS idx_backlot_line_items_calc_mode ON backlot_budget_line_items(calc_mode);

-- =====================================================
-- TABLE: backlot_budget_accounts - Template account registry
-- Stores default account codes for each project type template
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_budget_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template association
  project_type backlot_budget_project_type NOT NULL,

  -- Account Info
  account_code TEXT NOT NULL, -- "1100", "2100", "3100"
  sub_code TEXT, -- For sub-items like "1100.10"
  name TEXT NOT NULL, -- "Director", "Producer", "Camera Package"
  description TEXT,

  -- Classification
  category_type backlot_category_type NOT NULL DEFAULT 'production',
  category_name TEXT NOT NULL, -- "Above the Line - Creative", "Camera Department"
  department TEXT, -- "Camera", "Electric", "Production"
  phase backlot_budget_phase,

  -- Default calculation
  default_calc_mode backlot_calc_mode DEFAULT 'flat',
  default_units TEXT, -- "days", "weeks", "allow", "flat"

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_common BOOLEAN DEFAULT TRUE, -- Show by default in templates

  -- Industry standards
  aicp_code TEXT, -- AICP equivalent code for commercials
  dga_code TEXT, -- DGA code for directing
  union_codes TEXT[], -- Array of applicable union codes

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique account per project type
  UNIQUE(project_type, account_code)
);

CREATE TRIGGER backlot_budget_accounts_updated_at
  BEFORE UPDATE ON backlot_budget_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_accounts_project_type ON backlot_budget_accounts(project_type);
CREATE INDEX IF NOT EXISTS idx_backlot_accounts_category_type ON backlot_budget_accounts(category_type);
CREATE INDEX IF NOT EXISTS idx_backlot_accounts_category_name ON backlot_budget_accounts(category_name);
CREATE INDEX IF NOT EXISTS idx_backlot_accounts_department ON backlot_budget_accounts(department);
CREATE INDEX IF NOT EXISTS idx_backlot_accounts_sort ON backlot_budget_accounts(project_type, category_type, sort_order);

-- Grant access
GRANT ALL ON backlot_budget_accounts TO authenticated;

-- =====================================================
-- TABLE: backlot_budget_top_sheet_cache - Cached Top Sheet data
-- Stores pre-computed Top Sheet summaries for quick display
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_budget_top_sheet_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES backlot_budgets(id) ON DELETE CASCADE,

  -- Summary totals by category type
  above_the_line_total NUMERIC(12, 2) DEFAULT 0,
  production_total NUMERIC(12, 2) DEFAULT 0,
  post_total NUMERIC(12, 2) DEFAULT 0,
  other_total NUMERIC(12, 2) DEFAULT 0,

  -- Subtotals
  total_fringes NUMERIC(12, 2) DEFAULT 0,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  contingency_amount NUMERIC(12, 2) DEFAULT 0,
  grand_total NUMERIC(12, 2) DEFAULT 0,

  -- Category breakdown (JSONB for flexibility)
  category_summaries JSONB DEFAULT '[]',

  -- Last computed
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validation
  is_stale BOOLEAN DEFAULT FALSE,

  -- One cache per budget
  UNIQUE(budget_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_top_sheet_budget ON backlot_budget_top_sheet_cache(budget_id);
CREATE INDEX IF NOT EXISTS idx_backlot_top_sheet_stale ON backlot_budget_top_sheet_cache(is_stale);

-- RLS
ALTER TABLE backlot_budget_top_sheet_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget managers can view top sheet cache"
  ON backlot_budget_top_sheet_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

CREATE POLICY "Budget managers can manage top sheet cache"
  ON backlot_budget_top_sheet_cache FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM backlot_budgets b
      WHERE b.id = budget_id
      AND can_manage_backlot_budget(b.project_id, auth.uid())
    )
  );

-- Grant access
GRANT ALL ON backlot_budget_top_sheet_cache TO authenticated;

-- =====================================================
-- FUNCTION: Calculate line item total based on calc_mode
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_line_item_total(
  p_rate_amount NUMERIC,
  p_quantity NUMERIC,
  p_calc_mode backlot_calc_mode,
  p_days NUMERIC,
  p_weeks NUMERIC,
  p_episodes INTEGER,
  p_use_manual_total BOOLEAN,
  p_manual_total_override NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  -- If manual override is set, use it
  IF p_use_manual_total AND p_manual_total_override IS NOT NULL THEN
    RETURN p_manual_total_override;
  END IF;

  -- Calculate based on calc_mode
  CASE p_calc_mode
    WHEN 'flat' THEN
      RETURN COALESCE(p_rate_amount, 0);
    WHEN 'rate_x_days' THEN
      RETURN COALESCE(p_rate_amount, 0) * COALESCE(p_days, p_quantity, 1);
    WHEN 'rate_x_weeks' THEN
      RETURN COALESCE(p_rate_amount, 0) * COALESCE(p_weeks, p_quantity, 1);
    WHEN 'rate_x_units' THEN
      RETURN COALESCE(p_rate_amount, 0) * COALESCE(p_quantity, 1);
    WHEN 'rate_x_episodes' THEN
      RETURN COALESCE(p_rate_amount, 0) * COALESCE(p_episodes, 1);
    WHEN 'rate_x_hours' THEN
      RETURN COALESCE(p_rate_amount, 0) * COALESCE(p_quantity, 1);
    ELSE
      RETURN COALESCE(p_rate_amount, 0) * COALESCE(p_quantity, 1);
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FUNCTION: Compute and cache Top Sheet data
-- =====================================================
CREATE OR REPLACE FUNCTION compute_budget_top_sheet(p_budget_id UUID)
RETURNS VOID AS $$
DECLARE
  v_atl_total NUMERIC(12, 2) := 0;
  v_prod_total NUMERIC(12, 2) := 0;
  v_post_total NUMERIC(12, 2) := 0;
  v_other_total NUMERIC(12, 2) := 0;
  v_fringes_total NUMERIC(12, 2) := 0;
  v_subtotal NUMERIC(12, 2) := 0;
  v_contingency NUMERIC(12, 2) := 0;
  v_contingency_pct NUMERIC(5, 2) := 0;
  v_grand_total NUMERIC(12, 2) := 0;
  v_category_data JSONB;
BEGIN
  -- Get contingency percentage
  SELECT contingency_percent INTO v_contingency_pct
  FROM backlot_budgets WHERE id = p_budget_id;

  -- Calculate totals by category type
  SELECT
    COALESCE(SUM(CASE WHEN c.category_type = 'above_the_line' THEN li.estimated_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.category_type = 'production' THEN li.estimated_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.category_type = 'post' THEN li.estimated_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.category_type = 'other' THEN li.estimated_total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN li.is_fringe = TRUE THEN li.estimated_total ELSE 0 END), 0)
  INTO v_atl_total, v_prod_total, v_post_total, v_other_total, v_fringes_total
  FROM backlot_budget_line_items li
  LEFT JOIN backlot_budget_categories c ON li.category_id = c.id
  WHERE li.budget_id = p_budget_id;

  -- Calculate subtotal and grand total
  v_subtotal := v_atl_total + v_prod_total + v_post_total + v_other_total;
  v_contingency := v_subtotal * COALESCE(v_contingency_pct, 0) / 100;
  v_grand_total := v_subtotal + v_contingency;

  -- Build category summaries
  SELECT COALESCE(json_agg(row_to_json(cat_summary)), '[]'::json)::jsonb
  INTO v_category_data
  FROM (
    SELECT
      c.id,
      c.name,
      c.code,
      c.category_type,
      c.sort_order,
      COALESCE(SUM(li.estimated_total), 0) as estimated_total,
      COALESCE(SUM(li.actual_total), 0) as actual_total
    FROM backlot_budget_categories c
    LEFT JOIN backlot_budget_line_items li ON li.category_id = c.id
    WHERE c.budget_id = p_budget_id
    GROUP BY c.id, c.name, c.code, c.category_type, c.sort_order
    ORDER BY c.sort_order
  ) cat_summary;

  -- Upsert the top sheet cache
  INSERT INTO backlot_budget_top_sheet_cache (
    budget_id,
    above_the_line_total,
    production_total,
    post_total,
    other_total,
    total_fringes,
    subtotal,
    contingency_amount,
    grand_total,
    category_summaries,
    computed_at,
    is_stale
  ) VALUES (
    p_budget_id,
    v_atl_total,
    v_prod_total,
    v_post_total,
    v_other_total,
    v_fringes_total,
    v_subtotal,
    v_contingency,
    v_grand_total,
    v_category_data,
    NOW(),
    FALSE
  )
  ON CONFLICT (budget_id) DO UPDATE SET
    above_the_line_total = EXCLUDED.above_the_line_total,
    production_total = EXCLUDED.production_total,
    post_total = EXCLUDED.post_total,
    other_total = EXCLUDED.other_total,
    total_fringes = EXCLUDED.total_fringes,
    subtotal = EXCLUDED.subtotal,
    contingency_amount = EXCLUDED.contingency_amount,
    grand_total = EXCLUDED.grand_total,
    category_summaries = EXCLUDED.category_summaries,
    computed_at = NOW(),
    is_stale = FALSE;

  -- Update the budget's grand total and fringes
  UPDATE backlot_budgets
  SET
    fringes_total = v_fringes_total,
    grand_total = v_grand_total,
    has_top_sheet = TRUE,
    updated_at = NOW()
  WHERE id = p_budget_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Mark top sheet as stale when line items change
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_mark_top_sheet_stale()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark the top sheet cache as stale
  UPDATE backlot_budget_top_sheet_cache
  SET is_stale = TRUE
  WHERE budget_id = COALESCE(NEW.budget_id, OLD.budget_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_line_item_top_sheet_stale'
  ) THEN
    CREATE TRIGGER trigger_line_item_top_sheet_stale
      AFTER INSERT OR UPDATE OR DELETE ON backlot_budget_line_items
      FOR EACH ROW
      EXECUTE FUNCTION trigger_mark_top_sheet_stale();
  END IF;
END $$;

-- =====================================================
-- SEED DATA: Default Budget Account Templates
-- Feature Film template accounts
-- =====================================================

-- Feature Film: Above the Line - Creative
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common)
VALUES
  ('feature', '1100', 'Story & Rights', 'above_the_line', 'Story & Rights', 'Development', 'flat', 'allow', 10, true),
  ('feature', '1200', 'Producer', 'above_the_line', 'Producers Unit', 'Production', 'flat', 'allow', 20, true),
  ('feature', '1300', 'Director', 'above_the_line', 'Director', 'Directing', 'flat', 'allow', 30, true),
  ('feature', '1400', 'Cast', 'above_the_line', 'Cast', 'Talent', 'rate_x_days', 'days', 40, true),
  ('feature', '1500', 'Travel & Living (ATL)', 'above_the_line', 'ATL Travel & Living', 'Travel', 'flat', 'allow', 50, true)
ON CONFLICT (project_type, account_code) DO NOTHING;

-- Feature Film: Production
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common)
VALUES
  ('feature', '2000', 'Production Staff', 'production', 'Production Staff', 'Production', 'rate_x_weeks', 'weeks', 100, true),
  ('feature', '2100', 'Extra Talent', 'production', 'Extra Talent', 'Talent', 'rate_x_days', 'days', 110, true),
  ('feature', '2200', 'Art Department', 'production', 'Art Department', 'Art', 'rate_x_weeks', 'weeks', 120, true),
  ('feature', '2300', 'Set Construction', 'production', 'Set Construction', 'Art', 'flat', 'allow', 130, true),
  ('feature', '2400', 'Set Operations', 'production', 'Set Operations', 'Grip/Electric', 'rate_x_days', 'days', 140, true),
  ('feature', '2500', 'Special Effects', 'production', 'Special Effects', 'SFX', 'flat', 'allow', 150, true),
  ('feature', '2600', 'Set Dressing', 'production', 'Set Dressing', 'Art', 'rate_x_weeks', 'weeks', 160, true),
  ('feature', '2700', 'Property', 'production', 'Property', 'Props', 'rate_x_days', 'days', 170, true),
  ('feature', '2800', 'Wardrobe', 'production', 'Wardrobe', 'Wardrobe', 'rate_x_weeks', 'weeks', 180, true),
  ('feature', '2900', 'Hair & Makeup', 'production', 'Hair & Makeup', 'Hair/Makeup', 'rate_x_days', 'days', 190, true),
  ('feature', '3000', 'Electrical', 'production', 'Electrical', 'Electric', 'rate_x_days', 'days', 200, true),
  ('feature', '3100', 'Camera', 'production', 'Camera', 'Camera', 'rate_x_weeks', 'weeks', 210, true),
  ('feature', '3200', 'Sound', 'production', 'Production Sound', 'Sound', 'rate_x_days', 'days', 220, true),
  ('feature', '3300', 'Transportation', 'production', 'Transportation', 'Transport', 'rate_x_days', 'days', 230, true),
  ('feature', '3400', 'Location', 'production', 'Location', 'Location', 'rate_x_days', 'days', 240, true),
  ('feature', '3500', 'Production Film & Lab', 'production', 'Film & Lab', 'Post', 'flat', 'allow', 250, false),
  ('feature', '3600', 'Second Unit', 'production', 'Second Unit', 'Production', 'flat', 'allow', 260, false),
  ('feature', '3700', 'Tests', 'production', 'Tests', 'Production', 'flat', 'allow', 270, false)
ON CONFLICT (project_type, account_code) DO NOTHING;

-- Feature Film: Post Production
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common)
VALUES
  ('feature', '4000', 'Editing', 'post', 'Editing', 'Post', 'rate_x_weeks', 'weeks', 300, true),
  ('feature', '4100', 'Music', 'post', 'Music', 'Post', 'flat', 'allow', 310, true),
  ('feature', '4200', 'Post Sound', 'post', 'Post Sound', 'Post', 'flat', 'allow', 320, true),
  ('feature', '4300', 'Post Film & Lab', 'post', 'Post Lab', 'Post', 'flat', 'allow', 330, false),
  ('feature', '4400', 'Visual Effects', 'post', 'Visual Effects', 'VFX', 'flat', 'allow', 340, true),
  ('feature', '4500', 'Titles', 'post', 'Titles', 'Post', 'flat', 'allow', 350, true)
ON CONFLICT (project_type, account_code) DO NOTHING;

-- Feature Film: Other
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common)
VALUES
  ('feature', '5000', 'Insurance', 'other', 'Insurance', 'Production', 'flat', 'allow', 400, true),
  ('feature', '5100', 'General Expenses', 'other', 'General Expenses', 'Production', 'flat', 'allow', 410, true),
  ('feature', '5200', 'Fringes', 'other', 'Fringes', 'Production', 'percent_of_subtotal', 'percent', 420, true),
  ('feature', '5300', 'Publicity', 'other', 'Publicity', 'Marketing', 'flat', 'allow', 430, false)
ON CONFLICT (project_type, account_code) DO NOTHING;

-- Commercial (AICP-style) template accounts
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common, aicp_code)
VALUES
  ('commercial', 'A', 'Pre-Production/Wrap', 'above_the_line', 'Pre-Pro & Wrap', 'Production', 'flat', 'allow', 10, true, 'A'),
  ('commercial', 'B', 'Shooting Crew', 'production', 'Shooting Crew', 'Production', 'rate_x_days', 'days', 20, true, 'B'),
  ('commercial', 'C', 'Location/Studio', 'production', 'Location/Studio', 'Location', 'rate_x_days', 'days', 30, true, 'C'),
  ('commercial', 'D', 'Props/Wardrobe/Animals', 'production', 'Props/Wardrobe', 'Art', 'flat', 'allow', 40, true, 'D'),
  ('commercial', 'E', 'Equipment', 'production', 'Equipment', 'Camera', 'rate_x_days', 'days', 50, true, 'E'),
  ('commercial', 'F', 'Film Stock/Digital', 'production', 'Media', 'Post', 'flat', 'allow', 60, true, 'F'),
  ('commercial', 'G', 'Travel & Living', 'production', 'Travel & Living', 'Travel', 'flat', 'allow', 70, true, 'G'),
  ('commercial', 'H', 'Director/Creative', 'above_the_line', 'Director/Creative', 'Directing', 'flat', 'allow', 80, true, 'H'),
  ('commercial', 'I', 'Talent', 'above_the_line', 'Talent', 'Talent', 'rate_x_days', 'days', 90, true, 'I'),
  ('commercial', 'J', 'Editorial', 'post', 'Editorial', 'Post', 'flat', 'allow', 100, true, 'J'),
  ('commercial', 'K', 'Insurance', 'other', 'Insurance', 'Production', 'flat', 'allow', 110, true, 'K'),
  ('commercial', 'L', 'Mark-Up', 'other', 'Mark-Up', 'Production', 'percent_of_subtotal', 'percent', 120, true, 'L')
ON CONFLICT (project_type, account_code) DO NOTHING;

-- Music Video template accounts
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common)
VALUES
  ('music_video', '100', 'Director Fee', 'above_the_line', 'Creative', 'Directing', 'flat', 'allow', 10, true),
  ('music_video', '200', 'Producer Fee', 'above_the_line', 'Creative', 'Production', 'flat', 'allow', 20, true),
  ('music_video', '300', 'Production Crew', 'production', 'Crew', 'Production', 'rate_x_days', 'days', 30, true),
  ('music_video', '400', 'Camera/Grip/Electric', 'production', 'Camera/G&E', 'Camera', 'rate_x_days', 'days', 40, true),
  ('music_video', '500', 'Art Department', 'production', 'Art', 'Art', 'flat', 'allow', 50, true),
  ('music_video', '600', 'Locations', 'production', 'Locations', 'Location', 'rate_x_days', 'days', 60, true),
  ('music_video', '700', 'Talent/Dancers', 'production', 'Talent', 'Talent', 'rate_x_days', 'days', 70, true),
  ('music_video', '800', 'Hair/Makeup/Wardrobe', 'production', 'Styling', 'Hair/Makeup', 'rate_x_days', 'days', 80, true),
  ('music_video', '900', 'Post Production', 'post', 'Post', 'Post', 'flat', 'allow', 90, true),
  ('music_video', '1000', 'VFX/Color/Finishing', 'post', 'Finishing', 'VFX', 'flat', 'allow', 100, true)
ON CONFLICT (project_type, account_code) DO NOTHING;

-- Documentary template accounts
INSERT INTO backlot_budget_accounts (project_type, account_code, name, category_type, category_name, department, default_calc_mode, default_units, sort_order, is_common)
VALUES
  ('documentary', '1000', 'Rights & Research', 'above_the_line', 'Development', 'Development', 'flat', 'allow', 10, true),
  ('documentary', '1100', 'Producer', 'above_the_line', 'Producer', 'Production', 'rate_x_weeks', 'weeks', 20, true),
  ('documentary', '1200', 'Director', 'above_the_line', 'Director', 'Directing', 'rate_x_weeks', 'weeks', 30, true),
  ('documentary', '2000', 'Production Crew', 'production', 'Production Crew', 'Production', 'rate_x_days', 'days', 40, true),
  ('documentary', '2100', 'Camera/Sound', 'production', 'Camera/Sound', 'Camera', 'rate_x_days', 'days', 50, true),
  ('documentary', '2200', 'Travel', 'production', 'Travel', 'Travel', 'flat', 'allow', 60, true),
  ('documentary', '2300', 'Archival/Stock', 'production', 'Archival', 'Post', 'flat', 'allow', 70, true),
  ('documentary', '3000', 'Editing', 'post', 'Editing', 'Post', 'rate_x_weeks', 'weeks', 80, true),
  ('documentary', '3100', 'Music/Sound', 'post', 'Music/Sound', 'Post', 'flat', 'allow', 90, true),
  ('documentary', '3200', 'Color/Finishing', 'post', 'Finishing', 'Post', 'flat', 'allow', 100, true),
  ('documentary', '4000', 'General Expenses', 'other', 'G&A', 'Production', 'flat', 'allow', 110, true)
ON CONFLICT (project_type, account_code) DO NOTHING;
