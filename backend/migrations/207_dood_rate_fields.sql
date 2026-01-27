-- DOOD Rate Fields and Profile Default Rate
-- Enables rate lookup fallback from DOOD subjects and user profiles

-- Add rate fields to dood_subjects for storing pay rates
ALTER TABLE dood_subjects
    ADD COLUMN IF NOT EXISTS rate_type TEXT CHECK (rate_type IN ('hourly', 'daily', 'weekly', 'flat')),
    ADD COLUMN IF NOT EXISTS rate_amount DECIMAL(12,2);

-- Add source tracking columns if not already present
ALTER TABLE dood_subjects
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_id UUID;

-- Add sync tracking
ALTER TABLE dood_subjects
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add default rate fields to profiles for fallback rate lookup
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS default_rate_type TEXT DEFAULT 'hourly' CHECK (default_rate_type IN ('hourly', 'daily', 'weekly', 'flat'));

-- Index for faster rate lookups on dood_subjects
CREATE INDEX IF NOT EXISTS idx_dood_subjects_source ON dood_subjects(source_type, source_id);

-- Comments for documentation
COMMENT ON COLUMN dood_subjects.rate_type IS 'Rate type: hourly, daily, weekly, or flat';
COMMENT ON COLUMN dood_subjects.rate_amount IS 'Pay rate amount for this subject';
COMMENT ON COLUMN dood_subjects.source_type IS 'Source table: cast_member, crew_member, contact, team_member';
COMMENT ON COLUMN dood_subjects.source_id IS 'ID from the source table';
COMMENT ON COLUMN dood_subjects.last_synced_at IS 'Timestamp of last sync from source data';
COMMENT ON COLUMN profiles.default_hourly_rate IS 'User default pay rate for fallback in Hot Set';
COMMENT ON COLUMN profiles.default_rate_type IS 'Rate type for user default rate';
