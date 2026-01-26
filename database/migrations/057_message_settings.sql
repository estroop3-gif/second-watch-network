-- Migration 057: Message Settings
-- Adds user blocking, message reporting, privacy settings, and muted conversations

-- User blocked users (mutual blocking)
CREATE TABLE IF NOT EXISTS user_blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON user_blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON user_blocked_users(blocked_user_id);

-- Message reports
CREATE TABLE IF NOT EXISTS message_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,
    message_content TEXT, -- Snapshot of content at report time
    message_sender_id UUID NOT NULL REFERENCES profiles(id),
    conversation_id UUID, -- For context
    reason VARCHAR(50) NOT NULL, -- spam, harassment, inappropriate, other
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
    reviewed_by UUID REFERENCES profiles(id),
    resolution_notes TEXT,
    resolution_action VARCHAR(50), -- warning_issued, user_blocked, no_action, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_reports_status ON message_reports(status);
CREATE INDEX IF NOT EXISTS idx_message_reports_reporter ON message_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_sender ON message_reports(message_sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_created ON message_reports(created_at DESC);

-- User message preferences
CREATE TABLE IF NOT EXISTS user_message_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    who_can_message VARCHAR(20) DEFAULT 'everyone', -- everyone, connections, nobody
    show_read_receipts BOOLEAN DEFAULT true,
    show_online_status BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Muted conversations
CREATE TABLE IF NOT EXISTS user_muted_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    conversation_partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    channel_id UUID, -- For group/channel mutes
    muted_until TIMESTAMPTZ, -- NULL = indefinite
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints for muted conversations (one entry per conversation type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_muted_conversations_dm
    ON user_muted_conversations(user_id, conversation_partner_id)
    WHERE conversation_partner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_muted_conversations_channel
    ON user_muted_conversations(user_id, channel_id)
    WHERE channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_muted_conversations_user ON user_muted_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_muted_conversations_until ON user_muted_conversations(muted_until)
    WHERE muted_until IS NOT NULL;

-- Function to check if two users have blocked each other (mutual check)
CREATE OR REPLACE FUNCTION check_mutual_block(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocked_users
        WHERE (user_id = user1_id AND blocked_user_id = user2_id)
           OR (user_id = user2_id AND blocked_user_id = user1_id)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user is a "connection" of another user
-- Connections = mutual followers OR shared project collaborators OR Order members together
CREATE OR REPLACE FUNCTION is_user_connection(sender_id UUID, recipient_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_mutual_follower BOOLEAN;
    is_project_collaborator BOOLEAN;
    are_order_members BOOLEAN;
BEGIN
    -- Check for mutual followers
    SELECT EXISTS (
        SELECT 1 FROM connections c1
        JOIN connections c2 ON c1.user_id = c2.following_id AND c1.following_id = c2.user_id
        WHERE c1.user_id = sender_id AND c1.following_id = recipient_id
          AND c1.status = 'accepted' AND c2.status = 'accepted'
    ) INTO is_mutual_follower;

    IF is_mutual_follower THEN
        RETURN TRUE;
    END IF;

    -- Check for shared project collaborators (both are members of the same project)
    SELECT EXISTS (
        SELECT 1 FROM backlot_project_members pm1
        JOIN backlot_project_members pm2 ON pm1.project_id = pm2.project_id
        WHERE pm1.user_id = sender_id AND pm2.user_id = recipient_id
    ) INTO is_project_collaborator;

    IF is_project_collaborator THEN
        RETURN TRUE;
    END IF;

    -- Check if both are Order members
    SELECT EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2 ON p1.is_order_member = TRUE AND p2.is_order_member = TRUE
        WHERE p1.id = sender_id AND p2.id = recipient_id
    ) INTO are_order_members;

    RETURN are_order_members;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user can message another based on privacy settings
CREATE OR REPLACE FUNCTION can_user_message(sender_id UUID, recipient_id UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT) AS $$
DECLARE
    pref_who_can_message VARCHAR(20);
    is_blocked BOOLEAN;
    is_connection BOOLEAN;
BEGIN
    -- First check for mutual blocking
    SELECT check_mutual_block(sender_id, recipient_id) INTO is_blocked;
    IF is_blocked THEN
        RETURN QUERY SELECT FALSE, 'User has blocked you or you have blocked this user';
        RETURN;
    END IF;

    -- Get recipient's message preference
    SELECT COALESCE(who_can_message, 'everyone')
    INTO pref_who_can_message
    FROM user_message_preferences
    WHERE user_id = recipient_id;

    -- Default to 'everyone' if no preference set
    IF pref_who_can_message IS NULL THEN
        pref_who_can_message := 'everyone';
    END IF;

    -- Check based on preference
    CASE pref_who_can_message
        WHEN 'nobody' THEN
            RETURN QUERY SELECT FALSE, 'User is not accepting messages';
        WHEN 'connections' THEN
            SELECT is_user_connection(sender_id, recipient_id) INTO is_connection;
            IF is_connection THEN
                RETURN QUERY SELECT TRUE, NULL::TEXT;
            ELSE
                RETURN QUERY SELECT FALSE, 'User only accepts messages from connections';
            END IF;
        ELSE -- 'everyone'
            RETURN QUERY SELECT TRUE, NULL::TEXT;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on message_reports
CREATE OR REPLACE FUNCTION update_message_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_message_reports_updated_at ON message_reports;
CREATE TRIGGER trigger_message_reports_updated_at
    BEFORE UPDATE ON message_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reports_timestamp();

-- Trigger to update updated_at on user_message_preferences
CREATE OR REPLACE FUNCTION update_message_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_message_preferences_updated_at ON user_message_preferences;
CREATE TRIGGER trigger_message_preferences_updated_at
    BEFORE UPDATE ON user_message_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_message_preferences_timestamp();
