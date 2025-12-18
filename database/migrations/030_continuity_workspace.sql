-- =====================================================
-- Migration 030: Enhanced Continuity Workspace (Scripty)
-- Tables: lining_marks, take_notes, continuity_photos, photo_tags
-- Adds script_supervisor role permissions
-- =====================================================

-- =====================================================
-- 1. LINING MARKS (Lined Script Coverage Marks)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_lining_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    script_id UUID REFERENCES backlot_scripts(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,

    -- Page positioning (normalized 0-1 coordinates)
    page_number INTEGER NOT NULL,
    start_y NUMERIC(10, 6) NOT NULL,  -- Y position where line starts (top of coverage)
    end_y NUMERIC(10, 6) NOT NULL,    -- Y position where line ends (bottom of coverage)
    x_position NUMERIC(10, 6) DEFAULT 0.85,  -- X position in right margin area

    -- Coverage metadata
    coverage_type TEXT NOT NULL DEFAULT 'MS' CHECK (coverage_type IN ('WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'OTS', 'POV', 'INSERT', '2-SHOT', 'GROUP', 'AERIAL', 'OTHER')),
    camera_label TEXT,          -- e.g., "A", "B", "C"
    setup_label TEXT,           -- e.g., "1", "2", "3A"

    -- Line appearance
    line_style TEXT DEFAULT 'solid' CHECK (line_style IN ('solid', 'wavy', 'dashed', 'dotted')),
    line_color TEXT DEFAULT '#3B82F6',  -- Default blue

    -- Associated takes (can be multiple)
    take_ids UUID[] DEFAULT '{}',

    -- Notes
    notes TEXT,

    -- Tracking
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lining_marks
CREATE INDEX IF NOT EXISTS idx_lining_marks_project ON backlot_lining_marks(project_id);
CREATE INDEX IF NOT EXISTS idx_lining_marks_script ON backlot_lining_marks(script_id);
CREATE INDEX IF NOT EXISTS idx_lining_marks_scene ON backlot_lining_marks(scene_id);
CREATE INDEX IF NOT EXISTS idx_lining_marks_page ON backlot_lining_marks(script_id, page_number);

-- =====================================================
-- 2. TAKE NOTES (Timestamped Notes Per Take)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_take_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    take_id UUID NOT NULL REFERENCES backlot_slate_logs(id) ON DELETE CASCADE,

    -- Note content
    note_text TEXT NOT NULL,
    note_category TEXT DEFAULT 'general' CHECK (note_category IN (
        'general', 'dialogue', 'action', 'timing', 'continuity',
        'camera', 'sound', 'performance', 'technical', 'safety'
    )),

    -- Timing (optional - timestamp within the take)
    timecode TEXT,  -- e.g., "00:01:23:15" if known

    -- Page anchor (optional - links note to specific script location)
    page_number INTEGER,
    anchor_x NUMERIC(10, 6),
    anchor_y NUMERIC(10, 6),

    -- Flags
    is_critical BOOLEAN DEFAULT FALSE,
    is_dialogue_related BOOLEAN DEFAULT FALSE,  -- For line notes export

    -- Tracking
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for take_notes
CREATE INDEX IF NOT EXISTS idx_take_notes_project ON backlot_take_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_take_notes_take ON backlot_take_notes(take_id);
CREATE INDEX IF NOT EXISTS idx_take_notes_category ON backlot_take_notes(project_id, note_category);
CREATE INDEX IF NOT EXISTS idx_take_notes_critical ON backlot_take_notes(project_id, is_critical) WHERE is_critical = TRUE;

-- =====================================================
-- 3. CONTINUITY PHOTOS (Enhanced Photo Management)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_continuity_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL,
    take_id UUID REFERENCES backlot_slate_logs(id) ON DELETE SET NULL,

    -- File storage
    s3_key TEXT NOT NULL,
    s3_bucket TEXT NOT NULL DEFAULT 'swn-backlot-files-517220555400',
    original_filename TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,

    -- Image metadata
    width INTEGER,
    height INTEGER,

    -- Thumbnail (generated)
    thumbnail_s3_key TEXT,

    -- Context
    scene_number TEXT,
    description TEXT,

    -- Categorization
    category TEXT DEFAULT 'general' CHECK (category IN (
        'general', 'wardrobe', 'props', 'hair', 'makeup',
        'set_dressing', 'blood', 'weather', 'hands', 'eyeline', 'other'
    )),

    -- Flags
    is_reference BOOLEAN DEFAULT FALSE,  -- Reference photo vs documentation
    is_favorite BOOLEAN DEFAULT FALSE,

    -- Tracking
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for continuity_photos
CREATE INDEX IF NOT EXISTS idx_cont_photos_project ON backlot_continuity_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_cont_photos_scene ON backlot_continuity_photos(scene_id);
CREATE INDEX IF NOT EXISTS idx_cont_photos_take ON backlot_continuity_photos(take_id);
CREATE INDEX IF NOT EXISTS idx_cont_photos_category ON backlot_continuity_photos(project_id, category);
CREATE INDEX IF NOT EXISTS idx_cont_photos_created ON backlot_continuity_photos(project_id, created_at);

-- =====================================================
-- 4. CONTINUITY PHOTO TAGS (Tagging System)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_continuity_photo_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES backlot_continuity_photos(id) ON DELETE CASCADE,

    -- Tag content
    tag TEXT NOT NULL,

    -- Tag position on image (optional - for annotated regions)
    x_position NUMERIC(10, 6),
    y_position NUMERIC(10, 6),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for photo_tags
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo ON backlot_continuity_photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON backlot_continuity_photo_tags(tag);

-- =====================================================
-- 5. ENHANCE SLATE_LOGS WITH ADDITIONAL FIELDS
-- =====================================================

-- Add new columns to existing slate_logs table
ALTER TABLE backlot_slate_logs
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'print', 'circled', 'hold', 'ng', 'wild', 'mos', 'false_start')),
    ADD COLUMN IF NOT EXISTS setup_label TEXT,
    ADD COLUMN IF NOT EXISTS camera_roll TEXT,
    ADD COLUMN IF NOT EXISTS time_of_day TEXT,  -- 'day', 'night', 'magic_hour', etc.
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES backlot_scenes(id) ON DELETE SET NULL;

-- Index for scene_id
CREATE INDEX IF NOT EXISTS idx_slate_logs_scene ON backlot_slate_logs(scene_id);

-- =====================================================
-- 6. ADD SCRIPT_SUPERVISOR ROLE TO PERMISSIONS
-- =====================================================

-- Note: The script_supervisor role permissions will be added via
-- the backlot_permissions.py file as DEFAULT_VIEW_CONFIGS

-- =====================================================
-- UPDATE TRIGGERS
-- =====================================================

CREATE OR REPLACE TRIGGER update_lining_marks_updated_at
    BEFORE UPDATE ON backlot_lining_marks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_cont_photos_updated_at
    BEFORE UPDATE ON backlot_continuity_photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE backlot_lining_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_take_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_continuity_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_continuity_photo_tags ENABLE ROW LEVEL SECURITY;

-- Lining Marks policies
CREATE POLICY "lining_marks_select" ON backlot_lining_marks
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "lining_marks_insert" ON backlot_lining_marks
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "lining_marks_update" ON backlot_lining_marks
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "lining_marks_delete" ON backlot_lining_marks
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Take Notes policies
CREATE POLICY "take_notes_select" ON backlot_take_notes
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "take_notes_insert" ON backlot_take_notes
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "take_notes_update" ON backlot_take_notes
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "take_notes_delete" ON backlot_take_notes
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Continuity Photos policies
CREATE POLICY "cont_photos_select" ON backlot_continuity_photos
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "cont_photos_insert" ON backlot_continuity_photos
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "cont_photos_update" ON backlot_continuity_photos
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "cont_photos_delete" ON backlot_continuity_photos
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Photo Tags policies (inherit from photo access)
CREATE POLICY "photo_tags_select" ON backlot_continuity_photo_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_continuity_photos p
            WHERE p.id = photo_id
            AND (is_project_member_safe(p.project_id, auth.uid()) OR is_project_owner(p.project_id, auth.uid()))
        )
    );

CREATE POLICY "photo_tags_insert" ON backlot_continuity_photo_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_continuity_photos p
            WHERE p.id = photo_id
            AND (is_project_member_safe(p.project_id, auth.uid()) OR is_project_owner(p.project_id, auth.uid()))
        )
    );

CREATE POLICY "photo_tags_delete" ON backlot_continuity_photo_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM backlot_continuity_photos p
            WHERE p.id = photo_id
            AND (is_project_member_safe(p.project_id, auth.uid()) OR is_project_owner(p.project_id, auth.uid()))
        )
    );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON backlot_lining_marks TO authenticated;
GRANT ALL ON backlot_take_notes TO authenticated;
GRANT ALL ON backlot_continuity_photos TO authenticated;
GRANT ALL ON backlot_continuity_photo_tags TO authenticated;
