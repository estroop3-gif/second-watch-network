"""
Storyboard API Endpoints
Handles storyboard management, sections, panels, and exports
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import csv
import io

from app.core.database import get_client, execute_query, execute_single

router = APIRouter()

# Valid status values
VALID_STATUSES = {'DRAFT', 'LOCKED'}

# Common shot sizes for reference
SHOT_SIZES = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'OTS', 'POV', 'Insert']
CAMERA_MOVES = ['Static', 'Pan', 'Tilt', 'Dolly', 'Track', 'Crane', 'Handheld', 'Steadicam', 'Zoom']


# =====================================================
# Pydantic Models
# =====================================================

class StoryboardCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    aspect_ratio: Optional[str] = '16:9'


class StoryboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    aspect_ratio: Optional[str] = None
    status: Optional[str] = None


class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1)


class SectionUpdate(BaseModel):
    title: Optional[str] = None


class SectionReorder(BaseModel):
    section_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


class PanelCreate(BaseModel):
    section_id: str
    title: Optional[str] = None
    shot_size: Optional[str] = None
    camera_move: Optional[str] = None
    lens: Optional[str] = None
    framing: Optional[str] = None
    action: Optional[str] = None
    dialogue: Optional[str] = None
    audio: Optional[str] = None
    notes: Optional[str] = None
    duration_seconds: Optional[int] = None
    reference_image_url: Optional[str] = None


class PanelUpdate(BaseModel):
    section_id: Optional[str] = None
    title: Optional[str] = None
    shot_size: Optional[str] = None
    camera_move: Optional[str] = None
    lens: Optional[str] = None
    framing: Optional[str] = None
    action: Optional[str] = None
    dialogue: Optional[str] = None
    audio: Optional[str] = None
    notes: Optional[str] = None
    duration_seconds: Optional[int] = None
    reference_image_url: Optional[str] = None


class PanelReorder(BaseModel):
    panel_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


# =====================================================
# Helper Functions
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        cognito_id = user.get("user_id") or user.get("sub") or user.get("id")
        if not cognito_id:
            raise HTTPException(status_code=401, detail="No user ID in token")

        from app.api.backlot import get_profile_id_from_cognito_id
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        return {"id": profile_id, "user_id": profile_id, "cognito_id": cognito_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_access(project_id: str, user_id: str) -> bool:
    """Verify user has access to the project."""
    client = get_client()

    project = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.data[0]["owner_id"] == user_id:
        return True

    member = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    if member.data:
        return True

    raise HTTPException(status_code=403, detail="Access denied to this project")


async def check_storyboard_locked(storyboard_id: str, user_id: str, project_id: str):
    """Check if storyboard is locked and user is not owner (admin)."""
    client = get_client()

    storyboard = client.table("storyboards").select("status").eq("id", storyboard_id).execute()
    if not storyboard.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    if storyboard.data[0]["status"] == "LOCKED":
        # Check if user is project owner (admin)
        project = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if project.data and project.data[0]["owner_id"] != user_id:
            raise HTTPException(status_code=403, detail="Storyboard is locked")


# =====================================================
# Storyboard Endpoints
# =====================================================

@router.get("/projects/{project_id}/storyboards")
async def list_storyboards(
    project_id: str,
    authorization: str = Header(None)
):
    """List all storyboards for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()
    result = client.table("storyboards").select(
        "id, title, description, aspect_ratio, status, created_at, updated_at"
    ).eq("project_id", project_id).order("created_at", desc=True).execute()

    # Get section and panel counts for each storyboard
    storyboards = []
    for sb in (result.data or []):
        sections = client.table("storyboard_sections").select("id", count="exact").eq("storyboard_id", sb["id"]).execute()
        panels = client.table("storyboard_panels").select("id", count="exact").eq("storyboard_id", sb["id"]).execute()
        sb["section_count"] = sections.count or 0
        sb["panel_count"] = panels.count or 0
        storyboards.append(sb)

    return {"storyboards": storyboards}


@router.post("/projects/{project_id}/storyboards")
async def create_storyboard(
    project_id: str,
    request: StoryboardCreate,
    authorization: str = Header(None)
):
    """Create a new storyboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    storyboard_data = {
        "project_id": project_id,
        "title": request.title,
        "description": request.description,
        "aspect_ratio": request.aspect_ratio or "16:9",
        "status": "DRAFT",
        "created_by_user_id": user["id"]
    }

    result = client.table("storyboards").insert(storyboard_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create storyboard")

    return result.data[0]


@router.get("/projects/{project_id}/storyboards/{storyboard_id}")
async def get_storyboard(
    project_id: str,
    storyboard_id: str,
    authorization: str = Header(None)
):
    """Get a storyboard with all sections and panels."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get storyboard
    storyboard = client.table("storyboards").select("*").eq("id", storyboard_id).eq("project_id", project_id).execute()
    if not storyboard.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    sb = storyboard.data[0]

    # Get sections ordered by sort_order
    sections = client.table("storyboard_sections").select("*").eq("storyboard_id", storyboard_id).order("sort_order").execute()

    # Get panels ordered by sort_order
    panels = client.table("storyboard_panels").select("*").eq("storyboard_id", storyboard_id).order("sort_order").execute()

    # Organize panels by section
    panels_by_section = {}
    for p in (panels.data or []):
        sid = p["section_id"]
        if sid not in panels_by_section:
            panels_by_section[sid] = []
        panels_by_section[sid].append(p)

    # Attach panels to sections
    sections_with_panels = []
    for s in (sections.data or []):
        s["panels"] = panels_by_section.get(s["id"], [])
        sections_with_panels.append(s)

    sb["sections"] = sections_with_panels

    return sb


@router.put("/projects/{project_id}/storyboards/{storyboard_id}")
async def update_storyboard(
    project_id: str,
    storyboard_id: str,
    request: StoryboardUpdate,
    authorization: str = Header(None)
):
    """Update a storyboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify storyboard exists
    existing = client.table("storyboards").select("id, status").eq("id", storyboard_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    # Only allow status changes and title/desc changes if not locked (or if owner)
    if existing.data[0]["status"] == "LOCKED" and request.status != "DRAFT":
        project = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if project.data and project.data[0]["owner_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Storyboard is locked")

    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title
    if request.description is not None:
        update_data["description"] = request.description
    if request.aspect_ratio is not None:
        update_data["aspect_ratio"] = request.aspect_ratio
    if request.status is not None:
        if request.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
        update_data["status"] = request.status

    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = client.table("storyboards").update(update_data).eq("id", storyboard_id).execute()
        return result.data[0] if result.data else {}

    return existing.data[0]


@router.delete("/projects/{project_id}/storyboards/{storyboard_id}")
async def delete_storyboard(
    project_id: str,
    storyboard_id: str,
    authorization: str = Header(None)
):
    """Delete a storyboard and all its sections/panels."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify exists and check ownership for delete
    existing = client.table("storyboards").select("id").eq("id", storyboard_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    # Delete (sections and panels will cascade)
    client.table("storyboards").delete().eq("id", storyboard_id).execute()

    return {"success": True, "deleted_id": storyboard_id}


# =====================================================
# Section Endpoints
# =====================================================

@router.post("/projects/{project_id}/storyboards/{storyboard_id}/sections")
async def create_section(
    project_id: str,
    storyboard_id: str,
    request: SectionCreate,
    authorization: str = Header(None)
):
    """Create a new section in a storyboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    # Get max sort_order
    max_order = client.table("storyboard_sections").select("sort_order").eq("storyboard_id", storyboard_id).order("sort_order", desc=True).limit(1).execute()
    next_order = 0
    if max_order.data:
        next_order = max_order.data[0]["sort_order"] + 1

    section_data = {
        "storyboard_id": storyboard_id,
        "title": request.title,
        "sort_order": next_order
    }

    result = client.table("storyboard_sections").insert(section_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create section")

    return result.data[0]


@router.put("/projects/{project_id}/storyboards/{storyboard_id}/sections/{section_id}")
async def update_section(
    project_id: str,
    storyboard_id: str,
    section_id: str,
    request: SectionUpdate,
    authorization: str = Header(None)
):
    """Update a section."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    existing = client.table("storyboard_sections").select("id").eq("id", section_id).eq("storyboard_id", storyboard_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title

    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = client.table("storyboard_sections").update(update_data).eq("id", section_id).execute()
        return result.data[0] if result.data else {}

    return existing.data[0]


@router.delete("/projects/{project_id}/storyboards/{storyboard_id}/sections/{section_id}")
async def delete_section(
    project_id: str,
    storyboard_id: str,
    section_id: str,
    authorization: str = Header(None)
):
    """Delete a section and all its panels."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    existing = client.table("storyboard_sections").select("id").eq("id", section_id).eq("storyboard_id", storyboard_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Section not found")

    # Delete (panels will cascade)
    client.table("storyboard_sections").delete().eq("id", section_id).execute()

    return {"success": True, "deleted_id": section_id}


@router.post("/projects/{project_id}/storyboards/{storyboard_id}/sections/reorder")
async def reorder_section(
    project_id: str,
    storyboard_id: str,
    request: SectionReorder,
    authorization: str = Header(None)
):
    """Reorder a section within the storyboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    # Get current section
    current = client.table("storyboard_sections").select("id, sort_order").eq("id", request.section_id).eq("storyboard_id", storyboard_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Section not found")

    current_order = current.data[0]["sort_order"]

    # Find adjacent section
    if request.direction == "UP":
        adjacent = client.table("storyboard_sections").select("id, sort_order").eq("storyboard_id", storyboard_id).lt("sort_order", current_order).order("sort_order", desc=True).limit(1).execute()
    else:
        adjacent = client.table("storyboard_sections").select("id, sort_order").eq("storyboard_id", storyboard_id).gt("sort_order", current_order).order("sort_order").limit(1).execute()

    if not adjacent.data:
        return {"success": True, "message": "Already at boundary"}

    # Swap sort_order values
    adjacent_id = adjacent.data[0]["id"]
    adjacent_order = adjacent.data[0]["sort_order"]

    # Use a temporary value to avoid unique constraint
    temp_order = -1
    client.table("storyboard_sections").update({"sort_order": temp_order}).eq("id", request.section_id).execute()
    client.table("storyboard_sections").update({"sort_order": current_order}).eq("id", adjacent_id).execute()
    client.table("storyboard_sections").update({"sort_order": adjacent_order}).eq("id", request.section_id).execute()

    return {"success": True}


# =====================================================
# Panel Endpoints
# =====================================================

@router.post("/projects/{project_id}/storyboards/{storyboard_id}/panels")
async def create_panel(
    project_id: str,
    storyboard_id: str,
    request: PanelCreate,
    authorization: str = Header(None)
):
    """Create a new panel in a section."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    # Verify section exists
    section = client.table("storyboard_sections").select("id").eq("id", request.section_id).eq("storyboard_id", storyboard_id).execute()
    if not section.data:
        raise HTTPException(status_code=404, detail="Section not found")

    # Get max sort_order in section
    max_order = client.table("storyboard_panels").select("sort_order").eq("section_id", request.section_id).order("sort_order", desc=True).limit(1).execute()
    next_order = 0
    if max_order.data:
        next_order = max_order.data[0]["sort_order"] + 1

    panel_data = {
        "storyboard_id": storyboard_id,
        "section_id": request.section_id,
        "sort_order": next_order,
        "title": request.title,
        "shot_size": request.shot_size,
        "camera_move": request.camera_move,
        "lens": request.lens,
        "framing": request.framing,
        "action": request.action,
        "dialogue": request.dialogue,
        "audio": request.audio,
        "notes": request.notes,
        "duration_seconds": request.duration_seconds,
        "reference_image_url": request.reference_image_url
    }

    result = client.table("storyboard_panels").insert(panel_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create panel")

    return result.data[0]


@router.put("/projects/{project_id}/storyboards/{storyboard_id}/panels/{panel_id}")
async def update_panel(
    project_id: str,
    storyboard_id: str,
    panel_id: str,
    request: PanelUpdate,
    authorization: str = Header(None)
):
    """Update a panel."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    existing = client.table("storyboard_panels").select("*").eq("id", panel_id).eq("storyboard_id", storyboard_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Panel not found")

    update_data = {}

    # Handle section move
    if request.section_id is not None and request.section_id != existing.data[0]["section_id"]:
        # Verify new section exists
        new_section = client.table("storyboard_sections").select("id").eq("id", request.section_id).eq("storyboard_id", storyboard_id).execute()
        if not new_section.data:
            raise HTTPException(status_code=404, detail="Target section not found")

        # Get max sort_order in new section
        max_order = client.table("storyboard_panels").select("sort_order").eq("section_id", request.section_id).order("sort_order", desc=True).limit(1).execute()
        new_order = 0
        if max_order.data:
            new_order = max_order.data[0]["sort_order"] + 1

        update_data["section_id"] = request.section_id
        update_data["sort_order"] = new_order

    # Update other fields
    field_map = {
        "title": request.title,
        "shot_size": request.shot_size,
        "camera_move": request.camera_move,
        "lens": request.lens,
        "framing": request.framing,
        "action": request.action,
        "dialogue": request.dialogue,
        "audio": request.audio,
        "notes": request.notes,
        "duration_seconds": request.duration_seconds,
        "reference_image_url": request.reference_image_url
    }

    for field, value in field_map.items():
        if value is not None:
            update_data[field] = value

    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = client.table("storyboard_panels").update(update_data).eq("id", panel_id).execute()
        return result.data[0] if result.data else {}

    return existing.data[0]


@router.delete("/projects/{project_id}/storyboards/{storyboard_id}/panels/{panel_id}")
async def delete_panel(
    project_id: str,
    storyboard_id: str,
    panel_id: str,
    authorization: str = Header(None)
):
    """Delete a panel."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    existing = client.table("storyboard_panels").select("id").eq("id", panel_id).eq("storyboard_id", storyboard_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Panel not found")

    client.table("storyboard_panels").delete().eq("id", panel_id).execute()

    return {"success": True, "deleted_id": panel_id}


@router.post("/projects/{project_id}/storyboards/{storyboard_id}/panels/reorder")
async def reorder_panel(
    project_id: str,
    storyboard_id: str,
    request: PanelReorder,
    authorization: str = Header(None)
):
    """Reorder a panel within its section."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await check_storyboard_locked(storyboard_id, user["id"], project_id)

    client = get_client()

    # Get current panel
    current = client.table("storyboard_panels").select("id, section_id, sort_order").eq("id", request.panel_id).eq("storyboard_id", storyboard_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Panel not found")

    section_id = current.data[0]["section_id"]
    current_order = current.data[0]["sort_order"]

    # Find adjacent panel in same section
    if request.direction == "UP":
        adjacent = client.table("storyboard_panels").select("id, sort_order").eq("section_id", section_id).lt("sort_order", current_order).order("sort_order", desc=True).limit(1).execute()
    else:
        adjacent = client.table("storyboard_panels").select("id, sort_order").eq("section_id", section_id).gt("sort_order", current_order).order("sort_order").limit(1).execute()

    if not adjacent.data:
        return {"success": True, "message": "Already at boundary"}

    # Swap sort_order values
    adjacent_id = adjacent.data[0]["id"]
    adjacent_order = adjacent.data[0]["sort_order"]

    # Use a temporary value to avoid unique constraint
    temp_order = -1
    client.table("storyboard_panels").update({"sort_order": temp_order}).eq("id", request.panel_id).execute()
    client.table("storyboard_panels").update({"sort_order": current_order}).eq("id", adjacent_id).execute()
    client.table("storyboard_panels").update({"sort_order": adjacent_order}).eq("id", request.panel_id).execute()

    return {"success": True}


# =====================================================
# Export Endpoints
# =====================================================

@router.get("/projects/{project_id}/storyboards/{storyboard_id}/export.csv")
async def export_storyboard_csv(
    project_id: str,
    storyboard_id: str,
    authorization: str = Header(None)
):
    """Export storyboard as CSV."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get storyboard
    storyboard = client.table("storyboards").select("title").eq("id", storyboard_id).eq("project_id", project_id).execute()
    if not storyboard.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    sb_title = storyboard.data[0]["title"]

    # Get sections ordered
    sections = client.table("storyboard_sections").select("id, title, sort_order").eq("storyboard_id", storyboard_id).order("sort_order").execute()

    section_map = {s["id"]: s for s in (sections.data or [])}

    # Get panels ordered
    panels = client.table("storyboard_panels").select("*").eq("storyboard_id", storyboard_id).order("sort_order").execute()

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    header = [
        "StoryboardTitle",
        "SectionTitle",
        "PanelOrder",
        "PanelTitle",
        "ShotSize",
        "CameraMove",
        "Lens",
        "Framing",
        "Action",
        "Dialogue",
        "Audio",
        "Notes",
        "DurationSeconds",
        "ReferenceImageUrl"
    ]
    writer.writerow(header)

    # Group panels by section and sort
    panels_by_section = {}
    for p in (panels.data or []):
        sid = p["section_id"]
        if sid not in panels_by_section:
            panels_by_section[sid] = []
        panels_by_section[sid].append(p)

    # Write rows in section order
    panel_index = 1
    for section in (sections.data or []):
        section_panels = panels_by_section.get(section["id"], [])
        section_panels.sort(key=lambda x: x["sort_order"])

        for panel in section_panels:
            row = [
                sb_title,
                section["title"],
                panel_index,
                panel.get("title") or "",
                panel.get("shot_size") or "",
                panel.get("camera_move") or "",
                panel.get("lens") or "",
                panel.get("framing") or "",
                panel.get("action") or "",
                panel.get("dialogue") or "",
                panel.get("audio") or "",
                panel.get("notes") or "",
                panel.get("duration_seconds") or "",
                panel.get("reference_image_url") or ""
            ]
            writer.writerow(row)
            panel_index += 1

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=storyboard_{storyboard_id}.csv"
        }
    )


@router.get("/projects/{project_id}/storyboards/{storyboard_id}/print")
async def get_storyboard_print_data(
    project_id: str,
    storyboard_id: str,
    authorization: str = Header(None)
):
    """Get storyboard data formatted for printing."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project title
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Unknown Project"

    # Get storyboard
    storyboard = client.table("storyboards").select("*").eq("id", storyboard_id).eq("project_id", project_id).execute()
    if not storyboard.data:
        raise HTTPException(status_code=404, detail="Storyboard not found")

    sb = storyboard.data[0]

    # Get sections ordered
    sections = client.table("storyboard_sections").select("*").eq("storyboard_id", storyboard_id).order("sort_order").execute()

    # Get panels ordered
    panels = client.table("storyboard_panels").select("*").eq("storyboard_id", storyboard_id).order("sort_order").execute()

    # Organize panels by section
    panels_by_section = {}
    for p in (panels.data or []):
        sid = p["section_id"]
        if sid not in panels_by_section:
            panels_by_section[sid] = []
        panels_by_section[sid].append(p)

    # Build sections with panels
    sections_with_panels = []
    for s in (sections.data or []):
        s["panels"] = sorted(panels_by_section.get(s["id"], []), key=lambda x: x["sort_order"])
        sections_with_panels.append(s)

    return {
        "project_title": project_title,
        "storyboard": sb,
        "sections": sections_with_panels,
        "exported_at": datetime.utcnow().isoformat()
    }
