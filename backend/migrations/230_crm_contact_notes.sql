-- Threaded notes system for CRM contacts
-- Each note belongs to a contact, has an author, and can be a reply to another note

CREATE TABLE IF NOT EXISTS crm_contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    parent_id UUID REFERENCES crm_contact_notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_contact ON crm_contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_parent ON crm_contact_notes(parent_id);
