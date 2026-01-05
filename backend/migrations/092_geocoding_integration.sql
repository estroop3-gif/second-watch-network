-- Migration 092: Geocoding Integration
-- Adds support for Nominatim geocoding service with caching
-- =============================================================================

-- 1. Geocoding cache table
-- Caches Nominatim results to reduce load and improve performance
CREATE TABLE IF NOT EXISTS geocoding_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash TEXT UNIQUE NOT NULL,
    query_type TEXT NOT NULL CHECK (query_type IN ('autocomplete', 'forward', 'reverse')),
    query_input TEXT NOT NULL,
    result_json JSONB NOT NULL,
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_hash ON geocoding_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_type ON geocoding_cache(query_type);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_accessed ON geocoding_cache(last_accessed_at);

-- 2. Add structured location fields to filmmaker_profiles
-- Currently uses freeform "location" text field, add structured fields
ALTER TABLE filmmaker_profiles
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_state TEXT,
ADD COLUMN IF NOT EXISTS location_state_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS location_zip VARCHAR(10),
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS location_geocoded_at TIMESTAMPTZ;

-- Indexes for location-based queries on filmmaker profiles
CREATE INDEX IF NOT EXISTS idx_filmmaker_profiles_location_state
ON filmmaker_profiles(location_state_code) WHERE location_state_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_filmmaker_profiles_location_city
ON filmmaker_profiles(location_city) WHERE location_city IS NOT NULL;

-- 3. Add geocoding metadata to backlot_locations
-- Track when location was geocoded and source of data
ALTER TABLE backlot_locations
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS geocode_source TEXT DEFAULT 'manual'
    CHECK (geocode_source IN ('manual', 'nominatim', 'gps', 'imported'));

-- 4. Add structured location to profiles table (for non-filmmaker users)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_state_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(10, 7);

-- 5. Function to clean up old cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_geocoding_cache(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM geocoding_cache
    WHERE last_accessed_at < NOW() - (days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Comment on tables
COMMENT ON TABLE geocoding_cache IS 'Cache for Nominatim geocoding results to reduce API calls';
COMMENT ON COLUMN geocoding_cache.query_hash IS 'SHA256 hash of normalized query for deduplication';
COMMENT ON COLUMN geocoding_cache.hit_count IS 'Number of times this cached result has been used';

COMMENT ON COLUMN filmmaker_profiles.location_city IS 'City from geocoded location';
COMMENT ON COLUMN filmmaker_profiles.location_state_code IS 'Two-letter US state code';
COMMENT ON COLUMN filmmaker_profiles.location_latitude IS 'Latitude from geocoding';
COMMENT ON COLUMN filmmaker_profiles.location_longitude IS 'Longitude from geocoding';
COMMENT ON COLUMN filmmaker_profiles.location_geocoded_at IS 'When location was last geocoded';

COMMENT ON COLUMN backlot_locations.geocode_source IS 'How location coordinates were obtained: manual, nominatim, gps, imported';
COMMENT ON COLUMN backlot_locations.geocoded_at IS 'When location was geocoded via Nominatim';
