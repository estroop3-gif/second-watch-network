-- Migration 216: CRM Email Campaigns & Send Tracking
-- Campaign management with targeting and delivery tracking

-- ============================================================================
-- Table: crm_email_campaigns
-- Email campaigns with templates and targeting
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Campaign info
    name TEXT NOT NULL,
    description TEXT,

    -- Email template
    subject_template TEXT NOT NULL,
    html_template TEXT,
    text_template TEXT,

    -- Targeting
    target_temperature TEXT[] DEFAULT '{}',
    target_tags TEXT[] DEFAULT '{}',

    -- Schedule
    send_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (send_type IN ('manual', 'scheduled', 'drip')),
    scheduled_at TIMESTAMPTZ,
    drip_delay_days INTEGER,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),

    -- Stats (updated as emails are sent/tracked)
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,
    total_unsubscribed INTEGER DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_email_campaigns_status ON crm_email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_email_campaigns_created ON crm_email_campaigns(created_at DESC);

-- ============================================================================
-- Table: crm_email_sends
-- Individual email sends within a campaign
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES crm_email_campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,

    -- Tracking
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_email_sends_campaign ON crm_email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_sends_contact ON crm_email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_sends_status ON crm_email_sends(status);
