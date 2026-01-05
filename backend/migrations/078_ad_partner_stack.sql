-- Migration 078: Ad/Partner Stack
-- Phase 2B: Self-serve advertising and partner management system
--
-- This migration creates the foundation for:
-- - Self-serve partner/advertiser accounts
-- - Ad campaigns with targeting and budgets
-- - Ad creatives (video, audio, lower-third)
-- - Ad decision system for linear channels and VOD
-- - Impression tracking and basic accounting

-- =============================================================================
-- ADVERTISERS / PARTNERS: Businesses that can run ads
-- =============================================================================

CREATE TABLE IF NOT EXISTS advertisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,

    -- Contact
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,

    -- Billing (simplified - expand for real Stripe integration)
    billing_email TEXT,
    billing_address JSONB, -- {street, city, state, zip, country}
    stripe_customer_id TEXT,
    tax_id TEXT,

    -- Classification
    advertiser_type TEXT CHECK (advertiser_type IN (
        'brand',           -- Traditional brand advertiser
        'sponsor',         -- World/block sponsor
        'affiliate',       -- Affiliate partner
        'internal'         -- SWN internal promos
    )) DEFAULT 'brand',

    -- Status
    status TEXT CHECK (status IN (
        'pending',         -- Application submitted
        'approved',        -- Approved to run ads
        'active',          -- Currently running campaigns
        'paused',          -- Temporarily paused
        'suspended',       -- Suspended for policy
        'churned'          -- No longer active
    )) DEFAULT 'pending',

    -- Verification
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES profiles(id),

    -- Limits
    max_monthly_spend_cents INTEGER, -- Optional cap
    credit_limit_cents INTEGER DEFAULT 0, -- Pre-approved credit

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE advertisers IS 'Businesses and partners that can run advertising campaigns';

CREATE INDEX idx_advertisers_slug ON advertisers(slug);
CREATE INDEX idx_advertisers_status ON advertisers(status) WHERE status IN ('approved', 'active');
CREATE INDEX idx_advertisers_type ON advertisers(advertiser_type);
CREATE INDEX idx_advertisers_stripe ON advertisers(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- =============================================================================
-- ADVERTISER MEMBERS: Team access for advertiser accounts
-- =============================================================================

CREATE TABLE IF NOT EXISTS advertiser_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    role TEXT CHECK (role IN (
        'owner',           -- Full control
        'admin',           -- Manage campaigns, creatives
        'finance',         -- View billing, reports
        'creator',         -- Create campaigns, upload creatives
        'viewer'           -- Read-only access
    )) DEFAULT 'viewer',

    status TEXT CHECK (status IN ('active', 'invited', 'removed')) DEFAULT 'active',

    invited_by UUID REFERENCES profiles(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(advertiser_id, user_id)
);

COMMENT ON TABLE advertiser_members IS 'Team members with access to advertiser accounts';

CREATE INDEX idx_advertiser_members_advertiser ON advertiser_members(advertiser_id);
CREATE INDEX idx_advertiser_members_user ON advertiser_members(user_id);

-- =============================================================================
-- AD CREATIVES: The actual ad assets
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,

    -- Identity
    name TEXT NOT NULL,
    description TEXT,

    -- Creative type
    creative_type TEXT NOT NULL CHECK (creative_type IN (
        'video_preroll',       -- Full video ad (15-30s)
        'video_midroll',       -- Full video ad for mid-breaks
        'video_slate',         -- Static image/short loop for breaks
        'audio_sponsor',       -- Audio-only sponsor message
        'lower_third',         -- Overlay graphic
        'banner_overlay',      -- Banner during content
        'companion_banner',    -- Display alongside video
        'sponsored_card'       -- Interactive end card
    )),

    -- Asset references
    asset_url TEXT,                    -- S3 URL or CDN path
    video_asset_id UUID,               -- Reference to video_assets table if applicable
    media_job_id UUID,                 -- Reference to media_jobs if transcoding needed
    thumbnail_url TEXT,

    -- Specs
    duration_seconds INTEGER,          -- For video/audio
    width INTEGER,                     -- For images/banners
    height INTEGER,
    file_size_bytes BIGINT,
    format TEXT,                       -- mp4, jpg, png, etc.

    -- Content
    headline TEXT,                     -- For text-based formats
    body_text TEXT,
    call_to_action TEXT,               -- "Learn More", "Shop Now", etc.
    destination_url TEXT,              -- Click-through URL
    tracking_pixel_url TEXT,           -- Third-party tracking

    -- Metadata for targeting
    tags JSONB DEFAULT '[]'::jsonb,    -- ['action', 'family-friendly', etc.]
    categories JSONB DEFAULT '[]'::jsonb, -- Industry categories

    -- Status
    status TEXT CHECK (status IN (
        'draft',           -- Being created
        'pending_review',  -- Submitted for approval
        'approved',        -- Ready to serve
        'rejected',        -- Failed policy review
        'paused',          -- Temporarily disabled
        'archived'         -- No longer in use
    )) DEFAULT 'draft',

    -- Review
    review_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,

    -- Stats (denormalized)
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ad_creatives IS 'Advertising creative assets (videos, images, audio)';

CREATE INDEX idx_ad_creatives_advertiser ON ad_creatives(advertiser_id);
CREATE INDEX idx_ad_creatives_type ON ad_creatives(creative_type);
CREATE INDEX idx_ad_creatives_status ON ad_creatives(status) WHERE status = 'approved';
CREATE INDEX idx_ad_creatives_tags ON ad_creatives USING gin(tags);

-- =============================================================================
-- AD CAMPAIGNS: Groupings of ad activity with budgets and dates
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,

    -- Identity
    name TEXT NOT NULL,
    description TEXT,

    -- Objective
    objective TEXT CHECK (objective IN (
        'awareness',           -- Brand awareness (impressions)
        'engagement',          -- Clicks, interactions
        'sponsor_world',       -- Sponsor a specific World
        'sponsor_block',       -- Sponsor a programming block
        'sponsor_channel',     -- Sponsor a linear channel
        'direct_response'      -- Drive specific action
    )) DEFAULT 'awareness',

    -- Budget
    budget_cents BIGINT NOT NULL DEFAULT 0,      -- Total campaign budget
    daily_budget_cents BIGINT,                   -- Optional daily cap
    spent_cents BIGINT DEFAULT 0,                -- Running total spent

    -- Scheduling
    start_date DATE NOT NULL,
    end_date DATE,
    timezone TEXT DEFAULT 'America/Los_Angeles',

    -- Status
    status TEXT CHECK (status IN (
        'draft',           -- Being set up
        'pending',         -- Awaiting approval
        'scheduled',       -- Approved, not yet started
        'active',          -- Currently running
        'paused',          -- Temporarily stopped
        'completed',       -- Reached end date
        'cancelled'        -- Manually cancelled
    )) DEFAULT 'draft',

    -- Pacing
    pacing TEXT CHECK (pacing IN (
        'standard',        -- Even distribution over campaign
        'accelerated'      -- Spend as fast as possible
    )) DEFAULT 'standard',

    -- Performance
    target_impressions INTEGER,        -- Optional goal
    target_clicks INTEGER,
    target_cpm_cents INTEGER,          -- Target cost per 1000 impressions

    -- Stats (denormalized)
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,

    -- Audit
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ad_campaigns IS 'Advertising campaigns with budgets, dates, and objectives';

CREATE INDEX idx_ad_campaigns_advertiser ON ad_campaigns(advertiser_id);
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(status) WHERE status IN ('active', 'scheduled');
CREATE INDEX idx_ad_campaigns_dates ON ad_campaigns(start_date, end_date);
CREATE INDEX idx_ad_campaigns_objective ON ad_campaigns(objective);

-- =============================================================================
-- AD LINE ITEMS: Specific placements within a campaign
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,

    -- Identity
    name TEXT NOT NULL,

    -- Placement type
    placement_type TEXT NOT NULL CHECK (placement_type IN (
        'linear_preroll',      -- Before linear channel content
        'linear_midroll',      -- During linear channel breaks
        'linear_slate',        -- Station ID / bumper position
        'vod_preroll',         -- Before VOD playback
        'vod_midroll',         -- During VOD (if supported)
        'block_sponsor',       -- Sponsor a specific block
        'world_sponsor',       -- Sponsor a World's content
        'channel_sponsor'      -- Sponsor a linear channel
    )),

    -- Creative assignments
    creative_ids UUID[] DEFAULT '{}', -- Array of ad_creative IDs to rotate

    -- Targeting (JSONB for flexibility)
    targeting JSONB DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "channel_ids": ["uuid1", "uuid2"],
    --   "world_ids": ["uuid1"],
    --   "block_ids": ["uuid1"],
    --   "categories": ["drama", "action"],
    --   "lodges": ["craftsmen"],
    --   "time_of_day": {"start": "06:00", "end": "22:00"},
    --   "days_of_week": [0, 1, 2, 3, 4],  -- Mon-Fri
    --   "regions": ["US", "CA"],
    --   "exclude_content_ratings": ["R", "TV-MA"]
    -- }

    -- Pricing
    pricing_model TEXT CHECK (pricing_model IN (
        'cpm',             -- Cost per 1000 impressions
        'flat_fee',        -- Fixed fee for the period
        'cpc',             -- Cost per click
        'cpv'              -- Cost per completed view
    )) DEFAULT 'cpm',

    cpm_cents INTEGER,              -- Cost per 1000 impressions
    flat_fee_cents INTEGER,         -- Flat fee amount
    cpc_cents INTEGER,              -- Cost per click
    cpv_cents INTEGER,              -- Cost per view

    -- Limits
    max_impressions INTEGER,        -- Hard cap
    daily_impression_cap INTEGER,   -- Daily limit
    frequency_cap INTEGER,          -- Max per user per day
    budget_cents BIGINT,            -- Line item budget

    -- Pacing
    pacing TEXT CHECK (pacing IN ('standard', 'accelerated')) DEFAULT 'standard',

    -- Scheduling (within campaign dates)
    start_date DATE,
    end_date DATE,

    -- Status
    status TEXT CHECK (status IN (
        'draft',
        'pending',
        'active',
        'paused',
        'completed',
        'cancelled'
    )) DEFAULT 'draft',

    -- Priority (higher = preferred in ad selection)
    priority INTEGER DEFAULT 0,

    -- Stats (denormalized)
    impressions_today INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    spent_cents BIGINT DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ad_line_items IS 'Specific ad placements with targeting and pricing within campaigns';

CREATE INDEX idx_ad_line_items_campaign ON ad_line_items(campaign_id);
CREATE INDEX idx_ad_line_items_placement ON ad_line_items(placement_type);
CREATE INDEX idx_ad_line_items_status ON ad_line_items(status) WHERE status = 'active';
CREATE INDEX idx_ad_line_items_targeting ON ad_line_items USING gin(targeting);
CREATE INDEX idx_ad_line_items_active_placement ON ad_line_items(placement_type, status, priority DESC)
    WHERE status = 'active';

-- =============================================================================
-- AD IMPRESSIONS: Individual ad serve events
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was served
    line_item_id UUID NOT NULL REFERENCES ad_line_items(id),
    creative_id UUID NOT NULL REFERENCES ad_creatives(id),
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id),
    advertiser_id UUID NOT NULL REFERENCES advertisers(id),

    -- Where it was served
    channel_id UUID REFERENCES linear_channels(id),
    world_id UUID REFERENCES worlds(id),
    block_id UUID REFERENCES blocks(id),
    episode_id UUID REFERENCES episodes(id),

    -- Context
    placement_type TEXT NOT NULL,
    position_in_break INTEGER,       -- 1st, 2nd, 3rd ad in break

    -- Who saw it
    viewer_id UUID REFERENCES profiles(id), -- NULL for anonymous
    session_id UUID,                  -- Viewer session reference
    device_type TEXT,
    device_id_hash TEXT,              -- Hashed device ID
    ip_hash TEXT,                     -- Hashed IP for geo
    region TEXT,                      -- Derived from IP

    -- Timing
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    duration_watched_seconds INTEGER, -- How much was viewed
    completed BOOLEAN DEFAULT false,  -- Watched to completion

    -- Interaction
    clicked BOOLEAN DEFAULT false,
    clicked_at TIMESTAMPTZ,
    click_url TEXT,

    -- Revenue
    cost_cents INTEGER DEFAULT 0,     -- Actual cost charged

    -- Attribution
    conversion_tracked BOOLEAN DEFAULT false,
    conversion_value_cents INTEGER,

    -- Partition key for time-series queries
    impression_date DATE DEFAULT CURRENT_DATE
);

COMMENT ON TABLE ad_impressions IS 'Individual ad impression events for analytics and billing';

-- Partition by date for efficient queries (if needed in future)
-- For now, use regular indexes
CREATE INDEX idx_ad_impressions_line_item ON ad_impressions(line_item_id);
CREATE INDEX idx_ad_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX idx_ad_impressions_advertiser ON ad_impressions(advertiser_id);
CREATE INDEX idx_ad_impressions_date ON ad_impressions(impression_date);
CREATE INDEX idx_ad_impressions_occurred ON ad_impressions(occurred_at);
CREATE INDEX idx_ad_impressions_channel ON ad_impressions(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_ad_impressions_world ON ad_impressions(world_id) WHERE world_id IS NOT NULL;
CREATE INDEX idx_ad_impressions_viewer ON ad_impressions(viewer_id) WHERE viewer_id IS NOT NULL;

-- =============================================================================
-- AD BREAKS: Scheduled or triggered ad break opportunities
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Where
    channel_id UUID REFERENCES linear_channels(id),
    block_id UUID REFERENCES blocks(id),
    world_id UUID REFERENCES worlds(id),
    episode_id UUID REFERENCES episodes(id),

    -- Break type
    break_type TEXT CHECK (break_type IN (
        'preroll',         -- Before content
        'midroll',         -- During content
        'postroll',        -- After content
        'interstitial',    -- Between blocks
        'sponsor_pod'      -- Dedicated sponsor segment
    )) NOT NULL,

    -- Timing
    scheduled_at TIMESTAMPTZ,
    position_seconds INTEGER,         -- For VOD, position in video

    -- Configuration
    max_ads INTEGER DEFAULT 2,
    max_duration_seconds INTEGER DEFAULT 60,
    min_duration_seconds INTEGER DEFAULT 15,

    -- Fill
    fill_priority TEXT[] DEFAULT '{}', -- Order of priority: ['sponsor', 'direct', 'backfill']

    -- Status
    status TEXT CHECK (status IN ('scheduled', 'active', 'completed', 'skipped')) DEFAULT 'scheduled',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ad_breaks IS 'Scheduled or triggered ad break opportunities';

CREATE INDEX idx_ad_breaks_channel ON ad_breaks(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_ad_breaks_block ON ad_breaks(block_id) WHERE block_id IS NOT NULL;
CREATE INDEX idx_ad_breaks_scheduled ON ad_breaks(scheduled_at) WHERE status = 'scheduled';

-- =============================================================================
-- DAILY STATS ROLLUP: Aggregated stats for reporting
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Dimensions
    stat_date DATE NOT NULL,
    advertiser_id UUID NOT NULL REFERENCES advertisers(id),
    campaign_id UUID REFERENCES ad_campaigns(id),
    line_item_id UUID REFERENCES ad_line_items(id),
    creative_id UUID REFERENCES ad_creatives(id),

    -- Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    spend_cents BIGINT DEFAULT 0,

    -- Rates (computed)
    ctr NUMERIC(5,4),                 -- Click-through rate
    completion_rate NUMERIC(5,4),     -- View completion rate
    effective_cpm_cents INTEGER,      -- Actual CPM achieved

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(stat_date, advertiser_id, campaign_id, line_item_id, creative_id)
);

COMMENT ON TABLE ad_daily_stats IS 'Daily aggregated advertising statistics';

CREATE INDEX idx_ad_daily_stats_date ON ad_daily_stats(stat_date);
CREATE INDEX idx_ad_daily_stats_advertiser ON ad_daily_stats(advertiser_id, stat_date);
CREATE INDEX idx_ad_daily_stats_campaign ON ad_daily_stats(campaign_id, stat_date);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if a line item can serve (budget, impressions, dates)
CREATE OR REPLACE FUNCTION line_item_can_serve(line_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    li RECORD;
    campaign RECORD;
BEGIN
    SELECT * INTO li FROM ad_line_items WHERE id = line_item_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Check line item status
    IF li.status != 'active' THEN RETURN FALSE; END IF;

    -- Check line item dates
    IF li.start_date IS NOT NULL AND CURRENT_DATE < li.start_date THEN RETURN FALSE; END IF;
    IF li.end_date IS NOT NULL AND CURRENT_DATE > li.end_date THEN RETURN FALSE; END IF;

    -- Check impression caps
    IF li.max_impressions IS NOT NULL AND li.total_impressions >= li.max_impressions THEN RETURN FALSE; END IF;
    IF li.daily_impression_cap IS NOT NULL AND li.impressions_today >= li.daily_impression_cap THEN RETURN FALSE; END IF;

    -- Check line item budget
    IF li.budget_cents IS NOT NULL AND li.spent_cents >= li.budget_cents THEN RETURN FALSE; END IF;

    -- Check campaign
    SELECT * INTO campaign FROM ad_campaigns WHERE id = li.campaign_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF campaign.status != 'active' THEN RETURN FALSE; END IF;
    IF CURRENT_DATE < campaign.start_date THEN RETURN FALSE; END IF;
    IF campaign.end_date IS NOT NULL AND CURRENT_DATE > campaign.end_date THEN RETURN FALSE; END IF;
    IF campaign.spent_cents >= campaign.budget_cents THEN RETURN FALSE; END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment impression counters
CREATE OR REPLACE FUNCTION increment_ad_counters()
RETURNS TRIGGER AS $$
BEGIN
    -- Update line item counters
    UPDATE ad_line_items
    SET
        total_impressions = total_impressions + 1,
        impressions_today = impressions_today + 1,
        total_clicks = total_clicks + CASE WHEN NEW.clicked THEN 1 ELSE 0 END,
        total_completions = total_completions + CASE WHEN NEW.completed THEN 1 ELSE 0 END,
        spent_cents = spent_cents + COALESCE(NEW.cost_cents, 0),
        updated_at = NOW()
    WHERE id = NEW.line_item_id;

    -- Update campaign counters
    UPDATE ad_campaigns
    SET
        total_impressions = total_impressions + 1,
        total_clicks = total_clicks + CASE WHEN NEW.clicked THEN 1 ELSE 0 END,
        total_completions = total_completions + CASE WHEN NEW.completed THEN 1 ELSE 0 END,
        spent_cents = spent_cents + COALESCE(NEW.cost_cents, 0),
        updated_at = NOW()
    WHERE id = NEW.campaign_id;

    -- Update creative counters
    UPDATE ad_creatives
    SET
        total_impressions = total_impressions + 1,
        total_clicks = total_clicks + CASE WHEN NEW.clicked THEN 1 ELSE 0 END,
        total_completions = total_completions + CASE WHEN NEW.completed THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE id = NEW.creative_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ad_impression_counters
AFTER INSERT ON ad_impressions
FOR EACH ROW EXECUTE FUNCTION increment_ad_counters();

-- Reset daily impression counters (run via cron/scheduler at midnight)
CREATE OR REPLACE FUNCTION reset_daily_impression_counters()
RETURNS void AS $$
BEGIN
    UPDATE ad_line_items SET impressions_today = 0 WHERE impressions_today > 0;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE TRIGGER trg_advertisers_updated_at
BEFORE UPDATE ON advertisers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_advertiser_members_updated_at
BEFORE UPDATE ON advertiser_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ad_creatives_updated_at
BEFORE UPDATE ON ad_creatives
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ad_campaigns_updated_at
BEFORE UPDATE ON ad_campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ad_line_items_updated_at
BEFORE UPDATE ON ad_line_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ad_daily_stats_updated_at
BEFORE UPDATE ON ad_daily_stats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active line items with campaign and advertiser info
CREATE OR REPLACE VIEW v_active_ad_line_items AS
SELECT
    li.*,
    c.name as campaign_name,
    c.objective as campaign_objective,
    c.budget_cents as campaign_budget_cents,
    c.spent_cents as campaign_spent_cents,
    a.name as advertiser_name,
    a.status as advertiser_status
FROM ad_line_items li
JOIN ad_campaigns c ON li.campaign_id = c.id
JOIN advertisers a ON c.advertiser_id = a.id
WHERE li.status = 'active'
  AND c.status = 'active'
  AND a.status IN ('approved', 'active')
  AND (li.start_date IS NULL OR CURRENT_DATE >= li.start_date)
  AND (li.end_date IS NULL OR CURRENT_DATE <= li.end_date)
  AND CURRENT_DATE >= c.start_date
  AND (c.end_date IS NULL OR CURRENT_DATE <= c.end_date);

-- Campaign performance summary
CREATE OR REPLACE VIEW v_campaign_performance AS
SELECT
    c.id as campaign_id,
    c.name as campaign_name,
    c.advertiser_id,
    a.name as advertiser_name,
    c.objective,
    c.budget_cents,
    c.spent_cents,
    c.total_impressions,
    c.total_clicks,
    c.total_completions,
    CASE WHEN c.total_impressions > 0
        THEN ROUND((c.total_clicks::numeric / c.total_impressions) * 100, 2)
        ELSE 0
    END as ctr_percent,
    CASE WHEN c.total_impressions > 0
        THEN ROUND((c.spent_cents::numeric / c.total_impressions) * 1000, 0)
        ELSE 0
    END as effective_cpm_cents,
    c.start_date,
    c.end_date,
    c.status
FROM ad_campaigns c
JOIN advertisers a ON c.advertiser_id = a.id;

-- =============================================================================
-- SEED DATA: Internal promo advertiser
-- =============================================================================

INSERT INTO advertisers (name, slug, description, advertiser_type, status)
VALUES (
    'Second Watch Network',
    'swn-internal',
    'Internal promotional content and network promos',
    'internal',
    'active'
) ON CONFLICT (slug) DO NOTHING;
