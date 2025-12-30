-- Migration: Project Donations System
-- Adds support for Stripe-integrated donations to public Backlot projects

-- Create project_donations table
CREATE TABLE IF NOT EXISTS project_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    donor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL for anonymous
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_checkout_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    message TEXT,  -- Optional donor message
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    donor_name TEXT,  -- Stored name for display (even if anonymous, we keep for records)
    donor_email TEXT,  -- Stored email for receipts
    platform_fee_cents INTEGER DEFAULT 0,  -- Platform's cut
    net_amount_cents INTEGER,  -- Amount after platform fee (before Stripe fees)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_project_donations_project_id ON project_donations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_donations_donor_id ON project_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_project_donations_status ON project_donations(status);
CREATE INDEX IF NOT EXISTS idx_project_donations_created_at ON project_donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_donations_stripe_session ON project_donations(stripe_checkout_session_id);

-- Add donation-related columns to backlot_projects
ALTER TABLE backlot_projects ADD COLUMN IF NOT EXISTS donations_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE backlot_projects ADD COLUMN IF NOT EXISTS donation_goal_cents INTEGER;  -- Optional funding goal
ALTER TABLE backlot_projects ADD COLUMN IF NOT EXISTS donation_message TEXT;  -- Custom ask message shown to donors

-- Trigger to update updated_at on project_donations
CREATE OR REPLACE FUNCTION update_project_donations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_donations_updated_at ON project_donations;
CREATE TRIGGER project_donations_updated_at
    BEFORE UPDATE ON project_donations
    FOR EACH ROW
    EXECUTE FUNCTION update_project_donations_updated_at();

-- Function to calculate net amount (after platform fee)
-- Platform fee is configurable, default 5%
CREATE OR REPLACE FUNCTION calculate_donation_net_amount()
RETURNS TRIGGER AS $$
DECLARE
    platform_fee_percent NUMERIC := 0.05;  -- 5% platform fee
BEGIN
    NEW.platform_fee_cents := ROUND(NEW.amount_cents * platform_fee_percent);
    NEW.net_amount_cents := NEW.amount_cents - NEW.platform_fee_cents;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_donations_calculate_net ON project_donations;
CREATE TRIGGER project_donations_calculate_net
    BEFORE INSERT OR UPDATE OF amount_cents ON project_donations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_donation_net_amount();
