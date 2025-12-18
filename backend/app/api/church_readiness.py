"""
Church Readiness API - Preflight Checklists, Stream QC, Macro Library
Section F: Sunday Readiness
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

class PreflightChecklist(BaseModel):
    id: str
    org_id: Optional[str] = None
    name: str
    checklist_type: str = "general"
    description: Optional[str] = None
    items: List[Dict[str, Any]] = []
    is_template: bool = False
    linked_event_id: Optional[str] = None
    linked_service_plan_id: Optional[str] = None
    status: str = "pending"
    completed_at: Optional[str] = None
    completed_by_user_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreatePreflightChecklistRequest(BaseModel):
    name: str
    checklist_type: str = "general"
    description: Optional[str] = None
    items: List[Dict[str, Any]] = []
    is_template: bool = False
    linked_event_id: Optional[str] = None
    linked_service_plan_id: Optional[str] = None


class UpdatePreflightChecklistRequest(BaseModel):
    name: Optional[str] = None
    checklist_type: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None


class ChecklistItemUpdate(BaseModel):
    item_index: int
    is_checked: bool
    checked_by_user_id: Optional[str] = None
    notes: Optional[str] = None


class StreamQCSession(BaseModel):
    id: str
    org_id: Optional[str] = None
    service_plan_id: Optional[str] = None
    event_id: Optional[str] = None
    session_date: str
    session_type: str = "live"
    status: str = "scheduled"
    checklist_items: List[Dict[str, Any]] = []
    audio_notes: Optional[str] = None
    video_notes: Optional[str] = None
    stream_notes: Optional[str] = None
    issues_found: List[Dict[str, Any]] = []
    overall_rating: Optional[int] = None
    qc_by_user_id: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str


class CreateStreamQCSessionRequest(BaseModel):
    service_plan_id: Optional[str] = None
    event_id: Optional[str] = None
    session_date: str
    session_type: str = "live"
    checklist_items: List[Dict[str, Any]] = []


class UpdateStreamQCSessionRequest(BaseModel):
    status: Optional[str] = None
    checklist_items: Optional[List[Dict[str, Any]]] = None
    audio_notes: Optional[str] = None
    video_notes: Optional[str] = None
    stream_notes: Optional[str] = None
    issues_found: Optional[List[Dict[str, Any]]] = None
    overall_rating: Optional[int] = None


class StreamIssue(BaseModel):
    timestamp: str
    category: str  # "audio", "video", "stream", "other"
    severity: str  # "minor", "moderate", "severe"
    description: str
    resolved: bool = False
    resolution_notes: Optional[str] = None


class MacroCommand(BaseModel):
    id: str
    org_id: Optional[str] = None
    name: str
    category: str
    description: Optional[str] = None
    trigger_type: str = "manual"  # "manual", "scheduled", "event"
    trigger_config: Dict[str, Any] = {}
    actions: List[Dict[str, Any]] = []
    is_active: bool = True
    hotkey: Optional[str] = None
    tags: List[str] = []
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateMacroCommandRequest(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    trigger_type: str = "manual"
    trigger_config: Dict[str, Any] = {}
    actions: List[Dict[str, Any]] = []
    hotkey: Optional[str] = None
    tags: List[str] = []


class UpdateMacroCommandRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None
    hotkey: Optional[str] = None
    tags: Optional[List[str]] = None


# =============================================================================
# HELPER: Get user ID from auth header
# =============================================================================
async def get_current_user_id(authorization: str = Header(None)) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    try:
        import os
        USE_AWS = os.getenv('USE_AWS', 'false').lower() == 'true'

        if USE_AWS:
            from app.core.cognito import CognitoAuth
            user = CognitoAuth.verify_token(token)
            return user.get("id") if user else None
        else:
            from app.core.supabase import get_supabase_client
            supabase = get_supabase_client()
            user = supabase.auth.get_user(token)
            return user.user.id if user and user.user else None
    except Exception:
        return None


# =============================================================================
# PREFLIGHT CHECKLIST ENDPOINTS
# =============================================================================

@router.get("/readiness/checklists", response_model=List[PreflightChecklist])
async def list_preflight_checklists(
    checklist_type: Optional[str] = Query(None),
    is_template: Optional[bool] = Query(None),
    status: Optional[str] = Query(None),
    service_plan_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """
    List preflight checklists with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_preflight_checklists").select("*")

    if checklist_type:
        query = query.eq("checklist_type", checklist_type)
    if is_template is not None:
        query = query.eq("is_template", is_template)
    if status:
        query = query.eq("status", status)
    if service_plan_id:
        query = query.eq("linked_service_plan_id", service_plan_id)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/readiness/checklists/templates", response_model=List[PreflightChecklist])
async def list_checklist_templates(
    checklist_type: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List only checklist templates."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_preflight_checklists").select("*").eq("is_template", True)

    if checklist_type:
        query = query.eq("checklist_type", checklist_type)

    query = query.order("name")
    result = query.execute()

    return result.data or []


@router.get("/readiness/checklists/{checklist_id}", response_model=PreflightChecklist)
async def get_preflight_checklist(
    checklist_id: str,
    authorization: str = Header(None)
):
    """Get a single preflight checklist by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_preflight_checklists").select("*").eq("id", checklist_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Preflight checklist not found")

    return result.data


@router.post("/readiness/checklists", response_model=PreflightChecklist)
async def create_preflight_checklist(
    request: CreatePreflightChecklistRequest,
    authorization: str = Header(None)
):
    """
    Create a new preflight checklist.
    TODO: Add permission check for preflight_checklists edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "name": request.name,
        "checklist_type": request.checklist_type,
        "description": request.description,
        "items": request.items,
        "is_template": request.is_template,
        "linked_event_id": request.linked_event_id,
        "linked_service_plan_id": request.linked_service_plan_id,
        "status": "pending",
        "created_by_user_id": user_id,
    }

    result = client.table("church_preflight_checklists").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create preflight checklist")

    return result.data[0]


@router.post("/readiness/checklists/{template_id}/instantiate", response_model=PreflightChecklist)
async def instantiate_checklist_template(
    template_id: str,
    service_plan_id: Optional[str] = Query(None),
    event_id: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """
    Create a new checklist instance from a template.
    TODO: Add support for customizing the instantiated checklist.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    # Get template
    template = client.table("church_preflight_checklists").select("*").eq("id", template_id).eq("is_template", True).single().execute()
    if not template.data:
        raise HTTPException(status_code=404, detail="Template not found")

    # Create instance from template
    insert_data = {
        "name": template.data["name"],
        "checklist_type": template.data["checklist_type"],
        "description": template.data.get("description"),
        "items": template.data.get("items", []),
        "is_template": False,
        "linked_event_id": event_id,
        "linked_service_plan_id": service_plan_id,
        "status": "pending",
        "created_by_user_id": user_id,
    }

    result = client.table("church_preflight_checklists").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to instantiate checklist")

    return result.data[0]


@router.put("/readiness/checklists/{checklist_id}", response_model=PreflightChecklist)
async def update_preflight_checklist(
    checklist_id: str,
    request: UpdatePreflightChecklistRequest,
    authorization: str = Header(None)
):
    """Update a preflight checklist."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_preflight_checklists").update(update_data).eq("id", checklist_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Preflight checklist not found")

    return result.data[0]


@router.post("/readiness/checklists/{checklist_id}/complete", response_model=PreflightChecklist)
async def complete_preflight_checklist(
    checklist_id: str,
    authorization: str = Header(None)
):
    """Mark a preflight checklist as complete."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "completed_by_user_id": user_id,
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("church_preflight_checklists").update(update_data).eq("id", checklist_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Preflight checklist not found")

    return result.data[0]


# =============================================================================
# STREAM QC ENDPOINTS
# =============================================================================

@router.get("/readiness/stream-qc", response_model=List[StreamQCSession])
async def list_stream_qc_sessions(
    status: Optional[str] = Query(None),
    session_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List stream QC sessions with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_stream_qc").select("*")

    if status:
        query = query.eq("status", status)
    if session_type:
        query = query.eq("session_type", session_type)
    if start_date:
        query = query.gte("session_date", start_date)
    if end_date:
        query = query.lte("session_date", end_date)

    query = query.order("session_date", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/readiness/stream-qc/{session_id}", response_model=StreamQCSession)
async def get_stream_qc_session(
    session_id: str,
    authorization: str = Header(None)
):
    """Get a single stream QC session by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_stream_qc").select("*").eq("id", session_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Stream QC session not found")

    return result.data


@router.post("/readiness/stream-qc", response_model=StreamQCSession)
async def create_stream_qc_session(
    request: CreateStreamQCSessionRequest,
    authorization: str = Header(None)
):
    """
    Create a new stream QC session.
    TODO: Add permission check for stream_qc_log edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "service_plan_id": request.service_plan_id,
        "event_id": request.event_id,
        "session_date": request.session_date,
        "session_type": request.session_type,
        "status": "scheduled",
        "checklist_items": request.checklist_items,
        "issues_found": [],
    }

    result = client.table("church_stream_qc").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create stream QC session")

    return result.data[0]


@router.put("/readiness/stream-qc/{session_id}", response_model=StreamQCSession)
async def update_stream_qc_session(
    session_id: str,
    request: UpdateStreamQCSessionRequest,
    authorization: str = Header(None)
):
    """Update a stream QC session."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_stream_qc").update(update_data).eq("id", session_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Stream QC session not found")

    return result.data[0]


@router.post("/readiness/stream-qc/{session_id}/start", response_model=StreamQCSession)
async def start_stream_qc_session(
    session_id: str,
    authorization: str = Header(None)
):
    """Start a stream QC session."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {
        "status": "in_progress",
        "qc_by_user_id": user_id,
        "started_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("church_stream_qc").update(update_data).eq("id", session_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Stream QC session not found")

    return result.data[0]


@router.post("/readiness/stream-qc/{session_id}/complete", response_model=StreamQCSession)
async def complete_stream_qc_session(
    session_id: str,
    overall_rating: Optional[int] = Query(None, ge=1, le=5),
    authorization: str = Header(None)
):
    """Complete a stream QC session."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if overall_rating:
        update_data["overall_rating"] = overall_rating

    result = client.table("church_stream_qc").update(update_data).eq("id", session_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Stream QC session not found")

    return result.data[0]


@router.post("/readiness/stream-qc/{session_id}/issue", response_model=StreamQCSession)
async def add_stream_issue(
    session_id: str,
    category: str = Query(...),
    severity: str = Query(...),
    description: str = Query(...),
    authorization: str = Header(None)
):
    """Add an issue to a stream QC session."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    # Get current session
    session = client.table("church_stream_qc").select("*").eq("id", session_id).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Stream QC session not found")

    # Add new issue
    issues = session.data.get("issues_found", [])
    issues.append({
        "timestamp": datetime.utcnow().isoformat(),
        "category": category,
        "severity": severity,
        "description": description,
        "resolved": False,
        "reported_by": user_id,
    })

    update_data = {
        "issues_found": issues,
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("church_stream_qc").update(update_data).eq("id", session_id).execute()

    return result.data[0]


# =============================================================================
# MACRO LIBRARY ENDPOINTS
# =============================================================================

@router.get("/readiness/macros", response_model=List[MacroCommand])
async def list_macro_commands(
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    trigger_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """
    List macro commands with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_macro_library").select("*")

    if category:
        query = query.eq("category", category)
    if is_active is not None:
        query = query.eq("is_active", is_active)
    if trigger_type:
        query = query.eq("trigger_type", trigger_type)
    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.order("category").order("name")
    result = query.execute()

    return result.data or []


@router.get("/readiness/macros/categories")
async def list_macro_categories(
    authorization: str = Header(None)
):
    """Get list of unique macro categories."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_macro_library").select("category").execute()

    categories = list(set([item["category"] for item in result.data if item.get("category")]))
    return sorted(categories)


@router.get("/readiness/macros/{macro_id}", response_model=MacroCommand)
async def get_macro_command(
    macro_id: str,
    authorization: str = Header(None)
):
    """Get a single macro command by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_macro_library").select("*").eq("id", macro_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Macro command not found")

    return result.data


@router.post("/readiness/macros", response_model=MacroCommand)
async def create_macro_command(
    request: CreateMacroCommandRequest,
    authorization: str = Header(None)
):
    """
    Create a new macro command.
    TODO: Add permission check for macro_library edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "name": request.name,
        "category": request.category,
        "description": request.description,
        "trigger_type": request.trigger_type,
        "trigger_config": request.trigger_config,
        "actions": request.actions,
        "is_active": True,
        "hotkey": request.hotkey,
        "tags": request.tags,
        "created_by_user_id": user_id,
    }

    result = client.table("church_macro_library").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create macro command")

    return result.data[0]


@router.put("/readiness/macros/{macro_id}", response_model=MacroCommand)
async def update_macro_command(
    macro_id: str,
    request: UpdateMacroCommandRequest,
    authorization: str = Header(None)
):
    """Update a macro command."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_macro_library").update(update_data).eq("id", macro_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Macro command not found")

    return result.data[0]


@router.delete("/readiness/macros/{macro_id}")
async def delete_macro_command(
    macro_id: str,
    authorization: str = Header(None)
):
    """Delete a macro command."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_macro_library").delete().eq("id", macro_id).execute()

    return {"success": True, "deleted_id": macro_id}


@router.post("/readiness/macros/{macro_id}/duplicate", response_model=MacroCommand)
async def duplicate_macro_command(
    macro_id: str,
    new_name: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """Duplicate an existing macro command."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    # Get original macro
    original = client.table("church_macro_library").select("*").eq("id", macro_id).single().execute()
    if not original.data:
        raise HTTPException(status_code=404, detail="Original macro not found")

    # Create duplicate
    insert_data = {
        "name": new_name or f"{original.data['name']} (Copy)",
        "category": original.data["category"],
        "description": original.data.get("description"),
        "trigger_type": original.data.get("trigger_type", "manual"),
        "trigger_config": original.data.get("trigger_config", {}),
        "actions": original.data.get("actions", []),
        "is_active": True,
        "hotkey": None,  # Don't copy hotkey to avoid conflicts
        "tags": original.data.get("tags", []),
        "created_by_user_id": user_id,
    }

    result = client.table("church_macro_library").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to duplicate macro")

    return result.data[0]
