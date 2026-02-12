-- Migration 231: Add follow_up_completed to crm_activities
-- The sidebar-badges query references this column for calendar badge counts

ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS follow_up_completed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_crm_activities_follow_up_pending
    ON crm_activities(follow_up_date, rep_id)
    WHERE follow_up_date IS NOT NULL AND follow_up_completed = false;
