"""
Live Production API
Phase 5C: Live production integration and experimental features.

Provides:
- Production link management (Backlot to World)
- Production updates
- VR/AR metadata (experimental)
- Blockchain settings (experimental)
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.services.live_production_service import LiveProductionService
from app.services.experimental_service import ExperimentalService

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateProductionLinkRequest(BaseModel):
    """Request to create a production link."""
    project_id: str
    world_id: str
    link_type: str = Field(default="behind_the_scenes")
    show_on_world_page: bool = True
    show_production_calendar: bool = False
    show_crew_highlights: bool = False
    allow_fan_engagement: bool = False
    auto_create_episodes_from_dailies: bool = False
    dailies_episode_visibility: str = "premium"


class UpdateProductionLinkRequest(BaseModel):
    """Request to update a production link."""
    link_type: Optional[str] = None
    is_active: Optional[bool] = None
    show_on_world_page: Optional[bool] = None
    show_production_calendar: Optional[bool] = None
    show_crew_highlights: Optional[bool] = None
    allow_fan_engagement: Optional[bool] = None
    auto_create_episodes_from_dailies: Optional[bool] = None
    dailies_episode_visibility: Optional[str] = None
    content_embargo_until: Optional[datetime] = None
    live_updates_enabled: Optional[bool] = None


class CreateUpdateRequest(BaseModel):
    """Request to create a production update."""
    update_type: str = Field(default="text")
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, max_length=5000)
    media_urls: Optional[List[str]] = None
    milestone_type: Optional[str] = None
    production_day_id: Optional[str] = None
    visibility: str = "public"
    publish_immediately: bool = True


class BlockchainSettingsRequest(BaseModel):
    """Request to update blockchain settings."""
    wallet_address: Optional[str] = None
    wallet_chain: str = "polygon"
    log_all_earnings: bool = True
    log_distributions: bool = True
    public_ledger_visibility: str = "anonymous"


class ImmersiveMetadataRequest(BaseModel):
    """Request to add immersive metadata."""
    content_type: str
    video_asset_id: Optional[str] = None
    episode_id: Optional[str] = None
    field_of_view_degrees: Optional[int] = None
    stereo_mode: Optional[str] = None
    projection_type: Optional[str] = None
    resolution_width_per_eye: Optional[int] = None
    resolution_height_per_eye: Optional[int] = None
    has_spatial_audio: bool = False
    spatial_audio_format: Optional[str] = None
    audio_channel_count: Optional[int] = None
    compatible_devices: Optional[List[str]] = None


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(user: dict) -> str:
    """Get profile ID from Cognito user."""
    from app.api.users import get_profile_id_from_cognito_id
    return await get_profile_id_from_cognito_id(user["sub"])


async def verify_project_access(project_id: str, profile_id: str) -> bool:
    """Verify user has access to the Backlot project."""
    # Check if user is project owner or crew member with appropriate role
    access = execute_single("""
        SELECT 1 FROM backlot_projects bp
        WHERE bp.id = :project_id
          AND (
              bp.created_by = :profile_id
              OR EXISTS (
                  SELECT 1 FROM backlot_project_members bpm
                  WHERE bpm.project_id = bp.id
                    AND bpm.user_id = :profile_id
                    AND bpm.department IN ('Production', 'Directing')
              )
          )
    """, {"project_id": project_id, "profile_id": profile_id})

    return access is not None


# =============================================================================
# Production Links
# =============================================================================

@router.post("/production-links")
async def create_production_link(
    request: CreateProductionLinkRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a link between a Backlot project and a World.

    Link types:
    - behind_the_scenes: BTS content and updates
    - production_updates: Progress updates only
    - live_from_set: Live streaming from set
    - premiere_countdown: Countdown to premiere
    """
    profile_id = await get_profile_id(current_user)

    # Verify project access
    if not await verify_project_access(request.project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not authorized for this project")

    result = await LiveProductionService.create_production_link(
        project_id=request.project_id,
        world_id=request.world_id,
        created_by=profile_id,
        link_type=request.link_type,
        show_on_world_page=request.show_on_world_page,
        show_production_calendar=request.show_production_calendar,
        show_crew_highlights=request.show_crew_highlights,
        allow_fan_engagement=request.allow_fan_engagement,
        auto_create_episodes_from_dailies=request.auto_create_episodes_from_dailies,
        dailies_episode_visibility=request.dailies_episode_visibility
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/production-links/{link_id}")
async def get_production_link(
    link_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a production link."""
    link = await LiveProductionService.get_production_link(link_id)

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    return link


@router.get("/worlds/{world_id}/production-links")
async def get_world_production_links(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all production links for a World."""
    links = await LiveProductionService.get_links_for_world(world_id)

    return {"world_id": world_id, "links": links}


@router.get("/projects/{project_id}/production-links")
async def get_project_production_links(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all production links for a Backlot project."""
    profile_id = await get_profile_id(current_user)

    if not await verify_project_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    links = await LiveProductionService.get_links_for_project(project_id)

    return {"project_id": project_id, "links": links}


@router.put("/production-links/{link_id}")
async def update_production_link(
    link_id: str,
    request: UpdateProductionLinkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a production link."""
    profile_id = await get_profile_id(current_user)

    link = await LiveProductionService.get_production_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if not await verify_project_access(link["project_id"], profile_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await LiveProductionService.update_production_link(
        link_id=link_id,
        updated_by=profile_id,
        **request.model_dump(exclude_none=True)
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.delete("/production-links/{link_id}")
async def deactivate_production_link(
    link_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a production link."""
    profile_id = await get_profile_id(current_user)

    link = await LiveProductionService.get_production_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if not await verify_project_access(link["project_id"], profile_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await LiveProductionService.deactivate_link(link_id)

    return result


# =============================================================================
# Production Updates
# =============================================================================

@router.post("/production-links/{link_id}/updates")
async def create_production_update(
    link_id: str,
    request: CreateUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a production update."""
    profile_id = await get_profile_id(current_user)

    link = await LiveProductionService.get_production_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if not await verify_project_access(link["project_id"], profile_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await LiveProductionService.create_production_update(
        link_id=link_id,
        created_by=profile_id,
        **request.model_dump()
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/production-links/{link_id}/updates")
async def get_production_updates(
    link_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get updates for a production link."""
    updates = await LiveProductionService.get_production_updates(
        link_id=link_id,
        limit=limit,
        offset=offset
    )

    return {"link_id": link_id, "updates": updates}


@router.get("/worlds/{world_id}/production-updates")
async def get_world_production_updates(
    world_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get all production updates for a World."""
    updates = await LiveProductionService.get_production_updates(
        world_id=world_id,
        limit=limit,
        offset=offset
    )

    return {"world_id": world_id, "updates": updates}


@router.post("/production-links/{link_id}/milestones")
async def record_milestone(
    link_id: str,
    milestone_type: str = Query(..., description="first_day, halfway, picture_wrap, etc."),
    title: Optional[str] = None,
    content: Optional[str] = None,
    media_urls: Optional[List[str]] = Query(None),
    production_day_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Record a production milestone."""
    profile_id = await get_profile_id(current_user)

    link = await LiveProductionService.get_production_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if not await verify_project_access(link["project_id"], profile_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await LiveProductionService.record_milestone(
        link_id=link_id,
        milestone_type=milestone_type,
        created_by=profile_id,
        title=title,
        content=content,
        media_urls=media_urls,
        production_day_id=production_day_id
    )

    return result


@router.get("/me/production-updates-feed")
async def get_my_updates_feed(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get personalized production updates feed."""
    profile_id = await get_profile_id(current_user)

    updates = await LiveProductionService.get_updates_feed(
        user_id=profile_id,
        limit=limit
    )

    return {"updates": updates}


# =============================================================================
# Experimental: VR/AR Metadata
# =============================================================================

@router.post("/immersive-metadata")
async def add_immersive_metadata(
    request: ImmersiveMetadataRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add VR/AR metadata to content (experimental).

    Content types:
    - vr_180, vr_360, vr_interactive
    - ar_overlay, ar_companion
    - spatial_video, volumetric
    """
    result = await ExperimentalService.add_immersive_metadata(**request.model_dump())

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/episodes/{episode_id}/immersive-metadata")
async def get_episode_immersive_metadata(
    episode_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get VR/AR metadata for an episode."""
    metadata = await ExperimentalService.get_immersive_metadata(episode_id=episode_id)

    return {"episode_id": episode_id, "metadata": metadata}


@router.get("/episodes/{episode_id}/ar-content")
async def get_episode_ar_content(
    episode_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get AR companion content for an episode."""
    content = await ExperimentalService.get_ar_content_for_episode(episode_id)

    return {"episode_id": episode_id, "ar_content": content}


@router.get("/episodes/{episode_id}/ar-content/at-timestamp")
async def get_ar_content_at_timestamp(
    episode_id: str,
    timestamp_ms: int = Query(..., ge=0),
    tolerance_ms: int = Query(1000, ge=0, le=5000),
    current_user: dict = Depends(get_current_user)
):
    """Get AR content triggered near a specific timestamp."""
    content = await ExperimentalService.get_ar_content_at_timestamp(
        episode_id=episode_id,
        timestamp_ms=timestamp_ms,
        tolerance_ms=tolerance_ms
    )

    return {"episode_id": episode_id, "timestamp_ms": timestamp_ms, "ar_content": content}


# =============================================================================
# Experimental: Blockchain Settings
# =============================================================================

@router.get("/me/blockchain-settings")
async def get_my_blockchain_settings(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's blockchain settings."""
    profile_id = await get_profile_id(current_user)

    settings = await ExperimentalService.get_blockchain_settings(profile_id=profile_id)

    return {"settings": settings, "is_enabled": settings.get("is_enabled", False) if settings else False}


@router.post("/me/blockchain-settings/enable")
async def enable_blockchain_tracking(
    request: BlockchainSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Enable blockchain royalty tracking (opt-in).

    Supported chains: ethereum, polygon, solana
    """
    profile_id = await get_profile_id(current_user)

    result = await ExperimentalService.enable_blockchain_tracking(
        profile_id=profile_id,
        **request.model_dump()
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/me/blockchain-settings/disable")
async def disable_blockchain_tracking(
    current_user: dict = Depends(get_current_user)
):
    """Disable blockchain royalty tracking (opt-out)."""
    profile_id = await get_profile_id(current_user)

    result = await ExperimentalService.disable_blockchain_tracking(profile_id=profile_id)

    return result


@router.get("/me/blockchain-ledger")
async def get_my_blockchain_ledger(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get blockchain ledger entries for current user."""
    profile_id = await get_profile_id(current_user)

    entries = await ExperimentalService.get_ledger_entries(
        recipient_type="creator",
        recipient_id=profile_id,
        status=status,
        limit=limit,
        offset=offset
    )

    summary = await ExperimentalService.get_earnings_summary("creator", profile_id)

    return {
        "entries": entries,
        "summary": summary
    }


@router.get("/me/nfts")
async def get_my_nfts(
    current_user: dict = Depends(get_current_user)
):
    """Get NFTs owned by current user."""
    profile_id = await get_profile_id(current_user)

    nfts = await ExperimentalService.get_user_nfts(profile_id)

    return {"nfts": nfts}


# =============================================================================
# Organization Blockchain Settings
# =============================================================================

@router.get("/organizations/{org_id}/blockchain-settings")
async def get_org_blockchain_settings(
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get organization's blockchain settings."""
    profile_id = await get_profile_id(current_user)

    # Verify org membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
          AND role IN ('owner', 'admin', 'finance')
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not authorized")

    settings = await ExperimentalService.get_blockchain_settings(organization_id=org_id)

    return {"settings": settings}


@router.post("/organizations/{org_id}/blockchain-settings/enable")
async def enable_org_blockchain_tracking(
    org_id: str,
    request: BlockchainSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Enable blockchain tracking for an organization."""
    profile_id = await get_profile_id(current_user)

    # Verify org admin
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
          AND role IN ('owner', 'admin')
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Admin role required")

    result = await ExperimentalService.enable_blockchain_tracking(
        organization_id=org_id,
        **request.model_dump()
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/organizations/{org_id}/blockchain-ledger")
async def get_org_blockchain_ledger(
    org_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get blockchain ledger entries for an organization."""
    profile_id = await get_profile_id(current_user)

    # Verify org membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not authorized")

    entries = await ExperimentalService.get_ledger_entries(
        recipient_type="organization",
        recipient_id=org_id,
        limit=limit,
        offset=offset
    )

    summary = await ExperimentalService.get_earnings_summary("organization", org_id)

    return {
        "organization_id": org_id,
        "entries": entries,
        "summary": summary
    }
