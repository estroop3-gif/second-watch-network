-- Migration 197: Message privacy settings tables
-- Adds user_message_preferences, user_blocked_users, user_muted_conversations, and message_reports

-- User message preferences (privacy settings)
CREATE TABLE IF NOT EXISTS user_message_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    who_can_message TEXT NOT NULL DEFAULT 'everyone' CHECK (who_can_message IN ('everyone', 'connections', 'nobody')),
    show_read_receipts BOOLEAN NOT NULL DEFAULT TRUE,
    show_online_status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_message_preferences_user_id ON user_message_preferences(user_id);

-- User blocked users
CREATE TABLE IF NOT EXISTS user_blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, blocked_user_id)
);

-- Indexes for blocked users
CREATE INDEX IF NOT EXISTS idx_user_blocked_users_user_id ON user_blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocked_users_blocked_user_id ON user_blocked_users(blocked_user_id);

-- User muted conversations
CREATE TABLE IF NOT EXISTS user_muted_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    conversation_partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    channel_id UUID,
    muted_until TIMESTAMP WITH TIME ZONE, -- NULL = muted indefinitely
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT muted_target_check CHECK (
        (conversation_partner_id IS NOT NULL AND channel_id IS NULL) OR
        (conversation_partner_id IS NULL AND channel_id IS NOT NULL)
    )
);

-- Indexes for muted conversations
CREATE INDEX IF NOT EXISTS idx_user_muted_conversations_user_id ON user_muted_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_muted_conversations_partner_id ON user_muted_conversations(conversation_partner_id);
CREATE INDEX IF NOT EXISTS idx_user_muted_conversations_channel_id ON user_muted_conversations(channel_id);

-- Message reports
CREATE TABLE IF NOT EXISTS message_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,
    message_content TEXT,
    message_sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    conversation_id UUID,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolution_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for message reports
CREATE INDEX IF NOT EXISTS idx_message_reports_reporter_id ON message_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_message_sender_id ON message_reports(message_sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_status ON message_reports(status);
CREATE INDEX IF NOT EXISTS idx_message_reports_created_at ON message_reports(created_at DESC);

-- Function to check if a user can message another user
-- Returns { allowed: boolean, reason: text }
CREATE OR REPLACE FUNCTION can_user_message(sender_id UUID, recipient_id UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT) AS $$
DECLARE
    recipient_prefs RECORD;
    is_blocked BOOLEAN;
    is_connection BOOLEAN;
BEGIN
    -- Check if sender is blocked by recipient
    SELECT EXISTS(
        SELECT 1 FROM user_blocked_users
        WHERE user_id = recipient_id AND blocked_user_id = sender_id
    ) INTO is_blocked;

    IF is_blocked THEN
        RETURN QUERY SELECT FALSE, 'You have been blocked by this user';
        RETURN;
    END IF;

    -- Check if recipient is blocked by sender (bidirectional block)
    SELECT EXISTS(
        SELECT 1 FROM user_blocked_users
        WHERE user_id = sender_id AND blocked_user_id = recipient_id
    ) INTO is_blocked;

    IF is_blocked THEN
        RETURN QUERY SELECT FALSE, 'You have blocked this user';
        RETURN;
    END IF;

    -- Get recipient's preferences
    SELECT * INTO recipient_prefs
    FROM user_message_preferences
    WHERE user_id = recipient_id;

    -- If no preferences set, default to allowing everyone
    IF recipient_prefs IS NULL THEN
        RETURN QUERY SELECT TRUE, NULL::TEXT;
        RETURN;
    END IF;

    -- Check who_can_message setting
    CASE recipient_prefs.who_can_message
        WHEN 'everyone' THEN
            RETURN QUERY SELECT TRUE, NULL::TEXT;
        WHEN 'nobody' THEN
            RETURN QUERY SELECT FALSE, 'This user is not accepting messages';
        WHEN 'connections' THEN
            -- Check if they are connections (mutual followers, collaborators, or Order members)
            SELECT EXISTS(
                -- Mutual followers
                SELECT 1 FROM followers f1
                JOIN followers f2 ON f1.follower_id = f2.following_id AND f1.following_id = f2.follower_id
                WHERE f1.follower_id = sender_id AND f1.following_id = recipient_id

                UNION

                -- Project collaborators (both are members of the same project)
                SELECT 1 FROM backlot_project_members pm1
                JOIN backlot_project_members pm2 ON pm1.project_id = pm2.project_id
                WHERE pm1.user_id = sender_id AND pm2.user_id = recipient_id

                UNION

                -- Both are Order members
                SELECT 1 FROM profiles p1
                JOIN profiles p2 ON p1.is_order_member = TRUE AND p2.is_order_member = TRUE
                WHERE p1.id = sender_id AND p2.id = recipient_id AND p1.is_order_member = TRUE AND p2.is_order_member = TRUE
            ) INTO is_connection;

            IF is_connection THEN
                RETURN QUERY SELECT TRUE, NULL::TEXT;
            ELSE
                RETURN QUERY SELECT FALSE, 'This user only accepts messages from connections';
            END IF;
        ELSE
            RETURN QUERY SELECT TRUE, NULL::TEXT;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_message_preferences
CREATE OR REPLACE FUNCTION update_user_message_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_message_preferences_updated_at ON user_message_preferences;
CREATE TRIGGER update_user_message_preferences_updated_at
    BEFORE UPDATE ON user_message_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_message_preferences_updated_at();

-- Trigger to update updated_at on message_reports
CREATE OR REPLACE FUNCTION update_message_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_message_reports_updated_at ON message_reports;
CREATE TRIGGER update_message_reports_updated_at
    BEFORE UPDATE ON message_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_message_reports_updated_at();

-- RLS policies
ALTER TABLE user_message_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_muted_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own preferences
CREATE POLICY user_message_preferences_policy ON user_message_preferences
    FOR ALL USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Users can manage their own blocks
CREATE POLICY user_blocked_users_policy ON user_blocked_users
    FOR ALL USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Users can manage their own mutes
CREATE POLICY user_muted_conversations_policy ON user_muted_conversations
    FOR ALL USING (user_id = current_setting('app.current_user_id', TRUE)::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Users can create reports and view their own reports
CREATE POLICY message_reports_insert_policy ON message_reports
    FOR INSERT WITH CHECK (reporter_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY message_reports_select_policy ON message_reports
    FOR SELECT USING (
        reporter_id = current_setting('app.current_user_id', TRUE)::UUID
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = current_setting('app.current_user_id', TRUE)::UUID
            AND role IN ('superadmin', 'admin', 'moderator')
        )
    );
