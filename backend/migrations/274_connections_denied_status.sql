-- Migration: 274_connections_denied_status.sql
-- Add 'denied' as a valid status for connections (was missing from original constraint)
-- Schema previously only allowed: pending, accepted, blocked
-- Code throughout uses 'denied' for declining a connection request

ALTER TABLE connections
    DROP CONSTRAINT IF EXISTS connections_status_check;

ALTER TABLE connections
    ADD CONSTRAINT connections_status_check
    CHECK (status IN ('pending', 'accepted', 'denied', 'blocked'));
