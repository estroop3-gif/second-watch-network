-- Story Management tables for Backlot
-- Stories, Story Beats, Characters, and Character Arcs

-- Stories table
CREATE TABLE IF NOT EXISTS backlot_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    logline TEXT,
    genre TEXT,
    tone TEXT,
    themes TEXT[], -- Array of theme strings
    structure_type TEXT DEFAULT 'three-act', -- three-act, five-act, hero-journey, save-the-cat, custom
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_stories_project_id ON backlot_stories(project_id);

-- Story Beats table
CREATE TABLE IF NOT EXISTS backlot_story_beats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES backlot_stories(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 1,
    act_marker TEXT, -- Act 1, Act 2, Midpoint, etc.
    title TEXT NOT NULL,
    content TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT backlot_story_beats_story_sort_unique UNIQUE(story_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_backlot_story_beats_story_id ON backlot_story_beats(story_id);

-- Characters table
CREATE TABLE IF NOT EXISTS backlot_story_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES backlot_stories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT, -- protagonist, antagonist, supporting, minor
    arc_summary TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_story_characters_story_id ON backlot_story_characters(story_id);

-- Character Arcs table (links characters to beats)
CREATE TABLE IF NOT EXISTS backlot_character_arcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES backlot_story_characters(id) ON DELETE CASCADE,
    beat_id UUID NOT NULL REFERENCES backlot_story_beats(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT backlot_character_arcs_char_beat_unique UNIQUE(character_id, beat_id)
);

CREATE INDEX IF NOT EXISTS idx_backlot_character_arcs_character_id ON backlot_character_arcs(character_id);
CREATE INDEX IF NOT EXISTS idx_backlot_character_arcs_beat_id ON backlot_character_arcs(beat_id);

-- Updated at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_story_management_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_backlot_stories_updated_at ON backlot_stories;
CREATE TRIGGER trigger_backlot_stories_updated_at
    BEFORE UPDATE ON backlot_stories
    FOR EACH ROW EXECUTE FUNCTION update_story_management_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_story_beats_updated_at ON backlot_story_beats;
CREATE TRIGGER trigger_backlot_story_beats_updated_at
    BEFORE UPDATE ON backlot_story_beats
    FOR EACH ROW EXECUTE FUNCTION update_story_management_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_story_characters_updated_at ON backlot_story_characters;
CREATE TRIGGER trigger_backlot_story_characters_updated_at
    BEFORE UPDATE ON backlot_story_characters
    FOR EACH ROW EXECUTE FUNCTION update_story_management_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_character_arcs_updated_at ON backlot_character_arcs;
CREATE TRIGGER trigger_backlot_character_arcs_updated_at
    BEFORE UPDATE ON backlot_character_arcs
    FOR EACH ROW EXECUTE FUNCTION update_story_management_updated_at();
