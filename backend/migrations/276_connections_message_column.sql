-- Migration: 276_connections_message_column.sql
-- Add optional message to connection requests
-- (schema had this field but the DB column was never created)

ALTER TABLE connections
    ADD COLUMN IF NOT EXISTS message TEXT;
