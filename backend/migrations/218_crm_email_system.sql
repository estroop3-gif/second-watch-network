-- Migration 218: CRM Email System
-- Rep email accounts, threads, messages, and attachments for the CRM inbox

-- Rep email accounts
CREATE TABLE IF NOT EXISTS crm_email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    email_address TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    signature_html TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email threads (conversations)
CREATE TABLE IF NOT EXISTS crm_email_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES crm_email_accounts(id),
    contact_id UUID REFERENCES crm_contacts(id),
    contact_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual email messages
CREATE TABLE IF NOT EXISTS crm_email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES crm_email_threads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_address TEXT NOT NULL,
    to_addresses TEXT[] NOT NULL,
    cc_addresses TEXT[],
    subject TEXT,
    body_html TEXT,
    body_text TEXT,
    resend_message_id TEXT,
    resend_received_id TEXT,
    status TEXT DEFAULT 'sent',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email attachments
CREATE TABLE IF NOT EXISTS crm_email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES crm_email_messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INT,
    s3_key TEXT,
    resend_attachment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_account ON crm_email_threads(account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_contact ON crm_email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_messages_thread ON crm_email_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_email_accounts_profile ON crm_email_accounts(profile_id);
