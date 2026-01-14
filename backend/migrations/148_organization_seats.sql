-- Migration 148: Organization Seats Foundation
-- Adds seat management and billing structure for organizations

-- Add seats/billing columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seat_limit INTEGER DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Add constraint for billing status
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_billing_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_billing_status_check
  CHECK (billing_status IN ('free', 'trial', 'active', 'past_due', 'canceled', 'paused'));

-- Create organization_seats table for tracking seat assignments
CREATE TABLE IF NOT EXISTS organization_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    seat_type VARCHAR(50) NOT NULL DEFAULT 'member',
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Add constraint for seat type
ALTER TABLE organization_seats DROP CONSTRAINT IF EXISTS organization_seats_seat_type_check;
ALTER TABLE organization_seats ADD CONSTRAINT organization_seats_seat_type_check
  CHECK (seat_type IN ('owner', 'admin', 'member'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_seats_org ON organization_seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_seats_user ON organization_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_org_billing_status ON organizations(billing_status);

-- Add comments
COMMENT ON TABLE organization_seats IS 'Tracks billable seats per organization for subscription management';
COMMENT ON COLUMN organizations.seat_limit IS 'Maximum number of seats allowed. NULL = unlimited (free tier or enterprise)';
COMMENT ON COLUMN organizations.billing_status IS 'Subscription status: free (no payment), trial, active, past_due, canceled, paused';
COMMENT ON COLUMN organizations.billing_email IS 'Email for billing notifications and invoices';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Stripe subscription ID for recurring billing';
COMMENT ON COLUMN organization_seats.seat_type IS 'Type of seat: owner (primary account), admin, member';
