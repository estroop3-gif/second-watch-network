-- Migration 039: Call Sheet Share Links
-- Enable external sharing of call sheets via secure tokens

-- =====================================================
-- TABLE: backlot_call_sheet_shares
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,

  -- Unique share token for URL
  share_token TEXT UNIQUE NOT NULL,

  -- Who created this share
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Expiration and status
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  -- Optional password protection (bcrypt hash)
  password_hash TEXT,

  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- Permissions
  allowed_actions TEXT[] DEFAULT ARRAY['view'],

  -- Metadata
  name TEXT, -- Optional label for this share link
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_sheet_shares_call_sheet ON backlot_call_sheet_shares(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_shares_token ON backlot_call_sheet_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_call_sheet_shares_expires ON backlot_call_sheet_shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_call_sheet_shares_active ON backlot_call_sheet_shares(is_active) WHERE is_active = TRUE;

-- =====================================================
-- TABLE: backlot_call_sheet_share_views
-- =====================================================
-- Track individual views for analytics
CREATE TABLE IF NOT EXISTS backlot_call_sheet_share_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES backlot_call_sheet_shares(id) ON DELETE CASCADE,

  -- Anonymous viewer info
  ip_address TEXT,
  user_agent TEXT,

  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_views_share ON backlot_call_sheet_share_views(share_id);
CREATE INDEX IF NOT EXISTS idx_share_views_viewed_at ON backlot_call_sheet_share_views(viewed_at);
