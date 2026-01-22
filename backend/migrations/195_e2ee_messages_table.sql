-- Migration 195: Add E2EE columns to messages table
-- The main messages table also needs encryption support

-- Add E2EE columns to the messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ciphertext TEXT,
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS message_type INTEGER DEFAULT 1,  -- 1=normal, 2=prekey message
ADD COLUMN IF NOT EXISTS sender_public_key TEXT,  -- For prekey messages
ADD COLUMN IF NOT EXISTS message_number INTEGER;  -- Ratchet message number

-- Index for encrypted messages
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(is_encrypted) WHERE is_encrypted = true;

-- Also add nonce to backlot_direct_messages if missing
ALTER TABLE backlot_direct_messages
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS sender_public_key TEXT,
ADD COLUMN IF NOT EXISTS message_number INTEGER;

COMMENT ON COLUMN messages.is_encrypted IS 'Whether this message is end-to-end encrypted';
COMMENT ON COLUMN messages.ciphertext IS 'Base64 encoded encrypted message content';
COMMENT ON COLUMN messages.nonce IS 'Base64 encoded nonce/IV for decryption';
COMMENT ON COLUMN messages.message_type IS '1=normal encrypted, 2=prekey message (first in session)';
COMMENT ON COLUMN messages.sender_public_key IS 'Ephemeral public key for prekey messages';
COMMENT ON COLUMN messages.message_number IS 'Message sequence number in the ratchet';
