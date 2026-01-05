"""
Ops API - Operational Tools and Admin Endpoints

Provides operational visibility and control for the Second Watch Network platform:
- Health checks and system status
- Rate limiting configuration
- Feature flags management
- Alerts and incidents
- System configuration
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import require_admin
from app.services import ops_service
from app.services import feature_flags_service

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class HealthCheckResult(BaseModel):
    name: str
    status: str
    response_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    checked_at: str


class RateLimitRuleCreate(BaseModel):
    name: str
    scope: str = "user"
    requests_per_window: int
    window_seconds: int
    description: Optional[str] = None
    endpoint_pattern: Optional[str] = None
    burst_limit: Optional[int] = None
    penalty_seconds: int = 0
    exempt_roles: List[str] = []


class RateLimitOverrideCreate(BaseModel):
    rule_id: str
    override_type: str
    override_value: str
    multiplier: float = 1.0
    exempt: bool = False
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None


class AlertCreate(BaseModel):
    alert_type: str
    severity: str
    title: str
    message: Optional[str] = None
    source: Optional[str] = None
    metadata: dict = {}


class IncidentCreate(BaseModel):
    title: str
    severity: str
    description: Optional[str] = None
    impact: Optional[str] = None


class IncidentUpdate(BaseModel):
    status: str
    message: str


class MaintenanceWindowCreate(BaseModel):
    title: str
    scheduled_start: datetime
    scheduled_end: datetime
    description: Optional[str] = None
    affected_services: List[str] = []


class FeatureFlagCreate(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    category: str = "backend"
    status: str = "disabled"
    rollout_percentage: int = 0
    default_value: bool = False
    metadata: dict = {}


class FeatureFlagUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    rollout_percentage: Optional[int] = None
    default_value: Optional[bool] = None
    metadata: Optional[dict] = None


class FlagTargetCreate(BaseModel):
    target_type: str
    target_value: str


class ConfigSet(BaseModel):
    value: dict
    description: Optional[str] = None
    category: str = "general"
    reason: Optional[str] = None


# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

@router.get("/ops/health", tags=["Ops"])
async def get_health_status():
    """Get current health status for all checks."""
    return ops_service.get_health_status()


@router.post("/ops/health/check", tags=["Ops"])
async def run_health_checks(
    profile: dict = Depends(require_admin)
):
    """Run all health checks and return results."""
    results = await ops_service.run_all_health_checks()
    return {"checks": results}


@router.post("/ops/health/check/{check_name}", tags=["Ops"])
async def run_single_health_check(
    check_name: str,
    profile: dict = Depends(require_admin)
):
    """Run a specific health check."""
    result = await ops_service.perform_health_check(check_name)
    return result


@router.get("/ops/health/history", tags=["Ops"])
async def get_health_history(
    check_name: Optional[str] = None,
    hours: int = Query(24, ge=1, le=168),
    profile: dict = Depends(require_admin)
):
    """Get health check history."""
    return ops_service.get_health_history(check_name, hours)


# ============================================================================
# RATE LIMITING ENDPOINTS
# ============================================================================

@router.get("/ops/rate-limits/rules", tags=["Ops"])
async def list_rate_limit_rules(
    profile: dict = Depends(require_admin)
):
    """List all rate limit rules."""
    return ops_service.get_rate_limit_rules()


@router.post("/ops/rate-limits/rules", tags=["Ops"])
async def create_rate_limit_rule(
    data: RateLimitRuleCreate,
    profile: dict = Depends(require_admin)
):
    """Create a new rate limit rule."""
    return ops_service.create_rate_limit_rule(
        name=data.name,
        scope=data.scope,
        requests_per_window=data.requests_per_window,
        window_seconds=data.window_seconds,
        description=data.description,
        endpoint_pattern=data.endpoint_pattern,
        burst_limit=data.burst_limit,
        penalty_seconds=data.penalty_seconds,
        exempt_roles=data.exempt_roles
    )


@router.put("/ops/rate-limits/rules/{rule_id}", tags=["Ops"])
async def update_rate_limit_rule(
    rule_id: str,
    updates: dict,
    profile: dict = Depends(require_admin)
):
    """Update a rate limit rule."""
    return ops_service.update_rate_limit_rule(rule_id, updates)


@router.post("/ops/rate-limits/overrides", tags=["Ops"])
async def create_rate_limit_override(
    data: RateLimitOverrideCreate,
    profile: dict = Depends(require_admin)
):
    """Create a rate limit override for a specific user/IP."""
    return ops_service.create_rate_limit_override(
        rule_id=data.rule_id,
        override_type=data.override_type,
        override_value=data.override_value,
        multiplier=data.multiplier,
        exempt=data.exempt,
        reason=data.reason,
        expires_at=data.expires_at,
        created_by=profile["id"]
    )


@router.get("/ops/rate-limits/violations", tags=["Ops"])
async def get_rate_limit_violations(
    hours: int = Query(24, ge=1, le=168),
    identifier: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    profile: dict = Depends(require_admin)
):
    """Get recent rate limit violations."""
    return ops_service.get_rate_limit_violations(hours, identifier, limit)


# ============================================================================
# ALERTS & INCIDENTS
# ============================================================================

@router.get("/ops/alerts", tags=["Ops"])
async def get_active_alerts(
    severity: Optional[str] = None,
    profile: dict = Depends(require_admin)
):
    """Get all active alerts."""
    return ops_service.get_active_alerts(severity)


@router.post("/ops/alerts", tags=["Ops"])
async def create_alert(
    data: AlertCreate,
    profile: dict = Depends(require_admin)
):
    """Create a new system alert."""
    return ops_service.create_alert(
        alert_type=data.alert_type,
        severity=data.severity,
        title=data.title,
        message=data.message,
        source=data.source,
        metadata=data.metadata
    )


@router.post("/ops/alerts/{alert_id}/acknowledge", tags=["Ops"])
async def acknowledge_alert(
    alert_id: str,
    profile: dict = Depends(require_admin)
):
    """Acknowledge an alert."""
    result = ops_service.acknowledge_alert(alert_id, profile["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.post("/ops/alerts/{alert_id}/resolve", tags=["Ops"])
async def resolve_alert(
    alert_id: str,
    profile: dict = Depends(require_admin)
):
    """Resolve an alert."""
    result = ops_service.resolve_alert(alert_id, profile["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.get("/ops/incidents", tags=["Ops"])
async def list_incidents(
    include_resolved: bool = False,
    limit: int = Query(20, ge=1, le=100),
    profile: dict = Depends(require_admin)
):
    """List incidents."""
    return ops_service.get_incidents(include_resolved, limit)


@router.post("/ops/incidents", tags=["Ops"])
async def create_incident(
    data: IncidentCreate,
    profile: dict = Depends(require_admin)
):
    """Create a new incident."""
    return ops_service.create_incident(
        title=data.title,
        severity=data.severity,
        description=data.description,
        impact=data.impact,
        created_by=profile["id"]
    )


@router.post("/ops/incidents/{incident_id}/update", tags=["Ops"])
async def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    profile: dict = Depends(require_admin)
):
    """Update an incident with a new status."""
    return ops_service.update_incident(
        incident_id=incident_id,
        status=data.status,
        message=data.message,
        updated_by=profile["id"]
    )


@router.get("/ops/incidents/{incident_id}/timeline", tags=["Ops"])
async def get_incident_timeline(
    incident_id: str,
    profile: dict = Depends(require_admin)
):
    """Get timeline of updates for an incident."""
    return ops_service.get_incident_timeline(incident_id)


# ============================================================================
# MAINTENANCE WINDOWS
# ============================================================================

@router.get("/ops/maintenance", tags=["Ops"])
async def get_upcoming_maintenance(
    profile: dict = Depends(require_admin)
):
    """Get upcoming maintenance windows."""
    return ops_service.get_upcoming_maintenance()


@router.get("/ops/maintenance/status", tags=["Ops"])
async def check_maintenance_status():
    """Check if system is currently in maintenance (public endpoint)."""
    return ops_service.is_in_maintenance()


@router.post("/ops/maintenance", tags=["Ops"])
async def create_maintenance_window(
    data: MaintenanceWindowCreate,
    profile: dict = Depends(require_admin)
):
    """Create a scheduled maintenance window."""
    return ops_service.create_maintenance_window(
        title=data.title,
        scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end,
        description=data.description,
        affected_services=data.affected_services,
        created_by=profile["id"]
    )


# ============================================================================
# OPS DASHBOARD
# ============================================================================

@router.get("/ops/dashboard", tags=["Ops"])
async def get_ops_dashboard(
    profile: dict = Depends(require_admin)
):
    """Get comprehensive ops dashboard data."""
    return ops_service.get_ops_dashboard()


@router.get("/ops/api-usage", tags=["Ops"])
async def get_api_usage_stats(
    days: int = Query(7, ge=1, le=30),
    user_id: Optional[str] = None,
    profile: dict = Depends(require_admin)
):
    """Get API usage statistics."""
    return ops_service.get_api_usage_stats(days, user_id)


@router.get("/ops/slow-requests", tags=["Ops"])
async def get_slow_requests(
    threshold_ms: int = Query(1000, ge=100),
    limit: int = Query(50, ge=1, le=200),
    profile: dict = Depends(require_admin)
):
    """Get slow requests above threshold."""
    return ops_service.get_slow_requests(threshold_ms, limit)


# ============================================================================
# FEATURE FLAGS
# ============================================================================

@router.get("/ops/feature-flags", tags=["Feature Flags"])
async def list_feature_flags(
    category: Optional[str] = None,
    status: Optional[str] = None,
    profile: dict = Depends(require_admin)
):
    """List all feature flags."""
    return feature_flags_service.list_flags(category, status)


@router.get("/ops/feature-flags/{flag_key}", tags=["Feature Flags"])
async def get_feature_flag(
    flag_key: str,
    profile: dict = Depends(require_admin)
):
    """Get a feature flag by key."""
    flag = feature_flags_service.get_flag(flag_key)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flag


@router.post("/ops/feature-flags", tags=["Feature Flags"])
async def create_feature_flag(
    data: FeatureFlagCreate,
    profile: dict = Depends(require_admin)
):
    """Create a new feature flag."""
    try:
        return feature_flags_service.create_flag(
            key=data.key,
            name=data.name,
            description=data.description,
            category=data.category,
            status=data.status,
            rollout_percentage=data.rollout_percentage,
            default_value=data.default_value,
            metadata=data.metadata,
            created_by=profile["id"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/ops/feature-flags/{flag_key}", tags=["Feature Flags"])
async def update_feature_flag(
    flag_key: str,
    data: FeatureFlagUpdate,
    profile: dict = Depends(require_admin)
):
    """Update a feature flag."""
    updates = data.dict(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    flag = feature_flags_service.update_flag(flag_key, updates)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flag


@router.delete("/ops/feature-flags/{flag_key}", tags=["Feature Flags"])
async def delete_feature_flag(
    flag_key: str,
    profile: dict = Depends(require_admin)
):
    """Delete a feature flag."""
    if not feature_flags_service.delete_flag(flag_key):
        raise HTTPException(status_code=404, detail="Flag not found")
    return {"deleted": True}


@router.post("/ops/feature-flags/{flag_key}/enable", tags=["Feature Flags"])
async def enable_feature_flag(
    flag_key: str,
    profile: dict = Depends(require_admin)
):
    """Enable a feature flag."""
    return feature_flags_service.enable_flag(flag_key)


@router.post("/ops/feature-flags/{flag_key}/disable", tags=["Feature Flags"])
async def disable_feature_flag(
    flag_key: str,
    profile: dict = Depends(require_admin)
):
    """Disable a feature flag."""
    return feature_flags_service.disable_flag(flag_key)


@router.post("/ops/feature-flags/{flag_key}/percentage", tags=["Feature Flags"])
async def set_flag_percentage(
    flag_key: str,
    percentage: int = Query(..., ge=0, le=100),
    profile: dict = Depends(require_admin)
):
    """Set a flag to percentage rollout."""
    return feature_flags_service.set_percentage(flag_key, percentage)


@router.get("/ops/feature-flags/{flag_key}/targets", tags=["Feature Flags"])
async def get_flag_targets(
    flag_key: str,
    profile: dict = Depends(require_admin)
):
    """Get all targets for a feature flag."""
    return feature_flags_service.get_targets(flag_key)


@router.post("/ops/feature-flags/{flag_key}/targets", tags=["Feature Flags"])
async def add_flag_target(
    flag_key: str,
    data: FlagTargetCreate,
    profile: dict = Depends(require_admin)
):
    """Add a target to a feature flag."""
    try:
        return feature_flags_service.add_target(
            flag_key=flag_key,
            target_type=data.target_type,
            target_value=data.target_value
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/ops/feature-flags/{flag_key}/targets", tags=["Feature Flags"])
async def remove_flag_target(
    flag_key: str,
    target_type: str,
    target_value: str,
    profile: dict = Depends(require_admin)
):
    """Remove a target from a feature flag."""
    try:
        if not feature_flags_service.remove_target(flag_key, target_type, target_value):
            raise HTTPException(status_code=404, detail="Target not found")
        return {"removed": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/ops/feature-flags/{flag_key}/stats", tags=["Feature Flags"])
async def get_flag_stats(
    flag_key: str,
    hours: int = Query(24, ge=1, le=168),
    profile: dict = Depends(require_admin)
):
    """Get evaluation statistics for a flag."""
    return feature_flags_service.get_evaluation_stats(flag_key, hours)


# ============================================================================
# FEATURE FLAG EVALUATION (Client-facing)
# ============================================================================

@router.get("/feature-flags/evaluate/{flag_key}", tags=["Feature Flags"])
async def evaluate_flag(
    flag_key: str,
    profile: Optional[dict] = None
):
    """
    Evaluate a feature flag for the current user.
    Public endpoint - works without authentication.
    """
    user_id = profile["id"] if profile else None
    context = {}

    if profile:
        # Build context from profile
        roles = []
        if profile.get("is_superadmin"):
            roles.append("superadmin")
        if profile.get("is_admin"):
            roles.append("admin")
        if profile.get("is_moderator"):
            roles.append("moderator")
        if profile.get("is_order_member"):
            roles.append("order_member")
        if profile.get("is_filmmaker"):
            roles.append("filmmaker")

        context = {"roles": roles}

    return feature_flags_service.evaluate_flag(flag_key, user_id, context)


@router.post("/feature-flags/evaluate-batch", tags=["Feature Flags"])
async def evaluate_flags_batch(
    flag_keys: List[str],
    profile: Optional[dict] = None
):
    """Evaluate multiple feature flags at once."""
    user_id = profile["id"] if profile else None
    context = {}

    if profile:
        roles = []
        if profile.get("is_superadmin"):
            roles.append("superadmin")
        if profile.get("is_admin"):
            roles.append("admin")
        if profile.get("is_order_member"):
            roles.append("order_member")

        context = {"roles": roles}

    return feature_flags_service.evaluate_flags_batch(flag_keys, user_id, context)


# ============================================================================
# SYSTEM CONFIGURATION
# ============================================================================

@router.get("/ops/config", tags=["System Config"])
async def list_configs(
    category: Optional[str] = None,
    profile: dict = Depends(require_admin)
):
    """List all system configurations."""
    return feature_flags_service.list_configs(category)


@router.get("/ops/config/{key}", tags=["System Config"])
async def get_config(
    key: str,
    profile: dict = Depends(require_admin)
):
    """Get a system configuration value."""
    value = feature_flags_service.get_config(key)
    if value is None:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"key": key, "value": value}


@router.put("/ops/config/{key}", tags=["System Config"])
async def set_config(
    key: str,
    data: ConfigSet,
    profile: dict = Depends(require_admin)
):
    """Set a system configuration value."""
    return feature_flags_service.set_config(
        key=key,
        value=data.value,
        description=data.description,
        category=data.category,
        updated_by=profile["id"],
        reason=data.reason
    )


@router.get("/ops/config/{key}/history", tags=["System Config"])
async def get_config_history(
    key: str,
    limit: int = Query(20, ge=1, le=100),
    profile: dict = Depends(require_admin)
):
    """Get configuration change history."""
    return feature_flags_service.get_config_history(key, limit)
