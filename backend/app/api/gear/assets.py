"""
Gear House Assets API

Endpoints for managing gear assets (inventory items).
"""
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel

from app.core.auth import get_current_user

from app.services import gear_service

router = APIRouter(prefix="/assets", tags=["Gear Assets"])


# ============================================================================
# SCHEMAS
# ============================================================================

class AssetCreate(BaseModel):
    name: str
    asset_type: str = "serialized"
    make: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory: Optional[str] = None
    manufacturer_serial: Optional[str] = None
    location_id: Optional[str] = None
    home_location_id: Optional[str] = None
    # Purchase & Value
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    replacement_cost: Optional[float] = None
    # Rental Rates
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    notes: Optional[str] = None
    # For consumables
    quantity_on_hand: Optional[int] = None
    reorder_point: Optional[int] = None
    unit_of_measure: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory: Optional[str] = None
    manufacturer_serial: Optional[str] = None
    current_location_id: Optional[str] = None
    default_home_location_id: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    current_value: Optional[float] = None
    replacement_cost: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    insurance_policy_id: Optional[str] = None
    insured_value: Optional[float] = None
    condition_notes: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    photos: Optional[List[str]] = None  # Base64 encoded or existing URLs


class AssetStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class BulkAssetCreate(BaseModel):
    assets: List[AssetCreate]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    """Extract profile ID from user dict."""

    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    """Check user has access to organization."""
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# ASSET ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_assets(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    custodian_id: Optional[str] = Query(None, description="Filter by custodian"),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type"),
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List assets for an organization with filtering."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = gear_service.list_assets(
        org_id,
        status=status,
        category_id=category_id,
        custodian_id=custodian_id,
        location_id=location_id,
        search=search,
        asset_type=asset_type,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_asset(
    org_id: str,
    data: AssetCreate,
    user=Depends(get_current_user)
):
    """Create a new asset."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    asset = gear_service.create_asset(
        org_id,
        data.name,
        profile_id,
        **data.model_dump(exclude={"name"})
    )

    if not asset:
        raise HTTPException(status_code=500, detail="Failed to create asset")

    return {"asset": asset}


@router.post("/{org_id}/bulk")
async def bulk_create_assets(
    org_id: str,
    data: BulkAssetCreate,
    user=Depends(get_current_user)
):
    """Bulk create assets."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    created = []
    errors = []

    for i, asset_data in enumerate(data.assets):
        try:
            asset = gear_service.create_asset(
                org_id,
                asset_data.name,
                profile_id,
                **asset_data.model_dump(exclude={"name"})
            )
            if asset:
                created.append(asset)
            else:
                errors.append({"index": i, "name": asset_data.name, "error": "Failed to create"})
        except Exception as e:
            errors.append({"index": i, "name": asset_data.name, "error": str(e)})

    return {"created": created, "errors": errors, "total_created": len(created)}


@router.get("/item/{asset_id}")
async def get_asset(
    asset_id: str,
    user=Depends(get_current_user)
):
    """Get a single asset with full details."""
    profile_id = get_profile_id(user)

    asset = gear_service.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(asset["organization_id"], profile_id)

    return {"asset": asset}


@router.put("/item/{asset_id}")
async def update_asset(
    asset_id: str,
    data: AssetUpdate,
    user=Depends(get_current_user)
):
    """Update an asset."""
    profile_id = get_profile_id(user)

    # Get asset to check org access
    current = gear_service.get_asset(asset_id)
    if not current:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(current["organization_id"], profile_id, ["owner", "admin", "manager"])

    # Only include non-None values
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    # Map photos field to photos_current for database storage
    if "photos" in update_data:
        update_data["photos_current"] = update_data.pop("photos")

    asset = gear_service.update_asset(asset_id, profile_id, **update_data)

    return {"asset": asset}


@router.patch("/item/{asset_id}/status")
async def update_asset_status(
    asset_id: str,
    data: AssetStatusUpdate,
    user=Depends(get_current_user)
):
    """Update asset status."""
    profile_id = get_profile_id(user)

    current = gear_service.get_asset(asset_id)
    if not current:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(current["organization_id"], profile_id, ["owner", "admin", "manager"])

    # Validate status
    valid_statuses = [
        "available", "reserved", "checked_out", "in_transit",
        "quarantined", "under_repair", "retired", "lost"
    ]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    asset = gear_service.update_asset_status(asset_id, data.status, profile_id, data.notes)

    return {"asset": asset}


@router.delete("/item/{asset_id}")
async def delete_asset(
    asset_id: str,
    user=Depends(get_current_user)
):
    """Soft delete an asset (marks as inactive)."""
    profile_id = get_profile_id(user)

    current = gear_service.get_asset(asset_id)
    if not current:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(current["organization_id"], profile_id, ["owner", "admin"])

    from app.core.database import execute_query
    execute_query(
        "UPDATE gear_assets SET is_active = FALSE, updated_at = NOW() WHERE id = :id",
        {"id": asset_id}
    )

    return {"success": True}


@router.get("/item/{asset_id}/history")
async def get_asset_history(
    asset_id: str,
    limit: int = Query(50, le=200),
    user=Depends(get_current_user)
):
    """Get audit history for an asset."""
    profile_id = get_profile_id(user)

    current = gear_service.get_asset(asset_id)
    if not current:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(current["organization_id"], profile_id)

    history = gear_service.get_asset_history(asset_id, limit)

    return {"history": history}


@router.get("/scan/{org_id}/{scan_code}")
async def find_asset_by_scan(
    org_id: str,
    scan_code: str,
    user=Depends(get_current_user)
):
    """Find an asset by barcode or QR code."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    asset = gear_service.get_asset_by_scan_code(org_id, scan_code)

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found with this scan code")

    return {"asset": asset}


@router.get("/{org_id}/stats")
async def get_asset_stats(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get asset statistics for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    # Get counts by status
    status_counts = execute_query(
        """
        SELECT status, COUNT(*) as count
        FROM gear_assets
        WHERE organization_id = :org_id AND is_active = TRUE
        GROUP BY status
        """,
        {"org_id": org_id}
    )

    # Get counts by category
    category_counts = execute_query(
        """
        SELECT c.name as category, COUNT(a.id) as count
        FROM gear_assets a
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE a.organization_id = :org_id AND a.is_active = TRUE
        GROUP BY c.name
        ORDER BY count DESC
        """,
        {"org_id": org_id}
    )

    # Get total value
    value_stats = execute_single(
        """
        SELECT
            COUNT(*) as total_assets,
            COALESCE(SUM(purchase_price), 0) as total_purchase_value,
            COALESCE(SUM(current_value), 0) as total_current_value,
            COALESCE(SUM(replacement_cost), 0) as total_replacement_cost
        FROM gear_assets
        WHERE organization_id = :org_id AND is_active = TRUE
        """,
        {"org_id": org_id}
    )

    return {
        "by_status": {s["status"]: s["count"] for s in status_counts},
        "by_category": category_counts,
        "values": value_stats
    }
