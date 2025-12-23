-- Migration: 045_coms_system.sql
-- Description: Production Communications System - Channels, Messages, Voice, Presence
-- Created: 2024-12-22

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Channel types: dm (1-on-1), group_chat, voice, text_and_voice
DO $$ BEGIN
    CREATE TYPE coms_channel_type AS ENUM ('dm', 'group_chat', 'voice', 'text_and_voice');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Scope: project-specific or global (premium)
DO $$ BEGIN
    CREATE TYPE coms_scope AS ENUM ('project', 'global');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CHANNELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope and ownership
    scope coms_scope NOT NULL DEFAULT 'project',
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Channel info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type coms_channel_type NOT NULL DEFAULT 'text_and_voice',
    icon VARCHAR(50),
    color VARCHAR(7),

    -- Template/system channel
    template_key VARCHAR(50),
    is_system_channel BOOLEAN DEFAULT FALSE,

    -- Access control
    -- Empty array means visible to all / all can transmit
    visible_to_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
    can_transmit_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_private BOOLEAN DEFAULT FALSE,

    -- Owner/creator
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Ordering
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT coms_channels_project_required
        CHECK (scope = 'global' OR project_id IS NOT NULL)
);

-- Indexes for channels
CREATE INDEX IF NOT EXISTS idx_coms_channels_project ON coms_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_coms_channels_scope ON coms_channels(scope);
CREATE INDEX IF NOT EXISTS idx_coms_channels_template ON coms_channels(template_key);
CREATE INDEX IF NOT EXISTS idx_coms_channels_created_by ON coms_channels(created_by);

-- ============================================================================
-- CHANNEL MEMBERS TABLE (for private/invite-only channels)
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES coms_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Role in channel
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'moderator', 'member'

    -- Overrides
    can_transmit BOOLEAN DEFAULT TRUE,
    is_muted BOOLEAN DEFAULT FALSE,

    -- Notifications
    notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Timestamps
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT coms_channel_members_unique UNIQUE(channel_id, user_id)
);

-- Indexes for channel members
CREATE INDEX IF NOT EXISTS idx_coms_channel_members_channel ON coms_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_coms_channel_members_user ON coms_channel_members(user_id);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES coms_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'system', 'file', 'voice_note'

    -- Attachments (JSON array of attachment objects)
    attachments JSONB DEFAULT '[]'::jsonb,

    -- Replies/threading
    reply_to_id UUID REFERENCES coms_messages(id) ON DELETE SET NULL,

    -- Edit history
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_coms_messages_channel ON coms_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coms_messages_sender ON coms_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_coms_messages_reply ON coms_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_coms_messages_created ON coms_messages(created_at DESC);

-- ============================================================================
-- READ RECEIPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES coms_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES coms_messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT coms_read_receipts_unique UNIQUE(channel_id, user_id)
);

-- Indexes for read receipts
CREATE INDEX IF NOT EXISTS idx_coms_read_receipts_channel ON coms_read_receipts(channel_id);
CREATE INDEX IF NOT EXISTS idx_coms_read_receipts_user ON coms_read_receipts(user_id);

-- ============================================================================
-- VOICE ROOMS TABLE (active voice sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_voice_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES coms_channels(id) ON DELETE CASCADE,

    -- Room configuration
    is_active BOOLEAN DEFAULT TRUE,
    max_participants INTEGER DEFAULT 50,

    -- WebRTC configuration (stored encrypted)
    ice_servers JSONB DEFAULT '["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]'::jsonb,

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    CONSTRAINT coms_voice_rooms_unique_channel UNIQUE(channel_id)
);

-- Index for voice rooms
CREATE INDEX IF NOT EXISTS idx_coms_voice_rooms_channel ON coms_voice_rooms(channel_id);
CREATE INDEX IF NOT EXISTS idx_coms_voice_rooms_active ON coms_voice_rooms(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- VOICE PARTICIPANTS TABLE (real-time state)
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_voice_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES coms_voice_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- State
    is_transmitting BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_deafened BOOLEAN DEFAULT FALSE,

    -- Connection info
    connection_id VARCHAR(100),
    peer_id VARCHAR(100),

    -- Timestamps
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT coms_voice_participants_unique UNIQUE(room_id, user_id)
);

-- Indexes for voice participants
CREATE INDEX IF NOT EXISTS idx_coms_voice_participants_room ON coms_voice_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_coms_voice_participants_user ON coms_voice_participants(user_id);

-- ============================================================================
-- USER PRESENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_user_presence (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(20) DEFAULT 'offline', -- 'online', 'away', 'busy', 'offline'
    status_message TEXT,

    -- Current location
    current_channel_id UUID REFERENCES coms_channels(id) ON DELETE SET NULL,
    current_project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,

    -- Connection tracking
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    socket_ids TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Indexes for presence
CREATE INDEX IF NOT EXISTS idx_coms_presence_status ON coms_user_presence(status);
CREATE INDEX IF NOT EXISTS idx_coms_presence_project ON coms_user_presence(current_project_id);
CREATE INDEX IF NOT EXISTS idx_coms_presence_channel ON coms_user_presence(current_channel_id);

-- ============================================================================
-- CHANNEL TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS coms_channel_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type coms_channel_type NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(7),
    default_visible_to_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
    default_can_transmit_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INSERT PRODUCTION CHANNEL TEMPLATES
-- ============================================================================

INSERT INTO coms_channel_templates (template_key, name, description, channel_type, icon, color, default_visible_to_roles, default_can_transmit_roles, sort_order) VALUES
-- All Call - Production-wide announcements (voice only)
('all_call', 'All Call', 'Production-wide announcements', 'voice', 'megaphone', '#FFD700',
 ARRAY[]::TEXT[],
 ARRAY['showrunner', 'producer', 'director', 'first_ad']::TEXT[],
 1),

-- 1st AD Channel - AD team coordination
('ad_channel', '1st AD Channel', 'AD team coordination', 'text_and_voice', 'timer', '#FF6B35',
 ARRAY['showrunner', 'producer', 'director', 'first_ad', 'department_head']::TEXT[],
 ARRAY['first_ad', 'showrunner']::TEXT[],
 2),

-- Director to Camera - Director and camera department
('director_camera', 'Director to Camera', 'Director and camera department', 'voice', 'camera', '#4ECDC4',
 ARRAY['showrunner', 'producer', 'director', 'dp']::TEXT[],
 ARRAY['director', 'dp']::TEXT[],
 3),

-- Camera Department - Camera team internal
('camera_dept', 'Camera Department', 'Camera team internal', 'text_and_voice', 'aperture', '#45B7D1',
 ARRAY['dp', 'department_head', 'crew']::TEXT[],
 ARRAY['dp', 'department_head', 'crew']::TEXT[],
 4),

-- Production Office - Producers and coordinators
('production_office', 'Production Office', 'Producers and coordinators', 'text_and_voice', 'building', '#96CEB4',
 ARRAY['showrunner', 'producer']::TEXT[],
 ARRAY['showrunner', 'producer']::TEXT[],
 5),

-- Private Line - Confidential communications
('private_line', 'Private Line', 'Confidential communications', 'voice', 'lock', '#9B59B6',
 ARRAY['showrunner', 'producer', 'director']::TEXT[],
 ARRAY['showrunner', 'producer', 'director']::TEXT[],
 6),

-- Grip & Electric Channel
('grip_electric', 'G&E Channel', 'Grip and electric department', 'text_and_voice', 'zap', '#F39C12',
 ARRAY['dp', 'department_head', 'crew']::TEXT[],
 ARRAY['dp', 'department_head', 'crew']::TEXT[],
 7),

-- Sound Department
('sound_dept', 'Sound Department', 'Sound team', 'text_and_voice', 'volume-2', '#1ABC9C',
 ARRAY['director', 'department_head', 'crew']::TEXT[],
 ARRAY['department_head', 'crew']::TEXT[],
 8),

-- Art Department
('art_dept', 'Art Department', 'Art and props', 'text_and_voice', 'palette', '#E74C3C',
 ARRAY['producer', 'director', 'department_head']::TEXT[],
 ARRAY['department_head']::TEXT[],
 9),

-- General Chat - Open team discussion
('general', 'General Chat', 'Open team discussion', 'text_and_voice', 'message-circle', '#95A5A6',
 ARRAY[]::TEXT[],
 ARRAY[]::TEXT[],
 10)

ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    channel_type = EXCLUDED.channel_type,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    default_visible_to_roles = EXCLUDED.default_visible_to_roles,
    default_can_transmit_roles = EXCLUDED.default_can_transmit_roles,
    sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

-- Trigger for coms_channels
CREATE OR REPLACE TRIGGER coms_channels_updated_at
    BEFORE UPDATE ON coms_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get unread message count for a user in a channel
CREATE OR REPLACE FUNCTION get_coms_unread_count(
    p_channel_id UUID,
    p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_last_read_id UUID;
    v_count INTEGER;
BEGIN
    -- Get the last read message ID
    SELECT last_read_message_id INTO v_last_read_id
    FROM coms_read_receipts
    WHERE channel_id = p_channel_id AND user_id = p_user_id;

    -- Count messages after last read
    IF v_last_read_id IS NULL THEN
        -- Never read, count all messages
        SELECT COUNT(*) INTO v_count
        FROM coms_messages
        WHERE channel_id = p_channel_id
          AND is_deleted = FALSE
          AND sender_id != p_user_id;
    ELSE
        -- Count messages after last read
        SELECT COUNT(*) INTO v_count
        FROM coms_messages m
        WHERE m.channel_id = p_channel_id
          AND m.is_deleted = FALSE
          AND m.sender_id != p_user_id
          AND m.created_at > (
              SELECT created_at FROM coms_messages WHERE id = v_last_read_id
          );
    END IF;

    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can access a channel
CREATE OR REPLACE FUNCTION can_access_coms_channel(
    p_channel_id UUID,
    p_user_id UUID,
    p_user_backlot_role TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_channel RECORD;
    v_is_member BOOLEAN;
BEGIN
    -- Get channel info
    SELECT * INTO v_channel
    FROM coms_channels
    WHERE id = p_channel_id AND archived_at IS NULL;

    IF v_channel IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if user is explicit member (for private channels)
    SELECT EXISTS (
        SELECT 1 FROM coms_channel_members
        WHERE channel_id = p_channel_id AND user_id = p_user_id
    ) INTO v_is_member;

    IF v_is_member THEN
        RETURN TRUE;
    END IF;

    -- For private channels, must be member
    IF v_channel.is_private THEN
        RETURN FALSE;
    END IF;

    -- Check role-based visibility
    IF array_length(v_channel.visible_to_roles, 1) IS NULL OR
       array_length(v_channel.visible_to_roles, 1) = 0 THEN
        -- No role restrictions, everyone can access
        RETURN TRUE;
    END IF;

    -- Check if user's role is in visible_to_roles
    IF p_user_backlot_role IS NOT NULL AND
       p_user_backlot_role = ANY(v_channel.visible_to_roles) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can transmit in a voice channel
CREATE OR REPLACE FUNCTION can_transmit_coms_channel(
    p_channel_id UUID,
    p_user_id UUID,
    p_user_backlot_role TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_channel RECORD;
    v_member RECORD;
BEGIN
    -- Get channel info
    SELECT * INTO v_channel
    FROM coms_channels
    WHERE id = p_channel_id AND archived_at IS NULL;

    IF v_channel IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check member override
    SELECT * INTO v_member
    FROM coms_channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id;

    IF v_member IS NOT NULL THEN
        RETURN v_member.can_transmit AND NOT v_member.is_muted;
    END IF;

    -- Check role-based transmit permissions
    IF array_length(v_channel.can_transmit_roles, 1) IS NULL OR
       array_length(v_channel.can_transmit_roles, 1) = 0 THEN
        -- No role restrictions, everyone can transmit
        RETURN TRUE;
    END IF;

    -- Check if user's role is in can_transmit_roles
    IF p_user_backlot_role IS NOT NULL AND
       p_user_backlot_role = ANY(v_channel.can_transmit_roles) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE coms_channels IS 'Communication channels for text and voice chat';
COMMENT ON TABLE coms_channel_members IS 'Explicit channel membership for private channels';
COMMENT ON TABLE coms_messages IS 'Messages in communication channels';
COMMENT ON TABLE coms_read_receipts IS 'Track last read message per user per channel';
COMMENT ON TABLE coms_voice_rooms IS 'Active voice room sessions';
COMMENT ON TABLE coms_voice_participants IS 'Users currently in voice rooms';
COMMENT ON TABLE coms_user_presence IS 'User online/offline status and current location';
COMMENT ON TABLE coms_channel_templates IS 'Production channel templates for quick setup';
