"""
Church Resources API - Rooms, Gear, Reservations, Patch Matrices, Camera Plots
Section E: Gear & Routing
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

class Room(BaseModel):
    id: str
    org_id: Optional[str] = None
    name: str
    location: Optional[str] = None
    campus_id: Optional[str] = None
    capacity: Optional[int] = None
    room_type: str = "general"
    amenities: List[str] = []
    equipment: List[str] = []
    notes: Optional[str] = None
    is_active: bool = True
    created_at: str
    updated_at: str


class CreateRoomRequest(BaseModel):
    name: str
    location: Optional[str] = None
    campus_id: Optional[str] = None
    capacity: Optional[int] = None
    room_type: str = "general"
    amenities: List[str] = []
    equipment: List[str] = []
    notes: Optional[str] = None


class UpdateRoomRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    campus_id: Optional[str] = None
    capacity: Optional[int] = None
    room_type: Optional[str] = None
    amenities: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GearItem(BaseModel):
    id: str
    org_id: Optional[str] = None
    name: str
    category: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    location: Optional[str] = None
    room_id: Optional[str] = None
    status: str = "available"
    condition: str = "good"
    purchase_date: Optional[str] = None
    purchase_price: Optional[str] = None
    warranty_expiration: Optional[str] = None
    notes: Optional[str] = None
    specs: Dict[str, Any] = {}
    created_at: str
    updated_at: str


class CreateGearItemRequest(BaseModel):
    name: str
    category: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    location: Optional[str] = None
    room_id: Optional[str] = None
    condition: str = "good"
    purchase_date: Optional[str] = None
    purchase_price: Optional[str] = None
    warranty_expiration: Optional[str] = None
    notes: Optional[str] = None
    specs: Dict[str, Any] = {}


class UpdateGearItemRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    location: Optional[str] = None
    room_id: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None
    specs: Optional[Dict[str, Any]] = None


class Reservation(BaseModel):
    id: str
    org_id: Optional[str] = None
    resource_type: str  # "room" or "gear"
    resource_id: str
    reserved_by_user_id: str
    title: str
    description: Optional[str] = None
    start_datetime: str
    end_datetime: str
    status: str = "pending"
    approved_by_user_id: Optional[str] = None
    approved_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class CreateReservationRequest(BaseModel):
    resource_type: str
    resource_id: str
    title: str
    description: Optional[str] = None
    start_datetime: str
    end_datetime: str
    notes: Optional[str] = None


class UpdateReservationRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PatchMatrix(BaseModel):
    id: str
    org_id: Optional[str] = None
    name: str
    location: Optional[str] = None
    room_id: Optional[str] = None
    description: Optional[str] = None
    matrix_data: Dict[str, Any] = {}
    inputs: List[Dict[str, Any]] = []
    outputs: List[Dict[str, Any]] = []
    patches: List[Dict[str, Any]] = []
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreatePatchMatrixRequest(BaseModel):
    name: str
    location: Optional[str] = None
    room_id: Optional[str] = None
    description: Optional[str] = None
    matrix_data: Dict[str, Any] = {}
    inputs: List[Dict[str, Any]] = []
    outputs: List[Dict[str, Any]] = []
    patches: List[Dict[str, Any]] = []


class UpdatePatchMatrixRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    room_id: Optional[str] = None
    description: Optional[str] = None
    matrix_data: Optional[Dict[str, Any]] = None
    inputs: Optional[List[Dict[str, Any]]] = None
    outputs: Optional[List[Dict[str, Any]]] = None
    patches: Optional[List[Dict[str, Any]]] = None


class CameraPlot(BaseModel):
    id: str
    org_id: Optional[str] = None
    name: str
    venue: Optional[str] = None
    room_id: Optional[str] = None
    event_type: Optional[str] = None
    description: Optional[str] = None
    plot_data: Dict[str, Any] = {}
    cameras: List[Dict[str, Any]] = []
    notes: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: str
    updated_at: str


class CreateCameraPlotRequest(BaseModel):
    name: str
    venue: Optional[str] = None
    room_id: Optional[str] = None
    event_type: Optional[str] = None
    description: Optional[str] = None
    plot_data: Dict[str, Any] = {}
    cameras: List[Dict[str, Any]] = []
    notes: Optional[str] = None


class UpdateCameraPlotRequest(BaseModel):
    name: Optional[str] = None
    venue: Optional[str] = None
    room_id: Optional[str] = None
    event_type: Optional[str] = None
    description: Optional[str] = None
    plot_data: Optional[Dict[str, Any]] = None
    cameras: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None


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
# ROOM ENDPOINTS
# =============================================================================

@router.get("/resources/rooms", response_model=List[Room])
async def list_rooms(
    room_type: Optional[str] = Query(None),
    campus_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    authorization: str = Header(None)
):
    """
    List rooms with optional filtering.
    TODO: Add org_id filtering once org system is implemented.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_rooms").select("*")

    if room_type:
        query = query.eq("room_type", room_type)
    if campus_id:
        query = query.eq("campus_id", campus_id)
    if is_active is not None:
        query = query.eq("is_active", is_active)

    query = query.order("name")
    result = query.execute()

    return result.data or []


@router.get("/resources/rooms/{room_id}", response_model=Room)
async def get_room(
    room_id: str,
    authorization: str = Header(None)
):
    """Get a single room by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_rooms").select("*").eq("id", room_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Room not found")

    return result.data


@router.post("/resources/rooms", response_model=Room)
async def create_room(
    request: CreateRoomRequest,
    authorization: str = Header(None)
):
    """
    Create a new room.
    TODO: Add permission check for room_reservation_board edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "name": request.name,
        "location": request.location,
        "campus_id": request.campus_id,
        "capacity": request.capacity,
        "room_type": request.room_type,
        "amenities": request.amenities,
        "equipment": request.equipment,
        "notes": request.notes,
        "is_active": True,
    }

    result = client.table("church_rooms").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create room")

    return result.data[0]


@router.put("/resources/rooms/{room_id}", response_model=Room)
async def update_room(
    room_id: str,
    request: UpdateRoomRequest,
    authorization: str = Header(None)
):
    """Update a room."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_rooms").update(update_data).eq("id", room_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Room not found")

    return result.data[0]


# =============================================================================
# GEAR INVENTORY ENDPOINTS
# =============================================================================

@router.get("/resources/gear", response_model=List[GearItem])
async def list_gear(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    room_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    authorization: str = Header(None)
):
    """List gear items with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_gear").select("*")

    if category:
        query = query.eq("category", category)
    if status:
        query = query.eq("status", status)
    if room_id:
        query = query.eq("room_id", room_id)
    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.order("category").order("name").limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/resources/gear/{gear_id}", response_model=GearItem)
async def get_gear_item(
    gear_id: str,
    authorization: str = Header(None)
):
    """Get a single gear item by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_gear").select("*").eq("id", gear_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Gear item not found")

    return result.data


@router.post("/resources/gear", response_model=GearItem)
async def create_gear_item(
    request: CreateGearItemRequest,
    authorization: str = Header(None)
):
    """
    Create a new gear item.
    TODO: Add permission check for gear_inventory edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "name": request.name,
        "category": request.category,
        "manufacturer": request.manufacturer,
        "model": request.model,
        "serial_number": request.serial_number,
        "asset_tag": request.asset_tag,
        "location": request.location,
        "room_id": request.room_id,
        "status": "available",
        "condition": request.condition,
        "purchase_date": request.purchase_date,
        "purchase_price": request.purchase_price,
        "warranty_expiration": request.warranty_expiration,
        "notes": request.notes,
        "specs": request.specs,
    }

    result = client.table("church_gear").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create gear item")

    return result.data[0]


@router.put("/resources/gear/{gear_id}", response_model=GearItem)
async def update_gear_item(
    gear_id: str,
    request: UpdateGearItemRequest,
    authorization: str = Header(None)
):
    """Update a gear item."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_gear").update(update_data).eq("id", gear_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Gear item not found")

    return result.data[0]


@router.get("/resources/gear/categories/list")
async def list_gear_categories(
    authorization: str = Header(None)
):
    """Get list of unique gear categories."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_gear").select("category").execute()

    categories = list(set([item["category"] for item in result.data if item.get("category")]))
    return sorted(categories)


# =============================================================================
# RESERVATION ENDPOINTS
# =============================================================================

@router.get("/resources/reservations", response_model=List[Reservation])
async def list_reservations(
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """List reservations with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_reservations").select("*")

    if resource_type:
        query = query.eq("resource_type", resource_type)
    if resource_id:
        query = query.eq("resource_id", resource_id)
    if status:
        query = query.eq("status", status)
    if start_date:
        query = query.gte("start_datetime", start_date)
    if end_date:
        query = query.lte("end_datetime", end_date)

    query = query.order("start_datetime", desc=False).limit(limit)
    result = query.execute()

    return result.data or []


@router.get("/resources/reservations/mine", response_model=List[Reservation])
async def list_my_reservations(
    authorization: str = Header(None)
):
    """List current user's reservations."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_reservations").select("*").eq("reserved_by_user_id", user_id).order("start_datetime", desc=False).execute()

    return result.data or []


@router.post("/resources/reservations", response_model=Reservation)
async def create_reservation(
    request: CreateReservationRequest,
    authorization: str = Header(None)
):
    """
    Create a new reservation.
    TODO: Add conflict checking for overlapping reservations.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "resource_type": request.resource_type,
        "resource_id": request.resource_id,
        "reserved_by_user_id": user_id,
        "title": request.title,
        "description": request.description,
        "start_datetime": request.start_datetime,
        "end_datetime": request.end_datetime,
        "status": "pending",
        "notes": request.notes,
    }

    result = client.table("church_reservations").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create reservation")

    return result.data[0]


@router.put("/resources/reservations/{reservation_id}", response_model=Reservation)
async def update_reservation(
    reservation_id: str,
    request: UpdateReservationRequest,
    authorization: str = Header(None)
):
    """Update a reservation."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_reservations").update(update_data).eq("id", reservation_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Reservation not found")

    return result.data[0]


@router.post("/resources/reservations/{reservation_id}/approve", response_model=Reservation)
async def approve_reservation(
    reservation_id: str,
    authorization: str = Header(None)
):
    """
    Approve a reservation.
    TODO: Add permission check for reservation approval.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {
        "status": "approved",
        "approved_by_user_id": user_id,
        "approved_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("church_reservations").update(update_data).eq("id", reservation_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Reservation not found")

    return result.data[0]


@router.delete("/resources/reservations/{reservation_id}")
async def cancel_reservation(
    reservation_id: str,
    authorization: str = Header(None)
):
    """Cancel a reservation."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {
        "status": "cancelled",
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("church_reservations").update(update_data).eq("id", reservation_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Reservation not found")

    return {"success": True, "cancelled_id": reservation_id}


# =============================================================================
# PATCH MATRIX ENDPOINTS
# =============================================================================

@router.get("/resources/patch-matrices", response_model=List[PatchMatrix])
async def list_patch_matrices(
    room_id: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List patch matrices with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_patch_matrices").select("*")

    if room_id:
        query = query.eq("room_id", room_id)

    query = query.order("name")
    result = query.execute()

    return result.data or []


@router.get("/resources/patch-matrices/{matrix_id}", response_model=PatchMatrix)
async def get_patch_matrix(
    matrix_id: str,
    authorization: str = Header(None)
):
    """Get a single patch matrix by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_patch_matrices").select("*").eq("id", matrix_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Patch matrix not found")

    return result.data


@router.post("/resources/patch-matrices", response_model=PatchMatrix)
async def create_patch_matrix(
    request: CreatePatchMatrixRequest,
    authorization: str = Header(None)
):
    """
    Create a new patch matrix.
    TODO: Add permission check for av_patch_matrix edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "name": request.name,
        "location": request.location,
        "room_id": request.room_id,
        "description": request.description,
        "matrix_data": request.matrix_data,
        "inputs": request.inputs,
        "outputs": request.outputs,
        "patches": request.patches,
        "created_by_user_id": user_id,
    }

    result = client.table("church_patch_matrices").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create patch matrix")

    return result.data[0]


@router.put("/resources/patch-matrices/{matrix_id}", response_model=PatchMatrix)
async def update_patch_matrix(
    matrix_id: str,
    request: UpdatePatchMatrixRequest,
    authorization: str = Header(None)
):
    """Update a patch matrix."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_patch_matrices").update(update_data).eq("id", matrix_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Patch matrix not found")

    return result.data[0]


# =============================================================================
# CAMERA PLOT ENDPOINTS
# =============================================================================

@router.get("/resources/camera-plots", response_model=List[CameraPlot])
async def list_camera_plots(
    venue: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List camera plots with optional filtering."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    query = client.table("church_camera_plots").select("*")

    if venue:
        query = query.eq("venue", venue)
    if event_type:
        query = query.eq("event_type", event_type)

    query = query.order("name")
    result = query.execute()

    return result.data or []


@router.get("/resources/camera-plots/{plot_id}", response_model=CameraPlot)
async def get_camera_plot(
    plot_id: str,
    authorization: str = Header(None)
):
    """Get a single camera plot by ID."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()
    result = client.table("church_camera_plots").select("*").eq("id", plot_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Camera plot not found")

    return result.data


@router.post("/resources/camera-plots", response_model=CameraPlot)
async def create_camera_plot(
    request: CreateCameraPlotRequest,
    authorization: str = Header(None)
):
    """
    Create a new camera plot.
    TODO: Add permission check for camera_plot_maker edit access.
    """
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    insert_data = {
        "name": request.name,
        "venue": request.venue,
        "room_id": request.room_id,
        "event_type": request.event_type,
        "description": request.description,
        "plot_data": request.plot_data,
        "cameras": request.cameras,
        "notes": request.notes,
        "created_by_user_id": user_id,
    }

    result = client.table("church_camera_plots").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create camera plot")

    return result.data[0]


@router.put("/resources/camera-plots/{plot_id}", response_model=CameraPlot)
async def update_camera_plot(
    plot_id: str,
    request: UpdateCameraPlotRequest,
    authorization: str = Header(None)
):
    """Update a camera plot."""
    user_id = await get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    client = get_client()

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("church_camera_plots").update(update_data).eq("id", plot_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Camera plot not found")

    return result.data[0]
