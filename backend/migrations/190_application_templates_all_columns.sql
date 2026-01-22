-- Ensure all columns exist in application_templates table
-- These columns were defined in migration 186 but may not have been added if table already existed

ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS rate_expectation VARCHAR(255);
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS default_reel_url TEXT;
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS default_headshot_url TEXT;
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS default_resume_url TEXT;
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS default_credit_ids UUID[] DEFAULT '{}';
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0;
ALTER TABLE application_templates ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
