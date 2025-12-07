-- Migration: 010_scout_photos.sql
-- Description: Add structured scout photos system for locations
-- Date: 2025-12-06

-- ============================================================================
-- PHASE 1: Create backlot_location_scout_photos table
-- ============================================================================

CREATE TABLE IF NOT EXISTS backlot_location_scout_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES backlot_locations(id) ON DELETE CASCADE,

  -- Core media info
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_filename TEXT,

  -- Composition & vantage
  angle_label TEXT, -- "Front entrance", "Back alley", "Parking lot", "Main interior", etc.
  vantage_type TEXT, -- "wide", "medium", "close-up", "detail", "overhead", "drone"
  camera_facing TEXT, -- Cardinal direction: "north", "south", "east", "west", "north-east", etc.

  -- Time & conditions
  time_of_day TEXT, -- "morning", "midday", "afternoon", "golden_hour", "blue_hour", "night"
  shoot_date DATE, -- When the scout photo was taken
  weather TEXT, -- "clear", "overcast", "rainy", "cloudy", "foggy", etc.

  -- Practical notes for production
  light_notes TEXT, -- "Harsh sun from west at 3pm", "Nice soft north-facing windows"
  sound_notes TEXT, -- "Road noise", "Airplanes overhead", "Very quiet at night"
  access_notes TEXT, -- "Truck access via alley", "Stairs only", "Elevator access"
  power_notes TEXT, -- "House power only", "100A tie-in", "No access to power on exterior"
  parking_notes TEXT, -- "Crew parking for 10 vehicles", "No street parking after 6pm"
  restrictions_notes TEXT, -- "No filming after 10pm", "No stunts or pyrotechnics", "Drone ok with permit"

  -- Additional notes
  general_notes TEXT,

  -- Is this a "hero" / primary photo for this location?
  is_primary BOOLEAN DEFAULT FALSE,

  -- Interior or exterior?
  interior_exterior TEXT, -- "interior", "exterior", "both"

  -- Meta
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Create indexes for efficient queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scout_photos_location ON backlot_location_scout_photos(location_id);
CREATE INDEX IF NOT EXISTS idx_scout_photos_primary ON backlot_location_scout_photos(location_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_scout_photos_vantage ON backlot_location_scout_photos(vantage_type);
CREATE INDEX IF NOT EXISTS idx_scout_photos_time_of_day ON backlot_location_scout_photos(time_of_day);
CREATE INDEX IF NOT EXISTS idx_scout_photos_interior_exterior ON backlot_location_scout_photos(interior_exterior);
CREATE INDEX IF NOT EXISTS idx_scout_photos_uploaded_by ON backlot_location_scout_photos(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_scout_photos_created_at ON backlot_location_scout_photos(created_at DESC);

-- ============================================================================
-- PHASE 3: Enable RLS and create policies
-- ============================================================================

ALTER TABLE backlot_location_scout_photos ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view scout photos for locations they can see
-- (Public locations or locations they have access to)
CREATE POLICY "Users can view scout photos for accessible locations"
  ON backlot_location_scout_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM backlot_locations l
      WHERE l.id = location_id
      AND (
        l.is_public = TRUE
        OR l.created_by_user_id = auth.uid()
        OR (l.project_id IS NOT NULL AND is_backlot_project_member(l.project_id, auth.uid()))
        OR EXISTS (
          SELECT 1 FROM backlot_project_locations pl
          WHERE pl.location_id = l.id
          AND is_backlot_project_member(pl.project_id, auth.uid())
        )
      )
    )
  );

-- INSERT policy: Users can add scout photos to locations they can edit
CREATE POLICY "Users can add scout photos to editable locations"
  ON backlot_location_scout_photos FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM backlot_locations l
      WHERE l.id = location_id
      AND (
        l.created_by_user_id = auth.uid()
        OR (l.project_id IS NOT NULL AND is_backlot_project_member(l.project_id, auth.uid()))
        OR EXISTS (
          SELECT 1 FROM backlot_project_locations pl
          WHERE pl.location_id = l.id
          AND is_backlot_project_member(pl.project_id, auth.uid())
        )
      )
    )
    AND uploaded_by_user_id = auth.uid()
  );

-- UPDATE policy: Photo uploader or location editors can update
CREATE POLICY "Photo uploaders and location editors can update scout photos"
  ON backlot_location_scout_photos FOR UPDATE
  USING (
    uploaded_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM backlot_locations l
      WHERE l.id = location_id
      AND (
        l.created_by_user_id = auth.uid()
        OR (l.project_id IS NOT NULL AND is_backlot_project_admin(l.project_id, auth.uid()))
      )
    )
  )
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM backlot_locations l
      WHERE l.id = location_id
      AND (
        l.created_by_user_id = auth.uid()
        OR (l.project_id IS NOT NULL AND is_backlot_project_admin(l.project_id, auth.uid()))
      )
    )
  );

-- DELETE policy: Photo uploader or location admins can delete
CREATE POLICY "Photo uploaders and location admins can delete scout photos"
  ON backlot_location_scout_photos FOR DELETE
  USING (
    uploaded_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM backlot_locations l
      WHERE l.id = location_id
      AND (
        l.created_by_user_id = auth.uid()
        OR (l.project_id IS NOT NULL AND is_backlot_project_admin(l.project_id, auth.uid()))
      )
    )
  );

-- ============================================================================
-- PHASE 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER backlot_location_scout_photos_updated_at
  BEFORE UPDATE ON backlot_location_scout_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PHASE 5: Helper function to get primary scout photo for a location
-- ============================================================================

CREATE OR REPLACE FUNCTION get_location_primary_scout_photo(p_location_id UUID)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  thumbnail_url TEXT,
  angle_label TEXT,
  vantage_type TEXT,
  time_of_day TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.image_url,
    sp.thumbnail_url,
    sp.angle_label,
    sp.vantage_type,
    sp.time_of_day
  FROM backlot_location_scout_photos sp
  WHERE sp.location_id = p_location_id
  ORDER BY
    sp.is_primary DESC,
    CASE WHEN sp.vantage_type = 'wide' THEN 0
         WHEN sp.vantage_type = 'medium' THEN 1
         ELSE 2 END,
    sp.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_location_primary_scout_photo TO authenticated;

-- ============================================================================
-- PHASE 6: Helper function to derive smart tags from scout photos
-- ============================================================================

CREATE OR REPLACE FUNCTION get_location_scout_tags(p_location_id UUID)
RETURNS TABLE (
  tag_name TEXT,
  tag_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH photo_notes AS (
    SELECT
      lower(coalesce(sound_notes, '')) as sound,
      lower(coalesce(light_notes, '')) as light,
      lower(coalesce(power_notes, '')) as power,
      lower(coalesce(parking_notes, '')) as parking,
      lower(coalesce(access_notes, '')) as access,
      lower(coalesce(restrictions_notes, '')) as restrictions
    FROM backlot_location_scout_photos
    WHERE location_id = p_location_id
  )
  SELECT DISTINCT tag, category FROM (
    -- Sound tags
    SELECT 'Quiet' as tag, 'sound' as category
    FROM photo_notes WHERE sound LIKE '%quiet%' OR sound LIKE '%silent%'
    UNION
    SELECT 'Road Noise' as tag, 'sound' as category
    FROM photo_notes WHERE sound LIKE '%road%' OR sound LIKE '%traffic%' OR sound LIKE '%freeway%' OR sound LIKE '%highway%'
    UNION
    SELECT 'Airport Noise' as tag, 'sound' as category
    FROM photo_notes WHERE sound LIKE '%plane%' OR sound LIKE '%airplane%' OR sound LIKE '%airport%' OR sound LIKE '%flight%'
    -- Light tags
    UNION
    SELECT 'Natural Light' as tag, 'light' as category
    FROM photo_notes WHERE light LIKE '%natural%' OR light LIKE '%window%' OR light LIKE '%skylight%'
    UNION
    SELECT 'North-Facing' as tag, 'light' as category
    FROM photo_notes WHERE light LIKE '%north%facing%' OR light LIKE '%north facing%'
    UNION
    SELECT 'Harsh Sun' as tag, 'light' as category
    FROM photo_notes WHERE light LIKE '%harsh%' OR light LIKE '%direct sun%'
    -- Power tags
    UNION
    SELECT 'Full Power' as tag, 'power' as category
    FROM photo_notes WHERE power LIKE '%100a%' OR power LIKE '%200a%' OR power LIKE '%tie-in%' OR power LIKE '%tie in%'
    UNION
    SELECT 'Limited Power' as tag, 'power' as category
    FROM photo_notes WHERE power LIKE '%house power%' OR power LIKE '%limited%' OR power LIKE '%no power%'
    -- Parking tags
    UNION
    SELECT 'Good Parking' as tag, 'parking' as category
    FROM photo_notes WHERE parking LIKE '%lot%' OR parking LIKE '%ample%' OR parking LIKE '%plenty%' OR (parking LIKE '%parking%' AND parking NOT LIKE '%no parking%')
    UNION
    SELECT 'Limited Parking' as tag, 'parking' as category
    FROM photo_notes WHERE parking LIKE '%limited%' OR parking LIKE '%no parking%' OR parking LIKE '%street only%'
    -- Access tags
    UNION
    SELECT 'Truck Access' as tag, 'access' as category
    FROM photo_notes WHERE access LIKE '%truck%' OR access LIKE '%loading%' OR access LIKE '%dock%'
    UNION
    SELECT 'Stairs Only' as tag, 'access' as category
    FROM photo_notes WHERE access LIKE '%stairs only%' OR access LIKE '%no elevator%'
    UNION
    SELECT 'Elevator' as tag, 'access' as category
    FROM photo_notes WHERE access LIKE '%elevator%' AND access NOT LIKE '%no elevator%'
    -- Restriction tags
    UNION
    SELECT 'Night Restrictions' as tag, 'restrictions' as category
    FROM photo_notes WHERE restrictions LIKE '%no filming after%' OR restrictions LIKE '%curfew%' OR restrictions LIKE '%night%'
    UNION
    SELECT 'Drone Allowed' as tag, 'restrictions' as category
    FROM photo_notes WHERE restrictions LIKE '%drone ok%' OR restrictions LIKE '%drone allowed%' OR restrictions LIKE '%drone permit%'
  ) tags
  WHERE tag IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_location_scout_tags TO authenticated;

-- ============================================================================
-- PHASE 7: Update search_global_locations to include scout photo info
-- ============================================================================

-- Drop and recreate the function with scout photo support
DROP FUNCTION IF EXISTS search_global_locations;

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
  created_at TIMESTAMPTZ,
  -- Scout photo fields
  primary_photo_url TEXT,
  primary_photo_thumbnail TEXT,
  scout_photo_count BIGINT
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
    l.created_at,
    -- Get primary scout photo
    (SELECT sp.image_url FROM backlot_location_scout_photos sp
     WHERE sp.location_id = l.id
     ORDER BY sp.is_primary DESC, sp.created_at DESC
     LIMIT 1) as primary_photo_url,
    (SELECT COALESCE(sp.thumbnail_url, sp.image_url) FROM backlot_location_scout_photos sp
     WHERE sp.location_id = l.id
     ORDER BY sp.is_primary DESC, sp.created_at DESC
     LIMIT 1) as primary_photo_thumbnail,
    -- Count of scout photos
    (SELECT COUNT(*) FROM backlot_location_scout_photos sp WHERE sp.location_id = l.id) as scout_photo_count
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

GRANT EXECUTE ON FUNCTION search_global_locations TO authenticated;

-- ============================================================================
-- PHASE 8: Comments for documentation
-- ============================================================================

COMMENT ON TABLE backlot_location_scout_photos IS 'Structured scout photos with metadata for production locations';
COMMENT ON COLUMN backlot_location_scout_photos.angle_label IS 'Descriptive label for the camera angle/view (e.g., "Front entrance", "Kitchen", "Back alley")';
COMMENT ON COLUMN backlot_location_scout_photos.vantage_type IS 'Type of shot: wide, medium, close-up, detail, overhead, drone';
COMMENT ON COLUMN backlot_location_scout_photos.camera_facing IS 'Cardinal direction the camera is facing';
COMMENT ON COLUMN backlot_location_scout_photos.time_of_day IS 'When photo was taken: morning, midday, afternoon, golden_hour, blue_hour, night';
COMMENT ON COLUMN backlot_location_scout_photos.is_primary IS 'Whether this is the primary/hero photo for the location';
COMMENT ON COLUMN backlot_location_scout_photos.interior_exterior IS 'Whether this photo shows interior, exterior, or both';
