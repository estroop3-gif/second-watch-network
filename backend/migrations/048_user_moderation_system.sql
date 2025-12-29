-- Migration 048: User Moderation System
-- Adds tracking for admin moderation actions (warnings, mutes, bans)
-- Run against AWS RDS PostgreSQL database

-- =====================================================
-- USER MODERATION ACTIONS TABLE
-- Tracks all moderation actions taken against users
-- =====================================================

CREATE TABLE IF NOT EXISTS user_moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('warning', 'mute', 'unmute', 'ban', 'unban')),
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    related_content_type TEXT,
    related_content_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_mod_actions_user ON user_moderation_actions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_mod_actions_type ON user_moderation_actions(action_type, is_active);
CREATE INDEX IF NOT EXISTS idx_user_mod_actions_expires ON user_moderation_actions(expires_at)
    WHERE expires_at IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_mod_actions_created ON user_moderation_actions(created_at DESC);

-- =====================================================
-- ADD MODERATION COLUMNS TO PROFILES
-- =====================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mute_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_warning_at TIMESTAMPTZ;

-- Index for finding muted users
CREATE INDEX IF NOT EXISTS idx_profiles_muted ON profiles(is_muted) WHERE is_muted = true;

-- Comments for documentation
COMMENT ON TABLE user_moderation_actions IS 'Tracks all moderation actions (warnings, mutes, bans) taken against users';
COMMENT ON COLUMN user_moderation_actions.action_type IS 'Type of moderation action: warning, mute, unmute, ban, unban';
COMMENT ON COLUMN user_moderation_actions.expires_at IS 'When the action expires (for temporary mutes)';
COMMENT ON COLUMN user_moderation_actions.is_active IS 'Whether this action is currently in effect';
COMMENT ON COLUMN user_moderation_actions.related_content_type IS 'Type of content that triggered action (thread, reply, collab, etc.)';
COMMENT ON COLUMN user_moderation_actions.related_content_id IS 'ID of content that triggered the action';

COMMENT ON COLUMN profiles.is_muted IS 'Whether the user is currently muted from posting';
COMMENT ON COLUMN profiles.muted_until IS 'When the current mute expires (null for permanent)';
COMMENT ON COLUMN profiles.mute_reason IS 'Reason for the current mute';
COMMENT ON COLUMN profiles.warning_count IS 'Number of active warnings against this user';
