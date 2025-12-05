-- Second Watch Network - Messaging Tables Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_ids UUID[] NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_participant_ids ON conversations USING GIN (participant_ids);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_submission_id ON messages(submission_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- ============================================================================
-- MESSAGING HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS TABLE(id UUID, participant_ids UUID[], last_message TEXT, last_message_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
    conv_id UUID;
    participants UUID[];
BEGIN
    -- Sort user IDs to ensure consistent ordering
    participants := ARRAY[LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)];
    
    -- Try to find existing conversation
    SELECT c.id INTO conv_id
    FROM conversations c
    WHERE c.participant_ids = participants
    LIMIT 1;
    
    -- If not found, create new conversation
    IF conv_id IS NULL THEN
        INSERT INTO conversations (participant_ids)
        VALUES (participants)
        RETURNING conversations.id INTO conv_id;
    END IF;
    
    -- Return the conversation
    RETURN QUERY
    SELECT c.id, c.participant_ids, c.last_message, c.last_message_at, c.created_at
    FROM conversations c
    WHERE c.id = conv_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's conversations
CREATE OR REPLACE FUNCTION get_user_conversations(user_id UUID)
RETURNS TABLE(
    id UUID,
    participant_ids UUID[],
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count BIGINT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.participant_ids,
        c.last_message,
        c.last_message_at,
        (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.conversation_id = c.id
            AND m.sender_id != user_id
            AND m.is_read = false
        ) as unread_count,
        c.created_at
    FROM conversations c
    WHERE user_id = ANY(c.participant_ids)
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation last_message when message is sent
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        last_message = NEW.content,
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();
