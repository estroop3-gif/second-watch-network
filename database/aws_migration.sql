-- AWS RDS Migration Script for Second Watch Network
-- This is a modified version of the Supabase migrations for standard PostgreSQL
-- Run this against the RDS database to set up the schema

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PROFILES TABLE (Modified from Supabase - no auth.users reference)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_user_id TEXT UNIQUE,  -- Links to AWS Cognito user sub
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT UNIQUE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'filmmaker', 'partner', 'admin', 'superadmin')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'banned', 'suspended')),
    is_admin BOOLEAN DEFAULT false,
    is_superadmin BOOLEAN DEFAULT false,
    is_order_member BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_cognito_user_id ON profiles(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- ============================================================================
-- FILMMAKER PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS filmmaker_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    bio TEXT,
    skills TEXT[],
    experience_level TEXT CHECK (experience_level IN ('Beginner', 'Intermediate', 'Professional', 'Expert')),
    department TEXT,
    portfolio_url TEXT,
    reel_url TEXT,
    location TEXT,
    accepting_work BOOLEAN DEFAULT true,
    status_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filmmaker_profiles_user_id ON filmmaker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_filmmaker_profiles_department ON filmmaker_profiles(department);

-- ============================================================================
-- BACKLOT PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    project_type TEXT CHECK (project_type IN ('feature', 'short', 'series', 'documentary', 'commercial', 'music_video', 'other')),
    status TEXT DEFAULT 'pre-production' CHECK (status IN ('development', 'pre-production', 'production', 'post-production', 'completed', 'archived')),
    start_date DATE,
    end_date DATE,
    budget_total DECIMAL(12, 2),
    thumbnail_url TEXT,
    logo_url TEXT,
    is_public BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_projects_owner_id ON backlot_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_backlot_projects_status ON backlot_projects(status);

-- ============================================================================
-- BACKLOT PROJECT MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    department TEXT,
    position TEXT,
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_backlot_project_members_project_id ON backlot_project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_members_user_id ON backlot_project_members(user_id);

-- ============================================================================
-- BACKLOT SCRIPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT,
    format TEXT,
    version TEXT DEFAULT 'v1',
    version_number INTEGER DEFAULT 1,
    parent_version_id UUID REFERENCES backlot_scripts(id),
    color_code TEXT DEFAULT 'white',
    revision_notes TEXT,
    is_current BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    text_content TEXT,
    page_count INTEGER,
    total_scenes INTEGER,
    total_pages INTEGER,
    parse_status TEXT DEFAULT 'pending',
    created_by_user_id UUID REFERENCES profiles(id),
    locked_by_user_id UUID REFERENCES profiles(id),
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_scripts_project_id ON backlot_scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_scripts_is_current ON backlot_scripts(is_current);

-- ============================================================================
-- BACKLOT SCENES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE NOT NULL,
    script_id UUID REFERENCES backlot_scripts(id) ON DELETE SET NULL,
    scene_number TEXT NOT NULL,
    slugline TEXT,
    set_name TEXT,
    description TEXT,
    page_length DECIMAL(5, 2) DEFAULT 0,
    page_start DECIMAL(5, 2),
    page_end DECIMAL(5, 2),
    int_ext TEXT CHECK (int_ext IN ('INT', 'EXT', 'INT/EXT')),
    time_of_day TEXT,
    sequence INTEGER DEFAULT 0,
    location_id UUID,
    is_omitted BOOLEAN DEFAULT false,
    is_scheduled BOOLEAN DEFAULT false,
    is_shot BOOLEAN DEFAULT false,
    needs_pickup BOOLEAN DEFAULT false,
    director_notes TEXT,
    ad_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_scenes_project_id ON backlot_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_scenes_script_id ON backlot_scenes(script_id);
CREATE INDEX IF NOT EXISTS idx_backlot_scenes_scene_number ON backlot_scenes(scene_number);

-- ============================================================================
-- BACKLOT TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE NOT NULL,
    parent_task_id UUID REFERENCES backlot_tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    department TEXT,
    due_date DATE,
    production_day_id UUID,
    position INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_tasks_project_id ON backlot_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_tasks_assigned_to ON backlot_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_backlot_tasks_status ON backlot_tasks(status);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- TRIGGER FUNCTION FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filmmaker_profiles_updated_at BEFORE UPDATE ON filmmaker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_projects_updated_at BEFORE UPDATE ON backlot_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_scripts_updated_at BEFORE UPDATE ON backlot_scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_scenes_updated_at BEFORE UPDATE ON backlot_scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_tasks_updated_at BEFORE UPDATE ON backlot_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Note: This is a subset of tables needed to get started.
-- Additional tables can be migrated as needed.
