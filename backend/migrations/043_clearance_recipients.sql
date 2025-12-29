-- Migration: 043_clearance_recipients.sql
-- Description: Add clearance recipients and email send tracking tables
-- Date: 2025-12-28

-- ============================================================================
-- 1. CLEARANCE RECIPIENTS TABLE
-- Allows multiple recipients per clearance (contacts, team members, or manual)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_clearance_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES backlot_clearance_items(id) ON DELETE CASCADE,

    -- Recipient identification (one of these should be set)
    project_contact_id UUID REFERENCES backlot_project_contacts(id) ON DELETE SET NULL,
    project_member_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    manual_email VARCHAR(255),
    manual_name VARCHAR(255),

    -- Signing workflow
    requires_signature BOOLEAN DEFAULT false,
    signature_status VARCHAR(30) DEFAULT 'not_required'
        CHECK (signature_status IN ('not_required', 'pending', 'viewed', 'signed', 'declined')),
    signed_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    signature_data TEXT,  -- Base64 encoded signature image
    signature_ip VARCHAR(45),

    -- Send tracking
    last_email_sent_at TIMESTAMPTZ,
    email_send_count INTEGER DEFAULT 0,
    last_email_type VARCHAR(30) CHECK (last_email_type IN ('link', 'pdf_attachment')),

    -- Access token for external viewing without login
    access_token VARCHAR(255) UNIQUE,
    access_token_expires_at TIMESTAMPTZ,

    -- Audit
    added_by_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clearance_recipients_clearance ON backlot_clearance_recipients(clearance_id);
CREATE INDEX IF NOT EXISTS idx_clearance_recipients_contact ON backlot_clearance_recipients(project_contact_id) WHERE project_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clearance_recipients_member ON backlot_clearance_recipients(project_member_user_id) WHERE project_member_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clearance_recipients_token ON backlot_clearance_recipients(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clearance_recipients_status ON backlot_clearance_recipients(signature_status) WHERE signature_status != 'not_required';

-- Prevent duplicate recipients per clearance
-- Uses COALESCE to handle NULLs in the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_clearance_recipients_unique
ON backlot_clearance_recipients (
    clearance_id,
    COALESCE(project_contact_id::text, ''),
    COALESCE(project_member_user_id::text, ''),
    COALESCE(manual_email, '')
);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clearance_recipient_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clearance_recipient_updated_at ON backlot_clearance_recipients;
CREATE TRIGGER trigger_clearance_recipient_updated_at
    BEFORE UPDATE ON backlot_clearance_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_clearance_recipient_updated_at();

-- ============================================================================
-- 2. CLEARANCE SEND HISTORY TABLE
-- Logs all email sends for audit and tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_clearance_send_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES backlot_clearance_items(id) ON DELETE CASCADE,
    sent_by_user_id UUID REFERENCES profiles(id),
    sent_by_name VARCHAR(255),

    -- Send details
    send_type VARCHAR(30) NOT NULL CHECK (send_type IN ('link', 'pdf_attachment')),
    recipient_ids UUID[] NOT NULL,
    email_addresses TEXT[] NOT NULL,
    subject VARCHAR(500),
    message TEXT,

    -- Results
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    error_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clearance_send_history_clearance ON backlot_clearance_send_history(clearance_id);
CREATE INDEX IF NOT EXISTS idx_clearance_send_history_sent_by ON backlot_clearance_send_history(sent_by_user_id);
CREATE INDEX IF NOT EXISTS idx_clearance_send_history_created ON backlot_clearance_send_history(created_at DESC);

-- ============================================================================
-- 3. SUMMARY VIEW FOR RECIPIENT STATUS
-- Provides quick aggregate stats per clearance
-- ============================================================================
CREATE OR REPLACE VIEW clearance_recipient_summary AS
SELECT
    cr.clearance_id,
    COUNT(*) as total_recipients,
    COUNT(*) FILTER (WHERE cr.requires_signature = true) as requires_signature_count,
    COUNT(*) FILTER (WHERE cr.signature_status = 'signed') as signed_count,
    COUNT(*) FILTER (WHERE cr.signature_status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE cr.signature_status = 'viewed') as viewed_count,
    COUNT(*) FILTER (WHERE cr.signature_status = 'declined') as declined_count,
    COUNT(*) FILTER (WHERE cr.last_email_sent_at IS NOT NULL) as sent_count,
    MAX(cr.last_email_sent_at) as last_sent_at
FROM backlot_clearance_recipients cr
GROUP BY cr.clearance_id;

-- ============================================================================
-- 4. GRANT PERMISSIONS (if using RLS)
-- ============================================================================
-- Note: Adjust these based on your RLS policy requirements
-- ALTER TABLE backlot_clearance_recipients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE backlot_clearance_send_history ENABLE ROW LEVEL SECURITY;
