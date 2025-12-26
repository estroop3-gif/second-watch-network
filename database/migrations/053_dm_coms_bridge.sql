-- Migration 053: DM/Coms Bridge
-- Creates functions and views to unify the legacy DM system with the Coms system
-- This allows for gradual migration while maintaining backwards compatibility

-- Function to get or create a DM channel between two users in the Coms system
CREATE OR REPLACE FUNCTION get_or_create_dm_channel(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
    channel_id UUID;
    sorted_ids UUID[];
BEGIN
    -- Sort user IDs for consistency
    sorted_ids := ARRAY(SELECT unnest(ARRAY[user1_id, user2_id]) ORDER BY 1);

    -- Check if a DM channel already exists between these users
    SELECT cc.id INTO channel_id
    FROM coms_channels cc
    WHERE cc.channel_type = 'dm'
      AND cc.archived_at IS NULL
      AND EXISTS (
          SELECT 1 FROM coms_channel_members m1
          WHERE m1.channel_id = cc.id AND m1.user_id = sorted_ids[1]
      )
      AND EXISTS (
          SELECT 1 FROM coms_channel_members m2
          WHERE m2.channel_id = cc.id AND m2.user_id = sorted_ids[2]
      )
      AND (SELECT COUNT(*) FROM coms_channel_members m WHERE m.channel_id = cc.id) = 2;

    -- If no channel exists, create one
    IF channel_id IS NULL THEN
        INSERT INTO coms_channels (
            id, scope, channel_type, is_private, is_system_channel, created_by, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 'global', 'dm', true, false, user1_id, NOW(), NOW()
        ) RETURNING id INTO channel_id;

        -- Add both users as members
        INSERT INTO coms_channel_members (id, channel_id, user_id, role, joined_at)
        VALUES
            (gen_random_uuid(), channel_id, sorted_ids[1], 'member', NOW()),
            (gen_random_uuid(), channel_id, sorted_ids[2], 'member', NOW());
    END IF;

    RETURN channel_id;
END;
$$ LANGUAGE plpgsql;

-- View to get unified conversations from both legacy DMs and Coms DM channels
-- This provides a single source for the conversation list
CREATE OR REPLACE VIEW unified_dm_conversations AS
WITH
-- Legacy DM conversations
legacy_dms AS (
    SELECT
        c.id,
        'legacy' AS source,
        c.participant_ids,
        c.last_message,
        c.last_message_at,
        c.created_at,
        NULL::UUID AS coms_channel_id
    FROM conversations c
),
-- Coms DM channels
coms_dms AS (
    SELECT
        cc.id,
        'coms' AS source,
        ARRAY(
            SELECT user_id FROM coms_channel_members
            WHERE channel_id = cc.id
            ORDER BY user_id
        ) AS participant_ids,
        (
            SELECT content FROM coms_messages
            WHERE channel_id = cc.id AND is_deleted = false
            ORDER BY created_at DESC LIMIT 1
        ) AS last_message,
        (
            SELECT created_at FROM coms_messages
            WHERE channel_id = cc.id AND is_deleted = false
            ORDER BY created_at DESC LIMIT 1
        ) AS last_message_at,
        cc.created_at,
        cc.id AS coms_channel_id
    FROM coms_channels cc
    WHERE cc.channel_type = 'dm'
      AND cc.archived_at IS NULL
)
SELECT * FROM legacy_dms
UNION ALL
SELECT * FROM coms_dms;

-- Function to get unified conversations for a user
CREATE OR REPLACE FUNCTION get_unified_conversations(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    source TEXT,
    participant_ids UUID[],
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    coms_channel_id UUID,
    unread_count BIGINT,
    other_user_id UUID,
    other_username TEXT,
    other_full_name TEXT,
    other_avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH unified AS (
        SELECT
            udc.id,
            udc.source,
            udc.participant_ids,
            udc.last_message,
            udc.last_message_at,
            udc.created_at,
            udc.coms_channel_id
        FROM unified_dm_conversations udc
        WHERE p_user_id = ANY(udc.participant_ids)
    ),
    with_other_user AS (
        SELECT
            u.*,
            -- Get the other participant's ID (not the current user)
            (SELECT unnest(u.participant_ids) EXCEPT SELECT p_user_id LIMIT 1) AS other_user_id
        FROM unified u
    ),
    with_unread AS (
        SELECT
            wou.*,
            CASE
                WHEN wou.source = 'legacy' THEN (
                    SELECT COUNT(*) FROM messages m
                    WHERE m.conversation_id = wou.id
                      AND m.sender_id != p_user_id
                      AND m.is_read = false
                )
                WHEN wou.source = 'coms' THEN (
                    SELECT COUNT(*) FROM coms_messages cm
                    WHERE cm.channel_id = wou.coms_channel_id
                      AND cm.sender_id != p_user_id
                      AND cm.is_deleted = false
                      AND cm.created_at > COALESCE(
                          (SELECT last_read_at FROM coms_read_receipts
                           WHERE channel_id = wou.coms_channel_id AND user_id = p_user_id),
                          '1970-01-01'::TIMESTAMPTZ
                      )
                )
                ELSE 0
            END AS unread_count
        FROM with_other_user wou
    )
    SELECT
        wu.id,
        wu.source,
        wu.participant_ids,
        wu.last_message,
        wu.last_message_at,
        wu.created_at,
        wu.coms_channel_id,
        wu.unread_count,
        wu.other_user_id,
        p.username AS other_username,
        p.full_name AS other_full_name,
        p.avatar_url AS other_avatar_url
    FROM with_unread wu
    LEFT JOIN profiles p ON p.id = wu.other_user_id
    ORDER BY wu.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to send a message that works with both systems
-- If conversation exists in legacy, use legacy. If in coms, use coms.
-- For new conversations, use coms by default.
CREATE OR REPLACE FUNCTION send_unified_message(
    p_sender_id UUID,
    p_recipient_id UUID,
    p_content TEXT,
    p_conversation_id UUID DEFAULT NULL
)
RETURNS TABLE (
    message_id UUID,
    conversation_id UUID,
    source TEXT
) AS $$
DECLARE
    v_source TEXT;
    v_channel_id UUID;
    v_message_id UUID;
BEGIN
    -- If conversation_id provided, determine which system it's in
    IF p_conversation_id IS NOT NULL THEN
        -- Check if it's a legacy conversation
        IF EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id) THEN
            v_source := 'legacy';

            INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
            VALUES (gen_random_uuid(), p_conversation_id, p_sender_id, p_content, NOW())
            RETURNING id INTO v_message_id;

            RETURN QUERY SELECT v_message_id, p_conversation_id, v_source;
            RETURN;
        END IF;

        -- Check if it's a coms channel
        IF EXISTS (SELECT 1 FROM coms_channels WHERE id = p_conversation_id) THEN
            v_source := 'coms';

            INSERT INTO coms_messages (id, channel_id, sender_id, content, message_type, created_at)
            VALUES (gen_random_uuid(), p_conversation_id, p_sender_id, p_content, 'text', NOW())
            RETURNING id INTO v_message_id;

            -- Update channel updated_at
            UPDATE coms_channels SET updated_at = NOW() WHERE id = p_conversation_id;

            RETURN QUERY SELECT v_message_id, p_conversation_id, v_source;
            RETURN;
        END IF;
    END IF;

    -- No conversation_id or not found - check for existing legacy conversation
    SELECT id INTO v_channel_id
    FROM conversations
    WHERE participant_ids @> ARRAY[p_sender_id, p_recipient_id]
      AND participant_ids <@ ARRAY[p_sender_id, p_recipient_id];

    IF v_channel_id IS NOT NULL THEN
        v_source := 'legacy';

        INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
        VALUES (gen_random_uuid(), v_channel_id, p_sender_id, p_content, NOW())
        RETURNING id INTO v_message_id;

        RETURN QUERY SELECT v_message_id, v_channel_id, v_source;
        RETURN;
    END IF;

    -- No legacy conversation - use or create coms DM channel
    v_channel_id := get_or_create_dm_channel(p_sender_id, p_recipient_id);
    v_source := 'coms';

    INSERT INTO coms_messages (id, channel_id, sender_id, content, message_type, created_at)
    VALUES (gen_random_uuid(), v_channel_id, p_sender_id, p_content, 'text', NOW())
    RETURNING id INTO v_message_id;

    -- Update channel updated_at
    UPDATE coms_channels SET updated_at = NOW() WHERE id = v_channel_id;

    RETURN QUERY SELECT v_message_id, v_channel_id, v_source;
END;
$$ LANGUAGE plpgsql;

-- Index for faster DM channel lookups
CREATE INDEX IF NOT EXISTS idx_coms_channels_dm_type
ON coms_channels(channel_type) WHERE channel_type = 'dm' AND archived_at IS NULL;

-- Grant permissions
GRANT SELECT ON unified_dm_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_dm_channel(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_unified_message(UUID, UUID, TEXT, UUID) TO authenticated;
