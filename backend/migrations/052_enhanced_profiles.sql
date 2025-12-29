-- Migration: 052_enhanced_profiles.sql
-- Description: Add enhanced profile fields, privacy settings, and credit display options

-- Add new profile fields for enhanced public profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about_me TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS union_affiliations TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS imdb_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS demo_reel_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS featured_work_ids UUID[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_layout TEXT DEFAULT 'standard';

-- Privacy controls table
CREATE TABLE IF NOT EXISTS profile_privacy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    show_email BOOLEAN DEFAULT false,
    show_phone BOOLEAN DEFAULT false,
    show_location BOOLEAN DEFAULT true,
    show_availability BOOLEAN DEFAULT true,
    show_credits BOOLEAN DEFAULT true,
    show_equipment BOOLEAN DEFAULT true,
    show_union_status BOOLEAN DEFAULT true,
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'members_only', 'connections_only')),
    allow_messages TEXT DEFAULT 'everyone' CHECK (allow_messages IN ('everyone', 'connections', 'none')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Featured credits on profile
ALTER TABLE credits ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Platform-wide profile configuration (admin settings)
CREATE TABLE IF NOT EXISTS profile_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id)
);

-- Insert default profile config
INSERT INTO profile_config (config_key, config_value, description)
VALUES
    ('default_layout', '"standard"', 'Default profile layout for new users'),
    ('available_layouts', '["standard", "portfolio", "minimal"]', 'Available profile layout options'),
    ('required_fields', '["full_name"]', 'Fields required on all profiles'),
    ('default_privacy', '{"profile_visibility": "public", "show_email": false, "show_phone": false, "show_location": true, "show_credits": true, "allow_messages": "everyone"}', 'Default privacy settings for new users'),
    ('visible_fields', '["tagline", "about_me", "location", "skills", "equipment", "credits", "availability"]', 'Fields visible on public profiles by default')
ON CONFLICT (config_key) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_privacy_user ON profile_privacy_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_featured ON credits(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_credits_user_order ON credits(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_profiles_layout ON profiles(profile_layout);
