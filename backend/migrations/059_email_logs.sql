-- Migration 059: Email Logs for AWS SES Event Tracking
-- Created: 2024-12-29
-- Purpose: Track all emails sent through AWS SES including delivery status, bounces, complaints, opens, and clicks

-- =====================================================
-- EMAIL LOGS TABLE
-- Stores all email events from AWS SES
-- =====================================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Message Identification
    message_id TEXT UNIQUE NOT NULL,  -- SES Message ID

    -- Email Details
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    email_type TEXT,  -- 'welcome', 'call_sheet', 'clearance', 'password_reset', 'verification', 'notification', etc.

    -- Status Tracking
    status TEXT DEFAULT 'sent' CHECK (status IN (
        'queued', 'sent', 'delivered', 'bounced',
        'complained', 'rejected', 'rendering_failure', 'opened', 'clicked'
    )),

    -- Bounce Details
    bounce_type TEXT,  -- 'Permanent', 'Transient', 'Undetermined'
    bounce_subtype TEXT,  -- 'General', 'NoEmail', 'Suppressed', 'OnAccountSuppressionList', etc.
    bounce_diagnostic TEXT,

    -- Complaint Details
    complaint_feedback_type TEXT,  -- 'abuse', 'auth-failure', 'fraud', 'not-spam', 'other', 'virus'
    complaint_sub_type TEXT,

    -- Engagement Tracking
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    first_opened_at TIMESTAMPTZ,
    last_opened_at TIMESTAMPTZ,
    first_clicked_at TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,

    -- Link Click Tracking (stores array of clicked links with timestamps)
    clicked_links JSONB DEFAULT '[]',

    -- User Agent / Device Info (from opens/clicks)
    user_agent TEXT,
    ip_address TEXT,

    -- Source Tracking - where the email originated
    source_service TEXT,  -- 'app', 'cognito', 'backlot', 'admin'
    source_action TEXT,   -- 'user_creation', 'password_reset', 'call_sheet_send', 'clearance_send', etc.
    source_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- User who triggered the email (if applicable)
    source_reference_id TEXT,  -- Reference to related entity (project_id, call_sheet_id, etc.)

    -- AWS SES Metadata
    ses_configuration_set TEXT,
    ses_source_ip TEXT,
    ses_sending_account_id TEXT,

    -- Raw Event Data (for debugging)
    raw_event_data JSONB DEFAULT '{}',

    -- Timestamps
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    complained_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_sender ON email_logs(sender_email);

-- Status and type filtering
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Source tracking
CREATE INDEX IF NOT EXISTS idx_email_logs_source ON email_logs(source_service, source_action);
CREATE INDEX IF NOT EXISTS idx_email_logs_source_user ON email_logs(source_user_id);

-- Composite index for common admin queries (status + date)
CREATE INDEX IF NOT EXISTS idx_email_logs_status_date ON email_logs(status, created_at DESC);

-- Bounce tracking (for deliverability monitoring)
CREATE INDEX IF NOT EXISTS idx_email_logs_bounces ON email_logs(bounce_type, bounced_at DESC) WHERE status = 'bounced';

-- Complaint tracking
CREATE INDEX IF NOT EXISTS idx_email_logs_complaints ON email_logs(complaint_feedback_type, complained_at DESC) WHERE status = 'complained';

-- =====================================================
-- TRIGGER: Auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_logs_updated_at ON email_logs;
CREATE TRIGGER trigger_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_email_logs_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE email_logs IS 'Tracks all emails sent through AWS SES with delivery status, bounces, complaints, and engagement metrics';
COMMENT ON COLUMN email_logs.message_id IS 'Unique AWS SES Message ID';
COMMENT ON COLUMN email_logs.status IS 'Current delivery status of the email';
COMMENT ON COLUMN email_logs.bounce_type IS 'Permanent bounces should trigger suppression; Transient may be retried';
COMMENT ON COLUMN email_logs.source_service IS 'Service that sent the email (app, cognito, backlot, admin)';
COMMENT ON COLUMN email_logs.clicked_links IS 'JSON array of {link, timestamp} objects for click tracking';
