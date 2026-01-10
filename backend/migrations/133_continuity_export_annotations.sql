-- Migration 133: Continuity Export Annotations
-- Adds version-specific annotation storage for Continuity tab PDF viewer
-- Each export version has independent highlights, notes, and drawings

-- Highlights on exported PDFs (per export version)
CREATE TABLE IF NOT EXISTS backlot_continuity_export_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES backlot_continuity_exports(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    -- Rectangle coordinates (percentage of page dimensions for resolution-independence)
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    -- Styling
    color VARCHAR(20) DEFAULT 'yellow',
    opacity FLOAT DEFAULT 0.3,
    -- Metadata
    text_content TEXT,  -- Selected text if applicable
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes/comments on exported PDFs (per export version)
CREATE TABLE IF NOT EXISTS backlot_continuity_export_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES backlot_continuity_exports(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    -- Anchor position (percentage of page dimensions)
    anchor_x FLOAT NOT NULL,
    anchor_y FLOAT NOT NULL,
    -- Content
    note_text TEXT NOT NULL,
    note_category VARCHAR(50) DEFAULT 'general',
    is_critical BOOLEAN DEFAULT FALSE,
    -- Metadata
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Freehand drawings/markup on exported PDFs (per export version)
CREATE TABLE IF NOT EXISTS backlot_continuity_export_drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES backlot_continuity_exports(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    -- Drawing data
    tool_type VARCHAR(20) NOT NULL,  -- 'pen', 'line', 'arrow', 'rectangle', 'circle', 'text'
    stroke_color VARCHAR(20) DEFAULT '#FF0000',
    stroke_width FLOAT DEFAULT 2,
    fill_color VARCHAR(20),
    opacity FLOAT DEFAULT 1.0,
    -- Path data (JSON array of points or shape params, coordinates as percentage of page)
    path_data JSONB NOT NULL,
    -- Optional text content for text tool
    text_content TEXT,
    font_size FLOAT DEFAULT 12,
    -- Metadata
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_export_highlights_export ON backlot_continuity_export_highlights(export_id);
CREATE INDEX IF NOT EXISTS idx_export_highlights_page ON backlot_continuity_export_highlights(export_id, page_number);
CREATE INDEX IF NOT EXISTS idx_export_notes_export ON backlot_continuity_export_notes(export_id);
CREATE INDEX IF NOT EXISTS idx_export_notes_page ON backlot_continuity_export_notes(export_id, page_number);
CREATE INDEX IF NOT EXISTS idx_export_drawings_export ON backlot_continuity_export_drawings(export_id);
CREATE INDEX IF NOT EXISTS idx_export_drawings_page ON backlot_continuity_export_drawings(export_id, page_number);

-- Comments for documentation
COMMENT ON TABLE backlot_continuity_export_highlights IS 'Version-specific highlight annotations on exported continuity PDFs';
COMMENT ON TABLE backlot_continuity_export_notes IS 'Version-specific note/comment annotations on exported continuity PDFs';
COMMENT ON TABLE backlot_continuity_export_drawings IS 'Version-specific freehand drawings/markup on exported continuity PDFs';
