-- Migration 164: Organization Messaging System
-- Enables users to send messages to organizations (e.g., gear houses)
-- Organizations can configure routing and respond to inquiries

-- ============================================================================
-- PART 1: Organization Message Settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_message_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,

    -- Routing configuration
    routing_mode TEXT NOT NULL DEFAULT 'all_admins'
        CHECK (routing_mode IN ('all_admins', 'specific_members', 'disabled')),
    routing_member_ids UUID[], -- Specific members to route to (when mode = 'specific_members')

    -- Auto-reply settings
    auto_reply_enabled BOOLEAN DEFAULT FALSE,
    auto_reply_message TEXT,

    -- Notification preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    slack_webhook_url TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 2: Organization Conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Conversation metadata
    subject TEXT,
    context_type TEXT CHECK (context_type IN ('general', 'rental_order', 'quote', 'support', 'billing')),
    context_id UUID, -- Reference to related object (rental order, quote, etc.)

    -- Assignment (which org member is handling this)
    assigned_to_member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,

    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'resolved')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Last message tracking
    last_message_at TIMESTAMPTZ,
    last_message_by_user_id UUID REFERENCES profiles(id),

    -- Unread counts
    unread_count_user INT DEFAULT 0, -- Unread messages from org's perspective
    unread_count_org INT DEFAULT 0,  -- Unread messages from user's perspective

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one active conversation per user-org pair per context
    UNIQUE(organization_id, user_id, context_type, context_id)
);

-- ============================================================================
-- PART 3: Organization Messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES org_conversations(id) ON DELETE CASCADE,

    -- Sender information
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'org_member')),

    -- Message content
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]', -- Array of attachment objects {name, url, size, type}
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'auto_reply')),

    -- Read tracking
    read_by_user_ids UUID[] DEFAULT '{}',
    read_at TIMESTAMPTZ,

    -- Metadata
    is_internal BOOLEAN DEFAULT FALSE, -- Internal notes (only visible to org members)
    mentioned_user_ids UUID[] DEFAULT '{}', -- @mentions

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 4: Indexes for Performance
-- ============================================================================

-- Conversation lookups
CREATE INDEX IF NOT EXISTS idx_org_conversations_org
ON org_conversations(organization_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_conversations_user
ON org_conversations(user_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_conversations_assigned
ON org_conversations(assigned_to_member_id, status)
WHERE assigned_to_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_conversations_context
ON org_conversations(context_type, context_id)
WHERE context_id IS NOT NULL;

-- Message lookups
CREATE INDEX IF NOT EXISTS idx_org_messages_conversation
ON org_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_messages_sender
ON org_messages(sender_id, created_at DESC);

-- Unread message tracking
CREATE INDEX IF NOT EXISTS idx_org_messages_unread
ON org_messages(conversation_id, read_at)
WHERE read_at IS NULL;

-- ============================================================================
-- PART 5: Triggers for Auto-Update
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger 1: Update conversation metadata when new message arrives
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE org_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_by_user_id = NEW.sender_id,
    unread_count_user = CASE
      WHEN NEW.sender_type = 'org_member' THEN unread_count_user + 1
      ELSE unread_count_user
    END,
    unread_count_org = CASE
      WHEN NEW.sender_type = 'user' THEN unread_count_org + 1
      ELSE unread_count_org
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON org_messages;
CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON org_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- ----------------------------------------------------------------------------
-- Trigger 2: Reset unread count when messages are read
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_unread_on_read()
RETURNS TRIGGER AS $$
DECLARE
  sender_was_user BOOLEAN;
BEGIN
  -- Only process when read_at changes from NULL to a value
  IF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    -- Determine if sender was user or org member
    sender_was_user := (SELECT sender_type = 'user' FROM org_messages WHERE id = NEW.id);

    -- Decrement appropriate unread counter
    UPDATE org_conversations
    SET
      unread_count_user = CASE
        WHEN sender_was_user THEN GREATEST(0, unread_count_user - 1)
        ELSE unread_count_user
      END,
      unread_count_org = CASE
        WHEN NOT sender_was_user THEN GREATEST(0, unread_count_org - 1)
        ELSE unread_count_org
      END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_unread_on_read ON org_messages;
CREATE TRIGGER trg_reset_unread_on_read
AFTER UPDATE OF read_at ON org_messages
FOR EACH ROW
EXECUTE FUNCTION reset_unread_on_read();

-- ----------------------------------------------------------------------------
-- Trigger 3: Update timestamps on settings update
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_org_message_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_org_message_settings_timestamp ON org_message_settings;
CREATE TRIGGER trg_update_org_message_settings_timestamp
BEFORE UPDATE ON org_message_settings
FOR EACH ROW
EXECUTE FUNCTION update_org_message_settings_timestamp();

-- ============================================================================
-- PART 6: Default Settings for Existing Organizations
-- ============================================================================

-- Create default message settings for all existing organizations
INSERT INTO org_message_settings (organization_id, routing_mode, email_notifications)
SELECT id, 'all_admins', TRUE
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM org_message_settings)
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- PART 7: Comments for Documentation
-- ============================================================================

COMMENT ON TABLE org_message_settings IS
'Configuration for how organizations receive and route messages from users';

COMMENT ON TABLE org_conversations IS
'Conversations between individual users and organizations';

COMMENT ON TABLE org_messages IS
'Individual messages within organization conversations';

COMMENT ON COLUMN org_conversations.context_type IS
'Type of context this conversation is about (rental_order, quote, general, etc.)';

COMMENT ON COLUMN org_conversations.context_id IS
'ID of the related object (e.g., rental order ID, quote ID)';

COMMENT ON COLUMN org_conversations.unread_count_user IS
'Number of unread messages from the organization (user perspective)';

COMMENT ON COLUMN org_conversations.unread_count_org IS
'Number of unread messages from the user (organization perspective)';

COMMENT ON COLUMN org_messages.is_internal IS
'Internal notes only visible to organization members, not the user';

COMMENT ON COLUMN org_message_settings.routing_mode IS
'How to route incoming messages: all_admins, specific_members, or disabled';
