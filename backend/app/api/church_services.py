"""
Church Services API - Service Plans, Rehearsals, Tech Positions
Section A: Service Planning and Positions
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from app.core.database import get_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class ServicePlan(BaseModel):
    id: str
    org_id: Optional[str] = None
    service_date: str
    service_name: str
    campus_id: Optional[str] = None
    template_id: Optional[str] = None
    data: Dict[str, Any] = {}
    status: str = "draft"
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateServicePlanRequest(BaseModel):
    service_date: str
    service_name: str
    campus_id: Optional[str] = None
    template_id: Optional[str] = None
    data: Dict[str, Any] = {}
    status: str = "draft"


class UpdateServicePlanRequest(BaseModel):
    service_date: Optional[str] = None
    service_name: Optional[str] = None
    campus_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class RehearsalPlan(BaseModel):
    id: str
    service_plan_id: str
    rehearsal_datetime: str
    data: Dict[str, Any] = {}
    notes: Optional[str] = None
    status: str = "scheduled"
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateRehearsalRequest(BaseModel):
    rehearsal_datetime: str
    data: Dict[str, Any] = {}
    notes: Optional[str] = None
    status: str = "scheduled"


class TechAssignment(BaseModel):
    id: str
    service_plan_id: str
    position_name: str
    user_id: Optional[str] = None
    notes: Optional[str] = None
    status: str = "assigned"
    created_at: str
    updated_at: str


class CreateTechAssignmentRequest(BaseModel):
    position_name: str
    user_id: Optional[str] = None
    notes: Optional[str] = None
    status: str = "assigned"


class UpdateTechAssignmentRequest(BaseModel):
    position_name: Optional[str] = None
    user_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# =============================================================================
# HELPER: Get user ID from auth header
# =============================================================================
async def get_current_user_id(authorization: str = Header(None)) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    try:

        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        return user.get("id") if user else None
    except Exception:
        return None


# =============================================================================
# SERVICE PLANS ENDPOINTS
# =============================================================================

@router.get("/services/plans", response_model=List[ServicePlan])
async def list_service_plans(
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """
    List service plans with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_service_plans").select("*")

    if status:
        query = query.eq("status", status)
    if start_date:
        query = query.gte("service_date", start_date)
    if end_date:
        query = query.lte("service_date", end_date)

    query = query.order("service_date", desc=True).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/services/plans/{plan_id}", response_model=ServicePlan)
async def get_service_plan(
    plan_id: str,
    authorization: str = Header(None)
):
    """Get a single service plan by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_service_plans").select("*").eq("id", plan_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Service plan not found")

    return result.data


@router.post("/services/plans", response_model=ServicePlan)
async def create_service_plan(
    request: CreateServicePlanRequest,
    authorization: str = Header(None)
):
    """
    Create a new service plan.
    TODO: Add permission check for service_run_sheet edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "service_date": request.service_date,
        "service_name": request.service_name,
        "campus_id": request.campus_id,
        "template_id": request.template_id,
        "data": request.data,
        "status": request.status,
        "created_by_user_id": user_id,
    }

    result = client.table("church_service_plans").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create service plan")

    return result.data[0]


@router.put("/services/plans/{plan_id}", response_model=ServicePlan)
async def update_service_plan(
    plan_id: str,
    request: UpdateServicePlanRequest,
    authorization: str = Header(None)
):
    """Update an existing service plan."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_service_plans").update(update_data).eq("id", plan_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Service plan not found")

    return result.data[0]


@router.post("/services/plans/{plan_id}/clone", response_model=ServicePlan)
async def clone_service_plan(
    plan_id: str,
    new_date: str = Query(..., description="Date for the cloned service"),
    authorization: str = Header(None)
):
    """
    Clone an existing service plan to create a new one.
    TODO: Implement full cloning with rehearsals and tech assignments.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    # Get original plan
    original = client.table("church_service_plans").select("*").eq("id", plan_id).single().execute()
    if not original.data:
        raise HTTPException(status_code=404, detail="Original service plan not found")

    # Create clone
    clone_data = {
        "service_date": new_date,
        "service_name": original.data["service_name"],
        "campus_id": original.data.get("campus_id"),
        "template_id": plan_id,  # Reference to original as template
        "data": original.data.get("data", {}),
        "status": "draft",
        "created_by_user_id": user_id,
    }

    result = client.table("church_service_plans").insert(clone_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to clone service plan")

    return result.data[0]


# =============================================================================
# REHEARSAL PLANS ENDPOINTS
# =============================================================================

@router.get("/services/plans/{plan_id}/rehearsals", response_model=List[RehearsalPlan])
async def list_rehearsals(
    plan_id: str,
    authorization: str = Header(None)
):
    """List all rehearsals for a service plan."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_rehearsal_plans").select("*").eq("service_plan_id", plan_id).order("rehearsal_datetime").execute()

    return result.data or []


@router.post("/services/plans/{plan_id}/rehearsals", response_model=RehearsalPlan)
async def create_rehearsal(
    plan_id: str,
    request: CreateRehearsalRequest,
    authorization: str = Header(None)
):
    """Create a new rehearsal for a service plan."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "service_plan_id": plan_id,
        "rehearsal_datetime": request.rehearsal_datetime,
        "data": request.data,
        "notes": request.notes,
        "status": request.status,
        "created_by_user_id": user_id,
    }

    result = client.table("church_rehearsal_plans").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create rehearsal")

    return result.data[0]


# =============================================================================
# TECH POSITION ASSIGNMENTS ENDPOINTS
# =============================================================================

@router.get("/services/plans/{plan_id}/tech-positions", response_model=List[TechAssignment])
async def list_tech_positions(
    plan_id: str,
    authorization: str = Header(None)
):
    """List all tech position assignments for a service plan."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_tech_assignments").select("*").eq("service_plan_id", plan_id).execute()

    return result.data or []


@router.post("/services/plans/{plan_id}/tech-positions", response_model=TechAssignment)
async def create_tech_position(
    plan_id: str,
    request: CreateTechAssignmentRequest,
    authorization: str = Header(None)
):
    """Create a new tech position assignment."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "service_plan_id": plan_id,
        "position_name": request.position_name,
        "user_id": request.user_id,
        "notes": request.notes,
        "status": request.status,
    }

    result = client.table("church_tech_assignments").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create tech position")

    return result.data[0]


@router.put("/services/tech-positions/{assignment_id}", response_model=TechAssignment)
async def update_tech_position(
    assignment_id: str,
    request: UpdateTechAssignmentRequest,
    authorization: str = Header(None)
):
    """Update a tech position assignment."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_tech_assignments").update(update_data).eq("id", assignment_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Tech assignment not found")

    return result.data[0]
