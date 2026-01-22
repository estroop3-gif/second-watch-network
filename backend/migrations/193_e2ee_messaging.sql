-- Migration 193: End-to-End Encrypted Messaging
-- Implements Signal Protocol-style key management for E2EE DMs

-- ============================================================================
-- USER KEY BUNDLES
-- ============================================================================

-- Identity keys - long-term public identity for each user
CREATE TABLE IF NOT EXISTS e2ee_identity_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Public identity key (base64 encoded)
    public_key TEXT NOT NULL,
    -- Registration ID (random 32-bit integer for Signal Protocol)
    registration_id INTEGER NOT NULL,
    -- When this identity was created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Identity keys should be unique per user (one active identity)
    UNIQUE(user_id)
);

-- Signed prekeys - medium-term keys signed by identity key
CREATE TABLE IF NOT EXISTS e2ee_signed_prekeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Key ID (incrementing integer)
    key_id INTEGER NOT NULL,
    -- Public signed prekey (base64 encoded)
    public_key TEXT NOT NULL,
    -- Signature of the public key by identity key (base64 encoded)
    signature TEXT NOT NULL,
    -- Timestamp when this key was generated
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Is this the current active signed prekey?
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, key_id)
);

-- One-time prekeys - single-use keys for initial key exchange
CREATE TABLE IF NOT EXISTS e2ee_one_time_prekeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Key ID (incrementing integer)
    key_id INTEGER NOT NULL,
    -- Public one-time prekey (base64 encoded)
    public_key TEXT NOT NULL,
    -- When this key was uploaded
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Has this key been claimed by someone initiating a session?
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    UNIQUE(user_id, key_id)
);

-- ============================================================================
-- KEY BACKUP FOR RECOVERY
-- ============================================================================

-- Encrypted key backup - allows recovery with PIN/passphrase
CREATE TABLE IF NOT EXISTS e2ee_key_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Encrypted private key bundle (AES-256-GCM encrypted with derived key)
    encrypted_data TEXT NOT NULL,
    -- Salt used for PBKDF2 key derivation (base64 encoded)
    salt TEXT NOT NULL,
    -- IV/nonce for AES-GCM (base64 encoded)
    iv TEXT NOT NULL,
    -- Version of the backup format
    version INTEGER DEFAULT 1,
    -- When this backup was created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================================
-- ENCRYPTED MESSAGES
-- ============================================================================

-- Add E2EE columns to the direct messages table
ALTER TABLE backlot_direct_messages
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ciphertext TEXT,
ADD COLUMN IF NOT EXISTS message_type INTEGER DEFAULT 1,  -- 1=normal, 2=prekey message
ADD COLUMN IF NOT EXISTS sender_registration_id INTEGER,
ADD COLUMN IF NOT EXISTS sender_device_id INTEGER DEFAULT 1;

-- ============================================================================
-- SESSION TRACKING (optional - for server-side session hints)
-- ============================================================================

-- Track which users have established E2EE sessions (for UI hints)
CREATE TABLE IF NOT EXISTS e2ee_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    peer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Has a session been established?
    is_established BOOLEAN DEFAULT false,
    -- Last activity on this session
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, peer_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_e2ee_identity_keys_user ON e2ee_identity_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_e2ee_signed_prekeys_user_active ON e2ee_signed_prekeys(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_e2ee_one_time_prekeys_user_unused ON e2ee_one_time_prekeys(user_id, is_used) WHERE is_used = false;
CREATE INDEX IF NOT EXISTS idx_e2ee_sessions_user_peer ON e2ee_sessions(user_id, peer_id);
CREATE INDEX IF NOT EXISTS idx_dm_encrypted ON backlot_direct_messages(is_encrypted) WHERE is_encrypted = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE e2ee_identity_keys IS 'Long-term public identity keys for E2EE (Signal Protocol)';
COMMENT ON TABLE e2ee_signed_prekeys IS 'Medium-term signed prekeys for key exchange';
COMMENT ON TABLE e2ee_one_time_prekeys IS 'One-time prekeys consumed during initial session setup';
COMMENT ON TABLE e2ee_key_backups IS 'PIN-encrypted backups of private keys for device recovery';
COMMENT ON TABLE e2ee_sessions IS 'Tracks established E2EE sessions between users';
