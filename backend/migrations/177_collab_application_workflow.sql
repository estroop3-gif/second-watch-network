-- Migration 177: Collab Application Workflow
-- Adds messaging, booking workflow, and audit trail for community collab applications
--
-- Features:
-- 1. Application messages (conversation between applicant and collab owner)
-- 2. Status history for audit trail
-- 3. Booking fields (rate, dates, team integration)
-- 4. Scheduling fields (interview/callback dates)

BEGIN;

-- =====================================================
-- PART 1: Application Messages
-- =====================================================

-- Messages between applicant and collab owner
CREATE TABLE IF NOT EXISTS collab_application_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES community_collab_applications(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    attachments JSONB,  -- For future file attachments [{name, url, type, size}]
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_collab_app_messages_application ON collab_application_messages(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_app_messages_sender ON collab_application_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_collab_app_messages_unread ON collab_application_messages(application_id, is_read) WHERE is_read = false;

-- Add last_message_at to applications for sorting conversations
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_collab_apps_last_message ON community_collab_applications(last_message_at DESC NULLS LAST);

-- Trigger to update last_message_at when a message is sent
CREATE OR REPLACE FUNCTION update_application_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE community_collab_applications
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.application_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_application_last_message ON collab_application_messages;
CREATE TRIGGER trg_update_application_last_message
    AFTER INSERT ON collab_application_messages
    FOR EACH ROW EXECUTE FUNCTION update_application_last_message();

-- =====================================================
-- PART 2: Status History (Audit Trail)
-- =====================================================

-- Track all status changes for full audit trail
CREATE TABLE IF NOT EXISTS collab_application_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES community_collab_applications(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by_user_id UUID REFERENCES profiles(id),
    reason TEXT,
    metadata JSONB,  -- For booking details, scheduling info, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_collab_app_status_history_application ON collab_application_status_history(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_app_status_history_status ON collab_application_status_history(new_status);

-- Trigger to record status changes automatically
CREATE OR REPLACE FUNCTION record_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO collab_application_status_history (
            application_id,
            old_status,
            new_status,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            jsonb_build_object('auto_recorded', true)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_application_status_change ON community_collab_applications;
CREATE TRIGGER trg_record_application_status_change
    AFTER UPDATE ON community_collab_applications
    FOR EACH ROW EXECUTE FUNCTION record_application_status_change();

-- =====================================================
-- PART 3: Scheduling Fields
-- =====================================================

-- Add scheduling columns to applications
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS interview_notes TEXT,
ADD COLUMN IF NOT EXISTS callback_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS callback_notes TEXT;

-- =====================================================
-- PART 4: Booking Fields
-- =====================================================

-- Add booking columns to applications
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booked_by_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS booking_rate TEXT,
ADD COLUMN IF NOT EXISTS booking_start_date DATE,
ADD COLUMN IF NOT EXISTS booking_end_date DATE,
ADD COLUMN IF NOT EXISTS booking_notes TEXT,
ADD COLUMN IF NOT EXISTS booking_schedule_notes TEXT,
ADD COLUMN IF NOT EXISTS project_role_id UUID REFERENCES backlot_project_roles(id) ON DELETE SET NULL;

-- Unbooking fields (for audit trail when reversing a booking)
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS unbooked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unbooked_by_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS unbook_reason TEXT;

-- Document package request fields
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS document_package_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS document_package_id UUID;  -- References document_packages if using that system

-- Indexes for booking queries
CREATE INDEX IF NOT EXISTS idx_collab_apps_booked ON community_collab_applications(booked_at) WHERE booked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_apps_project_role ON community_collab_applications(project_role_id) WHERE project_role_id IS NOT NULL;

-- =====================================================
-- PART 5: Cast-Specific Booking Fields
-- =====================================================

-- For cast bookings, we may assign to a character and billing position
ALTER TABLE community_collab_applications
ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES backlot_story_characters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billing_position INTEGER,  -- 1 = top billing, 2 = second, etc.
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(30);  -- 'sag', 'non_union', 'sag_new_media', etc.

-- =====================================================
-- PART 6: Add source_application_id to backlot_project_roles
-- =====================================================

-- Link project roles back to their source application (for traceability)
ALTER TABLE backlot_project_roles
ADD COLUMN IF NOT EXISTS source_collab_application_id UUID REFERENCES community_collab_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_roles_source_app ON backlot_project_roles(source_collab_application_id) WHERE source_collab_application_id IS NOT NULL;

-- =====================================================
-- PART 7: Comments for Documentation
-- =====================================================

COMMENT ON TABLE collab_application_messages IS 'Messages between applicant and collab owner for a specific application';
COMMENT ON COLUMN collab_application_messages.attachments IS 'JSON array of file attachments: [{name, url, type, size}]';

COMMENT ON TABLE collab_application_status_history IS 'Audit trail of all status changes for an application';
COMMENT ON COLUMN collab_application_status_history.metadata IS 'Additional context: booking details, scheduling info, etc.';

COMMENT ON COLUMN community_collab_applications.last_message_at IS 'Timestamp of most recent message for conversation sorting';
COMMENT ON COLUMN community_collab_applications.interview_scheduled_at IS 'Scheduled interview/meeting time';
COMMENT ON COLUMN community_collab_applications.callback_scheduled_at IS 'Scheduled callback time (for auditions)';
COMMENT ON COLUMN community_collab_applications.booked_at IS 'When the applicant was officially booked';
COMMENT ON COLUMN community_collab_applications.booked_by_user_id IS 'User who performed the booking';
COMMENT ON COLUMN community_collab_applications.booking_rate IS 'Agreed upon rate (e.g., "$500/day", "$2500/week")';
COMMENT ON COLUMN community_collab_applications.project_role_id IS 'Links to backlot_project_roles when booked for team integration';
COMMENT ON COLUMN community_collab_applications.unbooked_at IS 'When the booking was reversed (if applicable)';
COMMENT ON COLUMN community_collab_applications.unbook_reason IS 'Reason for unbooking';
COMMENT ON COLUMN community_collab_applications.character_id IS 'For cast bookings: assigned character';
COMMENT ON COLUMN community_collab_applications.billing_position IS 'For cast bookings: billing order (1=top)';
COMMENT ON COLUMN community_collab_applications.contract_type IS 'For cast bookings: sag, non_union, sag_new_media, etc.';

COMMENT ON COLUMN backlot_project_roles.source_collab_application_id IS 'Links role back to the application that created it';

COMMIT;
