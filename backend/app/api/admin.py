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


@router.get("/settings")
async def get_site_settings():
    """Get all site settings"""
    try:
        client = get_client()
        response = client.table("settings").select("key, value").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/settings")
async def update_site_settings(settings: dict):
    """Update site settings"""
    try:
        client = get_client()

        # Try calling update_settings RPC if available
        try:
            response = client.rpc("update_settings", {"payload": settings}).execute()
            return {"message": "Settings updated successfully"}
        except Exception:
            # Fallback: Update each setting individually
            for key, value in settings.items():
                client.table("settings").upsert({
                    "key": key,
                    "value": {"value": value}
                }, on_conflict="key").execute()

            return {"message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard/newly-available")
async def get_newly_available_filmmakers(hours: int = 48):
    """Get filmmakers who recently became available"""
    try:
        client = get_client()
        from datetime import datetime, timedelta

        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

        response = client.table("availability").select(
            "*, profiles!inner(full_name, username, avatar_url, filmmaker_profiles!inner(department))"
        ).gte("created_at", cutoff).order("created_at", desc=True).execute()

        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/all")
async def get_all_users_with_profiles(skip: int = 0, limit: int = 100):
    """Get all users with their profiles (for admin user management)"""
    try:
        client = get_client()

        # Get profiles with all role flags
        response = client.table("profiles").select(
            "id, email, created_at, username, role, avatar_url, is_banned, "
            "is_superadmin, is_admin, is_moderator, is_lodge_officer, "
            "is_order_member, is_partner, is_filmmaker, is_premium"
        ).range(skip, skip + limit - 1).order("created_at", desc=True).execute()

        # Format response to match expected structure
        users = []
        for profile in response.data:
            # Build roles array from boolean flags
            roles = []
            if profile.get("is_superadmin"):
                roles.append("superadmin")
            if profile.get("is_admin"):
                roles.append("admin")
            if profile.get("is_moderator"):
                roles.append("moderator")
            if profile.get("is_lodge_officer"):
                roles.append("lodge_officer")
            if profile.get("is_order_member"):
                roles.append("order_member")
            if profile.get("is_partner"):
                roles.append("partner")
            if profile.get("is_filmmaker"):
                roles.append("filmmaker")
            if profile.get("is_premium"):
                roles.append("premium")

            # Fallback to legacy role if no flags set
            if not roles and profile.get("role"):
                roles.append(profile.get("role"))
            if not roles:
                roles.append("free")

            users.append({
                "id": profile.get("id"),
                "email": profile.get("email"),
                "created_at": profile.get("created_at"),
                "profile": {
                    "username": profile.get("username"),
                    "roles": roles,
                    "avatar_url": profile.get("avatar_url"),
                    "is_banned": profile.get("is_banned", False)
                }
            })

        return users
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/submissions/list")
async def list_submissions_admin(
    skip: int = 0,
    limit: int = 15,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """List submissions for admin with filters"""
    try:
        client = get_client()

        query = client.table("submissions").select(
            "id, created_at, project_title, status, youtube_link, description, logline, project_type, admin_notes, has_unread_admin_messages, email, "
            "profile:profiles!user_id(id, username, full_name, avatar_url)",
            count="exact"
        )

        if status and status != "all":
            query = query.eq("status", status)

        if search:
            query = query.or_(f"project_title.ilike.%{search}%")

        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()

        return {
            "submissions": response.data,
            "count": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class SubmissionStatusUpdate(BaseModel):
    submission_id: str
    status: str


@router.post("/submissions/status")
async def update_submission_status(update: SubmissionStatusUpdate):
    """Update submission status"""
    try:
        client = get_client()
        client.table("submissions").update({"status": update.status}).eq("id", update.submission_id).execute()
        return {"message": "Status updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/submissions/{submission_id}/mark-read")
async def mark_submission_read(submission_id: str):
    """Mark submission admin messages as read"""
    try:
        client = get_client()
        client.table("submissions").update({"has_unread_admin_messages": False}).eq("id", submission_id).execute()
        return {"message": "Marked as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class SubmissionNotesUpdate(BaseModel):
    notes: str


@router.put("/submissions/{submission_id}/notes")
async def update_submission_notes(submission_id: str, update: SubmissionNotesUpdate):
    """Update submission admin notes"""
    try:
        client = get_client()
        client.table("submissions").update({"admin_notes": update.notes}).eq("id", submission_id).execute()
        return {"message": "Notes updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class UserRolesUpdate(BaseModel):
    user_id: str
    roles: List[str]


# Map role names to database column names
ROLE_TO_COLUMN = {
    "superadmin": "is_superadmin",
    "admin": "is_admin",
    "moderator": "is_moderator",
    "lodge_officer": "is_lodge_officer",
    "order_member": "is_order_member",
    "partner": "is_partner",
    "filmmaker": "is_filmmaker",
    "premium": "is_premium",
}


@router.post("/users/roles")
async def update_user_roles(update: UserRolesUpdate):
    """Update user roles (sets boolean flags for each role)"""
    try:
        client = get_client()

        # Build update dict with all role flags set appropriately
        update_data = {}

        # Set all role flags based on the roles array
        for role_name, column_name in ROLE_TO_COLUMN.items():
            update_data[column_name] = role_name in update.roles

        # Also set the legacy "role" field to the primary (first) role
        primary_role = update.roles[0] if update.roles else "free"
        update_data["role"] = primary_role

        client.table("profiles").update(update_data).eq("id", update.user_id).execute()

        return {"message": "Roles updated successfully", "roles": update.roles}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/feed")
async def get_admin_feed(limit: int = 15):
    """Get admin activity feed (recent submissions and signups)"""
    try:
        client = get_client()

        # Get recent submissions
        submissions = client.table("submissions").select(
            "id, project_title, created_at, profile:profiles!user_id(username, full_name)"
        ).order("created_at", desc=True).limit(10).execute()

        # Get recent users
        users = client.table("profiles").select(
            "id, username, full_name, created_at"
        ).order("created_at", desc=True).limit(10).execute()

        # Format and combine
        feed_items = []

        for s in (submissions.data or []):
            feed_items.append({
                "id": s["id"],
                "type": "submission",
                "created_at": s["created_at"],
                "project_title": s["project_title"],
                "profiles": s.get("profiles")
            })

        for u in (users.data or []):
            feed_items.append({
                "id": u["id"],
                "type": "user",
                "created_at": u["created_at"],
                "username": u.get("username"),
                "full_name": u.get("full_name")
            })

        # Sort by created_at descending
        feed_items.sort(key=lambda x: x["created_at"], reverse=True)

        return feed_items[:limit]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FORUM MANAGEMENT
# ============================================================================

@router.get("/forum/threads")
async def list_forum_threads_admin():
    """List all forum threads with details for admin"""
    try:
        client = get_client()
        response = client.table("forum_threads_with_details").select(
            "id, title, created_at, username, full_name, category_name, replies_count"
        ).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/forum/threads/{thread_id}")
async def delete_forum_thread_admin(thread_id: str):
    """Delete a forum thread (cascades to replies)"""
    try:
        client = get_client()
        client.table("forum_threads").delete().eq("id", thread_id).execute()
        return {"message": "Thread deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/forum/replies")
async def list_forum_replies_admin():
    """List all forum replies with details for admin"""
    try:
        client = get_client()
        response = client.table("forum_replies_with_details").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/forum/replies/{reply_id}")
async def delete_forum_reply_admin(reply_id: str):
    """Delete a forum reply"""
    try:
        client = get_client()
        client.table("forum_replies").delete().eq("id", reply_id).execute()
        return {"message": "Reply deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/forum/categories")
async def list_forum_categories_admin():
    """List all forum categories for admin"""
    try:
        client = get_client()
        response = client.table("forum_categories").select(
            "id, name, slug, description"
        ).order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ForumCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    slug: str


@router.post("/forum/categories")
async def create_forum_category_admin(category: ForumCategoryCreate):
    """Create a new forum category"""
    try:
        client = get_client()
        client.table("forum_categories").insert({
            "name": category.name,
            "slug": category.slug,
            "description": category.description
        }).execute()
        return {"message": "Category created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/forum/categories/{category_id}")
async def update_forum_category_admin(category_id: str, category: ForumCategoryCreate):
    """Update a forum category"""
    try:
        client = get_client()
        client.table("forum_categories").update({
            "name": category.name,
            "slug": category.slug,
            "description": category.description
        }).eq("id", category_id).execute()
        return {"message": "Category updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/forum/categories/{category_id}")
async def delete_forum_category_admin(category_id: str):
    """Delete a forum category"""
    try:
        client = get_client()
        client.table("forum_categories").delete().eq("id", category_id).execute()
        return {"message": "Category deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FILMMAKER PROFILES MANAGEMENT
# ============================================================================

@router.get("/filmmaker-profiles")
async def list_filmmaker_profiles_admin():
    """List all filmmaker profiles for admin"""
    try:
        client = get_client()
        response = client.table("profiles").select(
            "id, username, avatar_url, filmmaker_profiles!inner(full_name, department, experience_level, location)"
        ).eq("has_completed_filmmaker_onboarding", True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/filmmaker-profiles/{user_id}/revoke")
async def revoke_filmmaker_profile_admin(user_id: str):
    """Revoke a user's filmmaker profile"""
    try:
        client = get_client()

        # Delete the filmmaker profile data
        client.table("filmmaker_profiles").delete().eq("user_id", user_id).execute()

        # Update the main profile to mark onboarding as incomplete
        client.table("profiles").update({
            "has_completed_filmmaker_onboarding": False
        }).eq("id", user_id).execute()

        return {"message": "Filmmaker profile revoked successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FILMMAKER APPLICATION MANAGEMENT
# ============================================================================

@router.post("/applications/filmmakers/{application_id}/approve")
async def approve_filmmaker_application(application_id: str):
    """
    Approve a filmmaker application.
    Creates filmmaker profile and updates user role.
    """
    try:
        client = get_client()

        # Get the application
        app_result = client.table("filmmaker_applications").select("*").eq(
            "id", application_id
        ).single().execute()

        if not app_result.data:
            raise HTTPException(status_code=404, detail="Application not found")

        application = app_result.data
        user_id = application.get("user_id")

        if not user_id:
            raise HTTPException(status_code=400, detail="Application has no user_id")

        # Update application status
        client.table("filmmaker_applications").update({
            "status": "approved"
        }).eq("id", application_id).execute()

        # Update user profile - add filmmaker role
        client.table("profiles").update({
            "role": "filmmaker",
            "has_completed_filmmaker_onboarding": True,
            "full_name": application.get("full_name"),
            "display_name": application.get("display_name"),
        }).eq("id", user_id).execute()

        # Create or update filmmaker_profile
        filmmaker_data = {
            "user_id": user_id,
            "full_name": application.get("full_name"),
            "display_name": application.get("display_name"),
            "location": application.get("location"),
            "portfolio_website": application.get("portfolio_link"),
            "experience_level": application.get("years_of_experience"),
            "skills": application.get("primary_roles") or [],
            "bio": application.get("join_reason"),
        }

        client.table("filmmaker_profiles").upsert(
            filmmaker_data, on_conflict="user_id"
        ).execute()

        return {"message": "Application approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/applications/filmmakers/{application_id}/reject")
async def reject_filmmaker_application(application_id: str):
    """Reject a filmmaker application"""
    try:
        client = get_client()

        client.table("filmmaker_applications").update({
            "status": "rejected"
        }).eq("id", application_id).execute()

        return {"message": "Application rejected"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# PARTNER APPLICATION MANAGEMENT
# ============================================================================

class PartnerApplicationStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None


# ============================================================================
# SUBSCRIPTION MANAGEMENT
# ============================================================================

@router.get("/subscriptions/activity/{user_id}")
async def get_subscription_activity(user_id: str):
    """Get subscription activity for a user"""
    try:
        client = get_client()
        response = client.table("subscription_activity").select("*").eq(
            "user_id", user_id
        ).order("created_at", desc=True).execute()

        return response.data or []
    except Exception as e:
        print(f"Subscription activity error: {e}")
        return []


# ============================================================================
# AVAILABILITY MANAGEMENT
# ============================================================================

@router.get("/availability/all")
async def list_all_availability():
    """List all availability records with profiles for admin"""
    try:
        client = get_client()
        response = client.table("availability").select(
            "id, start_date, end_date, notes, created_at, user_id"
        ).order("start_date").execute()

        # Get profile info for each
        results = []
        for record in (response.data or []):
            profile_result = client.table("profiles").select(
                "username, avatar_url"
            ).eq("id", record.get("user_id")).execute()

            filmmaker_result = client.table("filmmaker_profiles").select(
                "full_name, department"
            ).eq("user_id", record.get("user_id")).execute()

            results.append({
                **record,
                "profiles": {
                    **(profile_result.data[0] if profile_result.data else {}),
                    "filmmaker_profiles": filmmaker_result.data or []
                }
            })

        return results
    except Exception as e:
        print(f"Admin availability error: {e}")
        return []


@router.delete("/availability/{record_id}")
async def delete_availability_record(record_id: str):
    """Delete an availability record"""
    try:
        client = get_client()
        client.table("availability").delete().eq("id", record_id).execute()
        return {"message": "Availability record deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# PRODUCTIONS AND CREDITS MANAGEMENT
# ============================================================================

@router.get("/productions")
async def list_all_productions():
    """List all productions for admin"""
    try:
        client = get_client()
        response = client.table("productions").select(
            "id, title, slug, created_at, created_by"
        ).order("created_at", desc=True).execute()

        # Get profile info for each production
        results = []
        for prod in (response.data or []):
            profile_result = client.table("profiles").select(
                "username, full_name"
            ).eq("id", prod.get("created_by")).execute()

            results.append({
                **prod,
                "profiles": profile_result.data[0] if profile_result.data else None
            })

        return results
    except Exception as e:
        print(f"Admin productions error: {e}")
        return []


@router.delete("/productions/{production_id}")
async def delete_production(production_id: str):
    """Delete a production"""
    try:
        client = get_client()
        client.table("productions").delete().eq("id", production_id).execute()
        return {"message": "Production deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/credits/all")
async def list_all_credits():
    """List all credits for admin"""
    try:
        client = get_client()
        response = client.table("credits").select(
            "id, position, production_date, user_id, production_id"
        ).order("created_at", desc=True).execute()

        # Get profile and production info for each credit
        results = []
        for credit in (response.data or []):
            profile_result = client.table("profiles").select(
                "username, full_name, avatar_url"
            ).eq("id", credit.get("user_id")).execute()

            prod_result = client.table("productions").select(
                "title, slug"
            ).eq("id", credit.get("production_id")).execute()

            results.append({
                **credit,
                "profiles": profile_result.data[0] if profile_result.data else None,
                "productions": prod_result.data[0] if prod_result.data else None
            })

        return results
    except Exception as e:
        print(f"Admin credits error: {e}")
        return []


@router.delete("/credits/{credit_id}")
async def delete_credit_admin(credit_id: str):
    """Delete a credit"""
    try:
        client = get_client()
        client.table("credits").delete().eq("id", credit_id).execute()
        return {"message": "Credit deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/applications/partners/{application_id}/status")
async def update_partner_application_status(
    application_id: str,
    update: PartnerApplicationStatusUpdate
):
    """Update partner application status and admin notes"""
    try:
        client = get_client()

        update_data = {"status": update.status}
        if update.admin_notes is not None:
            update_data["admin_notes"] = update.admin_notes

        client.table("partner_applications").update(update_data).eq(
            "id", application_id
        ).execute()

        # If approved, could create partner_profile here if needed
        if update.status == "approved":
            # Get the application to get user_id
            app_result = client.table("partner_applications").select(
                "user_id, company_name, brand_name"
            ).eq("id", application_id).single().execute()

            if app_result.data and app_result.data.get("user_id"):
                user_id = app_result.data["user_id"]
                company = app_result.data.get("company_name") or app_result.data.get("brand_name")

                # Update user role to partner
                client.table("profiles").update({
                    "role": "partner"
                }).eq("id", user_id).execute()

                # Create partner profile if it doesn't exist
                client.table("partner_profiles").upsert({
                    "user_id": user_id,
                    "company_name": company,
                }, on_conflict="user_id").execute()

        return {"message": "Application status updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
