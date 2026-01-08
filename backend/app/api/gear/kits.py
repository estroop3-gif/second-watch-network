"""
Gear House Kits API

Endpoints for managing kit templates and instances.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user

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


class KitVerifyRequest(BaseModel):
    scanned_assets: List[str]


class NestedKitAdd(BaseModel):
    nested_kit_id: str
    slot_name: Optional[str] = None
    sort_order: int = 0


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# TEMPLATE ENDPOINTS
# ============================================================================

@router.get("/{org_id}/templates")
async def list_kit_templates(
    org_id: str,
    user=Depends(get_current_user)
):
    """List kit templates for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    templates = gear_service.list_kit_templates(org_id)
    return {"templates": templates}


@router.post("/{org_id}/templates")
async def create_kit_template(
    org_id: str,
    data: KitTemplateCreate,
    user=Depends(get_current_user)
):
    """Create a new kit template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    template = gear_service.create_kit_template(
        org_id,
        data.name,
        profile_id,
        **data.model_dump(exclude={"name"})
    )

    if not template:
        raise HTTPException(status_code=500, detail="Failed to create kit template")

    return {"template": template}


@router.get("/templates/item/{template_id}")
async def get_kit_template(
    template_id: str,
    user=Depends(get_current_user)
):
    """Get kit template with items."""
    profile_id = get_profile_id(user)

    template = gear_service.get_kit_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Kit template not found")

    require_org_access(template["organization_id"], profile_id)

    return {"template": template}


class KitTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None


@router.put("/templates/item/{template_id}")
async def update_kit_template(
    template_id: str,
    data: KitTemplateUpdate,
    user=Depends(get_current_user)
):
    """Update a kit template."""
    profile_id = get_profile_id(user)

    template = gear_service.get_kit_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Kit template not found")

    require_org_access(template["organization_id"], profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_single

    update_fields = []
    params = {"template_id": template_id}

    if data.name is not None:
        update_fields.append("name = :name")
        params["name"] = data.name
    if data.description is not None:
        update_fields.append("description = :description")
        params["description"] = data.description
    if data.category_id is not None:
        update_fields.append("category_id = :category_id")
        params["category_id"] = data.category_id

    if update_fields:
        update_fields.append("updated_at = NOW()")
        query = f"""
            UPDATE gear_kit_templates
            SET {', '.join(update_fields)}
            WHERE id = :template_id
            RETURNING *
        """
        updated = execute_single(query, params)
        return {"template": updated}

    return {"template": template}


@router.post("/templates/item/{template_id}/items")
async def add_template_item(
    template_id: str,
    data: KitTemplateItemCreate,
    user=Depends(get_current_user)
):
    """Add an item to a kit template."""
    profile_id = get_profile_id(user)

    template = gear_service.get_kit_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Kit template not found")

    require_org_access(template["organization_id"], profile_id, ["owner", "admin", "manager"])

    item = gear_service.add_kit_template_item(template_id, **data.model_dump())

    return {"item": item}


@router.delete("/templates/item/{template_id}/items/{item_id}")
async def remove_template_item(
    template_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from a kit template."""
    profile_id = get_profile_id(user)

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

@router.get("/{org_id}/instances")
async def list_kit_instances(
    org_id: str,
    status: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    """List kit instances for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    instances = gear_service.list_kit_instances(org_id, status, location_id)
    return {"instances": instances}


@router.post("/{org_id}/instances")
async def create_kit_instance(
    org_id: str,
    data: KitInstanceCreate,
    user=Depends(get_current_user)
):
    """Create a new kit instance."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    instance = gear_service.create_kit_instance(
        org_id,
        data.name,
        profile_id,
        **data.model_dump(exclude={"name"})
    )

    if not instance:
        raise HTTPException(status_code=500, detail="Failed to create kit instance")

    return {"instance": instance}


@router.get("/instances/item/{kit_id}")
async def get_kit_instance(
    kit_id: str,
    user=Depends(get_current_user)
):
    """Get kit instance with contents."""
    profile_id = get_profile_id(user)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id)

    return {"kit": kit}


class KitInstanceUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    location_id: Optional[str] = None
    status: Optional[str] = None


@router.put("/instances/item/{kit_id}")
async def update_kit_instance(
    kit_id: str,
    data: KitInstanceUpdate,
    user=Depends(get_current_user)
):
    """Update a kit instance."""
    profile_id = get_profile_id(user)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_single

    update_fields = []
    params = {"kit_id": kit_id}

    if data.name is not None:
        update_fields.append("name = :name")
        params["name"] = data.name
    if data.notes is not None:
        update_fields.append("notes = :notes")
        params["notes"] = data.notes
    if data.location_id is not None:
        update_fields.append("current_location_id = :location_id")
        params["location_id"] = data.location_id
    if data.status is not None:
        update_fields.append("status = :status")
        params["status"] = data.status

    if update_fields:
        update_fields.append("updated_at = NOW()")
        query = f"""
            UPDATE gear_kit_instances
            SET {', '.join(update_fields)}
            WHERE id = :kit_id
            RETURNING *
        """
        updated = execute_single(query, params)
        return {"kit": updated}

    return {"kit": kit}


@router.post("/instances/item/{kit_id}/assets")
async def add_asset_to_kit(
    kit_id: str,
    data: KitAssetAdd,
    user=Depends(get_current_user)
):
    """Add an asset to a kit instance."""
    profile_id = get_profile_id(user)

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
    user=Depends(get_current_user)
):
    """Remove an asset from a kit instance."""
    profile_id = get_profile_id(user)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id, ["owner", "admin", "manager"])

    gear_service.remove_asset_from_kit(kit_id, asset_id)

    return {"success": True}


@router.post("/instances/item/{kit_id}/verify")
async def verify_kit_contents(
    kit_id: str,
    data: KitVerifyRequest,
    user=Depends(get_current_user)
):
    """Verify kit contents against scanned assets."""
    profile_id = get_profile_id(user)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id)

    scanned_assets = data.scanned_assets

    # Get ALL expected contents (all items in the kit, regardless of current is_present status)
    expected = {c["asset_id"] for c in kit.get("contents", [])}
    scanned_set = set(scanned_assets)

    missing = expected - scanned_set  # In kit but not scanned
    extra = scanned_set - expected    # Scanned but not in kit
    matched = expected & scanned_set  # Both in kit and scanned

    from app.core.database import execute_query

    # Update verification timestamps and is_present for matched items
    for asset_id in matched:
        execute_query(
            """
            UPDATE gear_kit_memberships
            SET last_verified_at = NOW(), is_present = TRUE
            WHERE kit_instance_id = :kit_id AND asset_id = :asset_id
            """,
            {"kit_id": kit_id, "asset_id": asset_id}
        )

    # Mark missing items as not present
    for asset_id in missing:
        execute_query(
            """
            UPDATE gear_kit_memberships
            SET is_present = FALSE
            WHERE kit_instance_id = :kit_id AND asset_id = :asset_id
            """,
            {"kit_id": kit_id, "asset_id": asset_id}
        )

    return {
        "matched": list(matched),
        "missing": list(missing),
        "extra": list(extra),
        "is_complete": len(missing) == 0
    }


# ============================================================================
# NESTED KIT ENDPOINTS
# ============================================================================

@router.post("/instances/item/{kit_id}/nested-kits")
async def add_nested_kit_to_instance(
    kit_id: str,
    data: NestedKitAdd,
    user=Depends(get_current_user)
):
    """
    Add a nested kit instance to a parent kit.

    Enforces 2-level nesting maximum - cannot add a kit that already contains sub-kits.
    """
    profile_id = get_profile_id(user)

    # Validate parent kit exists
    parent_kit = gear_service.get_kit_instance(kit_id)
    if not parent_kit:
        raise HTTPException(status_code=404, detail="Parent kit instance not found")

    require_org_access(parent_kit["organization_id"], profile_id, ["owner", "admin", "manager"])

    # Validate nested kit exists and is in same org
    nested_kit = gear_service.get_kit_instance(data.nested_kit_id)
    if not nested_kit:
        raise HTTPException(status_code=404, detail="Nested kit instance not found")

    if nested_kit["organization_id"] != parent_kit["organization_id"]:
        raise HTTPException(status_code=400, detail="Nested kit must belong to the same organization")

    # Cannot nest a kit into itself
    if data.nested_kit_id == kit_id:
        raise HTTPException(status_code=400, detail="Cannot nest a kit into itself")

    # Check 2-level depth limit - nested kit cannot already have sub-kits
    if not gear_service.validate_kit_nesting_depth(data.nested_kit_id):
        raise HTTPException(
            status_code=400,
            detail="Cannot nest a kit that already contains sub-kits (2-level maximum)"
        )

    # Check if parent kit is already a sub-kit of another kit (would exceed 2 levels)
    if not gear_service.validate_kit_can_have_subkits(kit_id):
        raise HTTPException(
            status_code=400,
            detail="This kit is already nested inside another kit (2-level maximum)"
        )

    # Add the nested kit
    membership = gear_service.add_nested_kit_to_instance(
        kit_id,
        data.nested_kit_id,
        profile_id,
        data.slot_name,
        data.sort_order
    )

    if not membership:
        raise HTTPException(status_code=500, detail="Failed to add nested kit")

    return {"membership": membership}


@router.delete("/instances/item/{kit_id}/nested-kits/{nested_kit_id}")
async def remove_nested_kit_from_instance(
    kit_id: str,
    nested_kit_id: str,
    user=Depends(get_current_user)
):
    """Remove a nested kit from a parent kit."""
    profile_id = get_profile_id(user)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit instance not found")

    require_org_access(kit["organization_id"], profile_id, ["owner", "admin", "manager"])

    gear_service.remove_nested_kit_from_instance(kit_id, nested_kit_id)

    return {"success": True}
