-- Migration 088: Live Production & Experimental Features
-- Phase 5C: Live/remote production tooling and experimental scaffolding
-- Created: 2025-01-02

-- =============================================================================
-- PART 1: LIVE PRODUCTION INTEGRATION
-- =============================================================================

-- Link live productions (Backlot projects) to streaming worlds
-- Enables behind-the-scenes content and production updates in consumer apps
CREATE TABLE IF NOT EXISTS live_production_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The Backlot project being produced
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- The World where production content appears
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,

    -- Link configuration
    link_type TEXT NOT NULL DEFAULT 'behind_the_scenes',
    -- Types: 'behind_the_scenes', 'production_updates', 'live_from_set', 'premiere_countdown'

    -- Visibility controls
    is_active BOOLEAN DEFAULT true,
    show_on_world_page BOOLEAN DEFAULT true,
    show_production_calendar BOOLEAN DEFAULT false,
    show_crew_highlights BOOLEAN DEFAULT false,
    allow_fan_engagement BOOLEAN DEFAULT false,

    -- Auto-content settings
    auto_create_episodes_from_dailies BOOLEAN DEFAULT false,
    dailies_episode_visibility TEXT DEFAULT 'premium', -- public, premium, private

    -- Schedule overrides
    content_embargo_until TIMESTAMPTZ,
    live_updates_enabled BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),

    UNIQUE(project_id, world_id)
);

-- Production update posts (visible to World followers)
CREATE TABLE IF NOT EXISTS production_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES live_production_links(id) ON DELETE CASCADE,

    -- Content
    update_type TEXT NOT NULL DEFAULT 'text',
    -- Types: 'text', 'photo', 'video', 'milestone', 'wrap', 'premiere_announcement'

    title TEXT,
    content TEXT,
    media_urls JSONB DEFAULT '[]'::jsonb,

    -- Milestone tracking
    milestone_type TEXT, -- 'first_day', 'halfway', 'picture_wrap', 'post_complete', etc.
    production_day_id UUID REFERENCES backlot_production_days(id),

    -- Visibility
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    visibility TEXT DEFAULT 'public', -- public, premium, private

    -- Engagement
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_production_updates_link ON production_updates(link_id, is_published, published_at DESC);

-- =============================================================================
-- PART 2: WATCH PARTIES
-- =============================================================================

-- Watch party status enum
DO $$ BEGIN
    CREATE TYPE watch_party_status AS ENUM (
        'scheduled',
        'waiting',    -- Host has opened party, waiting to start
        'active',     -- Currently playing
        'paused',
        'ended',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Watch party participant role
DO $$ BEGIN
    CREATE TYPE party_participant_role AS ENUM (
        'host',
        'co_host',
        'moderator',
        'viewer'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Watch parties allow synchronized viewing with friends/community
CREATE TABLE IF NOT EXISTS watch_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Party details
    title TEXT NOT NULL,
    description TEXT,

    -- What's being watched
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    -- If episode_id is null, watching the "next episode" or World intro

    -- Host information
    host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Party type
    party_type TEXT NOT NULL DEFAULT 'private',
    -- Types: 'private' (invite only), 'friends' (host's connections), 'public', 'premiere' (official)

    -- Scheduling
    scheduled_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Status
    status watch_party_status DEFAULT 'scheduled',

    -- Playback state (for sync)
    current_position_ms BIGINT DEFAULT 0,
    is_playing BOOLEAN DEFAULT false,
    playback_rate NUMERIC(3,2) DEFAULT 1.0,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),

    -- Capacity
    max_participants INTEGER DEFAULT 50,
    current_participant_count INTEGER DEFAULT 0,

    -- Features
    chat_enabled BOOLEAN DEFAULT true,
    reactions_enabled BOOLEAN DEFAULT true,
    voice_chat_enabled BOOLEAN DEFAULT false,
    video_chat_enabled BOOLEAN DEFAULT false,

    -- Access control
    requires_premium BOOLEAN DEFAULT false,
    invite_code TEXT UNIQUE,

    -- Engagement stats
    peak_participants INTEGER DEFAULT 0,
    total_chat_messages INTEGER DEFAULT 0,
    total_reactions INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_parties_host ON watch_parties(host_id, status);
CREATE INDEX IF NOT EXISTS idx_watch_parties_world ON watch_parties(world_id, status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_watch_parties_public ON watch_parties(party_type, status, scheduled_start)
    WHERE party_type IN ('public', 'premiere');
CREATE INDEX IF NOT EXISTS idx_watch_parties_invite ON watch_parties(invite_code) WHERE invite_code IS NOT NULL;

-- Watch party participants
CREATE TABLE IF NOT EXISTS watch_party_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES watch_parties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    role party_participant_role DEFAULT 'viewer',

    -- Participation tracking
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,

    -- Individual state (for sync verification)
    last_reported_position_ms BIGINT,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    is_synced BOOLEAN DEFAULT true,
    sync_offset_ms INTEGER DEFAULT 0,

    -- Interaction stats
    chat_messages_sent INTEGER DEFAULT 0,
    reactions_sent INTEGER DEFAULT 0,

    -- Permissions (for moderation)
    can_chat BOOLEAN DEFAULT true,
    is_muted BOOLEAN DEFAULT false,

    UNIQUE(party_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_party_participants_user ON watch_party_participants(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_party_participants_active ON watch_party_participants(party_id, is_active);

-- Watch party chat messages
CREATE TABLE IF NOT EXISTS watch_party_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES watch_parties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    message_type TEXT NOT NULL DEFAULT 'chat',
    -- Types: 'chat', 'reaction', 'system', 'timestamp_comment'

    content TEXT,
    reaction_emoji TEXT, -- For reaction type

    -- Timestamp reference (for timestamp comments)
    episode_position_ms BIGINT,

    -- Moderation
    is_deleted BOOLEAN DEFAULT false,
    deleted_by UUID REFERENCES profiles(id),
    deleted_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_messages_party ON watch_party_messages(party_id, created_at);

-- Watch party invitations
CREATE TABLE IF NOT EXISTS watch_party_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES watch_parties(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invited_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    invited_email TEXT, -- For non-members

    status TEXT DEFAULT 'pending', -- pending, accepted, declined, expired

    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,

    UNIQUE(party_id, invited_user_id)
);

-- =============================================================================
-- PART 3: VR/AR METADATA SCAFFOLDING
-- =============================================================================

-- VR/AR content type
DO $$ BEGIN
    CREATE TYPE immersive_content_type AS ENUM (
        'vr_180',           -- 180-degree VR video
        'vr_360',           -- 360-degree VR video
        'vr_interactive',   -- Interactive VR experience
        'ar_overlay',       -- AR overlay for real-world viewing
        'ar_companion',     -- AR companion app content
        'spatial_video',    -- Apple Vision Pro spatial video
        'volumetric'        -- Volumetric capture
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Immersive media metadata (extends video_assets)
CREATE TABLE IF NOT EXISTS immersive_media_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to video asset or episode
    video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,

    -- Content type
    content_type immersive_content_type NOT NULL,

    -- Technical specifications
    field_of_view_degrees INTEGER, -- e.g., 180, 360
    stereo_mode TEXT, -- 'mono', 'top_bottom', 'side_by_side'
    projection_type TEXT, -- 'equirectangular', 'cubemap', 'mesh'

    -- Resolution per eye (for VR)
    resolution_width_per_eye INTEGER,
    resolution_height_per_eye INTEGER,

    -- Spatial audio
    has_spatial_audio BOOLEAN DEFAULT false,
    spatial_audio_format TEXT, -- 'ambisonics', 'object_based', 'channel_based'
    audio_channel_count INTEGER,

    -- Interaction zones (for interactive VR)
    interaction_zones JSONB DEFAULT '[]'::jsonb,
    -- [{zone_id, type, position, trigger_episode_id, trigger_timestamp_ms}]

    -- AR-specific
    ar_anchor_type TEXT, -- 'world', 'face', 'image', 'plane'
    ar_reference_image_url TEXT,
    ar_scale_meters NUMERIC(10,4),

    -- Volumetric capture
    volumetric_format TEXT, -- 'point_cloud', 'mesh_sequence', 'neural_radiance'
    volumetric_mesh_url TEXT,

    -- Compatibility
    compatible_devices JSONB DEFAULT '[]'::jsonb,
    -- ['meta_quest_3', 'apple_vision_pro', 'pico_4', 'htc_vive']

    minimum_device_specs JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT false,
    is_experimental BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CHECK (video_asset_id IS NOT NULL OR episode_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_immersive_metadata_asset ON immersive_media_metadata(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_immersive_metadata_episode ON immersive_media_metadata(episode_id);

-- AR companion content (links to episodes/scenes)
CREATE TABLE IF NOT EXISTS ar_companion_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,

    -- Trigger timing
    trigger_type TEXT NOT NULL, -- 'timestamp', 'scene', 'manual', 'audio_watermark'
    trigger_timestamp_ms BIGINT,
    scene_identifier TEXT,

    -- Content
    content_type TEXT NOT NULL, -- '3d_model', 'info_card', 'behind_scenes', 'character_bio'
    content_title TEXT,
    content_description TEXT,

    -- 3D model data
    model_url TEXT,
    model_format TEXT, -- 'glb', 'usdz', 'fbx'
    model_scale NUMERIC(10,4) DEFAULT 1.0,
    model_animation TEXT,

    -- Info card data
    card_image_url TEXT,
    card_body_text TEXT,
    card_link_url TEXT,

    -- Display settings
    display_duration_seconds INTEGER DEFAULT 30,
    auto_dismiss BOOLEAN DEFAULT true,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_companion_episode ON ar_companion_content(episode_id, trigger_timestamp_ms);

-- =============================================================================
-- PART 4: BLOCKCHAIN ROYALTY LEDGER (EXPERIMENTAL)
-- =============================================================================

-- Blockchain integration status
DO $$ BEGIN
    CREATE TYPE blockchain_tx_status AS ENUM (
        'pending',
        'submitted',
        'confirmed',
        'failed',
        'reverted'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Opt-in settings for blockchain royalty tracking
CREATE TABLE IF NOT EXISTS creator_blockchain_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Creator or organization
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Opt-in status
    is_enabled BOOLEAN DEFAULT false,
    opted_in_at TIMESTAMPTZ,
    opted_out_at TIMESTAMPTZ,

    -- Wallet configuration
    wallet_address TEXT,
    wallet_chain TEXT DEFAULT 'polygon', -- ethereum, polygon, solana, etc.
    wallet_verified BOOLEAN DEFAULT false,
    wallet_verified_at TIMESTAMPTZ,

    -- NFT minting preferences
    mint_nfts_for_purchases BOOLEAN DEFAULT false,
    nft_contract_address TEXT,

    -- Royalty logging preferences
    log_all_earnings BOOLEAN DEFAULT true,
    log_distributions BOOLEAN DEFAULT true,
    log_secondary_sales BOOLEAN DEFAULT false,

    -- Privacy settings
    public_ledger_visibility TEXT DEFAULT 'anonymous', -- anonymous, pseudonymous, public

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CHECK (profile_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blockchain_settings_profile
    ON creator_blockchain_settings(profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_blockchain_settings_org
    ON creator_blockchain_settings(organization_id) WHERE organization_id IS NOT NULL;

-- Blockchain royalty ledger entries
-- Immutable log of all earnings for on-chain verification
CREATE TABLE IF NOT EXISTS blockchain_royalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to internal records
    world_earning_id UUID REFERENCES world_earnings(id),
    payout_id UUID REFERENCES creator_payouts(id),

    -- Recipient
    recipient_type TEXT NOT NULL, -- 'creator', 'organization'
    recipient_id UUID NOT NULL,
    wallet_address TEXT,

    -- Amount
    amount_cents BIGINT NOT NULL,
    currency TEXT DEFAULT 'USD',

    -- Context
    earning_type TEXT NOT NULL, -- 'watch_share', 'direct_sale', 'tip', 'ad_revenue', 'license_fee'
    world_id UUID REFERENCES worlds(id),
    period_start DATE,
    period_end DATE,

    -- Blockchain transaction
    tx_chain TEXT, -- ethereum, polygon, solana
    tx_hash TEXT,
    tx_status blockchain_tx_status DEFAULT 'pending',
    tx_submitted_at TIMESTAMPTZ,
    tx_confirmed_at TIMESTAMPTZ,
    tx_block_number BIGINT,
    tx_gas_used BIGINT,
    tx_error TEXT,

    -- IPFS/Arweave metadata storage
    metadata_cid TEXT, -- Content identifier for detailed metadata

    -- Verification
    internal_hash TEXT, -- SHA256 of internal record for verification

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(world_earning_id) -- One ledger entry per earning
);

CREATE INDEX IF NOT EXISTS idx_blockchain_ledger_recipient ON blockchain_royalty_ledger(recipient_type, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blockchain_ledger_pending ON blockchain_royalty_ledger(tx_status) WHERE tx_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_blockchain_ledger_world ON blockchain_royalty_ledger(world_id, created_at DESC);

-- NFT minted for content ownership/purchases
CREATE TABLE IF NOT EXISTS content_nfts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What the NFT represents
    content_type TEXT NOT NULL, -- 'world_ownership', 'episode_purchase', 'collectible', 'badge'
    world_id UUID REFERENCES worlds(id),
    episode_id UUID REFERENCES episodes(id),

    -- Owner
    owner_profile_id UUID REFERENCES profiles(id),
    owner_wallet_address TEXT,

    -- NFT details
    token_id TEXT,
    contract_address TEXT,
    chain TEXT DEFAULT 'polygon',

    -- Metadata
    metadata_uri TEXT,
    image_uri TEXT,

    -- Minting info
    minted_at TIMESTAMPTZ,
    mint_tx_hash TEXT,

    -- Transfer history reference
    transfer_count INTEGER DEFAULT 0,
    last_transfer_at TIMESTAMPTZ,

    -- Royalty settings (for secondary sales)
    royalty_percentage NUMERIC(5,2) DEFAULT 10.0, -- 10% default
    royalty_recipient_address TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_nfts_owner ON content_nfts(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_content_nfts_world ON content_nfts(world_id);
CREATE INDEX IF NOT EXISTS idx_content_nfts_token ON content_nfts(chain, contract_address, token_id);

-- =============================================================================
-- PART 5: HELPER VIEWS
-- =============================================================================

-- Active watch parties view
CREATE OR REPLACE VIEW v_active_watch_parties AS
SELECT
    wp.id,
    wp.title,
    wp.party_type,
    wp.status,
    wp.world_id,
    w.title as world_title,
    wp.episode_id,
    e.title as episode_title,
    wp.host_id,
    p.display_name as host_name,
    p.avatar_url as host_avatar,
    wp.scheduled_start,
    wp.actual_start,
    wp.current_participant_count,
    wp.max_participants,
    wp.chat_enabled,
    wp.voice_chat_enabled
FROM watch_parties wp
JOIN worlds w ON wp.world_id = w.id
JOIN profiles p ON wp.host_id = p.id
LEFT JOIN episodes e ON wp.episode_id = e.id
WHERE wp.status IN ('scheduled', 'waiting', 'active', 'paused')
ORDER BY
    CASE wp.status
        WHEN 'active' THEN 1
        WHEN 'waiting' THEN 2
        WHEN 'paused' THEN 3
        ELSE 4
    END,
    wp.scheduled_start;

-- Production updates feed view
CREATE OR REPLACE VIEW v_production_updates_feed AS
SELECT
    pu.id,
    pu.update_type,
    pu.title,
    pu.content,
    pu.media_urls,
    pu.milestone_type,
    pu.published_at,
    pu.likes_count,
    pu.comments_count,
    lpl.world_id,
    w.title as world_title,
    lpl.project_id,
    bp.title as project_title,
    pu.created_by,
    p.display_name as author_name,
    p.avatar_url as author_avatar
FROM production_updates pu
JOIN live_production_links lpl ON pu.link_id = lpl.id
JOIN worlds w ON lpl.world_id = w.id
JOIN backlot_projects bp ON lpl.project_id = bp.id
LEFT JOIN profiles p ON pu.created_by = p.id
WHERE pu.is_published = true
  AND lpl.is_active = true
ORDER BY pu.published_at DESC;

-- Blockchain earnings summary view
CREATE OR REPLACE VIEW v_blockchain_earnings_summary AS
SELECT
    recipient_type,
    recipient_id,
    wallet_address,
    COUNT(*) as total_entries,
    SUM(amount_cents) as total_earnings_cents,
    COUNT(CASE WHEN tx_status = 'confirmed' THEN 1 END) as confirmed_entries,
    SUM(CASE WHEN tx_status = 'confirmed' THEN amount_cents ELSE 0 END) as confirmed_earnings_cents,
    MIN(created_at) as first_earning_at,
    MAX(created_at) as last_earning_at
FROM blockchain_royalty_ledger
GROUP BY recipient_type, recipient_id, wallet_address;

-- =============================================================================
-- PART 6: UTILITY FUNCTIONS
-- =============================================================================

-- Generate unique invite code for watch party
CREATE OR REPLACE FUNCTION generate_party_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Sync watch party playback position
CREATE OR REPLACE FUNCTION sync_party_position(
    p_party_id UUID,
    p_position_ms BIGINT,
    p_is_playing BOOLEAN
)
RETURNS void AS $$
BEGIN
    UPDATE watch_parties
    SET
        current_position_ms = p_position_ms,
        is_playing = p_is_playing,
        last_sync_at = NOW(),
        status = CASE
            WHEN p_is_playing AND status = 'waiting' THEN 'active'::watch_party_status
            WHEN p_is_playing AND status = 'paused' THEN 'active'::watch_party_status
            WHEN NOT p_is_playing AND status = 'active' THEN 'paused'::watch_party_status
            ELSE status
        END
    WHERE id = p_party_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate blockchain ledger hash for verification
CREATE OR REPLACE FUNCTION calculate_ledger_hash(
    p_earning_id UUID,
    p_amount_cents BIGINT,
    p_earning_type TEXT,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        sha256(
            (p_earning_id::text || '|' || p_amount_cents::text || '|' ||
             p_earning_type || '|' || p_period_start::text || '|' || p_period_end::text)::bytea
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant permissions
GRANT SELECT ON v_active_watch_parties TO authenticated;
GRANT SELECT ON v_production_updates_feed TO authenticated;
GRANT SELECT ON v_blockchain_earnings_summary TO authenticated;
