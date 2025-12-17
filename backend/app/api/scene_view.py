"""
Scene View API - Aggregates scene data from multiple sources
Provides a unified view of scenes with breakdown, shots, locations, dailies, review, and tasks
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.supabase import get_supabase_admin_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class SceneMetadata(BaseModel):
    id: str
    project_id: str
    script_id: Optional[str] = None
    scene_number: str
    slugline: Optional[str] = None
    int_ext: Optional[str] = None
    day_night: Optional[str] = None
    page_length: Optional[float] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    location_hint: Optional[str] = None
    location_id: Optional[str] = None
    scheduled_day_id: Optional[str] = None
    shot_day_id: Optional[str] = None
    is_scheduled: bool = False
    is_shot: bool = False
    needs_pickup: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BreakdownItem(BaseModel):
    id: str
    scene_id: str
    type: str  # cast, background, stunt, prop, vehicle, wardrobe, makeup, sfx, vfx, animal, etc.
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    quantity: Optional[int] = None


class ShotSummary(BaseModel):
    id: str
    shot_number: str
    description: Optional[str] = None
    frame_size: Optional[str] = None
    camera_movement: Optional[str] = None
    is_covered: bool = False
    circle_take_count: int = 0


class LocationSummary(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    type: Optional[str] = None
    is_primary: bool = False


class DailiesClipSummary(BaseModel):
    id: str
    file_name: str
    scene_number: Optional[str] = None
    take_number: Optional[int] = None
    is_circle_take: bool = False
    rating: Optional[int] = None
    duration_seconds: Optional[float] = None


class ReviewNoteSummary(BaseModel):
    id: str
    asset_id: str
    content: str
    timecode: Optional[str] = None
    author_name: Optional[str] = None
    is_resolved: bool = False
    created_at: str


class TaskSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: Optional[str] = None
    due_date: Optional[str] = None
    assigned_to_name: Optional[str] = None


class SceneListItem(BaseModel):
    id: str
    scene_number: str
    slugline: Optional[str] = None
    int_ext: Optional[str] = None
    day_night: Optional[str] = None
    page_length: Optional[float] = None
    is_scheduled: bool = False
    is_shot: bool = False
    needs_pickup: bool = False
    shot_count: int = 0
    dailies_clip_count: int = 0
    has_coverage: bool = False
    breakdown_item_count: int = 0


class SceneOverview(BaseModel):
    scene: SceneMetadata
    breakdown_items: List[BreakdownItem] = []
    breakdown_by_type: Dict[str, List[BreakdownItem]] = {}
    shots: List[ShotSummary] = []
    locations: List[LocationSummary] = []
    dailies_clips: List[DailiesClipSummary] = []
    review_notes: List[ReviewNoteSummary] = []
    tasks: List[TaskSummary] = []
    coverage_summary: Dict[str, Any] = {}


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    supabase = get_supabase_admin_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user_response.user.id, "email": user_response.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_access(supabase, project_id: str, user_id: str) -> bool:
    """Verify user has access to project"""
    # Check owner
    project_resp = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == user_id:
        return True

    # Check membership
    member_resp = supabase.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    return bool(member_resp.data)


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/scenes", response_model=List[SceneListItem])
async def list_scenes(
    project_id: str,
    script_version_id: Optional[str] = Query(None, description="Filter by script version"),
    search: Optional[str] = Query(None, description="Search by scene number or slugline"),
    authorization: str = Header(None)
):
    """
    List all scenes for a project with summary data
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_access(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Build query
    query = supabase.table("backlot_scenes").select("*").eq("project_id", project_id)

    if script_version_id:
        query = query.eq("script_id", script_version_id)

    scenes_resp = query.order("scene_number").execute()
    scenes = scenes_resp.data or []

    # Get counts for each scene
    scene_ids = [s["id"] for s in scenes]

    # Get shot counts
    shot_counts = {}
    if scene_ids:
        shots_resp = supabase.table("backlot_shots").select("scene_id").in_("scene_id", scene_ids).execute()
        for shot in (shots_resp.data or []):
            scene_id = shot["scene_id"]
            shot_counts[scene_id] = shot_counts.get(scene_id, 0) + 1

    # Get breakdown item counts
    breakdown_counts = {}
    if scene_ids:
        breakdown_resp = supabase.table("backlot_scene_breakdown_items").select("scene_id").in_("scene_id", scene_ids).execute()
        for item in (breakdown_resp.data or []):
            scene_id = item["scene_id"]
            breakdown_counts[scene_id] = breakdown_counts.get(scene_id, 0) + 1

    # Get dailies clip counts by scene_number
    scene_numbers = [s["scene_number"] for s in scenes if s.get("scene_number")]
    clip_counts = {}
    if scene_numbers:
        clips_resp = supabase.table("backlot_dailies_clips").select("scene_number").eq("project_id", project_id).in_("scene_number", scene_numbers).execute()
        for clip in (clips_resp.data or []):
            sn = clip.get("scene_number")
            if sn:
                # Map back to scene_id
                for s in scenes:
                    if s["scene_number"] == sn:
                        clip_counts[s["id"]] = clip_counts.get(s["id"], 0) + 1
                        break

    # Filter by search if provided
    if search:
        search_lower = search.lower()
        scenes = [s for s in scenes if
                  (s.get("scene_number") and search_lower in s["scene_number"].lower()) or
                  (s.get("slugline") and search_lower in s["slugline"].lower())]

    result = []
    for scene in scenes:
        sid = scene["id"]
        has_coverage = clip_counts.get(sid, 0) > 0 or scene.get("is_shot", False)
        result.append(SceneListItem(
            id=sid,
            scene_number=scene.get("scene_number", ""),
            slugline=scene.get("slugline"),
            int_ext=scene.get("int_ext"),
            day_night=scene.get("day_night"),
            page_length=scene.get("page_length"),
            is_scheduled=scene.get("is_scheduled", False),
            is_shot=scene.get("is_shot", False),
            needs_pickup=scene.get("needs_pickup", False),
            shot_count=shot_counts.get(sid, 0),
            dailies_clip_count=clip_counts.get(sid, 0),
            has_coverage=has_coverage,
            breakdown_item_count=breakdown_counts.get(sid, 0),
        ))

    return result


@router.get("/projects/{project_id}/scenes/{scene_id}/overview", response_model=SceneOverview)
async def get_scene_overview(
    project_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """
    Get comprehensive overview of a scene with all related data
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_access(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get scene metadata
    scene_resp = supabase.table("backlot_scenes").select("*").eq("id", scene_id).eq("project_id", project_id).execute()
    if not scene_resp.data:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_data = scene_resp.data[0]
    scene = SceneMetadata(**scene_data)

    # Get breakdown items
    breakdown_resp = supabase.table("backlot_scene_breakdown_items").select("*").eq("scene_id", scene_id).execute()
    breakdown_items = [BreakdownItem(
        id=item["id"],
        scene_id=item["scene_id"],
        type=item.get("type", "other"),
        name=item.get("name", ""),
        description=item.get("description"),
        notes=item.get("notes"),
        quantity=item.get("quantity"),
    ) for item in (breakdown_resp.data or [])]

    # Group breakdown by type
    breakdown_by_type: Dict[str, List[BreakdownItem]] = {}
    for item in breakdown_items:
        if item.type not in breakdown_by_type:
            breakdown_by_type[item.type] = []
        breakdown_by_type[item.type].append(item)

    # Get shots linked to this scene
    shots_resp = supabase.table("backlot_shots").select("*").eq("scene_id", scene_id).order("shot_number").execute()
    shots = []
    for shot in (shots_resp.data or []):
        # Count circle takes for this shot
        circle_takes = supabase.table("backlot_dailies_clips").select("id").eq("project_id", project_id).eq("is_circle_take", True).execute()
        shots.append(ShotSummary(
            id=shot["id"],
            shot_number=shot.get("shot_number", ""),
            description=shot.get("description"),
            frame_size=shot.get("frame_size"),
            camera_movement=shot.get("movement"),
            is_covered=shot.get("is_covered", False),
            circle_take_count=0,  # Would need more complex query
        ))

    # Get locations
    locations = []
    if scene_data.get("location_id"):
        loc_resp = supabase.table("backlot_locations").select("*").eq("id", scene_data["location_id"]).execute()
        if loc_resp.data:
            loc = loc_resp.data[0]
            locations.append(LocationSummary(
                id=loc["id"],
                name=loc.get("name", ""),
                address=loc.get("address"),
                type=loc.get("type"),
                is_primary=True,
            ))

    # Get dailies clips for this scene
    dailies_clips = []
    if scene_data.get("scene_number"):
        clips_resp = supabase.table("backlot_dailies_clips").select("*").eq("project_id", project_id).eq("scene_number", scene_data["scene_number"]).order("take_number").execute()
        dailies_clips = [DailiesClipSummary(
            id=clip["id"],
            file_name=clip.get("file_name", ""),
            scene_number=clip.get("scene_number"),
            take_number=clip.get("take_number"),
            is_circle_take=clip.get("is_circle_take", False),
            rating=clip.get("rating"),
            duration_seconds=clip.get("duration_seconds"),
        ) for clip in (clips_resp.data or [])]

    # Get review notes tagged with this scene (via asset metadata or scene reference)
    review_notes: List[ReviewNoteSummary] = []
    # Review notes would typically be linked via scene_number in metadata
    # This is a simplified approach

    # Get tasks linked to this scene
    tasks = []
    # Tasks might have a scene_id field or metadata linking to scenes
    tasks_resp = supabase.table("backlot_tasks").select("*, profiles:assigned_to(full_name)").eq("project_id", project_id).execute()
    for task in (tasks_resp.data or []):
        # Check if task is linked to this scene (via metadata or title reference)
        meta = task.get("metadata") or {}
        if meta.get("scene_id") == scene_id or (scene_data.get("scene_number") and scene_data["scene_number"] in (task.get("title") or "")):
            assigned_name = None
            if task.get("profiles"):
                assigned_name = task["profiles"].get("full_name")
            tasks.append(TaskSummary(
                id=task["id"],
                title=task.get("title", ""),
                status=task.get("status", "todo"),
                priority=task.get("priority"),
                due_date=task.get("due_date"),
                assigned_to_name=assigned_name,
            ))

    # Build coverage summary
    total_shots = len(shots)
    covered_shots = len([s for s in shots if s.is_covered])
    circle_takes = len([c for c in dailies_clips if c.is_circle_take])

    coverage_summary = {
        "total_shots": total_shots,
        "covered_shots": covered_shots,
        "coverage_percent": round((covered_shots / total_shots * 100) if total_shots > 0 else 0, 1),
        "total_clips": len(dailies_clips),
        "circle_takes": circle_takes,
        "is_shot": scene_data.get("is_shot", False),
        "needs_pickup": scene_data.get("needs_pickup", False),
    }

    return SceneOverview(
        scene=scene,
        breakdown_items=breakdown_items,
        breakdown_by_type=breakdown_by_type,
        shots=shots,
        locations=locations,
        dailies_clips=dailies_clips,
        review_notes=review_notes,
        tasks=tasks,
        coverage_summary=coverage_summary,
    )
