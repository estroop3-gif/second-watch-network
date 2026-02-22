"""
Admin API Routes

Protected with permission-based access control.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from app.core.database import get_client
from app.core.permissions import Permission, require_permissions
from app.core.exceptions import NotFoundError, ForbiddenError
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
async def get_dashboard_stats(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_DASHBOARD))
):
    """
    Get admin dashboard statistics.

    Requires: ADMIN_DASHBOARD permission
    """
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
async def list_all_users(
    skip: int = 0,
    limit: int = 50,
    role: Optional[str] = None,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_USERS))
):
    """
    List all users.

    Requires: ADMIN_USERS permission
    """
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
async def ban_user(
    request: UserBanRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.USER_BAN))
):
    """
    Ban or unban a user.

    Requires: USER_BAN permission
    """
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


@router.put("/users/{user_id}/feature")
async def toggle_user_featured(user_id: str, is_featured: bool = True):
    """Toggle user featured status for homepage/discovery"""
    try:
        client = get_client()

        # If featuring, get the next order number
        featured_order = 0
        if is_featured:
            result = client.table("profiles").select("featured_order").eq("is_featured", True).order("featured_order", desc=True).limit(1).execute()
            if result.data:
                featured_order = (result.data[0].get("featured_order") or 0) + 1

        client.table("profiles").update({
            "is_featured": is_featured,
            "featured_order": featured_order if is_featured else 0
        }).eq("id", user_id).execute()

        return {"message": f"User {'featured' if is_featured else 'unfeatured'} successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/featured")
async def list_featured_users():
    """List all featured users for homepage/discovery"""
    try:
        client = get_client()
        response = client.table("profiles").select(
            "id, full_name, username, avatar_url, bio, tagline, is_filmmaker, is_partner, featured_order"
        ).eq("is_featured", True).order("featured_order").execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/featured/reorder")
async def reorder_featured_users(user_ids: list):
    """Reorder featured users"""
    try:
        client = get_client()
        for idx, user_id in enumerate(user_ids):
            client.table("profiles").update({"featured_order": idx}).eq("id", user_id).execute()
        return {"message": "Featured users reordered successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete user account from both database and Cognito"""
    try:
        import boto3
        from app.core.config import settings

        client = get_client()

        # Get user email before deleting from database
        user_result = client.table("profiles").select("email").eq("id", user_id).single().execute()
        user_email = user_result.data.get("email") if user_result.data else None

        # Delete from Cognito if we have the email
        if user_email:
            try:
                cognito_client = boto3.client(
                    "cognito-idp",
                    region_name=settings.COGNITO_REGION
                )

                # Find user in Cognito by email
                cognito_users = cognito_client.list_users(
                    UserPoolId=settings.COGNITO_USER_POOL_ID,
                    Filter=f'email = "{user_email}"'
                )

                # Delete from Cognito if found
                if cognito_users.get("Users"):
                    cognito_username = cognito_users["Users"][0]["Username"]
                    cognito_client.admin_delete_user(
                        UserPoolId=settings.COGNITO_USER_POOL_ID,
                        Username=cognito_username
                    )
            except Exception as cognito_error:
                # Log but don't fail if Cognito deletion fails
                print(f"Warning: Failed to delete user from Cognito: {cognito_error}")

        # Delete all associated data BEFORE deleting profile
        # Order matters due to foreign key constraints
        # Use helper to safely delete from tables (ignores non-existent tables)
        def safe_delete(table: str, column: str, value: str):
            try:
                client.table(table).delete().eq(column, value).execute()
            except Exception as e:
                # Ignore errors for non-existent tables or missing columns
                print(f"Note: Could not delete from {table}: {e}")

        # Backlot related - delete user-created content first
        safe_delete("backlot_scripts", "created_by_user_id", user_id)
        safe_delete("backlot_call_sheets", "created_by", user_id)
        safe_delete("backlot_invoices", "created_by", user_id)
        safe_delete("backlot_project_contacts", "user_id", user_id)
        safe_delete("backlot_project_members", "user_id", user_id)
        safe_delete("backlot_timecards", "user_id", user_id)
        safe_delete("backlot_timecard_entries", "user_id", user_id)
        safe_delete("backlot_receipts", "user_id", user_id)
        safe_delete("backlot_mileage_entries", "user_id", user_id)
        safe_delete("backlot_user_notes", "user_id", user_id)
        safe_delete("backlot_user_bookmarks", "user_id", user_id)
        safe_delete("backlot_checkins", "user_id", user_id)
        safe_delete("backlot_desktop_keys", "user_id", user_id)
        safe_delete("backlot_desktop_api_keys", "user_id", user_id)

        # Delete projects created by user (will cascade to project-related tables)
        safe_delete("backlot_projects", "created_by", user_id)

        # Community/Forum related
        safe_delete("community_replies", "user_id", user_id)
        safe_delete("community_threads", "user_id", user_id)

        # Craft House discussions
        safe_delete("craft_house_replies", "user_id", user_id)
        safe_delete("craft_house_threads", "user_id", user_id)
        safe_delete("craft_house_topics", "created_by", user_id)

        # Order related
        safe_delete("order_craft_house_memberships", "user_id", user_id)
        safe_delete("order_fellowship_memberships", "user_id", user_id)
        safe_delete("order_member_profiles", "user_id", user_id)
        safe_delete("order_applications", "user_id", user_id)
        safe_delete("order_job_applications", "user_id", user_id)
        safe_delete("order_booking_requests", "target_user_id", user_id)
        safe_delete("order_event_rsvps", "user_id", user_id)

        # Messages
        safe_delete("messages", "sender_id", user_id)
        safe_delete("conversation_participants", "user_id", user_id)

        # Notifications
        safe_delete("notifications", "user_id", user_id)

        # Connections
        safe_delete("connections", "from_user_id", user_id)
        safe_delete("connections", "to_user_id", user_id)

        # Green Room
        safe_delete("greenroom_submissions", "user_id", user_id)
        safe_delete("greenroom_votes", "user_id", user_id)

        # Submissions
        safe_delete("submissions", "user_id", user_id)

        # Filmmaker profiles
        safe_delete("filmmaker_profiles", "user_id", user_id)
        safe_delete("filmmaker_applications", "user_id", user_id)

        # Finally delete the profile
        client.table("profiles").delete().eq("id", user_id).execute()

        return {"message": "User deleted successfully from database and Cognito"}
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


@router.get("/profiles/privacy-defaults")
async def get_privacy_defaults():
    """Get privacy defaults for new user profiles"""
    try:
        client = get_client()
        response = client.table("settings").select("value").eq("key", "privacy_defaults").single().execute()
        if response.data:
            return response.data.get("value", {}).get("value", {})
        # Return default values if not set
        return {
            "profile_visibility": "public",
            "show_email": False,
            "show_phone": False,
            "show_location": True,
            "show_availability": True,
            "show_credits": True,
            "show_equipment": True,
            "allow_messages": "everyone",
        }
    except Exception as e:
        # Return defaults on error
        return {
            "profile_visibility": "public",
            "show_email": False,
            "show_phone": False,
            "show_location": True,
            "show_availability": True,
            "show_credits": True,
            "show_equipment": True,
            "allow_messages": "everyone",
        }


@router.put("/profiles/privacy-defaults")
async def update_privacy_defaults(data: dict):
    """Update privacy defaults for new user profiles"""
    try:
        client = get_client()
        client.table("settings").upsert({
            "key": "privacy_defaults",
            "value": {"value": data}
        }, on_conflict="key").execute()
        return {"message": "Privacy defaults updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard/newly-available")
async def get_newly_available_filmmakers(hours: int = 48):
    """Get filmmakers who recently became available"""
    try:
        client = get_client()
        from datetime import datetime, timedelta

        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

        # Get availability records
        response = client.table("availability").select(
            "*, profile:user_id(id, full_name, username, avatar_url)"
        ).gte("created_at", cutoff).order("created_at", desc=True).execute()

        # Fetch filmmaker profiles for each user
        results = response.data or []
        for item in results:
            if item.get("user_id"):
                fp = client.table("filmmaker_profiles").select("department").eq("user_id", item["user_id"]).execute()
                item["filmmaker_profile"] = fp.data[0] if fp.data else None

        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def build_roles_array(profile: dict) -> list:
    """Build roles array from boolean flags"""
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
    if profile.get("is_alpha_tester"):
        roles.append("alpha_tester")

    # Fallback to legacy role if no flags set
    if not roles and profile.get("role"):
        roles.append(profile.get("role"))
    if not roles:
        roles.append("free")

    return roles


@router.get("/users/all")
async def get_all_users_with_profiles(
    skip: int = 0,
    limit: int = 25,
    search: Optional[str] = None,
    roles: Optional[str] = None,  # Comma-separated: "filmmaker,premium"
    status: Optional[str] = None,  # "active", "banned", or None for all
    is_featured: Optional[bool] = None,  # Filter by featured status
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """Get all users with their profiles (for admin user management) with search/filter/pagination"""
    try:
        client = get_client()

        # Build base query
        query = client.table("profiles").select(
            "id, email, created_at, username, full_name, role, avatar_url, is_banned, status, bio, "
            "is_superadmin, is_admin, is_moderator, is_lodge_officer, "
            "is_order_member, is_partner, is_filmmaker, is_premium, is_alpha_tester, is_featured, featured_order",
            count="exact"
        )

        # Apply search filter (searches name, email, username)
        if search:
            search_term = f"%{search}%"
            query = query.or_(
                f"username.ilike.{search_term},"
                f"email.ilike.{search_term},"
                f"full_name.ilike.{search_term}"
            )

        # Apply status filter
        if status == "active":
            query = query.eq("is_banned", False)
        elif status == "banned":
            query = query.eq("is_banned", True)

        # Apply date range filter
        if date_from:
            query = query.gte("created_at", date_from)
        if date_to:
            query = query.lte("created_at", date_to)

        # Apply role filters (need to filter by boolean flags)
        if roles:
            role_list = [r.strip() for r in roles.split(",")]
            for role in role_list:
                column = ROLE_TO_COLUMN.get(role)
                if column:
                    query = query.eq(column, True)

        # Apply featured filter
        if is_featured is not None:
            query = query.eq("is_featured", is_featured)

        # Apply sorting
        is_desc = sort_order.lower() == "desc"
        valid_sort_fields = ["created_at", "email", "username", "full_name"]
        if sort_by in valid_sort_fields:
            query = query.order(sort_by, desc=is_desc)
        else:
            query = query.order("created_at", desc=True)

        # Apply pagination
        query = query.range(skip, skip + limit - 1)

        response = query.execute()

        # Format response to match expected structure
        users = []
        for profile in response.data:
            roles_arr = build_roles_array(profile)

            users.append({
                "id": profile.get("id"),
                "email": profile.get("email"),
                "created_at": profile.get("created_at"),
                "full_name": profile.get("full_name"),
                "bio": profile.get("bio"),
                "profile": {
                    "username": profile.get("username"),
                    "roles": roles_arr,
                    "avatar_url": profile.get("avatar_url"),
                    "is_banned": profile.get("is_banned", False)
                }
            })

        total = response.count or 0
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "users": users,
            "total": total,
            "page": (skip // limit) + 1 if limit > 0 else 1,
            "pages": pages,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/stats")
async def get_user_stats():
    """Get user statistics for admin dashboard"""
    try:
        client = get_client()
        from datetime import datetime, timedelta

        # Calculate date for "new this week"
        one_week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

        # Total users
        total_result = client.table("profiles").select("id", count="exact").execute()
        total_users = total_result.count or 0

        # New this week
        new_result = client.table("profiles").select("id", count="exact").gte("created_at", one_week_ago).execute()
        new_this_week = new_result.count or 0

        # Active filmmakers (is_filmmaker = true)
        filmmakers_result = client.table("profiles").select("id", count="exact").eq("is_filmmaker", True).execute()
        active_filmmakers = filmmakers_result.count or 0

        # Order members
        order_result = client.table("profiles").select("id", count="exact").eq("is_order_member", True).execute()
        order_members = order_result.count or 0

        # Premium subscribers
        premium_result = client.table("profiles").select("id", count="exact").eq("is_premium", True).execute()
        premium_subscribers = premium_result.count or 0

        # Banned users
        banned_result = client.table("profiles").select("id", count="exact").eq("is_banned", True).execute()
        banned_users = banned_result.count or 0

        return {
            "total_users": total_users,
            "new_this_week": new_this_week,
            "active_filmmakers": active_filmmakers,
            "order_members": order_members,
            "premium_subscribers": premium_subscribers,
            "banned_users": banned_users
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}/details")
async def get_user_details(user_id: str):
    """Get detailed user information including related profiles and activity"""
    try:
        client = get_client()

        # Get main profile
        profile_result = client.table("profiles").select(
            "id, email, created_at, username, full_name, bio, avatar_url, role, status, "
            "is_banned, is_superadmin, is_admin, is_moderator, is_lodge_officer, "
            "is_order_member, is_partner, is_filmmaker, is_premium, "
            "has_completed_filmmaker_onboarding, stripe_customer_id"
        ).eq("id", user_id).single().execute()

        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User not found")

        profile = profile_result.data
        roles = build_roles_array(profile)

        # Get filmmaker profile if exists
        filmmaker_profile = None
        try:
            filmmaker_result = client.table("filmmaker_profiles").select(
                "id, full_name, bio, skills, experience_level, department, "
                "portfolio_url, reel_url, location, accepting_work, status_message"
            ).eq("user_id", user_id).single().execute()
            filmmaker_profile = filmmaker_result.data
        except Exception:
            pass

        # Get order membership if exists
        order_membership = None
        try:
            order_result = client.table("order_member_profiles").select(
                "id, primary_track, secondary_tracks, years_experience, bio, "
                "city, region, status, dues_status, joined_at, probation_ends_at, lodge_id"
            ).eq("user_id", user_id).single().execute()
            order_membership = order_result.data
        except Exception:
            pass

        # Get user's submissions (last 10)
        submissions_result = client.table("submissions").select(
            "id, project_title, status, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
        submissions = submissions_result.data or []

        # Get user's applications
        applications = []

        # Filmmaker applications
        try:
            fm_apps = client.table("filmmaker_applications").select(
                "id, status, created_at"
            ).eq("user_id", user_id).execute()
            for app in (fm_apps.data or []):
                applications.append({**app, "type": "filmmaker"})
        except Exception:
            pass

        # Partner applications
        try:
            partner_apps = client.table("partner_applications").select(
                "id, status, created_at, company_name"
            ).eq("user_id", user_id).execute()
            for app in (partner_apps.data or []):
                applications.append({**app, "type": "partner"})
        except Exception:
            pass

        # Order applications
        try:
            order_apps = client.table("order_applications").select(
                "id, status, created_at"
            ).eq("user_id", user_id).execute()
            for app in (order_apps.data or []):
                applications.append({**app, "type": "order"})
        except Exception:
            pass

        # Get recent activity from audit log (actions on this user)
        recent_activity = []
        try:
            activity_result = client.table("admin_audit_log").select(
                "id, action, details, created_at, admin:profiles!admin_id(username)"
            ).eq("target_id", user_id).order("created_at", desc=True).limit(20).execute()
            recent_activity = activity_result.data or []
        except Exception:
            pass

        # Get backlot projects owned by user
        backlot_projects = []
        try:
            projects_result = client.table("backlot_projects").select(
                "id, title, status, project_type, created_at, thumbnail_url"
            ).eq("owner_id", user_id).order("created_at", desc=True).execute()
            backlot_projects = projects_result.data or []
        except Exception:
            pass

        # Get storage usage
        storage_usage = None
        try:
            storage_result = client.table("user_storage_usage").select(
                "total_bytes_used, custom_quota_bytes"
            ).eq("user_id", user_id).single().execute()
            if storage_result.data:
                bytes_used = storage_result.data.get("total_bytes_used") or 0
                custom_quota = storage_result.data.get("custom_quota_bytes")
                # Default 1GB quota if none set
                quota = custom_quota or 1073741824
                percentage = (bytes_used / quota * 100) if quota > 0 else 0
                storage_usage = {
                    "bytes_used": bytes_used,
                    "quota_bytes": quota,
                    "custom_quota_bytes": custom_quota,
                    "percentage": round(percentage, 1)
                }
        except Exception:
            pass

        return {
            "profile": {
                "id": profile.get("id"),
                "email": profile.get("email"),
                "username": profile.get("username"),
                "full_name": profile.get("full_name"),
                "display_name": profile.get("display_name"),
                "bio": profile.get("bio"),
                "avatar_url": profile.get("avatar_url"),
                "created_at": profile.get("created_at"),
                "status": profile.get("status"),
                "is_banned": profile.get("is_banned", False),
                "roles": roles,
                "has_completed_filmmaker_onboarding": profile.get("has_completed_filmmaker_onboarding"),
                "stripe_customer_id": profile.get("stripe_customer_id")
            },
            "filmmaker_profile": filmmaker_profile,
            "order_membership": order_membership,
            "submissions": submissions,
            "applications": applications,
            "recent_activity": recent_activity,
            "backlot_projects": backlot_projects,
            "storage_usage": storage_usage
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str):
    """Send password reset email to user via Cognito"""
    try:
        import boto3
        from app.core.config import settings

        client = get_client()

        # Get user email
        profile_result = client.table("profiles").select("email").eq("id", user_id).single().execute()

        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User not found")

        email = profile_result.data.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="User has no email address")

        # Call Cognito to send password reset
        cognito_client = boto3.client(
            "cognito-idp",
            region_name=settings.COGNITO_REGION
        )

        cognito_client.admin_reset_user_password(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=email
        )

        return {"success": True, "message": f"Password reset email sent to {email}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class AdminProfileUpdate(BaseModel):
    """Request model for admin profile updates"""
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None


@router.put("/users/{user_id}/profile")
async def admin_update_user_profile(user_id: str, data: AdminProfileUpdate):
    """Admin updates user profile fields"""
    try:
        import boto3
        from app.core.config import settings

        client = get_client()

        # Get current profile
        profile_result = client.table("profiles").select("email").eq("id", user_id).single().execute()
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User not found")

        old_email = profile_result.data.get("email")

        # Build update data
        update_data = {}
        if data.full_name is not None:
            update_data["full_name"] = data.full_name
        if data.display_name is not None:
            update_data["display_name"] = data.display_name
        if data.username is not None:
            # Check username uniqueness
            existing = client.table("profiles").select("id").eq("username", data.username).neq("id", user_id).execute()
            if existing.data:
                raise HTTPException(status_code=400, detail="Username already taken")
            update_data["username"] = data.username
        if data.bio is not None:
            update_data["bio"] = data.bio
        if data.email is not None and data.email != old_email:
            # Check email uniqueness
            existing = client.table("profiles").select("id").eq("email", data.email).neq("id", user_id).execute()
            if existing.data:
                raise HTTPException(status_code=400, detail="Email already in use")
            update_data["email"] = data.email

            # Update email in Cognito
            try:
                cognito_client = boto3.client(
                    "cognito-idp",
                    region_name=settings.COGNITO_REGION
                )
                cognito_client.admin_update_user_attributes(
                    UserPoolId=settings.COGNITO_USER_POOL_ID,
                    Username=user_id,
                    UserAttributes=[
                        {"Name": "email", "Value": data.email},
                        {"Name": "email_verified", "Value": "true"}
                    ]
                )
            except Exception as cognito_error:
                print(f"Warning: Failed to update email in Cognito: {cognito_error}")

        if not update_data:
            return {"success": True, "message": "No changes to apply"}

        # Update profile in database
        result = client.table("profiles").update(update_data).eq("id", user_id).execute()

        return {
            "success": True,
            "message": "Profile updated successfully",
            "updated_fields": list(update_data.keys())
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/users/{user_id}/resend-temp-password")
async def resend_temp_password(user_id: str):
    """Generate new temporary password and send welcome email"""
    try:
        import boto3
        import secrets
        import string
        from app.core.config import settings
        from app.services.email_service import send_welcome_email

        client = get_client()

        # Get user info
        profile_result = client.table("profiles").select("email, display_name, full_name").eq("id", user_id).single().execute()

        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User not found")

        email = profile_result.data.get("email")
        name = profile_result.data.get("display_name") or profile_result.data.get("full_name") or email

        if not email:
            raise HTTPException(status_code=400, detail="User has no email address")

        # Generate new temporary password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = [
            secrets.choice(string.ascii_lowercase),
            secrets.choice(string.ascii_uppercase),
            secrets.choice(string.digits),
            secrets.choice("!@#$%^&*")
        ]
        password.extend(secrets.choice(alphabet) for _ in range(12))
        secrets.SystemRandom().shuffle(password)
        temp_password = ''.join(password)

        # Set new password in Cognito (Permanent=False forces change on next login)
        cognito_client = boto3.client(
            "cognito-idp",
            region_name=settings.COGNITO_REGION
        )

        cognito_client.admin_set_user_password(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=user_id,
            Password=temp_password,
            Permanent=False
        )

        # Send welcome email with new temp password
        await send_welcome_email(
            email=email,
            name=name,
            temp_password=temp_password
        )

        return {
            "success": True,
            "message": f"Temporary password email sent to {email}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class BulkUserAction(BaseModel):
    user_ids: List[str]
    action: str  # "ban", "unban", "add_role", "remove_role"
    role: Optional[str] = None  # Required for add_role/remove_role


@router.post("/users/bulk")
async def bulk_user_action(request: BulkUserAction):
    """Perform bulk action on multiple users"""
    try:
        client = get_client()

        if not request.user_ids:
            raise HTTPException(status_code=400, detail="No users specified")

        affected_count = 0

        if request.action == "ban":
            for user_id in request.user_ids:
                client.table("profiles").update({"is_banned": True, "status": "banned"}).eq("id", user_id).execute()
                affected_count += 1
            message = f"{affected_count} users banned successfully"

        elif request.action == "unban":
            for user_id in request.user_ids:
                client.table("profiles").update({"is_banned": False, "status": "active"}).eq("id", user_id).execute()
                affected_count += 1
            message = f"{affected_count} users unbanned successfully"

        elif request.action == "add_role":
            if not request.role:
                raise HTTPException(status_code=400, detail="Role is required for add_role action")

            column = ROLE_TO_COLUMN.get(request.role)
            if not column:
                raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")

            for user_id in request.user_ids:
                client.table("profiles").update({column: True}).eq("id", user_id).execute()
                affected_count += 1
            message = f"Role '{request.role}' added to {affected_count} users"

        elif request.action == "remove_role":
            if not request.role:
                raise HTTPException(status_code=400, detail="Role is required for remove_role action")

            column = ROLE_TO_COLUMN.get(request.role)
            if not column:
                raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")

            for user_id in request.user_ids:
                client.table("profiles").update({column: False}).eq("id", user_id).execute()
                affected_count += 1
            message = f"Role '{request.role}' removed from {affected_count} users"

        else:
            raise HTTPException(status_code=400, detail=f"Invalid action: {request.action}")

        return {
            "success": True,
            "affected_count": affected_count,
            "message": message
        }
    except HTTPException:
        raise
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
    send_email: bool = True


@router.post("/submissions/status")
async def update_submission_status(update: SubmissionStatusUpdate):
    """Update submission status and optionally send email notification"""
    try:
        client = get_client()

        # Get submission details for email
        submission = client.table("submissions").select(
            "id, project_title, user_id, status"
        ).eq("id", update.submission_id).single().execute()

        if not submission.data:
            raise HTTPException(status_code=404, detail="Submission not found")

        old_status = submission.data.get("status")
        user_id = submission.data.get("user_id")
        project_title = submission.data.get("project_title")

        # Update the status
        client.table("submissions").update({"status": update.status}).eq("id", update.submission_id).execute()

        # Send email notification if enabled and user exists
        if update.send_email and user_id and old_status != update.status:
            try:
                # Get user profile for email
                profile = client.table("profiles").select(
                    "email, full_name, username"
                ).eq("id", user_id).single().execute()

                if profile.data and profile.data.get("email"):
                    from app.services.email_service import send_submission_status_email

                    name = profile.data.get("full_name") or profile.data.get("username") or "Filmmaker"
                    email = profile.data.get("email")

                    await send_submission_status_email(
                        email=email,
                        name=name,
                        project_title=project_title,
                        new_status=update.status,
                        submission_id=update.submission_id
                    )
            except Exception as email_error:
                # Log but don't fail the status update
                print(f"Warning: Failed to send status email: {email_error}")

        return {"message": "Status updated successfully"}
    except HTTPException:
        raise
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


@router.get("/submissions/{submission_id}/submitter-profile")
async def get_submitter_profile(submission_id: str):
    """
    Get full submitter profile for a submission.
    Includes profile info, filmmaker profile, all submissions by this user,
    and activity history.
    """
    try:
        client = get_client()

        # Get the submission to find the user_id
        submission_result = client.table("submissions").select(
            "user_id, email"
        ).eq("id", submission_id).single().execute()

        if not submission_result.data:
            raise HTTPException(status_code=404, detail="Submission not found")

        user_id = submission_result.data.get("user_id")

        if not user_id:
            # Orphaned submission (no user_id)
            return {
                "profile": None,
                "filmmaker_profile": None,
                "submissions": [],
                "activity_history": [],
                "total_submissions": 0,
                "approved_submissions": 0,
                "is_orphaned": True,
                "email": submission_result.data.get("email")
            }

        # Get user profile
        profile_result = client.table("profiles").select(
            "id, full_name, username, email, avatar_url, bio, created_at, "
            "is_filmmaker, is_order_member, is_partner, is_premium"
        ).eq("id", user_id).single().execute()

        if not profile_result.data:
            return {
                "profile": None,
                "filmmaker_profile": None,
                "submissions": [],
                "activity_history": [],
                "total_submissions": 0,
                "approved_submissions": 0,
                "is_orphaned": True
            }

        profile = profile_result.data

        # Get filmmaker profile if exists
        filmmaker_profile = None
        try:
            filmmaker_result = client.table("filmmaker_profiles").select(
                "id, full_name, bio, skills, experience_level, department, "
                "portfolio_url, reel_url, location, accepting_work"
            ).eq("user_id", user_id).single().execute()
            filmmaker_profile = filmmaker_result.data
        except Exception:
            pass

        # Get all submissions from this user
        submissions_result = client.table("submissions").select(
            "id, project_title, project_type, status, created_at, "
            "company_name, submitter_role, years_experience"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

        submissions = submissions_result.data or []

        # Calculate stats
        total_submissions = len(submissions)
        approved_submissions = len([s for s in submissions if s.get("status") == "approved"])

        # Get activity history (last 50 entries)
        activity_history = []
        try:
            activity_result = client.table("user_activity_log").select(
                "id, activity_type, activity_details, created_at"
            ).eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
            activity_history = activity_result.data or []
        except Exception:
            # Table may not exist yet
            pass

        return {
            "profile": profile,
            "filmmaker_profile": filmmaker_profile,
            "submissions": submissions,
            "activity_history": activity_history,
            "total_submissions": total_submissions,
            "approved_submissions": approved_submissions,
            "is_orphaned": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/submissions/stats")
async def get_submission_stats():
    """Get submission statistics for admin dashboard (both content and greenroom)"""
    try:
        client = get_client()
        from datetime import datetime, timedelta

        # Calculate date for "new this week"
        one_week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

        # Content submissions stats
        total_content = client.table("submissions").select("id", count="exact").execute()
        content_pending = client.table("submissions").select("id", count="exact").eq("status", "pending").execute()
        content_in_review = client.table("submissions").select("id", count="exact").eq("status", "in review").execute()
        content_approved = client.table("submissions").select("id", count="exact").eq("status", "approved").execute()
        content_rejected = client.table("submissions").select("id", count="exact").eq("status", "rejected").execute()
        content_new_week = client.table("submissions").select("id", count="exact").gte("created_at", one_week_ago).execute()

        # Green Room project stats
        total_greenroom = client.table("greenroom_projects").select("id", count="exact").execute()
        greenroom_pending = client.table("greenroom_projects").select("id", count="exact").eq("status", "pending").execute()
        greenroom_approved = client.table("greenroom_projects").select("id", count="exact").eq("status", "approved").execute()
        greenroom_rejected = client.table("greenroom_projects").select("id", count="exact").eq("status", "rejected").execute()
        greenroom_new_week = client.table("greenroom_projects").select("id", count="exact").gte("created_at", one_week_ago).execute()

        return {
            "total_content": total_content.count or 0,
            "total_greenroom": total_greenroom.count or 0,
            "content_pending": content_pending.count or 0,
            "content_in_review": content_in_review.count or 0,
            "content_approved": content_approved.count or 0,
            "content_rejected": content_rejected.count or 0,
            "greenroom_pending": greenroom_pending.count or 0,
            "greenroom_approved": greenroom_approved.count or 0,
            "greenroom_rejected": greenroom_rejected.count or 0,
            "new_this_week": (content_new_week.count or 0) + (greenroom_new_week.count or 0)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/greenroom/list")
async def list_greenroom_admin(
    skip: int = 0,
    limit: int = 15,
    status: Optional[str] = None,
    search: Optional[str] = None,
    cycle_id: Optional[int] = None
):
    """List Green Room projects for admin with filters"""
    try:
        client = get_client()

        query = client.table("greenroom_projects").select(
            "id, title, description, category, video_url, image_url, status, vote_count, "
            "created_at, cycle_id, filmmaker_id, "
            "filmmaker:profiles!filmmaker_id(id, username, full_name, avatar_url, email)",
            count="exact"
        )

        if status and status != "all":
            query = query.eq("status", status)

        if cycle_id:
            query = query.eq("cycle_id", cycle_id)

        if search:
            query = query.or_(f"title.ilike.%{search}%,description.ilike.%{search}%")

        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()

        return {
            "projects": response.data,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class BulkSubmissionAction(BaseModel):
    submission_ids: List[str]
    action: str  # "approve", "reject", "archive", "in_review", "considered", "pending"
    submission_type: str  # "content" or "greenroom"
    send_email: bool = False


@router.post("/submissions/bulk")
async def bulk_submission_action(request: BulkSubmissionAction):
    """Perform bulk action on multiple submissions"""
    try:
        client = get_client()

        if not request.submission_ids:
            raise HTTPException(status_code=400, detail="No submissions specified")

        # Map action to status
        status_map = {
            "approve": "approved",
            "reject": "rejected",
            "archive": "archived",
            "in_review": "in review",
            "considered": "considered",
            "pending": "pending"
        }

        new_status = status_map.get(request.action)
        if not new_status:
            raise HTTPException(status_code=400, detail=f"Invalid action: {request.action}")

        affected_count = 0
        table = "submissions" if request.submission_type == "content" else "greenroom_projects"

        for submission_id in request.submission_ids:
            try:
                client.table(table).update({"status": new_status}).eq("id", submission_id).execute()
                affected_count += 1

                # TODO: Send email notification if request.send_email is True
                # This would be integrated with email_service.py
            except Exception:
                pass  # Continue with other submissions if one fails

        return {
            "success": True,
            "affected_count": affected_count,
            "message": f"{affected_count} submissions updated to '{new_status}'"
        }
    except HTTPException:
        raise
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
    "sales_admin": "is_sales_admin",
    "sales_agent": "is_sales_agent",
    "sales_rep": "is_sales_rep",
    "media_team": "is_media_team",
    "lodge_officer": "is_lodge_officer",
    "order_member": "is_order_member",
    "partner": "is_partner",
    "filmmaker": "is_filmmaker",
    "premium": "is_premium",
    "alpha_tester": "is_alpha_tester",
}


@router.post("/users/roles")
async def update_user_roles(update: UserRolesUpdate):
    """Update user roles (sets boolean flags for each role)"""
    try:
        client = get_client()
        from datetime import datetime

        # Build update dict with all role flags set appropriately
        update_data = {}

        # Set all role flags based on the roles array
        for role_name, column_name in ROLE_TO_COLUMN.items():
            update_data[column_name] = role_name in update.roles

        # Set the legacy "role" field based on tier/premium status (not the role flags)
        # The role field only accepts: 'user', 'member', 'filmmaker', 'partner', 'admin', 'superadmin', 'premium'
        if "superadmin" in update.roles:
            update_data["role"] = "superadmin"
        elif "admin" in update.roles:
            update_data["role"] = "admin"
        elif "premium" in update.roles:
            update_data["role"] = "premium"
        elif "filmmaker" in update.roles:
            update_data["role"] = "filmmaker"
        elif "partner" in update.roles:
            update_data["role"] = "partner"
        elif "order_member" in update.roles or "lodge_officer" in update.roles:
            update_data["role"] = "member"
        else:
            update_data["role"] = "user"

        # Handle alpha_tester_since timestamp
        if "alpha_tester" in update.roles:
            # Check if user was already an alpha tester
            existing = client.table("profiles").select("is_alpha_tester, alpha_tester_since").eq("id", update.user_id).single().execute()
            if not existing.data.get("is_alpha_tester"):
                update_data["alpha_tester_since"] = datetime.utcnow().isoformat()
        else:
            update_data["alpha_tester_since"] = None

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
        # Get filmmaker profiles with user info
        response = client.table("filmmaker_profiles").select(
            "*, profile:user_id(id, username, avatar_url, full_name)"
        ).execute()
        return response.data or []
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


# =====================================================
# AUDIT LOG ENDPOINTS
# =====================================================

class AuditLogEntry(BaseModel):
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[dict] = None
    admin_id: Optional[str] = None


class AuditLogFilters(BaseModel):
    admin_id: Optional[str] = None
    action: Optional[str] = None
    target_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.get("/audit-log")
async def get_audit_log(
    skip: int = 0,
    limit: int = 50,
    admin_id: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get audit log entries with optional filters"""
    try:
        client = get_client()

        query = client.table("admin_audit_log").select(
            "*, admin:profiles!admin_id(id, username, full_name, avatar_url)"
        )

        if admin_id:
            query = query.eq("admin_id", admin_id)
        if action:
            query = query.eq("action", action)
        if target_type:
            query = query.eq("target_type", target_type)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)

        # Get total count
        count_query = client.table("admin_audit_log").select("id", count="exact")
        if admin_id:
            count_query = count_query.eq("admin_id", admin_id)
        if action:
            count_query = count_query.eq("action", action)
        if target_type:
            count_query = count_query.eq("target_type", target_type)
        if start_date:
            count_query = count_query.gte("created_at", start_date)
        if end_date:
            count_query = count_query.lte("created_at", end_date)

        count_result = count_query.execute()

        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        return {
            "data": response.data,
            "total": count_result.count or 0,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/audit-log")
async def create_audit_log_entry(entry: AuditLogEntry):
    """Create an audit log entry (called internally when admin actions occur)"""
    try:
        client = get_client()

        log_data = {
            "action": entry.action,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
            "details": entry.details or {},
            "admin_id": entry.admin_id
        }

        client.table("admin_audit_log").insert(log_data).execute()

        return {"message": "Audit log entry created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit-log/actions")
async def get_audit_log_action_types():
    """Get distinct action types for filtering"""
    try:
        client = get_client()

        # Get distinct actions
        response = client.table("admin_audit_log").select("action").execute()

        actions = list(set([r["action"] for r in response.data if r.get("action")]))
        actions.sort()

        return {"actions": actions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit-log/admins")
async def get_audit_log_admins():
    """Get list of admins who have audit log entries"""
    try:
        client = get_client()

        # Get distinct admin_ids from audit log
        response = client.table("admin_audit_log").select("admin_id").execute()

        admin_ids = list(set([r["admin_id"] for r in response.data if r.get("admin_id")]))

        if not admin_ids:
            return {"admins": []}

        # Get admin profiles
        admins_response = client.table("profiles").select(
            "id, username, full_name, avatar_url"
        ).in_("id", admin_ids).execute()

        return {"admins": admins_response.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit-log/export")
async def export_audit_log(
    admin_id: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Export audit log as CSV-ready data"""
    try:
        client = get_client()

        query = client.table("admin_audit_log").select(
            "id, action, target_type, target_id, details, ip_address, created_at, admin:profiles!admin_id(username, full_name)"
        )

        if admin_id:
            query = query.eq("admin_id", admin_id)
        if action:
            query = query.eq("action", action)
        if target_type:
            query = query.eq("target_type", target_type)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)

        response = query.order("created_at", desc=True).execute()

        # Format for CSV export
        export_data = []
        for entry in response.data:
            admin_info = entry.get("admin") or {}
            export_data.append({
                "id": entry.get("id"),
                "timestamp": entry.get("created_at"),
                "admin_username": admin_info.get("username", "Unknown"),
                "admin_name": admin_info.get("full_name", ""),
                "action": entry.get("action"),
                "target_type": entry.get("target_type", ""),
                "target_id": entry.get("target_id", ""),
                "details": str(entry.get("details", {})),
                "ip_address": entry.get("ip_address", "")
            })

        return {"data": export_data, "count": len(export_data)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# ALPHA TESTING MANAGEMENT
# ============================================================================

@router.get("/alpha/testers")
async def list_alpha_testers(
    skip: int = 0,
    limit: int = 25,
    search: Optional[str] = None
):
    """List all alpha testers with their activity stats"""
    try:
        client = get_client()

        query = client.table("profiles").select(
            "id, full_name, username, email, avatar_url, is_alpha_tester, alpha_tester_since, alpha_tester_notes, created_at",
            count="exact"
        ).eq("is_alpha_tester", True)

        if search:
            search_term = f"%{search}%"
            query = query.or_(f"username.ilike.{search_term},email.ilike.{search_term},full_name.ilike.{search_term}")

        query = query.order("alpha_tester_since", desc=True).range(skip, skip + limit - 1)
        response = query.execute()

        # Get feedback counts for each tester
        testers = response.data or []
        for tester in testers:
            feedback_count = client.table("alpha_feedback").select("id", count="exact").eq("user_id", tester["id"]).execute()
            tester["feedback_count"] = feedback_count.count or 0

            # Get last session
            last_session = client.table("alpha_session_logs").select("session_start").eq("user_id", tester["id"]).order("session_start", desc=True).limit(1).execute()
            tester["last_session"] = last_session.data[0]["session_start"] if last_session.data else None

        return {
            "testers": testers,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/alpha/testers/{user_id}/toggle")
async def toggle_alpha_tester(user_id: str, is_alpha: bool = True, notes: Optional[str] = None):
    """Add or remove a user as an alpha tester"""
    try:
        client = get_client()
        from datetime import datetime

        update_data = {
            "is_alpha_tester": is_alpha,
            "alpha_tester_since": datetime.utcnow().isoformat() if is_alpha else None,
            "alpha_tester_notes": notes
        }

        client.table("profiles").update(update_data).eq("id", user_id).execute()
        return {"message": f"User {'added to' if is_alpha else 'removed from'} alpha testers"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alpha/feedback")
async def list_alpha_feedback(
    skip: int = 0,
    limit: int = 25,
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    priority: Optional[str] = None,
    user_id: Optional[str] = None
):
    """List all alpha tester feedback"""
    try:
        client = get_client()

        query = client.table("alpha_feedback").select(
            "*, user:user_id(id, full_name, username, avatar_url)",
            count="exact"
        )

        if status:
            query = query.eq("status", status)
        if feedback_type:
            query = query.eq("feedback_type", feedback_type)
        if priority:
            query = query.eq("priority", priority)
        if user_id:
            query = query.eq("user_id", user_id)

        query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
        response = query.execute()

        return {
            "feedback": response.data or [],
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alpha/feedback/{feedback_id}")
async def get_alpha_feedback(feedback_id: str):
    """Get a single feedback item"""
    try:
        client = get_client()
        response = client.table("alpha_feedback").select(
            "*, user:user_id(id, full_name, username, avatar_url, email)"
        ).eq("id", feedback_id).single().execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/alpha/feedback/{feedback_id}")
async def update_alpha_feedback(feedback_id: str, data: dict):
    """Update feedback status, priority, or admin notes"""
    try:
        client = get_client()
        from datetime import datetime

        allowed_fields = ["status", "priority", "admin_notes", "resolved_by"]
        update_data = {k: v for k, v in data.items() if k in allowed_fields}

        if data.get("status") == "resolved":
            update_data["resolved_at"] = datetime.utcnow().isoformat()

        update_data["updated_at"] = datetime.utcnow().isoformat()

        client.table("alpha_feedback").update(update_data).eq("id", feedback_id).execute()
        return {"message": "Feedback updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alpha/stats")
async def get_alpha_stats():
    """Get alpha testing statistics"""
    try:
        client = get_client()

        # Count testers
        testers = client.table("profiles").select("id", count="exact").eq("is_alpha_tester", True).execute()

        # Count feedback by status
        feedback_new = client.table("alpha_feedback").select("id", count="exact").eq("status", "new").execute()
        feedback_reviewing = client.table("alpha_feedback").select("id", count="exact").eq("status", "reviewing").execute()
        feedback_in_progress = client.table("alpha_feedback").select("id", count="exact").eq("status", "in_progress").execute()
        feedback_resolved = client.table("alpha_feedback").select("id", count="exact").eq("status", "resolved").execute()

        # Count by type
        bugs = client.table("alpha_feedback").select("id", count="exact").eq("feedback_type", "bug").execute()
        features = client.table("alpha_feedback").select("id", count="exact").eq("feedback_type", "feature").execute()
        ux = client.table("alpha_feedback").select("id", count="exact").eq("feedback_type", "ux").execute()

        # Recent sessions (last 7 days)
        from datetime import datetime, timedelta
        week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        recent_sessions = client.table("alpha_session_logs").select("id", count="exact").gte("session_start", week_ago).execute()

        return {
            "total_testers": testers.count or 0,
            "feedback_new": feedback_new.count or 0,
            "feedback_reviewing": feedback_reviewing.count or 0,
            "feedback_in_progress": feedback_in_progress.count or 0,
            "feedback_resolved": feedback_resolved.count or 0,
            "bugs_reported": bugs.count or 0,
            "features_requested": features.count or 0,
            "ux_issues": ux.count or 0,
            "sessions_this_week": recent_sessions.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/alpha/sessions")
async def list_alpha_sessions(
    skip: int = 0,
    limit: int = 25,
    user_id: Optional[str] = None
):
    """List alpha tester sessions"""
    try:
        client = get_client()

        query = client.table("alpha_session_logs").select(
            "*, user:user_id(id, full_name, username, avatar_url)",
            count="exact"
        )

        if user_id:
            query = query.eq("user_id", user_id)

        query = query.order("session_start", desc=True).range(skip, skip + limit - 1)
        response = query.execute()

        return {
            "sessions": response.data or [],
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
