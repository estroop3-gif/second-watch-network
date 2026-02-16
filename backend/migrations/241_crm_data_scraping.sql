-- Migration 241: CRM Data Scraping Tables
-- Scrape source definitions, job tracking, and staged leads

-- Scrape source definitions (configurable CSS selectors per site)
CREATE TABLE IF NOT EXISTS crm_scrape_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'directory',
    selectors JSONB NOT NULL DEFAULT '{}',
    max_pages INT DEFAULT 10,
    rate_limit_ms INT DEFAULT 2000,
    enabled BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrape job tracking
CREATE TABLE IF NOT EXISTS crm_scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES crm_scrape_sources(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    filters JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    ecs_task_arn TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    stats JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_source ON crm_scrape_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON crm_scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created ON crm_scrape_jobs(created_at DESC);

-- Staged leads (scraped, pending review)
CREATE TABLE IF NOT EXISTS crm_scraped_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES crm_scrape_jobs(id) ON DELETE CASCADE,
    company_name TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    match_score INT DEFAULT 0,
    score_breakdown JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    merged_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraped_leads_job ON crm_scraped_leads(job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_status ON crm_scraped_leads(status);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_score ON crm_scraped_leads(match_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scraped_leads_dedup ON crm_scraped_leads(job_id, website) WHERE website IS NOT NULL;
