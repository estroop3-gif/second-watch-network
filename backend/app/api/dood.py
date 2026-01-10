"""
Day Out of Days (DOOD) API Endpoints
Handles DOOD grid management, subjects, assignments, publishing, and CSV export
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import json
import csv
import io

from app.core.database import get_client, execute_query, execute_single

router = APIRouter()

# Valid DOOD codes
VALID_CODES = {'W', 'H', 'T', 'R', 'F', 'S', 'P', 'O', 'D'}
CODE_LABELS = {
    'W': 'Work',
    'H': 'Hold',
    'T': 'Travel',
    'R': 'Rehearsal',
    'F': 'Fitting',
    'S': 'Tech Scout',
    'P': 'Pickup',
    'O': 'Off',
    'D': 'Drop'
}

VALID_SUBJECT_TYPES = {'CAST', 'BACKGROUND', 'CREW', 'OTHER'}
VALID_DAY_TYPES = {'SHOOT', 'TRAVEL', 'REHEARSAL', 'FITTING', 'TECH_SCOUT', 'PICKUP', 'HOLD', 'DARK'}


# =====================================================
# Pydantic Models
# =====================================================

class SubjectCreate(BaseModel):
    display_name: str = Field(..., min_length=1)
    subject_type: str = Field(..., pattern='^(CAST|BACKGROUND|CREW|OTHER)$')
    department: Optional[str] = None
    notes: Optional[str] = None


class SubjectUpdate(BaseModel):
    display_name: Optional[str] = None
    subject_type: Optional[str] = None
    department: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class AssignmentUpsert(BaseModel):
    subject_id: str
    day_id: str
    code: Optional[str] = None  # None or empty string to delete
    notes: Optional[str] = None


class GenerateDaysRequest(BaseModel):
    start: str  # YYYY-MM-DD
    end: str    # YYYY-MM-DD


class PublishRequest(BaseModel):
    start: str  # YYYY-MM-DD
    end: str    # YYYY-MM-DD


# =====================================================
# Helper Functions
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token using AWS Cognito."""
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

        # Import here to avoid circular imports
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
    """Verify user has access to the project (owner or team member)."""
    client = get_client()

    # Check if owner
    project = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.data[0]["owner_id"] == user_id:
        return True

    # Check if team member
    member = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    if member.data:
        return True

    raise HTTPException(status_code=403, detail="Access denied to this project")


def parse_date(date_str: str) -> date:
    """Parse YYYY-MM-DD string to date object."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {date_str}. Use YYYY-MM-DD")


def validate_date_range(start: date, end: date, max_days: int = 31):
    """Validate date range doesn't exceed maximum."""
    if end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    days_diff = (end - start).days + 1
    if days_diff > max_days:
        raise HTTPException(status_code=400, detail=f"Date range cannot exceed {max_days} days. Requested: {days_diff} days")


# =====================================================
# API Endpoints
# =====================================================

@router.get("/projects/{project_id}/dood/range")
async def get_dood_range(
    project_id: str,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    authorization: str = Header(None)
):
    """
    Get DOOD data for a date range.
    Returns days, subjects, assignments, and latest published version info.
    """
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    start_date = parse_date(start)
    end_date = parse_date(end)
    validate_date_range(start_date, end_date)

    client = get_client()

    # Get days in range
    days_result = client.table("backlot_production_days").select(
        "id, date, day_number, title, day_type, notes"
    ).eq("project_id", project_id).gte("date", start).lte("date", end).order("date").execute()

    days = days_result.data or []
    day_ids = [d["id"] for d in days]

    # Get subjects
    subjects_result = client.table("dood_subjects").select(
        "id, display_name, subject_type, department, notes, sort_order"
    ).eq("project_id", project_id).order("sort_order").order("created_at").execute()

    subjects = subjects_result.data or []

    # Get assignments for the days
    assignments = []
    if day_ids:
        assignments_result = client.table("dood_assignments").select(
            "id, subject_id, day_id, code, notes"
        ).eq("project_id", project_id).in_("day_id", day_ids).execute()
        assignments = assignments_result.data or []

    # Get latest published version for this range
    versions_result = client.table("dood_versions").select(
        "id, version_number, range_start, range_end, created_at, created_by_user_id"
    ).eq("project_id", project_id).lte("range_start", start).gte("range_end", end).order("version_number", desc=True).limit(1).execute()

    latest_version = versions_result.data[0] if versions_result.data else None

    return {
        "days": days,
        "subjects": subjects,
        "assignments": assignments,
        "latest_published_version": latest_version
    }


@router.post("/projects/{project_id}/dood/days/generate")
async def generate_dood_days(
    project_id: str,
    request: GenerateDaysRequest,
    authorization: str = Header(None)
):
    """
    Generate production days for a date range.
    Idempotent - skips dates that already have days.
    """
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    start_date = parse_date(request.start)
    end_date = parse_date(request.end)
    validate_date_range(start_date, end_date)

    client = get_client()

    # Get existing days in range
    existing_result = client.table("backlot_production_days").select(
        "date"
    ).eq("project_id", project_id).gte("date", request.start).lte("date", request.end).execute()

    existing_dates = set()
    if existing_result.data:
        for d in existing_result.data:
            # Handle both date string and datetime formats
            date_val = d["date"]
            if isinstance(date_val, str):
                existing_dates.add(date_val[:10])  # Take YYYY-MM-DD part
            else:
                existing_dates.add(date_val.strftime("%Y-%m-%d"))

    # Get max day_number
    max_day_result = client.table("backlot_production_days").select(
        "day_number"
    ).eq("project_id", project_id).order("day_number", desc=True).limit(1).execute()

    next_day_number = 1
    if max_day_result.data and max_day_result.data[0].get("day_number"):
        next_day_number = max_day_result.data[0]["day_number"] + 1

    # Generate missing days
    created_days = []
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        if date_str not in existing_dates:
            # Store as noon UTC to avoid timezone issues
            day_datetime = f"{date_str}T12:00:00Z"
            day_data = {
                "project_id": project_id,
                "date": day_datetime,
                "day_number": next_day_number,
                "day_type": "SHOOT",
                "title": f"Day {next_day_number}"
            }
            result = client.table("backlot_production_days").insert(day_data).execute()
            if result.data:
                created_days.append(result.data[0])
                next_day_number += 1
        current_date += timedelta(days=1)

    return {
        "created_count": len(created_days),
        "created_days": created_days
    }


@router.post("/projects/{project_id}/dood/subjects")
async def create_subject(
    project_id: str,
    request: SubjectCreate,
    authorization: str = Header(None)
):
    """Create a new DOOD subject."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    if request.subject_type not in VALID_SUBJECT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid subject_type. Must be one of: {VALID_SUBJECT_TYPES}")

    client = get_client()

    # Get max sort_order
    max_order_result = client.table("dood_subjects").select(
        "sort_order"
    ).eq("project_id", project_id).order("sort_order", desc=True).limit(1).execute()

    next_order = 0
    if max_order_result.data and max_order_result.data[0].get("sort_order") is not None:
        next_order = max_order_result.data[0]["sort_order"] + 1

    subject_data = {
        "project_id": project_id,
        "display_name": request.display_name,
        "subject_type": request.subject_type,
        "department": request.department,
        "notes": request.notes,
        "sort_order": next_order
    }

    result = client.table("dood_subjects").insert(subject_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create subject")

    return result.data[0]


@router.get("/projects/{project_id}/dood/subjects")
async def list_subjects(
    project_id: str,
    authorization: str = Header(None)
):
    """List all DOOD subjects for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()
    result = client.table("dood_subjects").select(
        "id, display_name, subject_type, department, notes, sort_order, created_at"
    ).eq("project_id", project_id).order("sort_order").order("created_at").execute()

    return {"subjects": result.data or []}


@router.patch("/projects/{project_id}/dood/subjects/{subject_id}")
async def update_subject(
    project_id: str,
    subject_id: str,
    request: SubjectUpdate,
    authorization: str = Header(None)
):
    """Update a DOOD subject."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify subject belongs to project
    existing = client.table("dood_subjects").select("id").eq("id", subject_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subject not found")

    update_data = {}
    if request.display_name is not None:
        update_data["display_name"] = request.display_name
    if request.subject_type is not None:
        if request.subject_type not in VALID_SUBJECT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid subject_type. Must be one of: {VALID_SUBJECT_TYPES}")
        update_data["subject_type"] = request.subject_type
    if request.department is not None:
        update_data["department"] = request.department
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.sort_order is not None:
        update_data["sort_order"] = request.sort_order

    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = client.table("dood_subjects").update(update_data).eq("id", subject_id).execute()
        return result.data[0] if result.data else {}

    return existing.data[0]


@router.delete("/projects/{project_id}/dood/subjects/{subject_id}")
async def delete_subject(
    project_id: str,
    subject_id: str,
    authorization: str = Header(None)
):
    """Delete a DOOD subject and all its assignments."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify subject belongs to project
    existing = client.table("dood_subjects").select("id").eq("id", subject_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Delete (assignments will cascade)
    client.table("dood_subjects").delete().eq("id", subject_id).execute()

    return {"success": True, "deleted_id": subject_id}


@router.put("/projects/{project_id}/dood/assignments")
async def upsert_assignment(
    project_id: str,
    request: AssignmentUpsert,
    authorization: str = Header(None)
):
    """
    Upsert a DOOD assignment (cell value).
    If code is null or empty, deletes the assignment.
    """
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify subject and day belong to project
    subject = client.table("dood_subjects").select("project_id").eq("id", request.subject_id).execute()
    if not subject.data or subject.data[0]["project_id"] != project_id:
        raise HTTPException(status_code=400, detail="Subject does not belong to this project")

    day = client.table("backlot_production_days").select("project_id").eq("id", request.day_id).execute()
    if not day.data or day.data[0]["project_id"] != project_id:
        raise HTTPException(status_code=400, detail="Day does not belong to this project")

    # If code is empty, delete the assignment
    if not request.code or request.code.strip() == "":
        client.table("dood_assignments").delete().eq("subject_id", request.subject_id).eq("day_id", request.day_id).execute()
        return {"success": True, "action": "deleted"}

    # Validate code
    code = request.code.upper().strip()
    if code not in VALID_CODES:
        raise HTTPException(status_code=400, detail=f"Invalid code. Must be one of: {VALID_CODES}")

    # Check for existing assignment
    existing = client.table("dood_assignments").select("id").eq("subject_id", request.subject_id).eq("day_id", request.day_id).execute()

    if existing.data:
        # Update
        update_data = {
            "code": code,
            "notes": request.notes,
            "updated_at": datetime.utcnow().isoformat()
        }
        result = client.table("dood_assignments").update(update_data).eq("id", existing.data[0]["id"]).execute()
        return {"success": True, "action": "updated", "assignment": result.data[0] if result.data else None}
    else:
        # Insert
        insert_data = {
            "project_id": project_id,
            "subject_id": request.subject_id,
            "day_id": request.day_id,
            "code": code,
            "notes": request.notes
        }
        result = client.table("dood_assignments").insert(insert_data).execute()
        return {"success": True, "action": "created", "assignment": result.data[0] if result.data else None}


@router.post("/projects/{project_id}/dood/publish")
async def publish_dood(
    project_id: str,
    request: PublishRequest,
    authorization: str = Header(None)
):
    """
    Publish a DOOD snapshot for the given date range.
    Creates an immutable version with all data frozen at this point.
    """
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    start_date = parse_date(request.start)
    end_date = parse_date(request.end)
    validate_date_range(start_date, end_date)

    client = get_client()

    # Get days in range
    days_result = client.table("backlot_production_days").select(
        "id, date, day_number, title, day_type, notes"
    ).eq("project_id", project_id).gte("date", request.start).lte("date", request.end).order("date").execute()

    days = days_result.data or []
    day_ids = [d["id"] for d in days]

    if not days:
        raise HTTPException(status_code=400, detail="No days found in the specified range")

    # Get subjects
    subjects_result = client.table("dood_subjects").select(
        "id, display_name, subject_type, department, notes, sort_order"
    ).eq("project_id", project_id).order("sort_order").order("created_at").execute()

    subjects = subjects_result.data or []

    # Get assignments
    assignments = []
    if day_ids:
        assignments_result = client.table("dood_assignments").select(
            "id, subject_id, day_id, code, notes"
        ).eq("project_id", project_id).in_("day_id", day_ids).execute()
        assignments = assignments_result.data or []

    # Get next version number
    version_result = client.table("dood_versions").select(
        "version_number"
    ).eq("project_id", project_id).order("version_number", desc=True).limit(1).execute()

    next_version = 1
    if version_result.data:
        next_version = version_result.data[0]["version_number"] + 1

    # Build snapshot
    snapshot = {
        "days": days,
        "subjects": subjects,
        "assignments": assignments,
        "published_at": datetime.utcnow().isoformat(),
        "published_by": user["id"]
    }

    # Create version
    version_data = {
        "project_id": project_id,
        "range_start": request.start,
        "range_end": request.end,
        "version_number": next_version,
        "snapshot_json": json.dumps(snapshot),
        "created_by_user_id": user["id"]
    }

    result = client.table("dood_versions").insert(version_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create version")

    return {
        "id": result.data[0]["id"],
        "version_number": next_version,
        "created_at": result.data[0]["created_at"]
    }


@router.get("/projects/{project_id}/dood/export.csv")
async def export_dood_csv(
    project_id: str,
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    authorization: str = Header(None)
):
    """
    Export DOOD grid as CSV for the given date range.
    """
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    start_date = parse_date(start)
    end_date = parse_date(end)
    validate_date_range(start_date, end_date)

    client = get_client()

    # Get days in range
    days_result = client.table("backlot_production_days").select(
        "id, date, day_number, title, day_type"
    ).eq("project_id", project_id).gte("date", start).lte("date", end).order("date").execute()

    days = days_result.data or []
    day_ids = [d["id"] for d in days]

    # Get subjects
    subjects_result = client.table("dood_subjects").select(
        "id, display_name, subject_type, department"
    ).eq("project_id", project_id).order("sort_order").order("created_at").execute()

    subjects = subjects_result.data or []

    # Get assignments
    assignments_map = {}
    if day_ids:
        assignments_result = client.table("dood_assignments").select(
            "subject_id, day_id, code"
        ).eq("project_id", project_id).in_("day_id", day_ids).execute()

        for a in (assignments_result.data or []):
            key = f"{a['subject_id']}:{a['day_id']}"
            assignments_map[key] = a["code"]

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    header = ["Subject", "Type", "Department"]
    for day in days:
        date_str = day["date"]
        if isinstance(date_str, str):
            date_str = date_str[:10]  # Take YYYY-MM-DD part
        header.append(date_str)
    writer.writerow(header)

    # Subject rows
    for subject in subjects:
        row = [
            subject["display_name"],
            subject["subject_type"],
            subject.get("department") or ""
        ]
        for day in days:
            key = f"{subject['id']}:{day['id']}"
            code = assignments_map.get(key, "")
            row.append(code)
        writer.writerow(row)

    csv_content = output.getvalue()
    output.close()

    # Return as CSV response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=dood_{project_id}_{start}_{end}.csv"
        }
    )


@router.get("/projects/{project_id}/dood/versions")
async def list_dood_versions(
    project_id: str,
    authorization: str = Header(None)
):
    """List all published DOOD versions for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()
    result = client.table("dood_versions").select(
        "id, version_number, range_start, range_end, created_at, created_by_user_id"
    ).eq("project_id", project_id).order("version_number", desc=True).execute()

    return {"versions": result.data or []}


@router.get("/projects/{project_id}/dood/versions/{version_id}")
async def get_dood_version(
    project_id: str,
    version_id: str,
    authorization: str = Header(None)
):
    """Get a specific published DOOD version with full snapshot."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()
    result = client.table("dood_versions").select("*").eq("id", version_id).eq("project_id", project_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Version not found")

    version = result.data[0]

    # Parse snapshot JSON
    if isinstance(version.get("snapshot_json"), str):
        version["snapshot_json"] = json.loads(version["snapshot_json"])

    return version
