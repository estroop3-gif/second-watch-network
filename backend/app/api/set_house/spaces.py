"""
Set House Spaces API

Endpoints for managing spaces (studios, locations, stages).
"""
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/spaces", tags=["Set House Spaces"])


# ============================================================================
# SCHEMAS
# ============================================================================

class SpaceCreate(BaseModel):
    name: str
    space_type: str = "studio"
    description: Optional[str] = None
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    # Physical attributes
    square_footage: Optional[int] = None
    ceiling_height_feet: Optional[float] = None
    dimensions: Optional[str] = None
    max_occupancy: Optional[int] = None
    features: Optional[dict] = None
    amenities: Optional[List[str]] = None
    # Pricing
    hourly_rate: Optional[float] = None
    half_day_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    # Insurance
    insurance_required: bool = False
    minimum_insurance_coverage: Optional[float] = None
    # Notes
    notes: Optional[str] = None
    access_instructions: Optional[str] = None
    parking_info: Optional[str] = None
    loading_dock_info: Optional[str] = None


class SpaceUpdate(BaseModel):
    name: Optional[str] = None
    space_type: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    location_id: Optional[str] = None
    square_footage: Optional[int] = None
    ceiling_height_feet: Optional[float] = None
    dimensions: Optional[str] = None
    max_occupancy: Optional[int] = None
    features: Optional[dict] = None
    amenities: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    half_day_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    insurance_required: Optional[bool] = None
    minimum_insurance_coverage: Optional[float] = None
    current_condition: Optional[str] = None
    condition_notes: Optional[str] = None
    notes: Optional[str] = None
    access_instructions: Optional[str] = None
    parking_info: Optional[str] = None
    loading_dock_info: Optional[str] = None
    status: Optional[str] = None


class SpaceStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class BulkSpaceCreate(BaseModel):
    spaces: List[SpaceCreate]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# SPACE ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_spaces(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    space_type: Optional[str] = Query(None, description="Filter by space type"),
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List spaces for an organization with filtering."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_spaces(
        org_id,
        status=status,
        category_id=category_id,
        location_id=location_id,
        space_type=space_type,
        search=search,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_space(
    org_id: str,
    data: SpaceCreate,
    user=Depends(get_current_user)
):
    """Create a new space."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    space = set_house_service.create_space(
        org_id,
        data.name,
        profile_id,
        **data.model_dump(exclude={"name"})
    )

    if not space:
        raise HTTPException(status_code=500, detail="Failed to create space")

    return {"space": space}


@router.post("/{org_id}/bulk")
async def bulk_create_spaces(
    org_id: str,
    data: BulkSpaceCreate,
    user=Depends(get_current_user)
):
    """Bulk create spaces."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    created = []
    errors = []

    for i, space_data in enumerate(data.spaces):
        try:
            space = set_house_service.create_space(
                org_id,
                space_data.name,
                profile_id,
                **space_data.model_dump(exclude={"name"})
            )
            if space:
                created.append(space)
            else:
                errors.append({"index": i, "name": space_data.name, "error": "Failed to create"})
        except Exception as e:
            errors.append({"index": i, "name": space_data.name, "error": str(e)})

    return {"created": created, "errors": errors, "total_created": len(created)}


@router.get("/item/{space_id}")
async def get_space(
    space_id: str,
    user=Depends(get_current_user)
):
    """Get a single space by ID."""
    profile_id = get_profile_id(user)

    space = set_house_service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    require_org_access(str(space["organization_id"]), profile_id)

    # Get images
    from app.core.database import execute_query
    images = execute_query(
        """
        SELECT * FROM set_house_space_images
        WHERE space_id = :space_id
        ORDER BY is_primary DESC, sort_order
        """,
        {"space_id": space_id}
    )
    space["images"] = images

    return {"space": space}


@router.put("/item/{space_id}")
async def update_space(
    space_id: str,
    data: SpaceUpdate,
    user=Depends(get_current_user)
):
    """Update a space."""
    profile_id = get_profile_id(user)

    space = set_house_service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    require_org_access(str(space["organization_id"]), profile_id, ["owner", "admin", "manager"])

    updates = data.model_dump(exclude_unset=True)
    updated_space = set_house_service.update_space(space_id, updates)

    return {"space": updated_space}


@router.put("/item/{space_id}/status")
async def update_space_status(
    space_id: str,
    data: SpaceStatusUpdate,
    user=Depends(get_current_user)
):
    """Update space status."""
    profile_id = get_profile_id(user)

    space = set_house_service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    require_org_access(str(space["organization_id"]), profile_id, ["owner", "admin", "manager"])

    updated_space = set_house_service.update_space(space_id, {
        "status": data.status,
        "condition_notes": data.notes
    })

    return {"space": updated_space}


@router.delete("/item/{space_id}")
async def delete_space(
    space_id: str,
    user=Depends(get_current_user)
):
    """Soft delete a space."""
    profile_id = get_profile_id(user)

    space = set_house_service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    require_org_access(str(space["organization_id"]), profile_id, ["owner", "admin"])

    success = set_house_service.delete_space(space_id)

    return {"success": success}


# ============================================================================
# SPACE IMAGE ENDPOINTS
# ============================================================================

@router.post("/item/{space_id}/images")
async def add_space_image(
    space_id: str,
    image_url: str,
    caption: Optional[str] = None,
    is_primary: bool = False,
    user=Depends(get_current_user)
):
    """Add an image to a space."""
    profile_id = get_profile_id(user)

    space = set_house_service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    require_org_access(str(space["organization_id"]), profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_update

    # If setting as primary, unset other primaries
    if is_primary:
        execute_update(
            "UPDATE set_house_space_images SET is_primary = FALSE WHERE space_id = :space_id",
            {"space_id": space_id}
        )

    image = execute_insert(
        """
        INSERT INTO set_house_space_images (space_id, image_url, caption, is_primary, uploaded_by)
        VALUES (:space_id, :image_url, :caption, :is_primary, :uploaded_by)
        RETURNING *
        """,
        {
            "space_id": space_id,
            "image_url": image_url,
            "caption": caption,
            "is_primary": is_primary,
            "uploaded_by": profile_id
        }
    )

    return {"image": image}


@router.delete("/item/{space_id}/images/{image_id}")
async def remove_space_image(
    space_id: str,
    image_id: str,
    user=Depends(get_current_user)
):
    """Remove an image from a space."""
    profile_id = get_profile_id(user)

    space = set_house_service.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    require_org_access(str(space["organization_id"]), profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_update
    execute_update(
        "DELETE FROM set_house_space_images WHERE id = :image_id AND space_id = :space_id",
        {"image_id": image_id, "space_id": space_id}
    )

    return {"success": True}
