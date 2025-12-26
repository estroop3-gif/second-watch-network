-- Desktop API Keys Migration
-- Allows users to create API keys for the SWN Dailies Helper desktop application

-- ============================================================================
-- DESKTOP API KEYS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_desktop_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,      -- SHA-256 hash of the key (never store raw keys)
    key_prefix TEXT NOT NULL,           -- First 10 chars for identification (swn_dk_a1b2)
    name TEXT NOT NULL,                 -- User-provided name ("Work Laptop", "Edit Bay 1")
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Index for looking up keys by user
CREATE INDEX IF NOT EXISTS idx_desktop_keys_user_id ON backlot_desktop_keys(user_id);

-- Index for fast key verification (only active keys)
CREATE INDEX IF NOT EXISTS idx_desktop_keys_hash ON backlot_desktop_keys(key_hash) WHERE is_active = true;

-- Index for listing user's keys ordered by creation
CREATE INDEX IF NOT EXISTS idx_desktop_keys_user_created ON backlot_desktop_keys(user_id, created_at DESC);
