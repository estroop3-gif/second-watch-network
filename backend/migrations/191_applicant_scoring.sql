-- Migration: 191_applicant_scoring.sql
-- Description: Applicant Ranking Algorithm - Film departments, roles, and scoring fields
-- This enables scoring/ranking applicants based on credits, experience, and network connections

-- =============================================================================
-- FILM DEPARTMENTS - Standard film industry departments
-- =============================================================================
CREATE TABLE IF NOT EXISTS film_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) CHECK (category IN ('leadership', 'technical', 'creative', 'general')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed film departments
INSERT INTO film_departments (name, slug, category, sort_order) VALUES
    ('Production', 'production', 'leadership', 1),
    ('Directing', 'directing', 'creative', 2),
    ('Writing', 'writing', 'creative', 3),
    ('Camera', 'camera', 'technical', 4),
    ('Sound', 'sound', 'technical', 5),
    ('Grip & Electric', 'grip_electric', 'technical', 6),
    ('Art', 'art', 'creative', 7),
    ('Wardrobe', 'wardrobe', 'creative', 8),
    ('Hair & Makeup', 'hair_makeup', 'creative', 9),
    ('Post Production', 'post', 'technical', 10),
    ('VFX', 'vfx', 'technical', 11),
    ('Stunts', 'stunts', 'general', 12),
    ('Locations', 'locations', 'general', 13),
    ('Transportation', 'transportation', 'general', 14),
    ('Catering', 'catering', 'general', 15),
    ('Cast', 'cast', 'creative', 16)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- FILM ROLES - Standard film industry roles with department associations
-- =============================================================================
CREATE TABLE IF NOT EXISTS film_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES film_departments(id) ON DELETE SET NULL,
    category VARCHAR(50) CHECK (category IN ('leadership', 'technical', 'creative', 'general')),
    aliases TEXT[], -- Alternative names for matching
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(slug, department_id)
);

-- Create indexes for role lookups
CREATE INDEX IF NOT EXISTS idx_film_roles_department ON film_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_film_roles_category ON film_roles(category);
CREATE INDEX IF NOT EXISTS idx_film_roles_slug ON film_roles(slug);

-- Seed film roles by department
-- Production Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT
    r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Executive Producer', 'executive_producer', 'leadership', ARRAY['EP', 'Exec Producer'], 1),
    ('Producer', 'producer', 'leadership', ARRAY['Line Producer'], 2),
    ('Co-Producer', 'co_producer', 'leadership', ARRAY['Co Producer'], 3),
    ('Associate Producer', 'associate_producer', 'leadership', ARRAY['AP', 'Assoc Producer'], 4),
    ('Unit Production Manager', 'upm', 'leadership', ARRAY['UPM', 'Production Manager'], 5),
    ('Production Coordinator', 'production_coordinator', 'leadership', ARRAY['POC', 'Coordinator'], 6),
    ('Production Secretary', 'production_secretary', 'general', ARRAY['Secretary'], 7),
    ('Production Assistant', 'production_assistant', 'general', ARRAY['PA', 'Set PA'], 8)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'production'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Directing Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Director', 'director', 'creative', ARRAY['Filmmaker', 'Helmer'], 1),
    ('First Assistant Director', '1st_ad', 'leadership', ARRAY['1st AD', 'First AD', '1AD'], 2),
    ('Second Assistant Director', '2nd_ad', 'leadership', ARRAY['2nd AD', 'Second AD', '2AD'], 3),
    ('Second Second Assistant Director', '2nd_2nd_ad', 'general', ARRAY['2nd 2nd AD', 'Key 2nd'], 4),
    ('Script Supervisor', 'script_supervisor', 'technical', ARRAY['Scripty', 'Script Super'], 5)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'directing'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Writing Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Writer', 'writer', 'creative', ARRAY['Screenwriter', 'Scribe'], 1),
    ('Co-Writer', 'co_writer', 'creative', ARRAY['Co Writer'], 2),
    ('Story By', 'story_by', 'creative', ARRAY['Story'], 3)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'writing'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Camera Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Director of Photography', 'dp', 'creative', ARRAY['DP', 'Cinematographer', 'DoP', 'DOP'], 1),
    ('Camera Operator', 'camera_operator', 'technical', ARRAY['Cam Op', 'A Camera Op', 'B Camera Op', 'Operator'], 2),
    ('First Assistant Camera', '1st_ac', 'technical', ARRAY['1st AC', 'Focus Puller', '1AC'], 3),
    ('Second Assistant Camera', '2nd_ac', 'technical', ARRAY['2nd AC', 'Clapper Loader', '2AC'], 4),
    ('DIT', 'dit', 'technical', ARRAY['Digital Imaging Technician'], 5),
    ('Steadicam Operator', 'steadicam_operator', 'technical', ARRAY['Steadicam Op', 'Steadicam'], 6),
    ('Camera PA', 'camera_pa', 'general', ARRAY['Camera Production Assistant'], 7)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'camera'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Sound Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Production Sound Mixer', 'sound_mixer', 'technical', ARRAY['Sound Mixer', 'Mixer', 'PSM'], 1),
    ('Boom Operator', 'boom_operator', 'technical', ARRAY['Boom Op', 'Boom'], 2),
    ('Sound Utility', 'sound_utility', 'general', ARRAY['Utility Sound', 'Cable Person'], 3)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'sound'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Grip & Electric Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Gaffer', 'gaffer', 'technical', ARRAY['Chief Lighting Technician', 'CLT'], 1),
    ('Best Boy Electric', 'best_boy_electric', 'technical', ARRAY['BBE', 'Best Boy'], 2),
    ('Electrician', 'electrician', 'technical', ARRAY['Spark', 'Juicer', 'Set Electrician'], 3),
    ('Key Grip', 'key_grip', 'technical', ARRAY['KG'], 4),
    ('Best Boy Grip', 'best_boy_grip', 'technical', ARRAY['BBG'], 5),
    ('Grip', 'grip', 'technical', ARRAY['Set Grip', 'Dolly Grip'], 6)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'grip_electric'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Art Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Production Designer', 'production_designer', 'creative', ARRAY['PD'], 1),
    ('Art Director', 'art_director', 'creative', ARRAY['AD (Art)'], 2),
    ('Set Decorator', 'set_decorator', 'creative', ARRAY['Set Dec'], 3),
    ('Props Master', 'props_master', 'technical', ARRAY['Prop Master', 'Props'], 4),
    ('Set Dresser', 'set_dresser', 'technical', ARRAY['Dresser'], 5),
    ('Art PA', 'art_pa', 'general', ARRAY['Art Department PA'], 6)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'art'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Wardrobe Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Costume Designer', 'costume_designer', 'creative', ARRAY['CD'], 1),
    ('Key Costumer', 'key_costumer', 'technical', ARRAY['Key Wardrobe'], 2),
    ('Set Costumer', 'set_costumer', 'technical', ARRAY['Costumer', 'Wardrobe'], 3),
    ('Wardrobe PA', 'wardrobe_pa', 'general', ARRAY['Costume PA'], 4)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'wardrobe'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Hair & Makeup Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Makeup Department Head', 'makeup_dept_head', 'creative', ARRAY['Key Makeup', 'MU Dept Head'], 1),
    ('Hair Department Head', 'hair_dept_head', 'creative', ARRAY['Key Hair', 'Hair Dept Head'], 2),
    ('Makeup Artist', 'makeup_artist', 'technical', ARRAY['MUA', 'Makeup'], 3),
    ('Hair Stylist', 'hair_stylist', 'technical', ARRAY['Hairstylist', 'Hair'], 4),
    ('SPFX Makeup', 'spfx_makeup', 'technical', ARRAY['Special Effects Makeup', 'Prosthetics'], 5)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'hair_makeup'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Post Production Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Editor', 'editor', 'creative', ARRAY['Film Editor', 'Picture Editor'], 1),
    ('Assistant Editor', 'assistant_editor', 'technical', ARRAY['AE', 'Asst Editor'], 2),
    ('Post Supervisor', 'post_supervisor', 'leadership', ARRAY['Post Production Supervisor'], 3),
    ('Colorist', 'colorist', 'technical', ARRAY['Color', 'DI Colorist'], 4),
    ('Sound Designer', 'sound_designer', 'creative', ARRAY['Sound Design'], 5),
    ('Composer', 'composer', 'creative', ARRAY['Music Composer', 'Score'], 6)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'post'
ON CONFLICT (slug, department_id) DO NOTHING;

-- VFX Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('VFX Supervisor', 'vfx_supervisor', 'creative', ARRAY['Visual Effects Supervisor'], 1),
    ('VFX Producer', 'vfx_producer', 'leadership', ARRAY['Visual Effects Producer'], 2),
    ('VFX Artist', 'vfx_artist', 'technical', ARRAY['Visual Effects Artist', 'Compositor'], 3),
    ('Motion Graphics', 'motion_graphics', 'technical', ARRAY['Motion Designer', 'MoGraph'], 4)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'vfx'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Stunts Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Stunt Coordinator', 'stunt_coordinator', 'leadership', ARRAY['Stunt Coord'], 1),
    ('Stunt Performer', 'stunt_performer', 'technical', ARRAY['Stunt Person', 'Stunt Double'], 2)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'stunts'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Locations Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Location Manager', 'location_manager', 'leadership', ARRAY['LM', 'Loc Manager'], 1),
    ('Assistant Location Manager', 'assistant_location_manager', 'technical', ARRAY['ALM', 'Asst Loc Manager'], 2),
    ('Location Scout', 'location_scout', 'technical', ARRAY['Scout'], 3),
    ('Location PA', 'location_pa', 'general', ARRAY['Locations PA'], 4)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'locations'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Transportation Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Transportation Coordinator', 'transportation_coordinator', 'leadership', ARRAY['Transpo Coord', 'TC'], 1),
    ('Transportation Captain', 'transportation_captain', 'technical', ARRAY['Transpo Captain'], 2),
    ('Driver', 'driver', 'general', ARRAY['Transpo Driver'], 3)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'transportation'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Catering Department
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Craft Services', 'craft_services', 'general', ARRAY['Crafty', 'Craft Service'], 1),
    ('Caterer', 'caterer', 'general', ARRAY['Catering'], 2)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'catering'
ON CONFLICT (slug, department_id) DO NOTHING;

-- Cast Department (for cast roles that need department categorization)
INSERT INTO film_roles (name, slug, department_id, category, aliases, sort_order)
SELECT r.name, r.slug, d.id, r.category, r.aliases, r.sort_order
FROM (VALUES
    ('Lead', 'lead', 'creative', ARRAY['Lead Actor', 'Star'], 1),
    ('Supporting', 'supporting', 'creative', ARRAY['Supporting Actor', 'Co-Star'], 2),
    ('Featured', 'featured', 'creative', ARRAY['Featured Extra', 'Featured Background'], 3),
    ('Day Player', 'day_player', 'creative', ARRAY['Guest Star', 'One Day'], 4),
    ('Background', 'background', 'general', ARRAY['Extra', 'BG', 'Atmosphere'], 5)
) AS r(name, slug, category, aliases, sort_order)
CROSS JOIN film_departments d WHERE d.slug = 'cast'
ON CONFLICT (slug, department_id) DO NOTHING;

-- =============================================================================
-- TRANSFERABLE SKILLS MAPPING - Links roles with transferable skill categories
-- =============================================================================
CREATE TABLE IF NOT EXISTS film_role_skill_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES film_roles(id) ON DELETE CASCADE,
    skill_category VARCHAR(50) NOT NULL CHECK (skill_category IN ('leadership', 'technical', 'creative')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, skill_category)
);

-- Index for skill category lookups
CREATE INDEX IF NOT EXISTS idx_film_role_skill_categories_role ON film_role_skill_categories(role_id);
CREATE INDEX IF NOT EXISTS idx_film_role_skill_categories_category ON film_role_skill_categories(skill_category);

-- Map leadership roles
INSERT INTO film_role_skill_categories (role_id, skill_category)
SELECT r.id, 'leadership'
FROM film_roles r
WHERE r.slug IN (
    '1st_ad', 'upm', 'producer', 'executive_producer', 'co_producer',
    'production_coordinator', 'post_supervisor', 'stunt_coordinator',
    'location_manager', 'transportation_coordinator', 'vfx_producer'
)
ON CONFLICT (role_id, skill_category) DO NOTHING;

-- Map technical roles
INSERT INTO film_role_skill_categories (role_id, skill_category)
SELECT r.id, 'technical'
FROM film_roles r
WHERE r.slug IN (
    'dit', 'post_supervisor', 'vfx_supervisor', 'editor', 'colorist',
    '1st_ac', '2nd_ac', 'sound_mixer', 'gaffer', 'key_grip',
    'assistant_editor'
)
ON CONFLICT (role_id, skill_category) DO NOTHING;

-- Map creative roles
INSERT INTO film_role_skill_categories (role_id, skill_category)
SELECT r.id, 'creative'
FROM film_roles r
WHERE r.slug IN (
    'director', 'dp', 'production_designer', 'art_director', 'writer',
    'costume_designer', 'editor', 'composer', 'sound_designer',
    'vfx_supervisor'
)
ON CONFLICT (role_id, skill_category) DO NOTHING;

-- =============================================================================
-- ADD CREW POSITION FIELDS TO COMMUNITY COLLABS
-- =============================================================================
ALTER TABLE community_collabs
    ADD COLUMN IF NOT EXISTS crew_position VARCHAR(100),
    ADD COLUMN IF NOT EXISTS crew_department VARCHAR(100);

-- Index for filtering by crew position
CREATE INDEX IF NOT EXISTS idx_community_collabs_crew_position
    ON community_collabs(crew_position) WHERE crew_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_collabs_crew_department
    ON community_collabs(crew_department) WHERE crew_department IS NOT NULL;

COMMENT ON COLUMN community_collabs.crew_position IS 'The specific crew position being hired for (e.g., Camera Operator, Gaffer)';
COMMENT ON COLUMN community_collabs.crew_department IS 'The department for the crew position (e.g., Camera, Grip & Electric)';

-- =============================================================================
-- ADD SCORING FIELDS TO COMMUNITY COLLAB APPLICATIONS
-- =============================================================================
ALTER TABLE community_collab_applications
    ADD COLUMN IF NOT EXISTS match_score INTEGER,
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
    ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

-- Add check constraint for score range
ALTER TABLE community_collab_applications
    ADD CONSTRAINT chk_match_score_range
    CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100));

-- Index for sorting by score (descending for "best matches first")
CREATE INDEX IF NOT EXISTS idx_collab_applications_match_score
    ON community_collab_applications(collab_id, match_score DESC NULLS LAST);

-- Index for finding applications that need scoring
CREATE INDEX IF NOT EXISTS idx_collab_applications_needs_scoring
    ON community_collab_applications(collab_id)
    WHERE match_score IS NULL;

COMMENT ON COLUMN community_collab_applications.match_score IS 'Calculated match score 0-100 based on credits, experience, and network';
COMMENT ON COLUMN community_collab_applications.score_breakdown IS 'JSON breakdown of score components: role_credits, experience, network';
COMMENT ON COLUMN community_collab_applications.score_calculated_at IS 'When the score was last calculated';

-- =============================================================================
-- HELPER FUNCTION: Normalize role text for matching
-- =============================================================================
CREATE OR REPLACE FUNCTION normalize_role_text(role_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(
        REGEXP_REPLACE(
            REGEXP_REPLACE(role_text, '\s+', ' ', 'g'),  -- Normalize whitespace
            '[^a-z0-9\s]', '', 'gi'  -- Remove special chars
        )
    ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER FUNCTION: Find matching film role by name/alias
-- =============================================================================
CREATE OR REPLACE FUNCTION find_film_role_id(role_text TEXT)
RETURNS UUID AS $$
DECLARE
    normalized_text TEXT;
    role_id UUID;
BEGIN
    normalized_text := normalize_role_text(role_text);

    -- Try exact name match first
    SELECT r.id INTO role_id
    FROM film_roles r
    WHERE normalize_role_text(r.name) = normalized_text
    LIMIT 1;

    IF role_id IS NOT NULL THEN
        RETURN role_id;
    END IF;

    -- Try alias match
    SELECT r.id INTO role_id
    FROM film_roles r
    WHERE EXISTS (
        SELECT 1 FROM unnest(r.aliases) AS alias
        WHERE normalize_role_text(alias) = normalized_text
    )
    LIMIT 1;

    RETURN role_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- HELPER FUNCTION: Get department for a role
-- =============================================================================
CREATE OR REPLACE FUNCTION get_department_for_role(role_text TEXT)
RETURNS TEXT AS $$
DECLARE
    dept_name TEXT;
    role_id UUID;
BEGIN
    role_id := find_film_role_id(role_text);

    IF role_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT d.name INTO dept_name
    FROM film_roles r
    JOIN film_departments d ON d.id = r.department_id
    WHERE r.id = role_id;

    RETURN dept_name;
END;
$$ LANGUAGE plpgsql STABLE;
