-- Migration 158: Community Marketplace Search Preferences
-- Profile-level search preferences for Community For Sale and Rentals tabs
-- Unlike gear_marketplace_search_preferences (project-scoped), this is profile-scoped

-- Community marketplace search preferences (profile-level, no project_id)
CREATE TABLE IF NOT EXISTS gear_community_search_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

    -- Location settings
    search_latitude DECIMAL(10, 8),
    search_longitude DECIMAL(11, 8),
    search_location_name TEXT,
    location_source TEXT DEFAULT 'profile' CHECK (location_source IN ('browser', 'profile', 'manual')),

    -- Search settings
    search_radius_miles INTEGER DEFAULT 50,

    -- View preferences
    view_mode TEXT DEFAULT 'grid' CHECK (view_mode IN ('map', 'grid', 'list')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_gear_community_prefs_profile
ON gear_community_search_preferences(profile_id);

-- Comments
COMMENT ON TABLE gear_community_search_preferences IS 'Profile-level search preferences for Community marketplace tabs (For Sale, Rentals)';
COMMENT ON COLUMN gear_community_search_preferences.location_source IS 'How the location was set: browser geolocation, profile fallback, or manual entry';
