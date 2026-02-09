-- Migration 212: CRM Foundation
-- Contacts, Activities, and Interaction Counts for Sales Team

-- ============================================================================
-- Table: crm_contacts
-- Core contact management for the CRM system
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Personal info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    phone_secondary TEXT,
    company TEXT,
    job_title TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT DEFAULT 'US',

    -- CRM fields
    temperature TEXT NOT NULL DEFAULT 'cold'
        CHECK (temperature IN ('cold', 'warm', 'hot')),
    source TEXT DEFAULT 'outbound'
        CHECK (source IN ('inbound', 'outbound', 'referral', 'event', 'website', 'social', 'other')),
    source_detail TEXT,

    -- Assignment
    assigned_rep_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Do Not Contact
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'do_not_contact')),
    do_not_email BOOLEAN DEFAULT FALSE,
    do_not_call BOOLEAN DEFAULT FALSE,
    do_not_text BOOLEAN DEFAULT FALSE,

    -- Flexible fields
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,

    -- Audit
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for crm_contacts
CREATE INDEX IF NOT EXISTS idx_crm_contacts_profile_id ON crm_contacts(profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_rep ON crm_contacts(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_temperature ON crm_contacts(temperature);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_by ON crm_contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON crm_contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_name ON crm_contacts(last_name, first_name);

-- ============================================================================
-- Table: crm_activities
-- Activity/interaction logging for contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    deal_id UUID, -- FK added in migration 213 when crm_deals is created
    rep_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Activity details
    activity_type TEXT NOT NULL
        CHECK (activity_type IN ('call', 'email', 'text', 'meeting', 'demo', 'follow_up', 'proposal_sent', 'note', 'other')),
    subject TEXT,
    description TEXT,
    outcome TEXT
        CHECK (outcome IS NULL OR outcome IN ('completed', 'no_answer', 'left_voicemail', 'callback_requested', 'not_interested', 'interested')),

    -- Timing
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_minutes INTEGER,

    -- Follow-up
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for crm_activities
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_rep ON crm_activities(rep_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_date ON crm_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_follow_up ON crm_activities(follow_up_date)
    WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities(deal_id)
    WHERE deal_id IS NOT NULL;

-- ============================================================================
-- Table: crm_interaction_counts
-- Daily interaction tallies per rep for quick KPI display
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_interaction_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Counts
    calls INTEGER NOT NULL DEFAULT 0,
    emails INTEGER NOT NULL DEFAULT 0,
    texts INTEGER NOT NULL DEFAULT 0,
    meetings INTEGER NOT NULL DEFAULT 0,
    demos INTEGER NOT NULL DEFAULT 0,
    other_interactions INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each rep has one row per date
    UNIQUE(rep_id, count_date)
);

CREATE INDEX IF NOT EXISTS idx_crm_interaction_counts_rep_date
    ON crm_interaction_counts(rep_id, count_date DESC);

-- ============================================================================
-- Add sales_agent flag to profiles
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_sales_agent BOOLEAN DEFAULT FALSE;
