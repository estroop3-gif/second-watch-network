-- Migration: 050_forum_bans.sql
-- Forum-specific user bans with configurable restriction types

-- Forum bans table
CREATE TABLE IF NOT EXISTS forum_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    restriction_type TEXT NOT NULL CHECK (restriction_type IN ('read_only', 'full_block', 'shadow_restrict')),
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restriction type meanings:
-- read_only: User can view all forum content, cannot create threads or replies
-- full_block: User cannot access the forum at all (redirect with blocked message)
-- shadow_restrict: User's posts are only visible to themselves and admins/moderators

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_forum_bans_user_active ON forum_bans(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_forum_bans_expires ON forum_bans(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_forum_bans_type ON forum_bans(restriction_type, is_active);
CREATE INDEX IF NOT EXISTS idx_forum_bans_admin ON forum_bans(admin_id);

-- Add forum ban cache columns to profiles for quick lookup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS forum_ban_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS forum_ban_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS forum_ban_reason TEXT;

-- Index for quick ban lookups on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_forum_ban ON profiles(forum_ban_type) WHERE forum_ban_type IS NOT NULL;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forum_bans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_forum_bans_updated_at ON forum_bans;
CREATE TRIGGER trg_forum_bans_updated_at
    BEFORE UPDATE ON forum_bans
    FOR EACH ROW
    EXECUTE FUNCTION update_forum_bans_updated_at();

-- Function to sync forum ban to profiles table for quick lookups
CREATE OR REPLACE FUNCTION sync_forum_ban_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.is_active THEN
            UPDATE profiles SET
                forum_ban_type = NEW.restriction_type,
                forum_ban_until = NEW.expires_at,
                forum_ban_reason = NEW.reason
            WHERE id = NEW.user_id;
        ELSE
            -- Clear the ban from profile when deactivated
            UPDATE profiles SET
                forum_ban_type = NULL,
                forum_ban_until = NULL,
                forum_ban_reason = NULL
            WHERE id = NEW.user_id
            AND NOT EXISTS (
                SELECT 1 FROM forum_bans
                WHERE user_id = NEW.user_id
                AND is_active = true
                AND id != NEW.id
            );
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Clear the ban from profile if no other active bans exist
        UPDATE profiles SET
            forum_ban_type = NULL,
            forum_ban_until = NULL,
            forum_ban_reason = NULL
        WHERE id = OLD.user_id
        AND NOT EXISTS (
            SELECT 1 FROM forum_bans
            WHERE user_id = OLD.user_id
            AND is_active = true
        );
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync forum bans to profiles
DROP TRIGGER IF EXISTS trg_sync_forum_ban_to_profile ON forum_bans;
CREATE TRIGGER trg_sync_forum_ban_to_profile
    AFTER INSERT OR UPDATE OR DELETE ON forum_bans
    FOR EACH ROW
    EXECUTE FUNCTION sync_forum_ban_to_profile();
