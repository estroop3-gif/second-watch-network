-- Craft Houses Rebrand Migration
-- Updates craft house names to fun, world-building names
-- Adds new craft houses for comprehensive film industry coverage
-- Updates role system from member/deputy/master to apprentice/associate/member/steward
-- Enforces one craft house per member

-- ============================================================
-- PHASE 1: Update existing craft house names and slugs
-- ============================================================

-- Camera Guild -> Order of the Lens
UPDATE order_craft_houses SET
    name = 'Order of the Lens',
    slug = 'order-of-the-lens',
    description = 'The guild of image makers. Directors of Photography, Camera Operators, Assistant Cameras, DITs, gimbal operators, Steadicam operators, drone pilots, and solo camera operators.',
    updated_at = NOW()
WHERE slug = 'camera-guild';

-- Lighting & Grip House -> Guild of Sparks and Steel
UPDATE order_craft_houses SET
    name = 'Guild of Sparks and Steel',
    slug = 'guild-of-sparks-and-steel',
    description = 'Masters of light and rigging. Gaffers, Electricians, Key Grips, Grips, rigging teams, and dolly operators.',
    updated_at = NOW()
WHERE slug = 'lighting-grip-house';

-- Audio Sanctum -> Echo and Frame Guild (combining with Post)
UPDATE order_craft_houses SET
    name = 'Echo and Frame Guild',
    slug = 'echo-and-frame-guild',
    description = 'Keepers of sound and story flow. Production Sound Mixers, Boom Operators, Sound Designers, Editors, Assistant Editors, Colorists, and Finishing Artists.',
    primary_tracks = ARRAY['audio', 'post', 'colorist'],
    updated_at = NOW()
WHERE slug = 'audio-sanctum';

-- Production Office -> Keepers of the Line
UPDATE order_craft_houses SET
    name = 'Keepers of the Line',
    slug = 'keepers-of-the-line',
    description = 'Guardians of the budget and schedule. Producers, Line Producers, UPMs, Production Coordinators, and Production Managers.',
    updated_at = NOW()
WHERE slug = 'production-office';

-- Writers Chamber -> Scribes of the Second Draft
UPDATE order_craft_houses SET
    name = 'Scribes of the Second Draft',
    slug = 'scribes-of-the-second-draft',
    description = 'Weavers of story and dialogue. Screenwriters, Story Editors, Story Producers, and Writers Room staff.',
    updated_at = NOW()
WHERE slug = 'writers-chamber';

-- Directors Circle -> Circle of Action
UPDATE order_craft_houses SET
    name = 'Circle of Action',
    slug = 'circle-of-action',
    description = 'Leaders of the set. Directors, Second Unit Directors, Assistant Directors, and Floor Managers.',
    updated_at = NOW()
WHERE slug = 'directors-circle';

-- Art & Wardrobe House -> Worldbuilders Hall
UPDATE order_craft_houses SET
    name = 'Worldbuilders Hall',
    slug = 'worldbuilders-hall',
    description = 'Creators of visual worlds. Production Designers, Art Directors, Props Masters, Costume Designers, Wardrobe Stylists, Makeup Artists, and Hair Stylists.',
    primary_tracks = ARRAY['art_department', 'wardrobe', 'makeup_hair'],
    updated_at = NOW()
WHERE slug = 'art-wardrobe-house';

-- VFX & Motion Hall -> Realm of Illusions
UPDATE order_craft_houses SET
    name = 'Realm of Illusions',
    slug = 'realm-of-illusions',
    description = 'Masters of digital magic. VFX Artists, Motion Graphics Designers, Compositors, 3D Artists, and Digital Artists.',
    updated_at = NOW()
WHERE slug = 'vfx-motion-hall';

-- ============================================================
-- PHASE 2: Remove merged/obsolete houses
-- ============================================================

-- Post House merged into Echo and Frame Guild
-- Move any memberships first
UPDATE order_craft_house_memberships
SET craft_house_id = (SELECT id FROM order_craft_houses WHERE slug = 'echo-and-frame-guild')
WHERE craft_house_id = (SELECT id FROM order_craft_houses WHERE slug = 'post-house');

DELETE FROM order_craft_houses WHERE slug = 'post-house';

-- Makeup & Hair Guild merged into Worldbuilders Hall
UPDATE order_craft_house_memberships
SET craft_house_id = (SELECT id FROM order_craft_houses WHERE slug = 'worldbuilders-hall')
WHERE craft_house_id = (SELECT id FROM order_craft_houses WHERE slug = 'makeup-hair-guild');

DELETE FROM order_craft_houses WHERE slug = 'makeup-hair-guild';

-- First Watch Order -> Channel and Feed Guild (repurposing for digital creators)
UPDATE order_craft_houses SET
    name = 'Channel and Feed Guild',
    slug = 'channel-and-feed-guild',
    description = 'Digital storytellers and creators. YouTubers, Christian content creators, Channel Managers, Short-form Editors, Thumbnail Artists, and Social Media teams.',
    primary_tracks = ARRAY['other'],
    updated_at = NOW()
WHERE slug = 'first-watch-order';

-- ============================================================
-- PHASE 3: Add new craft houses
-- ============================================================

-- Ground Game Order (Locations & Transport)
INSERT INTO order_craft_houses (name, slug, description, icon, primary_tracks, status, created_at, updated_at)
VALUES (
    'Ground Game Order',
    'ground-game-order',
    'Masters of place and movement. Location Managers, Location Scouts, Transport Captains, Drivers, and Picture Car Coordinators.',
    'map-pin',
    ARRAY['locations', 'transport'],
    'active',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Fall and Fire Circle (Stunts & Safety)
INSERT INTO order_craft_houses (name, slug, description, icon, primary_tracks, status, created_at, updated_at)
VALUES (
    'Fall and Fire Circle',
    'fall-and-fire-circle',
    'Guardians of action and safety. Stunt Coordinators, Stunt Performers, Intimacy Coordinators, and Safety Officers.',
    'flame',
    ARRAY['stunts', 'safety'],
    'active',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Live Signal Collective (Broadcast & Multicam)
INSERT INTO order_craft_houses (name, slug, description, icon, primary_tracks, status, created_at, updated_at)
VALUES (
    'Live Signal Collective',
    'live-signal-collective',
    'Masters of the live feed. Technical Directors, Broadcast Camera Operators, Video Shaders, Replay Operators, Graphics Operators, Stage Managers, and Streaming Technicians.',
    'radio',
    ARRAY['broadcast', 'church_media'],
    'active',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================
-- PHASE 4: Update role system
-- ============================================================

-- First, drop the existing check constraint on role
ALTER TABLE order_craft_house_memberships DROP CONSTRAINT IF EXISTS order_craft_house_memberships_role_check;

-- Update existing roles to new system
-- master -> steward
-- deputy -> member (promote deputies to members)
-- member -> associate (existing members become associates)
-- Note: Order matters here to avoid conflicts

UPDATE order_craft_house_memberships SET role = 'steward' WHERE role = 'master';
UPDATE order_craft_house_memberships SET role = 'temp_member' WHERE role = 'deputy';
UPDATE order_craft_house_memberships SET role = 'associate' WHERE role = 'member';
UPDATE order_craft_house_memberships SET role = 'member' WHERE role = 'temp_member';

-- Add new check constraint with updated role values
ALTER TABLE order_craft_house_memberships ADD CONSTRAINT order_craft_house_memberships_role_check
    CHECK (role IN ('apprentice', 'associate', 'member', 'steward'));

-- ============================================================
-- PHASE 5: Enforce one craft house per member
-- ============================================================

-- First, handle any duplicate memberships by keeping the most recent one
-- This creates a temp table to identify duplicates
WITH duplicates AS (
    SELECT user_id, craft_house_id, id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM order_craft_house_memberships
)
DELETE FROM order_craft_house_memberships
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on user_id (one craft house per member)
-- Drop existing constraint if it exists
ALTER TABLE order_craft_house_memberships DROP CONSTRAINT IF EXISTS unique_user_craft_house;
ALTER TABLE order_craft_house_memberships DROP CONSTRAINT IF EXISTS one_craft_house_per_user;

-- Add new unique constraint
ALTER TABLE order_craft_house_memberships ADD CONSTRAINT one_craft_house_per_user UNIQUE (user_id);

-- ============================================================
-- PHASE 6: Update icons for all houses
-- ============================================================

UPDATE order_craft_houses SET icon = 'camera' WHERE slug = 'order-of-the-lens';
UPDATE order_craft_houses SET icon = 'zap' WHERE slug = 'guild-of-sparks-and-steel';
UPDATE order_craft_houses SET icon = 'waves' WHERE slug = 'echo-and-frame-guild';
UPDATE order_craft_houses SET icon = 'clipboard-list' WHERE slug = 'keepers-of-the-line';
UPDATE order_craft_houses SET icon = 'pen-tool' WHERE slug = 'scribes-of-the-second-draft';
UPDATE order_craft_houses SET icon = 'clapperboard' WHERE slug = 'circle-of-action';
UPDATE order_craft_houses SET icon = 'palette' WHERE slug = 'worldbuilders-hall';
UPDATE order_craft_houses SET icon = 'wand-2' WHERE slug = 'realm-of-illusions';
UPDATE order_craft_houses SET icon = 'map-pin' WHERE slug = 'ground-game-order';
UPDATE order_craft_houses SET icon = 'flame' WHERE slug = 'fall-and-fire-circle';
UPDATE order_craft_houses SET icon = 'radio' WHERE slug = 'live-signal-collective';
UPDATE order_craft_houses SET icon = 'youtube' WHERE slug = 'channel-and-feed-guild';

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================

-- Run this after migration to verify:
-- SELECT id, name, slug, icon, status FROM order_craft_houses ORDER BY name;
-- SELECT COUNT(*) as member_count, role FROM order_craft_house_memberships GROUP BY role;
