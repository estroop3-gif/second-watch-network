-- =====================================================
-- Migration 026: Camera & Continuity Tools + Utilities
-- Tables: shot_lists, slate_logs, camera_media, continuity_notes
--         project_day_settings, checkin_sessions, checkins, user_bookmarks, user_notes
-- =====================================================

-- =====================================================
-- 1. SHOT LISTS (Camera & Continuity - Shot List & Coverage Tracker)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_shot_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_number TEXT NOT NULL,
    shot_label TEXT NOT NULL,  -- e.g., "A", "B", "C", "CU Elias"
    description TEXT,
    camera TEXT,  -- e.g., "A", "B", "C"
    lens TEXT,  -- optional
    framing TEXT,  -- e.g., "WS", "MS", "CU", "ECU", "OTS"
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'shooting', 'completed', 'cut')),
    is_circle_take BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shot_lists
CREATE INDEX IF NOT EXISTS idx_shot_lists_project_id ON backlot_shot_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_scene_number ON backlot_shot_lists(project_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_shot_lists_status ON backlot_shot_lists(project_id, status);

-- =====================================================
-- 2. SLATE LOGS (Camera & Continuity - Slate Logger)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_slate_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_number TEXT NOT NULL,
    shot_label TEXT,
    take_number INTEGER NOT NULL DEFAULT 1,
    camera TEXT,  -- e.g., "A", "B", "C"
    sound_roll TEXT,  -- optional
    file_name TEXT,  -- optional, for DIT reference
    is_circle_take BOOLEAN DEFAULT FALSE,
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    logged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for slate_logs
CREATE INDEX IF NOT EXISTS idx_slate_logs_project_id ON backlot_slate_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_slate_logs_scene_number ON backlot_slate_logs(project_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_slate_logs_recorded_at ON backlot_slate_logs(project_id, recorded_at);

-- =====================================================
-- 3. CAMERA MEDIA (Camera & Continuity - Camera & Media Tracker)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_camera_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    media_label TEXT NOT NULL,  -- e.g., "A001", "B003_CARD1"
    media_type TEXT NOT NULL DEFAULT 'CFexpress' CHECK (media_type IN ('CFexpress', 'SSD', 'SD', 'XQD', 'CFAST', 'HDD', 'LTO', 'other')),
    camera TEXT,  -- e.g., "A-Cam", "B-Cam"
    capacity_gb INTEGER,
    status TEXT NOT NULL DEFAULT 'in_camera' CHECK (status IN ('in_camera', 'with_DIT', 'backed_up', 'ready_to_format', 'archived', 'failed')),
    current_holder TEXT,  -- e.g., "Camera Team", "DIT", "Producer"
    first_backup_done BOOLEAN DEFAULT FALSE,
    second_backup_done BOOLEAN DEFAULT FALSE,
    backup_notes TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for camera_media
CREATE INDEX IF NOT EXISTS idx_camera_media_project_id ON backlot_camera_media(project_id);
CREATE INDEX IF NOT EXISTS idx_camera_media_status ON backlot_camera_media(project_id, status);
CREATE INDEX IF NOT EXISTS idx_camera_media_camera ON backlot_camera_media(project_id, camera);

-- =====================================================
-- 4. CONTINUITY NOTES (Camera & Continuity - Continuity Notes)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_continuity_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_number TEXT NOT NULL,
    take_ref TEXT,  -- optional, e.g., "Scene 3B Take 4"
    department TEXT NOT NULL DEFAULT 'general' CHECK (department IN ('script', 'wardrobe', 'makeup', 'hair', 'props', 'art', 'general')),
    note TEXT NOT NULL,
    image_url TEXT,  -- URL for continuity photos
    image_urls TEXT[],  -- Array for multiple images
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for continuity_notes
CREATE INDEX IF NOT EXISTS idx_continuity_notes_project_id ON backlot_continuity_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_continuity_notes_scene ON backlot_continuity_notes(project_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_continuity_notes_department ON backlot_continuity_notes(project_id, department);

-- =====================================================
-- 5. PROJECT DAY SETTINGS (Sun Tracker & Weather Widget)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_project_day_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    shoot_date DATE NOT NULL,
    location_name TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    timezone TEXT DEFAULT 'America/Los_Angeles',
    weather_override_summary TEXT,  -- Manual notes like "Storms likely after 3pm"
    sunrise_time TIME,  -- Can be populated by external API or manually
    sunset_time TIME,
    golden_hour_morning_start TIME,
    golden_hour_morning_end TIME,
    golden_hour_evening_start TIME,
    golden_hour_evening_end TIME,
    weather_summary TEXT,
    temperature_high_f INTEGER,
    temperature_low_f INTEGER,
    precipitation_chance INTEGER,
    wind_mph INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint: one settings entry per project per day
    CONSTRAINT unique_project_day_settings UNIQUE (project_id, shoot_date)
);

-- Indexes for project_day_settings
CREATE INDEX IF NOT EXISTS idx_day_settings_project_id ON backlot_project_day_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_day_settings_shoot_date ON backlot_project_day_settings(project_id, shoot_date);

-- =====================================================
-- 6. CHECKIN SESSIONS (QR Check-in System - Admin Side)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_checkin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    shoot_date DATE NOT NULL,
    title TEXT NOT NULL,  -- e.g., "Day 03 Main Unit Check In"
    qr_token TEXT NOT NULL UNIQUE,  -- Random string for QR code
    is_active BOOLEAN DEFAULT TRUE,
    safety_brief TEXT,  -- Safety briefing content
    policy_text TEXT,  -- NDA/policy content to acknowledge
    notes TEXT,  -- Additional notes for crew
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

-- Indexes for checkin_sessions
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_project_id ON backlot_checkin_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_shoot_date ON backlot_checkin_sessions(project_id, shoot_date);
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_qr_token ON backlot_checkin_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_active ON backlot_checkin_sessions(project_id, is_active);

-- =====================================================
-- 7. CHECKINS (QR Check-in System - Crew Records)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES backlot_checkin_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_safety_brief BOOLEAN DEFAULT FALSE,
    acknowledged_policies BOOLEAN DEFAULT FALSE,
    device_info TEXT,  -- Optional device/browser info
    latitude NUMERIC(10, 7),  -- Optional location verification
    longitude NUMERIC(10, 7),
    notes TEXT,
    -- Unique constraint: one check-in per user per session
    CONSTRAINT unique_user_session_checkin UNIQUE (session_id, user_id)
);

-- Indexes for checkins
CREATE INDEX IF NOT EXISTS idx_checkins_project_id ON backlot_checkins(project_id);
CREATE INDEX IF NOT EXISTS idx_checkins_session_id ON backlot_checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON backlot_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_at ON backlot_checkins(checked_in_at);

-- =====================================================
-- 8. USER BOOKMARKS (Personal Notes & Bookmarks)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_user_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('scene', 'shot', 'task', 'note', 'doc', 'shot_list', 'slate_log', 'continuity_note', 'location', 'person', 'day', 'review')),
    entity_id TEXT NOT NULL,  -- Store as text to support multiple table IDs
    label TEXT,  -- Optional user-supplied label
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint: one bookmark per entity per user
    CONSTRAINT unique_user_entity_bookmark UNIQUE (user_id, entity_type, entity_id)
);

-- Indexes for user_bookmarks
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_project_id ON backlot_user_bookmarks(project_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON backlot_user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_entity ON backlot_user_bookmarks(entity_type, entity_id);

-- =====================================================
-- 9. USER NOTES (Personal Notes & Bookmarks)
-- =====================================================

CREATE TABLE IF NOT EXISTS backlot_user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    body TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    color TEXT,  -- Optional color coding
    tags TEXT[],  -- Optional tags
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_notes
CREATE INDEX IF NOT EXISTS idx_user_notes_project_id ON backlot_user_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON backlot_user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_pinned ON backlot_user_notes(user_id, project_id, is_pinned);

-- =====================================================
-- UPDATE TRIGGERS for updated_at columns
-- =====================================================

-- Shot Lists
CREATE OR REPLACE TRIGGER update_shot_lists_updated_at
    BEFORE UPDATE ON backlot_shot_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Camera Media
CREATE OR REPLACE TRIGGER update_camera_media_updated_at
    BEFORE UPDATE ON backlot_camera_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Continuity Notes
CREATE OR REPLACE TRIGGER update_continuity_notes_updated_at
    BEFORE UPDATE ON backlot_continuity_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Project Day Settings
CREATE OR REPLACE TRIGGER update_day_settings_updated_at
    BEFORE UPDATE ON backlot_project_day_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User Notes
CREATE OR REPLACE TRIGGER update_user_notes_updated_at
    BEFORE UPDATE ON backlot_user_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE backlot_shot_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_slate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_camera_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_continuity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_day_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_checkin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_user_notes ENABLE ROW LEVEL SECURITY;

-- Helper function to check project membership (reuse if exists)
CREATE OR REPLACE FUNCTION is_project_member_safe(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM backlot_project_members
        WHERE project_id = p_project_id AND user_id = p_user_id
    );
$$;

-- Helper function to check if user is project owner
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM backlot_projects
        WHERE id = p_project_id AND owner_id = p_user_id
    );
$$;

-- Shot Lists policies
CREATE POLICY "shot_lists_select" ON backlot_shot_lists
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "shot_lists_insert" ON backlot_shot_lists
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "shot_lists_update" ON backlot_shot_lists
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "shot_lists_delete" ON backlot_shot_lists
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Slate Logs policies
CREATE POLICY "slate_logs_select" ON backlot_slate_logs
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "slate_logs_insert" ON backlot_slate_logs
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "slate_logs_update" ON backlot_slate_logs
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "slate_logs_delete" ON backlot_slate_logs
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Camera Media policies
CREATE POLICY "camera_media_select" ON backlot_camera_media
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "camera_media_insert" ON backlot_camera_media
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "camera_media_update" ON backlot_camera_media
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "camera_media_delete" ON backlot_camera_media
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Continuity Notes policies
CREATE POLICY "continuity_notes_select" ON backlot_continuity_notes
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "continuity_notes_insert" ON backlot_continuity_notes
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "continuity_notes_update" ON backlot_continuity_notes
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "continuity_notes_delete" ON backlot_continuity_notes
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Project Day Settings policies
CREATE POLICY "day_settings_select" ON backlot_project_day_settings
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "day_settings_insert" ON backlot_project_day_settings
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "day_settings_update" ON backlot_project_day_settings
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "day_settings_delete" ON backlot_project_day_settings
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Checkin Sessions policies (admin only for insert/update/delete)
CREATE POLICY "checkin_sessions_select" ON backlot_checkin_sessions
    FOR SELECT USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "checkin_sessions_insert" ON backlot_checkin_sessions
    FOR INSERT WITH CHECK (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "checkin_sessions_update" ON backlot_checkin_sessions
    FOR UPDATE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

CREATE POLICY "checkin_sessions_delete" ON backlot_checkin_sessions
    FOR DELETE USING (is_project_member_safe(project_id, auth.uid()) OR is_project_owner(project_id, auth.uid()));

-- Checkins policies (users can create their own, admins can view all)
CREATE POLICY "checkins_select" ON backlot_checkins
    FOR SELECT USING (
        user_id = auth.uid() OR
        is_project_member_safe(project_id, auth.uid()) OR
        is_project_owner(project_id, auth.uid())
    );

CREATE POLICY "checkins_insert" ON backlot_checkins
    FOR INSERT WITH CHECK (user_id = auth.uid() AND is_project_member_safe(project_id, auth.uid()));

CREATE POLICY "checkins_update" ON backlot_checkins
    FOR UPDATE USING (user_id = auth.uid());

-- User Bookmarks policies (private to user)
CREATE POLICY "user_bookmarks_select" ON backlot_user_bookmarks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_bookmarks_insert" ON backlot_user_bookmarks
    FOR INSERT WITH CHECK (user_id = auth.uid() AND is_project_member_safe(project_id, auth.uid()));

CREATE POLICY "user_bookmarks_update" ON backlot_user_bookmarks
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_bookmarks_delete" ON backlot_user_bookmarks
    FOR DELETE USING (user_id = auth.uid());

-- User Notes policies (private to user)
CREATE POLICY "user_notes_select" ON backlot_user_notes
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_notes_insert" ON backlot_user_notes
    FOR INSERT WITH CHECK (user_id = auth.uid() AND is_project_member_safe(project_id, auth.uid()));

CREATE POLICY "user_notes_update" ON backlot_user_notes
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_notes_delete" ON backlot_user_notes
    FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON backlot_shot_lists TO authenticated;
GRANT ALL ON backlot_slate_logs TO authenticated;
GRANT ALL ON backlot_camera_media TO authenticated;
GRANT ALL ON backlot_continuity_notes TO authenticated;
GRANT ALL ON backlot_project_day_settings TO authenticated;
GRANT ALL ON backlot_checkin_sessions TO authenticated;
GRANT ALL ON backlot_checkins TO authenticated;
GRANT ALL ON backlot_user_bookmarks TO authenticated;
GRANT ALL ON backlot_user_notes TO authenticated;
