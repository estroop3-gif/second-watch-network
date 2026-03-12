-- Migration: 275_connections_indexes.sql
-- 1. Canonical pair unique index: prevents A→B and B→A from coexisting
--    (bidirectional duplicate prevention beyond the existing UNIQUE(requester_id, recipient_id))
-- 2. Composite covering index for the bidirectional lookup pattern used in relationship queries

-- Remove any existing canonical pair index before recreating
DROP INDEX IF EXISTS idx_connections_canonical_pair;

CREATE UNIQUE INDEX idx_connections_canonical_pair ON connections (
    LEAST(requester_id::text, recipient_id::text),
    GREATEST(requester_id::text, recipient_id::text)
);

-- Composite covering index for the bidirectional WHERE clause:
-- WHERE (requester_id = A AND recipient_id = B) OR (requester_id = B AND recipient_id = A)
-- This pair of indexes lets Postgres satisfy each OR branch with an index scan and merge them.
DROP INDEX IF EXISTS idx_connections_requester_recipient;
DROP INDEX IF EXISTS idx_connections_recipient_requester;

CREATE INDEX IF NOT EXISTS idx_connections_requester_recipient
    ON connections (requester_id, recipient_id);

CREATE INDEX IF NOT EXISTS idx_connections_recipient_requester
    ON connections (recipient_id, requester_id);
