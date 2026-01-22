"""
Set House Packages API

Endpoints for managing space packages (bundles of spaces).
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/packages", tags=["Set House Packages"])


# ============================================================================
# SCHEMAS
# ============================================================================

class PackageTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    package_daily_rate: Optional[float] = None
    package_weekly_rate: Optional[float] = None
    discount_percent: float = 0


class PackageTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    package_daily_rate: Optional[float] = None
    package_weekly_rate: Optional[float] = None
    discount_percent: Optional[float] = None


class PackageTemplateItemAdd(BaseModel):
    space_id: Optional[str] = None
    category_id: Optional[str] = None
    item_description: Optional[str] = None
    is_required: bool = True
    notes: Optional[str] = None


class PackageInstanceCreate(BaseModel):
    name: str
    template_id: Optional[str] = None
    notes: Optional[str] = None


class PackageInstanceUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    hourly_rate: Optional[float] = None
    half_day_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    discount_percent: Optional[float] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# PACKAGE TEMPLATE ENDPOINTS
# ============================================================================

@router.get("/{org_id}/templates")
async def list_package_templates(
    org_id: str,
    user=Depends(get_current_user)
):
    """List package templates for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    templates = set_house_service.list_package_templates(org_id)
    return {"templates": templates}


@router.post("/{org_id}/templates")
async def create_package_template(
    org_id: str,
    data: PackageTemplateCreate,
    user=Depends(get_current_user)
):
    """Create a new package template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    template = set_house_service.create_package_template(
        org_id,
        data.name,
        profile_id,
        **data.model_dump(exclude={"name"})
    )

    if not template:
        raise HTTPException(status_code=500, detail="Failed to create package template")

    return {"template": template}


@router.get("/{org_id}/templates/{template_id}")
async def get_package_template(
    org_id: str,
    template_id: str,
    user=Depends(get_current_user)
):
    """Get a package template with its items."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    template = execute_single(
        """
        SELECT pt.*, c.name as category_name
        FROM set_house_package_templates pt
        LEFT JOIN set_house_categories c ON c.id = pt.category_id
        WHERE pt.id = :template_id AND pt.organization_id = :org_id
        """,
        {"template_id": template_id, "org_id": org_id}
    )

    if not template:
        raise HTTPException(status_code=404, detail="Package template not found")

    items = execute_query(
        """
        SELECT pti.*, s.name as space_name, s.internal_id as space_internal_id,
               c.name as category_name
        FROM set_house_package_template_items pti
        LEFT JOIN set_house_spaces s ON s.id = pti.space_id
        LEFT JOIN set_house_categories c ON c.id = pti.category_id
        WHERE pti.template_id = :template_id
        ORDER BY pti.sort_order
        """,
        {"template_id": template_id}
    )

    template["items"] = items
    return {"template": template}


@router.put("/{org_id}/templates/{template_id}")
async def update_package_template(
    org_id: str,
    template_id: str,
    data: PackageTemplateUpdate,
    user=Depends(get_current_user)
):
    """Update a package template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "template_id": template_id, "org_id": org_id}

    template = execute_insert(
        f"""
        UPDATE set_house_package_templates
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :template_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not template:
        raise HTTPException(status_code=404, detail="Package template not found")

    return {"template": template}


@router.delete("/{org_id}/templates/{template_id}")
async def delete_package_template(
    org_id: str,
    template_id: str,
    user=Depends(get_current_user)
):
    """Delete a package template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_update

    execute_update(
        """
        UPDATE set_house_package_templates
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = :template_id AND organization_id = :org_id
        """,
        {"template_id": template_id, "org_id": org_id}
    )

    return {"success": True}


@router.post("/{org_id}/templates/{template_id}/items")
async def add_template_item(
    org_id: str,
    template_id: str,
    data: PackageTemplateItemAdd,
    user=Depends(get_current_user)
):
    """Add an item to a package template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_single

    # Get max sort order
    max_order = execute_single(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM set_house_package_template_items WHERE template_id = :template_id",
        {"template_id": template_id}
    )

    item = execute_insert(
        """
        INSERT INTO set_house_package_template_items (
            template_id, space_id, category_id, item_description, is_required, notes, sort_order
        ) VALUES (
            :template_id, :space_id, :category_id, :item_description, :is_required, :notes, :sort_order
        )
        RETURNING *
        """,
        {
            "template_id": template_id,
            "space_id": data.space_id,
            "category_id": data.category_id,
            "item_description": data.item_description,
            "is_required": data.is_required,
            "notes": data.notes,
            "sort_order": max_order["next_order"] if max_order else 1
        }
    )

    return {"item": item}


@router.delete("/{org_id}/templates/{template_id}/items/{item_id}")
async def remove_template_item(
    org_id: str,
    template_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from a package template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_update

    execute_update(
        "DELETE FROM set_house_package_template_items WHERE id = :item_id AND template_id = :template_id",
        {"item_id": item_id, "template_id": template_id}
    )

    return {"success": True}


# ============================================================================
# PACKAGE INSTANCE ENDPOINTS
# ============================================================================

@router.get("/{org_id}/instances")
async def list_package_instances(
    org_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List package instances for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query, execute_single

    conditions = ["pi.organization_id = :org_id", "pi.is_active = TRUE"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("pi.status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_package_instances pi WHERE {where_clause}",
        params
    )

    instances = execute_query(
        f"""
        SELECT pi.*, pt.name as template_name,
               (SELECT COUNT(*) FROM set_house_package_memberships pm WHERE pm.package_instance_id = pi.id) as space_count
        FROM set_house_package_instances pi
        LEFT JOIN set_house_package_templates pt ON pt.id = pi.template_id
        WHERE {where_clause}
        ORDER BY pi.name
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"instances": instances, "total": count_result["total"] if count_result else 0}


@router.get("/{org_id}/instances/{instance_id}")
async def get_package_instance(
    org_id: str,
    instance_id: str,
    user=Depends(get_current_user)
):
    """Get a package instance with its spaces."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    instance = execute_single(
        """
        SELECT pi.*, pt.name as template_name,
               (SELECT COUNT(*) FROM set_house_package_memberships pm WHERE pm.package_instance_id = pi.id) as space_count
        FROM set_house_package_instances pi
        LEFT JOIN set_house_package_templates pt ON pt.id = pi.template_id
        WHERE pi.id = :instance_id AND pi.organization_id = :org_id
        """,
        {"instance_id": instance_id, "org_id": org_id}
    )

    if not instance:
        raise HTTPException(status_code=404, detail="Package instance not found")

    # Get the spaces in this package
    contents = execute_query(
        """
        SELECT pm.*, s.name as space_name, s.internal_id as space_internal_id,
               s.status as space_status, s.square_footage, s.space_type
        FROM set_house_package_memberships pm
        LEFT JOIN set_house_spaces s ON s.id = pm.space_id
        WHERE pm.package_instance_id = :instance_id
        ORDER BY pm.sort_order
        """,
        {"instance_id": instance_id}
    )

    instance["contents"] = contents
    return {"instance": instance}


@router.post("/{org_id}/instances")
async def create_package_instance(
    org_id: str,
    data: PackageInstanceCreate,
    user=Depends(get_current_user)
):
    """Create a new package instance."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    instance = execute_insert(
        """
        INSERT INTO set_house_package_instances (
            organization_id, name, template_id, notes, created_by
        ) VALUES (
            :org_id, :name, :template_id, :notes, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": data.name,
            "template_id": data.template_id,
            "notes": data.notes,
            "created_by": profile_id
        }
    )

    if not instance:
        raise HTTPException(status_code=500, detail="Failed to create package instance")

    return {"instance": instance}


@router.put("/{org_id}/instances/{instance_id}")
async def update_package_instance(
    org_id: str,
    instance_id: str,
    data: PackageInstanceUpdate,
    user=Depends(get_current_user)
):
    """Update a package instance including pricing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "instance_id": instance_id, "org_id": org_id}

    instance = execute_insert(
        f"""
        UPDATE set_house_package_instances
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :instance_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not instance:
        raise HTTPException(status_code=404, detail="Package instance not found")

    return {"instance": instance}


@router.post("/{org_id}/instances/{instance_id}/spaces/{space_id}")
async def add_space_to_instance(
    org_id: str,
    instance_id: str,
    space_id: str,
    slot_name: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Add a space to a package instance."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_single

    max_order = execute_single(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM set_house_package_memberships WHERE package_instance_id = :instance_id",
        {"instance_id": instance_id}
    )

    membership = execute_insert(
        """
        INSERT INTO set_house_package_memberships (
            package_instance_id, space_id, slot_name, sort_order, added_by
        ) VALUES (
            :instance_id, :space_id, :slot_name, :sort_order, :added_by
        )
        ON CONFLICT (package_instance_id, space_id) DO UPDATE SET
            slot_name = :slot_name, sort_order = :sort_order
        RETURNING *
        """,
        {
            "instance_id": instance_id,
            "space_id": space_id,
            "slot_name": slot_name,
            "sort_order": max_order["next_order"] if max_order else 1,
            "added_by": profile_id
        }
    )

    return {"membership": membership}


@router.delete("/{org_id}/instances/{instance_id}/spaces/{space_id}")
async def remove_space_from_instance(
    org_id: str,
    instance_id: str,
    space_id: str,
    user=Depends(get_current_user)
):
    """Remove a space from a package instance."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_update

    execute_update(
        "DELETE FROM set_house_package_memberships WHERE package_instance_id = :instance_id AND space_id = :space_id",
        {"instance_id": instance_id, "space_id": space_id}
    )

    return {"success": True}
