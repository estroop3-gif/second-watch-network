-- Storyboard Tables
-- For visual shot planning and storyboarding

-- Main storyboard table
CREATE TABLE IF NOT EXISTS storyboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    aspect_ratio TEXT DEFAULT '16:9',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LOCKED')),
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storyboards_project ON storyboards(project_id);

-- Storyboard sections (groups of panels)
CREATE TABLE IF NOT EXISTS storyboard_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(storyboard_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_storyboard_sections_storyboard ON storyboard_sections(storyboard_id);

-- Storyboard panels (individual shots)
CREATE TABLE IF NOT EXISTS storyboard_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES storyboard_sections(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    title TEXT,
    shot_size TEXT,
    camera_move TEXT,
    lens TEXT,
    framing TEXT,
    action TEXT,
    dialogue TEXT,
    audio TEXT,
    notes TEXT,
    duration_seconds INT,
    reference_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(section_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_storyboard_panels_storyboard ON storyboard_panels(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_panels_section ON storyboard_panels(section_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_panels_storyboard_section ON storyboard_panels(storyboard_id, section_id);

-- Comments
COMMENT ON TABLE storyboards IS 'Visual storyboards for shot planning';
COMMENT ON COLUMN storyboards.status IS 'DRAFT=editable, LOCKED=read-only';
COMMENT ON COLUMN storyboards.aspect_ratio IS 'Frame aspect ratio like 16:9, 2.39:1, 4:3';
COMMENT ON TABLE storyboard_sections IS 'Logical groupings of panels within a storyboard';
COMMENT ON TABLE storyboard_panels IS 'Individual shot/frame entries in a storyboard';
COMMENT ON COLUMN storyboard_panels.shot_size IS 'e.g., WS, MS, CU, ECU, OTS';
COMMENT ON COLUMN storyboard_panels.camera_move IS 'e.g., Static, Pan, Tilt, Dolly, Crane';
