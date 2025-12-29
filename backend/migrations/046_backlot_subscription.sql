-- Migration 046: Backlot Subscription System
-- Adds subscription tracking for Backlot Pro tier
-- Run against AWS RDS PostgreSQL database

-- Add backlot subscription fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS backlot_subscription_status TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS backlot_subscription_period_end TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS backlot_subscription_id TEXT;

-- Add index for checking active backlot subscriptions
CREATE INDEX IF NOT EXISTS idx_profiles_backlot_subscription_status
  ON profiles(backlot_subscription_status)
  WHERE backlot_subscription_status IS NOT NULL;

-- Add check constraint for valid subscription statuses
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_backlot_subscription_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_backlot_subscription_status_check
  CHECK (backlot_subscription_status IS NULL OR backlot_subscription_status IN (
    'active', 'canceled', 'past_due', 'trialing', 'unpaid', 'paused'
  ));

-- Comment for documentation
COMMENT ON COLUMN profiles.backlot_subscription_status IS 'Stripe subscription status for Backlot Pro tier';
COMMENT ON COLUMN profiles.backlot_subscription_period_end IS 'When the current backlot subscription period ends';
COMMENT ON COLUMN profiles.backlot_subscription_id IS 'Stripe subscription ID for backlot';
