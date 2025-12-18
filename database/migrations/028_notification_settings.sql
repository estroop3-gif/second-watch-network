-- Second Watch Network - User Notification Settings Migration
-- Stores user email notification preferences

-- ============================================================================
-- USER NOTIFICATION SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email_digest_enabled BOOLEAN DEFAULT false,
    email_on_submission_updates BOOLEAN DEFAULT true,
    email_on_connection_accepts BOOLEAN DEFAULT true,
    digest_hour_utc INTEGER DEFAULT 13 CHECK (digest_hour_utc >= 0 AND digest_hour_utc <= 23),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id ON user_notification_settings(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_notification_settings_updated_at BEFORE UPDATE ON user_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
