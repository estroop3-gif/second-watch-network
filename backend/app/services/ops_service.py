"""
Ops Service - Health Checks, Rate Limiting, and System Monitoring

Provides operational tooling for the Second Watch Network platform:
- Deep health checks for all dependencies
- Rate limiting evaluation and tracking
- System alerts and incident management
- Ops dashboard data
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import asyncio
import boto3
from botocore.exceptions import ClientError

from app.core.database import execute_query, execute_single, execute_insert
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ============================================================================
# HEALTH CHECK SERVICE
# ============================================================================

async def perform_health_check(check_name: str) -> Dict[str, Any]:
    """
    Perform a specific health check and record the result.

    Args:
        check_name: Name of the health check to perform

    Returns:
        Health check result with status and timing
    """
    check = execute_single(
        "SELECT * FROM health_checks WHERE name = :name AND enabled = true",
        {"name": check_name}
    )

    if not check:
        return {"error": f"Health check not found: {check_name}"}

    start_time = datetime.utcnow()
    status = "healthy"
    error_message = None
    metadata = {}

    try:
        if check["check_type"] == "database":
            await _check_database(check)
        elif check["check_type"] == "s3":
            await _check_s3(check)
        elif check["check_type"] == "cognito":
            await _check_cognito(check)
        elif check["check_type"] == "redis":
            await _check_redis(check)
        elif check["check_type"] == "external_api":
            await _check_external_api(check)
        else:
            # Custom check - just verify we can query
            status = "healthy"
    except Exception as e:
        status = "unhealthy"
        error_message = str(e)
        logger.error(f"Health check {check_name} failed: {e}")

    response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

    # Check if response time indicates degraded performance
    timeout_ms = check.get("timeout_ms", 5000)
    if status == "healthy" and response_time_ms > timeout_ms * 0.8:
        status = "degraded"
        metadata["reason"] = "slow_response"

    # Record result
    execute_query(
        """
        SELECT record_health_check_result(
            :check_name, :status::health_status,
            :response_time_ms, :error_message, :metadata
        )
        """,
        {
            "check_name": check_name,
            "status": status,
            "response_time_ms": response_time_ms,
            "error_message": error_message,
            "metadata": metadata
        }
    )

    return {
        "name": check_name,
        "status": status,
        "response_time_ms": response_time_ms,
        "error_message": error_message,
        "checked_at": datetime.utcnow().isoformat()
    }


async def _check_database(check: Dict[str, Any]) -> None:
    """Check database connectivity and basic query performance."""
    result = execute_single("SELECT 1 as test, NOW() as server_time", {})
    if not result or result.get("test") != 1:
        raise Exception("Database query failed")


async def _check_s3(check: Dict[str, Any]) -> None:
    """Check S3 bucket accessibility."""
    bucket_name = check.get("endpoint_or_target")
    if not bucket_name:
        raise Exception("No bucket specified")

    s3 = boto3.client("s3")
    try:
        s3.head_bucket(Bucket=bucket_name)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "404":
            raise Exception(f"Bucket not found: {bucket_name}")
        elif error_code == "403":
            raise Exception(f"Access denied to bucket: {bucket_name}")
        raise


async def _check_cognito(check: Dict[str, Any]) -> None:
    """Check Cognito user pool accessibility."""
    pool_id = check.get("endpoint_or_target") or settings.COGNITO_USER_POOL_ID
    if not pool_id:
        raise Exception("No user pool ID specified")

    cognito = boto3.client("cognito-idp", region_name=settings.COGNITO_REGION)
    try:
        cognito.describe_user_pool(UserPoolId=pool_id)
    except ClientError as e:
        raise Exception(f"Cognito check failed: {e}")


async def _check_redis(check: Dict[str, Any]) -> None:
    """Check Redis connectivity (placeholder for future implementation)."""
    # Redis not currently in use - skip
    pass


async def _check_external_api(check: Dict[str, Any]) -> None:
    """Check external API availability."""
    import httpx

    url = check.get("endpoint_or_target")
    if not url:
        raise Exception("No URL specified")

    timeout = check.get("timeout_ms", 5000) / 1000
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url)
        if response.status_code >= 500:
            raise Exception(f"External API returned {response.status_code}")


async def run_all_health_checks() -> List[Dict[str, Any]]:
    """Run all enabled health checks concurrently."""
    checks = execute_query(
        "SELECT name FROM health_checks WHERE enabled = true",
        {}
    )

    if not checks:
        return []

    # Run checks concurrently
    tasks = [perform_health_check(check["name"]) for check in checks]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle any exceptions
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            final_results.append({
                "name": checks[i]["name"],
                "status": "unhealthy",
                "error_message": str(result),
                "checked_at": datetime.utcnow().isoformat()
            })
        else:
            final_results.append(result)

    return final_results


def get_health_status() -> Dict[str, Any]:
    """Get current health status for all checks."""
    results = execute_query(
        """
        SELECT
            hc.name,
            hc.check_type,
            hcc.status,
            hcc.consecutive_failures,
            hcc.last_check_at,
            hcc.last_success_at,
            hcc.last_failure_at
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
            hc.name
        """,
        {}
    )

    # Determine overall status
    statuses = [r["status"] for r in results if r["status"]]
    if "unhealthy" in statuses:
        overall = "unhealthy"
    elif "degraded" in statuses:
        overall = "degraded"
    elif all(s == "healthy" for s in statuses):
        overall = "healthy"
    else:
        overall = "unknown"

    return {
        "overall_status": overall,
        "checks": results,
        "checked_at": datetime.utcnow().isoformat()
    }


def get_health_history(
    check_name: Optional[str] = None,
    hours: int = 24
) -> List[Dict[str, Any]]:
    """Get health check history."""
    params = {"hours": hours}
    where_clause = "WHERE hcr.checked_at > NOW() - :hours * INTERVAL '1 hour'"

    if check_name:
        where_clause += " AND hc.name = :check_name"
        params["check_name"] = check_name

    results = execute_query(
        f"""
        SELECT
            hc.name,
            hcr.status,
            hcr.response_time_ms,
            hcr.error_message,
            hcr.checked_at
        FROM health_check_results hcr
        JOIN health_checks hc ON hc.id = hcr.check_id
        {where_clause}
        ORDER BY hcr.checked_at DESC
        LIMIT 1000
        """,
        params
    )

    return results


# ============================================================================
# RATE LIMITING SERVICE
# ============================================================================

def check_rate_limit(
    identifier: str,
    scope: str = "user",
    endpoint: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check if a request should be rate limited.

    Args:
        identifier: User ID, IP address, or API key
        scope: Rate limit scope (user, ip, api_key, endpoint)
        endpoint: Optional endpoint being accessed

    Returns:
        Rate limit result with allowed status and remaining requests
    """
    result = execute_single(
        "SELECT check_rate_limit(:identifier, :scope::rate_limit_scope, :endpoint)",
        {"identifier": identifier, "scope": scope, "endpoint": endpoint}
    )

    if result and "check_rate_limit" in result:
        return result["check_rate_limit"]

    return {"allowed": True, "reason": "no_rule"}


def get_rate_limit_rules() -> List[Dict[str, Any]]:
    """Get all rate limit rules."""
    return execute_query(
        """
        SELECT
            id, name, description, scope, endpoint_pattern,
            requests_per_window, window_seconds, burst_limit,
            penalty_seconds, exempt_roles, enabled, priority
        FROM rate_limit_rules
        ORDER BY priority, name
        """,
        {}
    )


def create_rate_limit_rule(
    name: str,
    scope: str,
    requests_per_window: int,
    window_seconds: int,
    description: Optional[str] = None,
    endpoint_pattern: Optional[str] = None,
    burst_limit: Optional[int] = None,
    penalty_seconds: int = 0,
    exempt_roles: List[str] = None
) -> Dict[str, Any]:
    """Create a new rate limit rule."""
    return execute_insert(
        """
        INSERT INTO rate_limit_rules (
            name, description, scope, endpoint_pattern,
            requests_per_window, window_seconds, burst_limit,
            penalty_seconds, exempt_roles
        ) VALUES (
            :name, :description, :scope::rate_limit_scope, :endpoint_pattern,
            :requests_per_window, :window_seconds, :burst_limit,
            :penalty_seconds, :exempt_roles
        )
        RETURNING *
        """,
        {
            "name": name,
            "description": description,
            "scope": scope,
            "endpoint_pattern": endpoint_pattern,
            "requests_per_window": requests_per_window,
            "window_seconds": window_seconds,
            "burst_limit": burst_limit,
            "penalty_seconds": penalty_seconds,
            "exempt_roles": exempt_roles or []
        }
    )


def update_rate_limit_rule(
    rule_id: str,
    updates: Dict[str, Any]
) -> Dict[str, Any]:
    """Update a rate limit rule."""
    allowed_fields = {
        "name", "description", "requests_per_window", "window_seconds",
        "burst_limit", "penalty_seconds", "exempt_roles", "enabled", "priority"
    }

    set_clauses = []
    params = {"rule_id": rule_id}

    for key, value in updates.items():
        if key in allowed_fields:
            set_clauses.append(f"{key} = :{key}")
            params[key] = value

    if not set_clauses:
        raise ValueError("No valid fields to update")

    set_clauses.append("updated_at = NOW()")

    return execute_single(
        f"""
        UPDATE rate_limit_rules
        SET {', '.join(set_clauses)}
        WHERE id = :rule_id
        RETURNING *
        """,
        params
    )


def create_rate_limit_override(
    rule_id: str,
    override_type: str,
    override_value: str,
    multiplier: float = 1.0,
    exempt: bool = False,
    reason: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """Create a rate limit override for a specific user/IP."""
    return execute_insert(
        """
        INSERT INTO rate_limit_overrides (
            rule_id, override_type, override_value,
            multiplier, exempt, reason, expires_at, created_by
        ) VALUES (
            :rule_id, :override_type, :override_value,
            :multiplier, :exempt, :reason, :expires_at, :created_by
        )
        RETURNING *
        """,
        {
            "rule_id": rule_id,
            "override_type": override_type,
            "override_value": override_value,
            "multiplier": multiplier,
            "exempt": exempt,
            "reason": reason,
            "expires_at": expires_at,
            "created_by": created_by
        }
    )


def get_rate_limit_violations(
    hours: int = 24,
    identifier: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Get recent rate limit violations."""
    params = {"hours": hours, "limit": limit}
    where_clause = "WHERE rlv.violated_at > NOW() - :hours * INTERVAL '1 hour'"

    if identifier:
        where_clause += " AND rlv.identifier = :identifier"
        params["identifier"] = identifier

    return execute_query(
        f"""
        SELECT
            rlv.id,
            rlr.name as rule_name,
            rlv.scope,
            rlv.identifier,
            rlv.endpoint,
            rlv.requests_made,
            rlv.limit_value,
            rlv.violated_at
        FROM rate_limit_violations rlv
        JOIN rate_limit_rules rlr ON rlr.id = rlv.rule_id
        {where_clause}
        ORDER BY rlv.violated_at DESC
        LIMIT :limit
        """,
        params
    )


# ============================================================================
# ALERTS & INCIDENTS
# ============================================================================

def create_alert(
    alert_type: str,
    severity: str,
    title: str,
    message: Optional[str] = None,
    source: Optional[str] = None,
    metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Create a new system alert."""
    return execute_insert(
        """
        INSERT INTO system_alerts (
            alert_type, severity, title, message, source, metadata
        ) VALUES (
            :alert_type, :severity::alert_severity, :title, :message, :source, :metadata
        )
        RETURNING *
        """,
        {
            "alert_type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "source": source,
            "metadata": metadata or {}
        }
    )


def get_active_alerts(
    severity: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get all active alerts."""
    params = {}
    where_clause = "WHERE status = 'active'"

    if severity:
        where_clause += " AND severity = :severity::alert_severity"
        params["severity"] = severity

    return execute_query(
        f"""
        SELECT
            id, alert_type, severity, title, message, source,
            metadata, created_at
        FROM system_alerts
        {where_clause}
        ORDER BY
            CASE severity
                WHEN 'critical' THEN 1
                WHEN 'error' THEN 2
                WHEN 'warning' THEN 3
                ELSE 4
            END,
            created_at DESC
        """,
        params
    )


def acknowledge_alert(
    alert_id: str,
    acknowledged_by: str
) -> Dict[str, Any]:
    """Acknowledge an alert."""
    return execute_single(
        """
        UPDATE system_alerts
        SET status = 'acknowledged', acknowledged_by = :acknowledged_by, acknowledged_at = NOW()
        WHERE id = :alert_id
        RETURNING *
        """,
        {"alert_id": alert_id, "acknowledged_by": acknowledged_by}
    )


def resolve_alert(
    alert_id: str,
    resolved_by: str
) -> Dict[str, Any]:
    """Resolve an alert."""
    return execute_single(
        """
        UPDATE system_alerts
        SET status = 'resolved', resolved_by = :resolved_by, resolved_at = NOW()
        WHERE id = :alert_id
        RETURNING *
        """,
        {"alert_id": alert_id, "resolved_by": resolved_by}
    )


def create_incident(
    title: str,
    severity: str,
    description: Optional[str] = None,
    impact: Optional[str] = None,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new incident."""
    incident = execute_insert(
        """
        INSERT INTO incidents (title, description, severity, impact, created_by)
        VALUES (:title, :description, :severity::alert_severity, :impact, :created_by)
        RETURNING *
        """,
        {
            "title": title,
            "description": description,
            "severity": severity,
            "impact": impact,
            "created_by": created_by
        }
    )

    # Create initial update
    execute_insert(
        """
        INSERT INTO incident_updates (incident_id, status, message, created_by)
        VALUES (:incident_id, 'investigating', 'Incident created', :created_by)
        """,
        {"incident_id": incident["id"], "created_by": created_by}
    )

    return incident


def update_incident(
    incident_id: str,
    status: str,
    message: str,
    updated_by: Optional[str] = None
) -> Dict[str, Any]:
    """Update an incident with a new status."""
    # Create update entry
    execute_insert(
        """
        INSERT INTO incident_updates (incident_id, status, message, created_by)
        VALUES (:incident_id, :status, :message, :created_by)
        """,
        {
            "incident_id": incident_id,
            "status": status,
            "message": message,
            "created_by": updated_by
        }
    )

    # Update incident status
    update_fields = ["status = :status", "updated_at = NOW()"]

    if status == "identified":
        update_fields.append("identified_at = NOW()")
    elif status == "resolved":
        update_fields.append("resolved_at = NOW()")

    return execute_single(
        f"""
        UPDATE incidents
        SET {', '.join(update_fields)}
        WHERE id = :incident_id
        RETURNING *
        """,
        {"incident_id": incident_id, "status": status}
    )


def get_incidents(
    include_resolved: bool = False,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Get incidents."""
    where_clause = "" if include_resolved else "WHERE status != 'resolved'"

    return execute_query(
        f"""
        SELECT
            id, title, description, severity, status, impact,
            started_at, identified_at, resolved_at, postmortem_url,
            created_at, updated_at
        FROM incidents
        {where_clause}
        ORDER BY
            CASE status
                WHEN 'investigating' THEN 1
                WHEN 'identified' THEN 2
                WHEN 'monitoring' THEN 3
                ELSE 4
            END,
            CASE severity
                WHEN 'critical' THEN 1
                WHEN 'error' THEN 2
                WHEN 'warning' THEN 3
                ELSE 4
            END,
            started_at DESC
        LIMIT :limit
        """,
        {"limit": limit}
    )


def get_incident_timeline(incident_id: str) -> List[Dict[str, Any]]:
    """Get timeline of updates for an incident."""
    return execute_query(
        """
        SELECT
            iu.id, iu.status, iu.message, iu.created_at,
            p.display_name as created_by_name
        FROM incident_updates iu
        LEFT JOIN profiles p ON p.id = iu.created_by
        WHERE iu.incident_id = :incident_id
        ORDER BY iu.created_at ASC
        """,
        {"incident_id": incident_id}
    )


# ============================================================================
# OPS DASHBOARD
# ============================================================================

def get_ops_dashboard() -> Dict[str, Any]:
    """Get comprehensive ops dashboard data."""
    result = execute_single("SELECT get_ops_dashboard() as data", {})
    return result["data"] if result else {}


def get_api_usage_stats(
    days: int = 7,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Get API usage statistics."""
    params = {"days": days}
    where_clause = "WHERE date > CURRENT_DATE - :days"

    if user_id:
        where_clause += " AND user_id = :user_id"
        params["user_id"] = user_id

    daily_stats = execute_query(
        f"""
        SELECT
            date,
            SUM(request_count) as requests,
            SUM(error_count) as errors,
            AVG(total_latency_ms / NULLIF(request_count, 0)) as avg_latency_ms
        FROM api_usage_daily
        {where_clause}
        GROUP BY date
        ORDER BY date
        """,
        params
    )

    endpoint_stats = execute_query(
        f"""
        SELECT
            endpoint_group,
            SUM(request_count) as requests,
            SUM(error_count) as errors
        FROM api_usage_daily
        {where_clause}
        GROUP BY endpoint_group
        ORDER BY requests DESC
        """,
        params
    )

    return {
        "daily": daily_stats,
        "by_endpoint": endpoint_stats
    }


def get_slow_requests(
    threshold_ms: int = 1000,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get slow requests above threshold."""
    return execute_query(
        """
        SELECT
            endpoint, method, latency_ms, query_count,
            request_metadata, recorded_at
        FROM slow_requests
        WHERE latency_ms >= :threshold_ms
        ORDER BY recorded_at DESC
        LIMIT :limit
        """,
        {"threshold_ms": threshold_ms, "limit": limit}
    )


def record_slow_request(
    endpoint: str,
    method: str,
    latency_ms: int,
    user_id: Optional[str] = None,
    query_count: Optional[int] = None,
    metadata: Dict[str, Any] = None
) -> None:
    """Record a slow request."""
    execute_insert(
        """
        INSERT INTO slow_requests (endpoint, method, user_id, latency_ms, query_count, request_metadata)
        VALUES (:endpoint, :method, :user_id, :latency_ms, :query_count, :metadata)
        """,
        {
            "endpoint": endpoint,
            "method": method,
            "user_id": user_id,
            "latency_ms": latency_ms,
            "query_count": query_count,
            "metadata": metadata or {}
        }
    )


# ============================================================================
# MAINTENANCE WINDOWS
# ============================================================================

def create_maintenance_window(
    title: str,
    scheduled_start: datetime,
    scheduled_end: datetime,
    description: Optional[str] = None,
    affected_services: List[str] = None,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """Create a scheduled maintenance window."""
    return execute_insert(
        """
        INSERT INTO maintenance_windows (
            title, description, affected_services,
            scheduled_start, scheduled_end, created_by
        ) VALUES (
            :title, :description, :affected_services,
            :scheduled_start, :scheduled_end, :created_by
        )
        RETURNING *
        """,
        {
            "title": title,
            "description": description,
            "affected_services": affected_services or [],
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "created_by": created_by
        }
    )


def get_upcoming_maintenance() -> List[Dict[str, Any]]:
    """Get upcoming maintenance windows."""
    return execute_query(
        """
        SELECT *
        FROM maintenance_windows
        WHERE status IN ('scheduled', 'in_progress')
            AND scheduled_end > NOW()
        ORDER BY scheduled_start
        """,
        {}
    )


def is_in_maintenance() -> Dict[str, Any]:
    """Check if system is currently in maintenance."""
    active = execute_single(
        """
        SELECT *
        FROM maintenance_windows
        WHERE status = 'in_progress'
            OR (status = 'scheduled' AND NOW() BETWEEN scheduled_start AND scheduled_end)
        ORDER BY scheduled_start
        LIMIT 1
        """,
        {}
    )

    return {
        "in_maintenance": active is not None,
        "window": active
    }
