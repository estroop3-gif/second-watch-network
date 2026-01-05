"""
World Onboarding API
Phase 4C: World creation wizard and onboarding endpoints.

Provides:
- Onboarding checklist retrieval
- Checklist item completion
- Review submission
- Progress tracking
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.services.world_onboarding_service import WorldOnboardingService

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class MarkMetadataCompleteRequest(BaseModel):
    """Request to mark metadata as complete."""
    pass  # Validation happens server-side


class MarkArtworkUploadedRequest(BaseModel):
    """Request to mark artwork as uploaded."""
    cover_art_url: str = Field(..., description="Main cover art URL")
    cover_art_wide_url: Optional[str] = Field(None, description="Wide banner art URL")


class MarkEpisodeUploadedRequest(BaseModel):
    """Request to mark first episode as uploaded."""
    episode_id: str = Field(..., description="Episode ID")


class MarkTechnicalPassedRequest(BaseModel):
    """Request to mark technical specs as passed."""
    issues: Optional[List[str]] = Field(None, description="Technical issues if any")


class MarkRightsUploadedRequest(BaseModel):
    """Request to mark rights documentation as uploaded."""
    doc_urls: List[str] = Field(..., description="Rights document URLs")


class SubmitForReviewRequest(BaseModel):
    """Request to submit World for review."""
    notes: Optional[str] = Field(None, description="Submission notes for reviewer")


class ChecklistItemResponse(BaseModel):
    """Individual checklist item."""
    key: str
    label: str
    weight: int
    completed: bool
    completed_at: Optional[str]


class OnboardingChecklistResponse(BaseModel):
    """Full onboarding checklist response."""
    world_id: str
    world_title: str
    world_status: str
    checklist: List[ChecklistItemResponse]
    completion_percentage: int
    ready_for_review: bool
    review_submitted: bool
    current_stage: str


class ChecklistUpdateResponse(BaseModel):
    """Response after updating a checklist item."""
    success: bool
    item: Optional[str] = None
    completed: Optional[bool] = None
    completion_percentage: Optional[int] = None
    ready_for_review: Optional[bool] = None
    error: Optional[str] = None


class SubmitReviewResponse(BaseModel):
    """Response after submitting for review."""
    success: bool
    review_task_id: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class PendingOnboardingItem(BaseModel):
    """A World in onboarding status."""
    world_id: str
    title: str
    slug: str
    status: str
    created_at: str
    completion_percentage: Optional[int]
    ready_for_review: Optional[bool]
    review_submitted: Optional[bool]
    last_progress_at: Optional[str]


# =============================================================================
# Helper Functions
# =============================================================================

async def verify_world_ownership(world_id: str, user_id: str) -> dict:
    """Verify user owns or has edit access to the World."""
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(user_id)

    world = execute_single("""
        SELECT id, creator_id, status
        FROM worlds
        WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    if str(world["creator_id"]) != profile_id:
        # Check for collaborator/org access (future enhancement)
        raise HTTPException(status_code=403, detail="Not authorized to edit this World")

    return world


# =============================================================================
# Onboarding Endpoints
# =============================================================================

@router.get("/worlds/{world_id}/onboarding", response_model=OnboardingChecklistResponse)
async def get_onboarding_checklist(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the onboarding checklist for a World.

    Returns the current state of all checklist items, completion percentage,
    and whether the World is ready for review submission.
    """
    await verify_world_ownership(world_id, current_user["sub"])

    result = await WorldOnboardingService.get_onboarding_checklist(world_id)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.post("/worlds/{world_id}/onboarding/metadata", response_model=ChecklistUpdateResponse)
async def mark_metadata_complete(
    world_id: str,
    request: MarkMetadataCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark the metadata checklist item as complete.

    Validates that the World has required metadata (title, logline, category)
    before marking as complete.
    """
    from app.api.users import get_profile_id_from_cognito_id
    await verify_world_ownership(world_id, current_user["sub"])
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await WorldOnboardingService.mark_metadata_complete(
        world_id=world_id,
        user_id=profile_id
    )

    return result


@router.post("/worlds/{world_id}/onboarding/artwork", response_model=ChecklistUpdateResponse)
async def mark_artwork_uploaded(
    world_id: str,
    request: MarkArtworkUploadedRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark the artwork checklist item as complete.

    Updates the World's cover art URLs and marks artwork as uploaded.
    """
    from app.api.users import get_profile_id_from_cognito_id
    await verify_world_ownership(world_id, current_user["sub"])
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await WorldOnboardingService.mark_artwork_uploaded(
        world_id=world_id,
        user_id=profile_id,
        cover_art_url=request.cover_art_url,
        cover_art_wide_url=request.cover_art_wide_url
    )

    return result


@router.post("/worlds/{world_id}/onboarding/episode", response_model=ChecklistUpdateResponse)
async def mark_first_episode_uploaded(
    world_id: str,
    request: MarkEpisodeUploadedRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark the first episode checklist item as complete.

    Validates that the episode exists and belongs to the World.
    """
    from app.api.users import get_profile_id_from_cognito_id
    await verify_world_ownership(world_id, current_user["sub"])
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await WorldOnboardingService.mark_first_episode_uploaded(
        world_id=world_id,
        user_id=profile_id,
        episode_id=request.episode_id
    )

    return result


@router.post("/worlds/{world_id}/onboarding/technical", response_model=ChecklistUpdateResponse)
async def mark_technical_specs_passed(
    world_id: str,
    request: MarkTechnicalPassedRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark the technical specs checklist item as complete (or record issues).

    If issues are provided, they are recorded but the item is not marked complete.
    """
    from app.api.users import get_profile_id_from_cognito_id
    await verify_world_ownership(world_id, current_user["sub"])
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await WorldOnboardingService.mark_technical_specs_passed(
        world_id=world_id,
        user_id=profile_id,
        issues=request.issues
    )

    return result


@router.post("/worlds/{world_id}/onboarding/rights", response_model=ChecklistUpdateResponse)
async def mark_rights_docs_uploaded(
    world_id: str,
    request: MarkRightsUploadedRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark the rights documentation checklist item as complete.

    At least one document URL is required.
    """
    from app.api.users import get_profile_id_from_cognito_id
    await verify_world_ownership(world_id, current_user["sub"])
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await WorldOnboardingService.mark_rights_docs_uploaded(
        world_id=world_id,
        user_id=profile_id,
        doc_urls=request.doc_urls
    )

    return result


@router.post("/worlds/{world_id}/onboarding/submit", response_model=SubmitReviewResponse)
async def submit_for_review(
    world_id: str,
    request: SubmitForReviewRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit the World for content review.

    Requires that the World is ready for review (80%+ completion).
    Creates a content review task and updates the World status.
    """
    from app.api.users import get_profile_id_from_cognito_id
    await verify_world_ownership(world_id, current_user["sub"])
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await WorldOnboardingService.submit_for_review(
        world_id=world_id,
        user_id=profile_id,
        notes=request.notes
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/creator/onboarding", response_model=List[PendingOnboardingItem])
async def get_creator_pending_onboarding(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all Worlds in onboarding for the current creator.

    Returns draft and pending_review Worlds with their onboarding progress.
    """
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    worlds = await WorldOnboardingService.get_pending_onboarding(
        creator_id=profile_id,
        limit=limit
    )

    # Convert datetime objects to strings for response
    for w in worlds:
        if w.get("created_at"):
            w["created_at"] = w["created_at"].isoformat() if hasattr(w["created_at"], "isoformat") else str(w["created_at"])
        if w.get("last_progress_at"):
            w["last_progress_at"] = w["last_progress_at"].isoformat() if hasattr(w["last_progress_at"], "isoformat") else str(w["last_progress_at"])

    return worlds


@router.post("/worlds/{world_id}/onboarding/reset", response_model=ChecklistUpdateResponse)
async def reset_onboarding(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Reset onboarding state for a rejected World.

    Allows resubmission after addressing review feedback.
    Only applicable to Worlds that have been rejected.
    """
    await verify_world_ownership(world_id, current_user["sub"])

    # Verify the World was rejected
    world = execute_single("""
        SELECT status FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    if world["status"] not in ("rejected", "needs_changes"):
        raise HTTPException(
            status_code=400,
            detail="Can only reset onboarding for rejected Worlds"
        )

    result = await WorldOnboardingService.reset_onboarding(world_id)
    return result
