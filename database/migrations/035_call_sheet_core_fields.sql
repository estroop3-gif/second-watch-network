-- Migration 035: Add missing core fields to call sheets table
-- These fields are required by the backend but were not in the original table definition

-- Template type
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'feature';

-- Production day link
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL;

-- Production info
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_title TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_company TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS header_logo_url TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS shoot_day_number INTEGER;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS total_shoot_days INTEGER;

-- Additional timing fields
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS crew_call_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS first_shot_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS breakfast_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS lunch_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS dinner_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS estimated_wrap_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS sunrise_time TIME;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS sunset_time TIME;

-- Location extras
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS parking_instructions TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS basecamp_location TEXT;

-- Contact fields
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_office_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS production_email TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS upm_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS upm_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS first_ad_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS first_ad_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS director_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS director_phone TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS producer_name TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS producer_phone TEXT;

-- Department notes
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS camera_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS sound_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS grip_electric_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS art_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS wardrobe_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS makeup_hair_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS stunts_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS vfx_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS transport_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS catering_notes TEXT;

-- Weather
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS weather_forecast JSONB;

-- Safety fields
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS nearest_hospital TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS set_medic TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS fire_safety_officer TEXT;

-- Additional
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS general_notes TEXT;
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS advance_schedule TEXT;

-- Custom contacts (JSONB array)
ALTER TABLE backlot_call_sheets ADD COLUMN IF NOT EXISTS custom_contacts JSONB DEFAULT '[]';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlot_call_sheets_template ON backlot_call_sheets(template_type);
CREATE INDEX IF NOT EXISTS idx_backlot_call_sheets_production_day ON backlot_call_sheets(production_day_id);
