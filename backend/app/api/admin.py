"""
Admin API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from pydantic import BaseModel

router = APIRouter()


class DashboardStats(BaseModel):
    pending_submissions: int
    total_users: int
    total_filmmakers: int
    newly_available: int
    total_threads: int


class UserBanRequest(BaseModel):
    user_id: str
    banned: bool
    reason: Optional[str] = None


class UserRoleUpdate(BaseModel):
    user_id: str
    role: str


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get admin dashboard statistics"""
    try:
        client = get_client()
        
        # Pending submissions
        submissions = client.table("submissions").select("id", count="exact").eq("status", "pending").execute()
        
        # Total users
        users = client.table("profiles").select("id", count="exact").execute()
        
        # Total filmmakers
        filmmakers = client.table("filmmaker_profiles").select("id", count="exact").execute()
        
        # Forum threads
        threads = client.table("forum_threads").select("id", count="exact").execute()
        
        return {
            "pending_submissions": submissions.count or 0,
            "total_users": users.count or 0,
            "total_filmmakers": filmmakers.count or 0,
            "newly_available": 0,  # To be implemented with availability logic
            "total_threads": threads.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users", response_model=List[dict])
async def list_all_users(skip: int = 0, limit: int = 50, role: Optional[str] = None):
    """List all users (admin only)"""
    try:
        client = get_client()
        query = client.table("profiles").select("*")
        
        if role:
            query = query.eq("role", role)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/users/ban")
async def ban_user(request: UserBanRequest):
    """Ban or unban a user"""
    try:
        client = get_client()
        
        # Update user status
        status = "banned" if request.banned else "active"
        client.table("profiles").update({"status": status}).eq("id", request.user_id).execute()
        
        return {"message": f"User {'banned' if request.banned else 'unbanned'} successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/users/role")
async def update_user_role(request: UserRoleUpdate):
    """Update user role"""
    try:
        client = get_client()
        client.table("profiles").update({"role": request.role}).eq("id", request.user_id).execute()
        return {"message": "User role updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete user account"""
    try:
        client = get_client()
        
        # Delete user profile
        client.table("profiles").delete().eq("id", user_id).execute()
        
        # Delete associated data
        client.table("filmmaker_profiles").delete().eq("user_id", user_id).execute()
        client.table("submissions").delete().eq("user_id", user_id).execute()
        
        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/applications/filmmakers")
async def list_filmmaker_applications(skip: int = 0, limit: int = 50):
    """List filmmaker applications"""
    try:
        client = get_client()
        response = client.table("filmmaker_applications").select("*").range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/applications/partners")
async def list_partner_applications(skip: int = 0, limit: int = 50):
    """List partner applications"""
    try:
        client = get_client()
        response = client.table("partner_applications").select("*").range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
