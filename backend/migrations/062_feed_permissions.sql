-- Migration: 062_feed_permissions.sql
-- Add community feed permissions to custom_roles table

-- Community Feed permissions
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS community_feed_view BOOLEAN DEFAULT false;
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS community_feed_post BOOLEAN DEFAULT false;
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS community_feed_comment BOOLEAN DEFAULT false;
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS community_feed_like BOOLEAN DEFAULT false;

-- Enable feed permissions for all existing roles by default
-- Admins can restrict specific roles via the admin panel
UPDATE custom_roles SET
    community_feed_view = true,
    community_feed_post = true,
    community_feed_comment = true,
    community_feed_like = true;
