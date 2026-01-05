-- Migration 079: Festival Lifecycle & Venue Distribution
-- Phase 2C: Festival runs, release windows, and venue partnerships
--
-- This migration creates scaffolding for:
-- - Festival submission and screening lifecycle
-- - Release windows (festival exclusive, platform, venue)
-- - Venue partner management
-- - Distribution deals
--
-- Enables Worlds to have a planned lifecycle:
-- Festivals → Platform Release → Venue Distribution

-- =============================================================================
-- FESTIVAL RUNS: Track World submissions and screenings at festivals
-- =============================================================================

CREATE TABLE IF NOT EXISTS festival_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Festival identification
    festival_name TEXT NOT NULL,
    festival_slug TEXT, -- Normalized name for grouping
    festival_year INTEGER,
    festival_location TEXT, -- City, Country
    festival_website TEXT,

    -- Submission details
    submission_category TEXT, -- "Narrative Feature", "Documentary Short", etc.
    submission_date DATE,
    submission_fee_cents INTEGER,

    -- Status tracking
    status TEXT CHECK (status IN (
        'planning',       -- Considering submission
        'submitted',      -- Application sent
        'pending',        -- Under consideration
        'accepted',       -- Selected for screening
        'rejected',       -- Not selected
        'withdrawn',      -- Pulled from consideration
        'screened',       -- Has been screened
        'awarded'         -- Won award(s)
    )) DEFAULT 'planning',

    -- Award tracking
    awards_won TEXT[], -- Array of award names
    award_details JSONB, -- Detailed award info

    -- Screening details (if accepted)
    premiere_type TEXT CHECK (premiere_type IN (
        'world_premiere',
        'international_premiere',
        'north_american_premiere',
        'us_premiere',
        'regional_premiere',
        'none'
    )),
    screening_dates JSONB, -- Array of {date, time, venue, type}
    premiere_date DATE, -- Primary premiere date

    -- Exclusivity
    exclusivity_required BOOLEAN DEFAULT false,
    exclusivity_start_date DATE,
    exclusivity_end_date DATE,
    exclusivity_territories TEXT[], -- Countries/regions

    -- Contact
    programmer_name TEXT,
    programmer_email TEXT,

    -- Documentation
    notes TEXT,
    press_kit_url TEXT,
    screener_url TEXT,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE festival_runs IS 'Tracks World submissions and screenings at film festivals';

CREATE INDEX idx_festival_runs_world ON festival_runs(world_id);
CREATE INDEX idx_festival_runs_status ON festival_runs(status);
CREATE INDEX idx_festival_runs_festival ON festival_runs(festival_slug);
CREATE INDEX idx_festival_runs_premiere ON festival_runs(premiere_date) WHERE premiere_date IS NOT NULL;
CREATE INDEX idx_festival_runs_exclusivity ON festival_runs(world_id, exclusivity_end_date)
    WHERE exclusivity_required = true;

-- =============================================================================
-- WORLD RELEASE WINDOWS: Define availability periods by distribution type
-- =============================================================================

CREATE TABLE IF NOT EXISTS world_release_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Window type
    window_type TEXT CHECK (window_type IN (
        'festival',           -- Festival exclusive period
        'platform_premiere',  -- SWN platform premiere
        'platform_wide',      -- General platform availability
        'premium_exclusive',  -- Premium/Order members only
        'venue_exclusive',    -- Specific venue partners only
        'theatrical',         -- Traditional theatrical release
        'broadcast',          -- TV/streaming broadcast rights
        'physical',           -- DVD/Blu-ray
        'other'
    )) NOT NULL,

    -- Timing
    start_date DATE NOT NULL,
    end_date DATE, -- NULL = indefinite

    -- Geographic scope
    territories JSONB DEFAULT '["WORLDWIDE"]'::jsonb, -- ISO country codes or "WORLDWIDE"
    excluded_territories JSONB DEFAULT '[]'::jsonb,

    -- Linked entities
    festival_run_id UUID REFERENCES festival_runs(id),
    venue_deal_id UUID, -- Forward reference to venue_deals

    -- Priority (higher = takes precedence)
    priority INTEGER DEFAULT 0,

    -- Status
    status TEXT CHECK (status IN ('planned', 'active', 'completed', 'cancelled')) DEFAULT 'planned',

    -- Metadata
    notes TEXT,
    rights_holder TEXT, -- Who controls rights during this window

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE world_release_windows IS 'Defines availability windows for World distribution';

CREATE INDEX idx_release_windows_world ON world_release_windows(world_id);
CREATE INDEX idx_release_windows_type ON world_release_windows(window_type);
CREATE INDEX idx_release_windows_dates ON world_release_windows(start_date, end_date);
CREATE INDEX idx_release_windows_active ON world_release_windows(world_id, start_date, end_date)
    WHERE status = 'active';

-- =============================================================================
-- VENUE PARTNERS: Churches, theaters, bars, airlines, etc.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venue_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,

    -- Classification
    venue_type TEXT CHECK (venue_type IN (
        'church',           -- Church/religious org
        'theater',          -- Independent theater
        'cinema_chain',     -- Theater chain
        'bar_restaurant',   -- Bar/restaurant screening venue
        'college',          -- College/university
        'community',        -- Community center
        'airline',          -- In-flight entertainment
        'hotel',            -- Hotel entertainment
        'cruise',           -- Cruise ship
        'streaming',        -- Other streaming platform
        'broadcast',        -- TV broadcaster
        'educational',      -- Educational institution
        'other'
    )) DEFAULT 'other',

    -- Geographic info
    region TEXT, -- Primary region
    territories TEXT[], -- Countries they operate in
    address JSONB, -- Primary address

    -- Contact
    primary_contact_name TEXT,
    primary_contact_email TEXT,
    primary_contact_phone TEXT,
    booking_contact_name TEXT,
    booking_contact_email TEXT,

    -- Technical capabilities
    screening_capabilities JSONB DEFAULT '{}'::jsonb,
    -- {
    --   "max_resolution": "4k",
    --   "audio_formats": ["stereo", "5.1", "7.1"],
    --   "delivery_formats": ["dcp", "hls", "mp4"],
    --   "has_projection": true,
    --   "seat_capacity": 200
    -- }

    -- Business terms (defaults)
    default_revenue_split_percent INTEGER, -- Venue's percentage
    minimum_guarantee_cents INTEGER,
    typical_license_fee_cents INTEGER,

    -- Status
    status TEXT CHECK (status IN (
        'prospect',       -- Potential partner
        'negotiating',    -- In discussions
        'active',         -- Active partnership
        'paused',         -- Temporarily inactive
        'terminated'      -- No longer partnered
    )) DEFAULT 'prospect',

    -- Partnership details
    partnership_start_date DATE,
    partnership_end_date DATE,
    contract_url TEXT,

    -- Stats (denormalized)
    total_deals INTEGER DEFAULT 0,
    total_screenings INTEGER DEFAULT 0,
    total_revenue_cents BIGINT DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE venue_partners IS 'Distribution partners for theatrical, venue, and alternative screenings';

CREATE INDEX idx_venue_partners_slug ON venue_partners(slug);
CREATE INDEX idx_venue_partners_type ON venue_partners(venue_type);
CREATE INDEX idx_venue_partners_status ON venue_partners(status) WHERE status = 'active';
CREATE INDEX idx_venue_partners_region ON venue_partners(region);

-- =============================================================================
-- VENUE DEALS: Specific distribution agreements
-- =============================================================================

CREATE TABLE IF NOT EXISTS venue_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    venue_partner_id UUID NOT NULL REFERENCES venue_partners(id) ON DELETE RESTRICT,

    -- Deal details
    deal_type TEXT CHECK (deal_type IN (
        'license',          -- Flat license fee
        'revenue_share',    -- Percentage of revenue
        'hybrid',           -- Guarantee + revenue share
        'promotional',      -- Free/promotional screening
        'subscription'      -- Part of venue's subscription
    )) NOT NULL DEFAULT 'license',

    -- Rights granted
    rights_type TEXT CHECK (rights_type IN (
        'screening_only',       -- Single/limited screenings
        'theatrical',           -- Theatrical exhibition
        'non_theatrical',       -- Non-theatrical (churches, bars)
        'broadcast',            -- TV broadcast
        'streaming',            -- Digital streaming
        'educational',          -- Educational use
        'airline_hotel',        -- In-flight/in-room
        'all_media'             -- All rights
    )) DEFAULT 'screening_only',

    -- Terms
    license_fee_cents INTEGER,
    minimum_guarantee_cents INTEGER,
    revenue_split_percent INTEGER, -- Venue's percentage
    per_screening_fee_cents INTEGER,
    max_screenings INTEGER,

    -- Period
    start_date DATE NOT NULL,
    end_date DATE,

    -- Territory
    territories JSONB DEFAULT '["WORLDWIDE"]'::jsonb,
    excluded_territories JSONB DEFAULT '[]'::jsonb,

    -- Exclusivity
    is_exclusive BOOLEAN DEFAULT false,
    exclusive_territory TEXT, -- If exclusive, where

    -- Status
    status TEXT CHECK (status IN (
        'draft',
        'proposed',
        'negotiating',
        'pending_approval',
        'active',
        'completed',
        'expired',
        'terminated',
        'cancelled'
    )) DEFAULT 'draft',

    -- Performance
    total_screenings INTEGER DEFAULT 0,
    total_attendance INTEGER DEFAULT 0,
    gross_revenue_cents BIGINT DEFAULT 0,
    net_revenue_cents BIGINT DEFAULT 0,
    creator_earnings_cents BIGINT DEFAULT 0,

    -- Documentation
    contract_url TEXT,
    deliverables_notes TEXT,
    delivery_format TEXT, -- DCP, HLS, etc.
    technical_requirements TEXT,

    -- Approval
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,

    -- Audit
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE venue_deals IS 'Distribution deals between Worlds and venue partners';

CREATE INDEX idx_venue_deals_world ON venue_deals(world_id);
CREATE INDEX idx_venue_deals_venue ON venue_deals(venue_partner_id);
CREATE INDEX idx_venue_deals_status ON venue_deals(status) WHERE status = 'active';
CREATE INDEX idx_venue_deals_dates ON venue_deals(start_date, end_date);

-- Add venue_deal_id foreign key now that table exists
ALTER TABLE world_release_windows
    ADD CONSTRAINT fk_release_windows_venue_deal
    FOREIGN KEY (venue_deal_id) REFERENCES venue_deals(id);

-- =============================================================================
-- VENUE SCREENINGS: Individual screening events
-- =============================================================================

CREATE TABLE IF NOT EXISTS venue_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_deal_id UUID NOT NULL REFERENCES venue_deals(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id),
    venue_partner_id UUID NOT NULL REFERENCES venue_partners(id),

    -- Screening details
    screening_date DATE NOT NULL,
    screening_time TIME,
    timezone TEXT DEFAULT 'America/Los_Angeles',

    -- Venue location (for chains with multiple locations)
    location_name TEXT,
    location_address JSONB,

    -- Attendance
    tickets_sold INTEGER DEFAULT 0,
    attendance INTEGER DEFAULT 0,
    capacity INTEGER,

    -- Revenue
    gross_revenue_cents INTEGER DEFAULT 0,
    ticket_price_cents INTEGER,

    -- Status
    status TEXT CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')) DEFAULT 'scheduled',

    -- Event details
    is_premiere BOOLEAN DEFAULT false,
    has_qa BOOLEAN DEFAULT false,
    qa_participants TEXT[], -- Names of people doing Q&A
    special_guests TEXT[],

    -- Reporting
    reported_at TIMESTAMPTZ,
    reported_by UUID REFERENCES profiles(id),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE venue_screenings IS 'Individual screening events under venue deals';

CREATE INDEX idx_venue_screenings_deal ON venue_screenings(venue_deal_id);
CREATE INDEX idx_venue_screenings_world ON venue_screenings(world_id);
CREATE INDEX idx_venue_screenings_date ON venue_screenings(screening_date);
CREATE INDEX idx_venue_screenings_venue ON venue_screenings(venue_partner_id);

-- =============================================================================
-- WORLD DISTRIBUTION STRATEGY: Overall distribution plan
-- =============================================================================

-- Add distribution strategy fields to worlds table
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS festival_strategy TEXT
    CHECK (festival_strategy IN ('none', 'light', 'heavy')) DEFAULT 'none';
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS primary_premiere_date DATE;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS platform_release_date DATE;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS distribution_status TEXT
    CHECK (distribution_status IN (
        'pre_production',
        'in_production',
        'post_production',
        'festival_circuit',
        'platform_premiere',
        'platform_wide',
        'archived'
    ));
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS distribution_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_worlds_festival_strategy ON worlds(festival_strategy)
    WHERE festival_strategy != 'none';
CREATE INDEX IF NOT EXISTS idx_worlds_distribution_status ON worlds(distribution_status);
CREATE INDEX IF NOT EXISTS idx_worlds_premiere_date ON worlds(primary_premiere_date)
    WHERE primary_premiere_date IS NOT NULL;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if a World is currently in an exclusive window
CREATE OR REPLACE FUNCTION world_has_active_exclusivity(p_world_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_exclusivity BOOLEAN;
BEGIN
    -- Check festival exclusivity
    SELECT EXISTS (
        SELECT 1 FROM festival_runs
        WHERE world_id = p_world_id
          AND exclusivity_required = true
          AND status IN ('accepted', 'screened')
          AND exclusivity_start_date <= CURRENT_DATE
          AND (exclusivity_end_date IS NULL OR exclusivity_end_date >= CURRENT_DATE)
    ) INTO has_exclusivity;

    IF has_exclusivity THEN
        RETURN true;
    END IF;

    -- Check venue exclusivity
    SELECT EXISTS (
        SELECT 1 FROM venue_deals
        WHERE world_id = p_world_id
          AND is_exclusive = true
          AND status = 'active'
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ) INTO has_exclusivity;

    RETURN has_exclusivity;
END;
$$ LANGUAGE plpgsql;

-- Function to get current release window type for a World
CREATE OR REPLACE FUNCTION get_current_release_window(p_world_id UUID)
RETURNS TABLE (
    window_type TEXT,
    window_id UUID,
    start_date DATE,
    end_date DATE,
    territories JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        wrw.window_type,
        wrw.id,
        wrw.start_date,
        wrw.end_date,
        wrw.territories
    FROM world_release_windows wrw
    WHERE wrw.world_id = p_world_id
      AND wrw.status = 'active'
      AND wrw.start_date <= CURRENT_DATE
      AND (wrw.end_date IS NULL OR wrw.end_date >= CURRENT_DATE)
    ORDER BY wrw.priority DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check platform availability
CREATE OR REPLACE FUNCTION world_available_on_platform(p_world_id UUID, p_territory TEXT DEFAULT 'US')
RETURNS BOOLEAN AS $$
DECLARE
    current_window RECORD;
    is_available BOOLEAN;
BEGIN
    -- Get current highest-priority window
    SELECT * INTO current_window
    FROM get_current_release_window(p_world_id);

    -- If no active window, check if there's any release window at all
    IF current_window IS NULL THEN
        -- No active window - check if World is published
        SELECT (status = 'active' AND visibility = 'public')
        INTO is_available
        FROM worlds WHERE id = p_world_id;

        RETURN COALESCE(is_available, false);
    END IF;

    -- Check window type
    IF current_window.window_type IN ('platform_premiere', 'platform_wide', 'premium_exclusive') THEN
        -- Check territory
        IF current_window.territories @> to_jsonb(p_territory)
           OR current_window.territories @> '"WORLDWIDE"'::jsonb THEN
            RETURN true;
        END IF;
    END IF;

    -- Festival or venue exclusive windows block platform
    IF current_window.window_type IN ('festival', 'venue_exclusive', 'theatrical') THEN
        RETURN false;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE TRIGGER trg_festival_runs_updated_at
BEFORE UPDATE ON festival_runs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_release_windows_updated_at
BEFORE UPDATE ON world_release_windows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_venue_partners_updated_at
BEFORE UPDATE ON venue_partners
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_venue_deals_updated_at
BEFORE UPDATE ON venue_deals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_venue_screenings_updated_at
BEFORE UPDATE ON venue_screenings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update venue partner stats when deals change
CREATE OR REPLACE FUNCTION update_venue_partner_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE venue_partners
    SET
        total_deals = (SELECT COUNT(*) FROM venue_deals WHERE venue_partner_id = COALESCE(NEW.venue_partner_id, OLD.venue_partner_id)),
        total_revenue_cents = (SELECT COALESCE(SUM(gross_revenue_cents), 0) FROM venue_deals WHERE venue_partner_id = COALESCE(NEW.venue_partner_id, OLD.venue_partner_id))
    WHERE id = COALESCE(NEW.venue_partner_id, OLD.venue_partner_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venue_deals_stats
AFTER INSERT OR UPDATE OR DELETE ON venue_deals
FOR EACH ROW EXECUTE FUNCTION update_venue_partner_stats();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: World festival status summary
CREATE OR REPLACE VIEW v_world_festival_summary AS
SELECT
    w.id as world_id,
    w.title as world_title,
    w.festival_strategy,
    w.distribution_status,
    w.primary_premiere_date,
    COUNT(fr.id) as total_submissions,
    COUNT(fr.id) FILTER (WHERE fr.status = 'accepted') as accepted_count,
    COUNT(fr.id) FILTER (WHERE fr.status = 'awarded') as awards_count,
    ARRAY_AGG(DISTINCT fr.festival_name) FILTER (WHERE fr.status IN ('accepted', 'screened', 'awarded')) as accepted_festivals,
    (SELECT array_agg(aw) FROM festival_runs fr2, unnest(fr2.awards_won) aw WHERE fr2.world_id = w.id) as all_awards
FROM worlds w
LEFT JOIN festival_runs fr ON w.id = fr.world_id
GROUP BY w.id, w.title, w.festival_strategy, w.distribution_status, w.primary_premiere_date;

-- View: Active venue deals with partner info
CREATE OR REPLACE VIEW v_active_venue_deals AS
SELECT
    vd.*,
    w.title as world_title,
    w.slug as world_slug,
    vp.name as venue_name,
    vp.venue_type,
    vp.region as venue_region
FROM venue_deals vd
JOIN worlds w ON vd.world_id = w.id
JOIN venue_partners vp ON vd.venue_partner_id = vp.id
WHERE vd.status = 'active'
  AND vd.start_date <= CURRENT_DATE
  AND (vd.end_date IS NULL OR vd.end_date >= CURRENT_DATE);

-- View: World availability status
CREATE OR REPLACE VIEW v_world_availability AS
SELECT
    w.id as world_id,
    w.title,
    w.slug,
    w.status as world_status,
    w.visibility,
    w.distribution_status,
    world_has_active_exclusivity(w.id) as has_active_exclusivity,
    world_available_on_platform(w.id, 'US') as available_platform_us,
    (SELECT window_type FROM get_current_release_window(w.id)) as current_window_type,
    (SELECT COUNT(*) FROM venue_deals vd WHERE vd.world_id = w.id AND vd.status = 'active') as active_venue_deals
FROM worlds w
WHERE w.status != 'archived';
