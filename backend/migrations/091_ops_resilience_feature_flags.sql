-- Migration 091: Operational Resilience, Feature Flags, and Guardrails
-- Phase 6C: Health tooling, rate limits, and long-term configuration

-- ============================================================================
-- FEATURE FLAGS SYSTEM
-- ============================================================================

-- Feature flag status
CREATE TYPE feature_flag_status AS ENUM ('enabled', 'disabled', 'percentage', 'targeted');

-- Feature flag categories
CREATE TYPE feature_flag_category AS ENUM (
    'frontend',      -- UI features
    'backend',       -- API features
    'experiment',    -- A/B tests
    'killswitch',    -- Emergency disable
    'rollout',       -- Gradual rollouts
    'beta'           -- Beta features
);

-- Feature flags table
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,  -- e.g., 'enable_new_player', 'beta_watch_parties'
    name TEXT NOT NULL,
    description TEXT,
    category feature_flag_category DEFAULT 'backend',
    status feature_flag_status DEFAULT 'disabled',
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    default_value JSONB DEFAULT 'false'::jsonb,  -- Default when not matched
    metadata JSONB DEFAULT '{}',  -- Additional configuration
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flag targeting rules (who gets the flag)
CREATE TABLE feature_flag_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,  -- 'user', 'role', 'organization', 'order_tier'
    target_value TEXT NOT NULL,  -- user_id, role name, org_id, tier name
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_flag_targets_flag ON feature_flag_targets(flag_id);
CREATE INDEX idx_feature_flag_targets_type ON feature_flag_targets(target_type, target_value);

-- Feature flag evaluation log (for debugging/analytics)
CREATE TABLE feature_flag_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id),
    result BOOLEAN NOT NULL,
    reason TEXT,  -- 'percentage', 'targeted', 'default', 'disabled'
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ff_evaluations_flag ON feature_flag_evaluations(flag_key);
CREATE INDEX idx_ff_evaluations_user ON feature_flag_evaluations(user_id);
CREATE INDEX idx_ff_evaluations_time ON feature_flag_evaluations(evaluated_at);

-- Partition evaluations by month for easier cleanup
-- (In production, consider TimescaleDB or similar)

-- ============================================================================
-- RATE LIMITING CONFIGURATION
-- ============================================================================

-- Rate limit scopes
CREATE TYPE rate_limit_scope AS ENUM (
    'global',        -- Platform-wide
    'ip',            -- Per IP address
    'user',          -- Per authenticated user
    'api_key',       -- Per API key
    'endpoint'       -- Per endpoint
);

-- Rate limit rules
CREATE TABLE rate_limit_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    scope rate_limit_scope NOT NULL DEFAULT 'user',
    endpoint_pattern TEXT,  -- Regex pattern for endpoints, NULL = all
    requests_per_window INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL,
    burst_limit INTEGER,  -- Max burst above normal rate
    penalty_seconds INTEGER DEFAULT 0,  -- Extra wait after limit hit
    exempt_roles TEXT[] DEFAULT '{}',  -- Roles exempt from this limit
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,  -- Lower = higher priority
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limit overrides for specific users/IPs
CREATE TABLE rate_limit_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES rate_limit_rules(id) ON DELETE CASCADE,
    override_type TEXT NOT NULL,  -- 'user', 'ip', 'api_key'
    override_value TEXT NOT NULL,
    multiplier NUMERIC(3,2) DEFAULT 1.0,  -- 1.5 = 50% more requests
    exempt BOOLEAN DEFAULT false,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_overrides_type ON rate_limit_overrides(override_type, override_value);

-- Rate limit violations (for monitoring)
CREATE TABLE rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES rate_limit_rules(id),
    scope rate_limit_scope NOT NULL,
    identifier TEXT NOT NULL,  -- user_id, IP, etc.
    endpoint TEXT,
    requests_made INTEGER,
    limit_value INTEGER,
    violated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_violations_time ON rate_limit_violations(violated_at);
CREATE INDEX idx_rate_violations_identifier ON rate_limit_violations(identifier);

-- ============================================================================
-- HEALTH CHECK SYSTEM
-- ============================================================================

-- Health check types
CREATE TYPE health_check_type AS ENUM (
    'database',      -- Database connectivity
    'redis',         -- Cache layer
    's3',            -- Storage
    'cognito',       -- Auth service
    'external_api',  -- Third-party APIs
    'queue',         -- Job queues
    'custom'         -- Custom checks
);

-- Health check status
CREATE TYPE health_status AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');

-- Registered health checks
CREATE TABLE health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    check_type health_check_type NOT NULL,
    description TEXT,
    endpoint_or_target TEXT,  -- What to check
    timeout_ms INTEGER DEFAULT 5000,
    interval_seconds INTEGER DEFAULT 60,
    failure_threshold INTEGER DEFAULT 3,  -- Failures before unhealthy
    success_threshold INTEGER DEFAULT 1,  -- Successes before healthy
    enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health check results (recent history)
CREATE TABLE health_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
    status health_status NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_results_check ON health_check_results(check_id);
CREATE INDEX idx_health_results_time ON health_check_results(checked_at);

-- Current health status (materialized view pattern)
CREATE TABLE health_check_current (
    check_id UUID PRIMARY KEY REFERENCES health_checks(id) ON DELETE CASCADE,
    status health_status NOT NULL DEFAULT 'unknown',
    consecutive_failures INTEGER DEFAULT 0,
    consecutive_successes INTEGER DEFAULT 0,
    last_check_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM ALERTS & INCIDENTS
-- ============================================================================

-- Alert severity levels
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'error', 'critical');

-- Alert status
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'silenced');

-- System alerts
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,  -- 'rate_limit', 'health_check', 'error_rate', etc.
    severity alert_severity NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    source TEXT,  -- Component that triggered alert
    status alert_status DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    silenced_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_alerts_status ON system_alerts(status);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_time ON system_alerts(created_at);

-- Alert rules (when to trigger alerts)
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    check_type TEXT NOT NULL,  -- 'health_check', 'error_rate', 'latency', 'custom'
    condition JSONB NOT NULL,  -- Rule definition
    severity alert_severity NOT NULL,
    cooldown_seconds INTEGER DEFAULT 300,  -- Min time between alerts
    enabled BOOLEAN DEFAULT true,
    notification_channels TEXT[] DEFAULT '{}',  -- 'email', 'slack', etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents (longer-term issues)
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,
    status TEXT DEFAULT 'investigating',  -- investigating, identified, monitoring, resolved
    impact TEXT,  -- User-facing impact description
    started_at TIMESTAMPTZ DEFAULT NOW(),
    identified_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    postmortem_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incident updates (timeline)
CREATE TABLE incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incident_updates_incident ON incident_updates(incident_id);

-- ============================================================================
-- API USAGE TRACKING
-- ============================================================================

-- API usage aggregates (for analytics and billing)
CREATE TABLE api_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    user_id UUID REFERENCES profiles(id),
    organization_id UUID REFERENCES organizations(id),
    endpoint_group TEXT,  -- 'backlot', 'worlds', 'streaming', etc.
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_latency_ms BIGINT DEFAULT 0,
    bandwidth_bytes BIGINT DEFAULT 0,
    UNIQUE(date, user_id, endpoint_group)
);

CREATE INDEX idx_api_usage_date ON api_usage_daily(date);
CREATE INDEX idx_api_usage_user ON api_usage_daily(user_id);
CREATE INDEX idx_api_usage_org ON api_usage_daily(organization_id);

-- Slow query log
CREATE TABLE slow_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id),
    latency_ms INTEGER NOT NULL,
    query_count INTEGER,
    request_metadata JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slow_requests_time ON slow_requests(recorded_at);
CREATE INDEX idx_slow_requests_latency ON slow_requests(latency_ms);

-- ============================================================================
-- CONFIGURATION MANAGEMENT
-- ============================================================================

-- Dynamic configuration (runtime settings)
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    is_secret BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration change history
CREATE TABLE system_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES profiles(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

CREATE INDEX idx_config_history_key ON system_config_history(config_key);
CREATE INDEX idx_config_history_time ON system_config_history(changed_at);

-- ============================================================================
-- MAINTENANCE WINDOWS
-- ============================================================================

CREATE TABLE maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    affected_services TEXT[] DEFAULT '{}',
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled',  -- scheduled, in_progress, completed, cancelled
    notification_sent BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_windows_time ON maintenance_windows(scheduled_start, scheduled_end);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Current system health overview
CREATE OR REPLACE VIEW v_system_health AS
SELECT
    hc.name,
    hc.check_type,
    hcc.status,
    hcc.consecutive_failures,
    hcc.last_check_at,
    hcc.last_success_at,
    hcc.last_failure_at,
    hc.enabled
FROM health_checks hc
LEFT JOIN health_check_current hcc ON hcc.check_id = hc.id
WHERE hc.enabled = true
ORDER BY
    CASE hcc.status
        WHEN 'unhealthy' THEN 1
        WHEN 'degraded' THEN 2
        WHEN 'unknown' THEN 3
        ELSE 4
    END,
    hc.name;

-- Active alerts summary
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT
    severity,
    COUNT(*) as count,
    MIN(created_at) as oldest_alert,
    array_agg(DISTINCT alert_type) as alert_types
FROM system_alerts
WHERE status = 'active'
GROUP BY severity
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        ELSE 4
    END;

-- Feature flag summary
CREATE OR REPLACE VIEW v_feature_flags_summary AS
SELECT
    category,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'enabled') as enabled,
    COUNT(*) FILTER (WHERE status = 'disabled') as disabled,
    COUNT(*) FILTER (WHERE status = 'percentage') as percentage_rollout,
    COUNT(*) FILTER (WHERE status = 'targeted') as targeted
FROM feature_flags
GROUP BY category;

-- Rate limit violations (last 24h)
CREATE OR REPLACE VIEW v_rate_limit_violations_24h AS
SELECT
    rlr.name as rule_name,
    rlv.scope,
    COUNT(*) as violation_count,
    COUNT(DISTINCT rlv.identifier) as unique_violators
FROM rate_limit_violations rlv
JOIN rate_limit_rules rlr ON rlr.id = rlv.rule_id
WHERE rlv.violated_at > NOW() - INTERVAL '24 hours'
GROUP BY rlr.name, rlv.scope
ORDER BY violation_count DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Evaluate feature flag for a user
CREATE OR REPLACE FUNCTION evaluate_feature_flag(
    p_flag_key TEXT,
    p_user_id UUID DEFAULT NULL,
    p_context JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_flag RECORD;
    v_result BOOLEAN;
    v_reason TEXT;
    v_target RECORD;
BEGIN
    -- Get flag
    SELECT * INTO v_flag FROM feature_flags WHERE key = p_flag_key;

    IF v_flag IS NULL THEN
        RETURN jsonb_build_object('enabled', false, 'reason', 'flag_not_found');
    END IF;

    -- Check status
    IF v_flag.status = 'disabled' THEN
        v_result := false;
        v_reason := 'disabled';
    ELSIF v_flag.status = 'enabled' THEN
        v_result := true;
        v_reason := 'enabled';
    ELSIF v_flag.status = 'targeted' THEN
        -- Check targets
        v_result := false;
        v_reason := 'not_targeted';

        IF p_user_id IS NOT NULL THEN
            -- Check user target
            SELECT * INTO v_target
            FROM feature_flag_targets
            WHERE flag_id = v_flag.id
                AND target_type = 'user'
                AND target_value = p_user_id::TEXT
                AND enabled = true;

            IF FOUND THEN
                v_result := true;
                v_reason := 'targeted_user';
            END IF;
        END IF;

        -- Check role targets from context
        IF NOT v_result AND p_context ? 'roles' THEN
            SELECT * INTO v_target
            FROM feature_flag_targets
            WHERE flag_id = v_flag.id
                AND target_type = 'role'
                AND target_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_context->'roles')))
                AND enabled = true
            LIMIT 1;

            IF FOUND THEN
                v_result := true;
                v_reason := 'targeted_role';
            END IF;
        END IF;
    ELSIF v_flag.status = 'percentage' THEN
        -- Percentage rollout (deterministic based on user_id)
        IF p_user_id IS NOT NULL THEN
            v_result := (abs(hashtext(p_user_id::TEXT || p_flag_key)) % 100) < v_flag.rollout_percentage;
            v_reason := 'percentage_' || v_flag.rollout_percentage;
        ELSE
            v_result := (random() * 100) < v_flag.rollout_percentage;
            v_reason := 'percentage_random';
        END IF;
    END IF;

    -- Log evaluation (async in production)
    INSERT INTO feature_flag_evaluations (flag_key, user_id, result, reason)
    VALUES (p_flag_key, p_user_id, v_result, v_reason);

    RETURN jsonb_build_object(
        'enabled', v_result,
        'reason', v_reason,
        'flag_key', p_flag_key
    );
END;
$$ LANGUAGE plpgsql;

-- Record health check result and update current status
CREATE OR REPLACE FUNCTION record_health_check_result(
    p_check_name TEXT,
    p_status health_status,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
    v_check_id UUID;
    v_current RECORD;
    v_failure_threshold INTEGER;
    v_success_threshold INTEGER;
BEGIN
    -- Get check
    SELECT id, failure_threshold, success_threshold INTO v_check_id, v_failure_threshold, v_success_threshold
    FROM health_checks WHERE name = p_check_name;

    IF v_check_id IS NULL THEN
        RAISE EXCEPTION 'Health check not found: %', p_check_name;
    END IF;

    -- Record result
    INSERT INTO health_check_results (check_id, status, response_time_ms, error_message, metadata)
    VALUES (v_check_id, p_status, p_response_time_ms, p_error_message, p_metadata);

    -- Get current status
    SELECT * INTO v_current FROM health_check_current WHERE check_id = v_check_id;

    -- Update or insert current status
    IF v_current IS NULL THEN
        INSERT INTO health_check_current (check_id, status, consecutive_failures, consecutive_successes, last_check_at)
        VALUES (v_check_id, p_status,
            CASE WHEN p_status IN ('unhealthy', 'degraded') THEN 1 ELSE 0 END,
            CASE WHEN p_status = 'healthy' THEN 1 ELSE 0 END,
            NOW());
    ELSE
        UPDATE health_check_current
        SET
            consecutive_failures = CASE
                WHEN p_status IN ('unhealthy', 'degraded') THEN v_current.consecutive_failures + 1
                ELSE 0
            END,
            consecutive_successes = CASE
                WHEN p_status = 'healthy' THEN v_current.consecutive_successes + 1
                ELSE 0
            END,
            status = CASE
                WHEN p_status = 'healthy' AND (v_current.consecutive_successes + 1) >= v_success_threshold THEN 'healthy'::health_status
                WHEN p_status IN ('unhealthy', 'degraded') AND (v_current.consecutive_failures + 1) >= v_failure_threshold THEN p_status
                ELSE v_current.status
            END,
            last_check_at = NOW(),
            last_success_at = CASE WHEN p_status = 'healthy' THEN NOW() ELSE v_current.last_success_at END,
            last_failure_at = CASE WHEN p_status != 'healthy' THEN NOW() ELSE v_current.last_failure_at END,
            updated_at = NOW()
        WHERE check_id = v_check_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_scope rate_limit_scope,
    p_endpoint TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_rule RECORD;
    v_override RECORD;
    v_requests INTEGER;
    v_limit INTEGER;
    v_allowed BOOLEAN;
BEGIN
    -- Find applicable rule
    SELECT * INTO v_rule
    FROM rate_limit_rules
    WHERE enabled = true
        AND scope = p_scope
        AND (endpoint_pattern IS NULL OR p_endpoint ~ endpoint_pattern)
    ORDER BY priority
    LIMIT 1;

    IF v_rule IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'no_rule');
    END IF;

    -- Check for override
    SELECT * INTO v_override
    FROM rate_limit_overrides
    WHERE rule_id = v_rule.id
        AND override_value = p_identifier
        AND (expires_at IS NULL OR expires_at > NOW());

    IF v_override IS NOT NULL AND v_override.exempt THEN
        RETURN jsonb_build_object('allowed', true, 'reason', 'exempt');
    END IF;

    -- Calculate limit with multiplier
    v_limit := v_rule.requests_per_window;
    IF v_override IS NOT NULL THEN
        v_limit := (v_limit * v_override.multiplier)::INTEGER;
    END IF;

    -- Count recent requests (this would use Redis in production)
    -- Simplified version using violations table as proxy
    SELECT COUNT(*) INTO v_requests
    FROM rate_limit_violations
    WHERE identifier = p_identifier
        AND rule_id = v_rule.id
        AND violated_at > NOW() - (v_rule.window_seconds || ' seconds')::INTERVAL;

    v_allowed := v_requests < v_limit;

    IF NOT v_allowed THEN
        -- Record violation
        INSERT INTO rate_limit_violations (rule_id, scope, identifier, endpoint, requests_made, limit_value)
        VALUES (v_rule.id, p_scope, p_identifier, p_endpoint, v_requests + 1, v_limit);
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_requests - 1),
        'reset_seconds', v_rule.window_seconds,
        'rule_name', v_rule.name
    );
END;
$$ LANGUAGE plpgsql;

-- Get ops dashboard data
CREATE OR REPLACE FUNCTION get_ops_dashboard() RETURNS JSONB AS $$
DECLARE
    v_health JSONB;
    v_alerts JSONB;
    v_flags JSONB;
    v_rate_limits JSONB;
    v_incidents JSONB;
BEGIN
    -- Health status
    SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'type', check_type,
        'status', status,
        'last_check', last_check_at
    )) INTO v_health
    FROM v_system_health;

    -- Active alerts
    SELECT jsonb_agg(jsonb_build_object(
        'severity', severity,
        'count', count,
        'types', alert_types
    )) INTO v_alerts
    FROM v_active_alerts;

    -- Feature flags
    SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'total', total,
        'enabled', enabled
    )) INTO v_flags
    FROM v_feature_flags_summary;

    -- Rate limit violations
    SELECT jsonb_agg(jsonb_build_object(
        'rule', rule_name,
        'violations', violation_count,
        'unique_violators', unique_violators
    )) INTO v_rate_limits
    FROM v_rate_limit_violations_24h
    LIMIT 10;

    -- Active incidents
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'severity', severity,
        'status', status,
        'started_at', started_at
    )) INTO v_incidents
    FROM incidents
    WHERE status != 'resolved'
    ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
        started_at DESC
    LIMIT 5;

    RETURN jsonb_build_object(
        'health', COALESCE(v_health, '[]'::jsonb),
        'alerts', COALESCE(v_alerts, '[]'::jsonb),
        'feature_flags', COALESCE(v_flags, '[]'::jsonb),
        'rate_limit_violations', COALESCE(v_rate_limits, '[]'::jsonb),
        'active_incidents', COALESCE(v_incidents, '[]'::jsonb),
        'generated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default health checks
INSERT INTO health_checks (name, check_type, description, endpoint_or_target) VALUES
('database', 'database', 'PostgreSQL database connectivity', 'primary'),
('s3_avatars', 's3', 'S3 avatars bucket', 'swn-avatars'),
('s3_backlot', 's3', 'S3 backlot files bucket', 'swn-backlot-files'),
('cognito', 'cognito', 'AWS Cognito user pool', 'us-east-1_AHpHN53Sf')
ON CONFLICT (name) DO NOTHING;

-- Initialize health check current status
INSERT INTO health_check_current (check_id, status)
SELECT id, 'unknown' FROM health_checks
ON CONFLICT (check_id) DO NOTHING;

-- Default rate limit rules
INSERT INTO rate_limit_rules (name, description, scope, requests_per_window, window_seconds, burst_limit, exempt_roles) VALUES
('global_default', 'Default rate limit for all users', 'user', 1000, 60, 50, ARRAY['superadmin', 'admin']),
('auth_endpoints', 'Auth endpoint limits', 'ip', 20, 60, 5, '{}'),
('upload_limit', 'File upload rate limit', 'user', 100, 3600, 10, ARRAY['superadmin', 'admin', 'filmmaker']),
('api_heavy', 'Heavy API endpoints (exports, reports)', 'user', 10, 60, 2, ARRAY['superadmin'])
ON CONFLICT DO NOTHING;

-- Default feature flags
INSERT INTO feature_flags (key, name, description, category, status) VALUES
('enable_new_player', 'New Video Player', 'Enable the redesigned video player', 'frontend', 'disabled'),
('beta_watch_parties', 'Watch Parties Beta', 'Enable watch party feature for beta users', 'beta', 'targeted'),
('enable_ai_recommendations', 'AI Recommendations', 'Enable AI-powered content recommendations', 'experiment', 'percentage'),
('killswitch_uploads', 'Disable Uploads', 'Emergency killswitch for file uploads', 'killswitch', 'disabled'),
('enable_live_streaming', 'Live Streaming', 'Enable live streaming features', 'rollout', 'percentage')
ON CONFLICT (key) DO NOTHING;

-- Update rollout percentages
UPDATE feature_flags SET rollout_percentage = 50 WHERE key = 'enable_ai_recommendations';
UPDATE feature_flags SET rollout_percentage = 25 WHERE key = 'enable_live_streaming';

-- Default system config
INSERT INTO system_config (key, value, description, category) VALUES
('maintenance_mode', 'false', 'Enable maintenance mode', 'system'),
('max_upload_size_mb', '500', 'Maximum file upload size in MB', 'uploads'),
('default_video_quality', '"1080p"', 'Default video transcoding quality', 'video'),
('enable_email_notifications', 'true', 'Enable email notifications', 'notifications'),
('creator_pool_percentage', '0.10', 'Percentage of revenue for creator pool', 'monetization'),
('min_payout_cents', '2500', 'Minimum payout threshold in cents', 'monetization')
ON CONFLICT (key) DO UPDATE SET updated_at = NOW();

-- Default alert rules
INSERT INTO alert_rules (name, description, check_type, condition, severity, notification_channels) VALUES
('health_check_failure', 'Alert when health check fails', 'health_check',
    '{"check_status": "unhealthy", "consecutive_failures": 3}', 'error', ARRAY['email']),
('high_error_rate', 'Alert when error rate exceeds threshold', 'error_rate',
    '{"threshold_percent": 5, "window_minutes": 5}', 'warning', ARRAY['email']),
('database_latency', 'Alert when database latency is high', 'latency',
    '{"metric": "database", "threshold_ms": 1000}', 'warning', ARRAY['email'])
ON CONFLICT DO NOTHING;
