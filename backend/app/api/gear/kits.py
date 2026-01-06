"""
Gear House Kits API

Endpoints for managing kit templates and instances.
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from app.core.auth import get_current_user_from_token
from app.api.users import get_profile_id_from_cognito_id
from app.services import gear_service

router = APIRouter(prefix="/kits", tags=["Gear Kits"])


# ============================================================================
# SCHEMAS
# ============================================================================

class KitTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    scan_mode_required: str = "case_plus_items"
    allow_substitutions: bool = True


class KitTemplateItemCreate(BaseModel):
    asset_id: Optional[str] = None
    category_id: Optional[str] = None
    item_description: Optional[str] = None
    quantity: int = 1
    is_required: bool = True
    notes: Optional[str] = None
    sort_order: int = 0
    nested_template_id: Optional[str] = None


class KitInstanceCreate(BaseModel):
    name: str
    internal_id: Optional[str] = None
    template_id: Optional[str] = None
    case_asset_id: Optional[str] = None
    location_id: Optional[str] = None
    scan_mode_required: str = "case_plus_items"
    notes: Optional[str] = None


class KitAssetAdd(BaseModel):
    asset_id: str
    slot_name: Optional[str] = None
    sort_order: int = 0


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_profile_id(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    user = await get_current_user_from_token(authorization)
    profile_id = get_profile_id_from_cognito_id(user["sub"])
    return profile_id or user["sub"]


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# TEMPLATE ENDPOINTS
# ============================================================================

@router.get("/templates/{org_id}")
async def list_kit_templates(
    org_id: str,
    authorization: str = Header(None)
):
    """List kit templates for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    templates = gear_service.list_kit_templates(org_id)
    return {"templates": templates}


@router.post("/templates/{org_id}")
async def create_kit_template(
    org_id: str,
    data: KitTemplateCreate,
    authorization: str = Header(None)
):
    """Create a new kit template."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    template = gear_service.create_kit_template(
        org_id,
        data.name,
        profile_id,
        **data.dict(exclude={"name"})
    )

    if not template:
        raise HTTPException(status_code=500, detail="Failed to create kit template")

    return {"template": template}


@router.get("/templates/item/{template_id}")
async def get_kit_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Get kit template with items."""
    profile_id = await get_current_profile_id(authorization)

    template = gear_service.get_kit_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Kit template not found")

    require_org_access(template["organization_id"], profile_id)

    return {"template": template}


@router.post("/templates/item/{template_id}/items")
async def add_template_item(
    template_id: str,
    data: KitTemplateItemCreate,
    authorization: str = Header(None)
):
    """Add an item to a kit template."""
    profile_id = await get_current_profile_id(authorization)

    template = gear_service.get_kit_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Kit template not found")

    require_org_access(template["organization_id"], profile_id, ["owner", "admin", "manager"])

    item = gear_service.add_kit_template_item(template_id, **data.dict())

    return {"item": item}


@router.delete("/templates/item/{template_id}/items/{item_id}")
async def remove_template_item(
    template_id: str,
    item_id: str,
    authorization: str = Header(None)
):
    """Remove an item from a kit template."""
    profile_id = await get_current_profile_id(authorization)

    template = gear_service.get_kit_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Kit template not found")

    require_org_access(template["organization_id"], profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query
    execute_query(
        "DELETE FROM gear_kit_template_items WHERE id = :item_id AND template_id = :template_id",
        {"item_id": item_id, "template_id": template_id}
    )

    return {"success": True}


# ============================================================================
# INSTANCE ENDPOINTS
# ============================================================================

@router.get("/instances/{org_id}")
async def list_kit_instances(
    org_id: str,
    status: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List kit instances for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    instances = gear_service.list_kit_instances(org_id, status, location_id)
    return {"instances": instances}


@router.post("/instances/{org_id}")
async def create_kit_instance(
    org_id: str,
    data: KitInstanceCreate,
    authorization: str = Header(None)
):
    """Create a new kit instance."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    instance = gear_service.create_kit_instance(
        org_id,
        data.name,
        profile_id,
        **data.dict(exclude={"name"})
    )

    if not instance:
        raise HTTPException(status_code=500, detail="Failed to create kit instance")

    return {"instance": instance}


@router.get("/instances/item/{kit_id}")
async def get_kit_instance(
    kit_id: str,
    authorization: str = Header(None)
):
    """Get kit instance with contents."""
    profile_id = await get_current_profile_id(authorization)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id)

    return {"kit": kit}


@router.post("/instances/item/{kit_id}/assets")
async def add_asset_to_kit(
    kit_id: str,
    data: KitAssetAdd,
    authorization: str = Header(None)
):
    """Add an asset to a kit instance."""
    profile_id = await get_current_profile_id(authorization)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id, ["owner", "admin", "manager"])

    membership = gear_service.add_asset_to_kit(
        kit_id,
        data.asset_id,
        profile_id,
        data.slot_name,
        data.sort_order
    )

    return {"membership": membership}


@router.delete("/instances/item/{kit_id}/assets/{asset_id}")
async def remove_asset_from_kit(
    kit_id: str,
    asset_id: str,
    authorization: str = Header(None)
):
    """Remove an asset from a kit instance."""
    profile_id = await get_current_profile_id(authorization)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id, ["owner", "admin", "manager"])

    gear_service.remove_asset_from_kit(kit_id, asset_id)

    return {"success": True}


@router.post("/instances/item/{kit_id}/verify")
async def verify_kit_contents(
    kit_id: str,
    scanned_assets: List[str],
    authorization: str = Header(None)
):
    """Verify kit contents against scanned assets."""
    profile_id = await get_current_profile_id(authorization)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id)

    # Get expected contents
    expected = {c["asset_id"] for c in kit.get("contents", []) if c.get("is_present")}
    scanned_set = set(scanned_assets)

    missing = expected - scanned_set
    extra = scanned_set - expected
    matched = expected & scanned_set

    # Update verification timestamps
    from app.core.database import execute_query
    if matched:
        execute_query(
            """
            UPDATE gear_kit_memberships
            SET last_verified_at = NOW()
            WHERE kit_instance_id = :kit_id AND asset_id = ANY(:assets)
            """,
            {"kit_id": kit_id, "assets": list(matched)}
        )

    return {
        "matched": list(matched),
        "missing": list(missing),
        "extra": list(extra),
        "is_complete": len(missing) == 0
    }
