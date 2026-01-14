"""
Gear House Reputation API

Tracks and manages renter/lister reputation for marketplace trust.

Reputation is built through:
- Successful rentals (on-time returns, no damage)
- Late returns (negative impact)
- Damage incidents (negative impact)
- Total rental value (trust indicator)

Verification badge awarded after threshold successful rentals.
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/reputation", tags=["Gear Reputation"])


# ============================================================================
# SCHEMAS
# ============================================================================

class ReputationStats(BaseModel):
    """Reputation statistics for an organization."""
    organization_id: str
    organization_name: Optional[str] = None
    total_rentals: int = 0
    successful_rentals: int = 0
    late_returns: int = 0
    damage_incidents: int = 0
    total_rental_value: float = 0
    is_verified: bool = False
    verified_at: Optional[str] = None
    verification_threshold: int = 5
    average_rating: Optional[float] = None
    rating_count: int = 0
    # Computed fields
    success_rate: float = 0
    rentals_until_verified: int = 0


class ReputationUpdateInput(BaseModel):
    """Manual reputation adjustment (admin only)."""
    total_rentals: Optional[int] = None
    successful_rentals: Optional[int] = None
    late_returns: Optional[int] = None
    damage_incidents: Optional[int] = None
    is_verified: Optional[bool] = None
    verification_threshold: Optional[int] = None


# ============================================================================
# HELPERS
# ============================================================================

def get_profile_id(user) -> str:
    """Get profile ID from user dict."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :sub",
        {"sub": user.get("sub")}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return str(profile["id"])


def get_or_create_reputation(org_id: str) -> dict:
    """Get or create reputation record for an organization."""
    reputation = execute_single(
        "SELECT * FROM gear_renter_reputation WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    if not reputation:
        reputation = execute_insert(
            """
            INSERT INTO gear_renter_reputation (organization_id)
            VALUES (:org_id)
            RETURNING *
            """,
            {"org_id": org_id}
        )

    return reputation


def compute_reputation_stats(reputation: dict, org_name: Optional[str] = None) -> ReputationStats:
    """Compute derived reputation statistics."""
    total = reputation.get("total_rentals") or 0
    successful = reputation.get("successful_rentals") or 0
    threshold = reputation.get("verification_threshold") or 5

    success_rate = (successful / total * 100) if total > 0 else 0
    rentals_until_verified = max(0, threshold - successful) if not reputation.get("is_verified") else 0

    return ReputationStats(
        organization_id=str(reputation["organization_id"]),
        organization_name=org_name,
        total_rentals=total,
        successful_rentals=successful,
        late_returns=reputation.get("late_returns") or 0,
        damage_incidents=reputation.get("damage_incidents") or 0,
        total_rental_value=float(reputation.get("total_rental_value") or 0),
        is_verified=reputation.get("is_verified") or False,
        verified_at=str(reputation["verified_at"]) if reputation.get("verified_at") else None,
        verification_threshold=threshold,
        average_rating=float(reputation["average_rating"]) if reputation.get("average_rating") else None,
        rating_count=reputation.get("rating_count") or 0,
        success_rate=round(success_rate, 1),
        rentals_until_verified=rentals_until_verified,
    )


def check_and_update_verification(org_id: str) -> bool:
    """Check if org qualifies for verification and update if so."""
    reputation = execute_single(
        """
        SELECT successful_rentals, verification_threshold, is_verified
        FROM gear_renter_reputation
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )

    if not reputation:
        return False

    if reputation.get("is_verified"):
        return True

    threshold = reputation.get("verification_threshold") or 5
    successful = reputation.get("successful_rentals") or 0

    if successful >= threshold:
        execute_update(
            """
            UPDATE gear_renter_reputation
            SET is_verified = TRUE, verified_at = NOW(), updated_at = NOW()
            WHERE organization_id = :org_id
            """,
            {"org_id": org_id}
        )
        return True

    return False


# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

@router.get("/org/{org_id}")
async def get_organization_reputation(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get reputation for a specific organization."""
    # Get organization name
    org = execute_single(
        "SELECT name FROM organizations WHERE id = :org_id",
        {"org_id": org_id}
    )

    reputation = get_or_create_reputation(org_id)
    stats = compute_reputation_stats(reputation, org.get("name") if org else None)

    return {"reputation": stats.model_dump()}


@router.get("/my")
async def get_my_reputation(
    org_id: str = Query(..., description="Organization ID"),
    user=Depends(get_current_user)
):
    """Get reputation for caller's organization."""
    profile_id = get_profile_id(user)

    # Verify membership
    membership = execute_single(
        """
        SELECT o.name
        FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE om.organization_id = :org_id AND om.user_id = :user_id AND om.status = 'active'
        """,
        {"org_id": org_id, "user_id": profile_id}
    )

    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    reputation = get_or_create_reputation(org_id)
    stats = compute_reputation_stats(reputation, membership.get("name"))

    return {"reputation": stats.model_dump()}


@router.get("/leaderboard")
async def get_reputation_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    verified_only: bool = Query(False),
    user=Depends(get_current_user)
):
    """Get top-rated organizations by successful rentals."""
    query = """
        SELECT r.*, o.name as organization_name
        FROM gear_renter_reputation r
        JOIN organizations o ON o.id = r.organization_id
        WHERE r.successful_rentals > 0
    """

    if verified_only:
        query += " AND r.is_verified = TRUE"

    query += """
        ORDER BY r.successful_rentals DESC, r.total_rental_value DESC
        LIMIT :limit OFFSET :offset
    """

    rows = execute_query(query, {"limit": limit, "offset": offset})

    leaderboard = [
        compute_reputation_stats(row, row.get("organization_name")).model_dump()
        for row in rows
    ]

    # Get total count
    count_query = """
        SELECT COUNT(*) as total
        FROM gear_renter_reputation r
        WHERE r.successful_rentals > 0
    """
    if verified_only:
        count_query += " AND r.is_verified = TRUE"

    total = execute_single(count_query, {})

    return {
        "leaderboard": leaderboard,
        "total": total.get("total") or 0,
        "limit": limit,
        "offset": offset
    }


# ============================================================================
# INTERNAL TRACKING ENDPOINTS
# Called by other services when rentals complete
# ============================================================================

@router.post("/record-rental")
async def record_rental_completion(
    org_id: str,
    rental_value: float,
    was_late: bool = False,
    had_damage: bool = False,
    user=Depends(get_current_user)
):
    """
    Record a completed rental for reputation tracking.
    Called internally when a rental transaction is completed.
    """
    # Get or create reputation record
    reputation = get_or_create_reputation(org_id)

    # Update stats
    update_fields = []
    params = {"org_id": org_id}

    update_fields.append("total_rentals = total_rentals + 1")
    update_fields.append("total_rental_value = total_rental_value + :rental_value")
    params["rental_value"] = rental_value

    if was_late:
        update_fields.append("late_returns = late_returns + 1")
    else:
        update_fields.append("successful_rentals = successful_rentals + 1")

    if had_damage:
        update_fields.append("damage_incidents = damage_incidents + 1")

    update_fields.append("updated_at = NOW()")

    execute_update(
        f"""
        UPDATE gear_renter_reputation
        SET {', '.join(update_fields)}
        WHERE organization_id = :org_id
        """,
        params
    )

    # Check for verification
    newly_verified = check_and_update_verification(org_id)

    # Get updated stats
    updated_reputation = execute_single(
        "SELECT * FROM gear_renter_reputation WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    return {
        "success": True,
        "newly_verified": newly_verified and not reputation.get("is_verified"),
        "reputation": compute_reputation_stats(updated_reputation).model_dump()
    }


@router.post("/record-incident")
async def record_damage_incident(
    org_id: str,
    incident_type: str = "damage",  # damage, loss, late
    user=Depends(get_current_user)
):
    """Record a negative incident against an organization's reputation."""
    get_or_create_reputation(org_id)

    if incident_type == "damage" or incident_type == "loss":
        execute_update(
            """
            UPDATE gear_renter_reputation
            SET damage_incidents = damage_incidents + 1, updated_at = NOW()
            WHERE organization_id = :org_id
            """,
            {"org_id": org_id}
        )
    elif incident_type == "late":
        execute_update(
            """
            UPDATE gear_renter_reputation
            SET late_returns = late_returns + 1, updated_at = NOW()
            WHERE organization_id = :org_id
            """,
            {"org_id": org_id}
        )

    return {"success": True, "incident_type": incident_type}


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@router.put("/admin/{org_id}")
async def admin_update_reputation(
    org_id: str,
    data: ReputationUpdateInput,
    user=Depends(get_current_user)
):
    """Admin endpoint to manually adjust reputation. Requires admin role."""
    profile_id = get_profile_id(user)

    # Check admin status
    profile = execute_single(
        "SELECT role FROM profiles WHERE id = :id",
        {"id": profile_id}
    )

    if not profile or profile.get("role") not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    get_or_create_reputation(org_id)

    update_fields = []
    params = {"org_id": org_id}

    if data.total_rentals is not None:
        update_fields.append("total_rentals = :total_rentals")
        params["total_rentals"] = data.total_rentals

    if data.successful_rentals is not None:
        update_fields.append("successful_rentals = :successful_rentals")
        params["successful_rentals"] = data.successful_rentals

    if data.late_returns is not None:
        update_fields.append("late_returns = :late_returns")
        params["late_returns"] = data.late_returns

    if data.damage_incidents is not None:
        update_fields.append("damage_incidents = :damage_incidents")
        params["damage_incidents"] = data.damage_incidents

    if data.is_verified is not None:
        update_fields.append("is_verified = :is_verified")
        params["is_verified"] = data.is_verified
        if data.is_verified:
            update_fields.append("verified_at = NOW()")

    if data.verification_threshold is not None:
        update_fields.append("verification_threshold = :verification_threshold")
        params["verification_threshold"] = data.verification_threshold

    if update_fields:
        update_fields.append("updated_at = NOW()")
        execute_update(
            f"""
            UPDATE gear_renter_reputation
            SET {', '.join(update_fields)}
            WHERE organization_id = :org_id
            """,
            params
        )

    # Check verification status
    check_and_update_verification(org_id)

    updated = execute_single(
        "SELECT * FROM gear_renter_reputation WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    return {"reputation": compute_reputation_stats(updated).model_dump()}
