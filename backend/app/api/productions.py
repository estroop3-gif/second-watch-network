"""
Productions API - CRUD endpoints for production management
Includes "The Slate" public production detail pages
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from app.api.community import get_current_user_from_token
from app.core.database import get_client, execute_query, execute_single

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


class QuickCreateInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    production_type: Optional[str] = None


class Production(BaseModel):
    id: str
    name: str
    production_type: Optional[str] = None
    company: Optional[str] = None
    network_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a production name."""
    import re
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', name.lower()).strip('-')
    return slug or 'untitled'


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

    slug = _generate_slug(input.name)

    # Create production
    production_data = {
        "name": input.name,
        "title": input.name,
        "slug": slug,
        "production_type": input.production_type,
        "company": input.company,
        "network_id": input.network_id,
        "backlot_project_id": input.backlot_project_id,
        "created_by_user_id": user["id"],
        "created_by": user["id"],
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


# ============================================================================
# SEARCH — Public production search (for ProductionSelector)
# ============================================================================

@router.get("/search/all")
async def search_all_productions(
    q: str = Query("", description="Search query"),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Search ALL productions by name — not limited to a single user.
    Also searches public backlot projects.
    Returns merged, deduplicated results for the ProductionSelector.
    No auth required.
    """
    try:
        results = []
        seen_ids = set()

        if q.strip():
            # Search productions by name
            prod_rows = execute_query("""
                SELECT id, name, title, production_type, slug, backlot_project_id
                FROM productions
                WHERE name ILIKE :pattern OR title ILIKE :pattern
                ORDER BY
                    CASE WHEN lower(COALESCE(name, '')) = lower(:exact) THEN 0
                         WHEN lower(COALESCE(name, '')) LIKE lower(:prefix) THEN 1
                         ELSE 2 END,
                    updated_at DESC NULLS LAST
                LIMIT :lim
            """, {"pattern": f"%{q}%", "exact": q, "prefix": f"{q}%", "lim": limit})
        else:
            # No query: return recent productions
            prod_rows = execute_query("""
                SELECT id, name, title, production_type, slug, backlot_project_id
                FROM productions
                ORDER BY updated_at DESC NULLS LAST
                LIMIT :lim
            """, {"lim": limit})

        linked_backlot_ids = set()
        for row in (prod_rows or []):
            pid = str(row["id"])
            seen_ids.add(pid)
            if row.get("backlot_project_id"):
                linked_backlot_ids.add(str(row["backlot_project_id"]))
            results.append({
                "id": pid,
                "name": row.get("name") or row.get("title") or "Untitled",
                "production_type": row.get("production_type"),
                "slug": row.get("slug"),
                "source": "production",
            })

        # Also search public backlot projects (skip ones already linked)
        if q.strip():
            backlot_rows = execute_query("""
                SELECT id, title, slug, production_type
                FROM backlot_projects
                WHERE (title ILIKE :pattern)
                  AND visibility IN ('public', 'unlisted')
                ORDER BY updated_at DESC NULLS LAST
                LIMIT :lim
            """, {"pattern": f"%{q}%", "lim": limit})
        else:
            backlot_rows = execute_query("""
                SELECT id, title, slug, production_type
                FROM backlot_projects
                WHERE visibility IN ('public', 'unlisted')
                ORDER BY updated_at DESC NULLS LAST
                LIMIT :lim
            """, {"lim": limit})

        for row in (backlot_rows or []):
            bid = str(row["id"])
            if bid in linked_backlot_ids:
                continue
            results.append({
                "id": f"backlot:{bid}",
                "name": row.get("title") or "Untitled",
                "production_type": row.get("production_type"),
                "slug": row.get("slug"),
                "source": "backlot",
            })

        return results[:limit]

    except Exception as e:
        print(f"Error in search_all_productions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/query")
async def search_productions(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    authorization: str = Header(None),
):
    """
    Search productions by name using fuzzy matching.
    Returns minimal data for autocomplete dropdown.
    Searches ALL productions (not just user's own).
    """
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    client = get_client()

    try:
        # Search all productions by name
        result = client.table("productions").select(
            "id, name, production_type, company, slug"
        ).ilike("name", f"%{q}%").limit(limit).execute()

        productions = result.data or []

        # Sort: exact matches first, then by name length
        def sort_key(p):
            name = (p.get("name") or "").lower()
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


# ============================================================================
# QUICK CREATE — For ProductionSelector "Add new" flow
# ============================================================================

@router.post("/quick-create")
async def quick_create_production(
    input: QuickCreateInput,
    authorization: str = Header(None),
):
    """
    Quick-create a production with just a name.
    Used by the ProductionSelector's "Add new" feature.
    Auth required.
    """
    user = get_current_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    client = get_client()
    slug = _generate_slug(input.name)

    production_data = {
        "name": input.name,
        "title": input.name,
        "slug": slug,
        "created_by_user_id": user["id"],
        "created_by": user["id"],
    }
    if input.production_type:
        production_data["production_type"] = input.production_type

    try:
        result = client.table("productions").insert(production_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create production")

        prod = result.data[0]
        return {
            "id": prod["id"],
            "name": prod.get("name") or prod.get("title"),
            "production_type": prod.get("production_type"),
            "slug": prod.get("slug"),
            "source": "production",
        }
    except Exception as e:
        print(f"Error in quick_create_production: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def list_production_types():
    """Get all production types with their labels."""
    return [
        {"value": key, "label": value}
        for key, value in PRODUCTION_TYPE_LABELS.items()
    ]


# ============================================================================
# THE SLATE — Public production detail page
# ============================================================================

@router.get("/slug/{slug}")
async def get_production_by_slug(slug: str):
    """
    Get a production by slug with full credits — public, no auth required.
    Powers "The Slate" production detail pages.
    """
    try:
        # Fetch the production
        prod_row = execute_single("""
            SELECT id, name, title, slug, production_type, company, year,
                   description, logline, poster_url, genre, status,
                   backlot_project_id, network_id, created_at
            FROM productions
            WHERE slug = :slug
        """, {"slug": slug})

        if not prod_row:
            raise HTTPException(status_code=404, detail="Production not found")

        production_id = str(prod_row["id"])
        prod_name = prod_row.get("name") or prod_row.get("title") or "Untitled"

        # Get manual credits for this production
        credits_rows = execute_query("""
            SELECT c.id, c.user_id, c.position, c.description, c.production_date,
                   p.username, p.full_name, p.display_name, p.avatar_url
            FROM credits c
            LEFT JOIN profiles p ON p.id = c.user_id
            WHERE c.production_id = :prod_id
            ORDER BY c.created_at ASC
        """, {"prod_id": production_id})

        cast_crew = []
        for row in (credits_rows or []):
            cast_crew.append({
                "id": str(row["id"]),
                "user_id": str(row["user_id"]) if row.get("user_id") else None,
                "position": row.get("position"),
                "description": row.get("description"),
                "production_date": str(row["production_date"]) if row.get("production_date") else None,
                "username": row.get("username"),
                "display_name": row.get("display_name") or row.get("full_name"),
                "avatar_url": row.get("avatar_url"),
                "source": "credit",
            })

        # If linked to a backlot project, also get backlot cast/crew
        backlot_project_id = prod_row.get("backlot_project_id")
        backlot_slug = None
        if backlot_project_id:
            try:
                # Get backlot project slug
                bp_row = execute_single("""
                    SELECT slug FROM backlot_projects WHERE id = :id
                """, {"id": str(backlot_project_id)})
                if bp_row:
                    backlot_slug = bp_row.get("slug")

                # Backlot crew
                crew_rows = execute_query("""
                    SELECT bcm.id, bcm.user_id, bcm.role as position, bcm.department,
                           p.username, p.full_name, p.display_name, p.avatar_url
                    FROM backlot_crew_members bcm
                    LEFT JOIN profiles p ON p.id = bcm.user_id
                    WHERE bcm.project_id = :pid
                    ORDER BY bcm.department, bcm.role
                """, {"pid": str(backlot_project_id)})

                for row in (crew_rows or []):
                    cast_crew.append({
                        "id": str(row["id"]),
                        "user_id": str(row["user_id"]) if row.get("user_id") else None,
                        "position": row.get("position"),
                        "department": row.get("department"),
                        "username": row.get("username"),
                        "display_name": row.get("display_name") or row.get("full_name"),
                        "avatar_url": row.get("avatar_url"),
                        "source": "backlot_crew",
                    })

                # Backlot cast
                cast_rows = execute_query("""
                    SELECT bcm.id, bcm.user_id, bcm.character_name, bcm.role_type,
                           p.username, p.full_name, p.display_name, p.avatar_url
                    FROM backlot_cast_members bcm
                    LEFT JOIN profiles p ON p.id = bcm.user_id
                    WHERE bcm.project_id = :pid
                    ORDER BY bcm.role_type, bcm.character_name
                """, {"pid": str(backlot_project_id)})

                for row in (cast_rows or []):
                    cast_crew.append({
                        "id": str(row["id"]),
                        "user_id": str(row["user_id"]) if row.get("user_id") else None,
                        "position": row.get("character_name") or row.get("role_type") or "Cast",
                        "username": row.get("username"),
                        "display_name": row.get("display_name") or row.get("full_name"),
                        "avatar_url": row.get("avatar_url"),
                        "source": "backlot_cast",
                    })
            except Exception as e:
                print(f"Error fetching backlot credits: {e}")

        return {
            "id": production_id,
            "name": prod_name,
            "slug": prod_row.get("slug"),
            "production_type": prod_row.get("production_type"),
            "company": prod_row.get("company"),
            "year": prod_row.get("year"),
            "description": prod_row.get("description"),
            "logline": prod_row.get("logline"),
            "poster_url": prod_row.get("poster_url"),
            "genre": prod_row.get("genre") or [],
            "status": prod_row.get("status") or "released",
            "backlot_project_id": str(backlot_project_id) if backlot_project_id else None,
            "backlot_slug": backlot_slug,
            "cast_crew": cast_crew,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_production_by_slug: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        update_data["title"] = input.name
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
