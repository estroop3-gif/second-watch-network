"""
Cast Position Types API - Endpoints for managing cast position types (Lead, Supporting, etc.)
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

    # Decode JWT to get user info
    import jwt
    try:
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


# =====================================================
# MODELS
# =====================================================

class CastPositionType(BaseModel):
    id: str
    name: str
    slug: str
    created_at: Optional[str] = None


class CastPositionTypeCreate(BaseModel):
    name: str


# =====================================================
# HELPERS
# =====================================================

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '_', text)
    return text


# =====================================================
# ROUTES
# =====================================================

@router.get("")
async def list_cast_position_types():
    """
    List all cast position types.
    Returns list sorted alphabetically by name.
    """
    client = get_client()

    try:
        result = client.table("cast_position_types").select("*").order("name").execute()
        return result.data or []

    except Exception as e:
        print(f"Error listing cast position types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_cast_position_types(
    q: str = Query("", description="Search query"),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Search cast position types by name using fuzzy matching.
    Returns minimal data for autocomplete dropdown.
    If q is empty, returns all types sorted alphabetically.
    """
    client = get_client()

    try:
        if not q or q.strip() == "":
            # Return all types sorted by name
            result = client.table("cast_position_types").select(
                "id, name, slug"
            ).order("name").limit(limit).execute()
            return result.data or []

        # Use ILIKE for case-insensitive partial matching
        result = client.table("cast_position_types").select(
            "id, name, slug"
        ).ilike("name", f"%{q}%").limit(limit).execute()

        types = result.data or []

        # Sort: exact matches first, then starts with, then contains
        def sort_key(t):
            name = t["name"].lower()
            query = q.lower()
            if name == query:
                return (0, len(name))
            elif name.startswith(query):
                return (1, len(name))
            else:
                return (2, len(name))

        types.sort(key=sort_key)

        return types

    except Exception as e:
        print(f"Error searching cast position types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{type_id}")
async def get_cast_position_type(type_id: str):
    """Get a single cast position type by ID."""
    client = get_client()

    try:
        result = client.table("cast_position_types").select("*").eq("id", type_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Cast position type not found")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting cast position type: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_cast_position_type(
    type_input: CastPositionTypeCreate,
    authorization: str = Header(None),
):
    """
    Create a new cast position type.
    If a type with the same name already exists, returns the existing one.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        name = type_input.name.strip()

        if not name:
            raise HTTPException(status_code=400, detail="Name is required")

        # Generate slug from name
        slug = slugify(name)

        # Check if type with similar name exists (case-insensitive)
        existing = client.table("cast_position_types").select("id, name, slug").ilike(
            "name", name
        ).execute()

        if existing.data:
            # Return existing type instead of creating duplicate
            return existing.data[0]

        # Also check by slug for duplicates
        existing_slug = client.table("cast_position_types").select("id, name, slug").eq(
            "slug", slug
        ).execute()

        if existing_slug.data:
            return existing_slug.data[0]

        # Create new cast position type
        type_data = {
            "name": name,
            "slug": slug,
            "created_by_user_id": user["id"],
        }

        result = client.table("cast_position_types").insert(type_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create cast position type")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating cast position type: {e}")
        raise HTTPException(status_code=500, detail=str(e))
