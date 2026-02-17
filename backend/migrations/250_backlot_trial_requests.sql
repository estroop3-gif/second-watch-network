-- Backlot Free Trial lead capture staging table
CREATE TABLE IF NOT EXISTS backlot_trial_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    consent_contact BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    notes TEXT,                               -- admin notes
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    converted_contact_id UUID REFERENCES crm_contacts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_trial_requests_status ON backlot_trial_requests(status);
CREATE INDEX IF NOT EXISTS idx_backlot_trial_requests_email ON backlot_trial_requests(email);
