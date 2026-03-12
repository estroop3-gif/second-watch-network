-- Migration 277: Collab integrity fixes
-- Fix #4: Enforce max_applications cap at DB level (prevents race conditions)
-- Fix #6: Add updated_at trigger to collab_application_messages

-- ============================================================
-- FIX #4: max_applications enforcement trigger
-- ============================================================

CREATE OR REPLACE FUNCTION check_collab_application_cap()
RETURNS TRIGGER AS $$
DECLARE
    v_max_applications INT;
    v_current_count INT;
BEGIN
    -- Fetch the cap for this collab
    SELECT max_applications
    INTO v_max_applications
    FROM community_collabs
    WHERE id = NEW.collab_id;

    -- NULL means no cap — allow through
    IF v_max_applications IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count active (non-withdrawn) applications
    SELECT COUNT(*)
    INTO v_current_count
    FROM community_collab_applications
    WHERE collab_id = NEW.collab_id
      AND status != 'withdrawn';

    IF v_current_count >= v_max_applications THEN
        RAISE EXCEPTION 'This opportunity has reached its application limit of % applications.', v_max_applications
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_collab_application_cap ON community_collab_applications;
CREATE TRIGGER enforce_collab_application_cap
    BEFORE INSERT ON community_collab_applications
    FOR EACH ROW
    EXECUTE FUNCTION check_collab_application_cap();

-- ============================================================
-- FIX #6: updated_at auto-update trigger for messages
-- ============================================================

CREATE OR REPLACE FUNCTION update_collab_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collab_message_updated_at ON collab_application_messages;
CREATE TRIGGER trg_collab_message_updated_at
    BEFORE UPDATE ON collab_application_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_collab_message_updated_at();

-- Ensure the column exists (idempotent)
ALTER TABLE collab_application_messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
