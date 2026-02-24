"""
Availability API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.core.database import get_client
from app.schemas.availability import Availability, AvailabilityCreate, AvailabilityUpdate

router = APIRouter()


@router.get("/", response_model=List[Availability])
async def list_availability(user_id: str, skip: int = 0, limit: int = 50):
    """List user's availability"""
    try:
        client = get_client()
        response = client.table("availability").select("*").eq(
            "user_id", user_id
        ).range(skip, skip + limit - 1).order("start_date").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/newly-available", response_model=List[dict])
async def get_newly_available_filmmakers(days: int = 2):
    """Get filmmakers who became available in the last N days"""
    try:
        client = get_client()
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()

        # Get availability records (no nested joins — query builder doesn't support them)
        response = client.table("availability").select("*").eq(
            "is_available", True
        ).gte("created_at", cutoff_date).execute()

        results = response.data

        # Fetch profile and filmmaker_profile for each user separately
        for item in results:
            user_id = item.get("user_id")
            if user_id:
                profile_resp = client.table("profiles").select(
                    "id, full_name, username, avatar_url, location"
                ).eq("id", user_id).execute()
                item["profile"] = profile_resp.data[0] if profile_resp.data else None

                fp_response = client.table("filmmaker_profiles").select("*").eq(
                    "user_id", user_id
                ).execute()
                item["filmmaker_profile"] = fp_response.data[0] if fp_response.data else None
            else:
                item["profile"] = None
                item["filmmaker_profile"] = None

        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Availability)
async def create_availability(availability: AvailabilityCreate, user_id: str):
    """Create availability entry"""
    try:
        client = get_client()
        data = availability.model_dump()
        data["user_id"] = user_id
        
        response = client.table("availability").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{availability_id}", response_model=Availability)
async def update_availability(availability_id: str, availability: AvailabilityUpdate):
    """Update availability"""
    try:
        client = get_client()
        response = client.table("availability").update(
            availability.model_dump(exclude_unset=True)
        ).eq("id", availability_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{availability_id}")
async def delete_availability(availability_id: str):
    """Delete availability"""
    try:
        client = get_client()
        client.table("availability").delete().eq("id", availability_id).execute()
        return {"message": "Availability deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
