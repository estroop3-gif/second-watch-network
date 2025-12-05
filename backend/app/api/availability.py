"""
Availability API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.core.supabase import get_supabase_client
from app.schemas.availability import Availability, AvailabilityCreate, AvailabilityUpdate

router = APIRouter()


@router.get("/", response_model=List[Availability])
async def list_availability(user_id: str, skip: int = 0, limit: int = 50):
    """List user's availability"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("availability").select("*").eq(
            "user_id", user_id
        ).range(skip, skip + limit - 1).order("start_date").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/newly-available", response_model=List[dict])
async def get_newly_available_filmmakers(days: int = 2):
    """Get filmmakers who became available in the last N days"""
    try:
        supabase = get_supabase_client()
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        response = supabase.table("availability").select(
            "*, profiles(*), filmmaker_profiles(*)"
        ).eq("is_available", True).gte("created_at", cutoff_date).execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Availability)
async def create_availability(availability: AvailabilityCreate, user_id: str):
    """Create availability entry"""
    try:
        supabase = get_supabase_client()
        data = availability.model_dump()
        data["user_id"] = user_id
        
        response = supabase.table("availability").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{availability_id}", response_model=Availability)
async def update_availability(availability_id: str, availability: AvailabilityUpdate):
    """Update availability"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("availability").update(
            availability.model_dump(exclude_unset=True)
        ).eq("id", availability_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{availability_id}")
async def delete_availability(availability_id: str):
    """Delete availability"""
    try:
        supabase = get_supabase_client()
        supabase.table("availability").delete().eq("id", availability_id).execute()
        return {"message": "Availability deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
