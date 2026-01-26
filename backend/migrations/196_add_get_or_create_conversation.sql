-- Migration 196: Add get_or_create_conversation function
-- This function is called by the backend messages API but was missing from the database

-- ============================================================================
-- RPC FUNCTION FOR CONVERSATION CREATION
-- ============================================================================

-- Drop existing function if it exists (to allow changing return type)
DROP FUNCTION IF EXISTS get_or_create_conversation(UUID, UUID);

-- Create or get a conversation record in the conversations table
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    user1_id UUID,
    user2_id UUID
) RETURNS TABLE(id UUID) AS $$
DECLARE
    v_conversation_id UUID;
    v_participant_ids UUID[];
BEGIN
    -- Create sorted array of participant IDs (for consistent lookups)
    v_participant_ids := ARRAY[LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)];

    -- Try to find existing conversation with these participants
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    WHERE c.participant_ids = v_participant_ids;

    -- If not found, create it
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (participant_ids, created_at)
        VALUES (v_participant_ids, NOW())
        RETURNING conversations.id INTO v_conversation_id;
    END IF;

    -- Return the conversation ID
    RETURN QUERY SELECT v_conversation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_conversation IS 'Get or create a conversation between two users in the conversations table. Creates a record if one does not exist.';
