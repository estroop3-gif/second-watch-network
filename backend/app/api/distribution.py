"""
Distribution API
Phase 5A: Third-party distribution and export endpoints.

Provides:
- Distribution policy management
- Export job creation and tracking
- Platform template browsing
- Export history and artifacts
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.services.distribution_service import DistributionService, DistributionPolicy, ExportStatus

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class DistributionPolicyRequest(BaseModel):
    """Request to set distribution policy."""
    distribution_policy: str = Field(
        ...,
        description="Policy level: internal_only, internal_plus_third_party, open_export"
    )
    allowed_platforms: Optional[List[str]] = Field(
        None,
        description="List of allowed platform keys"
    )
    export_requirements: Optional[Dict[str, Any]] = Field(
        None,
        description="Export requirements (watermarking, resolution limits, etc.)"
    )
    exclusivity_overrides: Optional[Dict[str, Any]] = Field(
        None,
        description="Platform-specific exclusivity overrides"
    )
    third_party_revenue_share_pct: float = Field(
        default=0,
        ge=0,
        le=100,
        description="Revenue share percentage for third-party distribution"
    )
    requires_org_approval: bool = Field(
        default=False,
        description="Whether exports require organization approval"
    )
    notes: Optional[str] = None


class DistributionPolicyResponse(BaseModel):
    """Distribution policy details."""
    world_id: str
    world_title: str
    world_status: str
    distribution_policy: str
    allowed_platforms: List[str]
    export_requirements: Dict[str, Any]
    exclusivity_overrides: Optional[Dict[str, Any]]
    third_party_revenue_share_pct: float
    requires_org_approval: bool
    notes: Optional[str]
    is_default: bool = False


class ExportJobRequest(BaseModel):
    """Request to create an export job."""
    platform_key: str = Field(..., description="Target platform key (e.g., 'youtube', 'venue_dcp')")
    episode_id: Optional[str] = Field(None, description="Specific episode to export, or null for entire World")
    export_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Export configuration overrides"
    )


class ExportJobResponse(BaseModel):
    """Export job details."""
    job_id: str
    world_id: str
    world_title: Optional[str]
    episode_id: Optional[str]
    episode_title: Optional[str]
    platform_key: str
    platform_name: Optional[str]
    status: str
    progress_pct: int
    requires_approval: bool
    approved_at: Optional[datetime]
    requested_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]


class ExportArtifactResponse(BaseModel):
    """Export artifact details."""
    id: str
    artifact_type: str
    filename: str
    file_size_bytes: Optional[int]
    is_primary: bool
    created_at: datetime


class PlatformTemplateResponse(BaseModel):
    """Platform template details."""
    id: str
    platform_key: str
    platform_name: str
    platform_type: str
    description: Optional[str]
    video_specs: Dict[str, Any]
    audio_specs: Dict[str, Any]
    required_metadata: List[str]
    is_active: bool
    is_beta: bool


class ExportValidationResponse(BaseModel):
    """Export validation result."""
    allowed: bool
    reason: Optional[str]
    requirements: Optional[Dict[str, Any]]
    requires_org_approval: bool
    requires_platform_approval: bool


# =============================================================================
# Helper Functions
# =============================================================================

async def verify_world_access(world_id: str, user_id: str, require_edit: bool = False) -> dict:
    """Verify user has access to the World."""
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(user_id)

    world = execute_single("""
        SELECT w.id, w.creator_id, w.organization_id, w.status, w.title
        FROM worlds w
        WHERE w.id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    # Check ownership or organization membership
    is_owner = str(world["creator_id"]) == profile_id

    is_org_member = False
    if world["organization_id"]:
        org_member = execute_single("""
            SELECT role FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
        """, {"org_id": world["organization_id"], "user_id": profile_id})
        is_org_member = org_member is not None

    if require_edit and not (is_owner or is_org_member):
        raise HTTPException(status_code=403, detail="Not authorized to manage this World")

    return {
        **dict(world),
        "profile_id": profile_id,
        "is_owner": is_owner,
        "is_org_member": is_org_member
    }


# =============================================================================
# Distribution Policy Endpoints
# =============================================================================

@router.get("/worlds/{world_id}/distribution-policy", response_model=DistributionPolicyResponse)
async def get_distribution_policy(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get distribution policy for a World.

    Returns current policy settings or defaults if not configured.
    """
    await verify_world_access(world_id, current_user["sub"])

    policy = await DistributionService.get_distribution_policy(world_id)

    if not policy:
        raise HTTPException(status_code=404, detail="World not found")

    return policy


@router.put("/worlds/{world_id}/distribution-policy")
async def set_distribution_policy(
    world_id: str,
    request: DistributionPolicyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Set or update distribution policy for a World.

    Requires ownership or organization membership.
    """
    access = await verify_world_access(world_id, current_user["sub"], require_edit=True)

    # Validate policy value
    valid_policies = [DistributionPolicy.INTERNAL_ONLY, DistributionPolicy.INTERNAL_PLUS_THIRD_PARTY, DistributionPolicy.OPEN_EXPORT]
    if request.distribution_policy not in valid_policies:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid policy. Must be one of: {', '.join(valid_policies)}"
        )

    result = await DistributionService.set_distribution_policy(
        world_id=world_id,
        user_id=access["profile_id"],
        distribution_policy=request.distribution_policy,
        allowed_platforms=request.allowed_platforms,
        export_requirements=request.export_requirements,
        exclusivity_overrides=request.exclusivity_overrides,
        third_party_revenue_share_pct=request.third_party_revenue_share_pct,
        requires_org_approval=request.requires_org_approval,
        notes=request.notes
    )

    return result


# =============================================================================
# Platform Templates
# =============================================================================

@router.get("/distribution/platforms", response_model=List[PlatformTemplateResponse])
async def list_platform_templates(
    platform_type: Optional[str] = Query(None, description="Filter by type: social_avod, fast_channel, venue_theatrical, etc."),
    include_beta: bool = Query(False, description="Include beta platforms")
):
    """
    List available export platform templates.

    No authentication required for browsing templates.
    """
    templates = await DistributionService.get_platform_templates(
        platform_type=platform_type,
        active_only=not include_beta
    )

    return templates


@router.get("/distribution/platforms/{platform_key}", response_model=PlatformTemplateResponse)
async def get_platform_template(platform_key: str):
    """Get details for a specific platform template."""
    template = await DistributionService.get_platform_template(platform_key)

    if not template:
        raise HTTPException(status_code=404, detail="Platform template not found")

    return template


# =============================================================================
# Export Validation
# =============================================================================

@router.get("/worlds/{world_id}/export/validate", response_model=ExportValidationResponse)
async def validate_export(
    world_id: str,
    platform_key: str = Query(..., description="Target platform key"),
    episode_id: Optional[str] = Query(None, description="Specific episode ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Validate if an export request can proceed.

    Checks distribution policy, rights windows, and exclusivity agreements.
    """
    await verify_world_access(world_id, current_user["sub"])

    result = await DistributionService.validate_export_request(
        world_id=world_id,
        platform_key=platform_key,
        episode_id=episode_id
    )

    return {
        "allowed": result.get("allowed", False),
        "reason": result.get("reason"),
        "requirements": result.get("requirements"),
        "requires_org_approval": result.get("requires_org_approval", False),
        "requires_platform_approval": result.get("requires_platform_approval", False)
    }


# =============================================================================
# Export Job Management
# =============================================================================

@router.post("/worlds/{world_id}/export")
async def create_export_job(
    world_id: str,
    request: ExportJobRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create an export job for a World or Episode.

    Validates permissions, policy, and rights before creating the job.
    """
    access = await verify_world_access(world_id, current_user["sub"], require_edit=True)

    # World must be published for export
    if access["status"] != "published":
        raise HTTPException(
            status_code=400,
            detail="World must be published before export"
        )

    result = await DistributionService.create_export_job(
        world_id=world_id,
        platform_key=request.platform_key,
        requested_by=access["profile_id"],
        episode_id=request.episode_id,
        export_config=request.export_config,
        organization_id=access.get("organization_id")
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/worlds/{world_id}/export/history")
async def get_export_history(
    world_id: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get export history for a World."""
    await verify_world_access(world_id, current_user["sub"])

    history = await DistributionService.get_world_export_history(
        world_id=world_id,
        limit=limit,
        offset=offset
    )

    return {"world_id": world_id, "exports": history}


@router.get("/export/jobs/{job_id}")
async def get_export_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about an export job."""
    job = await DistributionService.get_export_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    # Verify access
    await verify_world_access(job["world_id"], current_user["sub"])

    return job


@router.post("/export/jobs/{job_id}/cancel")
async def cancel_export_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a pending or in-progress export job."""
    job = await DistributionService.get_export_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    access = await verify_world_access(job["world_id"], current_user["sub"], require_edit=True)

    result = await DistributionService.cancel_export_job(job_id, access["profile_id"])

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/export/jobs/{job_id}/approve")
async def approve_export_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Approve an export job that requires approval.

    Requires organization admin or owner role.
    """
    job = await DistributionService.get_export_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    access = await verify_world_access(job["world_id"], current_user["sub"], require_edit=True)

    # Additional check: must be org admin for approval
    if job.get("organization_id") and not access["is_owner"]:
        org_member = execute_single("""
            SELECT role FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
              AND role IN ('owner', 'admin', 'finance')
        """, {"org_id": job["organization_id"], "user_id": access["profile_id"]})

        if not org_member:
            raise HTTPException(status_code=403, detail="Organization admin role required for approval")

    result = await DistributionService.approve_export_job(job_id, access["profile_id"])

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/export/jobs/{job_id}/artifacts", response_model=List[ExportArtifactResponse])
async def get_export_artifacts(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get artifacts produced by an export job."""
    job = await DistributionService.get_export_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    await verify_world_access(job["world_id"], current_user["sub"])

    artifacts = await DistributionService.get_export_artifacts(job_id)

    return artifacts


# =============================================================================
# Export Statistics
# =============================================================================

@router.get("/worlds/{world_id}/export/stats")
async def get_world_export_stats(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get export statistics for a World."""
    await verify_world_access(world_id, current_user["sub"])

    stats = await DistributionService.get_export_stats(world_id=world_id)

    return {"world_id": world_id, **stats}


@router.get("/organizations/{org_id}/export/stats")
async def get_organization_export_stats(
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get export statistics for an organization."""
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    # Verify org membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    stats = await DistributionService.get_export_stats(organization_id=org_id)

    return {"organization_id": org_id, **stats}


# =============================================================================
# Creator's Export Dashboard
# =============================================================================

@router.get("/creator/exports")
async def get_creator_exports(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all export jobs for the current creator.

    Returns exports across all their Worlds.
    """
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    query = """
        SELECT
            ej.id as job_id,
            ej.world_id,
            w.title as world_title,
            ej.episode_id,
            e.title as episode_title,
            ej.platform_key,
            ept.platform_name,
            ej.status,
            ej.progress_pct,
            ej.requested_at,
            ej.completed_at,
            ej.error_message
        FROM export_jobs ej
        JOIN worlds w ON ej.world_id = w.id
        LEFT JOIN episodes e ON ej.episode_id = e.id
        LEFT JOIN export_platform_templates ept ON ej.platform_template_id = ept.id
        WHERE ej.requested_by = :profile_id
    """
    params = {"profile_id": profile_id, "limit": limit, "offset": offset}

    if status:
        query += " AND ej.status = :status::export_status"
        params["status"] = status

    query += " ORDER BY ej.requested_at DESC LIMIT :limit OFFSET :offset"

    from app.core.database import execute_query
    exports = execute_query(query, params)

    return {"exports": [dict(e) for e in exports]}
