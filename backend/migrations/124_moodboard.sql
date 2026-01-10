-- Migration 124: Moodboard Visual Reference Tool
-- Moodboards contain sections and items (tiles) for visual inspiration
-- Used for look/feel, tone, wardrobe, locations, lighting, color reference

-- Moodboards table
CREATE TABLE IF NOT EXISTS moodboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moodboards_project_id ON moodboards(project_id);

-- Moodboard sections for organizing items
CREATE TABLE IF NOT EXISTS moodboard_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moodboard_id UUID NOT NULL REFERENCES moodboards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT moodboard_sections_moodboard_sort_unique UNIQUE(moodboard_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_moodboard_sections_moodboard_id ON moodboard_sections(moodboard_id);

-- Moodboard items (visual tiles)
CREATE TABLE IF NOT EXISTS moodboard_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    moodboard_id UUID NOT NULL REFERENCES moodboards(id) ON DELETE CASCADE,
    section_id UUID REFERENCES moodboard_sections(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 1,
    image_url TEXT NOT NULL,
    source_url TEXT,
    title TEXT,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT moodboard_items_moodboard_section_sort_unique UNIQUE(moodboard_id, section_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_moodboard_items_project_moodboard ON moodboard_items(project_id, moodboard_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_items_moodboard_section ON moodboard_items(moodboard_id, section_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_items_tags ON moodboard_items USING gin(tags);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_moodboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS moodboards_updated_at ON moodboards;
CREATE TRIGGER moodboards_updated_at
    BEFORE UPDATE ON moodboards
    FOR EACH ROW EXECUTE FUNCTION update_moodboard_updated_at();

DROP TRIGGER IF EXISTS moodboard_sections_updated_at ON moodboard_sections;
CREATE TRIGGER moodboard_sections_updated_at
    BEFORE UPDATE ON moodboard_sections
    FOR EACH ROW EXECUTE FUNCTION update_moodboard_updated_at();

DROP TRIGGER IF EXISTS moodboard_items_updated_at ON moodboard_items;
CREATE TRIGGER moodboard_items_updated_at
    BEFORE UPDATE ON moodboard_items
    FOR EACH ROW EXECUTE FUNCTION update_moodboard_updated_at();
