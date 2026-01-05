"""
Festivals API
Phase 2C: Endpoints for managing festival submissions and release windows.

Provides endpoints for:
- Admin/PMs: CRUD operations on festival runs and release windows
- Creators/Orgs: View their festival status and upcoming windows
- Public: Get World availability status
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single
from app.core.logging import get_logger
from app.services.festival_service import FestivalService

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class FestivalRunCreate(BaseModel):
    """Create festival submission request."""
    world_id: str
    festival_name: str = Field(..., min_length=2, max_length=300)
    festival_year: Optional[int] = None
    festival_location: Optional[str] = None
    festival_website: Optional[str] = None
    submission_category: Optional[str] = None
    submission_date: Optional[date] = None
    submission_fee_cents: Optional[int] = None
    notes: Optional[str] = None


class FestivalRunUpdate(BaseModel):
    """Update festival submission request."""
    festival_name: Optional[str] = Field(None, min_length=2, max_length=300)
    festival_year: Optional[int] = None
    festival_location: Optional[str] = None
    festival_website: Optional[str] = None
    submission_category: Optional[str] = None
    submission_date: Optional[date] = None
    submission_fee_cents: Optional[int] = None
    premiere_type: Optional[str] = None
    premiere_date: Optional[date] = None
    screening_dates: Optional[List[date]] = None
    exclusivity_required: Optional[bool] = None
    exclusivity_start_date: Optional[date] = None
    exclusivity_end_date: Optional[date] = None
    exclusivity_territories: Optional[List[str]] = None
    programmer_name: Optional[str] = None
    programmer_email: Optional[str] = None
    notes: Optional[str] = None
    press_kit_url: Optional[str] = None
    screener_url: Optional[str] = None


class FestivalStatusUpdate(BaseModel):
    """Update festival run status request."""
    status: str = Field(..., pattern="^(planning|submitted|pending|accepted|screened|awarded|rejected|withdrawn)$")
    awards_won: Optional[List[str]] = None


class ReleaseWindowCreate(BaseModel):
    """Create release window request."""
    world_id: str
    window_type: str = Field(..., pattern="^(festival|venue_exclusive|theatrical|platform_premiere|platform_wide|premium_exclusive|svod|avod|tvod)$")
    start_date: date
    end_date: Optional[date] = None
    territories: Optional[List[str]] = Field(default=["WORLDWIDE"])
    festival_run_id: Optional[str] = None
    venue_deal_id: Optional[str] = None
    priority: int = Field(default=0, ge=0, le=100)
    notes: Optional[str] = None


class FestivalRunResponse(BaseModel):
    """Festival run response."""
    id: str
    world_id: str
    festival_name: str
    festival_slug: str
    festival_year: Optional[int]
    festival_location: Optional[str]
    festival_website: Optional[str]
    submission_category: Optional[str]
    submission_date: Optional[date]
    submission_fee_cents: Optional[int]
    status: str
    premiere_type: Optional[str]
    premiere_date: Optional[date]
    exclusivity_required: Optional[bool]
    exclusivity_start_date: Optional[date]
    exclusivity_end_date: Optional[date]
    awards_won: Optional[List[str]]
    created_at: str


class ReleaseWindowResponse(BaseModel):
    """Release window response."""
    id: str
    world_id: str
    window_type: str
    start_date: date
    end_date: Optional[date]
    territories: Optional[List[str]]
    status: str
    priority: int
    festival_run_id: Optional[str]
    festival_name: Optional[str]
    venue_deal_id: Optional[str]


class AvailabilityResponse(BaseModel):
    """World availability response."""
    available: bool
    reason: str
    world_id: Optional[str] = None
    window_type: Optional[str] = None
    window_id: Optional[str] = None
    festival: Optional[str] = None
    exclusivity_ends: Optional[str] = None
    release_date: Optional[str] = None


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


async def check_world_access(world_id: str, profile_id: str) -> bool:
    """Check if user has access to modify this World's festival data."""
    world = execute_single("""
        SELECT w.id, w.creator_id, w.organization_id,
               COALESCE(om.role IN ('owner', 'admin'), false) as is_org_admin
        FROM worlds w
        LEFT JOIN organization_members om ON w.organization_id = om.organization_id
            AND om.user_id = :profile_id
        WHERE w.id = :world_id
    """, {"world_id": world_id, "profile_id": profile_id})

    if not world:
        return False

    return (
        str(world.get("creator_id")) == str(profile_id) or
        world.get("is_org_admin", False)
    )


# =============================================================================
# Festival Run Endpoints
# =============================================================================

@router.get("/festivals/runs", response_model=List[FestivalRunResponse])
async def list_festival_runs(
    world_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    include_withdrawn: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    List festival runs with optional filters.
    Creators see their own Worlds' runs.
    Admins see all.
    """
    profile_id = await get_profile_id(current_user)

    conditions = ["1=1"]
    params = {"limit": limit, "offset": offset, "profile_id": profile_id}

    if world_id:
        conditions.append("fr.world_id = :world_id")
        params["world_id"] = world_id

    if status:
        conditions.append("fr.status = :status")
        params["status"] = status

    if not include_withdrawn:
        conditions.append("fr.status != 'withdrawn'")

    # Non-admins only see their own Worlds
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        conditions.append("""
            (w.creator_id = :profile_id OR EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = w.organization_id
                AND om.user_id = :profile_id
            ))
        """)

    runs = execute_query(f"""
        SELECT fr.*
        FROM festival_runs fr
        JOIN worlds w ON fr.world_id = w.id
        WHERE {' AND '.join(conditions)}
        ORDER BY fr.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(r) for r in runs]


@router.get("/festivals/runs/{run_id}", response_model=FestivalRunResponse)
async def get_festival_run(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific festival run."""
    profile_id = await get_profile_id(current_user)

    run = execute_single("""
        SELECT fr.*, w.creator_id, w.organization_id
        FROM festival_runs fr
        JOIN worlds w ON fr.world_id = w.id
        WHERE fr.id = :run_id
    """, {"run_id": run_id})

    if not run:
        raise HTTPException(status_code=404, detail="Festival run not found")

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(run["world_id"], profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    return dict(run)


@router.post("/festivals/runs", response_model=FestivalRunResponse, status_code=201)
async def create_festival_run(
    data: FestivalRunCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new festival submission."""
    profile_id = await get_profile_id(current_user)

    # Check World access
    has_access = await check_world_access(data.world_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not has_access and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied to this World")

    run = await FestivalService.create_festival_run(
        world_id=data.world_id,
        festival_name=data.festival_name,
        festival_year=data.festival_year,
        submission_category=data.submission_category,
        submission_date=data.submission_date,
        created_by=profile_id,
        festival_location=data.festival_location,
        festival_website=data.festival_website,
        notes=data.notes
    )

    logger.info("festival_run_created_via_api", run_id=run["id"], world_id=data.world_id)

    return run


@router.put("/festivals/runs/{run_id}", response_model=FestivalRunResponse)
async def update_festival_run(
    run_id: str,
    data: FestivalRunUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a festival run."""
    profile_id = await get_profile_id(current_user)

    # Get existing run
    existing = execute_single(
        "SELECT world_id FROM festival_runs WHERE id = :run_id",
        {"run_id": run_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Festival run not found")

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(existing["world_id"], profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    updates = data.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    run = await FestivalService.update_festival_run(run_id, **updates)
    if not run:
        raise HTTPException(status_code=400, detail="Update failed")

    return run


@router.put("/festivals/runs/{run_id}/status", response_model=FestivalRunResponse)
async def update_festival_run_status(
    run_id: str,
    data: FestivalStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update festival run status."""
    profile_id = await get_profile_id(current_user)

    # Get existing run
    existing = execute_single(
        "SELECT world_id FROM festival_runs WHERE id = :run_id",
        {"run_id": run_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Festival run not found")

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(existing["world_id"], profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    run = await FestivalService.update_festival_status(
        run_id=run_id,
        new_status=data.status,
        awards_won=data.awards_won
    )

    if not run:
        raise HTTPException(
            status_code=400,
            detail="Invalid status transition"
        )

    return run


@router.delete("/festivals/runs/{run_id}", status_code=204)
async def delete_festival_run(
    run_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Delete a festival run. Admin only."""
    execute_single(
        "DELETE FROM festival_runs WHERE id = :run_id RETURNING id",
        {"run_id": run_id}
    )


# =============================================================================
# Festival Summary / Status
# =============================================================================

@router.get("/festivals/worlds/{world_id}/summary")
async def get_world_festival_summary(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get festival submission summary for a World."""
    profile_id = await get_profile_id(current_user)

    # Check access (creators, org members, and admins can view)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(world_id, profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    summary = await FestivalService.get_festival_summary(world_id)
    runs = await FestivalService.get_festival_runs_for_world(world_id)

    return {
        "world_id": world_id,
        "summary": summary,
        "runs": runs
    }


# =============================================================================
# Release Windows
# =============================================================================

@router.get("/festivals/windows", response_model=List[ReleaseWindowResponse])
async def list_release_windows(
    world_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    window_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List release windows with optional filters."""
    profile_id = await get_profile_id(current_user)

    if not world_id:
        raise HTTPException(
            status_code=400,
            detail="world_id is required"
        )

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(world_id, profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    windows = await FestivalService.get_release_windows(
        world_id=world_id,
        status=status,
        window_type=window_type
    )

    return windows


@router.get("/festivals/windows/{window_id}", response_model=ReleaseWindowResponse)
async def get_release_window(
    window_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific release window."""
    profile_id = await get_profile_id(current_user)

    window = execute_single("""
        SELECT wrw.*, fr.festival_name
        FROM world_release_windows wrw
        LEFT JOIN festival_runs fr ON wrw.festival_run_id = fr.id
        WHERE wrw.id = :window_id
    """, {"window_id": window_id})

    if not window:
        raise HTTPException(status_code=404, detail="Release window not found")

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(window["world_id"], profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    return dict(window)


@router.post("/festivals/windows", response_model=ReleaseWindowResponse, status_code=201)
async def create_release_window(
    data: ReleaseWindowCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new release window."""
    profile_id = await get_profile_id(current_user)

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(data.world_id, profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    window = await FestivalService.create_release_window(
        world_id=data.world_id,
        window_type=data.window_type,
        start_date=data.start_date,
        end_date=data.end_date,
        territories=data.territories,
        festival_run_id=data.festival_run_id,
        venue_deal_id=data.venue_deal_id,
        priority=data.priority,
        created_by=profile_id,
        notes=data.notes
    )

    logger.info("release_window_created", window_id=window["id"], world_id=data.world_id)

    return window


@router.put("/festivals/windows/{window_id}/activate", response_model=ReleaseWindowResponse)
async def activate_release_window(
    window_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Activate a planned release window. Admin only."""
    window = await FestivalService.activate_release_window(window_id)
    if not window:
        raise HTTPException(
            status_code=400,
            detail="Cannot activate window (not found or not in planned status)"
        )
    return window


@router.put("/festivals/windows/{window_id}/complete", response_model=ReleaseWindowResponse)
async def complete_release_window(
    window_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Mark a release window as completed. Admin only."""
    window = await FestivalService.complete_release_window(window_id)
    if not window:
        raise HTTPException(
            status_code=400,
            detail="Cannot complete window (not found or not active)"
        )
    return window


@router.delete("/festivals/windows/{window_id}", status_code=204)
async def delete_release_window(
    window_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Delete a release window. Admin only."""
    execute_single(
        "DELETE FROM world_release_windows WHERE id = :window_id RETURNING id",
        {"window_id": window_id}
    )


# =============================================================================
# Availability Check Endpoints
# =============================================================================

@router.get("/festivals/availability/{world_id}", response_model=AvailabilityResponse)
async def check_world_availability(
    world_id: str,
    territory: str = Query("US", description="Territory code (e.g., US, UK, WORLDWIDE)")
):
    """
    Check if a World is available for platform playback.
    Public endpoint - used by players to determine availability.
    """
    availability = await FestivalService.check_platform_availability(world_id, territory)
    return availability


@router.get("/festivals/availability/episode/{episode_id}", response_model=AvailabilityResponse)
async def check_episode_availability(
    episode_id: str,
    territory: str = Query("US", description="Territory code")
):
    """
    Check if a specific episode is available for playback.
    Public endpoint - used by players.
    """
    availability = await FestivalService.check_episode_availability(episode_id, territory)
    return availability


@router.get("/festivals/status/{world_id}")
async def get_world_availability_status(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive availability status for a World.

    Returns current state, upcoming windows, active exclusivity,
    and festival activity summary.
    """
    profile_id = await get_profile_id(current_user)

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(world_id, profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    status = await FestivalService.get_world_availability_status(world_id)

    if status.get("error"):
        raise HTTPException(status_code=404, detail=status["error"])

    return status


# =============================================================================
# Admin Calendar / Upcoming
# =============================================================================

@router.get("/festivals/admin/upcoming-deadlines")
async def get_upcoming_deadlines(
    days: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Get upcoming festival deadlines across all Worlds.
    Admin only.
    """
    deadlines = execute_query("""
        SELECT
            fr.id,
            fr.festival_name,
            fr.submission_date,
            fr.premiere_date,
            fr.exclusivity_end_date,
            fr.status,
            w.id as world_id,
            w.title as world_title
        FROM festival_runs fr
        JOIN worlds w ON fr.world_id = w.id
        WHERE fr.status NOT IN ('rejected', 'withdrawn', 'awarded')
          AND (
            (fr.submission_date >= CURRENT_DATE AND fr.submission_date <= CURRENT_DATE + :days::interval)
            OR (fr.premiere_date >= CURRENT_DATE AND fr.premiere_date <= CURRENT_DATE + :days::interval)
            OR (fr.exclusivity_end_date >= CURRENT_DATE AND fr.exclusivity_end_date <= CURRENT_DATE + :days::interval)
          )
        ORDER BY
            LEAST(
                COALESCE(fr.submission_date, '9999-12-31'::date),
                COALESCE(fr.premiere_date, '9999-12-31'::date),
                COALESCE(fr.exclusivity_end_date, '9999-12-31'::date)
            )
        LIMIT 100
    """, {"days": f"{days} days"})

    return {"deadlines": [dict(d) for d in deadlines]}


@router.get("/festivals/admin/exclusivity-calendar")
async def get_exclusivity_calendar(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Get calendar view of active and upcoming exclusivity periods.
    Admin only.
    """
    if not start_date:
        start_date = date.today()
    if not end_date:
        from datetime import timedelta
        end_date = start_date + timedelta(days=90)

    exclusivities = execute_query("""
        SELECT
            fr.id,
            fr.festival_name,
            fr.exclusivity_start_date,
            fr.exclusivity_end_date,
            fr.exclusivity_territories,
            fr.status,
            w.id as world_id,
            w.title as world_title
        FROM festival_runs fr
        JOIN worlds w ON fr.world_id = w.id
        WHERE fr.exclusivity_required = true
          AND fr.status IN ('accepted', 'screened', 'awarded')
          AND (
            (fr.exclusivity_start_date <= :end_date AND
             (fr.exclusivity_end_date >= :start_date OR fr.exclusivity_end_date IS NULL))
          )
        ORDER BY fr.exclusivity_start_date
    """, {"start_date": start_date, "end_date": end_date})

    return {
        "start_date": str(start_date),
        "end_date": str(end_date),
        "exclusivities": [dict(e) for e in exclusivities]
    }
