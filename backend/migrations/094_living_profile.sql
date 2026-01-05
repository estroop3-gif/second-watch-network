-- Migration: 094_living_profile.sql
-- Living Profile feature: Profile status updates, availability, public info toggles

-- =========================================
-- PROFILE STATUS UPDATES (Synced with Feed)
-- =========================================

-- Add is_profile_update flag to community_posts
-- When true, the post appears on both the feed AND the user's profile Updates tab
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_profile_update BOOLEAN DEFAULT FALSE;

-- Create index for efficient profile update queries
CREATE INDEX IF NOT EXISTS idx_community_posts_profile_updates
    ON community_posts(user_id, created_at DESC)
    WHERE is_profile_update = TRUE AND is_hidden = FALSE;

-- =========================================
-- QUICK AVAILABILITY STATUS
-- =========================================

-- Add status_message to profiles for quick status display
-- (filmmaker_profiles already has status_message but it's not used)
-- This allows all users to set a quick status, not just filmmakers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- =========================================
-- PUBLIC PROFILE INFO TOGGLES
-- =========================================

-- Show Order/Lodge membership on public profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_order_membership BOOLEAN DEFAULT TRUE;

-- Featured credits flag
ALTER TABLE credits ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Index for featured credits
CREATE INDEX IF NOT EXISTS idx_credits_featured
    ON credits(user_id, is_featured)
    WHERE is_featured = TRUE;

-- =========================================
-- COMMENTS
-- =========================================

-- is_profile_update: When checked in the feed composer, the post appears
--                    on both the community feed AND the user's public profile
--                    Updates tab. This makes profiles feel more "alive".

-- status_message: A brief status message shown on the profile header
--                 e.g., "Currently shooting in Austin" or "Taking a break"

-- show_order_membership: Controls whether Order/Lodge info is shown
--                        on the public filmmaker profile

-- is_featured: Marks a credit as featured to display prominently
--              on the public profile's "Featured Work" section
