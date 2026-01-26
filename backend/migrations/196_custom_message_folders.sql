-- Migration 196: Custom Message Folders
-- Allows users to create custom folders to organize DM conversations

-- =============================================================================
-- 1. Custom Folders Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_message_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),           -- Hex color e.g. "#FF3C3C"
    icon VARCHAR(50),           -- Icon name e.g. "star", "work"
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Indexes for folder queries
CREATE INDEX IF NOT EXISTS idx_user_message_folders_user_id ON user_message_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_message_folders_position ON user_message_folders(user_id, position);

COMMENT ON TABLE user_message_folders IS 'Custom message folders created by users to organize DM conversations';
COMMENT ON COLUMN user_message_folders.color IS 'Hex color code for folder (e.g. #FF3C3C)';
COMMENT ON COLUMN user_message_folders.icon IS 'Icon identifier (e.g. star, briefcase, heart)';
COMMENT ON COLUMN user_message_folders.position IS 'Display order position (lower = higher in list)';

-- =============================================================================
-- 2. Folder Rules Table (must come before assignments for foreign key)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_message_folder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES user_message_folders(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,  -- Higher = evaluated first
    conditions JSONB NOT NULL DEFAULT '[]',
    condition_logic VARCHAR(10) DEFAULT 'AND',  -- 'AND' or 'OR'
    apply_to_existing BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rule queries
CREATE INDEX IF NOT EXISTS idx_user_message_folder_rules_user_id ON user_message_folder_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_message_folder_rules_folder_id ON user_message_folder_rules(folder_id);
CREATE INDEX IF NOT EXISTS idx_user_message_folder_rules_active ON user_message_folder_rules(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_message_folder_rules_priority ON user_message_folder_rules(user_id, priority DESC);

COMMENT ON TABLE user_message_folder_rules IS 'Auto-sorting rules for assigning conversations to folders';
COMMENT ON COLUMN user_message_folder_rules.conditions IS 'JSON array of conditions: [{type, operator, value}]';
COMMENT ON COLUMN user_message_folder_rules.condition_logic IS 'How conditions are combined: AND (all must match) or OR (any must match)';
COMMENT ON COLUMN user_message_folder_rules.priority IS 'Higher priority rules are evaluated first';

-- =============================================================================
-- 3. Conversation-to-Folder Assignments Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_message_folder_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES user_message_folders(id) ON DELETE CASCADE,
    conversation_partner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by VARCHAR(20) DEFAULT 'manual',  -- 'manual' or 'rule'
    rule_id UUID REFERENCES user_message_folder_rules(id) ON DELETE SET NULL,
    UNIQUE(user_id, conversation_partner_id)  -- One folder per conversation per user
);

-- Indexes for assignment queries
CREATE INDEX IF NOT EXISTS idx_user_message_folder_assignments_user_id ON user_message_folder_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_message_folder_assignments_folder_id ON user_message_folder_assignments(folder_id);
CREATE INDEX IF NOT EXISTS idx_user_message_folder_assignments_partner_id ON user_message_folder_assignments(conversation_partner_id);
CREATE INDEX IF NOT EXISTS idx_user_message_folder_assignments_user_folder ON user_message_folder_assignments(user_id, folder_id);

COMMENT ON TABLE user_message_folder_assignments IS 'Maps conversations (by partner) to custom folders';
COMMENT ON COLUMN user_message_folder_assignments.conversation_partner_id IS 'The other user in the DM conversation';
COMMENT ON COLUMN user_message_folder_assignments.assigned_by IS 'How the assignment was made: manual or rule';

-- =============================================================================
-- 4. Helper function for updated_at timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION update_user_message_folders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_user_message_folders_updated_at ON user_message_folders;
CREATE TRIGGER trigger_user_message_folders_updated_at
    BEFORE UPDATE ON user_message_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_user_message_folders_timestamp();

DROP TRIGGER IF EXISTS trigger_user_message_folder_rules_updated_at ON user_message_folder_rules;
CREATE TRIGGER trigger_user_message_folder_rules_updated_at
    BEFORE UPDATE ON user_message_folder_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_user_message_folders_timestamp();

-- =============================================================================
-- 5. View for folder unread counts (extends existing folder counts)
-- =============================================================================
CREATE OR REPLACE VIEW v_custom_folder_unread_counts AS
SELECT
    f.id as folder_id,
    f.user_id,
    f.name as folder_name,
    f.color,
    f.icon,
    f.position,
    COUNT(DISTINCT CASE
        WHEN dm.read_at IS NULL AND dm.sender_id = a.conversation_partner_id
        THEN dm.id
    END) as unread_count,
    COUNT(DISTINCT a.conversation_partner_id) as conversation_count
FROM user_message_folders f
LEFT JOIN user_message_folder_assignments a ON a.folder_id = f.id
LEFT JOIN backlot_direct_messages dm ON (
    (dm.sender_id = a.conversation_partner_id AND dm.recipient_id = f.user_id)
    OR (dm.recipient_id = a.conversation_partner_id AND dm.sender_id = f.user_id)
)
GROUP BY f.id, f.user_id, f.name, f.color, f.icon, f.position;

COMMENT ON VIEW v_custom_folder_unread_counts IS 'Aggregates unread counts for custom message folders';

-- =============================================================================
-- 6. Function to evaluate folder rules for a conversation
-- =============================================================================
CREATE OR REPLACE FUNCTION evaluate_folder_rules(
    p_user_id UUID,
    p_partner_id UUID,
    p_message_content TEXT DEFAULT NULL,
    p_context_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_rule RECORD;
    v_condition JSONB;
    v_matches BOOLEAN;
    v_condition_match BOOLEAN;
    v_partner_profile RECORD;
BEGIN
    -- Get partner profile for rule evaluation
    SELECT id, username, full_name INTO v_partner_profile
    FROM profiles WHERE id = p_partner_id;

    -- Iterate through active rules ordered by priority (highest first)
    FOR v_rule IN
        SELECT r.*, f.id as folder_id
        FROM user_message_folder_rules r
        JOIN user_message_folders f ON f.id = r.folder_id
        WHERE r.user_id = p_user_id
          AND r.is_active = true
        ORDER BY r.priority DESC
    LOOP
        -- Initialize match based on logic type
        IF v_rule.condition_logic = 'AND' THEN
            v_matches := true;
        ELSE
            v_matches := false;
        END IF;

        -- Evaluate each condition
        FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions)
        LOOP
            v_condition_match := false;

            -- Evaluate condition based on type
            CASE v_condition->>'type'
                WHEN 'sender' THEN
                    -- Check if partner is in the sender list
                    IF v_condition->>'operator' = 'in' THEN
                        v_condition_match := p_partner_id::text = ANY(
                            SELECT jsonb_array_elements_text(v_condition->'value')
                        );
                    ELSIF v_condition->>'operator' = 'not_in' THEN
                        v_condition_match := NOT (p_partner_id::text = ANY(
                            SELECT jsonb_array_elements_text(v_condition->'value')
                        ));
                    END IF;

                WHEN 'keyword' THEN
                    -- Check if message contains keyword
                    IF p_message_content IS NOT NULL THEN
                        IF v_condition->>'operator' = 'contains' THEN
                            v_condition_match := EXISTS (
                                SELECT 1 FROM jsonb_array_elements_text(v_condition->'value') kw
                                WHERE LOWER(p_message_content) LIKE '%' || LOWER(kw) || '%'
                            );
                        ELSIF v_condition->>'operator' = 'not_contains' THEN
                            v_condition_match := NOT EXISTS (
                                SELECT 1 FROM jsonb_array_elements_text(v_condition->'value') kw
                                WHERE LOWER(p_message_content) LIKE '%' || LOWER(kw) || '%'
                            );
                        END IF;
                    END IF;

                WHEN 'context' THEN
                    -- Check context type
                    IF v_condition->>'operator' = 'equals' THEN
                        v_condition_match := p_context_type = v_condition->>'value';
                    ELSIF v_condition->>'operator' = 'not_equals' THEN
                        v_condition_match := p_context_type IS DISTINCT FROM v_condition->>'value';
                    END IF;

                ELSE
                    -- Unknown condition type, skip
                    v_condition_match := false;
            END CASE;

            -- Apply condition logic
            IF v_rule.condition_logic = 'AND' THEN
                v_matches := v_matches AND v_condition_match;
            ELSE
                v_matches := v_matches OR v_condition_match;
            END IF;
        END LOOP;

        -- If rule matches, return the folder ID
        IF v_matches AND jsonb_array_length(v_rule.conditions) > 0 THEN
            RETURN v_rule.folder_id;
        END IF;
    END LOOP;

    -- No rule matched
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION evaluate_folder_rules IS 'Evaluates folder rules and returns matching folder_id or NULL';
