"""
Set House Incidents API

Endpoints for managing incidents (damage, policy violations, etc).
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/incidents", tags=["Set House Incidents"])


# ============================================================================
# SCHEMAS
# ============================================================================

class IncidentCreate(BaseModel):
    incident_type: str
    space_id: Optional[str] = None
    package_instance_id: Optional[str] = None
    transaction_id: Optional[str] = None
    damage_tier: Optional[str] = None
    damage_description: Optional[str] = None
    damage_location: Optional[str] = None
    photos: Optional[List[str]] = None
    notes: Optional[str] = None
    responsible_user_id: Optional[str] = None
    responsible_org_id: Optional[str] = None


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    damage_tier: Optional[str] = None
    damage_description: Optional[str] = None
    resolution_notes: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    assigned_to_user_id: Optional[str] = None
    responsible_user_id: Optional[str] = None
    responsible_org_id: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# INCIDENT ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_incidents(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    incident_type: Optional[str] = Query(None, description="Filter by incident type"),
    space_id: Optional[str] = Query(None, description="Filter by space"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List incidents for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_incidents(
        org_id,
        status=status,
        incident_type=incident_type,
        space_id=space_id,
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
    """Create a new incident."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    incident = set_house_service.create_incident(
        org_id,
        data.incident_type,
        profile_id,
        **data.model_dump(exclude={"incident_type"})
    )

    if not incident:
        raise HTTPException(status_code=500, detail="Failed to create incident")

    return {"incident": incident}


@router.get("/{org_id}/{incident_id}")
async def get_incident(
    org_id: str,
    incident_id: str,
    user=Depends(get_current_user)
):
    """Get a single incident."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single

    incident = execute_single(
        """
        SELECT i.*, s.name as space_name, s.internal_id as space_internal_id,
               p.display_name as reported_by_name, ap.display_name as assigned_to_name,
               rp.display_name as responsible_user_name, ro.name as responsible_org_name
        FROM set_house_incidents i
        LEFT JOIN set_house_spaces s ON s.id = i.space_id
        LEFT JOIN profiles p ON p.id = i.reported_by_user_id
        LEFT JOIN profiles ap ON ap.id = i.assigned_to_user_id
        LEFT JOIN profiles rp ON rp.id = i.responsible_user_id
        LEFT JOIN organizations ro ON ro.id = i.responsible_org_id
        WHERE i.id = :incident_id AND i.organization_id = :org_id
        """,
        {"incident_id": incident_id, "org_id": org_id}
    )

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    return {"incident": incident}


@router.put("/{org_id}/{incident_id}")
async def update_incident(
    org_id: str,
    incident_id: str,
    data: IncidentUpdate,
    user=Depends(get_current_user)
):
    """Update an incident."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Handle resolution
    if updates.get("status") == "resolved" or updates.get("status") == "closed":
        updates["resolved_at"] = datetime.now(timezone.utc)
        updates["resolved_by_user_id"] = profile_id

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "incident_id": incident_id, "org_id": org_id}

    incident = execute_insert(
        f"""
        UPDATE set_house_incidents
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :incident_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    return {"incident": incident}


@router.post("/{org_id}/{incident_id}/photos")
async def add_incident_photo(
    org_id: str,
    incident_id: str,
    photo_url: str,
    caption: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Add a photo to an incident."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_insert
    import json

    incident = execute_single(
        "SELECT photos FROM set_house_incidents WHERE id = :incident_id AND organization_id = :org_id",
        {"incident_id": incident_id, "org_id": org_id}
    )

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    photos = json.loads(incident["photos"]) if incident["photos"] else []
    photos.append({"url": photo_url, "caption": caption})

    execute_insert(
        "UPDATE set_house_incidents SET photos = :photos, updated_at = NOW() WHERE id = :incident_id",
        {"incident_id": incident_id, "photos": json.dumps(photos)}
    )

    return {"success": True, "photos": photos}


@router.post("/{org_id}/{incident_id}/create-repair")
async def create_repair_from_incident(
    org_id: str,
    incident_id: str,
    title: str,
    description: Optional[str] = None,
    priority: str = "normal",
    user=Depends(get_current_user)
):
    """Create a repair ticket from an incident."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_single

    incident = execute_single(
        "SELECT space_id FROM set_house_incidents WHERE id = :incident_id AND organization_id = :org_id",
        {"incident_id": incident_id, "org_id": org_id}
    )

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if not incident["space_id"]:
        raise HTTPException(status_code=400, detail="Incident has no associated space")

    repair = set_house_service.create_repair(
        org_id,
        incident["space_id"],
        title,
        profile_id,
        incident_id=incident_id,
        description=description,
        priority=priority
    )

    if not repair:
        raise HTTPException(status_code=500, detail="Failed to create repair ticket")

    return {"repair": repair}
