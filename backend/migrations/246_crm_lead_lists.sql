-- Migration 246: Lead Lists for organizing scraped leads
-- Supports the export → ChatGPT clean → import pipeline

CREATE TABLE IF NOT EXISTS crm_lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    list_type TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'raw',
    lead_count INT DEFAULT 0,
    source_job_id UUID REFERENCES crm_scrape_jobs(id) ON DELETE SET NULL,
    export_filters JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_lead_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES crm_lead_lists(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES crm_scraped_leads(id) ON DELETE CASCADE,
    position INT DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(list_id, lead_id)
);
