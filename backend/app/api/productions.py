"""
Productions API - CRUD endpoints for production management
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from app.api.community import get_current_user_from_token
from app.core.database import get_client

router = APIRouter()

ProductionType = Literal[
    "documentary",
    "feature_film",
    "short_film",
    "series_episodic",
    "limited_series",
    "commercial",
    "music_video",
    "corporate_industrial",
    "wedding_event",
    "web_content",
    "live_event",
    "news_eng",
]

PRODUCTION_TYPE_LABELS = {
    "documentary": "Documentary",
    "feature_film": "Feature Film",
    "short_film": "Short Film",
    "series_episodic": "Series/Episodic (TV)",
    "limited_series": "Limited Series/Miniseries",
    "commercial": "Commercial",
    "music_video": "Music Video",
    "corporate_industrial": "Corporate/Industrial",
    "wedding_event": "Wedding/Event",
    "web_content": "Web Content/Streaming",
    "live_event": "Live Event",
    "news_eng": "News/ENG",
}


class ProductionInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    production_type: ProductionType
    company: Optional[str] = Field(None, max_length=200)
    network_id: Optional[str] = None
    backlot_project_id: Optional[str] = None


class ProductionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    production_type: Optional[ProductionType] = None
    company: Optional[str] = Field(None, max_length=200)
    network_id: Optional[str] = None


class Production(BaseModel):
    id: str
    name: str
    production_type: ProductionType
    company: Optional[str] = None
    network_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    created_by_user_id: str
    created_at: str
    updated_at: str


@router.get("")
async def list_productions(
    search: Optional[str] = None,
    production_type: Optional[ProductionType] = None,
    limit: int = 50,
    authorization: str = Header(None),
):
    """
    List productions with optional search/filtering.
    Used for autocomplete when selecting a production.
    """
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase = get_client()

    # Build query - select productions with network data
    query = supabase.table("productions").select(
        "*, tv_networks(*)"
    )

    # Filter by user's own productions or public ones
    # For now, users can only see their own productions
    query = query.eq("created_by_user_id", user["id"])

    if production_type:
        query = query.eq("production_type", production_type)

    if search:
        query = query.ilike("name", f"%{search}%")

    query = query.order("updated_at", desc=True).limit(limit)

    result = query.execute()
    productions = result.data or []

    # Rename tv_networks to network for cleaner response
    for prod in productions:
        if "tv_networks" in prod:
            prod["network"] = prod.pop("tv_networks")

    return productions


@router.post("")
async def create_production(
    input: ProductionInput,
    authorization: str = Header(None),
):
    """Create a new production."""
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase = get_client()

    # Validate network_id if provided
    if input.network_id:
        network_result = supabase.table("tv_networks").select("id").eq("id", input.network_id).single().execute()
        if not network_result.data:
            raise HTTPException(status_code=400, detail="Invalid network_id")

    # Validate backlot_project_id if provided
    if input.backlot_project_id:
        project_result = supabase.table("backlot_projects").select("id").eq("id", input.backlot_project_id).single().execute()
        if not project_result.data:
            raise HTTPException(status_code=400, detail="Invalid backlot_project_id")

    # Create production
    production_data = {
        "name": input.name,
        "production_type": input.production_type,
        "company": input.company,
        "network_id": input.network_id,
        "backlot_project_id": input.backlot_project_id,
        "created_by_user_id": user["id"],
    }

    result = supabase.table("productions").insert(production_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create production")

    # Fetch with network data
    production = supabase.table("productions").select(
        "*, tv_networks(*)"
    ).eq("id", result.data[0]["id"]).single().execute()

    prod = production.data
    if "tv_networks" in prod:
        prod["network"] = prod.pop("tv_networks")

    return prod


@router.get("/search/query")
async def search_productions(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    authorization: str = Header(None),
):
    """
    Search productions by name using fuzzy matching.
    Returns minimal data for autocomplete dropdown.
    Searches user's own productions.
    """
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    client = get_client()

    try:
        # Search user's productions by name
        result = client.table("productions").select(
            "id, name, production_type, company"
        ).eq("created_by_user_id", user["id"]).ilike("name", f"%{q}%").limit(limit).execute()

        productions = result.data or []

        # Sort: exact matches first, then by name length
        def sort_key(p):
            name = p["name"].lower()
            query = q.lower()
            if name == query:
                return (0, len(name))
            elif name.startswith(query):
                return (1, len(name))
            else:
                return (2, len(name))

        productions.sort(key=sort_key)

        return productions

    except Exception as e:
        print(f"Error searching productions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def list_production_types():
    """Get all production types with their labels."""
    return [
        {"value": key, "label": value}
        for key, value in PRODUCTION_TYPE_LABELS.items()
    ]


@router.get("/{production_id}")
async def get_production(
    production_id: str,
    authorization: str = Header(None),
):
    """Get a single production by ID."""
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase = get_client()

    result = supabase.table("productions").select(
        "*, tv_networks(*)"
    ).eq("id", production_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Production not found")

    prod = result.data
    if "tv_networks" in prod:
        prod["network"] = prod.pop("tv_networks")

    return prod


@router.put("/{production_id}")
async def update_production(
    production_id: str,
    input: ProductionUpdate,
    authorization: str = Header(None),
):
    """Update a production."""
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase = get_client()

    # Check ownership
    existing = supabase.table("productions").select("created_by_user_id").eq("id", production_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Production not found")
    if existing.data["created_by_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this production")

    # Build update data
    update_data = {}
    if input.name is not None:
        update_data["name"] = input.name
    if input.production_type is not None:
        update_data["production_type"] = input.production_type
    if input.company is not None:
        update_data["company"] = input.company
    if input.network_id is not None:
        # Validate network_id
        if input.network_id:
            network_result = supabase.table("tv_networks").select("id").eq("id", input.network_id).single().execute()
            if not network_result.data:
                raise HTTPException(status_code=400, detail="Invalid network_id")
        update_data["network_id"] = input.network_id

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = "now()"

    result = supabase.table("productions").update(update_data).eq("id", production_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update production")

    # Fetch with network data
    production = supabase.table("productions").select(
        "*, tv_networks(*)"
    ).eq("id", production_id).single().execute()

    prod = production.data
    if "tv_networks" in prod:
        prod["network"] = prod.pop("tv_networks")

    return prod


@router.delete("/{production_id}")
async def delete_production(
    production_id: str,
    authorization: str = Header(None),
):
    """Delete a production."""
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    supabase = get_client()

    # Check ownership
    existing = supabase.table("productions").select("created_by_user_id").eq("id", production_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Production not found")
    if existing.data["created_by_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this production")

    # Delete
    supabase.table("productions").delete().eq("id", production_id).execute()

    return {"success": True}
