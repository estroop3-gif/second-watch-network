-- Migration 085: I18n, Onboarding, and Dailies Pipeline
-- Phase 4C: Creator UX upgrades and internationalization groundwork
--
-- This migration:
-- 1. Adds i18n tables for World/Episode localization
-- 2. Creates World onboarding state tracking
-- 3. Enhances Backlot dailies pipeline integration
-- 4. Adds region/territory support

BEGIN;

-- =============================================================================
-- PART 1: Internationalization (i18n) Scaffolding
-- =============================================================================

-- Supported languages enum
CREATE TYPE supported_language AS ENUM (
    'en',      -- English (default)
    'es',      -- Spanish
    'pt',      -- Portuguese
    'fr',      -- French
    'de',      -- German
    'it',      -- Italian
    'zh',      -- Chinese (Simplified)
    'zh_tw',   -- Chinese (Traditional)
    'ja',      -- Japanese
    'ko',      -- Korean
    'ar',      -- Arabic
    'ru',      -- Russian
    'hi',      -- Hindi
    'tl'       -- Tagalog/Filipino
);

-- World translations
CREATE TABLE IF NOT EXISTS world_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    language supported_language NOT NULL,

    -- Translated fields
    title TEXT NOT NULL,
    logline TEXT,
    description TEXT,
    keywords TEXT[],

    -- Translation metadata
    is_machine_translated BOOLEAN DEFAULT false,
    translator_id UUID REFERENCES profiles(id),
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, language)
);

CREATE INDEX IF NOT EXISTS idx_world_translations_world ON world_translations(world_id);
CREATE INDEX IF NOT EXISTS idx_world_translations_language ON world_translations(language);

-- Episode translations
CREATE TABLE IF NOT EXISTS episode_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    language supported_language NOT NULL,

    -- Translated fields
    title TEXT NOT NULL,
    description TEXT,

    -- Subtitle/CC info
    has_subtitles BOOLEAN DEFAULT false,
    subtitle_url TEXT,
    has_dubbing BOOLEAN DEFAULT false,
    dub_audio_url TEXT,

    -- Translation metadata
    is_machine_translated BOOLEAN DEFAULT false,
    translator_id UUID REFERENCES profiles(id),
    verified BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(episode_id, language)
);

CREATE INDEX IF NOT EXISTS idx_episode_translations_episode ON episode_translations(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_translations_language ON episode_translations(language);

-- User language preference
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS preferred_language supported_language DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS secondary_languages supported_language[] DEFAULT '{}';

-- =============================================================================
-- PART 2: Region/Territory Support
-- =============================================================================

-- Region codes (ISO 3166-1 alpha-2)
-- Using TEXT for flexibility, but common codes listed here for reference
COMMENT ON TABLE worlds IS 'World records. Region codes use ISO 3166-1 alpha-2 (US, GB, CA, AU, etc.)';

-- Add region fields to worlds
ALTER TABLE worlds
    ADD COLUMN IF NOT EXISTS available_regions TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS restricted_regions TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS default_region TEXT DEFAULT 'US',
    ADD COLUMN IF NOT EXISTS region_notes TEXT;

-- User region preference
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'US',
    ADD COLUMN IF NOT EXISTS detected_region TEXT;

-- Region-specific release windows
CREATE TABLE IF NOT EXISTS world_region_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    region TEXT NOT NULL,

    -- Release timing
    release_date DATE,
    release_time TIME,
    timezone TEXT DEFAULT 'UTC',

    -- Availability window
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,

    -- Region-specific pricing (future use)
    price_override_cents INTEGER,
    currency TEXT DEFAULT 'USD',

    -- Status
    status TEXT DEFAULT 'scheduled',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id, region),

    CONSTRAINT world_region_releases_status_check
        CHECK (status IN ('scheduled', 'available', 'ended', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_world_region_releases_world ON world_region_releases(world_id);
CREATE INDEX IF NOT EXISTS idx_world_region_releases_region ON world_region_releases(region, status);

-- =============================================================================
-- PART 3: World Onboarding State
-- =============================================================================

-- Onboarding checklist state
CREATE TABLE IF NOT EXISTS world_onboarding_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Checklist items
    metadata_complete BOOLEAN DEFAULT false,
    metadata_completed_at TIMESTAMPTZ,

    artwork_uploaded BOOLEAN DEFAULT false,
    artwork_completed_at TIMESTAMPTZ,
    cover_art_url TEXT,
    cover_art_wide_url TEXT,

    technical_specs_passed BOOLEAN DEFAULT false,
    technical_specs_at TIMESTAMPTZ,
    technical_issues TEXT[],

    first_episode_uploaded BOOLEAN DEFAULT false,
    first_episode_at TIMESTAMPTZ,
    first_episode_id UUID REFERENCES episodes(id),

    rights_docs_uploaded BOOLEAN DEFAULT false,
    rights_docs_at TIMESTAMPTZ,
    rights_doc_urls TEXT[],

    review_submitted BOOLEAN DEFAULT false,
    review_submitted_at TIMESTAMPTZ,
    review_task_id UUID REFERENCES content_review_tasks(id),

    -- Overall progress
    completion_percentage INTEGER DEFAULT 0,
    ready_for_review BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_id)
);

CREATE INDEX IF NOT EXISTS idx_world_onboarding_state_world ON world_onboarding_state(world_id);
CREATE INDEX IF NOT EXISTS idx_world_onboarding_state_ready ON world_onboarding_state(ready_for_review) WHERE ready_for_review = false;

-- =============================================================================
-- PART 4: Enhanced Backlot Dailies Pipeline
-- =============================================================================

-- Dailies processing status enum
CREATE TYPE dailies_processing_status AS ENUM (
    'pending',
    'uploading',
    'uploaded',
    'processing',
    'transcoding',
    'proxy_ready',
    'completed',
    'failed'
);

-- Extend backlot_dailies if exists, or create
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backlot_dailies') THEN
        -- Add new columns to existing table
        ALTER TABLE backlot_dailies
            ADD COLUMN IF NOT EXISTS processing_status dailies_processing_status DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS media_job_id UUID,
            ADD COLUMN IF NOT EXISTS proxy_url TEXT,
            ADD COLUMN IF NOT EXISTS proxy_ready_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
            ADD COLUMN IF NOT EXISTS processing_error TEXT,
            ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_processing_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS source_file_hash TEXT,
            ADD COLUMN IF NOT EXISTS source_file_size BIGINT;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE backlot_dailies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            shoot_day_id UUID,

            -- File info
            filename TEXT NOT NULL,
            source_url TEXT,
            source_file_size BIGINT,
            source_file_hash TEXT,

            -- Clip metadata
            clip_name TEXT,
            scene_number TEXT,
            take_number INTEGER,
            camera TEXT,
            codec TEXT,
            resolution TEXT,
            frame_rate TEXT,
            duration_seconds INTEGER,
            timecode_in TEXT,
            timecode_out TEXT,

            -- Processing
            processing_status dailies_processing_status DEFAULT 'pending',
            media_job_id UUID,
            proxy_url TEXT,
            proxy_ready_at TIMESTAMPTZ,
            thumbnail_url TEXT,
            processing_error TEXT,
            processing_attempts INTEGER DEFAULT 0,
            last_processing_at TIMESTAMPTZ,

            -- Metadata
            notes TEXT,
            tags TEXT[],
            is_circled BOOLEAN DEFAULT false,
            is_favorite BOOLEAN DEFAULT false,

            -- Uploader
            uploaded_by UUID REFERENCES profiles(id),

            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Index for dailies processing queue
CREATE INDEX IF NOT EXISTS idx_backlot_dailies_processing ON backlot_dailies(processing_status)
    WHERE processing_status IN ('pending', 'processing', 'transcoding', 'failed');

-- Dailies batch uploads
CREATE TABLE IF NOT EXISTS backlot_dailies_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    shoot_day_id UUID,

    -- Batch info
    batch_name TEXT,
    total_clips INTEGER DEFAULT 0,
    completed_clips INTEGER DEFAULT 0,
    failed_clips INTEGER DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'in_progress',

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),

    CONSTRAINT backlot_dailies_batches_status_check
        CHECK (status IN ('in_progress', 'completed', 'partial', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_backlot_dailies_batches_project ON backlot_dailies_batches(project_id, status);

-- Batch items link
CREATE TABLE IF NOT EXISTS backlot_dailies_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES backlot_dailies_batches(id) ON DELETE CASCADE,
    dailies_id UUID NOT NULL REFERENCES backlot_dailies(id) ON DELETE CASCADE,
    sequence_number INTEGER,
    UNIQUE(batch_id, dailies_id)
);

-- =============================================================================
-- PART 5: Views for i18n and Onboarding
-- =============================================================================

-- View for getting World with appropriate translation
CREATE OR REPLACE VIEW v_world_localized AS
SELECT
    w.id as world_id,
    w.slug,
    w.status,
    w.visibility,
    COALESCE(wt.title, w.title) as title,
    COALESCE(wt.logline, w.logline) as logline,
    COALESCE(wt.description, w.description) as description,
    wt.language as display_language,
    w.cover_art_url,
    w.cover_art_wide_url,
    w.world_category,
    w.content_format,
    w.maturity_rating,
    w.available_regions,
    w.restricted_regions
FROM worlds w
LEFT JOIN world_translations wt ON w.id = wt.world_id;

-- View for World onboarding progress
CREATE OR REPLACE VIEW v_world_onboarding_progress AS
SELECT
    w.id as world_id,
    w.title,
    w.slug,
    w.status,
    w.creator_id,
    wos.metadata_complete,
    wos.artwork_uploaded,
    wos.technical_specs_passed,
    wos.first_episode_uploaded,
    wos.rights_docs_uploaded,
    wos.review_submitted,
    wos.completion_percentage,
    wos.ready_for_review,
    wos.created_at as onboarding_started,
    wos.updated_at as last_progress_at,
    CASE
        WHEN wos.review_submitted THEN 'submitted_for_review'
        WHEN wos.ready_for_review THEN 'ready_to_submit'
        WHEN wos.first_episode_uploaded THEN 'content_uploaded'
        WHEN wos.artwork_uploaded THEN 'artwork_complete'
        WHEN wos.metadata_complete THEN 'metadata_complete'
        ELSE 'just_started'
    END as onboarding_stage
FROM worlds w
LEFT JOIN world_onboarding_state wos ON w.id = wos.world_id
WHERE w.status IN ('draft', 'pending_review');

-- View for dailies with processing issues
CREATE OR REPLACE VIEW v_dailies_issues AS
SELECT
    bd.id as dailies_id,
    bd.project_id,
    bd.filename,
    bd.processing_status,
    bd.processing_error,
    bd.processing_attempts,
    bd.last_processing_at,
    bd.created_at,
    bp.title as project_title
FROM backlot_dailies bd
LEFT JOIN backlot_projects bp ON bd.project_id = bp.id
WHERE bd.processing_status = 'failed'
   OR (bd.processing_status IN ('pending', 'processing', 'transcoding')
       AND bd.last_processing_at < NOW() - INTERVAL '1 hour');

-- =============================================================================
-- PART 6: Functions
-- =============================================================================

-- Function to get localized World data
CREATE OR REPLACE FUNCTION get_localized_world(
    p_world_id UUID,
    p_language supported_language DEFAULT 'en'
) RETURNS TABLE (
    world_id UUID,
    title TEXT,
    logline TEXT,
    description TEXT,
    language supported_language,
    is_translated BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        COALESCE(wt.title, w.title),
        COALESCE(wt.logline, w.logline),
        COALESCE(wt.description, w.description),
        COALESCE(wt.language, 'en'::supported_language),
        wt.id IS NOT NULL
    FROM worlds w
    LEFT JOIN world_translations wt ON w.id = wt.world_id AND wt.language = p_language
    WHERE w.id = p_world_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check region availability
CREATE OR REPLACE FUNCTION is_world_available_in_region(
    p_world_id UUID,
    p_region TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_world RECORD;
    v_release RECORD;
BEGIN
    -- Get World region settings
    SELECT available_regions, restricted_regions INTO v_world
    FROM worlds WHERE id = p_world_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Check if explicitly restricted
    IF p_region = ANY(v_world.restricted_regions) THEN
        RETURN false;
    END IF;

    -- Check if available_regions is empty (means all regions)
    IF array_length(v_world.available_regions, 1) IS NULL OR
       array_length(v_world.available_regions, 1) = 0 THEN
        -- Check release window
        SELECT * INTO v_release
        FROM world_region_releases
        WHERE world_id = p_world_id AND region = p_region;

        IF NOT FOUND THEN
            RETURN true;  -- No specific release, so available
        END IF;

        RETURN v_release.status = 'available' AND
               (v_release.available_from IS NULL OR v_release.available_from <= NOW()) AND
               (v_release.available_until IS NULL OR v_release.available_until > NOW());
    END IF;

    -- Check if in available regions
    RETURN p_region = ANY(v_world.available_regions);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate onboarding completion
CREATE OR REPLACE FUNCTION calculate_onboarding_completion(p_world_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_state RECORD;
    v_score INTEGER := 0;
BEGIN
    SELECT * INTO v_state
    FROM world_onboarding_state
    WHERE world_id = p_world_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Each item worth 20% (5 items = 100%)
    IF v_state.metadata_complete THEN v_score := v_score + 20; END IF;
    IF v_state.artwork_uploaded THEN v_score := v_score + 20; END IF;
    IF v_state.technical_specs_passed THEN v_score := v_score + 15; END IF;
    IF v_state.first_episode_uploaded THEN v_score := v_score + 25; END IF;
    IF v_state.rights_docs_uploaded THEN v_score := v_score + 20; END IF;

    -- Update the record
    UPDATE world_onboarding_state
    SET completion_percentage = v_score,
        ready_for_review = (v_score >= 80),
        updated_at = NOW()
    WHERE world_id = p_world_id;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create media jobs for dailies
CREATE OR REPLACE FUNCTION create_dailies_media_job()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger on new uploads with source_url
    IF NEW.source_url IS NOT NULL AND NEW.processing_status = 'uploaded' THEN
        -- Update to processing status
        NEW.processing_status := 'processing';
        NEW.last_processing_at := NOW();

        -- Note: Actual media job creation would be done by the application
        -- This trigger just marks it ready for processing
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dailies_auto_process ON backlot_dailies;
CREATE TRIGGER trg_dailies_auto_process
    BEFORE UPDATE OF source_url, processing_status ON backlot_dailies
    FOR EACH ROW
    WHEN (NEW.source_url IS NOT NULL AND OLD.processing_status = 'uploading')
    EXECUTE FUNCTION create_dailies_media_job();

-- =============================================================================
-- PART 7: Initialize Onboarding for Existing Draft Worlds
-- =============================================================================

INSERT INTO world_onboarding_state (world_id, metadata_complete)
SELECT id, true
FROM worlds
WHERE status IN ('draft', 'pending_review')
  AND id NOT IN (SELECT world_id FROM world_onboarding_state)
ON CONFLICT (world_id) DO NOTHING;

COMMIT;
