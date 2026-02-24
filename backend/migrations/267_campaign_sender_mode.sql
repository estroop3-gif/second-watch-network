-- Migration 267: Add sender_mode to campaigns
-- Modes: rotate_all (all active accounts), single (one account), select (manual selection - current behavior)

ALTER TABLE crm_email_campaigns ADD COLUMN IF NOT EXISTS sender_mode TEXT NOT NULL DEFAULT 'select'
  CHECK (sender_mode IN ('rotate_all', 'single', 'select'));
