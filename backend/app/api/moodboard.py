"""
Moodboard API Endpoints
Handles moodboard management, sections, items, and exports
Visual reference tool for look/feel, tone, wardrobe, locations, lighting
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import csv
import io
import json
import re
import logging

from app.core.database import get_client, execute_query, execute_single

logger = logging.getLogger(__name__)

router = APIRouter()


# =====================================================
# Pydantic Models
# =====================================================

class MoodboardCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None


class MoodboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1)


class SectionUpdate(BaseModel):
    title: Optional[str] = None


class SectionReorder(BaseModel):
    section_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


MOODBOARD_CATEGORIES = ['Lighting', 'Wardrobe', 'Location', 'Props', 'Color', 'Character', 'Mood', 'Other']
ASPECT_RATIOS = ['landscape', 'portrait', 'square']


class ItemCreate(BaseModel):
    section_id: Optional[str] = None
    image_url: str = Field(..., min_length=1)
    source_url: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    rating: Optional[int] = Field(None, ge=0, le=5)
    color_palette: Optional[List[str]] = None
    aspect_ratio: Optional[str] = None

    @field_validator('image_url')
    @classmethod
    def validate_image_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('image_url must start with http:// or https://')
        return v

    @field_validator('source_url')
    @classmethod
    def validate_source_url(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('source_url must start with http:// or https://')
        return v

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v:
            # Trim whitespace and dedupe
            cleaned = list(set([t.strip() for t in v if t.strip()]))
            return cleaned
        return v

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        if v and v not in MOODBOARD_CATEGORIES:
            raise ValueError(f'category must be one of: {", ".join(MOODBOARD_CATEGORIES)}')
        return v

    @field_validator('aspect_ratio')
    @classmethod
    def validate_aspect_ratio(cls, v):
        if v and v not in ASPECT_RATIOS:
            raise ValueError(f'aspect_ratio must be one of: {", ".join(ASPECT_RATIOS)}')
        return v

    @field_validator('color_palette')
    @classmethod
    def validate_color_palette(cls, v):
        if v:
            # Validate hex color format
            import re
            hex_pattern = re.compile(r'^#[0-9A-Fa-f]{6}$')
            for color in v:
                if not hex_pattern.match(color):
                    raise ValueError(f'Invalid hex color: {color}')
        return v


class ItemUpdate(BaseModel):
    section_id: Optional[str] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    rating: Optional[int] = Field(None, ge=0, le=5)
    color_palette: Optional[List[str]] = None
    aspect_ratio: Optional[str] = None

    @field_validator('image_url')
    @classmethod
    def validate_image_url(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('image_url must start with http:// or https://')
        return v

    @field_validator('source_url')
    @classmethod
    def validate_source_url(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('source_url must start with http:// or https://')
        return v

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v:
            cleaned = list(set([t.strip() for t in v if t.strip()]))
            return cleaned
        return v

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        if v and v not in MOODBOARD_CATEGORIES:
            raise ValueError(f'category must be one of: {", ".join(MOODBOARD_CATEGORIES)}')
        return v

    @field_validator('aspect_ratio')
    @classmethod
    def validate_aspect_ratio(cls, v):
        if v and v not in ASPECT_RATIOS:
            raise ValueError(f'aspect_ratio must be one of: {", ".join(ASPECT_RATIOS)}')
        return v

    @field_validator('color_palette')
    @classmethod
    def validate_color_palette(cls, v):
        if v:
            import re
            hex_pattern = re.compile(r'^#[0-9A-Fa-f]{6}$')
            for color in v:
                if not hex_pattern.match(color):
                    raise ValueError(f'Invalid hex color: {color}')
        return v


class ItemReorder(BaseModel):
    item_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


class ItemImageUpload(BaseModel):
    file_name: str
    content_type: str
    file_size: int


# =====================================================
# Helper Functions
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        cognito_id = user.get("user_id") or user.get("sub") or user.get("id")
        if not cognito_id:
            raise HTTPException(status_code=401, detail="No user ID in token")

        from app.api.backlot import get_profile_id_from_cognito_id
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        return {"id": profile_id, "user_id": profile_id, "cognito_id": cognito_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_access(project_id: str, user_id: str) -> bool:
    """Verify user has access to the project."""
    client = get_client()

    project = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.data[0]["owner_id"] == user_id:
        return True

    member = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    if member.data:
        return True

    raise HTTPException(status_code=403, detail="Access denied to this project")


async def verify_moodboard_access(moodboard_id: str, project_id: str) -> Dict[str, Any]:
    """Verify moodboard exists and belongs to project."""
    client = get_client()

    moodboard = client.table("moodboards").select("*").eq("id", moodboard_id).eq("project_id", project_id).execute()
    if not moodboard.data:
        raise HTTPException(status_code=404, detail="Moodboard not found")

    return moodboard.data[0]


def get_next_section_sort_order(moodboard_id: str) -> int:
    """Get next available sort order for a section."""
    client = get_client()
    result = client.table("moodboard_sections").select("sort_order").eq("moodboard_id", moodboard_id).order("sort_order", desc=True).limit(1).execute()
    if result.data:
        return result.data[0]["sort_order"] + 1
    return 1


def get_next_item_sort_order(moodboard_id: str, section_id: Optional[str]) -> int:
    """Get next available sort order for an item within a section."""
    client = get_client()
    query = client.table("moodboard_items").select("sort_order").eq("moodboard_id", moodboard_id)
    if section_id:
        query = query.eq("section_id", section_id)
    else:
        query = query.is_("section_id", "null")
    result = query.order("sort_order", desc=True).limit(1).execute()
    if result.data:
        return result.data[0]["sort_order"] + 1
    return 1


def recompact_item_sort_orders(moodboard_id: str, section_id: Optional[str]):
    """Recompact sort orders for items in a section after move/delete."""
    client = get_client()
    query = client.table("moodboard_items").select("id").eq("moodboard_id", moodboard_id)
    if section_id:
        query = query.eq("section_id", section_id)
    else:
        query = query.is_("section_id", "null")
    items = query.order("sort_order").execute()

    for idx, item in enumerate(items.data or [], start=1):
        client.table("moodboard_items").update({"sort_order": idx}).eq("id", item["id"]).execute()


# =====================================================
# Moodboard Endpoints
# =====================================================

@router.get("/projects/{project_id}/moodboards")
async def list_moodboards(
    project_id: str,
    authorization: str = Header(None)
):
    """List all moodboards for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()
    result = client.table("moodboards").select(
        "id, title, description, created_at, updated_at"
    ).eq("project_id", project_id).order("created_at", desc=True).execute()

    # Get section and item counts for each moodboard
    moodboards = []
    for mb in (result.data or []):
        sections = client.table("moodboard_sections").select("id", count="exact").eq("moodboard_id", mb["id"]).execute()
        items = client.table("moodboard_items").select("id", count="exact").eq("moodboard_id", mb["id"]).execute()
        mb["section_count"] = sections.count or 0
        mb["item_count"] = items.count or 0
        moodboards.append(mb)

    return {"moodboards": moodboards}


@router.post("/projects/{project_id}/moodboards")
async def create_moodboard(
    project_id: str,
    request: MoodboardCreate,
    authorization: str = Header(None)
):
    """Create a new moodboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    moodboard_data = {
        "project_id": project_id,
        "title": request.title,
        "description": request.description,
        "created_by_user_id": user["id"],
    }

    result = client.table("moodboards").insert(moodboard_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create moodboard")

    return result.data[0]


@router.get("/projects/{project_id}/moodboards/{moodboard_id}")
async def get_moodboard(
    project_id: str,
    moodboard_id: str,
    authorization: str = Header(None)
):
    """Get moodboard with sections and items grouped."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get moodboard
    moodboard = client.table("moodboards").select("*").eq("id", moodboard_id).eq("project_id", project_id).execute()
    if not moodboard.data:
        raise HTTPException(status_code=404, detail="Moodboard not found")

    # Get sections ordered
    sections = client.table("moodboard_sections").select("*").eq("moodboard_id", moodboard_id).order("sort_order").execute()

    # Get all items ordered
    items = client.table("moodboard_items").select("*").eq("moodboard_id", moodboard_id).order("sort_order").execute()

    # Group items by section
    items_by_section: Dict[Optional[str], List[Dict]] = {None: []}
    for section in (sections.data or []):
        items_by_section[section["id"]] = []

    for item in (items.data or []):
        section_key = item.get("section_id")
        if section_key in items_by_section:
            items_by_section[section_key].append(item)
        else:
            items_by_section[None].append(item)

    # Derive tag list from all items
    all_tags = set()
    for item in (items.data or []):
        if item.get("tags"):
            all_tags.update(item["tags"])

    # Build response
    result = moodboard.data[0]
    result["sections"] = []
    for section in (sections.data or []):
        section["items"] = items_by_section.get(section["id"], [])
        result["sections"].append(section)

    # Unsorted items (section_id is null)
    result["unsorted_items"] = items_by_section.get(None, [])
    result["all_tags"] = sorted(list(all_tags))

    return result


@router.put("/projects/{project_id}/moodboards/{moodboard_id}")
async def update_moodboard(
    project_id: str,
    moodboard_id: str,
    request: MoodboardUpdate,
    authorization: str = Header(None)
):
    """Update a moodboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title
    if request.description is not None:
        update_data["description"] = request.description

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("moodboards").update(update_data).eq("id", moodboard_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update moodboard")

    return result.data[0]


@router.delete("/projects/{project_id}/moodboards/{moodboard_id}")
async def delete_moodboard(
    project_id: str,
    moodboard_id: str,
    authorization: str = Header(None)
):
    """Delete a moodboard and all its sections/items."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()
    client.table("moodboards").delete().eq("id", moodboard_id).execute()

    return {"success": True}


# =====================================================
# Section Endpoints
# =====================================================

@router.post("/projects/{project_id}/moodboards/{moodboard_id}/sections")
async def create_section(
    project_id: str,
    moodboard_id: str,
    request: SectionCreate,
    authorization: str = Header(None)
):
    """Create a new section in a moodboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    sort_order = get_next_section_sort_order(moodboard_id)

    section_data = {
        "moodboard_id": moodboard_id,
        "title": request.title,
        "sort_order": sort_order,
    }

    result = client.table("moodboard_sections").insert(section_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create section")

    return result.data[0]


@router.put("/projects/{project_id}/moodboards/{moodboard_id}/sections/{section_id}")
async def update_section(
    project_id: str,
    moodboard_id: str,
    section_id: str,
    request: SectionUpdate,
    authorization: str = Header(None)
):
    """Update a section."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Verify section exists
    section = client.table("moodboard_sections").select("id").eq("id", section_id).eq("moodboard_id", moodboard_id).execute()
    if not section.data:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("moodboard_sections").update(update_data).eq("id", section_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update section")

    return result.data[0]


@router.delete("/projects/{project_id}/moodboards/{moodboard_id}/sections/{section_id}")
async def delete_section(
    project_id: str,
    moodboard_id: str,
    section_id: str,
    authorization: str = Header(None)
):
    """Delete a section. Items in it become unsorted."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Verify section exists
    section = client.table("moodboard_sections").select("id, sort_order").eq("id", section_id).eq("moodboard_id", moodboard_id).execute()
    if not section.data:
        raise HTTPException(status_code=404, detail="Section not found")

    deleted_sort_order = section.data[0]["sort_order"]

    # Move items to unsorted (section_id = null) and recompact their sort orders
    client.table("moodboard_items").update({"section_id": None}).eq("section_id", section_id).execute()
    recompact_item_sort_orders(moodboard_id, None)

    # Delete section
    client.table("moodboard_sections").delete().eq("id", section_id).execute()

    # Recompact remaining section sort orders
    remaining = client.table("moodboard_sections").select("id").eq("moodboard_id", moodboard_id).gt("sort_order", deleted_sort_order).order("sort_order").execute()
    for idx, sec in enumerate(remaining.data or []):
        new_order = deleted_sort_order + idx
        client.table("moodboard_sections").update({"sort_order": new_order}).eq("id", sec["id"]).execute()

    return {"success": True}


@router.post("/projects/{project_id}/moodboards/{moodboard_id}/sections/reorder")
async def reorder_section(
    project_id: str,
    moodboard_id: str,
    request: SectionReorder,
    authorization: str = Header(None)
):
    """Reorder a section (swap with adjacent)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Get current section
    current = client.table("moodboard_sections").select("id, sort_order").eq("id", request.section_id).eq("moodboard_id", moodboard_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Section not found")

    current_order = current.data[0]["sort_order"]

    # Find adjacent section
    if request.direction == "UP":
        adjacent = client.table("moodboard_sections").select("id, sort_order").eq("moodboard_id", moodboard_id).lt("sort_order", current_order).order("sort_order", desc=True).limit(1).execute()
    else:
        adjacent = client.table("moodboard_sections").select("id, sort_order").eq("moodboard_id", moodboard_id).gt("sort_order", current_order).order("sort_order").limit(1).execute()

    if not adjacent.data:
        raise HTTPException(status_code=400, detail=f"Cannot move section {request.direction.lower()}")

    adjacent_order = adjacent.data[0]["sort_order"]
    adjacent_id = adjacent.data[0]["id"]

    # Swap sort orders (use temp value to avoid unique constraint)
    temp_order = 999999
    client.table("moodboard_sections").update({"sort_order": temp_order}).eq("id", request.section_id).execute()
    client.table("moodboard_sections").update({"sort_order": current_order}).eq("id", adjacent_id).execute()
    client.table("moodboard_sections").update({"sort_order": adjacent_order}).eq("id", request.section_id).execute()

    return {"success": True}


# =====================================================
# Item Endpoints
# =====================================================

@router.post("/projects/{project_id}/moodboards/{moodboard_id}/items")
async def create_item(
    project_id: str,
    moodboard_id: str,
    request: ItemCreate,
    authorization: str = Header(None)
):
    """Create a new item in a moodboard."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Verify section if provided
    if request.section_id:
        section = client.table("moodboard_sections").select("id").eq("id", request.section_id).eq("moodboard_id", moodboard_id).execute()
        if not section.data:
            raise HTTPException(status_code=404, detail="Section not found")

    sort_order = get_next_item_sort_order(moodboard_id, request.section_id)

    item_data = {
        "project_id": project_id,
        "moodboard_id": moodboard_id,
        "section_id": request.section_id,
        "sort_order": sort_order,
        "image_url": request.image_url,
        "source_url": request.source_url,
        "title": request.title,
        "notes": request.notes,
        "tags": json.dumps(request.tags or []),  # JSONB column
        "category": request.category,
        "rating": request.rating,
        "color_palette": json.dumps(request.color_palette or []),  # JSONB column
        "aspect_ratio": request.aspect_ratio,
        "created_by_user_id": user["id"],
    }

    try:
        result = client.table("moodboard_items").insert(item_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create item")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Error creating moodboard item: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create item: {str(e)}")


@router.put("/projects/{project_id}/moodboards/{moodboard_id}/items/{item_id}")
async def update_item(
    project_id: str,
    moodboard_id: str,
    item_id: str,
    request: ItemUpdate,
    authorization: str = Header(None)
):
    """Update an item. If section changes, move to end of destination section."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Get current item
    current = client.table("moodboard_items").select("*").eq("id", item_id).eq("moodboard_id", moodboard_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Item not found")

    current_item = current.data[0]
    old_section_id = current_item.get("section_id")

    # Check if section is changing
    section_changing = request.section_id is not None and request.section_id != old_section_id

    # Verify new section if provided
    if request.section_id:
        section = client.table("moodboard_sections").select("id").eq("id", request.section_id).eq("moodboard_id", moodboard_id).execute()
        if not section.data:
            raise HTTPException(status_code=404, detail="Section not found")

    update_data = {}
    if request.image_url is not None:
        update_data["image_url"] = request.image_url
    if request.source_url is not None:
        update_data["source_url"] = request.source_url
    if request.title is not None:
        update_data["title"] = request.title
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.tags is not None:
        update_data["tags"] = request.tags
    if request.category is not None:
        update_data["category"] = request.category
    if request.rating is not None:
        update_data["rating"] = request.rating
    if request.color_palette is not None:
        update_data["color_palette"] = request.color_palette
    if request.aspect_ratio is not None:
        update_data["aspect_ratio"] = request.aspect_ratio

    if section_changing:
        # Handle special case where request.section_id might be empty string for unsorted
        new_section_id = request.section_id if request.section_id else None
        update_data["section_id"] = new_section_id
        update_data["sort_order"] = get_next_item_sort_order(moodboard_id, new_section_id)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("moodboard_items").update(update_data).eq("id", item_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update item")

    # Recompact old section if item moved
    if section_changing:
        recompact_item_sort_orders(moodboard_id, old_section_id)

    return result.data[0]


@router.delete("/projects/{project_id}/moodboards/{moodboard_id}/items/{item_id}")
async def delete_item(
    project_id: str,
    moodboard_id: str,
    item_id: str,
    authorization: str = Header(None)
):
    """Delete an item."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Get item to know its section
    item = client.table("moodboard_items").select("id, section_id").eq("id", item_id).eq("moodboard_id", moodboard_id).execute()
    if not item.data:
        raise HTTPException(status_code=404, detail="Item not found")

    section_id = item.data[0].get("section_id")

    # Delete item
    client.table("moodboard_items").delete().eq("id", item_id).execute()

    # Recompact sort orders
    recompact_item_sort_orders(moodboard_id, section_id)

    return {"success": True}


@router.post("/projects/{project_id}/moodboards/{moodboard_id}/items/reorder")
async def reorder_item(
    project_id: str,
    moodboard_id: str,
    request: ItemReorder,
    authorization: str = Header(None)
):
    """Reorder an item within its current section (swap with adjacent)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    client = get_client()

    # Get current item
    current = client.table("moodboard_items").select("id, sort_order, section_id").eq("id", request.item_id).eq("moodboard_id", moodboard_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Item not found")

    current_order = current.data[0]["sort_order"]
    section_id = current.data[0].get("section_id")

    # Find adjacent item within same section
    base_query = client.table("moodboard_items").select("id, sort_order").eq("moodboard_id", moodboard_id)
    if section_id:
        base_query = base_query.eq("section_id", section_id)
    else:
        base_query = base_query.is_("section_id", "null")

    if request.direction == "UP":
        adjacent = base_query.lt("sort_order", current_order).order("sort_order", desc=True).limit(1).execute()
    else:
        adjacent = base_query.gt("sort_order", current_order).order("sort_order").limit(1).execute()

    if not adjacent.data:
        raise HTTPException(status_code=400, detail=f"Cannot move item {request.direction.lower()}")

    adjacent_order = adjacent.data[0]["sort_order"]
    adjacent_id = adjacent.data[0]["id"]

    # Swap sort orders (use temp value to avoid unique constraint)
    temp_order = 999999
    client.table("moodboard_items").update({"sort_order": temp_order}).eq("id", request.item_id).execute()
    client.table("moodboard_items").update({"sort_order": current_order}).eq("id", adjacent_id).execute()
    client.table("moodboard_items").update({"sort_order": adjacent_order}).eq("id", request.item_id).execute()

    return {"success": True}


# =====================================================
# Item Image Upload Endpoint
# =====================================================

@router.post("/projects/{project_id}/moodboards/{moodboard_id}/items/upload-url")
async def get_item_upload_url(
    project_id: str,
    moodboard_id: str,
    request: ItemImageUpload,
    authorization: str = Header(None)
):
    """Get a presigned URL for uploading a moodboard item image to S3."""
    import boto3
    import uuid as uuid_module

    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_moodboard_access(moodboard_id, project_id)

    # Generate S3 key
    file_ext = request.file_name.rsplit('.', 1)[-1].lower() if '.' in request.file_name else 'jpg'
    s3_key = f"moodboards/{project_id}/{moodboard_id}/items/{uuid_module.uuid4()}.{file_ext}"

    # Generate presigned upload URL
    s3_client = boto3.client("s3", region_name="us-east-1")
    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": "swn-backlot-files-517220555400",
            "Key": s3_key,
            "ContentType": request.content_type,
        },
        ExpiresIn=3600
    )

    file_url = f"https://swn-backlot-files-517220555400.s3.amazonaws.com/{s3_key}"

    return {
        "success": True,
        "upload_url": presigned_url,
        "file_url": file_url,
        "s3_key": s3_key
    }


# =====================================================
# Export Endpoint
# =====================================================

@router.get("/projects/{project_id}/moodboards/{moodboard_id}/export.csv")
async def export_moodboard_csv(
    project_id: str,
    moodboard_id: str,
    authorization: str = Header(None)
):
    """Export moodboard to CSV."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get moodboard
    moodboard = client.table("moodboards").select("title").eq("id", moodboard_id).eq("project_id", project_id).execute()
    if not moodboard.data:
        raise HTTPException(status_code=404, detail="Moodboard not found")

    moodboard_title = moodboard.data[0]["title"]

    # Get sections
    sections = client.table("moodboard_sections").select("id, title, sort_order").eq("moodboard_id", moodboard_id).order("sort_order").execute()
    section_map = {s["id"]: s["title"] for s in (sections.data or [])}

    # Get items
    items = client.table("moodboard_items").select("*").eq("moodboard_id", moodboard_id).order("section_id").order("sort_order").execute()

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["MoodboardTitle", "SectionTitle", "ItemOrder", "Title", "ImageUrl", "SourceUrl", "Tags", "Notes", "CreatedAt"])

    for item in (items.data or []):
        section_title = section_map.get(item.get("section_id"), "Unsorted")
        tags_str = ";".join(item.get("tags") or [])
        writer.writerow([
            moodboard_title,
            section_title,
            item["sort_order"],
            item.get("title") or "",
            item["image_url"],
            item.get("source_url") or "",
            tags_str,
            item.get("notes") or "",
            item["created_at"],
        ])

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="moodboard_{moodboard_id}.csv"'
        }
    )


# =====================================================
# Print Data Endpoint
# =====================================================

@router.get("/projects/{project_id}/moodboards/{moodboard_id}/print")
async def get_moodboard_print_data(
    project_id: str,
    moodboard_id: str,
    authorization: str = Header(None)
):
    """Get moodboard data formatted for print view."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project name
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Unknown Project"

    # Get moodboard
    moodboard = client.table("moodboards").select("*").eq("id", moodboard_id).eq("project_id", project_id).execute()
    if not moodboard.data:
        raise HTTPException(status_code=404, detail="Moodboard not found")

    # Get sections
    sections = client.table("moodboard_sections").select("*").eq("moodboard_id", moodboard_id).order("sort_order").execute()

    # Get items
    items = client.table("moodboard_items").select("*").eq("moodboard_id", moodboard_id).order("sort_order").execute()

    # Group items by section
    items_by_section: Dict[Optional[str], List[Dict]] = {None: []}
    for section in (sections.data or []):
        items_by_section[section["id"]] = []

    for item in (items.data or []):
        section_key = item.get("section_id")
        if section_key in items_by_section:
            items_by_section[section_key].append(item)
        else:
            items_by_section[None].append(item)

    # Build sections with items for print
    print_sections = []
    for section in (sections.data or []):
        print_sections.append({
            "id": section["id"],
            "title": section["title"],
            "items": items_by_section.get(section["id"], [])
        })

    return {
        "project_title": project_title,
        "moodboard": moodboard.data[0],
        "sections": print_sections,
        "unsorted_items": items_by_section.get(None, []),
        "generated_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# PDF Export Endpoints
# =====================================================

@router.get("/projects/{project_id}/moodboards/{moodboard_id}/export.pdf")
async def export_moodboard_pdf(
    project_id: str,
    moodboard_id: str,
    embed_images: bool = Query(True, description="Embed images as base64 (slower but works offline)"),
    authorization: str = Header(None)
):
    """Export moodboard as PDF."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project name
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Unknown Project"

    # Get moodboard
    moodboard = client.table("moodboards").select("*").eq("id", moodboard_id).eq("project_id", project_id).execute()
    if not moodboard.data:
        raise HTTPException(status_code=404, detail="Moodboard not found")

    moodboard_data = moodboard.data[0]

    # Get sections
    sections = client.table("moodboard_sections").select("*").eq("moodboard_id", moodboard_id).order("sort_order").execute()

    # Get items
    items = client.table("moodboard_items").select("*").eq("moodboard_id", moodboard_id).order("sort_order").execute()

    # Group items by section
    items_by_section: Dict[Optional[str], List[Dict]] = {None: []}
    for section in (sections.data or []):
        items_by_section[section["id"]] = []

    for item in (items.data or []):
        section_key = item.get("section_id")
        if section_key in items_by_section:
            items_by_section[section_key].append(item)
        else:
            items_by_section[None].append(item)

    # Build sections with items
    pdf_sections = []
    for section in (sections.data or []):
        pdf_sections.append({
            "title": section["title"],
            "items": items_by_section.get(section["id"], [])
        })

    try:
        from app.services.moodboard_pdf_service import generate_moodboard_pdf

        pdf_bytes = generate_moodboard_pdf(
            project_title=project_title,
            moodboard_title=moodboard_data["title"],
            moodboard_description=moodboard_data.get("description"),
            sections=pdf_sections,
            unsorted_items=items_by_section.get(None, []),
            embed_images=embed_images,
        )

        # Sanitize filename
        safe_title = re.sub(r'[^\w\s-]', '', moodboard_data["title"]).strip().replace(' ', '_')[:50]

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_title}_moodboard.pdf"'
            }
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating moodboard PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@router.get("/projects/{project_id}/moodboards/{moodboard_id}/sections/{section_id}/export.pdf")
async def export_section_pdf(
    project_id: str,
    moodboard_id: str,
    section_id: str,
    embed_images: bool = Query(True, description="Embed images as base64 (slower but works offline)"),
    authorization: str = Header(None)
):
    """Export a single moodboard section as PDF."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project name
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Unknown Project"

    # Get moodboard
    moodboard = client.table("moodboards").select("title").eq("id", moodboard_id).eq("project_id", project_id).execute()
    if not moodboard.data:
        raise HTTPException(status_code=404, detail="Moodboard not found")

    moodboard_title = moodboard.data[0]["title"]

    # Get section
    section = client.table("moodboard_sections").select("*").eq("id", section_id).eq("moodboard_id", moodboard_id).execute()
    if not section.data:
        raise HTTPException(status_code=404, detail="Section not found")

    section_data = section.data[0]

    # Get items for this section
    items = client.table("moodboard_items").select("*").eq("moodboard_id", moodboard_id).eq("section_id", section_id).order("sort_order").execute()

    try:
        from app.services.moodboard_pdf_service import generate_section_pdf

        pdf_bytes = generate_section_pdf(
            project_title=project_title,
            moodboard_title=moodboard_title,
            section_title=section_data["title"],
            items=items.data or [],
            embed_images=embed_images,
        )

        # Sanitize filename
        safe_title = re.sub(r'[^\w\s-]', '', section_data["title"]).strip().replace(' ', '_')[:50]

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_title}_section.pdf"'
            }
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating section PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
