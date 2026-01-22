-- Migration 192: Messaging System Improvements - Phase 1
-- Create system message templates table for applicant quick replies

-- System-defined message templates (read-only for users)
CREATE TABLE IF NOT EXISTS message_templates_system (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    context_type VARCHAR(50),  -- 'applicant', 'project', 'general', etc.
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_templates_system_category ON message_templates_system(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_system_context ON message_templates_system(context_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_system_active ON message_templates_system(is_active);

-- Seed applicant quick reply templates
INSERT INTO message_templates_system (name, slug, category, body, variables, context_type, sort_order)
VALUES
(
    'Interview Request',
    'interview_request',
    'applicant',
    'Hi {{name}},

Thanks for applying for the {{role}} position. I''d love to schedule a quick call to discuss the project and your experience. What times work for you this week?',
    '["name", "role"]',
    'applicant',
    1
),
(
    'Express Interest',
    'express_interest',
    'applicant',
    'Hi {{name}},

Thanks for your application! Your experience looks great. I''m still reviewing candidates but wanted to let you know you''re in consideration for {{role}}.

I''ll be in touch soon!',
    '["name", "role"]',
    'applicant',
    2
),
(
    'Request Materials',
    'request_materials',
    'applicant',
    'Hi {{name}},

Thanks for applying for {{role}}! Could you send over your reel/portfolio? Looking forward to seeing more of your work.',
    '["name", "role"]',
    'applicant',
    3
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    body = EXCLUDED.body,
    variables = EXCLUDED.variables,
    context_type = EXCLUDED.context_type,
    sort_order = EXCLUDED.sort_order;
