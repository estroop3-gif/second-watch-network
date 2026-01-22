-- Cover Letter Templates table for users to save and reuse cover letters
CREATE TABLE IF NOT EXISTS cover_letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_cover_letter_templates_user_id ON cover_letter_templates(user_id);

-- Index for default template lookup
CREATE INDEX IF NOT EXISTS idx_cover_letter_templates_default ON cover_letter_templates(user_id, is_default) WHERE is_default = true;

-- Ensure only one default template per user (using a partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cover_letter_templates_unique_default
ON cover_letter_templates(user_id) WHERE is_default = true;
