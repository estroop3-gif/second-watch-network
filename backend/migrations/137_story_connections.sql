-- Story Connections: Link stories to scenes, episodes, and cast
-- Enables tracking which scenes feature which story beats,
-- which episodes contain which stories, and which cast members play story characters

-- Story beat to scene linking
-- Tracks which scenes feature/setup/payoff specific story beats
CREATE TABLE IF NOT EXISTS backlot_story_beat_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beat_id UUID NOT NULL REFERENCES backlot_story_beats(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES backlot_scenes(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'features' CHECK (relationship IN ('features', 'setup', 'payoff', 'reference')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(beat_id, scene_id)
);

CREATE INDEX IF NOT EXISTS idx_story_beat_scenes_beat ON backlot_story_beat_scenes(beat_id);
CREATE INDEX IF NOT EXISTS idx_story_beat_scenes_scene ON backlot_story_beat_scenes(scene_id);

-- Story to episode linking
-- Tracks which episodes contain which stories (primary plot, subplot, or story arc)
CREATE TABLE IF NOT EXISTS backlot_story_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES backlot_stories(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'primary' CHECK (relationship IN ('primary', 'subplot', 'arc')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, episode_id)
);

CREATE INDEX IF NOT EXISTS idx_story_episodes_story ON backlot_story_episodes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_episodes_episode ON backlot_story_episodes(episode_id);

-- Story character to project role (cast member) linking
-- Tracks which cast members are playing which story characters
CREATE TABLE IF NOT EXISTS backlot_story_character_cast (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES backlot_story_characters(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES backlot_project_roles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_story_character_cast_char ON backlot_story_character_cast(character_id);
CREATE INDEX IF NOT EXISTS idx_story_character_cast_role ON backlot_story_character_cast(role_id);
