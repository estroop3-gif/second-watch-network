-- Migration 084: Content Review and Moderation
-- Phase 4B: QA workflows, moderation tools, and trust/safety
--
-- This migration:
-- 1. Creates content_review_tasks for QA workflow
-- 2. Creates content_flags for issue reporting
-- 3. Creates moderation_events for audit trail
-- 4. Extends community tables for soft-delete
-- 5. Adds trust/safety scoring

BEGIN;

-- =============================================================================
-- PART 1: Content Review Tasks
-- =============================================================================

-- Review status enum
CREATE TYPE review_status AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected',
    'needs_changes',
    'resubmitted'
);

-- Content type being reviewed
CREATE TYPE reviewable_content_type AS ENUM (
    'world',
    'episode',
    'companion_item',
    'short',
    'live_event'
);

-- Content review tasks
CREATE TABLE IF NOT EXISTS content_review_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What's being reviewed
    content_type reviewable_content_type NOT NULL,
    content_id UUID NOT NULL,

    -- World reference (for hierarchy)
    world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,

    -- Review workflow
    status review_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5,  -- 1=highest, 10=lowest

    -- Assignment
    assigned_to UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ,

    -- Submission info
    submitted_by UUID REFERENCES profiles(id),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    submission_notes TEXT,

    -- Review decisions
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    required_changes TEXT,

    -- Resubmission tracking
    resubmission_count INTEGER DEFAULT 0,
    last_resubmitted_at TIMESTAMPTZ,

    -- Deadline
    due_by TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for review task queries
CREATE INDEX IF NOT EXISTS idx_content_review_tasks_status ON content_review_tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_content_review_tasks_assigned ON content_review_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_content_review_tasks_world ON content_review_tasks(world_id);
CREATE INDEX IF NOT EXISTS idx_content_review_tasks_content ON content_review_tasks(content_type, content_id);

-- Review task history (audit trail)
CREATE TABLE IF NOT EXISTS content_review_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES content_review_tasks(id) ON DELETE CASCADE,

    -- Change details
    action TEXT NOT NULL,
    old_status review_status,
    new_status review_status,
    notes TEXT,

    -- Who did it
    performed_by UUID REFERENCES profiles(id),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_review_history_task ON content_review_history(task_id, performed_at DESC);

-- =============================================================================
-- PART 2: Content Flags
-- =============================================================================

-- Flag categories
CREATE TYPE flag_category AS ENUM (
    'technical',         -- Video/audio quality issues
    'content_policy',    -- Violates content guidelines
    'rights_concern',    -- Copyright/licensing issues
    'metadata',          -- Incorrect title/description
    'safety',            -- Harmful content
    'spam',              -- Spam or misleading
    'other'
);

-- Flag severity
CREATE TYPE flag_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

-- Content flags
CREATE TABLE IF NOT EXISTS content_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What's flagged
    content_type reviewable_content_type NOT NULL,
    content_id UUID NOT NULL,
    world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,

    -- Flag details
    category flag_category NOT NULL,
    severity flag_severity DEFAULT 'medium',
    reason TEXT NOT NULL,
    details TEXT,

    -- Reporter
    reported_by UUID REFERENCES profiles(id),
    is_moderator_flag BOOLEAN DEFAULT false,

    -- Resolution
    status TEXT DEFAULT 'open',
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    resolution_action TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT content_flags_status_check
        CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed'))
);

-- Indexes for flag queries
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status, severity);
CREATE INDEX IF NOT EXISTS idx_content_flags_content ON content_flags(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_world ON content_flags(world_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_reporter ON content_flags(reported_by);

-- =============================================================================
-- PART 3: Moderation Events (Audit Trail)
-- =============================================================================

-- Moderation action types
CREATE TYPE moderation_action AS ENUM (
    'content_hidden',
    'content_restored',
    'content_deleted',
    'thread_locked',
    'thread_unlocked',
    'thread_pinned',
    'thread_unpinned',
    'user_warned',
    'user_muted',
    'user_unmuted',
    'user_suspended',
    'user_reinstated',
    'flag_created',
    'flag_resolved',
    'review_assigned',
    'review_completed'
);

-- Moderation events log
CREATE TABLE IF NOT EXISTS moderation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was moderated
    target_type TEXT NOT NULL,  -- 'user', 'thread', 'reply', 'world', 'episode'
    target_id UUID NOT NULL,

    -- Action details
    action moderation_action NOT NULL,
    reason TEXT,
    details JSONB DEFAULT '{}',

    -- Who did it
    moderator_id UUID NOT NULL REFERENCES profiles(id),

    -- Related records
    flag_id UUID REFERENCES content_flags(id),
    review_task_id UUID REFERENCES content_review_tasks(id),

    -- Visibility (some events may be internal only)
    visible_to_user BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Expiry for temporary actions
    expires_at TIMESTAMPTZ
);

-- Indexes for moderation events
CREATE INDEX IF NOT EXISTS idx_moderation_events_target ON moderation_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_moderator ON moderation_events(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_events_action ON moderation_events(action, created_at DESC);

-- =============================================================================
-- PART 4: Extend Community Tables for Soft-Delete
-- =============================================================================

-- Add soft-delete and moderation fields to community_threads
ALTER TABLE community_threads
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS hide_reason TEXT,
    ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_moderated_at TIMESTAMPTZ;

-- Add soft-delete and moderation fields to community_thread_replies
ALTER TABLE community_thread_replies
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS hide_reason TEXT,
    ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;

-- Indexes for moderation queries
CREATE INDEX IF NOT EXISTS idx_community_threads_hidden ON community_threads(is_hidden) WHERE is_hidden = true;
CREATE INDEX IF NOT EXISTS idx_community_thread_replies_hidden ON community_thread_replies(is_hidden) WHERE is_hidden = true;

-- =============================================================================
-- PART 5: User Trust and Safety
-- =============================================================================

-- User safety scores and status
CREATE TABLE IF NOT EXISTS user_safety_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Trust metrics
    trust_score INTEGER DEFAULT 100,  -- 0-100, starts at 100
    warning_count INTEGER DEFAULT 0,
    mute_count INTEGER DEFAULT 0,
    suspension_count INTEGER DEFAULT 0,

    -- Current status
    is_muted BOOLEAN DEFAULT false,
    muted_until TIMESTAMPTZ,
    mute_reason TEXT,

    is_suspended BOOLEAN DEFAULT false,
    suspended_until TIMESTAMPTZ,
    suspension_reason TEXT,

    -- Content flags stats
    total_flags_received INTEGER DEFAULT 0,
    confirmed_violation_count INTEGER DEFAULT 0,

    -- Review queue priority (lower = reviewed more)
    content_review_priority INTEGER DEFAULT 5,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_safety_profiles_trust ON user_safety_profiles(trust_score);
CREATE INDEX IF NOT EXISTS idx_user_safety_profiles_muted ON user_safety_profiles(is_muted) WHERE is_muted = true;
CREATE INDEX IF NOT EXISTS idx_user_safety_profiles_suspended ON user_safety_profiles(is_suspended) WHERE is_suspended = true;

-- User warnings
CREATE TABLE IF NOT EXISTS user_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Warning details
    warning_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,

    -- Related content
    related_content_type TEXT,
    related_content_id UUID,

    -- Issuer
    issued_by UUID NOT NULL REFERENCES profiles(id),

    -- Acknowledgment
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT user_warnings_type_check
        CHECK (warning_type IN ('content_policy', 'community_guidelines', 'spam', 'harassment', 'rights', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON user_warnings(user_id, created_at DESC);

-- =============================================================================
-- PART 6: Views for QA and Moderation
-- =============================================================================

-- Review queue view
CREATE OR REPLACE VIEW v_review_queue AS
SELECT
    crt.id as task_id,
    crt.content_type,
    crt.content_id,
    crt.world_id,
    crt.status,
    crt.priority,
    crt.assigned_to,
    crt.submitted_by,
    crt.submitted_at,
    crt.due_by,
    crt.resubmission_count,
    w.title as world_title,
    w.slug as world_slug,
    p_submitter.display_name as submitter_name,
    p_assignee.display_name as assignee_name,
    (SELECT COUNT(*) FROM content_flags cf
     WHERE cf.content_type = crt.content_type
       AND cf.content_id = crt.content_id
       AND cf.status = 'open') as open_flags_count
FROM content_review_tasks crt
LEFT JOIN worlds w ON crt.world_id = w.id
LEFT JOIN profiles p_submitter ON crt.submitted_by = p_submitter.id
LEFT JOIN profiles p_assignee ON crt.assigned_to = p_assignee.id
WHERE crt.status IN ('pending', 'under_review', 'resubmitted')
ORDER BY crt.priority ASC, crt.submitted_at ASC;

-- Open flags by severity
CREATE OR REPLACE VIEW v_open_flags_by_severity AS
SELECT
    cf.id as flag_id,
    cf.content_type,
    cf.content_id,
    cf.world_id,
    cf.category,
    cf.severity,
    cf.reason,
    cf.is_moderator_flag,
    cf.created_at,
    w.title as world_title,
    p.display_name as reporter_name
FROM content_flags cf
LEFT JOIN worlds w ON cf.world_id = w.id
LEFT JOIN profiles p ON cf.reported_by = p.id
WHERE cf.status = 'open'
ORDER BY
    CASE cf.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    cf.created_at ASC;

-- User moderation history
CREATE OR REPLACE VIEW v_user_moderation_history AS
SELECT
    me.id as event_id,
    me.target_id as user_id,
    me.action,
    me.reason,
    me.visible_to_user,
    me.created_at,
    me.expires_at,
    p_mod.display_name as moderator_name
FROM moderation_events me
JOIN profiles p_mod ON me.moderator_id = p_mod.id
WHERE me.target_type = 'user'
ORDER BY me.created_at DESC;

-- Content under review or flagged (for recommendation filtering)
CREATE OR REPLACE VIEW v_content_under_review AS
SELECT DISTINCT
    w.id as world_id,
    w.title,
    w.status as world_status,
    (SELECT COUNT(*) FROM content_review_tasks crt
     WHERE crt.world_id = w.id
       AND crt.status IN ('pending', 'under_review', 'needs_changes')) as pending_reviews,
    (SELECT COUNT(*) FROM content_flags cf
     WHERE cf.world_id = w.id
       AND cf.status = 'open'
       AND cf.severity IN ('high', 'critical')) as serious_flags
FROM worlds w
WHERE EXISTS (
    SELECT 1 FROM content_review_tasks crt
    WHERE crt.world_id = w.id
      AND crt.status IN ('pending', 'under_review', 'needs_changes')
) OR EXISTS (
    SELECT 1 FROM content_flags cf
    WHERE cf.world_id = w.id
      AND cf.status = 'open'
      AND cf.severity IN ('high', 'critical')
);

-- =============================================================================
-- PART 7: Functions
-- =============================================================================

-- Function to create review task for World
CREATE OR REPLACE FUNCTION create_world_review_task(
    p_world_id UUID,
    p_submitted_by UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_task_id UUID;
BEGIN
    INSERT INTO content_review_tasks (
        content_type, content_id, world_id,
        submitted_by, submitted_at, submission_notes
    ) VALUES (
        'world', p_world_id, p_world_id,
        p_submitted_by, NOW(), p_notes
    )
    RETURNING id INTO v_task_id;

    -- Log the event
    INSERT INTO content_review_history (task_id, action, new_status, performed_by)
    VALUES (v_task_id, 'created', 'pending', p_submitted_by);

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update trust score based on violations
CREATE OR REPLACE FUNCTION update_user_trust_score(
    p_user_id UUID,
    p_score_change INTEGER,
    p_reason TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_new_score INTEGER;
BEGIN
    INSERT INTO user_safety_profiles (user_id, trust_score)
    VALUES (p_user_id, 100)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE user_safety_profiles
    SET trust_score = GREATEST(0, LEAST(100, trust_score + p_score_change)),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING trust_score INTO v_new_score;

    RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is allowed to post
CREATE OR REPLACE FUNCTION is_user_allowed_to_post(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT * INTO v_profile
    FROM user_safety_profiles
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN true;  -- No safety profile = allowed
    END IF;

    -- Check mute status
    IF v_profile.is_muted AND (v_profile.muted_until IS NULL OR v_profile.muted_until > NOW()) THEN
        RETURN false;
    END IF;

    -- Check suspension
    IF v_profile.is_suspended AND (v_profile.suspended_until IS NULL OR v_profile.suspended_until > NOW()) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 8: Triggers
-- =============================================================================

-- Trigger to update flag count on threads
CREATE OR REPLACE FUNCTION update_thread_flag_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.content_type = 'thread' THEN
        UPDATE community_threads
        SET flag_count = flag_count + 1
        WHERE id = NEW.content_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_thread_flag_count ON content_flags;
CREATE TRIGGER trg_update_thread_flag_count
    AFTER INSERT ON content_flags
    FOR EACH ROW
    WHEN (NEW.content_type = 'thread')
    EXECUTE FUNCTION update_thread_flag_count();

-- Trigger to update user safety profile on flag resolution
CREATE OR REPLACE FUNCTION update_user_on_flag_resolution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolved' AND NEW.resolution_action = 'violation_confirmed' THEN
        -- Increment violation count
        UPDATE user_safety_profiles
        SET confirmed_violation_count = confirmed_violation_count + 1,
            trust_score = GREATEST(0, trust_score - 10),
            updated_at = NOW()
        WHERE user_id = (
            SELECT COALESCE(
                (SELECT author_id FROM community_threads WHERE id = NEW.content_id),
                (SELECT author_id FROM community_thread_replies WHERE id = NEW.content_id)
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_on_flag_resolution ON content_flags;
CREATE TRIGGER trg_update_user_on_flag_resolution
    AFTER UPDATE OF status ON content_flags
    FOR EACH ROW
    WHEN (OLD.status != 'resolved' AND NEW.status = 'resolved')
    EXECUTE FUNCTION update_user_on_flag_resolution();

COMMIT;
