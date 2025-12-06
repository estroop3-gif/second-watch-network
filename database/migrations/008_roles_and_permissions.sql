-- Second Watch Network - Roles & Permissions Migration
-- Run this in Supabase SQL Editor
-- This migration adds boolean role flags to the profiles table for the new RBAC system

-- ============================================================================
-- ADD ROLE BOOLEAN FIELDS TO PROFILES TABLE
-- ============================================================================

-- Add is_superadmin flag (God mode, full system access)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_admin flag (Platform administrator)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_moderator flag (Content/community moderator)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_order_member flag (Member of The Second Watch Order)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_order_member BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_lodge_officer flag (Order lodge leadership)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_lodge_officer BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_partner flag (Business partner or sponsor)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_filmmaker flag (Verified content creator)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_filmmaker BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_premium flag (Premium subscriber)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE NOT NULL;

-- Add has_completed_filmmaker_onboarding flag (for filmmaker profile setup)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS has_completed_filmmaker_onboarding BOOLEAN DEFAULT FALSE NOT NULL;

-- ============================================================================
-- CREATE INDEXES FOR ROLE FIELDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_is_superadmin ON profiles(is_superadmin) WHERE is_superadmin = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_moderator ON profiles(is_moderator) WHERE is_moderator = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_order_member ON profiles(is_order_member) WHERE is_order_member = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_lodge_officer ON profiles(is_lodge_officer) WHERE is_lodge_officer = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_partner ON profiles(is_partner) WHERE is_partner = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_filmmaker ON profiles(is_filmmaker) WHERE is_filmmaker = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium ON profiles(is_premium) WHERE is_premium = TRUE;

-- ============================================================================
-- MIGRATE EXISTING ROLE DATA TO BOOLEAN FLAGS
-- ============================================================================

-- Migrate legacy 'role' field values to boolean flags
-- This preserves existing role assignments

-- Set is_admin for users with role='admin'
UPDATE profiles SET is_admin = TRUE WHERE role = 'admin';

-- Set is_partner for users with role='partner'
UPDATE profiles SET is_partner = TRUE WHERE role = 'partner';

-- Set is_filmmaker for users with role='filmmaker'
UPDATE profiles SET is_filmmaker = TRUE WHERE role = 'filmmaker';

-- ============================================================================
-- SYNC ORDER MEMBERSHIP FROM ORDER_MEMBER_PROFILES TABLE
-- ============================================================================

-- If user has an approved order member profile, set is_order_member flag
UPDATE profiles p
SET is_order_member = TRUE
FROM order_member_profiles omp
WHERE p.id = omp.user_id
  AND omp.membership_status = 'active';

-- ============================================================================
-- CREATE FUNCTION TO GET USER'S PRIMARY BADGE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_primary_badge(profile_row profiles)
RETURNS TEXT AS $$
BEGIN
    -- Return highest priority badge based on hierarchy
    IF profile_row.is_superadmin THEN
        RETURN 'superadmin';
    ELSIF profile_row.is_admin THEN
        RETURN 'admin';
    ELSIF profile_row.is_moderator THEN
        RETURN 'moderator';
    ELSIF profile_row.is_lodge_officer THEN
        RETURN 'lodge_officer';
    ELSIF profile_row.is_order_member THEN
        RETURN 'order_member';
    ELSIF profile_row.is_partner THEN
        RETURN 'partner';
    ELSIF profile_row.is_filmmaker THEN
        RETURN 'filmmaker';
    ELSIF profile_row.is_premium THEN
        RETURN 'premium';
    ELSE
        RETURN 'free';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- CREATE VIEW FOR USER ROLES (For easy querying)
-- ============================================================================

CREATE OR REPLACE VIEW user_roles AS
SELECT
    id,
    email,
    username,
    full_name,
    is_superadmin,
    is_admin,
    is_moderator,
    is_order_member,
    is_lodge_officer,
    is_partner,
    is_filmmaker,
    is_premium,
    get_primary_badge(profiles.*) as primary_badge,
    ARRAY_REMOVE(ARRAY[
        CASE WHEN is_superadmin THEN 'superadmin' END,
        CASE WHEN is_admin THEN 'admin' END,
        CASE WHEN is_moderator THEN 'moderator' END,
        CASE WHEN is_lodge_officer THEN 'lodge_officer' END,
        CASE WHEN is_order_member THEN 'order_member' END,
        CASE WHEN is_partner THEN 'partner' END,
        CASE WHEN is_filmmaker THEN 'filmmaker' END,
        CASE WHEN is_premium THEN 'premium' END
    ], NULL) as active_roles
FROM profiles;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR ROLE MANAGEMENT
-- ============================================================================

-- Only superadmins can modify is_superadmin
-- Only admins/superadmins can modify other admin flags
-- Regular users cannot modify their own role flags

-- Policy: Users can read their own role flags
CREATE POLICY IF NOT EXISTS "Users can view own role flags"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Superadmins can update any profile's role flags
CREATE POLICY IF NOT EXISTS "Superadmins can update role flags"
ON profiles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_superadmin = TRUE
    )
);

-- Policy: Admins can update non-superadmin role flags
CREATE POLICY IF NOT EXISTS "Admins can update non-superadmin role flags"
ON profiles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_admin = TRUE
    )
)
WITH CHECK (
    -- Cannot set is_superadmin to true unless already superadmin
    NOT (NEW.is_superadmin = TRUE AND OLD.is_superadmin = FALSE)
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN profiles.is_superadmin IS 'God mode: Full system access, can manage all roles';
COMMENT ON COLUMN profiles.is_admin IS 'Platform administrator: Can manage users, content, and settings';
COMMENT ON COLUMN profiles.is_moderator IS 'Content moderator: Can moderate content and users';
COMMENT ON COLUMN profiles.is_order_member IS 'Member of The Second Watch Order professional network';
COMMENT ON COLUMN profiles.is_lodge_officer IS 'Lodge leadership: Can manage lodge settings and members';
COMMENT ON COLUMN profiles.is_partner IS 'Business partner or sponsor with partner tools access';
COMMENT ON COLUMN profiles.is_filmmaker IS 'Verified filmmaker with content submission privileges';
COMMENT ON COLUMN profiles.is_premium IS 'Premium subscriber with enhanced features';
COMMENT ON COLUMN profiles.has_completed_filmmaker_onboarding IS 'Whether filmmaker has completed profile setup';
