-- Migration 240: CRM Calendar Events (parsed from ICS email invites)

CREATE TABLE IF NOT EXISTS crm_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES crm_email_messages(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES crm_email_accounts(id),
    rep_id UUID NOT NULL REFERENCES profiles(id),
    activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    meet_link TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT FALSE,
    organizer_email TEXT,
    organizer_name TEXT,
    uid TEXT,
    status TEXT DEFAULT 'pending',  -- pending, accepted, declined
    raw_ics TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_account ON crm_calendar_events(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_rep ON crm_calendar_events(rep_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON crm_calendar_events(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_uid_account ON crm_calendar_events(uid, account_id) WHERE uid IS NOT NULL;
