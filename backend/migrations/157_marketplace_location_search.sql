-- Migration 157: Marketplace Location-Based Search
-- Adds proximity search capabilities for gear marketplace

-- Per-project marketplace search preferences
CREATE TABLE IF NOT EXISTS gear_marketplace_search_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Location settings
    search_latitude DECIMAL(10, 8),
    search_longitude DECIMAL(11, 8),
    search_location_name TEXT,
    location_source TEXT DEFAULT 'profile' CHECK (location_source IN ('browser', 'profile', 'manual')),

    -- Search settings
    search_radius_miles INTEGER DEFAULT 50,

    -- View preferences
    view_mode TEXT DEFAULT 'grid' CHECK (view_mode IN ('map', 'grid', 'list')),
    result_mode TEXT DEFAULT 'gear_houses' CHECK (result_mode IN ('gear_houses', 'gear_items')),

    -- Filters
    delivery_to_me_only BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, profile_id)
);

-- User favorites for gear houses
CREATE TABLE IF NOT EXISTS gear_house_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(profile_id, organization_id)
);

-- Haversine distance function for proximity calculations
CREATE OR REPLACE FUNCTION haversine_distance_miles(
    lat1 DECIMAL, lng1 DECIMAL,
    lat2 DECIMAL, lng2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R CONSTANT DECIMAL := 3959; -- Earth's radius in miles
    dlat DECIMAL;
    dlng DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN NULL;
    END IF;
    dlat := RADIANS(lat2 - lat1);
    dlng := RADIANS(lng2 - lng1);
    a := SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2) * SIN(dlng/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add coordinates and privacy to gear_marketplace_settings
ALTER TABLE gear_marketplace_settings
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_geocoded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS location_geocode_source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS hide_exact_address BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_location_display TEXT;

-- Add coordinates to organizations for fallback geocoding
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_geocoded_at TIMESTAMPTZ;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_settings_coords
ON gear_marketplace_settings(location_latitude, location_longitude)
WHERE location_latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_house_favorites_profile
ON gear_house_favorites(profile_id);

CREATE INDEX IF NOT EXISTS idx_gear_house_favorites_org
ON gear_house_favorites(organization_id);

CREATE INDEX IF NOT EXISTS idx_gear_marketplace_prefs_project
ON gear_marketplace_search_preferences(project_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_organizations_coords
ON organizations(latitude, longitude)
WHERE latitude IS NOT NULL;

-- Comments
COMMENT ON TABLE gear_marketplace_search_preferences IS 'Per-project marketplace search preferences for users';
COMMENT ON TABLE gear_house_favorites IS 'User-favorited gear houses for quick access';
COMMENT ON FUNCTION haversine_distance_miles IS 'Calculate distance in miles between two lat/lng points using Haversine formula';
COMMENT ON COLUMN gear_marketplace_settings.hide_exact_address IS 'When true, only show city/state in public_location_display';
COMMENT ON COLUMN gear_marketplace_settings.public_location_display IS 'Human-readable location (City, State) when exact address is hidden';
