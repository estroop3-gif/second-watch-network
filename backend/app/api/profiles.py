"""
Profiles API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.core.supabase import get_supabase_client
from app.schemas.profiles import (
    Profile, ProfileUpdate, 
    FilmmakerProfile, FilmmakerProfileCreate, FilmmakerProfileUpdate
)

router = APIRouter()


@router.get("/{user_id}", response_model=Profile)
async def get_profile(user_id: str):
    """Get user profile by ID"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{user_id}", response_model=Profile)
async def update_profile(user_id: str, profile: ProfileUpdate):
    """Update user profile"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("profiles").update(
            profile.model_dump(exclude_unset=True)
        ).eq("id", user_id).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/username/{username}", response_model=Profile)
async def get_profile_by_username(username: str):
    """Get profile by username"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("profiles").select("*").eq("username", username).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Filmmaker Profile Endpoints
@router.get("/filmmaker/{user_id}", response_model=FilmmakerProfile)
async def get_filmmaker_profile(user_id: str):
    """Get filmmaker profile"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("filmmaker_profiles").select("*").eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Filmmaker profile not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/filmmaker", response_model=FilmmakerProfile)
async def create_filmmaker_profile(profile: FilmmakerProfileCreate):
    """Create filmmaker profile"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("filmmaker_profiles").insert(
            profile.model_dump()
        ).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/filmmaker/{user_id}", response_model=FilmmakerProfile)
async def update_filmmaker_profile(user_id: str, profile: FilmmakerProfileUpdate):
    """Update filmmaker profile"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("filmmaker_profiles").update(
            profile.model_dump(exclude_unset=True)
        ).eq("user_id", user_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/filmmaker/list", response_model=List[FilmmakerProfile])
async def list_filmmaker_profiles(
    skip: int = 0, 
    limit: int = 20,
    department: Optional[str] = None,
    accepting_work: Optional[bool] = None
):
    """List all filmmaker profiles"""
    try:
        supabase = get_supabase_client()
        query = supabase.table("filmmaker_profiles").select("*")
        
        if department:
            query = query.eq("department", department)
        if accepting_work is not None:
            query = query.eq("accepting_work", accepting_work)
        
        response = query.range(skip, skip + limit - 1).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
