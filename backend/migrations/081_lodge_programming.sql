-- Migration 081: Lodge Programming Privileges
-- Phase 3B: Lodge metrics, VOD shelves, and lodge channel scaffolding
--
-- This migration:
-- 1. Creates lodge metrics snapshots for tier calculation
-- 2. Adds lodge VOD shelf features (featured Worlds)
-- 3. Extends linear_channels for lodge ownership
-- 4. Creates lodge block proposal workflow

BEGIN;

-- =============================================================================
-- PART 1: Lodge Metrics and Tiers
-- =============================================================================

-- Lodge tier enum for classification
-- Tiers determine programming privileges
CREATE TYPE lodge_tier AS ENUM ('emerging', 'active', 'flagship');

-- Lodge metrics snapshots (computed periodically)
CREATE TABLE IF NOT EXISTS lodge_metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lodge_id UUID NOT NULL REFERENCES order_lodges(id) ON DELETE CASCADE,

    -- Snapshot period
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_type TEXT NOT NULL DEFAULT 'monthly',

    -- Membership metrics
    total_members INTEGER DEFAULT 0,
    active_members INTEGER DEFAULT 0,
    new_members_this_period INTEGER DEFAULT 0,
    officers_count INTEGER DEFAULT 0,

    -- World production metrics
    worlds_count INTEGER DEFAULT 0,
    active_worlds_count INTEGER DEFAULT 0,
    worlds_premiered_this_period INTEGER DEFAULT 0,

    -- Watch and earnings metrics (from world_earnings and aggregates)
    total_watch_seconds BIGINT DEFAULT 0,
    total_earnings_cents BIGINT DEFAULT 0,
    avg_earnings_per_world_cents BIGINT DEFAULT 0,

    -- Community health
    threads_count INTEGER DEFAULT 0,
    thread_replies_this_period INTEGER DEFAULT 0,
    events_hosted INTEGER DEFAULT 0,
    event_attendance INTEGER DEFAULT 0,

    -- Computed tier
    computed_tier lodge_tier DEFAULT 'emerging',
    tier_score INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(lodge_id, snapshot_date, period_type)
);

-- Add tier to lodges table
ALTER TABLE order_lodges
    ADD COLUMN IF NOT EXISTS current_tier lodge_tier DEFAULT 'emerging',
    ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS can_propose_blocks BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_lodge_channel BOOLEAN DEFAULT false;

-- =============================================================================
-- PART 2: Lodge VOD Shelves
-- =============================================================================

-- Lodge-featured Worlds for VOD shelves
CREATE TABLE IF NOT EXISTS lodge_world_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lodge_id UUID NOT NULL REFERENCES order_lodges(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Feature metadata
    featured_at TIMESTAMPTZ DEFAULT NOW(),
    featured_by UUID REFERENCES profiles(id),
    feature_reason TEXT,

    -- Display settings
    display_order INTEGER DEFAULT 0,
    is_highlighted BOOLEAN DEFAULT false,
    highlight_text TEXT,

    -- Validity
    feature_start_date DATE DEFAULT CURRENT_DATE,
    feature_end_date DATE,
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(lodge_id, world_id)
);

-- Add lodge association to worlds (soft link for "originated from" tracking)
ALTER TABLE worlds
    ADD COLUMN IF NOT EXISTS originating_lodge_id UUID REFERENCES order_lodges(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lodge_featured BOOLEAN DEFAULT false;

-- Index for shelf queries
CREATE INDEX IF NOT EXISTS idx_lodge_world_features_lodge ON lodge_world_features(lodge_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lodge_world_features_display ON lodge_world_features(lodge_id, display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_worlds_originating_lodge ON worlds(originating_lodge_id) WHERE originating_lodge_id IS NOT NULL;

-- =============================================================================
-- PART 3: Lodge Linear Channels
-- =============================================================================

-- Add lodge ownership to linear channels (extend existing table)
ALTER TABLE linear_channels
    ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES order_lodges(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_lodge_channel BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS lodge_visibility TEXT DEFAULT 'lodge_only',
    ADD COLUMN IF NOT EXISTS network_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS network_approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS network_approved_by UUID REFERENCES profiles(id);

-- Constraint: lodge channels must have lodge_id
ALTER TABLE linear_channels DROP CONSTRAINT IF EXISTS lodge_channel_requires_lodge;
ALTER TABLE linear_channels ADD CONSTRAINT lodge_channel_requires_lodge
    CHECK (NOT is_lodge_channel OR lodge_id IS NOT NULL);

-- Constraint for lodge visibility
ALTER TABLE linear_channels DROP CONSTRAINT IF EXISTS lodge_visibility_check;
ALTER TABLE linear_channels ADD CONSTRAINT lodge_visibility_check
    CHECK (lodge_visibility IN ('lodge_only', 'public_approved', 'order_wide'));

-- Index for lodge channel queries
CREATE INDEX IF NOT EXISTS idx_linear_channels_lodge ON linear_channels(lodge_id) WHERE lodge_id IS NOT NULL;

-- =============================================================================
-- PART 4: Lodge Block Proposals
-- =============================================================================

-- Lodge officers can propose blocks for their channel
CREATE TABLE IF NOT EXISTS lodge_block_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lodge_id UUID NOT NULL REFERENCES order_lodges(id) ON DELETE CASCADE,

    -- Proposed block details
    proposed_block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    block_name TEXT NOT NULL,
    block_description TEXT,
    block_theme TEXT,

    -- Proposed items (JSON array of world_ids/episode_ids)
    proposed_items JSONB NOT NULL DEFAULT '[]',
    estimated_duration_seconds INTEGER,

    -- Proposed schedule
    proposed_schedule JSONB,

    -- Proposal workflow
    status TEXT NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES profiles(id),

    -- Review process
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    review_notes TEXT,
    rejection_reason TEXT,

    -- If approved, the created block and schedule entry
    approved_block_id UUID REFERENCES blocks(id),
    approved_schedule_entry_id UUID REFERENCES channel_schedule_entries(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT lodge_block_proposal_status_check
        CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled'))
);

-- Index for proposal queries
CREATE INDEX IF NOT EXISTS idx_lodge_block_proposals_lodge ON lodge_block_proposals(lodge_id, status);
CREATE INDEX IF NOT EXISTS idx_lodge_block_proposals_status ON lodge_block_proposals(status) WHERE status IN ('submitted', 'under_review');

-- =============================================================================
-- PART 5: Lodge Metrics Views
-- =============================================================================

-- View for current lodge metrics (most recent snapshot)
CREATE OR REPLACE VIEW v_lodge_current_metrics AS
SELECT DISTINCT ON (lms.lodge_id)
    lms.*,
    ol.name as lodge_name,
    ol.city as lodge_city,
    ol.region as lodge_region,
    ol.status as lodge_status,
    ol.current_tier,
    ol.can_propose_blocks,
    ol.has_lodge_channel
FROM lodge_metrics_snapshots lms
JOIN order_lodges ol ON lms.lodge_id = ol.id
ORDER BY lms.lodge_id, lms.snapshot_date DESC;

-- View for lodge shelf (featured worlds ready for display)
CREATE OR REPLACE VIEW v_lodge_shelf AS
SELECT
    lwf.lodge_id,
    lwf.world_id,
    lwf.display_order,
    lwf.is_highlighted,
    lwf.highlight_text,
    lwf.feature_reason,
    w.title as world_title,
    w.slug as world_slug,
    w.logline,
    w.cover_art_url,
    w.cover_art_wide_url,
    w.content_format,
    w.maturity_rating,
    w.status as world_status,
    w.premiere_date,
    w.follower_count,
    w.total_view_count,
    -- Get watch time from aggregates
    COALESCE(
        (SELECT SUM(total_watch_seconds)
         FROM world_watch_aggregates
         WHERE world_id = w.id AND period_type = 'monthly'),
        0
    ) as monthly_watch_seconds
FROM lodge_world_features lwf
JOIN worlds w ON lwf.world_id = w.id
WHERE lwf.is_active = true
  AND w.status = 'active'
  AND w.visibility = 'public'
  AND (lwf.feature_end_date IS NULL OR lwf.feature_end_date >= CURRENT_DATE)
ORDER BY lwf.lodge_id, lwf.display_order, lwf.featured_at DESC;

-- =============================================================================
-- PART 6: Tier Calculation Function
-- =============================================================================

-- Function to calculate lodge tier based on metrics
CREATE OR REPLACE FUNCTION calculate_lodge_tier(
    p_worlds_count INTEGER,
    p_total_watch_seconds BIGINT,
    p_active_members INTEGER,
    p_threads_count INTEGER
) RETURNS lodge_tier AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Score based on worlds (max 40 points)
    IF p_worlds_count >= 10 THEN score := score + 40;
    ELSIF p_worlds_count >= 5 THEN score := score + 30;
    ELSIF p_worlds_count >= 2 THEN score := score + 20;
    ELSIF p_worlds_count >= 1 THEN score := score + 10;
    END IF;

    -- Score based on watch time (max 30 points)
    -- 1M seconds = ~277 hours
    IF p_total_watch_seconds >= 3600000 THEN score := score + 30;  -- 1000+ hours
    ELSIF p_total_watch_seconds >= 1000000 THEN score := score + 20;  -- 277+ hours
    ELSIF p_total_watch_seconds >= 100000 THEN score := score + 10;  -- 27+ hours
    END IF;

    -- Score based on active members (max 20 points)
    IF p_active_members >= 50 THEN score := score + 20;
    ELSIF p_active_members >= 20 THEN score := score + 15;
    ELSIF p_active_members >= 10 THEN score := score + 10;
    ELSIF p_active_members >= 5 THEN score := score + 5;
    END IF;

    -- Score based on community activity (max 10 points)
    IF p_threads_count >= 50 THEN score := score + 10;
    ELSIF p_threads_count >= 20 THEN score := score + 7;
    ELSIF p_threads_count >= 5 THEN score := score + 3;
    END IF;

    -- Determine tier
    IF score >= 70 THEN RETURN 'flagship';
    ELSIF score >= 40 THEN RETURN 'active';
    ELSE RETURN 'emerging';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- PART 7: Update Triggers
-- =============================================================================

-- Trigger to update lodge tier when metrics snapshot is created
CREATE OR REPLACE FUNCTION update_lodge_tier_from_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE order_lodges
    SET current_tier = NEW.computed_tier,
        tier_updated_at = NOW(),
        -- Flagship lodges can propose blocks
        can_propose_blocks = (NEW.computed_tier IN ('active', 'flagship'))
    WHERE id = NEW.lodge_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_lodge_tier ON lodge_metrics_snapshots;
CREATE TRIGGER trg_update_lodge_tier
    AFTER INSERT ON lodge_metrics_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_lodge_tier_from_snapshot();

-- =============================================================================
-- PART 8: Seed Data
-- =============================================================================

-- Grant block proposal rights to any existing active lodges with significant activity
UPDATE order_lodges
SET can_propose_blocks = true
WHERE status = 'active'
  AND id IN (
      SELECT DISTINCT lodge_id
      FROM order_lodge_memberships
      WHERE status = 'active'
      GROUP BY lodge_id
      HAVING COUNT(*) >= 5
  );

COMMIT;
