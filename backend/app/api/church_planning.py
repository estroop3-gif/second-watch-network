"""
Church Planning API - Events/Calendar, Creative Briefs, Licenses
Section D: Calendar & Briefs
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

class ChurchEvent(BaseModel):
    id: str
    org_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    event_type: str = "service"
    start_datetime: str
    end_datetime: Optional[str] = None
    location: Optional[str] = None
    campus_id: Optional[str] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None
    parent_event_id: Optional[str] = None
    status: str = "scheduled"
    visibility: str = "internal"
    data: Dict[str, Any] = {}
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateEventRequest(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str = "service"
    start_datetime: str
    end_datetime: Optional[str] = None
    location: Optional[str] = None
    campus_id: Optional[str] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None
    visibility: str = "internal"
    data: Dict[str, Any] = {}


class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    location: Optional[str] = None
    campus_id: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class CreativeBrief(BaseModel):
    id: str
    org_id: Optional[str] = None
    title: str
    project_type: str = "general"
    description: Optional[str] = None
    objectives: List[str] = []
    target_audience: Optional[str] = None
    key_messages: List[str] = []
    deliverables: List[str] = []
    timeline: Dict[str, Any] = {}
    budget: Optional[str] = None
    brand_guidelines: Optional[str] = None
    references: List[str] = []
    status: str = "draft"
    linked_event_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    approved_by_user_id: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: str
    updated_at: str


class CreateCreativeBriefRequest(BaseModel):
    title: str
    project_type: str = "general"
    description: Optional[str] = None
    objectives: List[str] = []
    target_audience: Optional[str] = None
    key_messages: List[str] = []
    deliverables: List[str] = []
    timeline: Dict[str, Any] = {}
    budget: Optional[str] = None
    brand_guidelines: Optional[str] = None
    references: List[str] = []
    linked_event_id: Optional[str] = None


class UpdateCreativeBriefRequest(BaseModel):
    title: Optional[str] = None
    project_type: Optional[str] = None
    description: Optional[str] = None
    objectives: Optional[List[str]] = None
    target_audience: Optional[str] = None
    key_messages: Optional[List[str]] = None
    deliverables: Optional[List[str]] = None
    timeline: Optional[Dict[str, Any]] = None
    budget: Optional[str] = None
    brand_guidelines: Optional[str] = None
    references: Optional[List[str]] = None
    status: Optional[str] = None
    linked_event_id: Optional[str] = None


class License(BaseModel):
    id: str
    org_id: Optional[str] = None
    license_type: str
    name: str
    provider: Optional[str] = None
    license_number: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    expiration_date: Optional[str] = None
    auto_renew: bool = False
    cost: Optional[str] = None
    payment_frequency: Optional[str] = None
    status: str = "active"
    contact_info: Optional[str] = None
    notes: Optional[str] = None
    document_urls: List[str] = []
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateLicenseRequest(BaseModel):
    license_type: str
    name: str
    provider: Optional[str] = None
    license_number: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    expiration_date: Optional[str] = None
    auto_renew: bool = False
    cost: Optional[str] = None
    payment_frequency: Optional[str] = None
    contact_info: Optional[str] = None
    notes: Optional[str] = None
    document_urls: List[str] = []


class UpdateLicenseRequest(BaseModel):
    license_type: Optional[str] = None
    name: Optional[str] = None
    provider: Optional[str] = None
    license_number: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    expiration_date: Optional[str] = None
    auto_renew: Optional[bool] = None
    cost: Optional[str] = None
    payment_frequency: Optional[str] = None
    status: Optional[str] = None
    contact_info: Optional[str] = None
    notes: Optional[str] = None
    document_urls: Optional[List[str]] = None


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
# EVENT/CALENDAR ENDPOINTS
# =============================================================================

@router.get("/planning/events", response_model=List[ChurchEvent])
async def list_events(
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    campus_id: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """
    List church events with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_events").select("*")

    if event_type:
        query = query.eq("event_type", event_type)
    if status:
        query = query.eq("status", status)
    if start_date:
        query = query.gte("start_datetime", start_date)
    if end_date:
        query = query.lte("start_datetime", end_date)
    if campus_id:
        query = query.eq("campus_id", campus_id)
    if visibility:
        query = query.eq("visibility", visibility)

    query = query.order("start_datetime", desc=False).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/planning/events/{event_id}", response_model=ChurchEvent)
async def get_event(
    event_id: str,
    authorization: str = Header(None)
):
    """Get a single event by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_events").select("*").eq("id", event_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    return result.data


@router.post("/planning/events", response_model=ChurchEvent)
async def create_event(
    request: CreateEventRequest,
    authorization: str = Header(None)
):
    """
    Create a new church event.
    TODO: Add permission check for master_calendar edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "title": request.title,
        "description": request.description,
        "event_type": request.event_type,
        "start_datetime": request.start_datetime,
        "end_datetime": request.end_datetime,
        "location": request.location,
        "campus_id": request.campus_id,
        "is_recurring": request.is_recurring,
        "recurrence_rule": request.recurrence_rule,
        "status": "scheduled",
        "visibility": request.visibility,
        "data": request.data,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_events").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create event")

    return result.data[0]


@router.put("/planning/events/{event_id}", response_model=ChurchEvent)
async def update_event(
    event_id: str,
    request: UpdateEventRequest,
    authorization: str = Header(None)
):
    """Update a church event."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_events").update(update_data).eq("id", event_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    return result.data[0]


@router.delete("/planning/events/{event_id}")
async def delete_event(
    event_id: str,
    authorization: str = Header(None)
):
    """Delete a church event."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_events").delete().eq("id", event_id).execute()

    return {"success": True, "deleted_id": event_id}


# =============================================================================
# CREATIVE BRIEF ENDPOINTS
# =============================================================================

@router.get("/planning/briefs", response_model=List[CreativeBrief])
async def list_creative_briefs(
    status: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List creative briefs with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_creative_briefs").select("*")

    if status:
        query = query.eq("status", status)
    if project_type:
        query = query.eq("project_type", project_type)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/planning/briefs/{brief_id}", response_model=CreativeBrief)
async def get_creative_brief(
    brief_id: str,
    authorization: str = Header(None)
):
    """Get a single creative brief by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_creative_briefs").select("*").eq("id", brief_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Creative brief not found")

    return result.data


@router.post("/planning/briefs", response_model=CreativeBrief)
async def create_creative_brief(
    request: CreateCreativeBriefRequest,
    authorization: str = Header(None)
):
    """
    Create a new creative brief.
    TODO: Add permission check for creative_brief_builder edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "title": request.title,
        "project_type": request.project_type,
        "description": request.description,
        "objectives": request.objectives,
        "target_audience": request.target_audience,
        "key_messages": request.key_messages,
        "deliverables": request.deliverables,
        "timeline": request.timeline,
        "budget": request.budget,
        "brand_guidelines": request.brand_guidelines,
        "references": request.references,
        "status": "draft",
        "linked_event_id": request.linked_event_id,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_creative_briefs").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create creative brief")

    return result.data[0]


@router.put("/planning/briefs/{brief_id}", response_model=CreativeBrief)
async def update_creative_brief(
    brief_id: str,
    request: UpdateCreativeBriefRequest,
    authorization: str = Header(None)
):
    """Update a creative brief."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_creative_briefs").update(update_data).eq("id", brief_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Creative brief not found")

    return result.data[0]


@router.post("/planning/briefs/{brief_id}/approve", response_model=CreativeBrief)
async def approve_creative_brief(
    brief_id: str,
    authorization: str = Header(None)
):
    """
    Approve a creative brief.
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

    result = supabase.table("church_creative_briefs").update(update_data).eq("id", brief_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Creative brief not found")

    return result.data[0]


# =============================================================================
# LICENSE TRACKING ENDPOINTS
# =============================================================================

@router.get("/planning/licenses", response_model=List[License])
async def list_licenses(
    license_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    expiring_before: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """
    List licenses with optional filtering.
    TODO: Add notification for upcoming expirations.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_licenses").select("*")

    if license_type:
        query = query.eq("license_type", license_type)
    if status:
        query = query.eq("status", status)
    if expiring_before:
        query = query.lte("expiration_date", expiring_before)

    query = query.order("expiration_date", desc=False).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/planning/licenses/{license_id}", response_model=License)
async def get_license(
    license_id: str,
    authorization: str = Header(None)
):
    """Get a single license by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_licenses").select("*").eq("id", license_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="License not found")

    return result.data


@router.post("/planning/licenses", response_model=License)
async def create_license(
    request: CreateLicenseRequest,
    authorization: str = Header(None)
):
    """
    Create a new license record.
    TODO: Add permission check for license_library edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "license_type": request.license_type,
        "name": request.name,
        "provider": request.provider,
        "license_number": request.license_number,
        "description": request.description,
        "start_date": request.start_date,
        "expiration_date": request.expiration_date,
        "auto_renew": request.auto_renew,
        "cost": request.cost,
        "payment_frequency": request.payment_frequency,
        "status": "active",
        "contact_info": request.contact_info,
        "notes": request.notes,
        "document_urls": request.document_urls,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_licenses").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create license")

    return result.data[0]


@router.put("/planning/licenses/{license_id}", response_model=License)
async def update_license(
    license_id: str,
    request: UpdateLicenseRequest,
    authorization: str = Header(None)
):
    """Update a license record."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_licenses").update(update_data).eq("id", license_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="License not found")

    return result.data[0]


@router.get("/planning/licenses/expiring-soon", response_model=List[License])
async def get_expiring_licenses(
    days: int = Query(30, description="Number of days to look ahead"),
    authorization: str = Header(None)
):
    """Get licenses expiring within the specified number of days."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    from datetime import timedelta
    future_date = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_licenses").select("*").eq("status", "active").lte("expiration_date", future_date).gte("expiration_date", datetime.utcnow().strftime("%Y-%m-%d")).order("expiration_date").execute()

    return result.data or []
