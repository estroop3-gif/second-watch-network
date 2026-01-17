-- Migration: Add cast position types table and reference columns
-- Cast position types are user-addable to allow flexible categorization (Lead, Supporting, etc.)

-- =====================================================
-- Create cast_position_types table
-- =====================================================
CREATE TABLE IF NOT EXISTS cast_position_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id UUID REFERENCES profiles(id)
);

-- Create index for searching by name
CREATE INDEX IF NOT EXISTS idx_cast_position_types_name ON cast_position_types(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_cast_position_types_slug ON cast_position_types(slug);

-- =====================================================
-- Seed default cast position types
-- =====================================================
INSERT INTO cast_position_types (name, slug) VALUES
    ('Lead', 'lead'),
    ('Supporting', 'supporting'),
    ('Featured', 'featured'),
    ('Day Player', 'day_player'),
    ('Background / Extra', 'background'),
    ('Stand-In / Photo Double', 'stand_in'),
    ('Stunt Performer', 'stunt'),
    ('Voice Over', 'voice_over'),
    ('Host / Presenter', 'host'),
    ('Cameo', 'cameo')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- Add cast_position_type_id to backlot_project_roles
-- =====================================================
ALTER TABLE backlot_project_roles
ADD COLUMN IF NOT EXISTS cast_position_type_id UUID REFERENCES cast_position_types(id);

CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_cast_position_type
ON backlot_project_roles(cast_position_type_id);

-- =====================================================
-- Add cast_position_type_id to community_collabs
-- =====================================================
ALTER TABLE community_collabs
ADD COLUMN IF NOT EXISTS cast_position_type_id UUID REFERENCES cast_position_types(id);

CREATE INDEX IF NOT EXISTS idx_community_collabs_cast_position_type
ON community_collabs(cast_position_type_id);

-- =====================================================
-- Add comments for documentation
-- =====================================================
COMMENT ON TABLE cast_position_types IS 'User-addable cast position types (Lead, Supporting, Background, etc.)';
COMMENT ON COLUMN cast_position_types.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN cast_position_types.created_by_user_id IS 'User who created this type (null for system-seeded)';
COMMENT ON COLUMN backlot_project_roles.cast_position_type_id IS 'Type of cast role (Lead, Supporting, etc.)';
COMMENT ON COLUMN community_collabs.cast_position_type_id IS 'Type of cast role for looking_for_cast collabs';
