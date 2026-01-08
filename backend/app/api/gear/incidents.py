"""
Gear House Incidents API

Endpoints for managing damage reports and missing item incidents.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user

from app.services import gear_service

router = APIRouter(prefix="/incidents", tags=["Gear Incidents"])


# ============================================================================
# SCHEMAS
# ============================================================================

class IncidentCreate(BaseModel):
    incident_type: str  # damage, missing_item, late_return, policy_violation, unsafe_behavior
    asset_id: Optional[str] = None
    kit_instance_id: Optional[str] = None
    transaction_id: Optional[str] = None
    damage_tier: Optional[str] = None  # cosmetic, functional, unsafe, out_of_service
    damage_description: Optional[str] = None
    photos: List[str] = []
    notes: Optional[str] = None


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    notes: Optional[str] = None


class IncidentResolve(BaseModel):
    resolution_notes: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# INCIDENT ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_incidents(
    org_id: str,
    incident_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    asset_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List incidents for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = gear_service.list_incidents(
        org_id,
        incident_type=incident_type,
        status=status,
        asset_id=asset_id,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_incident(
    org_id: str,
    data: IncidentCreate,
    user=Depends(get_current_user)
):
    """Report a new incident."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Validate incident type
    valid_types = ["damage", "missing_item", "late_return", "policy_violation", "unsafe_behavior"]
    if data.incident_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid incident type. Must be one of: {valid_types}")

    # Validate damage tier if damage incident
    if data.incident_type == "damage":
        valid_tiers = ["cosmetic", "functional", "unsafe", "out_of_service"]
        if data.damage_tier and data.damage_tier not in valid_tiers:
            raise HTTPException(status_code=400, detail=f"Invalid damage tier. Must be one of: {valid_tiers}")

    incident = gear_service.create_incident(
        org_id,
        data.incident_type,
        profile_id,
        **data.model_dump(exclude={"incident_type"})
    )

    if not incident:
        raise HTTPException(status_code=500, detail="Failed to create incident")

    return {"incident": incident}


@router.get("/item/{incident_id}")
async def get_incident(
    incident_id: str,
    user=Depends(get_current_user)
):
    """Get incident details."""
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    require_org_access(incident["organization_id"], profile_id)

    return {"incident": incident}


@router.put("/item/{incident_id}")
async def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    user=Depends(get_current_user)
):
    """Update an incident."""
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    require_org_access(incident["organization_id"], profile_id, ["owner", "admin", "manager"])

    # Build update
    updates = []
    params = {"incident_id": incident_id}

    if data.status:
        updates.append("status = :status")
        params["status"] = data.status

    if data.assigned_to_user_id:
        updates.append("assigned_to_user_id = :assigned_to")
        params["assigned_to"] = data.assigned_to_user_id

    if data.resolution_notes:
        updates.append("resolution_notes = :resolution")
        params["resolution"] = data.resolution_notes

    if data.estimated_cost is not None:
        updates.append("estimated_cost = :estimated")
        params["estimated"] = data.estimated_cost

    if data.actual_cost is not None:
        updates.append("actual_cost = :actual")
        params["actual"] = data.actual_cost

    if data.notes:
        updates.append("notes = :notes")
        params["notes"] = data.notes

    if updates:
        from app.core.database import execute_insert
        incident = execute_insert(
            f"""
            UPDATE gear_incidents
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = :incident_id
            RETURNING *
            """,
            params
        )

    return {"incident": incident}


@router.post("/item/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    data: IncidentResolve,
    user=Depends(get_current_user)
):
    """Resolve an incident."""
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    require_org_access(incident["organization_id"], profile_id, ["owner", "admin", "manager"])

    resolved = gear_service.resolve_incident(incident_id, profile_id, data.resolution_notes)

    return {"incident": resolved}


@router.get("/{org_id}/stats")
async def get_incident_stats(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get incident statistics."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query, execute_single

    # By type
    by_type = execute_query(
        """
        SELECT incident_type, COUNT(*) as count
        FROM gear_incidents
        WHERE organization_id = :org_id
        GROUP BY incident_type
        """,
        {"org_id": org_id}
    )

    # By status
    by_status = execute_query(
        """
        SELECT status, COUNT(*) as count
        FROM gear_incidents
        WHERE organization_id = :org_id
        GROUP BY status
        """,
        {"org_id": org_id}
    )

    # Recent (last 30 days)
    recent_stats = execute_single(
        """
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'open') as open_count,
            COALESCE(SUM(actual_cost), 0) as total_cost
        FROM gear_incidents
        WHERE organization_id = :org_id
          AND reported_at > NOW() - INTERVAL '30 days'
        """,
        {"org_id": org_id}
    )

    return {
        "by_type": {i["incident_type"]: i["count"] for i in by_type},
        "by_status": {i["status"]: i["count"] for i in by_status},
        "last_30_days": recent_stats
    }
