-- Cast & Crew Tab Full Implementation Migration
-- Adds job postings, document signing, crew communication, and encryption tables

-- ============================================================================
-- 1. PROJECT INVITATIONS (Email-based invites)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_project_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    department VARCHAR(100),
    permission_level VARCHAR(50) DEFAULT 'member',
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by UUID REFERENCES profiles(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON backlot_project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON backlot_project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON backlot_project_invitations(project_id);

-- ============================================================================
-- 2. JOB POSTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    role_type VARCHAR(50), -- 'cast', 'crew', 'extra'
    description TEXT,
    requirements TEXT,
    compensation_type VARCHAR(50), -- 'paid', 'deferred', 'volunteer', 'negotiable'
    compensation_details TEXT,
    location VARCHAR(255),
    shoot_dates_start DATE,
    shoot_dates_end DATE,
    application_deadline DATE,
    accepts_tapes BOOLEAN DEFAULT false,
    tape_instructions TEXT,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'closed', 'filled'
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_project ON backlot_job_postings(project_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON backlot_job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_by ON backlot_job_postings(created_by);

-- Job Applications
CREATE TABLE IF NOT EXISTS backlot_job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id UUID REFERENCES backlot_job_postings(id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES profiles(id),
    cover_letter TEXT,
    resume_url TEXT,
    tape_url TEXT, -- External link (YouTube/Vimeo/Dropbox)
    tape_platform VARCHAR(50), -- 'youtube', 'vimeo', 'dropbox', 'other'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'
    notes TEXT, -- Internal notes from reviewer
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_applications_posting ON backlot_job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON backlot_job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON backlot_job_applications(status);

-- ============================================================================
-- 3. DOCUMENT TEMPLATES & SIGNING
-- ============================================================================

-- Document templates (deal memos, I-9, W-4, W-9, NDA, custom)
CREATE TABLE IF NOT EXISTS backlot_document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'deal_memo', 'i9', 'w4', 'w9', 'nda', 'emergency_contact', 'custom'
    content JSONB NOT NULL DEFAULT '{}', -- Form fields definition
    html_template TEXT, -- For PDF generation
    is_system_template BOOLEAN DEFAULT false,
    requires_encryption BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_project ON backlot_document_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON backlot_document_templates(document_type);

-- Signature requests sent to team members
CREATE TABLE IF NOT EXISTS backlot_signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    template_id UUID REFERENCES backlot_document_templates(id),
    recipient_id UUID REFERENCES profiles(id),
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(255),
    document_title VARCHAR(255) NOT NULL,
    prefilled_data JSONB DEFAULT '{}', -- Pre-filled form values
    message TEXT, -- Personal message from sender
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'viewed', 'signed', 'declined', 'expired'
    sent_by UUID REFERENCES profiles(id),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    viewed_at TIMESTAMP WITH TIME ZONE,
    signed_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_project ON backlot_signature_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_recipient ON backlot_signature_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON backlot_signature_requests(status);

-- Completed signed documents
CREATE TABLE IF NOT EXISTS backlot_signed_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES backlot_signature_requests(id) ON DELETE CASCADE,
    project_id UUID REFERENCES backlot_projects(id),
    signer_id UUID REFERENCES profiles(id),
    document_type VARCHAR(50) NOT NULL,
    form_data JSONB NOT NULL DEFAULT '{}', -- Completed form data
    form_data_encrypted BYTEA, -- Encrypted version for sensitive docs
    signature_data TEXT NOT NULL, -- Base64 signature image
    signature_ip VARCHAR(45),
    signature_user_agent TEXT,
    pdf_url TEXT, -- S3 URL to generated PDF
    pdf_url_encrypted TEXT, -- Encrypted PDF URL for sensitive docs
    encryption_key_id VARCHAR(255), -- Reference to encryption key
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signed_documents_project ON backlot_signed_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_signed_documents_signer ON backlot_signed_documents(signer_id);
CREATE INDEX IF NOT EXISTS idx_signed_documents_request ON backlot_signed_documents(request_id);

-- User's saved signatures
CREATE TABLE IF NOT EXISTS backlot_user_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    signature_data TEXT NOT NULL, -- Base64 signature image
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signatures_user ON backlot_user_signatures(user_id);

-- Custom uploaded documents for signature
CREATE TABLE IF NOT EXISTS backlot_custom_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES profiles(id),
    name VARCHAR(255) NOT NULL,
    original_file_url TEXT NOT NULL, -- S3 URL
    original_file_url_encrypted TEXT, -- Encrypted for sensitive docs
    file_type VARCHAR(50), -- 'pdf', 'docx'
    signature_positions JSONB, -- Where signatures should go
    requires_encryption BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_documents_project ON backlot_custom_documents(project_id);

-- ============================================================================
-- 4. CREW COMMUNICATION
-- ============================================================================

-- Project communication channels
CREATE TABLE IF NOT EXISTS backlot_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(20) DEFAULT 'general', -- 'general', 'department', 'announcement'
    department VARCHAR(100), -- For department-specific channels
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_project ON backlot_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON backlot_channels(channel_type);

-- Channel messages
CREATE TABLE IF NOT EXISTS backlot_channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES backlot_channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    content_encrypted BYTEA, -- For encrypted channels
    message_type VARCHAR(20) DEFAULT 'message', -- 'message', 'announcement', 'system'
    is_pinned BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON backlot_channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender ON backlot_channel_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created ON backlot_channel_messages(created_at);

-- Direct messages
CREATE TABLE IF NOT EXISTS backlot_direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    recipient_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    content_encrypted BYTEA,
    read_at TIMESTAMP WITH TIME ZONE,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_project ON backlot_direct_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON backlot_direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient ON backlot_direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created ON backlot_direct_messages(created_at);

-- Announcements with read receipts
CREATE TABLE IF NOT EXISTS backlot_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES backlot_channels(id),
    sender_id UUID REFERENCES profiles(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    requires_acknowledgment BOOLEAN DEFAULT false,
    target_departments TEXT[], -- Empty = all
    target_roles TEXT[],
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_project ON backlot_announcements(project_id);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON backlot_announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON backlot_announcements(published_at);

-- Announcement acknowledgments
CREATE TABLE IF NOT EXISTS backlot_announcement_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES backlot_announcements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_acknowledgments_announcement ON backlot_announcement_acknowledgments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_acknowledgments_user ON backlot_announcement_acknowledgments(user_id);

-- ============================================================================
-- 5. ENCRYPTION KEYS
-- ============================================================================
CREATE TABLE IF NOT EXISTS backlot_encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    kms_key_id VARCHAR(255) NOT NULL, -- AWS KMS key ARN
    key_type VARCHAR(50) DEFAULT 'document', -- 'document', 'communication'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rotated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_encryption_keys_project ON backlot_encryption_keys(project_id);

-- ============================================================================
-- 6. INSERT SYSTEM DOCUMENT TEMPLATES
-- ============================================================================
INSERT INTO backlot_document_templates (project_id, name, document_type, content, is_system_template, requires_encryption, created_at)
VALUES
    (NULL, 'Deal Memo', 'deal_memo', '{
        "sections": [
            {
                "title": "Production Information",
                "fields": [
                    {"name": "production_title", "label": "Production Title", "type": "text", "required": true},
                    {"name": "production_company", "label": "Production Company", "type": "text", "required": true}
                ]
            },
            {
                "title": "Employee Information",
                "fields": [
                    {"name": "employee_name", "label": "Full Legal Name", "type": "text", "required": true},
                    {"name": "position", "label": "Position/Role", "type": "text", "required": true},
                    {"name": "department", "label": "Department", "type": "text", "required": false}
                ]
            },
            {
                "title": "Compensation",
                "fields": [
                    {"name": "rate_type", "label": "Rate Type", "type": "select", "options": ["Daily", "Weekly", "Flat", "Hourly"], "required": true},
                    {"name": "rate_amount", "label": "Rate Amount", "type": "number", "required": true},
                    {"name": "overtime_rate", "label": "Overtime Rate (if applicable)", "type": "number", "required": false}
                ]
            },
            {
                "title": "Work Schedule",
                "fields": [
                    {"name": "start_date", "label": "Start Date", "type": "date", "required": true},
                    {"name": "end_date", "label": "End Date", "type": "date", "required": false},
                    {"name": "work_days", "label": "Expected Work Days", "type": "text", "required": false}
                ]
            },
            {
                "title": "Agreement",
                "fields": [
                    {"name": "terms_accepted", "label": "I agree to the terms above", "type": "checkbox", "required": true}
                ]
            }
        ]
    }'::jsonb, true, false, NOW()),

    (NULL, 'Emergency Contact Form', 'emergency_contact', '{
        "sections": [
            {
                "title": "Your Information",
                "fields": [
                    {"name": "employee_name", "label": "Your Full Name", "type": "text", "required": true}
                ]
            },
            {
                "title": "Primary Emergency Contact",
                "fields": [
                    {"name": "contact1_name", "label": "Contact Name", "type": "text", "required": true},
                    {"name": "contact1_relationship", "label": "Relationship", "type": "text", "required": true},
                    {"name": "contact1_phone", "label": "Phone Number", "type": "tel", "required": true},
                    {"name": "contact1_email", "label": "Email", "type": "email", "required": false}
                ]
            },
            {
                "title": "Secondary Emergency Contact",
                "fields": [
                    {"name": "contact2_name", "label": "Contact Name", "type": "text", "required": false},
                    {"name": "contact2_relationship", "label": "Relationship", "type": "text", "required": false},
                    {"name": "contact2_phone", "label": "Phone Number", "type": "tel", "required": false}
                ]
            },
            {
                "title": "Medical Information",
                "fields": [
                    {"name": "allergies", "label": "Known Allergies", "type": "textarea", "required": false},
                    {"name": "medical_conditions", "label": "Medical Conditions", "type": "textarea", "required": false},
                    {"name": "medications", "label": "Current Medications", "type": "textarea", "required": false}
                ]
            }
        ]
    }'::jsonb, true, false, NOW()),

    (NULL, 'Non-Disclosure Agreement (NDA)', 'nda', '{
        "sections": [
            {
                "title": "Parties",
                "fields": [
                    {"name": "disclosing_party", "label": "Disclosing Party (Production Company)", "type": "text", "required": true, "prefill": true},
                    {"name": "receiving_party", "label": "Receiving Party (Your Name)", "type": "text", "required": true}
                ]
            },
            {
                "title": "Project Information",
                "fields": [
                    {"name": "project_name", "label": "Project Name", "type": "text", "required": true, "prefill": true},
                    {"name": "project_description", "label": "Project Description", "type": "textarea", "required": false}
                ]
            },
            {
                "title": "Agreement Terms",
                "fields": [
                    {"name": "term_years", "label": "NDA Term (Years)", "type": "select", "options": ["1", "2", "3", "5", "Indefinite"], "required": true}
                ]
            },
            {
                "title": "Acknowledgment",
                "fields": [
                    {"name": "agree_confidential", "label": "I agree to keep all project information confidential", "type": "checkbox", "required": true},
                    {"name": "agree_no_disclosure", "label": "I agree not to disclose any project details to third parties", "type": "checkbox", "required": true},
                    {"name": "agree_return_materials", "label": "I agree to return all materials upon request or project completion", "type": "checkbox", "required": true}
                ]
            }
        ]
    }'::jsonb, true, false, NOW()),

    (NULL, 'W-9 Request for Taxpayer ID', 'w9', '{
        "sections": [
            {
                "title": "Taxpayer Information",
                "fields": [
                    {"name": "legal_name", "label": "Legal Name (as shown on tax return)", "type": "text", "required": true},
                    {"name": "business_name", "label": "Business Name (if different)", "type": "text", "required": false},
                    {"name": "tax_classification", "label": "Federal Tax Classification", "type": "select", "options": ["Individual/Sole Proprietor", "C Corporation", "S Corporation", "Partnership", "LLC", "Other"], "required": true}
                ]
            },
            {
                "title": "Address",
                "fields": [
                    {"name": "address", "label": "Street Address", "type": "text", "required": true},
                    {"name": "city", "label": "City", "type": "text", "required": true},
                    {"name": "state", "label": "State", "type": "text", "required": true},
                    {"name": "zip", "label": "ZIP Code", "type": "text", "required": true}
                ]
            },
            {
                "title": "Taxpayer Identification Number",
                "fields": [
                    {"name": "tin_type", "label": "TIN Type", "type": "select", "options": ["SSN", "EIN"], "required": true},
                    {"name": "tin", "label": "Taxpayer Identification Number", "type": "text", "required": true, "encrypted": true}
                ]
            },
            {
                "title": "Certification",
                "fields": [
                    {"name": "certify_correct", "label": "I certify that the information provided is correct", "type": "checkbox", "required": true},
                    {"name": "certify_exempt", "label": "I am exempt from backup withholding (if applicable)", "type": "checkbox", "required": false}
                ]
            }
        ]
    }'::jsonb, true, true, NOW())
ON CONFLICT DO NOTHING;
