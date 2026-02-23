-- Migration 260: Organization Storage & Bandwidth Tracking
-- Creates the database infrastructure for org-level storage/bandwidth enforcement.
-- Tables: organization_usage, organization_bandwidth_logs
-- Columns: organizations.*_override, backlot_projects.storage_bytes_used/archive_bytes_used
-- Functions: get_organization_limits, check_organization_quota, check_storage_quota,
--            check_bandwidth_quota, record_bandwidth_usage, recalculate_organization_usage,
--            shift_project_storage

-- =============================================================================
-- A. Add override columns to organizations
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS owner_seats_override INTEGER,
  ADD COLUMN IF NOT EXISTS collaborative_seats_override INTEGER,
  ADD COLUMN IF NOT EXISTS active_projects_override INTEGER,
  ADD COLUMN IF NOT EXISTS freelancer_seats_per_project_override INTEGER,
  ADD COLUMN IF NOT EXISTS view_only_seats_per_project_override INTEGER,
  ADD COLUMN IF NOT EXISTS active_storage_override BIGINT,
  ADD COLUMN IF NOT EXISTS archive_storage_override BIGINT,
  ADD COLUMN IF NOT EXISTS bandwidth_override BIGINT;

COMMENT ON COLUMN organizations.active_storage_override IS 'Overrides tier default active storage limit (bytes). NULL = use tier default.';
COMMENT ON COLUMN organizations.archive_storage_override IS 'Overrides tier default archive storage limit (bytes). NULL = use tier default.';
COMMENT ON COLUMN organizations.bandwidth_override IS 'Overrides tier default monthly bandwidth limit (bytes). NULL = use tier default.';


-- =============================================================================
-- B. Create organization_usage table
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  current_owner_seats INTEGER NOT NULL DEFAULT 0,
  current_collaborative_seats INTEGER NOT NULL DEFAULT 0,
  current_active_projects INTEGER NOT NULL DEFAULT 0,
  current_active_storage_bytes BIGINT NOT NULL DEFAULT 0,
  current_archive_storage_bytes BIGINT NOT NULL DEFAULT 0,
  current_month_bandwidth_bytes BIGINT NOT NULL DEFAULT 0,
  bandwidth_reset_date DATE NOT NULL DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month')::date,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organization_usage IS 'Tracks current resource usage per organization. Updated by triggers and background recalculation.';


-- =============================================================================
-- C. Create organization_bandwidth_logs table
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_bandwidth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID,
  user_id UUID,
  event_type VARCHAR(30) NOT NULL,
  bytes_transferred BIGINT NOT NULL,
  resource_type VARCHAR(30),
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bw_logs_org ON organization_bandwidth_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_bw_logs_created ON organization_bandwidth_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_bw_logs_event ON organization_bandwidth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_bw_logs_org_created ON organization_bandwidth_logs(organization_id, created_at);


-- =============================================================================
-- D. Add storage columns to backlot_projects
-- =============================================================================

ALTER TABLE backlot_projects
  ADD COLUMN IF NOT EXISTS storage_bytes_used BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archive_bytes_used BIGINT DEFAULT 0;


-- =============================================================================
-- E0. Drop existing functions with incompatible return types
-- (Previous versions returned jsonb; we need TABLE returns for column access)
-- =============================================================================

DROP FUNCTION IF EXISTS get_organization_limits(uuid);
DROP FUNCTION IF EXISTS check_organization_quota(uuid, text, integer);
DROP FUNCTION IF EXISTS check_storage_quota(uuid, text, bigint);
DROP FUNCTION IF EXISTS check_bandwidth_quota(uuid, bigint);
DROP FUNCTION IF EXISTS record_bandwidth_usage(uuid, uuid, uuid, text, bigint, text, uuid, jsonb);
DROP FUNCTION IF EXISTS recalculate_organization_usage(uuid);
DROP FUNCTION IF EXISTS check_user_can_create_organization(uuid);
DROP FUNCTION IF EXISTS shift_project_storage(uuid, text);


-- =============================================================================
-- E1. Function: get_organization_limits(org_id)
-- Returns effective limits (COALESCE override, tier default) for an org.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_organization_limits(p_org_id UUID)
RETURNS TABLE (
  owner_seats INTEGER,
  collaborative_seats INTEGER,
  active_projects_limit INTEGER,
  freelancer_seats_per_project INTEGER,
  view_only_seats_per_project INTEGER,
  active_storage_bytes BIGINT,
  archive_storage_bytes BIGINT,
  monthly_bandwidth_bytes BIGINT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(o.owner_seats_override, t.owner_seats, 1)::INTEGER,
    COALESCE(o.collaborative_seats_override, t.collaborative_seats, 0)::INTEGER,
    COALESCE(o.active_projects_override, t.active_projects_limit, 1)::INTEGER,
    COALESCE(o.freelancer_seats_per_project_override, t.freelancer_seats_per_project, 0)::INTEGER,
    COALESCE(o.view_only_seats_per_project_override, t.view_only_seats_per_project, 2)::INTEGER,
    COALESCE(o.active_storage_override, t.active_storage_bytes, 5368709120)::BIGINT,
    COALESCE(o.archive_storage_override, t.archive_storage_bytes, 0)::BIGINT,
    COALESCE(o.bandwidth_override, t.monthly_bandwidth_bytes, 10737418240)::BIGINT
  FROM organizations o
  LEFT JOIN organization_tiers t ON o.tier_id = t.id
  WHERE o.id = p_org_id;
END;
$$;


-- =============================================================================
-- E2. Function: check_organization_quota(org_id, quota_type, count)
-- Generic quota check. Returns allowed, current, limit, remaining.
-- =============================================================================

CREATE OR REPLACE FUNCTION check_organization_quota(
  p_org_id UUID,
  p_quota_type TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS TABLE (allowed BOOLEAN, current INTEGER, "limit" INTEGER, remaining INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_current INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get the limit
  SELECT
    CASE p_quota_type
      WHEN 'owner_seats' THEN l.owner_seats
      WHEN 'collaborative_seats' THEN l.collaborative_seats
      WHEN 'active_projects' THEN l.active_projects_limit
      WHEN 'freelancer_seats_per_project' THEN l.freelancer_seats_per_project
      WHEN 'view_only_seats_per_project' THEN l.view_only_seats_per_project
    END
  INTO v_limit
  FROM get_organization_limits(p_org_id) l;

  IF v_limit IS NULL THEN
    -- Org not found
    RETURN QUERY SELECT FALSE, 0, 0, 0;
    RETURN;
  END IF;

  -- Unlimited (-1)
  IF v_limit = -1 THEN
    RETURN QUERY SELECT TRUE, 0, -1, -1;
    RETURN;
  END IF;

  -- Get current usage
  SELECT
    CASE p_quota_type
      WHEN 'owner_seats' THEN u.current_owner_seats
      WHEN 'collaborative_seats' THEN u.current_collaborative_seats
      WHEN 'active_projects' THEN u.current_active_projects
      ELSE 0
    END
  INTO v_current
  FROM organization_usage u
  WHERE u.organization_id = p_org_id;

  v_current := COALESCE(v_current, 0);

  RETURN QUERY SELECT
    (v_current + p_count) <= v_limit,
    v_current,
    v_limit,
    GREATEST(v_limit - v_current, 0);
END;
$$;


-- =============================================================================
-- E3. Function: check_storage_quota(org_id, storage_type, bytes)
-- Storage-specific check. Returns allowed, current_bytes, limit_bytes, remaining_bytes.
-- =============================================================================

CREATE OR REPLACE FUNCTION check_storage_quota(
  p_org_id UUID,
  p_storage_type TEXT,
  p_bytes BIGINT
)
RETURNS TABLE (allowed BOOLEAN, current_bytes BIGINT, limit_bytes BIGINT, remaining_bytes BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
  v_current BIGINT;
  v_limit BIGINT;
BEGIN
  -- Get the limit
  SELECT
    CASE p_storage_type
      WHEN 'active' THEN l.active_storage_bytes
      WHEN 'archive' THEN l.archive_storage_bytes
    END
  INTO v_limit
  FROM get_organization_limits(p_org_id) l;

  IF v_limit IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- Unlimited (-1)
  IF v_limit = -1 THEN
    RETURN QUERY SELECT TRUE, 0::BIGINT, -1::BIGINT, -1::BIGINT;
    RETURN;
  END IF;

  -- Get current usage
  SELECT
    CASE p_storage_type
      WHEN 'active' THEN u.current_active_storage_bytes
      WHEN 'archive' THEN u.current_archive_storage_bytes
    END
  INTO v_current
  FROM organization_usage u
  WHERE u.organization_id = p_org_id;

  v_current := COALESCE(v_current, 0);

  RETURN QUERY SELECT
    (v_current + p_bytes) <= v_limit,
    v_current,
    v_limit,
    GREATEST(v_limit - v_current, 0);
END;
$$;


-- =============================================================================
-- E4. Function: check_bandwidth_quota(org_id, bytes)
-- Bandwidth check with auto-reset if past reset date.
-- Returns allowed, current_bytes, limit_bytes, remaining_bytes, reset_date.
-- =============================================================================

CREATE OR REPLACE FUNCTION check_bandwidth_quota(
  p_org_id UUID,
  p_bytes BIGINT
)
RETURNS TABLE (allowed BOOLEAN, current_bytes BIGINT, limit_bytes BIGINT, remaining_bytes BIGINT, reset_date DATE)
LANGUAGE plpgsql AS $$
DECLARE
  v_current BIGINT;
  v_limit BIGINT;
  v_reset DATE;
BEGIN
  -- Get the limit
  SELECT l.monthly_bandwidth_bytes
  INTO v_limit
  FROM get_organization_limits(p_org_id) l;

  IF v_limit IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::BIGINT, 0::BIGINT, 0::BIGINT, CURRENT_DATE;
    RETURN;
  END IF;

  -- Unlimited (-1)
  IF v_limit = -1 THEN
    RETURN QUERY SELECT TRUE, 0::BIGINT, -1::BIGINT, -1::BIGINT, CURRENT_DATE;
    RETURN;
  END IF;

  -- Get current usage and reset date
  SELECT u.current_month_bandwidth_bytes, u.bandwidth_reset_date
  INTO v_current, v_reset
  FROM organization_usage u
  WHERE u.organization_id = p_org_id;

  v_current := COALESCE(v_current, 0);
  v_reset := COALESCE(v_reset, DATE_TRUNC('month', NOW() + INTERVAL '1 month')::date);

  -- Auto-reset if past reset date
  IF v_reset <= CURRENT_DATE THEN
    UPDATE organization_usage
    SET current_month_bandwidth_bytes = 0,
        bandwidth_reset_date = DATE_TRUNC('month', NOW() + INTERVAL '1 month')::date,
        updated_at = NOW()
    WHERE organization_id = p_org_id;

    v_current := 0;
    v_reset := DATE_TRUNC('month', NOW() + INTERVAL '1 month')::date;
  END IF;

  RETURN QUERY SELECT
    (v_current + p_bytes) <= v_limit,
    v_current,
    v_limit,
    GREATEST(v_limit - v_current, 0),
    v_reset;
END;
$$;


-- =============================================================================
-- E5. Function: record_bandwidth_usage(...)
-- Inserts log entry and increments usage counter.
-- =============================================================================

CREATE OR REPLACE FUNCTION record_bandwidth_usage(
  p_org_id UUID,
  p_project_id UUID,
  p_user_id UUID,
  p_event_type VARCHAR(30),
  p_bytes BIGINT,
  p_resource_type VARCHAR(30),
  p_resource_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  -- Insert log entry
  INSERT INTO organization_bandwidth_logs (
    organization_id, project_id, user_id, event_type,
    bytes_transferred, resource_type, resource_id, metadata
  ) VALUES (
    p_org_id, p_project_id, p_user_id, p_event_type,
    p_bytes, p_resource_type, p_resource_id, p_metadata
  );

  -- Increment usage counter (create row if missing)
  INSERT INTO organization_usage (organization_id, current_month_bandwidth_bytes)
  VALUES (p_org_id, p_bytes)
  ON CONFLICT (organization_id) DO UPDATE
  SET current_month_bandwidth_bytes = organization_usage.current_month_bandwidth_bytes + p_bytes,
      updated_at = NOW();
END;
$$;


-- =============================================================================
-- E6. Function: recalculate_organization_usage(org_id)
-- Recalculates all usage from source tables. Fixes drift.
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_organization_usage(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_owner_seats INTEGER;
  v_collab_seats INTEGER;
  v_active_projects INTEGER;
  v_active_storage BIGINT;
  v_archive_storage BIGINT;
BEGIN
  -- Count owner seats
  SELECT COUNT(*)::INTEGER INTO v_owner_seats
  FROM organization_members
  WHERE organization_id = p_org_id AND role = 'owner' AND status = 'active';

  -- Count collaborative seats (admin, manager, member, etc.)
  SELECT COUNT(*)::INTEGER INTO v_collab_seats
  FROM organization_members
  WHERE organization_id = p_org_id AND role IN ('admin', 'manager', 'member', 'finance', 'creator') AND status = 'active';

  -- Count active projects
  SELECT COUNT(*)::INTEGER INTO v_active_projects
  FROM backlot_projects
  WHERE organization_id = p_org_id AND status != 'archived';

  -- Sum active storage from standalone assets in non-archived projects
  SELECT COALESCE(SUM(sa.file_size_bytes), 0) INTO v_active_storage
  FROM backlot_standalone_assets sa
  JOIN backlot_projects p ON sa.project_id = p.id
  WHERE p.organization_id = p_org_id AND (p.status IS NULL OR p.status != 'archived');

  -- Sum archive storage from standalone assets in archived projects
  SELECT COALESCE(SUM(sa.file_size_bytes), 0) INTO v_archive_storage
  FROM backlot_standalone_assets sa
  JOIN backlot_projects p ON sa.project_id = p.id
  WHERE p.organization_id = p_org_id AND p.status = 'archived';

  -- Also update per-project storage
  UPDATE backlot_projects bp
  SET storage_bytes_used = sub.total_bytes
  FROM (
    SELECT sa.project_id, COALESCE(SUM(sa.file_size_bytes), 0) AS total_bytes
    FROM backlot_standalone_assets sa
    WHERE sa.project_id IN (SELECT id FROM backlot_projects WHERE organization_id = p_org_id AND (status IS NULL OR status != 'archived'))
    GROUP BY sa.project_id
  ) sub
  WHERE bp.id = sub.project_id;

  UPDATE backlot_projects bp
  SET archive_bytes_used = sub.total_bytes, storage_bytes_used = 0
  FROM (
    SELECT sa.project_id, COALESCE(SUM(sa.file_size_bytes), 0) AS total_bytes
    FROM backlot_standalone_assets sa
    WHERE sa.project_id IN (SELECT id FROM backlot_projects WHERE organization_id = p_org_id AND status = 'archived')
    GROUP BY sa.project_id
  ) sub
  WHERE bp.id = sub.project_id;

  -- Upsert organization_usage
  INSERT INTO organization_usage (
    organization_id,
    current_owner_seats,
    current_collaborative_seats,
    current_active_projects,
    current_active_storage_bytes,
    current_archive_storage_bytes,
    last_calculated_at
  ) VALUES (
    p_org_id,
    v_owner_seats,
    v_collab_seats,
    v_active_projects,
    v_active_storage,
    v_archive_storage,
    NOW()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    current_owner_seats = v_owner_seats,
    current_collaborative_seats = v_collab_seats,
    current_active_projects = v_active_projects,
    current_active_storage_bytes = v_active_storage,
    current_archive_storage_bytes = v_archive_storage,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$;


-- =============================================================================
-- E7. Function: shift_project_storage(project_id, direction)
-- Moves storage between active and archive when project status changes.
-- direction: 'to_archive' or 'to_active'
-- =============================================================================

CREATE OR REPLACE FUNCTION shift_project_storage(
  p_project_id UUID,
  p_direction TEXT  -- 'to_archive' or 'to_active'
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
  v_total_bytes BIGINT;
BEGIN
  -- Get org and total file size for the project
  SELECT p.organization_id INTO v_org_id
  FROM backlot_projects p
  WHERE p.id = p_project_id;

  IF v_org_id IS NULL THEN
    RETURN;  -- No org, nothing to do
  END IF;

  SELECT COALESCE(SUM(sa.file_size_bytes), 0) INTO v_total_bytes
  FROM backlot_standalone_assets sa
  WHERE sa.project_id = p_project_id;

  IF v_total_bytes = 0 THEN
    RETURN;
  END IF;

  IF p_direction = 'to_archive' THEN
    -- Move from active to archive
    UPDATE organization_usage
    SET current_active_storage_bytes = GREATEST(current_active_storage_bytes - v_total_bytes, 0),
        current_archive_storage_bytes = current_archive_storage_bytes + v_total_bytes,
        updated_at = NOW()
    WHERE organization_id = v_org_id;

    UPDATE backlot_projects
    SET archive_bytes_used = v_total_bytes, storage_bytes_used = 0
    WHERE id = p_project_id;

  ELSIF p_direction = 'to_active' THEN
    -- Move from archive to active
    UPDATE organization_usage
    SET current_archive_storage_bytes = GREATEST(current_archive_storage_bytes - v_total_bytes, 0),
        current_active_storage_bytes = current_active_storage_bytes + v_total_bytes,
        updated_at = NOW()
    WHERE organization_id = v_org_id;

    UPDATE backlot_projects
    SET storage_bytes_used = v_total_bytes, archive_bytes_used = 0
    WHERE id = p_project_id;
  END IF;
END;
$$;


-- =============================================================================
-- F. Trigger: update org storage on standalone asset INSERT/DELETE
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_update_org_storage_on_asset()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
  v_project_status TEXT;
  v_file_size BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_file_size := COALESCE(NEW.file_size_bytes, 0);
    IF v_file_size = 0 THEN
      RETURN NEW;
    END IF;

    -- Get the org and project status
    SELECT p.organization_id, p.status
    INTO v_org_id, v_project_status
    FROM backlot_projects p
    WHERE p.id = NEW.project_id;

    IF v_org_id IS NOT NULL THEN
      IF v_project_status = 'archived' THEN
        -- Add to archive storage
        INSERT INTO organization_usage (organization_id, current_archive_storage_bytes)
        VALUES (v_org_id, v_file_size)
        ON CONFLICT (organization_id) DO UPDATE
        SET current_archive_storage_bytes = organization_usage.current_archive_storage_bytes + v_file_size,
            updated_at = NOW();

        UPDATE backlot_projects
        SET archive_bytes_used = COALESCE(archive_bytes_used, 0) + v_file_size
        WHERE id = NEW.project_id;
      ELSE
        -- Add to active storage
        INSERT INTO organization_usage (organization_id, current_active_storage_bytes)
        VALUES (v_org_id, v_file_size)
        ON CONFLICT (organization_id) DO UPDATE
        SET current_active_storage_bytes = organization_usage.current_active_storage_bytes + v_file_size,
            updated_at = NOW();

        UPDATE backlot_projects
        SET storage_bytes_used = COALESCE(storage_bytes_used, 0) + v_file_size
        WHERE id = NEW.project_id;
      END IF;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_file_size := COALESCE(OLD.file_size_bytes, 0);
    IF v_file_size = 0 THEN
      RETURN OLD;
    END IF;

    SELECT p.organization_id, p.status
    INTO v_org_id, v_project_status
    FROM backlot_projects p
    WHERE p.id = OLD.project_id;

    IF v_org_id IS NOT NULL THEN
      IF v_project_status = 'archived' THEN
        UPDATE organization_usage
        SET current_archive_storage_bytes = GREATEST(current_archive_storage_bytes - v_file_size, 0),
            updated_at = NOW()
        WHERE organization_id = v_org_id;

        UPDATE backlot_projects
        SET archive_bytes_used = GREATEST(COALESCE(archive_bytes_used, 0) - v_file_size, 0)
        WHERE id = OLD.project_id;
      ELSE
        UPDATE organization_usage
        SET current_active_storage_bytes = GREATEST(current_active_storage_bytes - v_file_size, 0),
            updated_at = NOW()
        WHERE organization_id = v_org_id;

        UPDATE backlot_projects
        SET storage_bytes_used = GREATEST(COALESCE(storage_bytes_used, 0) - v_file_size, 0)
        WHERE id = OLD.project_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS trg_standalone_asset_storage ON backlot_standalone_assets;
CREATE TRIGGER trg_standalone_asset_storage
  AFTER INSERT OR DELETE ON backlot_standalone_assets
  FOR EACH ROW EXECUTE FUNCTION trg_update_org_storage_on_asset();


-- =============================================================================
-- G. Seed initial organization_usage rows from existing data
-- =============================================================================

INSERT INTO organization_usage (
  organization_id,
  current_owner_seats,
  current_collaborative_seats,
  current_active_projects,
  current_active_storage_bytes,
  current_archive_storage_bytes
)
SELECT
  o.id,
  COALESCE(seats.owner_count, 0),
  COALESCE(seats.collab_count, 0),
  COALESCE(projects.active_count, 0),
  COALESCE(storage.active_bytes, 0),
  COALESCE(storage.archive_bytes, 0)
FROM organizations o
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE role = 'owner' AND status = 'active') AS owner_count,
    COUNT(*) FILTER (WHERE role IN ('admin', 'manager', 'member', 'finance', 'creator') AND status = 'active') AS collab_count
  FROM organization_members
  WHERE organization_id = o.id
) seats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_count
  FROM backlot_projects
  WHERE organization_id = o.id AND (status IS NULL OR status != 'archived')
) projects ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(sa.file_size_bytes) FILTER (
      WHERE p.status IS NULL OR p.status != 'archived'
    ), 0) AS active_bytes,
    COALESCE(SUM(sa.file_size_bytes) FILTER (
      WHERE p.status = 'archived'
    ), 0) AS archive_bytes
  FROM backlot_standalone_assets sa
  JOIN backlot_projects p ON sa.project_id = p.id
  WHERE p.organization_id = o.id
) storage ON TRUE
ON CONFLICT (organization_id) DO UPDATE SET
  current_owner_seats = EXCLUDED.current_owner_seats,
  current_collaborative_seats = EXCLUDED.current_collaborative_seats,
  current_active_projects = EXCLUDED.current_active_projects,
  current_active_storage_bytes = EXCLUDED.current_active_storage_bytes,
  current_archive_storage_bytes = EXCLUDED.current_archive_storage_bytes,
  last_calculated_at = NOW(),
  updated_at = NOW();

-- Seed per-project storage_bytes_used from standalone_assets
UPDATE backlot_projects bp
SET storage_bytes_used = sub.total_bytes
FROM (
  SELECT sa.project_id, COALESCE(SUM(sa.file_size_bytes), 0) AS total_bytes
  FROM backlot_standalone_assets sa
  JOIN backlot_projects p ON sa.project_id = p.id
  WHERE p.status IS NULL OR p.status != 'archived'
  GROUP BY sa.project_id
) sub
WHERE bp.id = sub.project_id;

UPDATE backlot_projects bp
SET archive_bytes_used = sub.total_bytes
FROM (
  SELECT sa.project_id, COALESCE(SUM(sa.file_size_bytes), 0) AS total_bytes
  FROM backlot_standalone_assets sa
  JOIN backlot_projects p ON sa.project_id = p.id
  WHERE p.status = 'archived'
  GROUP BY sa.project_id
) sub
WHERE bp.id = sub.project_id;


-- =============================================================================
-- H. Function: check_user_can_create_organization(user_id)
-- Checks if user can create a new organization (max 3 per user).
-- =============================================================================

CREATE OR REPLACE FUNCTION check_user_can_create_organization(p_user_id UUID)
RETURNS TABLE (allowed BOOLEAN, current INTEGER, "limit" INTEGER, remaining INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_current INTEGER;
  v_limit INTEGER := 3;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_current
  FROM organizations o
  JOIN organization_members m ON o.id = m.organization_id
  WHERE m.user_id = p_user_id AND m.role = 'owner' AND m.is_active = TRUE;

  RETURN QUERY SELECT
    v_current < v_limit,
    v_current,
    v_limit,
    GREATEST(v_limit - v_current, 0);
END;
$$;
