-- Migration 210: Deal Memo PDF Generation + In-App Signing with E2EE
-- Adds deal memo templates, PDF signing fields, and E2EE document encryption tables

-- =============================================================================
-- Deal Memo Templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_deal_memo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    name TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('crew', 'talent')),
    html_template TEXT,
    css_template TEXT,
    field_schema JSONB DEFAULT '{}',
    is_system_template BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_memo_templates_org ON backlot_deal_memo_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_memo_templates_type ON backlot_deal_memo_templates(template_type);

-- =============================================================================
-- Alter backlot_deal_memos for PDF signing
-- =============================================================================

ALTER TABLE backlot_deal_memos
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES backlot_deal_memo_templates(id),
    ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'crew' CHECK (template_type IN ('crew', 'talent')),
    ADD COLUMN IF NOT EXISTS pdf_s3_key TEXT,
    ADD COLUMN IF NOT EXISTS signed_pdf_s3_key TEXT,
    ADD COLUMN IF NOT EXISTS signature_request_token TEXT,
    ADD COLUMN IF NOT EXISTS signing_ip TEXT,
    ADD COLUMN IF NOT EXISTS signing_user_agent TEXT,
    ADD COLUMN IF NOT EXISTS signature_type TEXT CHECK (signature_type IN ('draw', 'type', 'saved')),
    ADD COLUMN IF NOT EXISTS signature_data TEXT,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS performer_category TEXT,
    ADD COLUMN IF NOT EXISTS usage_rights JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS signer_name TEXT,
    ADD COLUMN IF NOT EXISTS signer_email TEXT,
    ADD COLUMN IF NOT EXISTS email_message TEXT;

-- Unique index on signing token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_memos_signature_token
    ON backlot_deal_memos(signature_request_token)
    WHERE signature_request_token IS NOT NULL;

-- =============================================================================
-- E2EE Document Keys (key envelopes for document recipients)
-- =============================================================================

CREATE TABLE IF NOT EXISTS e2ee_document_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL CHECK (document_type IN ('deal_memo', 'clearance', 'onboarding_field')),
    document_id UUID NOT NULL,
    recipient_user_id UUID NOT NULL,
    encrypted_document_key TEXT NOT NULL,  -- base64 encoded
    nonce TEXT NOT NULL,  -- base64 encoded
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_type, document_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_doc_keys_document ON e2ee_document_keys(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_e2ee_doc_keys_recipient ON e2ee_document_keys(recipient_user_id);

-- =============================================================================
-- E2EE Encrypted Fields (per-field encryption for sensitive data)
-- =============================================================================

CREATE TABLE IF NOT EXISTS e2ee_encrypted_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL CHECK (document_type IN ('deal_memo', 'clearance', 'onboarding_field')),
    document_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,  -- base64 encoded
    nonce TEXT NOT NULL,  -- base64 encoded
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_type, document_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_fields_document ON e2ee_encrypted_fields(document_type, document_id);

-- =============================================================================
-- Seed System Templates
-- =============================================================================

INSERT INTO backlot_deal_memo_templates (name, template_type, is_system_template, field_schema)
VALUES
    ('Crew Deal Memo', 'crew', TRUE, '{
        "sections": [
            {"name": "parties", "label": "Parties"},
            {"name": "position", "label": "Position & Department"},
            {"name": "compensation", "label": "Compensation"},
            {"name": "allowances", "label": "Allowances"},
            {"name": "dates", "label": "Dates"},
            {"name": "terms", "label": "Additional Terms"},
            {"name": "signatures", "label": "Signatures"}
        ]
    }'),
    ('Talent Deal Memo', 'talent', TRUE, '{
        "sections": [
            {"name": "parties", "label": "Parties"},
            {"name": "role", "label": "Role & Character"},
            {"name": "compensation", "label": "Compensation"},
            {"name": "performer_category", "label": "Performer Category"},
            {"name": "usage_rights", "label": "Usage Rights & Residuals"},
            {"name": "allowances", "label": "Allowances"},
            {"name": "dates", "label": "Dates"},
            {"name": "terms", "label": "Additional Terms"},
            {"name": "signatures", "label": "Signatures"}
        ]
    }')
ON CONFLICT DO NOTHING;
