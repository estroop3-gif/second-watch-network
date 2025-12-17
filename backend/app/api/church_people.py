"""
Church People API - Volunteers, Training, Skills, Position Cards
Section B: Volunteers & Training
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from app.core.supabase import get_supabase_admin_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class VolunteerShift(BaseModel):
    id: str
    org_id: Optional[str] = None
    user_id: str
    position_name: str
    shift_date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: str = "scheduled"
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class CreateVolunteerShiftRequest(BaseModel):
    user_id: str
    position_name: str
    shift_date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: str = "scheduled"
    notes: Optional[str] = None


class UpdateVolunteerShiftRequest(BaseModel):
    user_id: Optional[str] = None
    position_name: Optional[str] = None
    shift_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class TrainingModule(BaseModel):
    id: str
    org_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    content_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_required: bool = False
    position_tags: List[str] = []
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateTrainingModuleRequest(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    content_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_required: bool = False
    position_tags: List[str] = []


class TrainingProgress(BaseModel):
    id: str
    user_id: str
    module_id: str
    status: str = "not_started"
    progress_percent: int = 0
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class UpdateTrainingProgressRequest(BaseModel):
    status: Optional[str] = None
    progress_percent: Optional[int] = None
    notes: Optional[str] = None


class SkillEntry(BaseModel):
    id: str
    org_id: Optional[str] = None
    user_id: str
    skill_name: str
    proficiency_level: str = "beginner"
    years_experience: Optional[int] = None
    notes: Optional[str] = None
    verified_by_user_id: Optional[str] = None
    verified_at: Optional[str] = None
    created_at: str
    updated_at: str


class CreateSkillEntryRequest(BaseModel):
    user_id: str
    skill_name: str
    proficiency_level: str = "beginner"
    years_experience: Optional[int] = None
    notes: Optional[str] = None


class PositionCard(BaseModel):
    id: str
    org_id: Optional[str] = None
    position_name: str
    department: Optional[str] = None
    description: Optional[str] = None
    responsibilities: List[str] = []
    required_skills: List[str] = []
    training_modules: List[str] = []
    quick_reference: Dict[str, Any] = {}
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreatePositionCardRequest(BaseModel):
    position_name: str
    department: Optional[str] = None
    description: Optional[str] = None
    responsibilities: List[str] = []
    required_skills: List[str] = []
    training_modules: List[str] = []
    quick_reference: Dict[str, Any] = {}


class UpdatePositionCardRequest(BaseModel):
    position_name: Optional[str] = None
    department: Optional[str] = None
    description: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    required_skills: Optional[List[str]] = None
    training_modules: Optional[List[str]] = None
    quick_reference: Optional[Dict[str, Any]] = None


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
# VOLUNTEER SCHEDULING ENDPOINTS
# =============================================================================

@router.get("/volunteers/shifts", response_model=List[VolunteerShift])
async def list_volunteer_shifts(
    user_id: Optional[str] = Query(None),
    position_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """
    List volunteer shifts with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    current_user_id = await get_current_user_id(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_volunteer_shifts").select("*")

    if user_id:
        query = query.eq("user_id", user_id)
    if position_name:
        query = query.eq("position_name", position_name)
    if start_date:
        query = query.gte("shift_date", start_date)
    if end_date:
        query = query.lte("shift_date", end_date)
    if status:
        query = query.eq("status", status)

    query = query.order("shift_date", desc=False).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/volunteers/shifts/{shift_id}", response_model=VolunteerShift)
async def get_volunteer_shift(
    shift_id: str,
    authorization: str = Header(None)
):
    """Get a single volunteer shift by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_volunteer_shifts").select("*").eq("id", shift_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Volunteer shift not found")

    return result.data


@router.post("/volunteers/shifts", response_model=VolunteerShift)
async def create_volunteer_shift(
    request: CreateVolunteerShiftRequest,
    authorization: str = Header(None)
):
    """
    Create a new volunteer shift.
    TODO: Add permission check for volunteer_scheduling edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "user_id": request.user_id,
        "position_name": request.position_name,
        "shift_date": request.shift_date,
        "start_time": request.start_time,
        "end_time": request.end_time,
        "status": request.status,
        "notes": request.notes,
    }

    result = supabase.table("church_volunteer_shifts").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create volunteer shift")

    return result.data[0]


@router.put("/volunteers/shifts/{shift_id}", response_model=VolunteerShift)
async def update_volunteer_shift(
    shift_id: str,
    request: UpdateVolunteerShiftRequest,
    authorization: str = Header(None)
):
    """Update a volunteer shift."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_volunteer_shifts").update(update_data).eq("id", shift_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Volunteer shift not found")

    return result.data[0]


@router.delete("/volunteers/shifts/{shift_id}")
async def delete_volunteer_shift(
    shift_id: str,
    authorization: str = Header(None)
):
    """Delete a volunteer shift."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_volunteer_shifts").delete().eq("id", shift_id).execute()

    return {"success": True, "deleted_id": shift_id}


# =============================================================================
# TRAINING MODULE ENDPOINTS
# =============================================================================

@router.get("/training/modules", response_model=List[TrainingModule])
async def list_training_modules(
    category: Optional[str] = Query(None),
    is_required: Optional[bool] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List training modules with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_training_modules").select("*")

    if category:
        query = query.eq("category", category)
    if is_required is not None:
        query = query.eq("is_required", is_required)

    query = query.order("title").limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/training/modules/{module_id}", response_model=TrainingModule)
async def get_training_module(
    module_id: str,
    authorization: str = Header(None)
):
    """Get a single training module by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_training_modules").select("*").eq("id", module_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Training module not found")

    return result.data


@router.post("/training/modules", response_model=TrainingModule)
async def create_training_module(
    request: CreateTrainingModuleRequest,
    authorization: str = Header(None)
):
    """
    Create a new training module.
    TODO: Add permission check for training_tracker edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "title": request.title,
        "description": request.description,
        "category": request.category,
        "content_url": request.content_url,
        "duration_minutes": request.duration_minutes,
        "is_required": request.is_required,
        "position_tags": request.position_tags,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_training_modules").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create training module")

    return result.data[0]


# =============================================================================
# TRAINING PROGRESS ENDPOINTS
# =============================================================================

@router.get("/training/progress", response_model=List[TrainingProgress])
async def list_training_progress(
    user_id: Optional[str] = Query(None),
    module_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List training progress records."""
    current_user_id = await get_current_user_id(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_training_progress").select("*")

    if user_id:
        query = query.eq("user_id", user_id)
    if module_id:
        query = query.eq("module_id", module_id)
    if status:
        query = query.eq("status", status)

    result = query.execute()

    return result.data or []


@router.get("/training/progress/me", response_model=List[TrainingProgress])
async def get_my_training_progress(
    authorization: str = Header(None)
):
    """Get current user's training progress."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_training_progress").select("*").eq("user_id", user_id).execute()

    return result.data or []


@router.put("/training/progress/{progress_id}", response_model=TrainingProgress)
async def update_training_progress(
    progress_id: str,
    request: UpdateTrainingProgressRequest,
    authorization: str = Header(None)
):
    """Update training progress."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    # Mark completed if status is completed
    if request.status == "completed" and "completed_at" not in update_data:
        update_data["completed_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_training_progress").update(update_data).eq("id", progress_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Training progress not found")

    return result.data[0]


# =============================================================================
# SKILLS DIRECTORY ENDPOINTS
# =============================================================================

@router.get("/skills", response_model=List[SkillEntry])
async def list_skills(
    user_id: Optional[str] = Query(None),
    skill_name: Optional[str] = Query(None),
    proficiency_level: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List skill entries with optional filtering."""
    current_user_id = await get_current_user_id(authorization)
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_skills_directory").select("*")

    if user_id:
        query = query.eq("user_id", user_id)
    if skill_name:
        query = query.ilike("skill_name", f"%{skill_name}%")
    if proficiency_level:
        query = query.eq("proficiency_level", proficiency_level)

    result = query.execute()

    return result.data or []


@router.post("/skills", response_model=SkillEntry)
async def create_skill_entry(
    request: CreateSkillEntryRequest,
    authorization: str = Header(None)
):
    """Create a new skill entry."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "user_id": request.user_id,
        "skill_name": request.skill_name,
        "proficiency_level": request.proficiency_level,
        "years_experience": request.years_experience,
        "notes": request.notes,
    }

    result = supabase.table("church_skills_directory").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create skill entry")

    return result.data[0]


@router.put("/skills/{skill_id}/verify", response_model=SkillEntry)
async def verify_skill(
    skill_id: str,
    authorization: str = Header(None)
):
    """Mark a skill as verified by current user."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {
        "verified_by_user_id": user_id,
        "verified_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = supabase.table("church_skills_directory").update(update_data).eq("id", skill_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Skill entry not found")

    return result.data[0]


# =============================================================================
# POSITION CARDS ENDPOINTS
# =============================================================================

@router.get("/positions/cards", response_model=List[PositionCard])
async def list_position_cards(
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List position quick reference cards."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    query = supabase.table("church_position_cards").select("*")

    if department:
        query = query.eq("department", department)
    if search:
        query = query.ilike("position_name", f"%{search}%")

    query = query.order("position_name")
    result = query.execute()

    return result.data or []


@router.get("/positions/cards/{card_id}", response_model=PositionCard)
async def get_position_card(
    card_id: str,
    authorization: str = Header(None)
):
    """Get a single position card by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()
    result = supabase.table("church_position_cards").select("*").eq("id", card_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Position card not found")

    return result.data


@router.post("/positions/cards", response_model=PositionCard)
async def create_position_card(
    request: CreatePositionCardRequest,
    authorization: str = Header(None)
):
    """
    Create a new position quick reference card.
    TODO: Add permission check for position_quick_cards edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    insert_data = {
        "position_name": request.position_name,
        "department": request.department,
        "description": request.description,
        "responsibilities": request.responsibilities,
        "required_skills": request.required_skills,
        "training_modules": request.training_modules,
        "quick_reference": request.quick_reference,
        "created_by_user_id": user_id,
    }

    result = supabase.table("church_position_cards").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create position card")

    return result.data[0]


@router.put("/positions/cards/{card_id}", response_model=PositionCard)
async def update_position_card(
    card_id: str,
    request: UpdatePositionCardRequest,
    authorization: str = Header(None)
):
    """Update a position card."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    supabase = get_supabase_admin_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("church_position_cards").update(update_data).eq("id", card_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Position card not found")

    return result.data[0]
