-- Migration 244: CRM Scraping Settings (key-value config for Docker/ECS)
-- Replaces hardcoded ECS cluster, task definitions, subnets, security groups, API keys, etc.

CREATE TABLE IF NOT EXISTS crm_scraping_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'infrastructure',
    is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID REFERENCES profiles(id)
);

-- Seed with current hardcoded defaults
INSERT INTO crm_scraping_settings (key, value, category, is_secret, description) VALUES
    -- Infrastructure
    ('ecs_cluster', 'swn-scraper-cluster', 'infrastructure', false, 'ECS cluster name'),
    ('scraper_task_definition', 'swn-scraper-task', 'infrastructure', false, 'Scraper ECS task definition'),
    ('discovery_task_definition', 'swn-discovery-task', 'infrastructure', false, 'Discovery ECS task definition'),
    ('vpc_subnets', 'subnet-097d1d86c1bc18b3b,subnet-013241dd6ffc1e819', 'infrastructure', false, 'Comma-separated VPC subnet IDs'),
    ('security_groups', 'sg-01b01424383262ebd', 'infrastructure', false, 'Comma-separated security group IDs'),
    ('scraper_container_name', 'scraper-worker', 'infrastructure', false, 'Scraper container name in task definition'),
    ('discovery_container_name', 'discovery-worker', 'infrastructure', false, 'Discovery container name in task definition'),

    -- Resources
    ('default_cpu', '256', 'resources', false, 'Default CPU units for Fargate tasks'),
    ('default_memory', '512', 'resources', false, 'Default memory (MB) for Fargate tasks'),
    ('capacity_provider', 'FARGATE_SPOT', 'resources', false, 'Capacity provider: FARGATE or FARGATE_SPOT'),

    -- API Keys
    ('google_api_key', '', 'api_keys', true, 'Google API key for discovery searches'),
    ('google_cse_id', '', 'api_keys', true, 'Google Custom Search Engine ID'),

    -- Worker Defaults
    ('default_http_timeout_ms', '30000', 'worker_defaults', false, 'HTTP request timeout in milliseconds'),
    ('default_user_agent', 'SWN-LeadFinder/1.0 (business directory research)', 'worker_defaults', false, 'User-Agent header for scraping requests'),
    ('discovery_query_delay_ms', '1000', 'worker_defaults', false, 'Delay between discovery API queries in milliseconds'),
    ('free_email_domains', 'gmail.com,yahoo.com,hotmail.com,outlook.com,aol.com,icloud.com,mail.com,protonmail.com,zoho.com', 'worker_defaults', false, 'Comma-separated free email domains to skip'),
    ('default_log_level', 'INFO', 'worker_defaults', false, 'Log level for worker containers')
ON CONFLICT (key) DO NOTHING;
