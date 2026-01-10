"""
Stripboard API Endpoints
Production schedule planning board where scenes become strips assigned to days
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import csv
import io
import json

from app.core.database import get_client, execute_query, execute_single

router = APIRouter()


# =====================================================
# Pydantic Models
# =====================================================

class StripboardCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None


class StripboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class StripCreate(BaseModel):
    script_scene_id: Optional[str] = None
    custom_title: Optional[str] = None
    unit: str = Field(default='A')
    notes: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None


class StripUpdate(BaseModel):
    assigned_day_id: Optional[str] = None  # Use empty string to unassign (move to bank)
    custom_title: Optional[str] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None


class StripReorder(BaseModel):
    strip_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


# =====================================================
# Helper Functions
# =====================================================

async def verify_project_access(project_id: str, user_id: str) -> dict:
    """Verify user has access to project and return profile ID"""
    # Get profile ID from Cognito user ID
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :user_id",
        {"user_id": user_id}
    )
    if not profile:
        raise HTTPException(status_code=401, detail="Profile not found")

    profile_id = profile['id']

    # Check project access
    access = execute_single("""
        SELECT bp.id, bpm.role
        FROM backlot_projects bp
        LEFT JOIN backlot_project_members bpm ON bpm.project_id = bp.id AND bpm.user_id = :profile_id
        WHERE bp.id = :project_id
        AND (bp.owner_id = :profile_id OR bpm.user_id IS NOT NULL)
    """, {"project_id": project_id, "profile_id": profile_id})

    if not access:
        raise HTTPException(status_code=403, detail="No access to this project")

    return {"profile_id": profile_id, "role": access.get('role')}


async def get_active_stripboard(project_id: str) -> Optional[dict]:
    """Get the active stripboard for a project"""
    return execute_single("""
        SELECT id, project_id, title, description, is_active,
               created_by_user_id, created_at, updated_at
        FROM backlot_stripboards
        WHERE project_id = :project_id AND is_active = true
    """, {"project_id": project_id})


async def recompact_bucket(stripboard_id: str, assigned_day_id: Optional[str]):
    """Recompact sort_order values for strips in a bucket (day or bank)"""
    if assigned_day_id:
        strips = execute_query("""
            SELECT id FROM backlot_strips
            WHERE stripboard_id = :stripboard_id AND assigned_day_id = :day_id
            ORDER BY sort_order
        """, {"stripboard_id": stripboard_id, "day_id": assigned_day_id})
    else:
        strips = execute_query("""
            SELECT id FROM backlot_strips
            WHERE stripboard_id = :stripboard_id AND assigned_day_id IS NULL
            ORDER BY sort_order
        """, {"stripboard_id": stripboard_id})

    client = get_client()
    for i, strip in enumerate(strips):
        client.table("backlot_strips").update({
            "sort_order": i + 1
        }).eq("id", strip['id']).execute()


async def get_next_sort_order(stripboard_id: str, assigned_day_id: Optional[str]) -> int:
    """Get the next sort order for a bucket"""
    if assigned_day_id:
        result = execute_single("""
            SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
            FROM backlot_strips
            WHERE stripboard_id = :stripboard_id AND assigned_day_id = :day_id
        """, {"stripboard_id": stripboard_id, "day_id": assigned_day_id})
    else:
        result = execute_single("""
            SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
            FROM backlot_strips
            WHERE stripboard_id = :stripboard_id AND assigned_day_id IS NULL
        """, {"stripboard_id": stripboard_id})

    return result['next_order'] if result else 1


# =====================================================
# Stripboard CRUD Endpoints
# =====================================================

@router.get("/projects/{project_id}/stripboard")
async def get_active_stripboard_endpoint(
    project_id: str,
    authorization: str = Header(...)
):
    """Get the active stripboard for a project with summary counts"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    stripboard = await get_active_stripboard(project_id)

    if not stripboard:
        return {"stripboard": None, "counts": {"total": 0, "bank": 0, "scheduled": 0}}

    # Get counts
    counts = execute_single("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE assigned_day_id IS NULL) as bank,
            COUNT(*) FILTER (WHERE assigned_day_id IS NOT NULL) as scheduled
        FROM backlot_strips
        WHERE stripboard_id = :stripboard_id
    """, {"stripboard_id": stripboard['id']})

    return {
        "stripboard": stripboard,
        "counts": {
            "total": counts['total'] if counts else 0,
            "bank": counts['bank'] if counts else 0,
            "scheduled": counts['scheduled'] if counts else 0
        }
    }


@router.post("/projects/{project_id}/stripboard")
async def create_stripboard(
    project_id: str,
    data: StripboardCreate,
    authorization: str = Header(...)
):
    """Create a new stripboard, deactivating any existing active stripboard"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    access = await verify_project_access(project_id, user_id)
    profile_id = access['profile_id']

    client = get_client()

    # Deactivate any existing active stripboard
    client.table("backlot_stripboards").update({
        "is_active": False
    }).eq("project_id", project_id).eq("is_active", True).execute()

    # Create new stripboard
    result = client.table("backlot_stripboards").insert({
        "project_id": project_id,
        "title": data.title,
        "description": data.description,
        "is_active": True,
        "created_by_user_id": profile_id
    }).execute()

    return result.data[0] if result.data else None


@router.put("/projects/{project_id}/stripboard/{stripboard_id}")
async def update_stripboard(
    project_id: str,
    stripboard_id: str,
    data: StripboardUpdate,
    authorization: str = Header(...)
):
    """Update a stripboard"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    update_data = {}
    if data.title is not None:
        update_data['title'] = data.title
    if data.description is not None:
        update_data['description'] = data.description
    if data.is_active is not None:
        # If activating this stripboard, deactivate others first
        if data.is_active:
            client = get_client()
            client.table("backlot_stripboards").update({
                "is_active": False
            }).eq("project_id", project_id).eq("is_active", True).neq("id", stripboard_id).execute()
        update_data['is_active'] = data.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    client = get_client()
    result = client.table("backlot_stripboards").update(update_data).eq("id", stripboard_id).execute()

    return result.data[0] if result.data else None


# =====================================================
# Stripboard View Endpoint
# =====================================================

@router.get("/projects/{project_id}/stripboard/{stripboard_id}/view")
async def get_stripboard_view(
    project_id: str,
    stripboard_id: str,
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    authorization: str = Header(...)
):
    """
    Get full stripboard view with:
    - Bank strips (unscheduled)
    - Day columns with strips
    - Derived cast from scenes per day
    - DOOD working cast per day
    - Cast mismatch info
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Verify stripboard exists
    stripboard = execute_single("""
        SELECT * FROM backlot_stripboards WHERE id = :id AND project_id = :project_id
    """, {"id": stripboard_id, "project_id": project_id})

    if not stripboard:
        raise HTTPException(status_code=404, detail="Stripboard not found")

    # Build date filter - limit to 31 days max
    date_filter = ""
    date_params = {"project_id": project_id, "stripboard_id": stripboard_id}

    if start and end:
        # Validate and clamp date range
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d").date()
            end_date = datetime.strptime(end, "%Y-%m-%d").date()
            if (end_date - start_date).days > 31:
                end_date = start_date + timedelta(days=31)
            date_filter = "AND pd.date >= :start AND pd.date <= :end"
            date_params["start"] = start
            date_params["end"] = str(end_date)
        except ValueError:
            pass

    # Get production days in range
    days = execute_query(f"""
        SELECT id, project_id, day_number, date, title, day_type, general_call_time
        FROM backlot_production_days pd
        WHERE pd.project_id = :project_id
        {date_filter}
        ORDER BY pd.date
    """, date_params)

    # Get bank strips (unscheduled)
    bank_strips = execute_query("""
        SELECT s.*,
               ss.scene_number, ss.slugline, ss.location, ss.time_of_day,
               ss.raw_scene_text, ss.characters
        FROM backlot_strips s
        LEFT JOIN backlot_script_scenes ss ON ss.id = s.script_scene_id
        WHERE s.stripboard_id = :stripboard_id AND s.assigned_day_id IS NULL
        ORDER BY s.sort_order
    """, {"stripboard_id": stripboard_id})

    # Get all strips for days
    all_day_strips = execute_query("""
        SELECT s.*,
               ss.scene_number, ss.slugline, ss.location, ss.time_of_day,
               ss.raw_scene_text, ss.characters
        FROM backlot_strips s
        LEFT JOIN backlot_script_scenes ss ON ss.id = s.script_scene_id
        WHERE s.stripboard_id = :stripboard_id AND s.assigned_day_id IS NOT NULL
        ORDER BY s.assigned_day_id, s.sort_order
    """, {"stripboard_id": stripboard_id})

    # Group strips by day
    strips_by_day = {}
    for strip in all_day_strips:
        day_id = strip['assigned_day_id']
        if day_id not in strips_by_day:
            strips_by_day[day_id] = []
        strips_by_day[day_id].append(strip)

    # Get DOOD working cast for each day (subjects with 'W' code assignments)
    dood_work_by_day = {}
    if days:
        day_ids = [d['id'] for d in days]
        dood_assignments = execute_query("""
            SELECT da.day_id, ds.id as subject_id, ds.display_name, ds.subject_type
            FROM dood_assignments da
            JOIN dood_subjects ds ON ds.id = da.subject_id
            WHERE da.project_id = :project_id
            AND da.day_id = ANY(:day_ids)
            AND da.code = 'W'
            AND ds.subject_type = 'CAST'
        """, {"project_id": project_id, "day_ids": day_ids})

        for assignment in dood_assignments:
            day_id = assignment['day_id']
            if day_id not in dood_work_by_day:
                dood_work_by_day[day_id] = []
            dood_work_by_day[day_id].append(assignment['display_name'])

    # Build day columns with cast comparison
    day_columns = []
    for day in days:
        day_id = day['id']
        day_strips = strips_by_day.get(day_id, [])

        # Derive cast from strips' scenes characters
        derived_cast = set()
        for strip in day_strips:
            characters = strip.get('characters')
            if characters:
                if isinstance(characters, str):
                    try:
                        characters = json.loads(characters)
                    except:
                        characters = []
                for char in characters:
                    derived_cast.add(char)

        derived_cast = sorted(list(derived_cast))
        dood_work_cast = sorted(dood_work_by_day.get(day_id, []))

        # Compute mismatches (case-insensitive comparison)
        derived_cast_lower = {c.lower() for c in derived_cast}
        dood_work_cast_lower = {c.lower() for c in dood_work_cast}

        # Characters in scenes but not working (case-insensitive)
        needed_but_not_working = [c for c in derived_cast if c.lower() not in dood_work_cast_lower]
        # Working but not in scenes
        working_but_not_needed = [c for c in dood_work_cast if c.lower() not in derived_cast_lower]

        day_columns.append({
            "day": day,
            "strips": day_strips,
            "strip_count": len(day_strips),
            "derived_cast": derived_cast,
            "dood_work_cast": dood_work_cast,
            "cast_mismatch": {
                "has_mismatch": len(needed_but_not_working) > 0 or len(working_but_not_needed) > 0,
                "needed_but_not_working": needed_but_not_working,
                "working_but_not_needed": working_but_not_needed
            }
        })

    return {
        "stripboard": stripboard,
        "bank_strips": bank_strips,
        "day_columns": day_columns
    }


# =====================================================
# Generate Strips from Script
# =====================================================

@router.post("/projects/{project_id}/stripboard/{stripboard_id}/generate-from-script")
async def generate_strips_from_script(
    project_id: str,
    stripboard_id: str,
    authorization: str = Header(...)
):
    """
    Generate strips from all ScriptScene rows for the active script document.
    Idempotent: won't duplicate strips for scenes that already have strips.
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Verify stripboard exists
    stripboard = execute_single("""
        SELECT * FROM backlot_stripboards WHERE id = :id AND project_id = :project_id
    """, {"id": stripboard_id, "project_id": project_id})

    if not stripboard:
        raise HTTPException(status_code=404, detail="Stripboard not found")

    # Get active script document
    script_doc = execute_single("""
        SELECT id FROM backlot_script_documents
        WHERE project_id = :project_id AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
    """, {"project_id": project_id})

    if not script_doc:
        raise HTTPException(status_code=404, detail="No active script document found")

    # Get all scenes from the script
    scenes = execute_query("""
        SELECT id, scene_number, slugline
        FROM backlot_script_scenes
        WHERE script_document_id = :doc_id
        ORDER BY scene_number
    """, {"doc_id": script_doc['id']})

    if not scenes:
        return {"created": 0, "skipped": 0, "message": "No scenes found in script"}

    # Get existing strips for these scenes
    existing = execute_query("""
        SELECT script_scene_id FROM backlot_strips
        WHERE stripboard_id = :stripboard_id AND script_scene_id IS NOT NULL
    """, {"stripboard_id": stripboard_id})

    existing_scene_ids = {e['script_scene_id'] for e in existing}

    # Create strips for scenes that don't have them
    client = get_client()
    created = 0
    skipped = 0

    # Get current max sort order for bank
    current_order = await get_next_sort_order(stripboard_id, None)

    for scene in scenes:
        if scene['id'] in existing_scene_ids:
            skipped += 1
            continue

        client.table("backlot_strips").insert({
            "project_id": project_id,
            "stripboard_id": stripboard_id,
            "script_scene_id": scene['id'],
            "unit": "A",
            "sort_order": current_order,
            "status": "PLANNED"
        }).execute()

        current_order += 1
        created += 1

    return {
        "created": created,
        "skipped": skipped,
        "message": f"Created {created} strips, skipped {skipped} existing"
    }


# =====================================================
# Strip CRUD Endpoints
# =====================================================

@router.post("/projects/{project_id}/stripboard/{stripboard_id}/strips")
async def create_strip(
    project_id: str,
    stripboard_id: str,
    data: StripCreate,
    authorization: str = Header(...)
):
    """Create a new strip in the bank (unscheduled)"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Verify stripboard
    stripboard = execute_single("""
        SELECT * FROM backlot_stripboards WHERE id = :id AND project_id = :project_id
    """, {"id": stripboard_id, "project_id": project_id})

    if not stripboard:
        raise HTTPException(status_code=404, detail="Stripboard not found")

    # Validate: need either script_scene_id or custom_title
    if not data.script_scene_id and not data.custom_title:
        raise HTTPException(status_code=400, detail="Either script_scene_id or custom_title is required")

    # If script_scene_id provided, verify it exists
    if data.script_scene_id:
        scene = execute_single("""
            SELECT id FROM backlot_script_scenes
            WHERE id = :id AND project_id = :project_id
        """, {"id": data.script_scene_id, "project_id": project_id})
        if not scene:
            raise HTTPException(status_code=404, detail="Script scene not found")

    # Get next sort order for bank
    sort_order = await get_next_sort_order(stripboard_id, None)

    client = get_client()
    result = client.table("backlot_strips").insert({
        "project_id": project_id,
        "stripboard_id": stripboard_id,
        "script_scene_id": data.script_scene_id,
        "custom_title": data.custom_title,
        "unit": data.unit,
        "sort_order": sort_order,
        "notes": data.notes,
        "estimated_duration_minutes": data.estimated_duration_minutes,
        "status": "PLANNED"
    }).execute()

    return result.data[0] if result.data else None


@router.put("/projects/{project_id}/stripboard/{stripboard_id}/strips/{strip_id}")
async def update_strip(
    project_id: str,
    stripboard_id: str,
    strip_id: str,
    data: StripUpdate,
    authorization: str = Header(...)
):
    """
    Update a strip. If assigned_day_id changes:
    - Remove from old bucket and recompact
    - Append to end of new bucket
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get current strip
    current = execute_single("""
        SELECT * FROM backlot_strips
        WHERE id = :id AND stripboard_id = :stripboard_id
    """, {"id": strip_id, "stripboard_id": stripboard_id})

    if not current:
        raise HTTPException(status_code=404, detail="Strip not found")

    update_data = {}

    # Handle day assignment change
    if data.assigned_day_id is not None:
        old_day_id = current['assigned_day_id']
        # Empty string means move to bank
        new_day_id = data.assigned_day_id if data.assigned_day_id != '' else None

        if old_day_id != new_day_id:
            # Verify new day exists (if not moving to bank)
            if new_day_id:
                day = execute_single("""
                    SELECT id FROM backlot_production_days
                    WHERE id = :id AND project_id = :project_id
                """, {"id": new_day_id, "project_id": project_id})
                if not day:
                    raise HTTPException(status_code=404, detail="Production day not found")

            # Get new sort order
            new_sort_order = await get_next_sort_order(stripboard_id, new_day_id)
            update_data['assigned_day_id'] = new_day_id
            update_data['sort_order'] = new_sort_order

            # We'll recompact old bucket after update

    if data.custom_title is not None:
        update_data['custom_title'] = data.custom_title
    if data.unit is not None:
        update_data['unit'] = data.unit
    if data.status is not None:
        update_data['status'] = data.status
    if data.notes is not None:
        update_data['notes'] = data.notes
    if data.estimated_duration_minutes is not None:
        update_data['estimated_duration_minutes'] = data.estimated_duration_minutes

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    client = get_client()
    result = client.table("backlot_strips").update(update_data).eq("id", strip_id).execute()

    # Recompact old bucket if day changed
    if data.assigned_day_id is not None:
        old_day_id = current['assigned_day_id']
        new_day_id = data.assigned_day_id if data.assigned_day_id != '' else None
        if old_day_id != new_day_id:
            await recompact_bucket(stripboard_id, old_day_id)

    return result.data[0] if result.data else None


@router.delete("/projects/{project_id}/stripboard/{stripboard_id}/strips/{strip_id}")
async def delete_strip(
    project_id: str,
    stripboard_id: str,
    strip_id: str,
    authorization: str = Header(...)
):
    """Delete a strip and recompact bucket"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get current strip to know bucket
    current = execute_single("""
        SELECT assigned_day_id FROM backlot_strips
        WHERE id = :id AND stripboard_id = :stripboard_id
    """, {"id": strip_id, "stripboard_id": stripboard_id})

    if not current:
        raise HTTPException(status_code=404, detail="Strip not found")

    bucket_day_id = current['assigned_day_id']

    client = get_client()
    client.table("backlot_strips").delete().eq("id", strip_id).execute()

    # Recompact bucket
    await recompact_bucket(stripboard_id, bucket_day_id)

    return {"success": True}


# =====================================================
# Strip Reorder Endpoint
# =====================================================

@router.post("/projects/{project_id}/stripboard/{stripboard_id}/strips/reorder")
async def reorder_strip(
    project_id: str,
    stripboard_id: str,
    data: StripReorder,
    authorization: str = Header(...)
):
    """
    Move a strip up or down within its bucket (same day or bank).
    Swaps sort_order with adjacent strip.
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get the strip
    strip = execute_single("""
        SELECT id, assigned_day_id, sort_order
        FROM backlot_strips
        WHERE id = :id AND stripboard_id = :stripboard_id
    """, {"id": data.strip_id, "stripboard_id": stripboard_id})

    if not strip:
        raise HTTPException(status_code=404, detail="Strip not found")

    current_order = strip['sort_order']
    day_id = strip['assigned_day_id']

    # Find adjacent strip
    if data.direction == 'UP':
        # Find strip with next lower sort_order
        if day_id:
            adjacent = execute_single("""
                SELECT id, sort_order FROM backlot_strips
                WHERE stripboard_id = :stripboard_id
                AND assigned_day_id = :day_id
                AND sort_order < :current_order
                ORDER BY sort_order DESC
                LIMIT 1
            """, {"stripboard_id": stripboard_id, "day_id": day_id, "current_order": current_order})
        else:
            adjacent = execute_single("""
                SELECT id, sort_order FROM backlot_strips
                WHERE stripboard_id = :stripboard_id
                AND assigned_day_id IS NULL
                AND sort_order < :current_order
                ORDER BY sort_order DESC
                LIMIT 1
            """, {"stripboard_id": stripboard_id, "current_order": current_order})
    else:  # DOWN
        # Find strip with next higher sort_order
        if day_id:
            adjacent = execute_single("""
                SELECT id, sort_order FROM backlot_strips
                WHERE stripboard_id = :stripboard_id
                AND assigned_day_id = :day_id
                AND sort_order > :current_order
                ORDER BY sort_order ASC
                LIMIT 1
            """, {"stripboard_id": stripboard_id, "day_id": day_id, "current_order": current_order})
        else:
            adjacent = execute_single("""
                SELECT id, sort_order FROM backlot_strips
                WHERE stripboard_id = :stripboard_id
                AND assigned_day_id IS NULL
                AND sort_order > :current_order
                ORDER BY sort_order ASC
                LIMIT 1
            """, {"stripboard_id": stripboard_id, "current_order": current_order})

    if not adjacent:
        # Already at edge, no swap needed
        return {"success": True, "message": "Already at edge of list"}

    # Swap sort_order using temporary value to avoid unique constraint
    client = get_client()
    temp_order = 999999

    # Move current to temp
    client.table("backlot_strips").update({"sort_order": temp_order}).eq("id", strip['id']).execute()
    # Move adjacent to current's position
    client.table("backlot_strips").update({"sort_order": current_order}).eq("id", adjacent['id']).execute()
    # Move current to adjacent's position
    client.table("backlot_strips").update({"sort_order": adjacent['sort_order']}).eq("id", strip['id']).execute()

    return {"success": True}


# =====================================================
# CSV Export Endpoint
# =====================================================

@router.get("/projects/{project_id}/stripboard/{stripboard_id}/export.csv")
async def export_stripboard_csv(
    project_id: str,
    stripboard_id: str,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    authorization: str = Header(...)
):
    """
    Export stripboard as CSV.
    Columns: Date, DayType, StripOrder, SceneNumber, Slugline, Unit, Status, EstimatedDurationMinutes, Notes
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Verify stripboard
    stripboard = execute_single("""
        SELECT title FROM backlot_stripboards WHERE id = :id AND project_id = :project_id
    """, {"id": stripboard_id, "project_id": project_id})

    if not stripboard:
        raise HTTPException(status_code=404, detail="Stripboard not found")

    # Build date filter
    date_filter = ""
    date_params = {"stripboard_id": stripboard_id, "project_id": project_id}

    if start and end:
        date_filter = "AND pd.date >= :start AND pd.date <= :end"
        date_params["start"] = start
        date_params["end"] = end

    # Get all strips with day info
    strips = execute_query(f"""
        SELECT
            s.sort_order,
            s.unit,
            s.status,
            s.notes,
            s.estimated_duration_minutes,
            s.custom_title,
            ss.scene_number,
            ss.slugline,
            pd.date,
            pd.day_type
        FROM backlot_strips s
        LEFT JOIN backlot_script_scenes ss ON ss.id = s.script_scene_id
        LEFT JOIN backlot_production_days pd ON pd.id = s.assigned_day_id
        WHERE s.stripboard_id = :stripboard_id
        {f"AND (s.assigned_day_id IS NULL OR (pd.id IS NOT NULL {date_filter}))" if date_filter else ""}
        ORDER BY
            CASE WHEN s.assigned_day_id IS NULL THEN 0 ELSE 1 END,
            pd.date NULLS FIRST,
            s.sort_order
    """, date_params)

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'DayType', 'StripOrder', 'SceneNumber', 'Slugline', 'Unit', 'Status', 'EstimatedDurationMinutes', 'Notes'])

    for strip in strips:
        date_val = 'BANK' if not strip['date'] else strip['date']
        day_type = '' if not strip['day_type'] else strip['day_type']
        scene_number = strip['scene_number'] or ''
        slugline = strip['custom_title'] or strip['slugline'] or ''

        writer.writerow([
            date_val,
            day_type,
            strip['sort_order'],
            scene_number,
            slugline,
            strip['unit'],
            strip['status'],
            strip['estimated_duration_minutes'] or '',
            strip['notes'] or ''
        ])

    csv_content = output.getvalue()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={stripboard['title'].replace(' ', '_')}_stripboard.csv"
        }
    )


# =====================================================
# Print Data Endpoint
# =====================================================

@router.get("/projects/{project_id}/stripboard/{stripboard_id}/print")
async def get_stripboard_print_data(
    project_id: str,
    stripboard_id: str,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    authorization: str = Header(...)
):
    """
    Get data for printable stripboard view.
    Returns all necessary data for rendering print page.
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get project title
    project = execute_single("""
        SELECT title FROM backlot_projects WHERE id = :id
    """, {"id": project_id})

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get stripboard
    stripboard = execute_single("""
        SELECT * FROM backlot_stripboards WHERE id = :id AND project_id = :project_id
    """, {"id": stripboard_id, "project_id": project_id})

    if not stripboard:
        raise HTTPException(status_code=404, detail="Stripboard not found")

    # Use the view endpoint logic
    view_data = await get_stripboard_view(project_id, stripboard_id, start, end, f"Bearer {token}")

    return {
        "project_title": project['title'],
        "stripboard": stripboard,
        "bank_strips": view_data['bank_strips'],
        "day_columns": view_data['day_columns'],
        "generated_at": datetime.utcnow().isoformat()
    }
