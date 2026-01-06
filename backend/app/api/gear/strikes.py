"""
Gear House Strikes API

Endpoints for managing user strikes and escalation.
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from app.core.auth import get_current_user_from_token
from app.api.users import get_profile_id_from_cognito_id
from app.services import gear_service

router = APIRouter(prefix="/strikes", tags=["Gear Strikes"])


# ============================================================================
# SCHEMAS
# ============================================================================

class StrikeCreate(BaseModel):
    user_id: str
    severity: str  # warning, minor, major, critical
    reason: str
    incident_id: Optional[str] = None
    repair_ticket_id: Optional[str] = None
    transaction_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    points: int = 1
    photos: List[str] = []


class StrikeVoid(BaseModel):
    reason: str


class EscalationReview(BaseModel):
    decision: str  # approved, probation, suspended
    notes: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_profile_id(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    user = await get_current_user_from_token(authorization)
    profile_id = get_profile_id_from_cognito_id(user["sub"])
    return profile_id or user["sub"]


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# STRIKE ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_strikes(
    org_id: str,
    user_id: Optional[str] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    authorization: str = Header(None)
):
    """List strikes for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query

    conditions = ["s.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if user_id:
        conditions.append("s.user_id = :user_id")
        params["user_id"] = user_id

    if active_only:
        conditions.append("s.is_active = TRUE")
        conditions.append("(s.expires_at IS NULL OR s.expires_at > NOW())")

    where_clause = " AND ".join(conditions)

    strikes = execute_query(
        f"""
        SELECT s.*, p.display_name as user_name, ip.display_name as issued_by_name,
               i.incident_type
        FROM gear_strikes s
        LEFT JOIN profiles p ON p.id = s.user_id
        LEFT JOIN profiles ip ON ip.id = s.issued_by_user_id
        LEFT JOIN gear_incidents i ON i.id = s.incident_id
        WHERE {where_clause}
        ORDER BY s.issued_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"strikes": strikes}


@router.post("/{org_id}")
async def create_strike(
    org_id: str,
    data: StrikeCreate,
    authorization: str = Header(None)
):
    """Issue a strike against a user."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Validate severity
    valid_severities = ["warning", "minor", "major", "critical"]
    if data.severity not in valid_severities:
        raise HTTPException(status_code=400, detail=f"Invalid severity. Must be one of: {valid_severities}")

    strike = gear_service.create_strike(
        org_id,
        data.user_id,
        profile_id,
        data.severity,
        data.reason,
        **data.dict(exclude={"user_id", "severity", "reason"})
    )

    if not strike:
        raise HTTPException(status_code=500, detail="Failed to create strike")

    return {"strike": strike}


@router.get("/user/{org_id}/{user_id}")
async def get_user_strikes(
    org_id: str,
    user_id: str,
    active_only: bool = Query(True),
    authorization: str = Header(None)
):
    """Get strikes for a specific user."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    # Users can view their own strikes, managers can view anyone's
    member = gear_service.get_organization_member(org_id, profile_id)
    if user_id != profile_id and member.get("role") not in ["owner", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Cannot view other users' strikes")

    strikes = gear_service.get_user_strikes(org_id, user_id, active_only)

    return {"strikes": strikes}


@router.post("/item/{strike_id}/void")
async def void_strike(
    strike_id: str,
    data: StrikeVoid,
    authorization: str = Header(None)
):
    """Void a strike."""
    profile_id = await get_current_profile_id(authorization)

    # Get strike to check org
    from app.core.database import execute_single
    strike = execute_single(
        "SELECT * FROM gear_strikes WHERE id = :id",
        {"id": strike_id}
    )

    if not strike:
        raise HTTPException(status_code=404, detail="Strike not found")

    require_org_access(strike["organization_id"], profile_id, ["owner", "admin"])

    voided = gear_service.void_strike(strike_id, profile_id, data.reason)

    return {"strike": voided}


# ============================================================================
# ESCALATION ENDPOINTS
# ============================================================================

@router.get("/escalation/{org_id}/{user_id}")
async def get_escalation_status(
    org_id: str,
    user_id: str,
    authorization: str = Header(None)
):
    """Get user's escalation status."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    # Users can view their own status, managers can view anyone's
    member = gear_service.get_organization_member(org_id, profile_id)
    if user_id != profile_id and member.get("role") not in ["owner", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Cannot view other users' escalation status")

    status = gear_service.get_user_escalation_status(org_id, user_id)

    return {"status": status}


@router.get("/escalation/{org_id}/pending-review")
async def list_pending_reviews(
    org_id: str,
    authorization: str = Header(None)
):
    """List users requiring manager review."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query
    pending = execute_query(
        """
        SELECT ues.*, p.display_name, p.avatar_url, p.email
        FROM gear_user_escalation_status ues
        JOIN profiles p ON p.id = ues.user_id
        WHERE ues.organization_id = :org_id
          AND ues.requires_manager_review = TRUE
        ORDER BY ues.escalated_at
        """,
        {"org_id": org_id}
    )

    return {"pending_reviews": pending}


@router.post("/escalation/{org_id}/{user_id}/review")
async def review_escalation(
    org_id: str,
    user_id: str,
    data: EscalationReview,
    authorization: str = Header(None)
):
    """Review a user's escalation status."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Validate decision
    valid_decisions = ["approved", "probation", "suspended"]
    if data.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of: {valid_decisions}")

    from app.core.database import execute_insert
    status = execute_insert(
        """
        UPDATE gear_user_escalation_status
        SET requires_manager_review = FALSE,
            reviewed_by_user_id = :reviewer,
            reviewed_at = NOW(),
            review_decision = :decision,
            updated_at = NOW()
        WHERE organization_id = :org_id AND user_id = :user_id
        RETURNING *
        """,
        {
            "org_id": org_id,
            "user_id": user_id,
            "reviewer": profile_id,
            "decision": data.decision
        }
    )

    return {"status": status}


# ============================================================================
# RULES ENDPOINTS
# ============================================================================

@router.get("/rules/{org_id}")
async def list_strike_rules(
    org_id: str,
    authorization: str = Header(None)
):
    """List strike rules for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query
    rules = execute_query(
        """
        SELECT * FROM gear_strike_rules
        WHERE organization_id = :org_id AND is_active = TRUE
        ORDER BY trigger_type, trigger_damage_tier
        """,
        {"org_id": org_id}
    )

    return {"rules": rules}


@router.put("/rules/{rule_id}")
async def update_strike_rule(
    rule_id: str,
    strike_severity: Optional[str] = None,
    strike_points: Optional[int] = None,
    is_auto_applied: Optional[bool] = None,
    requires_review: Optional[bool] = None,
    is_active: Optional[bool] = None,
    authorization: str = Header(None)
):
    """Update a strike rule."""
    profile_id = await get_current_profile_id(authorization)

    from app.core.database import execute_single, execute_insert

    rule = execute_single("SELECT * FROM gear_strike_rules WHERE id = :id", {"id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    require_org_access(rule["organization_id"], profile_id, ["owner", "admin"])

    updates = []
    params = {"rule_id": rule_id}

    if strike_severity:
        updates.append("strike_severity = :severity")
        params["severity"] = strike_severity

    if strike_points is not None:
        updates.append("strike_points = :points")
        params["points"] = strike_points

    if is_auto_applied is not None:
        updates.append("is_auto_applied = :auto")
        params["auto"] = is_auto_applied

    if requires_review is not None:
        updates.append("requires_review = :review")
        params["review"] = requires_review

    if is_active is not None:
        updates.append("is_active = :active")
        params["active"] = is_active

    if updates:
        rule = execute_insert(
            f"""
            UPDATE gear_strike_rules
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = :rule_id
            RETURNING *
            """,
            params
        )

    return {"rule": rule}
