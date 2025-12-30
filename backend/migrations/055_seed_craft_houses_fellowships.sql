-- Seed data for Order Craft Houses and Fellowships
-- Migration 055

-- ============================================================
-- CRAFT HOUSES - 11 Department-based groups
-- ============================================================

INSERT INTO order_craft_houses (name, slug, description, icon, primary_tracks, status) VALUES

-- Camera Department
('Camera Guild', 'camera-guild',
 'The Camera Guild unites Directors of Photography, Camera Operators, Assistant Cameras, and all who work behind the lens. We pursue excellence in visual storytelling through mentorship, equipment training, and collaborative projects.',
 'Camera', ARRAY['camera'], 'active'),

-- Lighting & Grip
('Lighting & Grip House', 'lighting-grip-house',
 'Masters of light and rigging, the Lighting & Grip House brings together Gaffers, Key Grips, Electricians, and Grips. We shape the visual mood of every production through technical expertise and creative problem-solving.',
 'Lightbulb', ARRAY['lighting'], 'active'),

-- Audio Department
('Audio Sanctum', 'audio-sanctum',
 'The Audio Sanctum is home to Production Sound Mixers, Boom Operators, Sound Designers, and Post-Audio Engineers. We protect the sacred art of sound, ensuring every word and note reaches the audience with clarity and impact.',
 'Volume2', ARRAY['audio'], 'active'),

-- Production Office
('Production Office', 'production-office',
 'The nerve center of every production. The Production Office houses Assistant Directors, Production Coordinators, Unit Production Managers, and Line Producers who keep productions running smoothly.',
 'ClipboardList', ARRAY['production', 'producer', 'church_media'], 'active'),

-- Post-Production
('Post House', 'post-house',
 'Where stories are assembled and polished. The Post House unites Editors, Assistant Editors, Colorists, and Post-Production Supervisors who shape raw footage into compelling narratives.',
 'Film', ARRAY['post', 'colorist'], 'active'),

-- VFX & Motion Graphics
('VFX & Motion Hall', 'vfx-motion-hall',
 'The realm of digital artistry. VFX & Motion Hall brings together Visual Effects Artists, Motion Graphics Designers, Compositors, and 3D Artists who create worlds beyond the camera''s reach.',
 'Wand2', ARRAY['vfx', 'motion_graphics'], 'active'),

-- Writers
('Writers Chamber', 'writers-chamber',
 'Where stories begin. The Writers Chamber is a sanctuary for Screenwriters, Story Editors, and Script Consultants who craft the narratives that inspire all we do.',
 'PenTool', ARRAY['writing'], 'active'),

-- Directors
('Directors Circle', 'directors-circle',
 'The visionaries who lead. The Directors Circle unites Directors, Showrunners, and Creative Directors who guide productions from concept to completion with artistic vision and leadership.',
 'Clapperboard', ARRAY['directing'], 'active'),

-- Art & Wardrobe (new track)
('Art & Wardrobe House', 'art-wardrobe-house',
 'Creators of worlds both real and imagined. The Art & Wardrobe House brings together Production Designers, Art Directors, Set Decorators, Costume Designers, and Wardrobe Supervisors.',
 'Palette', ARRAY['art_department', 'wardrobe'], 'active'),

-- Makeup & Hair (new track)
('Makeup & Hair Guild', 'makeup-hair-guild',
 'Artists of transformation. The Makeup & Hair Guild unites Makeup Artists, Hair Stylists, Special Effects Makeup Artists, and Prosthetics Specialists who bring characters to life.',
 'Brush', ARRAY['makeup_hair'], 'active'),

-- First Watch (Entry-level/PAs)
('First Watch Order', 'first-watch-order',
 'Every master was once a student. The First Watch Order is dedicated to Production Assistants, Interns, and newcomers to the industry. Here, the next generation learns the craft and earns their place in the Order.',
 'GraduationCap', ARRAY['other'], 'active')

ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    primary_tracks = EXCLUDED.primary_tracks,
    updated_at = NOW();

-- ============================================================
-- FELLOWSHIPS - Cross-craft special interest groups
-- ============================================================

INSERT INTO order_fellowships (name, slug, fellowship_type, description, requirements, is_opt_in, is_visible, status) VALUES

-- Kingdom Builders - Faith-based fellowship
('Kingdom Builders Fellowship', 'kingdom-builders',
 'faith_based',
 'Kingdom Builders is an optional fellowship for Order members who share a Christian faith and want to integrate their spiritual calling with their filmmaking craft. We gather for prayer, encouragement, and faith-focused projects.',
 'Open to all Order members who affirm the Christian faith. Participation is entirely voluntary.',
 true, true, 'active'),

-- First Watch Fellowship - Entry-level support
('First Watch Fellowship', 'first-watch-fellowship',
 'entry_level',
 'A supportive community for those just beginning their journey in film and media. First Watch Fellowship provides mentorship matching, entry-level job connections, and a safe space to ask questions and grow.',
 'Automatically assigned to members with less than 2 years of experience. Others may opt-in.',
 false, true, 'active'),

-- Women of the Watch
('Women of the Watch', 'women-of-the-watch',
 'special_interest',
 'A fellowship celebrating and supporting women in the film industry. We provide networking, mentorship, and advocacy for female filmmakers at all levels.',
 'Open to all female-identifying Order members.',
 true, true, 'active'),

-- Veterans in Film
('Veterans in Film', 'veterans-in-film',
 'special_interest',
 'A fellowship for military veterans who have transitioned to careers in film and media. We leverage our unique experiences and discipline to tell stories that matter.',
 'Open to all Order members who have served in the armed forces.',
 true, true, 'active'),

-- International Chapter (for members outside US)
('International Watch', 'international-watch',
 'regional',
 'Connecting Order members around the world. The International Watch provides support, networking, and resources for members working outside the United States.',
 'Open to Order members based outside the continental United States.',
 true, true, 'active')

ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    fellowship_type = EXCLUDED.fellowship_type,
    description = EXCLUDED.description,
    requirements = EXCLUDED.requirements,
    is_opt_in = EXCLUDED.is_opt_in,
    is_visible = EXCLUDED.is_visible,
    updated_at = NOW();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE order_craft_houses IS 'Seeded with 11 initial Craft Houses covering all major film departments';
COMMENT ON TABLE order_fellowships IS 'Seeded with 5 initial Fellowships for various member communities';
