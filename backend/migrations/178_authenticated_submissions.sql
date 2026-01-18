-- Migration 178: Authenticated Submissions System
-- Adds professional profile fields, activity logging, and status change notifications

-- ============================================================================
-- 1. Add professional profile fields to submissions table
-- ============================================================================

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitter_role VARCHAR(100);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Add same fields to greenroom_projects table
-- ============================================================================

ALTER TABLE greenroom_projects ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE greenroom_projects ADD COLUMN IF NOT EXISTS submitter_role VARCHAR(100);
ALTER TABLE greenroom_projects ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE greenroom_projects ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- ============================================================================
-- 3. Ensure proper indexes exist for submissions
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

-- ============================================================================
-- 4. User activity tracking table (for admin visibility)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity_log(activity_type);

-- ============================================================================
-- 5. Notification trigger for submission status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_submission_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create notification if status changed and user_id is set
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, body, type, related_id, payload)
        VALUES (
            NEW.user_id,
            'Submission Status Updated',
            'Your submission "' || NEW.project_title || '" status changed to ' || NEW.status,
            'submission_update',
            NEW.id,
            jsonb_build_object(
                'submission_id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'project_title', NEW.project_title
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS submission_status_change_trigger ON submissions;
CREATE TRIGGER submission_status_change_trigger
    AFTER UPDATE OF status ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION notify_submission_status_change();

-- ============================================================================
-- 6. Add function to log user activity
-- ============================================================================

CREATE OR REPLACE FUNCTION log_user_activity(
    p_user_id UUID,
    p_activity_type VARCHAR(50),
    p_activity_details JSONB DEFAULT '{}',
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO user_activity_log (user_id, activity_type, activity_details, ip_address, user_agent)
    VALUES (p_user_id, p_activity_type, p_activity_details, p_ip_address, p_user_agent)
    RETURNING id INTO v_activity_id;

    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Add trigger for submission creation activity logging
-- ============================================================================

CREATE OR REPLACE FUNCTION log_submission_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
        -- Log submission creation
        PERFORM log_user_activity(
            NEW.user_id,
            'submission_created',
            jsonb_build_object(
                'submission_id', NEW.id,
                'project_title', NEW.project_title,
                'project_type', NEW.project_type
            )
        );
    ELSIF TG_OP = 'UPDATE' AND NEW.user_id IS NOT NULL THEN
        -- Log submission update (only if meaningful fields changed)
        IF NEW.project_title IS DISTINCT FROM OLD.project_title
           OR NEW.description IS DISTINCT FROM OLD.description
           OR NEW.youtube_link IS DISTINCT FROM OLD.youtube_link THEN
            PERFORM log_user_activity(
                NEW.user_id,
                'submission_updated',
                jsonb_build_object(
                    'submission_id', NEW.id,
                    'project_title', NEW.project_title
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submission_activity_trigger ON submissions;
CREATE TRIGGER submission_activity_trigger
    AFTER INSERT OR UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION log_submission_activity();

-- ============================================================================
-- Done
-- ============================================================================
