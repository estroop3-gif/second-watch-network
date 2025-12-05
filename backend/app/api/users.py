"""
Users API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.supabase import get_supabase_client

router = APIRouter()


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    role: str | None = None


@router.get("/{user_id}", response_model=UserProfile)
async def get_user(user_id: str):
    """Get user profile by ID"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{user_id}")
async def update_user(user_id: str, profile: UserProfile):
    """Update user profile"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("profiles").update(
            profile.model_dump(exclude={"id"})
        ).eq("id", user_id).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_users(skip: int = 0, limit: int = 20):
    """List all users"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("profiles").select("*").range(skip, skip + limit - 1).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
