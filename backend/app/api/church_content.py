"""
Church Content API - Clip Requests, Story Leads, Content Shoots, Announcements
Section C: Content & Requests
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

class ClipRequest(BaseModel):
    id: str
    org_id: Optional[str] = None
    requester_user_id: str
    title: str
    description: Optional[str] = None
    source_service_date: Optional[str] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    priority: str = "normal"
    status: str = "pending"
    assigned_to_user_id: Optional[str] = None
    output_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class CreateClipRequestRequest(BaseModel):
    title: str
    description: Optional[str] = None
    source_service_date: Optional[str] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    priority: str = "normal"
    notes: Optional[str] = None


class UpdateClipRequestRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    source_service_date: Optional[str] = None
    timestamp_start: Optional[str] = None
    timestamp_end: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    output_url: Optional[str] = None
    notes: Optional[str] = None


class StoryLead(BaseModel):
    id: str
    org_id: Optional[str] = None
    submitted_by_user_id: str
    title: str
    description: Optional[str] = None
    contact_info: Optional[str] = None
    category: Optional[str] = None
    urgency: str = "normal"
    status: str = "new"
    assigned_to_user_id: Optional[str] = None
    follow_up_notes: Optional[str] = None
    created_at: str
    updated_at: str


class CreateStoryLeadRequest(BaseModel):
    title: str
    description: Optional[str] = None
    contact_info: Optional[str] = None
    category: Optional[str] = None
    urgency: str = "normal"


class UpdateStoryLeadRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    contact_info: Optional[str] = None
    category: Optional[str] = None
    urgency: Optional[str] = None
    status: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    follow_up_notes: Optional[str] = None


class ContentShoot(BaseModel):
    id: str
    org_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    shoot_date: Optional[str] = None
    location: Optional[str] = None
    shoot_type: Optional[str] = None
    status: str = "planning"
    crew_assignments: Dict[str, Any] = {}
    equipment_list: List[str] = []
    deliverables: List[str] = []
    notes: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateContentShootRequest(BaseModel):
    title: str
    description: Optional[str] = None
    shoot_date: Optional[str] = None
    location: Optional[str] = None
    shoot_type: Optional[str] = None
    status: str = "planning"
    crew_assignments: Dict[str, Any] = {}
    equipment_list: List[str] = []
    deliverables: List[str] = []
    notes: Optional[str] = None


class UpdateContentShootRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    shoot_date: Optional[str] = None
    location: Optional[str] = None
    shoot_type: Optional[str] = None
    status: Optional[str] = None
    crew_assignments: Optional[Dict[str, Any]] = None
    equipment_list: Optional[List[str]] = None
    deliverables: Optional[List[str]] = None
    notes: Optional[str] = None


class Announcement(BaseModel):
    id: str
    org_id: Optional[str] = None
    title: str
    content: Optional[str] = None
    announcement_type: str = "general"
    target_date: Optional[str] = None
    target_services: List[str] = []
    status: str = "draft"
    priority: int = 0
    graphics_url: Optional[str] = None
    video_url: Optional[str] = None
    created_by_user_id: Optional[str] = None
    approved_by_user_id: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: str
    updated_at: str


class CreateAnnouncementRequest(BaseModel):
    title: str
    content: Optional[str] = None
    announcement_type: str = "general"
    target_date: Optional[str] = None
    target_services: List[str] = []
    priority: int = 0
    graphics_url: Optional[str] = None
    video_url: Optional[str] = None


class UpdateAnnouncementRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    announcement_type: Optional[str] = None
    target_date: Optional[str] = None
    target_services: Optional[List[str]] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    graphics_url: Optional[str] = None
    video_url: Optional[str] = None


# =============================================================================
# HELPER: Get user ID from auth header
# =============================================================================
async def get_current_user_id(authorization: str = Header(None)) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    try:
        supabase = get_supabase_admin_client()
        user = supabase.auth.get_user(token)
        return user.user.id if user and user.user else None
    except Exception:
        return None


# =============================================================================
# CLIP REQUEST ENDPOINTS
# =============================================================================

@router.get("/content/clip-requests", response_model=List[ClipRequest])
async def list_clip_requests(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """
    List clip requests with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_clip_requests").select("*")

    if status:
        query = query.eq("status", status)
    if priority:
        query = query.eq("priority", priority)
    if assigned_to:
        query = query.eq("assigned_to_user_id", assigned_to)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/content/clip-requests/mine", response_model=List[ClipRequest])
async def list_my_clip_requests(
    authorization: str = Header(None)
):
    """List clip requests created by current user."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_clip_requests").select("*").eq("requester_user_id", user_id).order("created_at", desc=True).execute()

    return result.data or []


@router.get("/content/clip-requests/{request_id}", response_model=ClipRequest)
async def get_clip_request(
    request_id: str,
    authorization: str = Header(None)
):
    """Get a single clip request by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_clip_requests").select("*").eq("id", request_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Clip request not found")

    return result.data


@router.post("/content/clip-requests", response_model=ClipRequest)
async def create_clip_request(
    request: CreateClipRequestRequest,
    authorization: str = Header(None)
):
    """
    Create a new clip request.
    TODO: Add notification to media team.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "requester_user_id": user_id,
        "title": request.title,
        "description": request.description,
        "source_service_date": request.source_service_date,
        "timestamp_start": request.timestamp_start,
        "timestamp_end": request.timestamp_end,
        "priority": request.priority,
        "status": "pending",
        "notes": request.notes,
    }

    result = supabase.table("church_clip_requests").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create clip request")

    return result.data[0]


@router.put("/content/clip-requests/{request_id}", response_model=ClipRequest)
async def update_clip_request(
    request_id: str,
    request: UpdateClipRequestRequest,
    authorization: str = Header(None)
):
    """Update a clip request."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_clip_requests").update(update_data).eq("id", request_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Clip request not found")

    return result.data[0]


# =============================================================================
# STORY LEAD ENDPOINTS
# =============================================================================

@router.get("/content/story-leads", response_model=List[StoryLead])
async def list_story_leads(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List story leads with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_story_leads").select("*")

    if status:
        query = query.eq("status", status)
    if category:
        query = query.eq("category", category)
    if urgency:
        query = query.eq("urgency", urgency)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.post("/content/story-leads", response_model=StoryLead)
async def create_story_lead(
    request: CreateStoryLeadRequest,
    authorization: str = Header(None)
):
    """
    Submit a new story lead.
    TODO: Add notification to content team.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "submitted_by_user_id": user_id,
        "title": request.title,
        "description": request.description,
        "contact_info": request.contact_info,
        "category": request.category,
        "urgency": request.urgency,
        "status": "new",
    }

    result = supabase.table("church_story_leads").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create story lead")

    return result.data[0]


@router.put("/content/story-leads/{lead_id}", response_model=StoryLead)
async def update_story_lead(
    lead_id: str,
    request: UpdateStoryLeadRequest,
    authorization: str = Header(None)
):
    """Update a story lead."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_story_leads").update(update_data).eq("id", lead_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Story lead not found")

    return result.data[0]


# =============================================================================
# CONTENT SHOOT ENDPOINTS
# =============================================================================

@router.get("/content/shoots", response_model=List[ContentShoot])
async def list_content_shoots(
    status: Optional[str] = Query(None),
    shoot_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List content shoots with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_content_shoots").select("*")

    if status:
        query = query.eq("status", status)
    if shoot_type:
        query = query.eq("shoot_type", shoot_type)
    if start_date:
        query = query.gte("shoot_date", start_date)
    if end_date:
        query = query.lte("shoot_date", end_date)

    query = query.order("shoot_date", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/content/shoots/{shoot_id}", response_model=ContentShoot)
async def get_content_shoot(
    shoot_id: str,
    authorization: str = Header(None)
):
    """Get a single content shoot by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_content_shoots").select("*").eq("id", shoot_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Content shoot not found")

    return result.data


@router.post("/content/shoots", response_model=ContentShoot)
async def create_content_shoot(
    request: CreateContentShootRequest,
    authorization: str = Header(None)
):
    """
    Create a new content shoot.
    TODO: Add permission check for content_shoot_planner edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "title": request.title,
        "description": request.description,
        "shoot_date": request.shoot_date,
        "location": request.location,
        "shoot_type": request.shoot_type,
        "status": request.status,
        "crew_assignments": request.crew_assignments,
        "equipment_list": request.equipment_list,
        "deliverables": request.deliverables,
        "notes": request.notes,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_content_shoots").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create content shoot")

    return result.data[0]


@router.put("/content/shoots/{shoot_id}", response_model=ContentShoot)
async def update_content_shoot(
    shoot_id: str,
    request: UpdateContentShootRequest,
    authorization: str = Header(None)
):
    """Update a content shoot."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_content_shoots").update(update_data).eq("id", shoot_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Content shoot not found")

    return result.data[0]


# =============================================================================
# ANNOUNCEMENT ENDPOINTS
# =============================================================================

@router.get("/content/announcements", response_model=List[Announcement])
async def list_announcements(
    status: Optional[str] = Query(None),
    announcement_type: Optional[str] = Query(None),
    target_date: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List announcements with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_announcements").select("*")

    if status:
        query = query.eq("status", status)
    if announcement_type:
        query = query.eq("announcement_type", announcement_type)
    if target_date:
        query = query.eq("target_date", target_date)

    query = query.order("target_date", desc=True).order("priority", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/content/announcements/{announcement_id}", response_model=Announcement)
async def get_announcement(
    announcement_id: str,
    authorization: str = Header(None)
):
    """Get a single announcement by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_announcements").select("*").eq("id", announcement_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    return result.data


@router.post("/content/announcements", response_model=Announcement)
async def create_announcement(
    request: CreateAnnouncementRequest,
    authorization: str = Header(None)
):
    """
    Create a new announcement.
    TODO: Add permission check for announcement_slide_manager edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "title": request.title,
        "content": request.content,
        "announcement_type": request.announcement_type,
        "target_date": request.target_date,
        "target_services": request.target_services,
        "status": "draft",
        "priority": request.priority,
        "graphics_url": request.graphics_url,
        "video_url": request.video_url,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_announcements").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create announcement")

    return result.data[0]


@router.put("/content/announcements/{announcement_id}", response_model=Announcement)
async def update_announcement(
    announcement_id: str,
    request: UpdateAnnouncementRequest,
    authorization: str = Header(None)
):
    """Update an announcement."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_announcements").update(update_data).eq("id", announcement_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    return result.data[0]


@router.post("/content/announcements/{announcement_id}/approve", response_model=Announcement)
async def approve_announcement(
    announcement_id: str,
    authorization: str = Header(None)
):
    """
    Approve an announcement for publication.
    TODO: Add permission check for approval authority.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {
        "status": "approved",
        "approved_by_user_id": user_id,
        "approved_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = supabase.table("church_announcements").update(update_data).eq("id", announcement_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Announcement not found")

    return result.data[0]
