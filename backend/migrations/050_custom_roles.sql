-- Migration 050: Custom Roles and Storage Quota System
-- Creates tables for custom roles, user-role assignments, and storage tracking

-- =============================================
-- Table: custom_roles
-- Stores custom roles with permissions and quotas
-- =============================================
CREATE TABLE IF NOT EXISTS custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',

    -- Permission flags
    can_access_backlot BOOLEAN DEFAULT false,
    can_access_greenroom BOOLEAN DEFAULT false,
    can_access_forum BOOLEAN DEFAULT false,
    can_access_community BOOLEAN DEFAULT false,
    can_submit_content BOOLEAN DEFAULT false,
    can_upload_files BOOLEAN DEFAULT false,
    can_create_projects BOOLEAN DEFAULT false,
    can_invite_collaborators BOOLEAN DEFAULT false,

    -- Storage quota (in bytes, NULL = unlimited)
    storage_quota_bytes BIGINT DEFAULT 1073741824,  -- 1GB default

    -- Metadata
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_is_system_role ON custom_roles(is_system_role);

-- =============================================
-- Table: user_roles
-- Junction table for many-to-many user-role relationship
-- =============================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- =============================================
-- Table: user_storage_usage
-- Tracks storage usage per user
-- =============================================
CREATE TABLE IF NOT EXISTS user_storage_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

    -- Cumulative storage used (in bytes)
    total_bytes_used BIGINT DEFAULT 0,

    -- Breakdown by category
    backlot_files_bytes BIGINT DEFAULT 0,
    backlot_media_bytes BIGINT DEFAULT 0,
    avatar_bytes BIGINT DEFAULT 0,

    -- Custom quota override (NULL = use role quota)
    custom_quota_bytes BIGINT,

    -- Tracking
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_storage_usage_user_id ON user_storage_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_usage_total ON user_storage_usage(total_bytes_used DESC);

-- =============================================
-- Alter profiles table for admin-created users
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_quota_override_bytes BIGINT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT false;

-- =============================================
-- Insert default system roles
-- =============================================
INSERT INTO custom_roles (name, display_name, description, color, is_system_role, storage_quota_bytes,
    can_access_backlot, can_access_greenroom, can_access_forum, can_access_community,
    can_submit_content, can_upload_files, can_create_projects, can_invite_collaborators)
VALUES
    ('free_user', 'Free User', 'Basic access to community features', '#6B7280', true, 1073741824,
     false, false, true, true, false, false, false, false),
    ('basic_filmmaker', 'Basic Filmmaker', 'Access to production tools with limited storage', '#3B82F6', true, 5368709120,
     true, true, true, true, true, true, true, false),
    ('pro_filmmaker', 'Pro Filmmaker', 'Full access to production tools with expanded storage', '#8B5CF6', true, 21474836480,
     true, true, true, true, true, true, true, true),
    ('partner', 'Partner', 'Full platform access with maximum storage', '#F59E0B', true, 53687091200,
     true, true, true, true, true, true, true, true)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- Initialize storage usage for existing users
-- Calculate from existing backlot_files
-- =============================================
INSERT INTO user_storage_usage (user_id, total_bytes_used, backlot_files_bytes, last_updated)
SELECT
    bf.uploaded_by,
    COALESCE(SUM(bf.file_size), 0),
    COALESCE(SUM(bf.file_size), 0),
    NOW()
FROM backlot_files bf
WHERE bf.uploaded_by IS NOT NULL
GROUP BY bf.uploaded_by
ON CONFLICT (user_id) DO UPDATE SET
    total_bytes_used = EXCLUDED.total_bytes_used,
    backlot_files_bytes = EXCLUDED.backlot_files_bytes,
    last_updated = NOW();

-- =============================================
-- Assign default roles to existing users
-- Map existing boolean flags to new role system
-- =============================================

-- Assign 'free_user' to all users who don't have filmmaker/partner status
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT p.id, r.id, NOW()
FROM profiles p
CROSS JOIN custom_roles r
WHERE r.name = 'free_user'
  AND p.is_filmmaker = false
  AND p.is_partner = false
  AND NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
  )
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign 'basic_filmmaker' to existing filmmakers without pro subscription
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT p.id, r.id, NOW()
FROM profiles p
CROSS JOIN custom_roles r
WHERE r.name = 'basic_filmmaker'
  AND p.is_filmmaker = true
  AND (p.subscription_status IS NULL OR p.subscription_status != 'pro')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign 'pro_filmmaker' to filmmakers with pro subscription
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT p.id, r.id, NOW()
FROM profiles p
CROSS JOIN custom_roles r
WHERE r.name = 'pro_filmmaker'
  AND p.is_filmmaker = true
  AND p.subscription_status = 'pro'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign 'partner' to existing partners
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT p.id, r.id, NOW()
FROM profiles p
CROSS JOIN custom_roles r
WHERE r.name = 'partner'
  AND p.is_partner = true
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =============================================
-- Function to get effective quota for a user
-- =============================================
CREATE OR REPLACE FUNCTION get_user_effective_quota(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_custom_quota BIGINT;
    v_role_quota BIGINT;
BEGIN
    -- Check for custom quota override first
    SELECT custom_quota_bytes INTO v_custom_quota
    FROM user_storage_usage
    WHERE user_id = p_user_id;

    IF v_custom_quota IS NOT NULL THEN
        RETURN v_custom_quota;
    END IF;

    -- Get max quota from assigned roles
    SELECT MAX(cr.storage_quota_bytes) INTO v_role_quota
    FROM user_roles ur
    JOIN custom_roles cr ON ur.role_id = cr.id
    WHERE ur.user_id = p_user_id;

    -- Return role quota or default 1GB
    RETURN COALESCE(v_role_quota, 1073741824);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to check if user can upload
-- =============================================
CREATE OR REPLACE FUNCTION can_user_upload(p_user_id UUID, p_file_size BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_usage BIGINT;
    v_quota BIGINT;
BEGIN
    -- Get current usage
    SELECT COALESCE(total_bytes_used, 0) INTO v_current_usage
    FROM user_storage_usage
    WHERE user_id = p_user_id;

    -- Get effective quota
    v_quota := get_user_effective_quota(p_user_id);

    -- Check if upload would exceed quota
    RETURN (COALESCE(v_current_usage, 0) + p_file_size) <= v_quota;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Trigger to update storage usage on file upload
-- =============================================
CREATE OR REPLACE FUNCTION update_storage_on_file_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_storage_usage (user_id, total_bytes_used, backlot_files_bytes, last_updated)
    VALUES (NEW.uploaded_by, COALESCE(NEW.file_size, 0), COALESCE(NEW.file_size, 0), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        total_bytes_used = user_storage_usage.total_bytes_used + COALESCE(NEW.file_size, 0),
        backlot_files_bytes = user_storage_usage.backlot_files_bytes + COALESCE(NEW.file_size, 0),
        last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_storage_on_file_insert ON backlot_files;
CREATE TRIGGER trg_update_storage_on_file_insert
    AFTER INSERT ON backlot_files
    FOR EACH ROW
    EXECUTE FUNCTION update_storage_on_file_insert();

-- =============================================
-- Trigger to update storage usage on file delete
-- =============================================
CREATE OR REPLACE FUNCTION update_storage_on_file_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_storage_usage
    SET total_bytes_used = GREATEST(0, total_bytes_used - COALESCE(OLD.file_size, 0)),
        backlot_files_bytes = GREATEST(0, backlot_files_bytes - COALESCE(OLD.file_size, 0)),
        last_updated = NOW()
    WHERE user_id = OLD.uploaded_by;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_storage_on_file_delete ON backlot_files;
CREATE TRIGGER trg_update_storage_on_file_delete
    AFTER DELETE ON backlot_files
    FOR EACH ROW
    EXECUTE FUNCTION update_storage_on_file_delete();
