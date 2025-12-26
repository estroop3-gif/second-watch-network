"""
Companies API - CRUD endpoints for production companies
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


# =====================================================
# SCHEMAS
# =====================================================

class Company(BaseModel):
    id: str
    name: str
    slug: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    is_verified: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CompanyCreate(BaseModel):
    name: str
    website: Optional[str] = None


class CompanySearchResult(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    is_verified: bool = False


# =====================================================
# HELPER FUNCTIONS
# =====================================================

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/search")
async def search_companies(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
) -> List[CompanySearchResult]:
    """
    Search companies by name using fuzzy matching.
    Returns minimal data for autocomplete dropdown.
    """
    client = get_client()

    try:
        # Use ILIKE for case-insensitive partial matching
        # Order by exact match first, then partial matches
        result = client.table("companies").select(
            "id, name, logo_url, is_verified"
        ).ilike("name", f"%{q}%").limit(limit).execute()

        companies = result.data or []

        # Sort: exact matches first, then by name length (shorter = more relevant)
        def sort_key(c):
            name = c["name"].lower()
            query = q.lower()
            if name == query:
                return (0, len(name))
            elif name.startswith(query):
                return (1, len(name))
            else:
                return (2, len(name))

        companies.sort(key=sort_key)

        return companies

    except Exception as e:
        print(f"Error searching companies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_companies(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List companies with pagination."""
    client = get_client()

    try:
        result = client.table("companies").select("*").order(
            "name", desc=False
        ).range(offset, offset + limit - 1).execute()

        return result.data or []

    except Exception as e:
        print(f"Error listing companies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_company(
    company: CompanyCreate,
    authorization: str = Header(None),
):
    """
    Create a new company.
    Returns the created company with ID for immediate use in forms.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Generate slug from name
        slug = slugify(company.name)

        # Check if company with similar name exists
        existing = client.table("companies").select("id, name").ilike(
            "name", company.name
        ).execute()

        if existing.data:
            # Return existing company instead of creating duplicate
            return existing.data[0]

        # Create new company
        company_data = {
            "name": company.name.strip(),
            "slug": slug,
            "website": company.website,
            "created_by_user_id": user["id"],
            "is_verified": False,
        }

        result = client.table("companies").insert(company_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create company")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating company: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{company_id}")
async def get_company(company_id: str):
    """Get a single company by ID."""
    client = get_client()

    try:
        result = client.table("companies").select("*").eq("id", company_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Company not found")

        return result.data

    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Company not found")
        print(f"Error getting company: {e}")
        raise HTTPException(status_code=500, detail=str(e))
