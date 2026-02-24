-- Migration 264: Credit approval workflow + person search
-- Adds approval status to credits, audit history table, and full-text search index

-- Credit approval status
ALTER TABLE credits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
-- Values: pending, approved, rejected
-- Default 'approved' so all existing credits remain visible

ALTER TABLE credits ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS review_note TEXT;

-- Audit history for credit status changes
CREATE TABLE IF NOT EXISTS credit_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_user_status ON credits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_status_history_credit ON credit_status_history(credit_id);

-- Full-text search index on profiles for person search
CREATE INDEX IF NOT EXISTS idx_profiles_name_search
  ON profiles USING gin(to_tsvector('english', COALESCE(full_name, '') || ' ' || COALESCE(display_name, '') || ' ' || COALESCE(username, '')));
