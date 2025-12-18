"""
Filmmakers API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.core.database import get_client

router = APIRouter()


class FilmmakerProfile(BaseModel):
    id: str | None = None
    user_id: str
    name: str
    bio: str | None = None
    specialty: str | None = None  # director, cinematographer, editor, etc.
    portfolio_url: str | None = None
    reel_url: str | None = None
    location: str | None = None
    available: bool = True


@router.get("/", response_model=List[FilmmakerProfile])
async def list_filmmakers(skip: int = 0, limit: int = 20, specialty: str | None = None):
    """List all filmmakers"""
    try:
        client = get_client()
        query = client.table("filmmakers").select("*")
        
        if specialty:
            query = query.eq("specialty", specialty)
        
        response = query.range(skip, skip + limit - 1).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{filmmaker_id}", response_model=FilmmakerProfile)
async def get_filmmaker(filmmaker_id: str):
    """Get filmmaker profile by ID"""
    try:
        client = get_client()
        response = client.table("filmmakers").select("*").eq("id", filmmaker_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Filmmaker not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=FilmmakerProfile)
async def create_filmmaker_profile(profile: FilmmakerProfile):
    """Create filmmaker profile"""
    try:
        client = get_client()
        response = client.table("filmmakers").insert(profile.model_dump(exclude={"id"})).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{filmmaker_id}", response_model=FilmmakerProfile)
async def update_filmmaker_profile(filmmaker_id: str, profile: FilmmakerProfile):
    """Update filmmaker profile"""
    try:
        client = get_client()
        response = client.table("filmmakers").update(
            profile.model_dump(exclude={"id"})
        ).eq("id", filmmaker_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
