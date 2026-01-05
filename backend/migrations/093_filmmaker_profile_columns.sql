-- Migration 093: Add missing columns to filmmaker_profiles
-- These columns are needed for the edit profile form

ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS portfolio_website TEXT;
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS reel_links TEXT[];
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS available_for TEXT[];
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS preferred_locations TEXT[];
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS contact_method TEXT;
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
ALTER TABLE filmmaker_profiles ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
