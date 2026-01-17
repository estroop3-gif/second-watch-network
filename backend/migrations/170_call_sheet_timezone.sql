-- Migration 170: Add timezone and weather data columns to call sheets
-- For auto-populated weather forecasts and timezone detection from location coordinates

ALTER TABLE backlot_call_sheets
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS timezone_offset VARCHAR(10),
  ADD COLUMN IF NOT EXISTS weather_fetched_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS weather_data JSONB;

-- Add comments for documentation
COMMENT ON COLUMN backlot_call_sheets.timezone IS 'IANA timezone string e.g. America/Los_Angeles';
COMMENT ON COLUMN backlot_call_sheets.timezone_offset IS 'UTC offset e.g. -08:00';
COMMENT ON COLUMN backlot_call_sheets.weather_fetched_at IS 'When weather was last fetched from API';
COMMENT ON COLUMN backlot_call_sheets.weather_data IS 'Cached weather forecast from Open-Meteo API';
