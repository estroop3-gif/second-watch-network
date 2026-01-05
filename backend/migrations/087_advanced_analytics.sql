-- Migration 087: Advanced Analytics and Insight Surfaces
-- Phase 5B: Channel/block analytics, campaign metrics, and lodge aggregates
--
-- This migration:
-- 1. Extends watch aggregates for channels and blocks
-- 2. Adds ad campaign performance tracking
-- 3. Creates lodge-level aggregates
-- 4. Adds cohort and retention analytics support

BEGIN;

-- =============================================================================
-- PART 1: Channel and Block Watch Aggregates
-- =============================================================================

-- Watch aggregates per linear channel
CREATE TABLE IF NOT EXISTS channel_watch_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES linear_channels(id) ON DELETE CASCADE,

    -- Time period
    period_type TEXT NOT NULL,  -- 'hourly', 'daily', 'weekly', 'monthly'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Metrics
    total_watch_seconds BIGINT DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_session_seconds INTEGER DEFAULT 0,

    -- Engagement
    peak_concurrent_viewers INTEGER DEFAULT 0,
    peak_concurrent_at TIMESTAMPTZ,

    -- Calculated at aggregation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(channel_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_channel_watch_agg_channel
    ON channel_watch_aggregates(channel_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_channel_watch_agg_period
    ON channel_watch_aggregates(period_type, period_start DESC);

-- Watch aggregates per programming block
CREATE TABLE IF NOT EXISTS block_watch_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL,  -- References linear_blocks or similar

    -- Time period
    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Metrics
    total_watch_seconds BIGINT DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_tune_in_point_seconds INTEGER DEFAULT 0,  -- Where viewers joined
    avg_tune_out_point_seconds INTEGER DEFAULT 0,  -- Where viewers left

    -- Block-specific
    completion_rate_pct NUMERIC(5,2) DEFAULT 0,  -- % who watched entire block
    drop_off_points JSONB DEFAULT '[]'::jsonb,   -- Notable drop-off timestamps

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(block_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_block_watch_agg_block
    ON block_watch_aggregates(block_id, period_type, period_start DESC);

-- =============================================================================
-- PART 2: Ad Campaign Performance Tracking
-- =============================================================================

-- Line item stats (impressions, completion, spend)
CREATE TABLE IF NOT EXISTS ad_line_item_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id UUID NOT NULL,  -- References ad_line_items

    -- Time period
    period_type TEXT NOT NULL,  -- 'hourly', 'daily'
    period_start TIMESTAMPTZ NOT NULL,

    -- Core metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    completed_views INTEGER DEFAULT 0,  -- Watched to completion
    skipped INTEGER DEFAULT 0,

    -- Engagement by quartile
    q1_reached INTEGER DEFAULT 0,  -- 25%
    q2_reached INTEGER DEFAULT 0,  -- 50%
    q3_reached INTEGER DEFAULT 0,  -- 75%
    q4_reached INTEGER DEFAULT 0,  -- 100%

    -- Financial
    spend_cents BIGINT DEFAULT 0,
    revenue_cents BIGINT DEFAULT 0,  -- For internal ads

    -- Context
    by_placement_type JSONB DEFAULT '{}'::jsonb,
    -- {"pre_roll": {"impressions": 100}, "mid_roll": {"impressions": 50}}

    by_device_type JSONB DEFAULT '{}'::jsonb,
    -- {"mobile": 60, "tv": 30, "web": 10}

    by_channel JSONB DEFAULT '{}'::jsonb,
    -- {"channel_id": {"impressions": 50}}

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(line_item_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ad_stats_line_item
    ON ad_line_item_stats(line_item_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_ad_stats_period
    ON ad_line_item_stats(period_type, period_start DESC);

-- Campaign-level rollup
CREATE TABLE IF NOT EXISTS ad_campaign_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,  -- References ad_campaigns

    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,

    -- Aggregated metrics
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_completed_views INTEGER DEFAULT 0,
    total_spend_cents BIGINT DEFAULT 0,

    -- Calculated rates
    ctr_pct NUMERIC(5,4) DEFAULT 0,  -- Click-through rate
    vcr_pct NUMERIC(5,2) DEFAULT 0,  -- Video completion rate

    -- Unique reach
    unique_viewers_reached INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(campaign_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ad_campaign_stats_campaign
    ON ad_campaign_stats(campaign_id, period_type, period_start DESC);

-- =============================================================================
-- PART 3: Lodge Analytics
-- =============================================================================

-- Lodge-level aggregates
CREATE TABLE IF NOT EXISTS lodge_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lodge_id UUID NOT NULL,  -- References lodges

    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Content output
    worlds_count INTEGER DEFAULT 0,
    episodes_count INTEGER DEFAULT 0,
    new_episodes_this_period INTEGER DEFAULT 0,

    -- Watch metrics
    total_watch_seconds BIGINT DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,

    -- Revenue (for lodges that produce content)
    estimated_earnings_cents BIGINT DEFAULT 0,

    -- Community engagement
    active_members INTEGER DEFAULT 0,
    new_members INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,

    -- Linear programming (if lodge has channels)
    channel_watch_seconds BIGINT DEFAULT 0,
    block_submissions INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(lodge_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_lodge_agg_lodge
    ON lodge_aggregates(lodge_id, period_type, period_start DESC);

-- Platform totals by lodge tier
CREATE TABLE IF NOT EXISTS platform_lodge_tier_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,

    tier TEXT NOT NULL,  -- Lodge tier level

    -- Aggregate metrics
    active_lodges INTEGER DEFAULT 0,
    total_watch_seconds BIGINT DEFAULT 0,
    total_members INTEGER DEFAULT 0,
    total_earnings_cents BIGINT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_type, period_start, tier)
);

-- =============================================================================
-- PART 4: Cohort and Retention Analytics
-- =============================================================================

-- World performance cohorts (first 7/30/90 days)
CREATE TABLE IF NOT EXISTS world_cohort_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Cohort definition
    cohort_type TEXT NOT NULL,  -- 'day_7', 'day_30', 'day_90'
    cohort_start DATE NOT NULL,  -- Launch date
    cohort_end DATE NOT NULL,

    -- Metrics
    total_watch_seconds BIGINT DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    peak_concurrent INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,

    -- Engagement quality
    avg_session_duration_seconds INTEGER DEFAULT 0,
    return_viewer_rate_pct NUMERIC(5,2) DEFAULT 0,
    completion_rate_pct NUMERIC(5,2) DEFAULT 0,

    -- Comparisons
    percentile_rank INTEGER,  -- 1-100, relative to similar Worlds

    -- Calculated
    is_finalized BOOLEAN DEFAULT false,
    finalized_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, cohort_type)
);

CREATE INDEX IF NOT EXISTS idx_world_cohort_world
    ON world_cohort_metrics(world_id);
CREATE INDEX IF NOT EXISTS idx_world_cohort_type
    ON world_cohort_metrics(cohort_type, cohort_start DESC);

-- User retention cohorts
CREATE TABLE IF NOT EXISTS user_retention_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cohort definition
    cohort_week DATE NOT NULL,  -- Week of first activity
    weeks_since_signup INTEGER NOT NULL,  -- 0, 1, 2, ... weeks later

    -- Metrics
    cohort_size INTEGER DEFAULT 0,  -- Users who started in cohort_week
    retained_users INTEGER DEFAULT 0,  -- Active in this follow-up week
    retention_rate_pct NUMERIC(5,2) DEFAULT 0,

    -- Breakdown
    by_acquisition_source JSONB DEFAULT '{}'::jsonb,
    by_user_type JSONB DEFAULT '{}'::jsonb,  -- order_member, premium, free

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(cohort_week, weeks_since_signup)
);

CREATE INDEX IF NOT EXISTS idx_retention_cohort
    ON user_retention_cohorts(cohort_week, weeks_since_signup);

-- =============================================================================
-- PART 5: Content Health and Category Distribution
-- =============================================================================

-- Category/genre distribution over time
CREATE TABLE IF NOT EXISTS content_distribution_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,

    -- Distribution by category
    by_category JSONB DEFAULT '{}'::jsonb,
    -- {"drama": {"worlds": 50, "watch_seconds": 1000000}, "comedy": {...}}

    by_world_type JSONB DEFAULT '{}'::jsonb,
    -- {"film": {...}, "series": {...}, "sports": {...}}

    by_maturity_rating JSONB DEFAULT '{}'::jsonb,
    -- {"TV-PG": {...}, "TV-14": {...}, "TV-MA": {...}}

    -- Lodge distribution
    by_lodge JSONB DEFAULT '{}'::jsonb,

    -- Platform totals
    total_worlds INTEGER DEFAULT 0,
    total_episodes INTEGER DEFAULT 0,
    total_watch_seconds BIGINT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_content_dist_period
    ON content_distribution_stats(period_type, period_start DESC);

-- =============================================================================
-- PART 6: Analytics Views
-- =============================================================================

-- Top Worlds by watch time (parameterized by timeframe)
CREATE OR REPLACE VIEW v_top_worlds_by_watch AS
SELECT
    w.id as world_id,
    w.title,
    w.slug,
    w.creator_id,
    w.organization_id,
    w.world_category,
    w.maturity_rating,
    COALESCE(SUM(wwa.total_watch_seconds), 0) as total_watch_seconds,
    COALESCE(SUM(wwa.unique_viewers), 0) as unique_viewers,
    MAX(wwa.period_end) as last_period
FROM worlds w
LEFT JOIN world_watch_aggregates wwa ON w.id = wwa.world_id
WHERE w.status = 'published'
GROUP BY w.id, w.title, w.slug, w.creator_id, w.organization_id,
         w.world_category, w.maturity_rating
ORDER BY total_watch_seconds DESC;

-- Channel performance summary
CREATE OR REPLACE VIEW v_channel_performance AS
SELECT
    lc.id as channel_id,
    lc.name as channel_name,
    lc.status,
    SUM(cwa.total_watch_seconds) as total_watch_seconds,
    SUM(cwa.unique_viewers) as unique_viewers,
    AVG(cwa.peak_concurrent_viewers) as avg_peak_concurrent,
    MAX(cwa.peak_concurrent_viewers) as max_peak_concurrent
FROM linear_channels lc
LEFT JOIN channel_watch_aggregates cwa ON lc.id = cwa.channel_id
    AND cwa.period_type = 'daily'
GROUP BY lc.id, lc.name, lc.status;

-- Lodge contribution to platform
CREATE OR REPLACE VIEW v_lodge_platform_contribution AS
SELECT
    la.lodge_id,
    la.period_type,
    la.period_start,
    la.total_watch_seconds,
    la.estimated_earnings_cents,
    pt.total_watch_seconds as platform_total_watch,
    CASE
        WHEN pt.total_watch_seconds > 0 THEN
            ROUND((la.total_watch_seconds::NUMERIC / pt.total_watch_seconds) * 100, 2)
        ELSE 0
    END as watch_share_pct
FROM lodge_aggregates la
JOIN platform_watch_totals pt ON la.period_type = pt.period_type
    AND la.period_start = pt.period_start;

-- Ad campaign ROI summary
CREATE OR REPLACE VIEW v_ad_campaign_roi AS
SELECT
    acs.campaign_id,
    SUM(acs.total_impressions) as total_impressions,
    SUM(acs.total_clicks) as total_clicks,
    SUM(acs.total_completed_views) as total_completed_views,
    SUM(acs.total_spend_cents) as total_spend_cents,
    CASE
        WHEN SUM(acs.total_impressions) > 0 THEN
            ROUND((SUM(acs.total_clicks)::NUMERIC / SUM(acs.total_impressions)) * 100, 4)
        ELSE 0
    END as overall_ctr_pct,
    CASE
        WHEN SUM(acs.total_impressions) > 0 THEN
            ROUND((SUM(acs.total_completed_views)::NUMERIC / SUM(acs.total_impressions)) * 100, 2)
        ELSE 0
    END as overall_vcr_pct,
    CASE
        WHEN SUM(acs.total_impressions) > 0 THEN
            ROUND(SUM(acs.total_spend_cents)::NUMERIC / SUM(acs.total_impressions) * 10, 2)
        ELSE 0
    END as cpm_cents
FROM ad_campaign_stats acs
GROUP BY acs.campaign_id;

-- =============================================================================
-- PART 7: Aggregation Functions
-- =============================================================================

-- Function to aggregate channel watch time
CREATE OR REPLACE FUNCTION aggregate_channel_watch_time(
    p_period_type TEXT,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO channel_watch_aggregates (
        channel_id, period_type, period_start, period_end,
        total_watch_seconds, unique_viewers, total_sessions
    )
    SELECT
        ps.channel_id,
        p_period_type,
        p_period_start,
        p_period_end,
        SUM(EXTRACT(EPOCH FROM (ps.last_heartbeat - ps.started_at)))::BIGINT,
        COUNT(DISTINCT ps.user_id),
        COUNT(*)
    FROM playback_sessions ps
    WHERE ps.channel_id IS NOT NULL
      AND ps.started_at >= p_period_start
      AND ps.started_at < p_period_end
    GROUP BY ps.channel_id
    ON CONFLICT (channel_id, period_type, period_start)
    DO UPDATE SET
        total_watch_seconds = EXCLUDED.total_watch_seconds,
        unique_viewers = EXCLUDED.unique_viewers,
        total_sessions = EXCLUDED.total_sessions,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate world cohort metrics
CREATE OR REPLACE FUNCTION calculate_world_cohort(
    p_world_id UUID,
    p_cohort_type TEXT  -- 'day_7', 'day_30', 'day_90'
) RETURNS BOOLEAN AS $$
DECLARE
    v_launch_date DATE;
    v_cohort_days INTEGER;
    v_cohort_end DATE;
BEGIN
    -- Get launch date
    SELECT DATE(published_at) INTO v_launch_date
    FROM worlds WHERE id = p_world_id;

    IF v_launch_date IS NULL THEN
        RETURN false;
    END IF;

    -- Determine cohort window
    v_cohort_days := CASE p_cohort_type
        WHEN 'day_7' THEN 7
        WHEN 'day_30' THEN 30
        WHEN 'day_90' THEN 90
        ELSE 30
    END;

    v_cohort_end := v_launch_date + v_cohort_days;

    -- Don't calculate if cohort period hasn't completed
    IF v_cohort_end > CURRENT_DATE THEN
        RETURN false;
    END IF;

    -- Calculate and upsert metrics
    INSERT INTO world_cohort_metrics (
        world_id, cohort_type, cohort_start, cohort_end,
        total_watch_seconds, unique_viewers, total_sessions,
        avg_session_duration_seconds, is_finalized, finalized_at
    )
    SELECT
        p_world_id,
        p_cohort_type,
        v_launch_date,
        v_cohort_end,
        COALESCE(SUM(wwa.total_watch_seconds), 0),
        COALESCE(SUM(wwa.unique_viewers), 0),
        COALESCE(SUM(wwa.total_sessions), 0),
        CASE
            WHEN SUM(wwa.total_sessions) > 0 THEN
                (SUM(wwa.total_watch_seconds) / SUM(wwa.total_sessions))::INTEGER
            ELSE 0
        END,
        true,
        NOW()
    FROM world_watch_aggregates wwa
    WHERE wwa.world_id = p_world_id
      AND wwa.period_type = 'daily'
      AND wwa.period_start >= v_launch_date
      AND wwa.period_start < v_cohort_end
    ON CONFLICT (world_id, cohort_type)
    DO UPDATE SET
        total_watch_seconds = EXCLUDED.total_watch_seconds,
        unique_viewers = EXCLUDED.unique_viewers,
        total_sessions = EXCLUDED.total_sessions,
        avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
        is_finalized = true,
        finalized_at = NOW(),
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 8: Indexes for Query Optimization
-- =============================================================================

-- Composite indexes for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_world_watch_agg_creator_period
    ON world_watch_aggregates(period_type, period_start DESC)
    INCLUDE (world_id, total_watch_seconds, unique_viewers);

-- For "top N" queries
CREATE INDEX IF NOT EXISTS idx_world_watch_agg_watch_time
    ON world_watch_aggregates(total_watch_seconds DESC)
    WHERE period_type = 'daily';

COMMIT;
