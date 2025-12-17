-- =====================================================
-- CHURCH PRODUCTION TOOLS - Database Migration
-- Migration 027: Church/Ministry Production Hub Tables
-- =====================================================
-- This migration creates all tables for the church production tools:
-- A) Service Planning and Positions
-- B) People, Volunteers, and Training
-- C) Content, Stories, and Requests
-- D) Calendar, Briefs, Legal
-- E) Gear, Rooms, and Tech Maps
-- F) Sunday Readiness and Stream

-- =============================================================================
-- SECTION A: SERVICE PLANNING AND POSITIONS
-- =============================================================================

-- 1. Service Plans (Run Sheets / Production Plans)
CREATE TABLE IF NOT EXISTS church_service_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    service_date DATE NOT NULL,
    service_name TEXT NOT NULL,
    campus_id UUID,
    template_id UUID,
    data JSONB DEFAULT '{}', -- order of worship, cues, songs, sermon, videos, tech notes
    status TEXT DEFAULT 'draft', -- draft, published, completed, archived
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rehearsal Plans
CREATE TABLE IF NOT EXISTS church_rehearsal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_plan_id UUID REFERENCES church_service_plans(id) ON DELETE CASCADE,
    rehearsal_datetime TIMESTAMPTZ NOT NULL,
    data JSONB DEFAULT '{}', -- band schedule, tech schedule, run-through notes
    notes TEXT,
    status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tech Position Assignments
CREATE TABLE IF NOT EXISTS church_tech_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_plan_id UUID REFERENCES church_service_plans(id) ON DELETE CASCADE,
    position_name TEXT NOT NULL, -- Camera 1, Lyrics, TD, FOH, etc.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    status TEXT DEFAULT 'assigned', -- assigned, confirmed, declined
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION B: PEOPLE, VOLUNTEERS, AND TRAINING
-- =============================================================================

-- 4. Volunteer Shifts
CREATE TABLE IF NOT EXISTS church_volunteer_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    service_plan_id UUID REFERENCES church_service_plans(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL, -- Camera 2, Greeter, Usher, etc.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'invited', -- invited, confirmed, declined
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Training Modules
CREATE TABLE IF NOT EXISTS church_training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    role_key TEXT, -- camera_op, lyrics_op, audio_op, etc.
    content_ref TEXT, -- link to markdown, video, PDF, etc.
    description TEXT,
    estimated_minutes INT,
    is_required BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Training Completions
CREATE TABLE IF NOT EXISTS church_training_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES church_training_modules(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    UNIQUE(module_id, user_id)
);

-- 7. Skill Tags
CREATE TABLE IF NOT EXISTS church_skill_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT, -- technical, creative, leadership, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. User Skills
CREATE TABLE IF NOT EXISTS church_user_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_tag_id UUID REFERENCES church_skill_tags(id) ON DELETE CASCADE,
    level TEXT, -- beginner, intermediate, advanced, expert
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, skill_tag_id)
);

-- 9. Position Quick Reference Cards
CREATE TABLE IF NOT EXISTS church_position_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    position_key TEXT NOT NULL, -- camera_1, lyrics_op, foh_engineer, etc.
    title TEXT NOT NULL,
    responsibilities JSONB DEFAULT '[]', -- array of responsibility strings
    cues JSONB DEFAULT '[]', -- array of cue objects with timing/action
    quick_fixes JSONB DEFAULT '[]', -- common troubleshooting steps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION C: CONTENT, STORIES, AND REQUESTS
-- =============================================================================

-- 10. Clip Requests
CREATE TABLE IF NOT EXISTS church_clip_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source_service_plan_id UUID REFERENCES church_service_plans(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'new', -- new, assigned, in_edit, approved, rejected, delivered
    assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data JSONB DEFAULT '{}', -- platforms, specs, due_date, timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Story Leads (Testimony Tracker)
CREATE TABLE IF NOT EXISTS church_story_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    contact_info JSONB DEFAULT '{}', -- phone, email, preferred contact method
    status TEXT DEFAULT 'lead', -- lead, contacted, scheduled, shot, in_edit, used
    story_summary TEXT,
    usage_notes TEXT,
    assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Content Shoots (Kanban Board)
CREATE TABLE IF NOT EXISTS church_content_shoots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'video', -- video, photo, social, podcast
    status TEXT DEFAULT 'idea', -- idea, approved, scripting, scheduled, shot, in_edit, delivered
    description TEXT,
    data JSONB DEFAULT '{}', -- due_dates, assigned_users, tags, deliverables
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Announcement Requests
CREATE TABLE IF NOT EXISTS church_announcement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ministry_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE,
    status TEXT DEFAULT 'new', -- new, review, approved, declined, scheduled
    data JSONB DEFAULT '{}', -- channels: stage, email, social, bulletin
    submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION D: CALENDAR, BRIEFS, LEGAL
-- =============================================================================

-- 14. Church Events (Cross-Ministry Calendar)
CREATE TABLE IF NOT EXISTS church_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ,
    campus_id UUID,
    room_id UUID,
    ministry TEXT,
    event_type TEXT, -- service, rehearsal, meeting, conference, special_event
    data JSONB DEFAULT '{}', -- gear_needed, setup_notes, contacts
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Creative Briefs
CREATE TABLE IF NOT EXISTS church_creative_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'campaign', -- campaign, series, video, event, general
    goals TEXT,
    audience TEXT,
    deliverables JSONB DEFAULT '[]', -- array of deliverable specs
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft', -- draft, in_review, approved, archived
    data JSONB DEFAULT '{}', -- timeline, budget, brand_notes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Licenses (Copyright/Licensing Tracking)
CREATE TABLE IF NOT EXISTS church_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- song, stock_video, image, font, software
    title TEXT NOT NULL,
    license_source TEXT, -- CCLI, Storyblocks, Shutterstock, etc.
    license_id_or_number TEXT,
    expiration_date DATE,
    usage_notes TEXT,
    data JSONB DEFAULT '{}', -- terms, restrictions, renewal_info
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION E: GEAR, ROOMS, AND TECH MAPS
-- =============================================================================

-- 17. Church Rooms
CREATE TABLE IF NOT EXISTS church_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    campus_id UUID,
    capacity INT,
    data JSONB DEFAULT '{}', -- equipment, setup_notes, av_capabilities
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Church Gear
CREATE TABLE IF NOT EXISTS church_gear (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT, -- camera, audio, lighting, video, misc
    location TEXT,
    serial_number TEXT,
    data JSONB DEFAULT '{}', -- specs, maintenance_notes, accessories
    status TEXT DEFAULT 'available', -- available, in_use, maintenance, retired
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Reservations (Gear and Room)
CREATE TABLE IF NOT EXISTS church_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    room_id UUID REFERENCES church_rooms(id) ON DELETE SET NULL,
    gear_id UUID REFERENCES church_gear(id) ON DELETE SET NULL,
    event_id UUID REFERENCES church_events(id) ON DELETE SET NULL,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    requested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'requested', -- requested, approved, denied, checked_out, returned
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Patch Matrices (Audio/Video Routing)
CREATE TABLE IF NOT EXISTS church_patch_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    campus_id UUID,
    console_name TEXT NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}', -- inputs, outputs, buses, labels, routing
    is_active BOOLEAN DEFAULT true,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Camera Plots (Shot Maps)
CREATE TABLE IF NOT EXISTS church_camera_plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    campus_id UUID,
    service_type TEXT, -- Sunday AM, Sunday PM, Conference, Special
    title TEXT NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}', -- camera_positions, lens_info, operators, presets, flow_notes
    is_active BOOLEAN DEFAULT true,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SECTION F: SUNDAY READINESS AND STREAM
-- =============================================================================

-- 22. Pre-flight Checklists
CREATE TABLE IF NOT EXISTS church_preflight_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    service_plan_id UUID REFERENCES church_service_plans(id) ON DELETE SET NULL,
    template_name TEXT,
    data JSONB DEFAULT '[]', -- array of checklist items with assigned roles, status
    status TEXT DEFAULT 'not_started', -- not_started, in_progress, complete
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Stream QC Runs
CREATE TABLE IF NOT EXISTS church_stream_qc_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    service_plan_id UUID REFERENCES church_service_plans(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    data JSONB DEFAULT '{}', -- audio_levels, lip_sync, legibility, chat_mod_ready, each with timestamps
    issues_found JSONB DEFAULT '[]', -- array of issues
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Macro Library
CREATE TABLE IF NOT EXISTS church_macro_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    system_type TEXT NOT NULL, -- switcher, console, ProPresenter, OBS, etc.
    name TEXT NOT NULL,
    description TEXT,
    safe_to_use BOOLEAN DEFAULT true,
    do_not_touch BOOLEAN DEFAULT false,
    data JSONB DEFAULT '{}', -- key_combos, macro_script, notes, warning
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR COMMON QUERIES
-- =============================================================================

-- Service Plans
CREATE INDEX IF NOT EXISTS idx_church_service_plans_org ON church_service_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_church_service_plans_date ON church_service_plans(service_date);
CREATE INDEX IF NOT EXISTS idx_church_service_plans_status ON church_service_plans(status);

-- Rehearsal Plans
CREATE INDEX IF NOT EXISTS idx_church_rehearsal_plans_service ON church_rehearsal_plans(service_plan_id);

-- Tech Assignments
CREATE INDEX IF NOT EXISTS idx_church_tech_assignments_service ON church_tech_assignments(service_plan_id);
CREATE INDEX IF NOT EXISTS idx_church_tech_assignments_user ON church_tech_assignments(user_id);

-- Volunteer Shifts
CREATE INDEX IF NOT EXISTS idx_church_volunteer_shifts_service ON church_volunteer_shifts(service_plan_id);
CREATE INDEX IF NOT EXISTS idx_church_volunteer_shifts_user ON church_volunteer_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_church_volunteer_shifts_status ON church_volunteer_shifts(status);

-- Training
CREATE INDEX IF NOT EXISTS idx_church_training_modules_role ON church_training_modules(role_key);
CREATE INDEX IF NOT EXISTS idx_church_training_completions_user ON church_training_completions(user_id);

-- Skills
CREATE INDEX IF NOT EXISTS idx_church_user_skills_user ON church_user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_church_user_skills_skill ON church_user_skills(skill_tag_id);

-- Content
CREATE INDEX IF NOT EXISTS idx_church_clip_requests_status ON church_clip_requests(status);
CREATE INDEX IF NOT EXISTS idx_church_story_leads_status ON church_story_leads(status);
CREATE INDEX IF NOT EXISTS idx_church_content_shoots_status ON church_content_shoots(status);
CREATE INDEX IF NOT EXISTS idx_church_announcement_requests_status ON church_announcement_requests(status);

-- Calendar
CREATE INDEX IF NOT EXISTS idx_church_events_org ON church_events(org_id);
CREATE INDEX IF NOT EXISTS idx_church_events_dates ON church_events(start_datetime, end_datetime);

-- Reservations
CREATE INDEX IF NOT EXISTS idx_church_reservations_room ON church_reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_church_reservations_gear ON church_reservations(gear_id);
CREATE INDEX IF NOT EXISTS idx_church_reservations_dates ON church_reservations(start_datetime, end_datetime);

-- Readiness
CREATE INDEX IF NOT EXISTS idx_church_preflight_service ON church_preflight_checklists(service_plan_id);
CREATE INDEX IF NOT EXISTS idx_church_stream_qc_service ON church_stream_qc_runs(service_plan_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- TODO: Add RLS policies for church tables based on org membership
-- For now, using API-level auth checks

ALTER TABLE church_service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_rehearsal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_tech_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_volunteer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_skill_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_position_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_clip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_story_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_content_shoots ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_announcement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_creative_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_patch_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_camera_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_preflight_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_stream_qc_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_macro_library ENABLE ROW LEVEL SECURITY;

-- Basic read policies (authenticated users can read)
CREATE POLICY "Church service plans read" ON church_service_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church rehearsal plans read" ON church_rehearsal_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church tech assignments read" ON church_tech_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church volunteer shifts read" ON church_volunteer_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church training modules read" ON church_training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church training completions read" ON church_training_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church skill tags read" ON church_skill_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church user skills read" ON church_user_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church position cards read" ON church_position_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church clip requests read" ON church_clip_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church story leads read" ON church_story_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church content shoots read" ON church_content_shoots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church announcement requests read" ON church_announcement_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church events read" ON church_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church creative briefs read" ON church_creative_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church licenses read" ON church_licenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church rooms read" ON church_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church gear read" ON church_gear FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church reservations read" ON church_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church patch matrices read" ON church_patch_matrices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church camera plots read" ON church_camera_plots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church preflight checklists read" ON church_preflight_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church stream qc runs read" ON church_stream_qc_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Church macro library read" ON church_macro_library FOR SELECT TO authenticated USING (true);

-- Basic write policies (authenticated users can write - will be refined later)
CREATE POLICY "Church service plans write" ON church_service_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church rehearsal plans write" ON church_rehearsal_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church tech assignments write" ON church_tech_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church volunteer shifts write" ON church_volunteer_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church training modules write" ON church_training_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church training completions write" ON church_training_completions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church skill tags write" ON church_skill_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church user skills write" ON church_user_skills FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church position cards write" ON church_position_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church clip requests write" ON church_clip_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church story leads write" ON church_story_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church content shoots write" ON church_content_shoots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church announcement requests write" ON church_announcement_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church events write" ON church_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church creative briefs write" ON church_creative_briefs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church licenses write" ON church_licenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church rooms write" ON church_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church gear write" ON church_gear FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church reservations write" ON church_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church patch matrices write" ON church_patch_matrices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church camera plots write" ON church_camera_plots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church preflight checklists write" ON church_preflight_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church stream qc runs write" ON church_stream_qc_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Church macro library write" ON church_macro_library FOR ALL TO authenticated USING (true) WITH CHECK (true);
