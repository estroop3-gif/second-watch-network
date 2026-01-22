"""
Set House Strikes API

Endpoints for managing user strikes.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/strikes", tags=["Set House Strikes"])


# ============================================================================
# SCHEMAS
# ============================================================================

class StrikeCreate(BaseModel):
    user_id: str
    severity: str
    reason: str
    points: int = 1
    incident_id: Optional[str] = None
    repair_id: Optional[str] = None
    transaction_id: Optional[str] = None
    photos: Optional[List[str]] = None


class StrikeReview(BaseModel):
    review_notes: Optional[str] = None
    void: bool = False
    void_reason: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# STRIKE ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_strikes(
    org_id: str,
    user_id: Optional[str] = Query(None, description="Filter by user"),
    is_active: bool = Query(True, description="Filter by active status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List strikes for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_strikes(
        org_id,
        user_id=user_id,
        is_active=is_active,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_strike(
    org_id: str,
    data: StrikeCreate,
    user=Depends(get_current_user)
):
    """Create a new strike."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    strike = set_house_service.create_strike(
        org_id,
        data.user_id,
        data.severity,
        data.reason,
        profile_id,
        **data.model_dump(exclude={"user_id", "severity", "reason"})
    )

    if not strike:
        raise HTTPException(status_code=500, detail="Failed to create strike")

    return {"strike": strike}


@router.get("/{org_id}/{strike_id}")
async def get_strike(
    org_id: str,
    strike_id: str,
    user=Depends(get_current_user)
):
    """Get a single strike."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single

    strike = execute_single(
        """
        SELECT s.*, p.display_name as user_name, p.avatar_url as user_avatar, p.email as user_email,
               ip.display_name as issued_by_name, rp.display_name as reviewed_by_name,
               vp.display_name as voided_by_name
        FROM set_house_strikes s
        LEFT JOIN profiles p ON p.id = s.user_id
        LEFT JOIN profiles ip ON ip.id = s.issued_by_user_id
        LEFT JOIN profiles rp ON rp.id = s.reviewed_by_user_id
        LEFT JOIN profiles vp ON vp.id = s.voided_by_user_id
        WHERE s.id = :strike_id AND s.organization_id = :org_id
        """,
        {"strike_id": strike_id, "org_id": org_id}
    )

    if not strike:
        raise HTTPException(status_code=404, detail="Strike not found")

    return {"strike": strike}


@router.post("/{org_id}/{strike_id}/review")
async def review_strike(
    org_id: str,
    strike_id: str,
    data: StrikeReview,
    user=Depends(get_current_user)
):
    """Review a strike (approve or void)."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    if data.void:
        strike = execute_insert(
            """
            UPDATE set_house_strikes
            SET is_active = FALSE, voided_at = :now, voided_by_user_id = :user_id,
                void_reason = :void_reason, is_reviewed = TRUE,
                reviewed_at = :now, reviewed_by_user_id = :user_id,
                review_notes = :review_notes, updated_at = NOW()
            WHERE id = :strike_id AND organization_id = :org_id
            RETURNING *
            """,
            {
                "strike_id": strike_id,
                "org_id": org_id,
                "now": datetime.now(timezone.utc),
                "user_id": profile_id,
                "void_reason": data.void_reason,
                "review_notes": data.review_notes
            }
        )
    else:
        strike = execute_insert(
            """
            UPDATE set_house_strikes
            SET is_reviewed = TRUE, reviewed_at = :now, reviewed_by_user_id = :user_id,
                review_notes = :review_notes, updated_at = NOW()
            WHERE id = :strike_id AND organization_id = :org_id
            RETURNING *
            """,
            {
                "strike_id": strike_id,
                "org_id": org_id,
                "now": datetime.now(timezone.utc),
                "user_id": profile_id,
                "review_notes": data.review_notes
            }
        )

    if not strike:
        raise HTTPException(status_code=404, detail="Strike not found")

    return {"strike": strike}


@router.get("/{org_id}/user/{target_user_id}")
async def get_user_strikes(
    org_id: str,
    target_user_id: str,
    user=Depends(get_current_user)
):
    """Get all strikes for a specific user."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query, execute_single

    strikes = execute_query(
        """
        SELECT s.*, ip.display_name as issued_by_name
        FROM set_house_strikes s
        LEFT JOIN profiles ip ON ip.id = s.issued_by_user_id
        WHERE s.organization_id = :org_id AND s.user_id = :target_user_id
        ORDER BY s.created_at DESC
        """,
        {"org_id": org_id, "target_user_id": target_user_id}
    )

    # Get summary
    summary = execute_single(
        """
        SELECT
            COUNT(*) as total_strikes,
            COUNT(*) FILTER (WHERE is_active = TRUE) as active_strikes,
            COALESCE(SUM(points) FILTER (WHERE is_active = TRUE), 0) as total_points
        FROM set_house_strikes
        WHERE organization_id = :org_id AND user_id = :target_user_id
        """,
        {"org_id": org_id, "target_user_id": target_user_id}
    )

    # Get user info
    user_info = execute_single(
        "SELECT display_name, avatar_url, email FROM profiles WHERE id = :user_id",
        {"user_id": target_user_id}
    )

    return {
        "user": user_info,
        "strikes": strikes,
        "summary": summary
    }
