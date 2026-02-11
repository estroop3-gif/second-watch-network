-- Migration 225: Business card system for CRM reps

CREATE TABLE IF NOT EXISTS crm_business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  -- SWN side (auto-populated from profile/email account)
  swn_name TEXT NOT NULL,
  swn_title TEXT,
  swn_email TEXT,
  swn_phone TEXT,
  -- Personal side (rep fills in)
  personal_name TEXT,
  personal_title TEXT,
  personal_email TEXT,
  personal_phone TEXT,
  personal_website TEXT,
  personal_logo_url TEXT,
  personal_social_links JSONB DEFAULT '{}',
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'printed', 'rejected')),
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_business_cards_profile ON crm_business_cards(profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_business_cards_status ON crm_business_cards(status);
