"""
Scene View API - Aggregates scene data from multiple sources
Provides a unified view of scenes with breakdown, shots, locations, dailies, review, and tasks
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.database import get_client

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
# SCENE HUB MODELS (Enhanced)
# =============================================================================

class CallSheetLink(BaseModel):
    id: str
    call_sheet_id: str
    call_sheet_title: str
    call_sheet_date: str
    is_published: bool = False
    sequence: int = 0
    status: str = "scheduled"


class BudgetItemSummary(BaseModel):
    id: str
    description: str
    category_name: Optional[str] = None
    rate_amount: float = 0
    quantity: float = 1
    actual_total: float = 0
    vendor_name: Optional[str] = None
    is_from_location: bool = False


class ReceiptSummary(BaseModel):
    id: str
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    purchase_date: Optional[str] = None
    is_verified: bool = False
    is_from_location: bool = False
    file_url: Optional[str] = None


class ClearanceSummary(BaseModel):
    id: str
    type: str
    title: str
    status: str
    related_person_name: Optional[str] = None
    expiration_date: Optional[str] = None
    is_from_location: bool = False
    file_url: Optional[str] = None


class SceneHubData(BaseModel):
    """Comprehensive scene hub data for Scene Detail Page"""
    scene: SceneMetadata
    breakdown_items: List[BreakdownItem] = []
    breakdown_by_type: Dict[str, List[BreakdownItem]] = {}
    shots: List[ShotSummary] = []
    locations: List[LocationSummary] = []
    dailies_clips: List[DailiesClipSummary] = []
    tasks: List[TaskSummary] = []
    coverage_summary: Dict[str, Any] = {}
    # Hub-specific data
    call_sheet_links: List[CallSheetLink] = []
    budget_items: List[BudgetItemSummary] = []
    budget_items_from_location: List[BudgetItemSummary] = []
    receipts: List[ReceiptSummary] = []
    receipts_from_location: List[ReceiptSummary] = []
    clearances: List[ClearanceSummary] = []
    clearances_from_location: List[ClearanceSummary] = []
    # Summary stats
    budget_summary: Dict[str, Any] = {}
    clearance_summary: Dict[str, Any] = {}


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:

        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def get_profile_id_from_cognito_id(client, cognito_user_id: str) -> str:
    """Look up the profile ID from a Cognito user ID."""
    uid_str = str(cognito_user_id)
    # Try cognito_user_id first
    result = client.table("profiles").select("id").eq("cognito_user_id", uid_str).limit(1).execute()
    if result.data:
        return str(result.data[0]["id"])
    # Try id match as fallback
    result = client.table("profiles").select("id").eq("id", uid_str).limit(1).execute()
    if result.data:
        return str(result.data[0]["id"])
    return None


async def verify_project_access(client, project_id: str, user_id: str) -> bool:
    """Verify user has access to project"""
    # Convert Cognito ID to profile ID if needed
    profile_id = get_profile_id_from_cognito_id(client, user_id)
    if not profile_id:
        return False

    # Check owner
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and str(project_resp.data[0]["owner_id"]) == profile_id:
        return True

    # Check membership
    member_resp = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", profile_id).execute()
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
    client = get_client()

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Build query
    query = client.table("backlot_scenes").select("*").eq("project_id", project_id)

    if script_version_id:
        query = query.eq("script_id", script_version_id)

    scenes_resp = query.order("scene_number").execute()
    scenes = scenes_resp.data or []

    # Get counts for each scene
    scene_ids = [s["id"] for s in scenes]

    # Get shot counts
    shot_counts = {}
    if scene_ids:
        shots_resp = client.table("backlot_shots").select("scene_id").in_("scene_id", scene_ids).execute()
        for shot in (shots_resp.data or []):
            scene_id = shot["scene_id"]
            shot_counts[scene_id] = shot_counts.get(scene_id, 0) + 1

    # Get breakdown item counts
    breakdown_counts = {}
    if scene_ids:
        breakdown_resp = client.table("backlot_scene_breakdown_items").select("scene_id").in_("scene_id", scene_ids).execute()
        for item in (breakdown_resp.data or []):
            scene_id = item["scene_id"]
            breakdown_counts[scene_id] = breakdown_counts.get(scene_id, 0) + 1

    # Get dailies clip counts by scene_number
    scene_numbers = [s["scene_number"] for s in scenes if s.get("scene_number")]
    clip_counts = {}
    if scene_numbers:
        clips_resp = client.table("backlot_dailies_clips").select("scene_number").eq("project_id", project_id).in_("scene_number", scene_numbers).execute()
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
        # Build slugline from components if not set
        slugline = scene.get("slugline")
        if not slugline:
            # Construct from int_ext, set_name, time_of_day
            parts = []
            if scene.get("int_ext"):
                parts.append(scene["int_ext"].upper())
            if scene.get("set_name"):
                parts.append(scene["set_name"])
            if scene.get("time_of_day"):
                parts.append(f"- {scene['time_of_day'].upper()}")
            slugline = " ".join(parts) if parts else None

        result.append(SceneListItem(
            id=sid,
            scene_number=scene.get("scene_number", ""),
            slugline=slugline,
            int_ext=scene.get("int_ext"),
            day_night=scene.get("time_of_day"),  # Map time_of_day to day_night
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
    client = get_client()

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get scene metadata
    scene_resp = client.table("backlot_scenes").select("*").eq("id", scene_id).eq("project_id", project_id).execute()
    if not scene_resp.data:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_data = scene_resp.data[0]
    scene = SceneMetadata(**scene_data)

    # Get breakdown items
    breakdown_resp = client.table("backlot_scene_breakdown_items").select("*").eq("scene_id", scene_id).execute()
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
    shots_resp = client.table("backlot_shots").select("*").eq("scene_id", scene_id).order("shot_number").execute()
    shots = []
    for shot in (shots_resp.data or []):
        # Count circle takes for this shot
        circle_takes = client.table("backlot_dailies_clips").select("id").eq("project_id", project_id).eq("is_circle_take", True).execute()
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
        loc_resp = client.table("backlot_locations").select("*").eq("id", scene_data["location_id"]).execute()
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
        clips_resp = client.table("backlot_dailies_clips").select("*").eq("project_id", project_id).eq("scene_number", scene_data["scene_number"]).order("take_number").execute()
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
    tasks_resp = client.table("backlot_tasks").select("*").eq("project_id", project_id).execute()
    for task in (tasks_resp.data or []):
        # Check if task is linked to this scene (via metadata or title reference)
        meta = task.get("metadata") or {}
        if meta.get("scene_id") == scene_id or (scene_data.get("scene_number") and scene_data["scene_number"] in (task.get("title") or "")):
            # Get assigned user name if assigned_to is set
            assigned_name = None
            if task.get("assigned_to"):
                profile_resp = client.table("profiles").select("full_name").eq("id", task["assigned_to"]).execute()
                if profile_resp.data:
                    assigned_name = profile_resp.data[0].get("full_name")
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


@router.get("/projects/{project_id}/scenes/{scene_id}/hub", response_model=SceneHubData)
async def get_scene_hub(
    project_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """
    Get comprehensive scene hub data including all related entities.
    This endpoint supports the Scene Detail Page hub feature.

    Returns:
    - Scene metadata
    - Breakdown items (grouped by type)
    - Shots (from shot list)
    - Locations (attached to scene)
    - Dailies clips (linked by scene_id or scene_number)
    - Tasks (linked to this scene)
    - Call sheet links
    - Budget items (direct + inherited from location)
    - Receipts (direct + inherited from location)
    - Clearances (direct + inherited from location)
    - Coverage and budget summaries
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get scene metadata
    scene_resp = client.table("backlot_scenes").select("*").eq("id", scene_id).eq("project_id", project_id).execute()
    if not scene_resp.data:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_data = scene_resp.data[0]
    location_id = scene_data.get("location_id")
    scene_number = scene_data.get("scene_number")

    # Build slugline from components if not set
    slugline = scene_data.get("slugline")
    if not slugline:
        parts = []
        if scene_data.get("int_ext"):
            parts.append(scene_data["int_ext"].upper())
        if scene_data.get("set_name"):
            parts.append(scene_data["set_name"])
        if scene_data.get("time_of_day"):
            parts.append(f"- {scene_data['time_of_day'].upper()}")
        slugline = " ".join(parts) if parts else None

    scene = SceneMetadata(
        id=str(scene_data["id"]),
        project_id=str(scene_data["project_id"]),
        script_id=str(scene_data["script_id"]) if scene_data.get("script_id") else None,
        scene_number=scene_number or "",
        slugline=slugline,
        int_ext=scene_data.get("int_ext"),
        day_night=scene_data.get("time_of_day"),
        page_length=scene_data.get("page_length"),
        page_start=scene_data.get("page_start"),
        page_end=scene_data.get("page_end"),
        location_hint=scene_data.get("set_name"),
        location_id=str(location_id) if location_id else None,
        is_scheduled=scene_data.get("is_scheduled", False),
        is_shot=scene_data.get("is_shot", False),
        needs_pickup=scene_data.get("needs_pickup", False),
        created_at=str(scene_data.get("created_at")) if scene_data.get("created_at") else None,
        updated_at=str(scene_data.get("updated_at")) if scene_data.get("updated_at") else None,
    )

    # Get breakdown items
    breakdown_resp = client.table("backlot_scene_breakdown_items").select("*").eq("scene_id", scene_id).execute()
    breakdown_items = [BreakdownItem(
        id=str(item["id"]),
        scene_id=str(item["scene_id"]),
        type=item.get("type", "other"),
        name=item.get("name") or item.get("label", ""),
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

    # Get shots from shot list
    shots_resp = client.table("backlot_scene_shots").select("*").eq("scene_id", scene_id).order("sort_order").execute()
    shots = [ShotSummary(
        id=str(shot["id"]),
        shot_number=shot.get("shot_number", ""),
        description=shot.get("description"),
        frame_size=shot.get("shot_type"),
        camera_movement=shot.get("camera_movement"),
        is_covered=shot.get("coverage_status") == "shot",
        circle_take_count=0,
    ) for shot in (shots_resp.data or [])]

    # Get locations
    locations = []
    if location_id:
        loc_resp = client.table("backlot_locations").select("*").eq("id", location_id).execute()
        if loc_resp.data:
            loc = loc_resp.data[0]
            locations.append(LocationSummary(
                id=str(loc["id"]),
                name=loc.get("name", ""),
                address=loc.get("address"),
                type=loc.get("location_type"),
                is_primary=True,
            ))

    # Get dailies clips - by scene_id or scene_number
    dailies_clips = []
    clips_resp = client.table("backlot_dailies_clips").select("*").eq("project_id", project_id).eq("scene_id", scene_id).order("take_number").execute()
    if not clips_resp.data and scene_number:
        # Fallback to scene_number match
        clips_resp = client.table("backlot_dailies_clips").select("*").eq("project_id", project_id).eq("scene_number", scene_number).order("take_number").execute()

    dailies_clips = [DailiesClipSummary(
        id=str(clip["id"]),
        file_name=clip.get("file_name", ""),
        scene_number=clip.get("scene_number"),
        take_number=clip.get("take_number"),
        is_circle_take=clip.get("is_circle_take", False),
        rating=clip.get("rating"),
        duration_seconds=clip.get("duration_seconds"),
    ) for clip in (clips_resp.data or [])]

    # Get tasks linked to this scene
    tasks = []
    tasks_resp = client.table("backlot_tasks").select("*").eq("project_id", project_id).eq("scene_id", scene_id).execute()
    for task in (tasks_resp.data or []):
        # Get assigned user name if assigned_to is set
        assigned_name = None
        if task.get("assigned_to"):
            profile_resp = client.table("profiles").select("full_name").eq("id", task["assigned_to"]).execute()
            if profile_resp.data:
                assigned_name = profile_resp.data[0].get("full_name")
        tasks.append(TaskSummary(
            id=str(task["id"]),
            title=task.get("title", ""),
            status=task.get("status", "todo"),
            priority=task.get("priority"),
            due_date=str(task.get("due_date")) if task.get("due_date") else None,
            assigned_to_name=assigned_name,
        ))

    # Get call sheet links
    call_sheet_links = []
    cs_links_resp = client.table("backlot_call_sheet_scene_links").select("*").eq("scene_id", scene_id).execute()
    for link in (cs_links_resp.data or []):
        # Get call sheet details
        cs_id = link.get("call_sheet_id")
        if cs_id:
            cs_resp = client.table("backlot_call_sheets").select("id, title, date, is_published").eq("id", cs_id).execute()
            if cs_resp.data:
                cs = cs_resp.data[0]
                call_sheet_links.append(CallSheetLink(
                    id=str(link["id"]),
                    call_sheet_id=str(cs.get("id")) if cs.get("id") else "",
                    call_sheet_title=cs.get("title", ""),
                    call_sheet_date=str(cs.get("date")) if cs.get("date") else "",
                    is_published=cs.get("is_published", False),
                    sequence=link.get("sequence", 0),
                    status=link.get("status", "scheduled"),
                ))

    # Get budget items - direct
    budget_items = []
    budget_resp = client.table("backlot_budget_line_items").select("*").eq("project_id", project_id).eq("scene_id", scene_id).execute()
    for item in (budget_resp.data or []):
        # Get category name if category_id is set
        category_name = None
        if item.get("category_id"):
            cat_resp = client.table("backlot_budget_categories").select("name").eq("id", item["category_id"]).execute()
            if cat_resp.data:
                category_name = cat_resp.data[0].get("name")
        budget_items.append(BudgetItemSummary(
            id=str(item["id"]),
            description=item.get("description", ""),
            category_name=category_name,
            rate_amount=float(item.get("rate_amount") or 0),
            quantity=float(item.get("quantity") or 1),
            actual_total=float(item.get("actual_total") or 0),
            vendor_name=item.get("vendor_name"),
            is_from_location=False,
        ))

    # Get budget items - from location
    budget_items_from_location = []
    if location_id:
        loc_budget_resp = client.table("backlot_budget_line_items").select("*").eq("project_id", project_id).eq("location_id", location_id).execute()
        for item in (loc_budget_resp.data or []):
            # Don't duplicate items already linked to scene
            if item.get("scene_id") != scene_id:
                # Get category name if category_id is set
                category_name = None
                if item.get("category_id"):
                    cat_resp = client.table("backlot_budget_categories").select("name").eq("id", item["category_id"]).execute()
                    if cat_resp.data:
                        category_name = cat_resp.data[0].get("name")
                budget_items_from_location.append(BudgetItemSummary(
                    id=str(item["id"]),
                    description=item.get("description", ""),
                    category_name=category_name,
                    rate_amount=float(item.get("rate_amount") or 0),
                    quantity=float(item.get("quantity") or 1),
                    actual_total=float(item.get("actual_total") or 0),
                    vendor_name=item.get("vendor_name"),
                    is_from_location=True,
                ))

    # Get receipts - direct
    receipts = []
    receipts_resp = client.table("backlot_receipts").select("*").eq("project_id", project_id).eq("scene_id", scene_id).execute()
    for r in (receipts_resp.data or []):
        receipts.append(ReceiptSummary(
            id=str(r["id"]),
            vendor_name=r.get("vendor_name"),
            description=r.get("description"),
            amount=float(r.get("amount")) if r.get("amount") else None,
            purchase_date=str(r.get("purchase_date")) if r.get("purchase_date") else None,
            is_verified=r.get("is_verified", False),
            is_from_location=False,
            file_url=r.get("file_url"),
        ))

    # Get receipts - from location
    receipts_from_location = []
    if location_id:
        loc_receipts_resp = client.table("backlot_receipts").select("*").eq("project_id", project_id).eq("location_id", location_id).execute()
        for r in (loc_receipts_resp.data or []):
            if r.get("scene_id") != scene_id:
                receipts_from_location.append(ReceiptSummary(
                    id=str(r["id"]),
                    vendor_name=r.get("vendor_name"),
                    description=r.get("description"),
                    amount=float(r.get("amount")) if r.get("amount") else None,
                    purchase_date=str(r.get("purchase_date")) if r.get("purchase_date") else None,
                    is_verified=r.get("is_verified", False),
                    is_from_location=True,
                    file_url=r.get("file_url"),
                ))

    # Get clearances - direct
    clearances = []
    clearances_resp = client.table("backlot_clearance_items").select("*").eq("project_id", project_id).eq("scene_id", scene_id).execute()
    for c in (clearances_resp.data or []):
        clearances.append(ClearanceSummary(
            id=str(c["id"]),
            type=c.get("type", "other_contract"),
            title=c.get("title", ""),
            status=c.get("status", "not_started"),
            related_person_name=c.get("related_person_name"),
            expiration_date=str(c.get("expiration_date")) if c.get("expiration_date") else None,
            is_from_location=False,
            file_url=c.get("file_url"),
        ))

    # Get clearances - from location
    clearances_from_location = []
    if location_id:
        loc_clearances_resp = client.table("backlot_clearance_items").select("*").eq("project_id", project_id).eq("related_location_id", location_id).execute()
        for c in (loc_clearances_resp.data or []):
            if c.get("scene_id") != scene_id:
                clearances_from_location.append(ClearanceSummary(
                    id=str(c["id"]),
                    type=c.get("type", "other_contract"),
                    title=c.get("title", ""),
                    status=c.get("status", "not_started"),
                    related_person_name=c.get("related_person_name"),
                    expiration_date=str(c.get("expiration_date")) if c.get("expiration_date") else None,
                    is_from_location=True,
                    file_url=c.get("file_url"),
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

    # Build budget summary
    all_budget = budget_items + budget_items_from_location
    total_estimated = sum(b.rate_amount * b.quantity for b in all_budget)
    total_actual = sum(b.actual_total for b in all_budget)
    all_receipts = receipts + receipts_from_location
    total_receipts = sum(r.amount or 0 for r in all_receipts)

    budget_summary = {
        "total_items": len(all_budget),
        "total_estimated": total_estimated,
        "total_actual": total_actual,
        "total_receipts": total_receipts,
        "receipts_count": len(all_receipts),
    }

    # Build clearance summary
    all_clearances = clearances + clearances_from_location
    signed_count = len([c for c in all_clearances if c.status == "signed"])
    pending_count = len([c for c in all_clearances if c.status in ("not_started", "requested")])

    clearance_summary = {
        "total_items": len(all_clearances),
        "signed_count": signed_count,
        "pending_count": pending_count,
        "completion_percent": round((signed_count / len(all_clearances) * 100) if all_clearances else 0, 1),
    }

    return SceneHubData(
        scene=scene,
        breakdown_items=breakdown_items,
        breakdown_by_type=breakdown_by_type,
        shots=shots,
        locations=locations,
        dailies_clips=dailies_clips,
        tasks=tasks,
        coverage_summary=coverage_summary,
        call_sheet_links=call_sheet_links,
        budget_items=budget_items,
        budget_items_from_location=budget_items_from_location,
        receipts=receipts,
        receipts_from_location=receipts_from_location,
        clearances=clearances,
        clearances_from_location=clearances_from_location,
        budget_summary=budget_summary,
        clearance_summary=clearance_summary,
    )
