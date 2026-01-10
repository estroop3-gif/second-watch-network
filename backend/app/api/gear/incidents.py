"""
Gear House Incidents API

Endpoints for managing damage reports and missing item incidents.
"""
import os
import uuid
from io import BytesIO
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.storage import storage_client

from app.services import gear_service

# Constants for photo uploads
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}

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


class IncidentStatusUpdate(BaseModel):
    status: str  # open, investigating, repair, replacement, resolved
    resolution_type: Optional[str] = None  # Required when status='resolved': repaired, replaced, written_off, no_action_needed


class WriteOffRequest(BaseModel):
    write_off_value: float
    write_off_reason: str
    create_purchase_request: bool = False
    purchase_request_title: Optional[str] = None
    purchase_request_description: Optional[str] = None
    estimated_replacement_cost: Optional[float] = None


class StrikeAssignment(BaseModel):
    user_id: str
    severity: str  # warning, minor, major, critical
    reason: str
    notes: Optional[str] = None


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


# ============================================================================
# PHOTO UPLOAD ENDPOINT
# ============================================================================

@router.post("/{org_id}/upload-photo")
async def upload_incident_photo(
    org_id: str,
    file: UploadFile = File(...),
    asset_id: str = Form(...),
    user=Depends(get_current_user)
):
    """
    Upload a photo for an incident report.
    Returns the S3 key to include in the incident creation.
    Photos are stored at: gear/{org_id}/incidents/{asset_id}/{uuid}.{ext}
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # Check content type
        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_PHOTO_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{content_type}' not allowed. Must be JPEG, PNG, WebP, or HEIC"
            )

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Check file size
        if file_size > MAX_PHOTO_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_PHOTO_SIZE // (1024*1024)} MB"
            )

        # Generate unique filename
        ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
        unique_id = str(uuid.uuid4())
        s3_key = f"gear/{org_id}/incidents/{asset_id}/{unique_id}{ext}"

        # Upload to S3
        bucket = storage_client.from_("backlot-files")
        file_obj = BytesIO(content)

        bucket.upload(
            s3_key,
            file_obj,
            {"content_type": content_type}
        )

        # Generate signed URL for preview (1 hour expiry)
        signed_url_result = bucket.create_signed_url(s3_key, expires_in=3600)
        url = signed_url_result.get("signedUrl", "")

        return {
            "s3_key": s3_key,
            "url": url,
            "filename": f"{unique_id}{ext}",
            "size": file_size,
            "content_type": content_type
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ============================================================================
# ENHANCED INCIDENT DETAIL ENDPOINTS
# ============================================================================

@router.get("/item/{incident_id}/detail")
async def get_incident_detail(
    incident_id: str,
    user=Depends(get_current_user)
):
    """
    Get comprehensive incident details including:
    - Incident record with asset info
    - Transaction history (last 30 days for this asset)
    - Linked repair tickets
    - Strikes issued from this incident
    - Purchase requests linked to this incident
    - Recommended custodian (last checkout before incident)
    """
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    org_id = incident["organization_id"]
    require_org_access(org_id, profile_id)

    # Get full detail from service
    detail = gear_service.get_incident_detail(incident_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Incident not found")

    return detail


@router.get("/item/{incident_id}/custodians")
async def get_incident_custodians(
    incident_id: str,
    days: int = Query(30, le=365),
    user=Depends(get_current_user)
):
    """Get list of users who had custody of the asset in the last N days."""
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    require_org_access(incident["organization_id"], profile_id)

    if not incident.get("asset_id"):
        return {"custodians": [], "recommended": None}

    custodians = gear_service.get_asset_custodians(
        incident["asset_id"],
        days=days,
        before_date=incident.get("reported_at")
    )

    # The first custodian is the recommended one (most recent before incident)
    recommended = custodians[0] if custodians else None

    return {
        "custodians": custodians,
        "recommended": recommended
    }


@router.patch("/item/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    data: IncidentStatusUpdate,
    user=Depends(get_current_user)
):
    """Update incident status with validation."""
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    org_id = incident["organization_id"]

    # Check incident management permission
    if not gear_service.check_incident_management_permission(org_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage incidents")

    # Validate status
    valid_statuses = ["open", "investigating", "repair", "replacement", "resolved"]
    if data.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    # If resolving, resolution_type is required
    if data.status == "resolved":
        valid_resolution_types = ["repaired", "replaced", "written_off", "no_action_needed"]
        if not data.resolution_type or data.resolution_type not in valid_resolution_types:
            raise HTTPException(
                status_code=400,
                detail=f"resolution_type is required when resolving. Must be one of: {valid_resolution_types}"
            )

    # Update the incident
    updated = gear_service.update_incident_status(
        incident_id,
        data.status,
        resolution_type=data.resolution_type,
        updated_by=profile_id
    )

    return {"incident": updated}


@router.post("/item/{incident_id}/write-off")
async def write_off_incident_asset(
    incident_id: str,
    data: WriteOffRequest,
    user=Depends(get_current_user)
):
    """
    Write off an asset and optionally create a purchase request for replacement.
    Updates the incident with write-off details and can create a linked purchase request.
    """
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    org_id = incident["organization_id"]

    # Check incident management permission
    if not gear_service.check_incident_management_permission(org_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage incidents")

    if not incident.get("asset_id"):
        raise HTTPException(status_code=400, detail="Incident has no associated asset to write off")

    # Perform write-off
    result = gear_service.write_off_incident_asset(
        incident_id=incident_id,
        write_off_by=profile_id,
        write_off_value=data.write_off_value,
        write_off_reason=data.write_off_reason,
        create_purchase_request=data.create_purchase_request,
        purchase_request_title=data.purchase_request_title,
        purchase_request_description=data.purchase_request_description,
        estimated_replacement_cost=data.estimated_replacement_cost
    )

    return result


@router.post("/item/{incident_id}/strike")
async def assign_incident_strike(
    incident_id: str,
    data: StrikeAssignment,
    user=Depends(get_current_user)
):
    """
    Assign a strike to a user for this incident.
    Creates a strike record and links it to the incident.
    """
    profile_id = get_profile_id(user)

    incident = gear_service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    org_id = incident["organization_id"]

    # Check incident management permission
    if not gear_service.check_incident_management_permission(org_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to assign strikes")

    # Validate severity
    valid_severities = ["warning", "minor", "major", "critical"]
    if data.severity not in valid_severities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Must be one of: {valid_severities}"
        )

    # Create the strike
    result = gear_service.assign_incident_strike(
        incident_id=incident_id,
        user_id=data.user_id,
        issued_by=profile_id,
        severity=data.severity,
        reason=data.reason,
        notes=data.notes
    )

    return result
