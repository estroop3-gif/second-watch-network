-- Migration 194: Message Folders and Channels
-- Adds context tagging for folder organization and group channels

-- ============================================================================
-- CONTEXT TAGGING FOR DMs (extends existing table)
-- ============================================================================

-- Add context columns to backlot_direct_messages for folder organization
ALTER TABLE backlot_direct_messages
ADD COLUMN IF NOT EXISTS context_type VARCHAR(50) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS context_id UUID,
ADD COLUMN IF NOT EXISTS context_metadata JSONB DEFAULT '{}';

-- Index for folder filtering
CREATE INDEX IF NOT EXISTS idx_dm_context_type ON backlot_direct_messages(context_type);
CREATE INDEX IF NOT EXISTS idx_dm_context_id ON backlot_direct_messages(context_id);
CREATE INDEX IF NOT EXISTS idx_dm_context_type_id ON backlot_direct_messages(context_type, context_id);

-- ============================================================================
-- GROUP CHANNELS
-- ============================================================================

-- Channel definitions
CREATE TABLE IF NOT EXISTS message_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type VARCHAR(50) NOT NULL,  -- 'order', 'greenroom', 'gear_team', 'set_team', 'project'
    context_id UUID,                     -- project_id, gear_house_id, set_house_id, etc.
    is_private BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,    -- Auto-join channel
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_type, context_id, slug)
);

-- Channel membership
CREATE TABLE IF NOT EXISTS message_channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',  -- 'admin', 'moderator', 'member'
    notifications_enabled BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Channel messages
CREATE TABLE IF NOT EXISTS message_channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    is_pinned BOOLEAN DEFAULT false,
    reply_to_id UUID REFERENCES message_channel_messages(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track read status per user per channel
CREATE TABLE IF NOT EXISTS message_channel_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_message_id UUID REFERENCES message_channel_messages(id),
    UNIQUE(channel_id, user_id)
);

-- Indexes for channels
CREATE INDEX IF NOT EXISTS idx_channel_type ON message_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_channel_context ON message_channels(context_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON message_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON message_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON message_channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created ON message_channel_messages(created_at DESC);

-- ============================================================================
-- FOLDER UNREAD COUNTS VIEW
-- ============================================================================

-- View to get unread counts per folder for a user
CREATE OR REPLACE VIEW v_folder_unread_counts AS
SELECT
    dm.recipient_id as user_id,
    COALESCE(dm.context_type, 'personal') as folder,
    COUNT(*) FILTER (WHERE dm.read_at IS NULL) as unread_count
FROM backlot_direct_messages dm
GROUP BY dm.recipient_id, COALESCE(dm.context_type, 'personal');

-- ============================================================================
-- DEFAULT ORDER CHANNELS
-- ============================================================================

-- Create default Order channels (will be populated if Order exists)
INSERT INTO message_channels (name, slug, description, channel_type, is_default, is_private)
VALUES
    ('General', 'general', 'General discussion for Order members', 'order', true, false),
    ('Announcements', 'announcements', 'Official Order announcements', 'order', true, false),
    ('Prayer Requests', 'prayer-requests', 'Share and support prayer requests', 'order', true, false)
ON CONFLICT (channel_type, context_id, slug) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create a DM conversation with context
CREATE OR REPLACE FUNCTION get_or_create_dm_with_context(
    p_user1_id UUID,
    p_user2_id UUID,
    p_context_type VARCHAR(50) DEFAULT 'personal',
    p_context_id UUID DEFAULT NULL,
    p_context_metadata JSONB DEFAULT '{}'
) RETURNS TABLE(conversation_id UUID, is_new BOOLEAN) AS $$
DECLARE
    v_conversation_id UUID;
    v_is_new BOOLEAN := false;
BEGIN
    -- Look for existing conversation between these users (regardless of context)
    SELECT DISTINCT
        CASE
            WHEN sender_id = p_user1_id THEN recipient_id
            ELSE sender_id
        END INTO v_conversation_id
    FROM backlot_direct_messages
    WHERE (sender_id = p_user1_id AND recipient_id = p_user2_id)
       OR (sender_id = p_user2_id AND recipient_id = p_user1_id)
    LIMIT 1;

    -- For DMs, we use the other user's ID as the conversation identifier
    IF v_conversation_id IS NULL THEN
        v_conversation_id := p_user2_id;
        v_is_new := true;
    END IF;

    RETURN QUERY SELECT v_conversation_id, v_is_new;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-join user to default channels
CREATE OR REPLACE FUNCTION auto_join_default_channels(p_user_id UUID, p_channel_type VARCHAR(50))
RETURNS void AS $$
BEGIN
    INSERT INTO message_channel_members (channel_id, user_id, role)
    SELECT c.id, p_user_id, 'member'
    FROM message_channels c
    WHERE c.channel_type = p_channel_type
      AND c.is_default = true
      AND NOT EXISTS (
          SELECT 1 FROM message_channel_members m
          WHERE m.channel_id = c.id AND m.user_id = p_user_id
      );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE message_channels IS 'Group chat channels for Order, Green Room, Gear/Set teams';
COMMENT ON TABLE message_channel_members IS 'Channel membership with roles';
COMMENT ON TABLE message_channel_messages IS 'Messages within group channels';
COMMENT ON COLUMN backlot_direct_messages.context_type IS 'Folder: personal, backlot, application, order, greenroom, gear, set';
COMMENT ON COLUMN backlot_direct_messages.context_id IS 'Related entity ID (project_id, collab_id, etc.)';
