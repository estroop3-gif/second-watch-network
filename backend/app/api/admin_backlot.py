"""
Admin Backlot API Routes - Full CRUD management for Backlot projects
Note: Auth is handled by frontend admin routing. Backend auth can be added later.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date
from app.core.database import get_client
import re

router = APIRouter()


# === Schemas ===

class BacklotProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_type: Optional[str] = None
    status: str = "draft"
    logline: Optional[str] = None
    genre: Optional[str] = None
    format: Optional[str] = None
    runtime_minutes: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_total: Optional[float] = None
    thumbnail_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    visibility: str = "private"
    owner_id: Optional[str] = None


class BacklotProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    status: Optional[str] = None
    logline: Optional[str] = None
    genre: Optional[str] = None
    format: Optional[str] = None
    runtime_minutes: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_total: Optional[float] = None
    thumbnail_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    visibility: Optional[str] = None
    is_public: Optional[bool] = None


class ProjectStatusUpdate(BaseModel):
    status: str


# === Project Endpoints ===

@router.get("/projects")
async def list_backlot_projects(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    project_type: Optional[str] = None,
    search: Optional[str] = None,
    owner_id: Optional[str] = None
):
    """List all Backlot projects with stats"""
    try:
        client = get_client()
        query = client.table("backlot_projects").select(
            "*, owner:profiles!owner_id(id, full_name, username, avatar_url)",
            count="exact"
        )

        if status:
            query = query.eq("status", status)
        if project_type:
            query = query.eq("project_type", project_type)
        if owner_id:
            query = query.eq("owner_id", owner_id)
        if search:
            query = query.or_(f"title.ilike.%{search}%,description.ilike.%{search}%")

        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()
        projects = response.data

        # Get additional stats for each project
        for project in projects:
            credit_count = client.table("backlot_project_credits").select("id", count="exact").eq("project_id", project["id"]).execute()
            project["credit_count"] = credit_count.count or 0

            file_count = client.table("backlot_files").select("id", count="exact").eq("project_id", project["id"]).execute()
            project["file_count"] = file_count.count or 0

        return {
            "projects": projects,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects")
async def create_backlot_project(data: BacklotProjectCreate):
    """Create a new Backlot project (admin)"""
    try:
        client = get_client()
        project_data = data.model_dump(exclude_none=True)

        # Generate slug from title
        slug = re.sub(r'[^a-z0-9]+', '-', data.title.lower()).strip('-')
        project_data["slug"] = slug

        # Convert date objects to strings
        if "start_date" in project_data and project_data["start_date"]:
            project_data["start_date"] = project_data["start_date"].isoformat()
        if "end_date" in project_data and project_data["end_date"]:
            project_data["end_date"] = project_data["end_date"].isoformat()

        response = client.table("backlot_projects").insert(project_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}")
async def get_backlot_project(project_id: str):
    """Get single Backlot project with full details"""
    try:
        client = get_client()

        response = client.table("backlot_projects").select(
            "*, owner:profiles!owner_id(id, full_name, username, avatar_url, email)"
        ).eq("id", project_id).single().execute()
        project = response.data

        # Get credits
        credits_response = client.table("backlot_project_credits").select(
            "*, user:profiles(id, full_name, username, avatar_url)"
        ).eq("project_id", project_id).execute()
        project["credits"] = credits_response.data

        # Get files (limited)
        files_response = client.table("backlot_files").select(
            "id, file_name, file_type, file_size, created_at"
        ).eq("project_id", project_id).limit(20).order("created_at", desc=True).execute()
        project["recent_files"] = files_response.data

        file_count = client.table("backlot_files").select("id", count="exact").eq("project_id", project_id).execute()
        project["file_count"] = file_count.count or 0

        return project
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/projects/{project_id}")
async def update_backlot_project(project_id: str, data: BacklotProjectUpdate):
    """Update Backlot project"""
    try:
        client = get_client()
        update_data = data.model_dump(exclude_none=True)
        update_data["updated_at"] = datetime.utcnow().isoformat()

        if "start_date" in update_data and update_data["start_date"]:
            update_data["start_date"] = update_data["start_date"].isoformat()
        if "end_date" in update_data and update_data["end_date"]:
            update_data["end_date"] = update_data["end_date"].isoformat()

        response = client.table("backlot_projects").update(update_data).eq("id", project_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/projects/{project_id}")
async def delete_backlot_project(project_id: str):
    """Delete Backlot project"""
    try:
        client = get_client()
        client.table("backlot_projects").delete().eq("id", project_id).execute()
        return {"message": "Project deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/projects/{project_id}/status")
async def update_project_status(project_id: str, data: ProjectStatusUpdate):
    """Update project status"""
    try:
        client = get_client()
        response = client.table("backlot_projects").update({
            "status": data.status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", project_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Project Credits ===

@router.get("/projects/{project_id}/credits")
async def list_project_credits(project_id: str):
    """List all credits for a project"""
    try:
        client = get_client()
        response = client.table("backlot_project_credits").select(
            "*, user:profiles(id, full_name, username, avatar_url, email)"
        ).eq("project_id", project_id).order("created_at").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/projects/{project_id}/credits/{credit_id}")
async def delete_project_credit(project_id: str, credit_id: str):
    """Remove a credit from project"""
    try:
        client = get_client()
        client.table("backlot_project_credits").delete().eq("id", credit_id).eq("project_id", project_id).execute()
        return {"message": "Credit removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Project Files ===

@router.get("/projects/{project_id}/files")
async def list_project_files(project_id: str, skip: int = 0, limit: int = 50):
    """List all files for a project"""
    try:
        client = get_client()
        response = client.table("backlot_files").select(
            "*, uploader:profiles(id, full_name, username)",
            count="exact"
        ).eq("project_id", project_id).order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        return {
            "files": response.data,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/projects/{project_id}/files/{file_id}")
async def delete_project_file(project_id: str, file_id: str):
    """Delete a project file"""
    try:
        client = get_client()
        client.table("backlot_files").delete().eq("id", file_id).eq("project_id", project_id).execute()
        return {"message": "File deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Stats ===

@router.get("/stats")
async def get_backlot_stats():
    """Get Backlot overview statistics"""
    try:
        client = get_client()

        total = client.table("backlot_projects").select("id", count="exact").execute()
        draft = client.table("backlot_projects").select("id", count="exact").eq("status", "draft").execute()
        active = client.table("backlot_projects").select("id", count="exact").eq("status", "active").execute()
        complete = client.table("backlot_projects").select("id", count="exact").eq("status", "complete").execute()
        archived = client.table("backlot_projects").select("id", count="exact").eq("status", "archived").execute()
        total_credits = client.table("backlot_project_credits").select("id", count="exact").execute()
        total_files = client.table("backlot_files").select("id", count="exact").execute()

        return {
            "total_projects": total.count or 0,
            "by_status": {
                "draft": draft.count or 0,
                "active": active.count or 0,
                "complete": complete.count or 0,
                "archived": archived.count or 0
            },
            "total_credits": total_credits.count or 0,
            "total_files": total_files.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
