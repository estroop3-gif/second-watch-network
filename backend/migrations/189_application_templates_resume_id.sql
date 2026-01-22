-- Add missing default_resume_id column to application_templates table
-- This column was defined in migration 186 but may not have been applied if the table already existed

ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS default_resume_id UUID;
