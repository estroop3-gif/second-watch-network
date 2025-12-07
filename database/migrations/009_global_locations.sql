-- Migration: 009_global_locations.sql
-- Description: Transform backlot_locations into a global location library system
-- Date: 2025-12-06

-- ============================================================================
-- PHASE 1: Extend backlot_locations for global library
-- ============================================================================

-- Make project_id nullable (allows global locations not tied to any project)
ALTER TABLE backlot_locations ALTER COLUMN project_id DROP NOT NULL;

-- Add global library fields
ALTER TABLE backlot_locations
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region_tag TEXT,
  ADD COLUMN IF NOT EXISTS location_type TEXT,
  ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]';

-- Add index for region-based searches
CREATE INDEX IF NOT EXISTS idx_backlot_locations_region ON backlot_locations(region_tag);
CREATE INDEX IF NOT EXISTS idx_backlot_locations_public ON backlot_locations(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_backlot_locations_type ON backlot_locations(location_type);
CREATE INDEX IF NOT EXISTS idx_backlot_locations_city_state ON backlot_locations(city, state);
CREATE INDEX IF NOT EXISTS idx_backlot_locations_created_by_user ON backlot_locations(created_by_user_id);

-- ============================================================================
-- PHASE 2: Create project_locations junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_project_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES backlot_locations(id) ON DELETE CASCADE,

  -- Project-specific overrides (optional)
  project_notes TEXT,
  scene_description TEXT, -- Project-specific scene description

  -- Tracking
  attached_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attached_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique location per project
  UNIQUE(project_id, location_id)
);

-- Indexes for project_locations
CREATE INDEX IF NOT EXISTS idx_backlot_project_locations_project ON backlot_project_locations(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_locations_location ON backlot_project_locations(location_id);

-- Enable RLS
ALTER TABLE backlot_project_locations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 3: RLS Policies for backlot_locations (updated for global library)
-- ============================================================================

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Users can view locations for their projects" ON backlot_locations;
DROP POLICY IF EXISTS "Users can insert locations for their projects" ON backlot_locations;
DROP POLICY IF EXISTS "Users can update locations for their projects" ON backlot_locations;
DROP POLICY IF EXISTS "Users can delete locations for their projects" ON backlot_locations;

-- New SELECT policy: Users can view public locations OR locations for their projects
CREATE POLICY "Users can view public or project locations"
  ON backlot_locations FOR SELECT
  USING (
    is_public = TRUE
    OR (project_id IS NOT NULL AND is_backlot_project_member(project_id, auth.uid()))
    OR created_by_user_id = auth.uid()
  );

-- INSERT policy: Authenticated users can create locations
CREATE POLICY "Authenticated users can create locations"
  ON backlot_locations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Creating a global public location
      (project_id IS NULL AND created_by_user_id = auth.uid())
      -- Or creating within their project
      OR (project_id IS NOT NULL AND is_backlot_project_member(project_id, auth.uid()))
    )
  );

-- UPDATE policy: Only creator or project admins can update
CREATE POLICY "Creators and project admins can update locations"
  ON backlot_locations FOR UPDATE
  USING (
    created_by_user_id = auth.uid()
    OR (project_id IS NOT NULL AND is_backlot_project_admin(project_id, auth.uid()))
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
    OR (project_id IS NOT NULL AND is_backlot_project_admin(project_id, auth.uid()))
  );

-- DELETE policy: Only creator or project admins can delete
CREATE POLICY "Creators and project admins can delete locations"
  ON backlot_locations FOR DELETE
  USING (
    created_by_user_id = auth.uid()
    OR (project_id IS NOT NULL AND is_backlot_project_admin(project_id, auth.uid()))
  );

-- ============================================================================
-- PHASE 4: RLS Policies for backlot_project_locations
-- ============================================================================

-- SELECT: Project members can view their project's attached locations
CREATE POLICY "Project members can view attached locations"
  ON backlot_project_locations FOR SELECT
  USING (is_backlot_project_member(project_id, auth.uid()));

-- INSERT: Project members can attach locations
CREATE POLICY "Project members can attach locations"
  ON backlot_project_locations FOR INSERT
  WITH CHECK (is_backlot_project_member(project_id, auth.uid()));

-- UPDATE: Project admins can update attachment details
CREATE POLICY "Project admins can update attachments"
  ON backlot_project_locations FOR UPDATE
  USING (is_backlot_project_admin(project_id, auth.uid()))
  WITH CHECK (is_backlot_project_admin(project_id, auth.uid()));

-- DELETE: Project members can detach locations
CREATE POLICY "Project members can detach locations"
  ON backlot_project_locations FOR DELETE
  USING (is_backlot_project_member(project_id, auth.uid()));

-- ============================================================================
-- PHASE 5: Migrate existing project locations
-- ============================================================================

-- For existing locations that were created within projects,
-- set the created_by_project_id to maintain provenance
UPDATE backlot_locations
SET
  created_by_project_id = project_id,
  is_public = TRUE
WHERE project_id IS NOT NULL AND created_by_project_id IS NULL;

-- Also create project_locations entries for existing locations
-- so projects maintain their location references
INSERT INTO backlot_project_locations (project_id, location_id, attached_at)
SELECT project_id, id, created_at
FROM backlot_locations
WHERE project_id IS NOT NULL
ON CONFLICT (project_id, location_id) DO NOTHING;

-- ============================================================================
-- PHASE 6: Helper function for region-based search
-- ============================================================================

-- Function to search locations by region with optional filters
CREATE OR REPLACE FUNCTION search_global_locations(
  p_query TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_location_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  region_tag TEXT,
  location_type TEXT,
  amenities JSONB,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  images JSONB,
  is_public BOOLEAN,
  created_by_user_id UUID,
  created_by_project_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.description,
    l.address,
    l.city,
    l.state,
    l.zip,
    l.country,
    l.region_tag,
    l.location_type,
    l.amenities,
    l.latitude,
    l.longitude,
    l.contact_name,
    l.contact_phone,
    l.contact_email,
    l.images,
    l.is_public,
    l.created_by_user_id,
    l.created_by_project_id,
    l.created_at
  FROM backlot_locations l
  WHERE
    l.is_public = TRUE
    AND (p_query IS NULL OR
         l.name ILIKE '%' || p_query || '%' OR
         l.address ILIKE '%' || p_query || '%' OR
         l.city ILIKE '%' || p_query || '%')
    AND (p_region IS NULL OR l.region_tag = p_region)
    AND (p_city IS NULL OR l.city ILIKE '%' || p_city || '%')
    AND (p_state IS NULL OR l.state = p_state)
    AND (p_location_type IS NULL OR l.location_type = p_location_type)
  ORDER BY l.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION search_global_locations TO authenticated;

-- ============================================================================
-- PHASE 7: Update trigger for updated_at
-- ============================================================================

CREATE TRIGGER backlot_project_locations_updated_at
  BEFORE UPDATE ON backlot_project_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at column if not exists (for tracking changes)
ALTER TABLE backlot_project_locations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON TABLE backlot_locations IS 'Global location library - shared across all projects with optional project attachment';
COMMENT ON TABLE backlot_project_locations IS 'Junction table linking locations to projects with project-specific metadata';
COMMENT ON COLUMN backlot_locations.is_public IS 'Whether this location is visible in the global library search';
COMMENT ON COLUMN backlot_locations.created_by_user_id IS 'The user who originally created this location';
COMMENT ON COLUMN backlot_locations.created_by_project_id IS 'The project context in which this location was created (for provenance)';
COMMENT ON COLUMN backlot_locations.region_tag IS 'Regional grouping for search (e.g., Los Angeles, Atlanta, New York)';
COMMENT ON COLUMN backlot_locations.location_type IS 'Type of location (e.g., Studio, Residential, Commercial, Exterior, Industrial)';
COMMENT ON COLUMN backlot_locations.amenities IS 'JSON array of available amenities (e.g., ["parking", "power", "restrooms", "green_room"])';
