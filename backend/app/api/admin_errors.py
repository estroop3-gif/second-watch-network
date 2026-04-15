"""
Admin Client Error Logs API
View and manage client-side error reports. Requires admin role.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.core.database import execute_query, execute_single
from app.core.deps import require_admin
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("")
async def list_client_errors(
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    counts: Optional[bool] = Query(False),
    admin_profile=Depends(require_admin),
):
    """List client error logs with filters. Returns paginated results."""

    if counts:
        stats = execute_single(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE resolved = FALSE) AS unresolved,
                COUNT(*) FILTER (WHERE severity = 'fatal') AS fatal,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h
            FROM client_error_logs
            """,
            {}
        )
        return stats or {"total": 0, "unresolved": 0, "fatal": 0, "last_24h": 0}

    # Build dynamic WHERE clauses
    conditions = []
    params = {"limit": limit, "offset": offset}

    if severity:
        conditions.append("cel.severity = :severity")
        params["severity"] = severity

    if resolved is not None:
        conditions.append("cel.resolved = :resolved")
        params["resolved"] = resolved

    if from_date:
        conditions.append("cel.created_at >= :from_date::timestamptz")
        params["from_date"] = from_date

    if to_date:
        conditions.append("cel.created_at <= :to_date::timestamptz")
        params["to_date"] = to_date

    if search:
        conditions.append("(cel.error_message ILIKE :search OR cel.pathname ILIKE :search OR cel.error_name ILIKE :search)")
        params["search"] = f"%{search}%"

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = execute_query(
        f"""
        SELECT
            cel.id,
            cel.error_name,
            cel.error_message,
            cel.error_stack,
            cel.component_stack,
            cel.pathname,
            cel.url,
            cel.user_agent,
            cel.severity,
            cel.context,
            cel.resolved,
            cel.resolved_at,
            cel.session_id,
            cel.created_at,
            p.email AS user_email,
            p.full_name AS user_name,
            rp.email AS resolved_by_email
        FROM client_error_logs cel
        LEFT JOIN profiles p ON cel.user_id = p.id
        LEFT JOIN profiles rp ON cel.resolved_by = rp.id
        {where_clause}
        ORDER BY cel.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    # Get total count
    count_row = execute_single(
        f"""
        SELECT COUNT(*) AS total
        FROM client_error_logs cel
        {where_clause}
        """,
        {k: v for k, v in params.items() if k not in ("limit", "offset")}
    )

    return {
        "errors": rows or [],
        "total": count_row["total"] if count_row else 0,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/{error_id}/resolve")
async def resolve_client_error(
    error_id: str,
    admin_profile=Depends(require_admin),
):
    """Mark a client error as resolved."""
    now = datetime.now(timezone.utc).isoformat()
    result = execute_single(
        """
        UPDATE client_error_logs
        SET resolved = TRUE, resolved_at = :resolved_at, resolved_by = :resolved_by
        WHERE id = :id
        RETURNING id, resolved, resolved_at
        """,
        {
            "id": error_id,
            "resolved_at": now,
            "resolved_by": admin_profile["id"],
        }
    )
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Error log not found")
    return result
