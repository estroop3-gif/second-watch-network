"""
Career API
Phase 3A: Career and filmography endpoints for Order members.

Provides endpoints for:
- Member filmography (credits across Worlds)
- World crew network
- Job activity and recommendations
- Career highlights and statistics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single
from app.core.logging import get_logger
from app.services.career_service import CareerService

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class CreditResponse(BaseModel):
    """Credit entry response."""
    credit_id: str
    credit_type: str
    world_id: str
    episode_id: Optional[str]
    project_title: str
    project_image: Optional[str]
    content_format: Optional[str]
    premiere_date: Optional[str]
    department: Optional[str]
    role: Optional[str]
    character_name: Optional[str]
    is_featured: bool
    is_top_billed: bool
    is_verified: bool
    billing_order: Optional[int]


class FilmographyResponse(BaseModel):
    """Filmography response with stats."""
    member_id: str
    credits: List[Dict[str, Any]]
    stats: Dict[str, Any]
    limit: int
    offset: int


class CrewMemberResponse(BaseModel):
    """Crew member entry."""
    credit_id: str
    member_id: Optional[str]
    member_name: Optional[str]
    member_avatar: Optional[str]
    primary_track: Optional[str]
    member_city: Optional[str]
    lodge_name: Optional[str]
    lodge_id: Optional[str]
    department: Optional[str]
    role: Optional[str]
    character_name: Optional[str]
    is_featured: bool
    is_top_billed: bool
    is_verified: bool


class JobRecommendation(BaseModel):
    """Job recommendation entry."""
    id: str
    title: str
    location: Optional[str]
    job_type: Optional[str]
    department: Optional[str]
    compensation_type: Optional[str]
    world_title: Optional[str]
    lodge_name: Optional[str]
    relevance_score: int


class CareerHighlightsResponse(BaseModel):
    """Career highlights response."""
    member_id: str
    order_profile: Optional[Dict[str, Any]]
    stats: Dict[str, Any]
    recent_credits: List[Dict[str, Any]]
    highlights: List[Dict[str, Any]]
    frequent_collaborators: List[Dict[str, Any]]


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(current_user: dict) -> str:
    """Resolve profile ID from Cognito user."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_id = :cognito_id",
        {"cognito_id": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile["id"]


# =============================================================================
# Member Filmography Endpoints
# =============================================================================

@router.get("/members/{member_id}/filmography", response_model=FilmographyResponse)
async def get_member_filmography(
    member_id: str,
    department: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a member's complete filmography (public credits).

    Returns credits across all Worlds organized by recency.
    """
    result = await CareerService.get_member_filmography(
        member_id=member_id,
        department=department,
        limit=limit,
        offset=offset
    )

    return result


@router.get("/me/filmography", response_model=FilmographyResponse)
async def get_my_filmography(
    department: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get the current user's filmography."""
    profile_id = await get_profile_id(current_user)

    return await CareerService.get_member_filmography(
        member_id=profile_id,
        department=department,
        limit=limit,
        offset=offset
    )


@router.get("/members/{member_id}/highlights", response_model=CareerHighlightsResponse)
async def get_member_highlights(
    member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get career highlights for a member's profile.

    Includes featured credits, frequent collaborators, and statistics.
    """
    result = await CareerService.get_career_highlights(member_id)
    return result


@router.get("/me/highlights", response_model=CareerHighlightsResponse)
async def get_my_highlights(
    current_user: dict = Depends(get_current_user)
):
    """Get the current user's career highlights."""
    profile_id = await get_profile_id(current_user)
    return await CareerService.get_career_highlights(profile_id)


# =============================================================================
# World Crew Network Endpoints
# =============================================================================

@router.get("/worlds/{world_id}/crew")
async def get_world_crew_network(
    world_id: str,
    department: Optional[str] = Query(None),
    include_episodes: bool = Query(True),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the complete crew network for a World.

    Returns all cast and crew organized by department,
    with lodge distribution statistics.
    """
    result = await CareerService.get_world_crew_network(
        world_id=world_id,
        department=department,
        include_episodes=include_episodes
    )

    return result


@router.get("/organizations/{org_id}/credits")
async def get_organization_credits(
    org_id: str,
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all credits for Worlds owned by an organization.

    Returns credits organized by World.
    """
    result = await CareerService.get_credits_for_organization(
        organization_id=org_id,
        limit=limit
    )

    return result


# =============================================================================
# Job Activity Endpoints
# =============================================================================

@router.get("/me/jobs/activity")
async def get_my_job_activity(
    status: Optional[str] = Query(None, pattern="^(submitted|reviewed|accepted|rejected)$"),
    include_closed: bool = Query(False),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current user's job application activity.

    Returns applications with status and job details.
    """
    profile_id = await get_profile_id(current_user)

    result = await CareerService.get_member_job_activity(
        member_id=profile_id,
        status=status,
        include_closed=include_closed,
        limit=limit
    )

    return result


@router.get("/me/jobs/recommended")
async def get_recommended_jobs(
    days: int = Query(30, ge=7, le=90),
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get job recommendations for the current user.

    Considers lodge affiliation, craft house, and location
    to provide relevant job suggestions.
    """
    profile_id = await get_profile_id(current_user)

    jobs = await CareerService.get_recent_jobs_for_member(
        member_id=profile_id,
        days=days,
        limit=limit
    )

    return {"jobs": jobs, "count": len(jobs)}


# =============================================================================
# Credit Verification Endpoints
# =============================================================================

@router.post("/credits/{credit_id}/verify")
async def verify_credit(
    credit_id: str,
    credit_type: str = Query(..., pattern="^(world|episode)$"),
    current_user: dict = Depends(get_current_user)
):
    """
    Verify a credit (mark as confirmed).

    A credit can be verified by:
    - The credited member themselves
    - An admin
    - The World creator (for their Worlds)
    """
    profile_id = await get_profile_id(current_user)

    # Check permission to verify
    table = "world_credits" if credit_type == "world" else "episode_credits"

    credit = execute_single(f"""
        SELECT c.*, w.creator_id
        FROM {table} c
        JOIN {'worlds' if credit_type == 'world' else 'episodes e JOIN worlds'} w
            ON {'c.world_id = w.id' if credit_type == 'world' else 'e.world_id = w.id AND c.episode_id = e.id'}
        WHERE c.id = :credit_id
    """, {"credit_id": credit_id})

    if not credit:
        raise HTTPException(status_code=404, detail="Credit not found")

    # Check if user can verify
    is_credited = (
        str(credit.get("user_id")) == profile_id or
        str(credit.get("order_member_id")) == profile_id
    )
    is_creator = str(credit.get("creator_id")) == profile_id
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not (is_credited or is_creator or is_admin):
        raise HTTPException(
            status_code=403,
            detail="Only the credited member, World creator, or admin can verify credits"
        )

    result = await CareerService.verify_credit(
        credit_id=credit_id,
        credit_type=credit_type,
        verified_by=profile_id
    )

    if not result:
        raise HTTPException(status_code=400, detail="Failed to verify credit")

    return {"status": "verified", "credit": result}


# =============================================================================
# Crew Search Endpoint
# =============================================================================

@router.get("/crew/search")
async def search_crew(
    q: str = Query(..., min_length=2, max_length=100),
    department: Optional[str] = Query(None),
    lodge_id: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for crew members by name or specialty.

    Returns matching Order members with their credit counts.
    """
    results = await CareerService.search_crew(
        query=q,
        department=department,
        lodge_id=lodge_id,
        limit=limit
    )

    return {"results": results, "count": len(results)}


# =============================================================================
# Career View Endpoint (Full Profile)
# =============================================================================

@router.get("/members/{member_id}/career")
async def get_member_career_view(
    member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete career view for a member.

    Includes filmography, job activity, Order profile, and highlights.
    This is the main endpoint for displaying a member's career page.
    """
    # Get all career data in parallel
    filmography = await CareerService.get_member_filmography(member_id, limit=10)
    highlights = await CareerService.get_career_highlights(member_id)

    # Get Order member profile
    order_profile = execute_single("""
        SELECT
            omp.*,
            ol.name as lodge_name,
            ol.city as lodge_city,
            ol.region as lodge_region,
            och.name as craft_house_name,
            och.slug as craft_house_slug
        FROM order_member_profiles omp
        LEFT JOIN order_lodges ol ON omp.lodge_id = ol.id
        LEFT JOIN order_craft_house_memberships ochm ON omp.user_id = ochm.user_id
        LEFT JOIN order_craft_houses och ON ochm.craft_house_id = och.id
        WHERE omp.user_id = :member_id
    """, {"member_id": member_id})

    # Get profile info
    profile = execute_single("""
        SELECT id, display_name, avatar_url, bio, location
        FROM profiles
        WHERE id = :member_id
    """, {"member_id": member_id})

    if not profile:
        raise HTTPException(status_code=404, detail="Member not found")

    return {
        "member_id": member_id,
        "profile": dict(profile),
        "order_profile": dict(order_profile) if order_profile else None,
        "filmography": filmography,
        "highlights": highlights.get("highlights", []),
        "collaborators": highlights.get("frequent_collaborators", []),
        "stats": highlights.get("stats", {})
    }


@router.get("/me/career")
async def get_my_career_view(
    current_user: dict = Depends(get_current_user)
):
    """Get the current user's complete career view."""
    profile_id = await get_profile_id(current_user)
    return await get_member_career_view(profile_id, current_user)
