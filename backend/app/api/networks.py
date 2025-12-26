"""
TV Networks API - Endpoints for TV network data
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_client
import re

router = APIRouter()


# =====================================================
# AUTH HELPER
# =====================================================

async def get_current_user_from_token(authorization: str = None):
    """Extract and validate the current user from the authorization token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token required")

    token = authorization.replace("Bearer ", "")

    # Decode JWT to get user info (same approach as profiles.py)
    import jwt
    try:
        # Decode without verification first to get claims (for Cognito tokens)
        payload = jwt.decode(token, options={"verify_signature": False})
        cognito_user_id = payload.get("sub")
        email = payload.get("email")

        if not cognito_user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Look up profile by cognito_user_id
        client = get_client()
        profile_result = client.table("profiles").select("id, email").eq(
            "cognito_user_id", cognito_user_id
        ).execute()

        if profile_result.data:
            profile = profile_result.data[0]
            return {"id": profile["id"], "email": profile.get("email", email)}

        raise HTTPException(status_code=401, detail="User profile not found")
    except jwt.exceptions.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token format")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")


class TvNetwork(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None
    category: str
    is_active: bool = True
    sort_order: int = 0


class NetworkCategory(BaseModel):
    category: str
    label: str
    networks: List[TvNetwork]


CATEGORY_LABELS = {
    "broadcast": "Broadcast Networks",
    "cable": "Cable & Premium",
    "streaming": "Streaming Services",
    "news": "News & Sports",
    "specialty": "Specialty Networks",
}


@router.get("")
async def list_networks(
    category: Optional[str] = None,
    grouped: bool = True,
):
    """
    List all TV networks.

    - If grouped=True (default), returns networks grouped by category
    - If grouped=False, returns flat list sorted by sort_order
    - Optional category filter
    """
    supabase = get_client()

    query = supabase.table("tv_networks").select("*").eq("is_active", True)

    if category:
        query = query.eq("category", category)

    query = query.order("sort_order", desc=False)

    result = query.execute()
    networks = result.data or []

    if not grouped:
        return networks

    # Group by category
    grouped_networks = {}
    for network in networks:
        cat = network["category"]
        if cat not in grouped_networks:
            grouped_networks[cat] = []
        grouped_networks[cat].append(network)

    # Return as ordered list of categories
    category_order = ["broadcast", "cable", "streaming", "news", "specialty"]
    result_list = []

    for cat in category_order:
        if cat in grouped_networks:
            result_list.append({
                "category": cat,
                "label": CATEGORY_LABELS.get(cat, cat.title()),
                "networks": grouped_networks[cat]
            })

    return result_list


# IMPORTANT: Specific routes MUST come before /{network_id} catch-all route
@router.get("/search/query")
async def search_networks(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
):
    """
    Search networks by name using fuzzy matching.
    Returns minimal data for autocomplete dropdown.
    """
    client = get_client()

    try:
        # Use ILIKE for case-insensitive partial matching
        result = client.table("tv_networks").select(
            "id, name, slug, logo_url, category"
        ).eq("is_active", True).ilike("name", f"%{q}%").limit(limit).execute()

        networks = result.data or []

        # Sort: exact matches first, then by name length
        def sort_key(n):
            name = n["name"].lower()
            query = q.lower()
            if name == query:
                return (0, len(name))
            elif name.startswith(query):
                return (1, len(name))
            else:
                return (2, len(name))

        networks.sort(key=sort_key)

        return networks

    except Exception as e:
        print(f"Error searching networks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-slug/{slug}")
async def get_network_by_slug(slug: str):
    """Get a network by its slug."""
    supabase = get_client()

    result = supabase.table("tv_networks").select("*").eq("slug", slug).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Network not found")

    return result.data


# This catch-all route MUST be last
@router.get("/{network_id}")
async def get_network(network_id: str):
    """Get a single network by ID."""
    supabase = get_client()

    result = supabase.table("tv_networks").select("*").eq("id", network_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Network not found")

    return result.data


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


class NetworkCreate(BaseModel):
    name: str
    category: str = "specialty"  # Default to specialty for user-added networks


@router.post("")
async def create_network(
    network: NetworkCreate,
    authorization: str = Header(None),
):
    """
    Create a new network.
    User-created networks are marked as unverified.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Generate slug from name
        slug = slugify(network.name)

        # Check if network with similar name exists
        existing = client.table("tv_networks").select("id, name").ilike(
            "name", network.name
        ).execute()

        if existing.data:
            # Return existing network instead of creating duplicate
            return existing.data[0]

        # Get max sort_order for the category
        max_order_result = client.table("tv_networks").select("sort_order").eq(
            "category", network.category
        ).order("sort_order", desc=True).limit(1).execute()

        next_order = 1
        if max_order_result.data:
            next_order = (max_order_result.data[0].get("sort_order", 0) or 0) + 1

        # Create new network
        network_data = {
            "name": network.name.strip(),
            "slug": slug,
            "category": network.category,
            "is_active": True,
            "sort_order": next_order,
        }

        result = client.table("tv_networks").insert(network_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create network")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating network: {e}")
        raise HTTPException(status_code=500, detail=str(e))
