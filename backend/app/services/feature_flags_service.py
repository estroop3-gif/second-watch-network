"""
Feature Flags Service

Provides feature flag evaluation and management for the Second Watch Network platform.
Supports:
- Boolean flags (enabled/disabled)
- Percentage rollouts
- Targeted rollouts (by user, role, organization)
- Killswitches for emergency disabling
"""
from typing import Optional, Dict, Any, List
from datetime import datetime

from app.core.database import execute_query, execute_single, execute_insert
from app.core.logging import get_logger

logger = get_logger(__name__)

# In-memory cache for frequently accessed flags
_flag_cache: Dict[str, Dict[str, Any]] = {}
_cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 60


def _refresh_cache_if_needed() -> None:
    """Refresh flag cache if expired."""
    global _flag_cache, _cache_timestamp

    if _cache_timestamp and (datetime.utcnow() - _cache_timestamp).seconds < CACHE_TTL_SECONDS:
        return

    flags = execute_query(
        """
        SELECT id, key, name, status, rollout_percentage, default_value, metadata
        FROM feature_flags
        """,
        {}
    )

    _flag_cache = {f["key"]: f for f in flags}
    _cache_timestamp = datetime.utcnow()


def invalidate_cache() -> None:
    """Invalidate the feature flag cache."""
    global _flag_cache, _cache_timestamp
    _flag_cache = {}
    _cache_timestamp = None


# ============================================================================
# FLAG EVALUATION
# ============================================================================

def evaluate_flag(
    flag_key: str,
    user_id: Optional[str] = None,
    context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Evaluate a feature flag for a user.

    Args:
        flag_key: The feature flag key
        user_id: Optional user ID for targeted rollouts
        context: Additional context (roles, organization_id, etc.)

    Returns:
        Dict with 'enabled' boolean and 'reason' string
    """
    context = context or {}

    # Use database function for consistent evaluation
    result = execute_single(
        "SELECT evaluate_feature_flag(:flag_key, :user_id, :context)",
        {
            "flag_key": flag_key,
            "user_id": user_id,
            "context": context
        }
    )

    if result and "evaluate_feature_flag" in result:
        return result["evaluate_feature_flag"]

    return {"enabled": False, "reason": "evaluation_error"}


def is_enabled(
    flag_key: str,
    user_id: Optional[str] = None,
    context: Dict[str, Any] = None
) -> bool:
    """
    Simple helper to check if a flag is enabled.

    Args:
        flag_key: The feature flag key
        user_id: Optional user ID
        context: Additional context

    Returns:
        True if flag is enabled
    """
    result = evaluate_flag(flag_key, user_id, context)
    return result.get("enabled", False)


def evaluate_flags_batch(
    flag_keys: List[str],
    user_id: Optional[str] = None,
    context: Dict[str, Any] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Evaluate multiple flags at once.

    Args:
        flag_keys: List of flag keys to evaluate
        user_id: Optional user ID
        context: Additional context

    Returns:
        Dict mapping flag keys to their evaluation results
    """
    results = {}
    for key in flag_keys:
        results[key] = evaluate_flag(key, user_id, context)
    return results


def get_enabled_flags_for_user(
    user_id: str,
    context: Dict[str, Any] = None
) -> List[str]:
    """
    Get all enabled flags for a user.

    Args:
        user_id: User ID
        context: Additional context

    Returns:
        List of enabled flag keys
    """
    _refresh_cache_if_needed()

    enabled = []
    for key in _flag_cache.keys():
        if is_enabled(key, user_id, context):
            enabled.append(key)

    return enabled


# ============================================================================
# FLAG MANAGEMENT
# ============================================================================

def list_flags(
    category: Optional[str] = None,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List all feature flags with optional filtering."""
    params = {}
    where_clauses = []

    if category:
        where_clauses.append("category = :category::feature_flag_category")
        params["category"] = category

    if status:
        where_clauses.append("status = :status::feature_flag_status")
        params["status"] = status

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    return execute_query(
        f"""
        SELECT
            id, key, name, description, category, status,
            rollout_percentage, default_value, metadata,
            created_at, updated_at
        FROM feature_flags
        {where_sql}
        ORDER BY category, name
        """,
        params
    )


def get_flag(flag_key: str) -> Optional[Dict[str, Any]]:
    """Get a single feature flag by key."""
    return execute_single(
        """
        SELECT
            id, key, name, description, category, status,
            rollout_percentage, default_value, metadata,
            created_at, updated_at
        FROM feature_flags
        WHERE key = :key
        """,
        {"key": flag_key}
    )


def create_flag(
    key: str,
    name: str,
    description: Optional[str] = None,
    category: str = "backend",
    status: str = "disabled",
    rollout_percentage: int = 0,
    default_value: Any = False,
    metadata: Dict[str, Any] = None,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new feature flag."""
    flag = execute_insert(
        """
        INSERT INTO feature_flags (
            key, name, description, category, status,
            rollout_percentage, default_value, metadata, created_by
        ) VALUES (
            :key, :name, :description, :category::feature_flag_category,
            :status::feature_flag_status, :rollout_percentage,
            :default_value, :metadata, :created_by
        )
        RETURNING *
        """,
        {
            "key": key,
            "name": name,
            "description": description,
            "category": category,
            "status": status,
            "rollout_percentage": rollout_percentage,
            "default_value": default_value,
            "metadata": metadata or {},
            "created_by": created_by
        }
    )

    invalidate_cache()
    return flag


def update_flag(
    flag_key: str,
    updates: Dict[str, Any]
) -> Dict[str, Any]:
    """Update a feature flag."""
    allowed_fields = {
        "name", "description", "status", "rollout_percentage",
        "default_value", "metadata"
    }

    set_clauses = []
    params = {"key": flag_key}

    for field, value in updates.items():
        if field in allowed_fields:
            if field == "status":
                set_clauses.append(f"{field} = :{field}::feature_flag_status")
            else:
                set_clauses.append(f"{field} = :{field}")
            params[field] = value

    if not set_clauses:
        raise ValueError("No valid fields to update")

    set_clauses.append("updated_at = NOW()")

    flag = execute_single(
        f"""
        UPDATE feature_flags
        SET {', '.join(set_clauses)}
        WHERE key = :key
        RETURNING *
        """,
        params
    )

    invalidate_cache()
    return flag


def delete_flag(flag_key: str) -> bool:
    """Delete a feature flag."""
    result = execute_single(
        "DELETE FROM feature_flags WHERE key = :key RETURNING id",
        {"key": flag_key}
    )

    invalidate_cache()
    return result is not None


def enable_flag(flag_key: str) -> Dict[str, Any]:
    """Enable a feature flag."""
    return update_flag(flag_key, {"status": "enabled"})


def disable_flag(flag_key: str) -> Dict[str, Any]:
    """Disable a feature flag."""
    return update_flag(flag_key, {"status": "disabled"})


def set_percentage(flag_key: str, percentage: int) -> Dict[str, Any]:
    """Set a flag to percentage rollout."""
    if percentage < 0 or percentage > 100:
        raise ValueError("Percentage must be between 0 and 100")

    return update_flag(flag_key, {
        "status": "percentage",
        "rollout_percentage": percentage
    })


# ============================================================================
# TARGETING
# ============================================================================

def add_target(
    flag_key: str,
    target_type: str,
    target_value: str
) -> Dict[str, Any]:
    """Add a target to a feature flag."""
    flag = get_flag(flag_key)
    if not flag:
        raise ValueError(f"Flag not found: {flag_key}")

    target = execute_insert(
        """
        INSERT INTO feature_flag_targets (flag_id, target_type, target_value)
        VALUES (:flag_id, :target_type, :target_value)
        ON CONFLICT DO NOTHING
        RETURNING *
        """,
        {
            "flag_id": flag["id"],
            "target_type": target_type,
            "target_value": target_value
        }
    )

    # Set flag to targeted if not already
    if flag["status"] != "targeted":
        update_flag(flag_key, {"status": "targeted"})

    return target


def remove_target(
    flag_key: str,
    target_type: str,
    target_value: str
) -> bool:
    """Remove a target from a feature flag."""
    flag = get_flag(flag_key)
    if not flag:
        raise ValueError(f"Flag not found: {flag_key}")

    result = execute_single(
        """
        DELETE FROM feature_flag_targets
        WHERE flag_id = :flag_id AND target_type = :target_type AND target_value = :target_value
        RETURNING id
        """,
        {
            "flag_id": flag["id"],
            "target_type": target_type,
            "target_value": target_value
        }
    )

    return result is not None


def get_targets(flag_key: str) -> List[Dict[str, Any]]:
    """Get all targets for a feature flag."""
    flag = get_flag(flag_key)
    if not flag:
        return []

    return execute_query(
        """
        SELECT id, target_type, target_value, enabled, created_at
        FROM feature_flag_targets
        WHERE flag_id = :flag_id
        ORDER BY target_type, target_value
        """,
        {"flag_id": flag["id"]}
    )


def add_user_to_flag(flag_key: str, user_id: str) -> Dict[str, Any]:
    """Add a user to a flag's targets."""
    return add_target(flag_key, "user", user_id)


def add_role_to_flag(flag_key: str, role: str) -> Dict[str, Any]:
    """Add a role to a flag's targets."""
    return add_target(flag_key, "role", role)


def add_organization_to_flag(flag_key: str, org_id: str) -> Dict[str, Any]:
    """Add an organization to a flag's targets."""
    return add_target(flag_key, "organization", org_id)


# ============================================================================
# EVALUATION HISTORY & ANALYTICS
# ============================================================================

def get_evaluation_stats(
    flag_key: str,
    hours: int = 24
) -> Dict[str, Any]:
    """Get evaluation statistics for a flag."""
    stats = execute_single(
        """
        SELECT
            COUNT(*) as total_evaluations,
            COUNT(*) FILTER (WHERE result = true) as enabled_count,
            COUNT(*) FILTER (WHERE result = false) as disabled_count,
            COUNT(DISTINCT user_id) as unique_users,
            jsonb_object_agg(reason, count) as reasons
        FROM (
            SELECT
                result,
                user_id,
                reason,
                COUNT(*) as count
            FROM feature_flag_evaluations
            WHERE flag_key = :flag_key
                AND evaluated_at > NOW() - :hours * INTERVAL '1 hour'
            GROUP BY result, user_id, reason
        ) sub
        """,
        {"flag_key": flag_key, "hours": hours}
    )

    return stats or {
        "total_evaluations": 0,
        "enabled_count": 0,
        "disabled_count": 0,
        "unique_users": 0,
        "reasons": {}
    }


def cleanup_old_evaluations(days: int = 7) -> int:
    """Clean up old evaluation records."""
    result = execute_single(
        """
        WITH deleted AS (
            DELETE FROM feature_flag_evaluations
            WHERE evaluated_at < NOW() - :days * INTERVAL '1 day'
            RETURNING 1
        )
        SELECT COUNT(*) as deleted_count FROM deleted
        """,
        {"days": days}
    )

    return result.get("deleted_count", 0) if result else 0


# ============================================================================
# SYSTEM CONFIG
# ============================================================================

def get_config(key: str) -> Any:
    """Get a system configuration value."""
    result = execute_single(
        "SELECT value FROM system_config WHERE key = :key",
        {"key": key}
    )
    return result["value"] if result else None


def set_config(
    key: str,
    value: Any,
    description: Optional[str] = None,
    category: str = "general",
    updated_by: Optional[str] = None,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """Set a system configuration value."""
    # Get old value for history
    old = execute_single(
        "SELECT value FROM system_config WHERE key = :key",
        {"key": key}
    )

    # Upsert config
    config = execute_insert(
        """
        INSERT INTO system_config (key, value, description, category, updated_by)
        VALUES (:key, :value, :description, :category, :updated_by)
        ON CONFLICT (key) DO UPDATE SET
            value = :value,
            description = COALESCE(:description, system_config.description),
            category = COALESCE(:category, system_config.category),
            updated_by = :updated_by,
            updated_at = NOW()
        RETURNING *
        """,
        {
            "key": key,
            "value": value,
            "description": description,
            "category": category,
            "updated_by": updated_by
        }
    )

    # Record history
    execute_insert(
        """
        INSERT INTO system_config_history (config_key, old_value, new_value, changed_by, reason)
        VALUES (:key, :old_value, :new_value, :changed_by, :reason)
        """,
        {
            "key": key,
            "old_value": old["value"] if old else None,
            "new_value": value,
            "changed_by": updated_by,
            "reason": reason
        }
    )

    return config


def list_configs(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all system configurations."""
    params = {}
    where_clause = ""

    if category:
        where_clause = "WHERE category = :category"
        params["category"] = category

    return execute_query(
        f"""
        SELECT key, value, description, category, is_secret, updated_at
        FROM system_config
        {where_clause}
        ORDER BY category, key
        """,
        params
    )


def get_config_history(key: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get configuration change history."""
    return execute_query(
        """
        SELECT
            sch.old_value, sch.new_value, sch.reason, sch.changed_at,
            p.display_name as changed_by_name
        FROM system_config_history sch
        LEFT JOIN profiles p ON p.id = sch.changed_by
        WHERE sch.config_key = :key
        ORDER BY sch.changed_at DESC
        LIMIT :limit
        """,
        {"key": key, "limit": limit}
    )
