-- Migration 243: Discovery Profiles & Scrape Profiles
-- Adds automated website discovery, reusable scraping configs, and execution tracking

-- Reusable scraping config profiles
CREATE TABLE IF NOT EXISTS crm_scrape_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    max_pages_per_site INT DEFAULT 5,
    paths_to_visit TEXT[] DEFAULT '{/about,/contact,/team}',
    data_to_extract TEXT[] DEFAULT '{emails,phones,social_links}',
    follow_internal_links BOOLEAN DEFAULT FALSE,
    max_depth INT DEFAULT 2,
    concurrency INT DEFAULT 1,
    delay_ms INT DEFAULT 2000,
    respect_robots_txt BOOLEAN DEFAULT TRUE,
    user_agent TEXT,
    min_match_score INT DEFAULT 0,
    require_email BOOLEAN DEFAULT FALSE,
    require_phone BOOLEAN DEFAULT FALSE,
    require_website BOOLEAN DEFAULT FALSE,
    excluded_domains TEXT[] DEFAULT '{}',
    scoring_rules JSONB DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovery search config profiles
CREATE TABLE IF NOT EXISTS crm_discovery_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    search_keywords TEXT[] NOT NULL DEFAULT '{}',
    locations TEXT[] DEFAULT '{}',
    source_types TEXT[] DEFAULT '{google_search}',
    search_radius_miles INT DEFAULT 50,
    must_have_website BOOLEAN DEFAULT TRUE,
    required_keywords TEXT[] DEFAULT '{}',
    excluded_keywords TEXT[] DEFAULT '{}',
    excluded_domains TEXT[] DEFAULT '{}',
    max_results_per_query INT DEFAULT 100,
    auto_start_scraping BOOLEAN DEFAULT FALSE,
    default_scrape_profile_id UUID REFERENCES crm_scrape_profiles(id) ON DELETE SET NULL,
    min_discovery_score INT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovery execution tracking
CREATE TABLE IF NOT EXISTS crm_discovery_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES crm_discovery_profiles(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    status TEXT NOT NULL DEFAULT 'queued',
    ecs_task_arn TEXT,
    source_stats JSONB DEFAULT '{}',
    sites_found_count INT DEFAULT 0,
    sites_selected_count INT DEFAULT 0,
    error_message TEXT,
    profile_snapshot JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_profile ON crm_discovery_runs(profile_id);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_status ON crm_discovery_runs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_created ON crm_discovery_runs(created_at DESC);

-- Discovered websites from runs
CREATE TABLE IF NOT EXISTS crm_discovery_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES crm_discovery_runs(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    homepage_url TEXT,
    company_name TEXT,
    source_type TEXT,
    raw_metadata JSONB DEFAULT '{}',
    snippet TEXT,
    location TEXT,
    match_score INT DEFAULT 0,
    score_breakdown JSONB DEFAULT '{}',
    is_selected_for_scraping BOOLEAN DEFAULT FALSE,
    scrape_job_id UUID REFERENCES crm_scrape_jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_sites_run ON crm_discovery_sites(run_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sites_score ON crm_discovery_sites(match_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_sites_dedup ON crm_discovery_sites(run_id, domain);

-- ALTER crm_scrape_jobs to support discovery-sourced jobs
ALTER TABLE crm_scrape_jobs ALTER COLUMN source_id DROP NOT NULL;

ALTER TABLE crm_scrape_jobs ADD COLUMN IF NOT EXISTS discovery_run_id UUID REFERENCES crm_discovery_runs(id) ON DELETE SET NULL;
ALTER TABLE crm_scrape_jobs ADD COLUMN IF NOT EXISTS scrape_profile_id UUID REFERENCES crm_scrape_profiles(id) ON DELETE SET NULL;
ALTER TABLE crm_scrape_jobs ADD COLUMN IF NOT EXISTS total_sites INT DEFAULT 0;
ALTER TABLE crm_scrape_jobs ADD COLUMN IF NOT EXISTS sites_scraped INT DEFAULT 0;
ALTER TABLE crm_scrape_jobs ADD COLUMN IF NOT EXISTS profile_snapshot JSONB DEFAULT '{}';

-- Ensure every job has at least one source reference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_scrape_job_source'
    ) THEN
        ALTER TABLE crm_scrape_jobs ADD CONSTRAINT chk_scrape_job_source
            CHECK (source_id IS NOT NULL OR discovery_run_id IS NOT NULL);
    END IF;
END $$;
