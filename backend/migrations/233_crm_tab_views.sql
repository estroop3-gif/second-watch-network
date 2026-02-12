-- Migration 233: CRM Tab View Tracking
-- Tracks when each user last viewed a CRM sidebar tab so badges show only new activity.

CREATE TABLE IF NOT EXISTS crm_tab_views (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tab_key TEXT NOT NULL,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_tab_views_profile ON crm_tab_views(profile_id);
