-- Migration 278: Collab board performance optimizations
-- Optimization #5: Missing indexes
-- Optimization #7: Materialized view for board query + view indexes

-- ============================================================
-- OPTIMIZATION #5: INDEXES (without CONCURRENTLY for migration runner)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_collabs_active_approval
    ON community_collabs(is_active, approval_status);

CREATE INDEX IF NOT EXISTS idx_collabs_type_remote
    ON community_collabs(type, is_remote)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_collabs_board_cursor
    ON community_collabs(is_featured DESC, created_at DESC, id DESC)
    WHERE is_active = TRUE AND approval_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_applications_active_status
    ON community_collab_applications(collab_id, status)
    WHERE status NOT IN ('withdrawn', 'rejected');

CREATE INDEX IF NOT EXISTS idx_applications_last_msg
    ON community_collab_applications(collab_id, last_message_at DESC NULLS LAST);

-- ============================================================
-- OPTIMIZATION #7: MATERIALIZED VIEW
-- Pre-joins profiles and tv_networks so the board query fires
-- no extra round-trips. Refreshed every 5 minutes by APScheduler.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS collab_board_view;

CREATE MATERIALIZED VIEW collab_board_view AS
SELECT
    cc.id,
    cc.user_id,
    cc.title,
    cc.type,
    cc.description,
    cc.location,
    cc.is_remote,
    cc.compensation_type,
    cc.job_type,
    cc.start_date,
    cc.end_date,
    cc.day_rate_min,
    cc.day_rate_max,
    cc.salary_min,
    cc.salary_max,
    cc.benefits_info,
    cc.tags,
    cc.is_active,
    cc.is_order_only,
    cc.is_featured,
    cc.featured_until,
    cc.production_title,
    cc.production_type,
    cc.production_id,
    cc.company,
    cc.company_id,
    cc.network_id,
    cc.hide_production_info,
    cc.union_requirements,
    cc.requires_order_membership,
    cc.requires_local_hire,
    cc.requires_resume,
    cc.application_deadline,
    cc.max_applications,
    cc.custom_questions,
    cc.approval_status,
    cc.backlot_project_id,
    cc.cast_position_type_id,
    cc.requires_reel,
    cc.requires_headshot,
    cc.requires_self_tape,
    cc.tape_instructions,
    cc.tape_format_preferences,
    cc.tape_workflow,
    cc.created_at,
    cc.updated_at,
    -- Joined profile (eliminates N+1 profile fetches per page)
    p.username        AS poster_username,
    p.full_name       AS poster_full_name,
    p.display_name    AS poster_display_name,
    p.avatar_url      AS poster_avatar_url,
    p.role            AS poster_role,
    p.is_order_member AS poster_is_order_member,
    -- Joined network (eliminates N+1 network fetches per page)
    n.name            AS network_name,
    n.logo_url        AS network_logo_url,
    n.slug            AS network_slug,
    n.category        AS network_category
FROM community_collabs cc
LEFT JOIN profiles    p ON p.id = cc.user_id
LEFT JOIN tv_networks n ON n.id = cc.network_id
WHERE cc.is_active       = TRUE
  AND cc.approval_status = 'approved';

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (no table lock on refresh)
CREATE UNIQUE INDEX idx_collab_board_view_id     ON collab_board_view(id);
CREATE INDEX idx_collab_board_view_cursor        ON collab_board_view(is_featured DESC, created_at DESC, id DESC);
CREATE INDEX idx_collab_board_view_type          ON collab_board_view(type);
CREATE INDEX idx_collab_board_view_remote        ON collab_board_view(is_remote);
CREATE INDEX idx_collab_board_view_order_only    ON collab_board_view(is_order_only) WHERE is_order_only = TRUE;
CREATE INDEX idx_collab_board_view_compensation  ON collab_board_view(compensation_type);
CREATE INDEX idx_collab_board_view_user          ON collab_board_view(user_id);
