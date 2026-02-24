"""
Profiles API Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Header, File, UploadFile
from typing import List, Optional
from pydantic import BaseModel
import io
import uuid
from app.core.database import get_client
from app.core.storage import storage_client, generate_unique_filename
from app.schemas.profiles import (
    Profile, ProfileUpdate,
    FilmmakerProfile, FilmmakerProfileCreate, FilmmakerProfileUpdate
)

router = APIRouter()


async def get_current_user_from_token(authorization: str):
    """Get current user from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace("Bearer ", "")

    # Decode JWT to get user info
    import jwt
    try:
        # Decode without verification first to get claims (for Cognito tokens)
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Look up profile by cognito_user_id
        client = get_client()
        profile_result = client.table("profiles").select("*").eq(
            "cognito_user_id", user_id
        ).execute()

        if profile_result.data:
            return {"id": profile_result.data[0]["id"], "cognito_id": user_id, "email": email}

        # Fallback to email lookup
        if email:
            profile_result = client.table("profiles").select("*").eq(
                "email", email
            ).execute()
            if profile_result.data:
                return {"id": profile_result.data[0]["id"], "cognito_id": user_id, "email": email}

        raise HTTPException(status_code=401, detail="User not found")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


class AvatarUploadResponse(BaseModel):
    success: bool
    avatar_url: str = ""
    message: str = ""


@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Upload a new avatar image.

    Uploads to S3, updates profiles table and filmmaker_profiles table if exists.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    unique_filename = f"{user_id}/{uuid.uuid4()}.{ext}"

    client = get_client()

    try:
        # Verify profile exists before uploading
        profile_result = client.table("profiles").select("id, avatar_url").eq("id", user_id).execute()
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        old_avatar_url = profile_result.data[0].get("avatar_url")

        # Delete old avatar if it exists and is in our S3 bucket
        if old_avatar_url and "s3." in old_avatar_url and "swn-avatars" in old_avatar_url:
            try:
                old_path = old_avatar_url.split("/")[-2] + "/" + old_avatar_url.split("/")[-1]
                storage_client.from_("avatars").remove([old_path])
            except Exception as e:
                print(f"Warning: Could not delete old avatar: {e}")

        # Read and upload new avatar to S3
        file_content = await file.read()
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        file_obj = io.BytesIO(file_content)

        storage_client.from_("avatars").upload(
            unique_filename,
            file_obj,
            {"content_type": file.content_type}
        )

        # Build public URL
        avatar_url = storage_client.from_("avatars").get_public_url(unique_filename)

        if not avatar_url:
            raise HTTPException(status_code=500, detail="Failed to generate image URL after upload")

        # Update profiles table and verify it took effect
        update_result = client.table("profiles").update({
            "avatar_url": avatar_url
        }).eq("id", user_id).execute()

        if not update_result.data:
            print(f"Warning: profiles update returned no data for user_id={user_id}")

        # Verify the DB actually has the new URL
        verify_result = client.table("profiles").select("avatar_url").eq("id", user_id).single().execute()
        saved_url = verify_result.data.get("avatar_url") if verify_result.data else None

        if saved_url != avatar_url:
            print(f"Error: avatar_url mismatch after update. Expected={avatar_url}, Got={saved_url}")
            raise HTTPException(
                status_code=500,
                detail="Profile picture was uploaded but failed to save to your profile"
            )

        # Update filmmaker_profiles table if exists (non-fatal)
        try:
            client.table("filmmaker_profiles").update({
                "profile_image_url": avatar_url
            }).eq("user_id", user_id).execute()
        except Exception as e:
            print(f"Warning: Could not update filmmaker_profiles avatar: {e}")

        return AvatarUploadResponse(
            success=True,
            avatar_url=avatar_url,
            message="Avatar uploaded successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading avatar: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload avatar: {str(e)}")


@router.delete("/avatar")
async def delete_avatar(authorization: str = Header(None)):
    """Delete the current user's avatar"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    client = get_client()

    try:
        # Get current avatar URL
        profile_result = client.table("profiles").select("avatar_url").eq("id", user_id).execute()
        old_avatar_url = profile_result.data[0].get("avatar_url") if profile_result.data else None

        # Delete from S3 if it exists
        if old_avatar_url and "s3." in old_avatar_url and "swn-avatars" in old_avatar_url:
            try:
                old_path = old_avatar_url.split("/")[-2] + "/" + old_avatar_url.split("/")[-1]
                storage_client.from_("avatars").remove([old_path])
            except Exception as e:
                print(f"Warning: Could not delete avatar from S3: {e}")

        # Clear avatar URL in profiles
        client.table("profiles").update({
            "avatar_url": None
        }).eq("id", user_id).execute()

        # Clear in filmmaker_profiles
        client.table("filmmaker_profiles").update({
            "profile_image_url": None
        }).eq("user_id", user_id).execute()

        return {"success": True, "message": "Avatar deleted"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete avatar: {str(e)}")


@router.get("/me")
async def get_my_profile(authorization: str = Header(None)):
    """Get current user's profile"""
    from uuid import UUID

    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]  # This is the profile ID

    try:
        client = get_client()
        # Look up by profile id (get_current_user_from_token returns profile.id)
        response = client.table("profiles").select("*").eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Convert UUID fields to strings for JSON serialization
        profile = response.data[0]
        result = {}
        for key, value in profile.items():
            if isinstance(value, UUID):
                result[key] = str(value)
            else:
                result[key] = value
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class LocationUpdate(BaseModel):
    location: str


@router.patch("/me/location")
async def update_my_location(
    data: LocationUpdate,
    authorization: str = Header(None),
):
    """Auto-detect location update. Only writes if user has no existing location."""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    location = (data.location or "").strip()
    if not location:
        return {"message": "No location provided", "updated": False}

    try:
        client = get_client()

        # Check if filmmaker profile exists
        existing = client.table("filmmaker_profiles").select("user_id, location").eq("user_id", user_id).execute()

        if existing.data:
            # Only write if no existing location
            current_location = (existing.data[0].get("location") or "").strip()
            if current_location:
                return {"message": "Location already set", "updated": False}
            client.table("filmmaker_profiles").update({"location": location}).eq("user_id", user_id).execute()
        else:
            # Create minimal filmmaker_profiles row
            client.table("filmmaker_profiles").insert({"user_id": user_id, "location": location}).execute()

        # Also ensure location_visible is true on profiles
        client.table("profiles").update({"location_visible": True}).eq("id", user_id).execute()

        return {"message": "Location updated", "updated": True, "location": location}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{user_id}", response_model=Profile)
async def get_profile(user_id: str):
    """Get user profile by ID"""
    try:
        client = get_client()
        response = client.table("profiles").select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{user_id}", response_model=Profile)
async def update_profile(user_id: str, profile: ProfileUpdate):
    """Update user profile"""
    try:
        client = get_client()

        # Check if profile exists first
        existing = client.table("profiles").select("id").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        response = client.table("profiles").update(
            profile.model_dump(exclude_unset=True)
        ).eq("id", user_id).execute()

        if not response.data:
            # Re-fetch if update didn't return data
            response = client.table("profiles").select("*").eq("id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found after update")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/username/{username}", response_model=Profile)
async def get_profile_by_username(username: str):
    """Get profile by username"""
    try:
        client = get_client()
        response = client.table("profiles").select("*").eq("username", username).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Filmmaker Profile Endpoints
@router.get("/filmmaker/{user_id}")
async def get_filmmaker_profile(user_id: str):
    """Get filmmaker profile"""
    try:
        client = get_client()
        response = client.table("filmmaker_profiles").select("*").eq("user_id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Filmmaker profile not found")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/filmmaker", response_model=FilmmakerProfile)
async def create_filmmaker_profile(profile: FilmmakerProfileCreate):
    """Create filmmaker profile"""
    try:
        client = get_client()
        response = client.table("filmmaker_profiles").insert(
            profile.model_dump()
        ).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/filmmaker/{user_id}", response_model=FilmmakerProfile)
async def update_filmmaker_profile(user_id: str, profile: FilmmakerProfileUpdate):
    """Update filmmaker profile"""
    try:
        client = get_client()

        # Check if filmmaker profile exists
        existing = client.table("filmmaker_profiles").select("id").eq("user_id", user_id).execute()

        if not existing.data:
            # Create a new filmmaker profile if it doesn't exist
            create_data = {"user_id": user_id, **profile.model_dump(exclude_unset=True)}
            response = client.table("filmmaker_profiles").insert(create_data).execute()
        else:
            # Update existing profile
            response = client.table("filmmaker_profiles").update(
                profile.model_dump(exclude_unset=True)
            ).eq("user_id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Failed to update filmmaker profile")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/filmmaker/username/{username}")
async def get_filmmaker_profile_by_username(username: str):
    """Get full filmmaker profile by username (for public profile page)"""
    try:
        client = get_client()

        # First get the base profile by username (including Order membership fields)
        profile_result = client.table("profiles").select(
            "id, username, email, avatar_url, full_name, display_name, location_visible, "
            "is_order_member, show_order_membership, status_message"
        ).eq("username", username).execute()

        if not profile_result.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        base_profile = profile_result.data[0]
        user_id = base_profile["id"]

        # Get filmmaker profile
        filmmaker_result = client.table("filmmaker_profiles").select("*").eq(
            "user_id", user_id
        ).execute()

        if not filmmaker_result.data:
            raise HTTPException(status_code=404, detail="Filmmaker profile not found")

        filmmaker = filmmaker_result.data[0]

        # Get credits (separate queries — nested joins not supported)
        # Only show approved credits on public profile
        credits_result = client.table("credits").select("*").eq(
            "user_id", user_id
        ).eq("status", "approved").order("created_at", desc=True).execute()

        # Fetch associated productions by ID and merge (include slug for Slate links)
        credits_data = credits_result.data or []
        production_ids = list({c["production_id"] for c in credits_data if c.get("production_id")})
        productions_map = {}
        if production_ids:
            for pid in production_ids:
                prod_result = client.table("productions").select("id, title, name, slug").eq("id", pid).execute()
                if prod_result.data:
                    p = prod_result.data[0]
                    p["title"] = p.get("title") or p.get("name") or "Untitled"
                    productions_map[pid] = p
        for credit in credits_data:
            pid = credit.get("production_id")
            credit["productions"] = productions_map.get(pid) if pid else None

        # Get Order membership info if member and showing publicly
        order_info = None
        if base_profile.get("is_order_member") and base_profile.get("show_order_membership", True):
            try:
                # Get order member profile and lodge info (separate queries)
                order_result = client.table("order_member_profiles").select("*").eq(
                    "user_id", user_id
                ).execute()

                if order_result.data:
                    order_member = order_result.data[0]
                    lodge = None
                    lodge_id = order_member.get("lodge_id")
                    if lodge_id:
                        lodge_result = client.table("order_lodges").select(
                            "id, name, city, state"
                        ).eq("id", lodge_id).execute()
                        if lodge_result.data:
                            lodge = lodge_result.data[0]

                    # Check if lodge officer
                    officer_title = None
                    if lodge:
                        officer_result = client.table("lodge_officers").select(
                            "title"
                        ).eq("user_id", user_id).eq("lodge_id", lodge.get("id")).execute()
                        if officer_result.data:
                            officer_title = officer_result.data[0].get("title")

                    order_info = {
                        "is_member": True,
                        "tier": order_member.get("tier"),
                        "lodge": {
                            "id": lodge.get("id"),
                            "name": lodge.get("name"),
                            "city": lodge.get("city"),
                            "state": lodge.get("state"),
                        } if lodge else None,
                        "officer_title": officer_title,
                    }
            except Exception as e:
                print(f"Error fetching Order info: {e}")

        # Combine data in the format expected by the frontend
        return {
            "user_id": user_id,
            "profile": base_profile,
            "profile_image_url": filmmaker.get("profile_image_url") or base_profile.get("avatar_url"),
            "full_name": filmmaker.get("full_name") or base_profile.get("full_name"),
            "display_name": filmmaker.get("display_name") or base_profile.get("display_name"),
            "email": base_profile.get("email"),
            "bio": filmmaker.get("bio"),
            "location": filmmaker.get("location"),
            "department": filmmaker.get("department"),
            "experience_level": filmmaker.get("experience_level"),
            "skills": filmmaker.get("skills") or [],
            "reel_links": filmmaker.get("reel_links") or [],
            "portfolio_website": filmmaker.get("portfolio_website"),
            "accepting_work": filmmaker.get("accepting_work", False),
            "available_for": filmmaker.get("available_for") or [],
            "preferred_locations": filmmaker.get("preferred_locations") or [],
            "contact_method": filmmaker.get("contact_method"),
            "show_email": filmmaker.get("show_email", False),
            "credits": credits_data,
            "status_message": base_profile.get("status_message"),
            "order_info": order_info,
        }
    except HTTPException:
        raise
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
        client = get_client()
        query = client.table("filmmaker_profiles").select("*")

        if department:
            query = query.eq("department", department)
        if accepting_work is not None:
            query = query.eq("accepting_work", accepting_work)

        response = query.range(skip, skip + limit - 1).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# PARTNER PROFILES
# =====================================================

@router.get("/partner/{user_id}")
async def get_partner_profile(user_id: str):
    """Get partner profile by user_id"""
    try:
        client = get_client()
        response = client.table("partner_profiles").select("*").eq("user_id", user_id).execute()
        if not response.data:
            return None
        return response.data[0]
    except Exception as e:
        # Table might not exist yet
        print(f"Partner profile lookup error: {e}")
        return None


# =====================================================
# CREDITS
# =====================================================

@router.get("/credits/{user_id}")
async def get_user_credits(
    user_id: str,
    authorization: str = Header(None),
):
    """Get all credits for a user with production titles and slugs.
    Own credits include all statuses; other users only see approved."""
    try:
        from app.core.database import execute_query

        # Determine if the viewer is the same user (show all statuses)
        is_own = False
        if authorization:
            try:
                viewer = await get_current_user_from_token(authorization)
                if viewer and viewer.get("id") == user_id:
                    is_own = True
            except Exception:
                pass

        status_filter = "" if is_own else "AND c.status = 'approved'"

        rows = execute_query(f"""
            SELECT c.id, c.user_id, c.production_id, c.position, c.description,
                   c.production_date, c.created_at, c.updated_at,
                   c.status, c.review_note,
                   p.name as prod_name, p.title as prod_title, p.slug as prod_slug
            FROM credits c
            LEFT JOIN productions p ON p.id = c.production_id
            WHERE c.user_id = :user_id {status_filter}
            ORDER BY c.created_at DESC
        """, {"user_id": user_id})

        credits = []
        for c in (rows or []):
            prod_date = c.get("production_date")
            year = None
            if prod_date:
                try:
                    year = int(str(prod_date)[:4])
                except (ValueError, TypeError):
                    pass

            credit_item = {
                "id": str(c["id"]),
                "user_id": str(c["user_id"]),
                "production_id": str(c["production_id"]) if c.get("production_id") else None,
                "title": c.get("prod_name") or c.get("prod_title") or "Unknown Production",
                "production_slug": c.get("prod_slug"),
                "role": c.get("position"),
                "year": year,
                "description": c.get("description"),
                "created_at": str(c["created_at"]) if c.get("created_at") else None,
                "updated_at": str(c["updated_at"]) if c.get("updated_at") else None,
                "status": c.get("status") or "approved",
            }
            if is_own and c.get("review_note"):
                credit_item["review_note"] = c.get("review_note")

            credits.append(credit_item)

        return credits
    except Exception as e:
        print(f"Credits lookup error: {e}")
        return []


# =====================================================
# COMBINED PROFILE (for account settings)
# =====================================================

@router.get("/combined/{user_id}")
async def get_combined_profile(user_id: str):
    """
    Get combined profile data including base profile, filmmaker profile,
    partner profile, and credits for a user.
    """
    try:
        client = get_client()

        # Fetch base profile
        profile_result = client.table("profiles").select("*").eq("id", user_id).execute()
        profile_data = profile_result.data[0] if profile_result.data else None

        # If not found by id, try by cognito_user_id
        if not profile_data:
            profile_result = client.table("profiles").select("*").eq("cognito_user_id", user_id).execute()
            profile_data = profile_result.data[0] if profile_result.data else None

        if not profile_data:
            raise HTTPException(status_code=404, detail="Profile not found")

        actual_user_id = profile_data.get("id")

        # Fetch filmmaker profile
        filmmaker_data = None
        try:
            filmmaker_result = client.table("filmmaker_profiles").select("*").eq("user_id", actual_user_id).execute()
            filmmaker_data = filmmaker_result.data[0] if filmmaker_result.data else None
        except Exception as e:
            print(f"Filmmaker profile lookup error: {e}")

        # Fetch partner profile
        partner_data = None
        try:
            partner_result = client.table("partner_profiles").select("*").eq("user_id", actual_user_id).execute()
            partner_data = partner_result.data[0] if partner_result.data else None
        except Exception as e:
            print(f"Partner profile lookup error: {e}")

        # Fetch credits
        credits_data = []
        try:
            credits_result = client.table("credits").select(
                "*, productions(id, title)"
            ).eq("user_id", actual_user_id).order("created_at", desc=True).execute()

            for c in (credits_result.data or []):
                credits_data.append({
                    "id": c.get("id"),
                    "user_id": c.get("user_id"),
                    "title": c.get("productions", {}).get("title") if c.get("productions") else "Unknown Production",
                    "role": c.get("position"),
                    "year": None,
                    "description": c.get("description"),
                    "created_at": c.get("created_at"),
                    "updated_at": c.get("updated_at"),
                })
        except Exception as e:
            print(f"Credits lookup error: {e}")

        # Combine everything
        return {
            "profile": profile_data,
            "filmmaker_profile": filmmaker_data,
            "partner_profile": partner_data,
            "credits": credits_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Combined profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# USER SEARCH
# =====================================================

@router.get("/search/users")
async def search_users(query: str = "", limit: int = 10):
    """Search users by username, full_name, or display_name.
    If query is empty, returns recent users up to limit.
    """
    try:
        client = get_client()

        base_query = client.table("profiles").select(
            "id, username, full_name, display_name, avatar_url"
        )

        if query and len(query) >= 1:
            # Search by name/username
            response = base_query.or_(
                f"username.ilike.%{query}%,full_name.ilike.%{query}%,display_name.ilike.%{query}%"
            ).limit(limit).execute()
        else:
            # No query - return users ordered by most recently updated
            response = base_query.order(
                "updated_at", desc=True
            ).limit(limit).execute()

        return response.data or []

    except Exception as e:
        print(f"User search error: {e}")
        return []


# =====================================================
# STATUS UPDATES
# =====================================================

class StatusUpdateCreate(BaseModel):
    content: str
    type: Optional[str] = "manual"


@router.get("/status-updates/{user_id}")
async def list_status_updates(user_id: str, limit: int = 50):
    """List status updates for a user"""
    try:
        client = get_client()
        response = client.table("status_updates").select(
            "*, profiles(username, avatar_url, full_name, display_name)"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()

        return response.data or []
    except Exception as e:
        print(f"Status updates error: {e}")
        return []


@router.post("/status-updates")
async def create_status_update(
    update: StatusUpdateCreate,
    authorization: str = Header(None)
):
    """Create a status update for the current user"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    try:
        client = get_client()
        response = client.table("status_updates").insert({
            "user_id": user_id,
            "content": update.content,
            "type": update.type,
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create status update")

        # Fetch with profile data
        update_id = response.data[0]["id"]
        full_update = client.table("status_updates").select(
            "*, profiles(username, avatar_url, full_name, display_name)"
        ).eq("id", update_id).single().execute()

        return full_update.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# PROFILE UPDATES (Posts synced to profile)
# =====================================================

@router.get("/profile-updates/{user_id}")
async def get_profile_updates(user_id: str, limit: int = 20, offset: int = 0):
    """
    Get posts marked as profile updates for a user.
    These are community posts that also appear on the user's public profile Updates tab.
    """
    try:
        client = get_client()

        # Fetch posts where is_profile_update = true for this user
        response = client.table("community_posts").select(
            "*, profiles:user_id(id, username, avatar_url, full_name, display_name)"
        ).eq("user_id", user_id).eq("is_profile_update", True).eq(
            "is_hidden", False
        ).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        posts = response.data or []

        # Get reactions and comments counts for each post
        for post in posts:
            # Get reactions count
            reactions_response = client.table("community_post_reactions").select(
                "reaction_type", count="exact"
            ).eq("post_id", post["id"]).execute()
            post["reactions_count"] = reactions_response.count or 0

            # Get comments count
            comments_response = client.table("community_post_comments").select(
                "id", count="exact"
            ).eq("post_id", post["id"]).eq("is_hidden", False).execute()
            post["comments_count"] = comments_response.count or 0

        return posts
    except Exception as e:
        print(f"Profile updates error: {e}")
        return []


# =====================================================
# ACTIVE BACKLOT PROJECTS
# =====================================================

@router.get("/active-projects/{user_id}")
async def get_active_projects(user_id: str):
    """
    Get public active Backlot projects for a user.
    Returns projects where user is owner or team member with active status.
    """
    try:
        client = get_client()

        # Get projects where user is owner and project is public & active
        owner_projects = client.table("backlot_projects").select(
            "id, title, status, is_public"
        ).eq("owner_id", user_id).eq("is_public", True).in_(
            "status", ["pre-production", "production", "post-production"]
        ).execute()

        owner_project_ids = [p["id"] for p in (owner_projects.data or [])]
        projects = []

        for p in (owner_projects.data or []):
            projects.append({
                "id": p["id"],
                "title": p["title"],
                "status": p["status"],
                "role": "Owner / Producer",
            })

        # Get projects where user is a team member (cast or crew)
        # Check project members
        crew_projects = client.table("backlot_project_members").select(
            "project_id, production_role, backlot_projects(id, title, status, is_public)"
        ).eq("user_id", user_id).execute()

        for cm in (crew_projects.data or []):
            project = cm.get("backlot_projects")
            if project and project.get("is_public") and project.get("id") not in owner_project_ids:
                if project.get("status") in ["pre-production", "production", "post-production"]:
                    projects.append({
                        "id": project["id"],
                        "title": project["title"],
                        "status": project["status"],
                        "role": cm.get("production_role") or "Team Member",
                    })

        return projects
    except Exception as e:
        print(f"Active projects error: {e}")
        return []


# =====================================================
# QUICK AVAILABILITY UPDATE
# =====================================================

class AvailabilityUpdate(BaseModel):
    accepting_work: bool
    status_message: Optional[str] = None


@router.patch("/availability")
async def update_availability(
    data: AvailabilityUpdate,
    authorization: str = Header(None)
):
    """
    Quick update for availability status and status message.
    Updates the filmmaker_profiles table.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    try:
        client = get_client()

        # Check if filmmaker profile exists
        existing = client.table("filmmaker_profiles").select("id").eq("user_id", user_id).execute()

        update_data = {
            "accepting_work": data.accepting_work,
        }

        # Also update status_message in profiles table if provided
        if data.status_message is not None:
            # Update profiles table status
            client.table("profiles").update({
                "status_message": data.status_message,
                "status_updated_at": "now()",
            }).eq("id", user_id).execute()

        if not existing.data:
            # Create a filmmaker profile if it doesn't exist
            update_data["user_id"] = user_id
            response = client.table("filmmaker_profiles").insert(update_data).execute()
        else:
            # Update existing profile
            response = client.table("filmmaker_profiles").update(update_data).eq("user_id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to update availability")

        return {
            "message": "Availability updated successfully",
            "accepting_work": data.accepting_work,
            "status_message": data.status_message,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# FILMMAKER ONBOARDING
# =====================================================

class FilmmakerOnboardingData(BaseModel):
    full_name: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    reel_links: Optional[List[str]] = None
    portfolio_website: Optional[str] = None
    location: Optional[str] = None
    location_visible: Optional[bool] = True
    department: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[List[str]] = None
    credits: Optional[List[dict]] = None
    accepting_work: Optional[bool] = False
    available_for: Optional[List[str]] = None
    preferred_locations: Optional[List[str]] = None
    contact_method: Optional[str] = None
    show_email: Optional[bool] = False


@router.post("/filmmaker/onboard")
async def onboard_filmmaker(
    data: FilmmakerOnboardingData,
    authorization: str = Header(None)
):
    """Complete filmmaker onboarding - creates profile and filmmaker_profile"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    try:
        client = get_client()

        # Update main profile
        client.table("profiles").update({
            "full_name": data.full_name,
            "display_name": data.display_name,
            "location_visible": True,
            "has_completed_filmmaker_onboarding": True,
        }).eq("id", user_id).execute()

        # Upsert filmmaker profile
        filmmaker_data = {
            "user_id": user_id,
            "full_name": data.full_name,
            "bio": data.bio,
            "reel_links": data.reel_links or [],
            "portfolio_website": data.portfolio_website,
            "location": data.location,
            "department": data.department,
            "experience_level": data.experience_level,
            "skills": data.skills or [],
            "accepting_work": data.accepting_work,
            "available_for": data.available_for or [],
            "preferred_locations": data.preferred_locations or [],
            "contact_method": data.contact_method,
            "show_email": data.show_email,
        }

        client.table("filmmaker_profiles").upsert(
            filmmaker_data, on_conflict="user_id"
        ).execute()

        # Create credits if provided
        if data.credits:
            for credit in data.credits:
                # Find or create production
                prod_title = credit.get("productionTitle", "")
                if not prod_title:
                    continue

                prod_result = client.table("productions").select("id").eq(
                    "title", prod_title
                ).execute()

                if prod_result.data:
                    prod_id = prod_result.data[0]["id"]
                else:
                    slug = prod_title.lower().replace(" ", "-")
                    new_prod = client.table("productions").insert({
                        "title": prod_title,
                        "slug": slug,
                        "created_by": user_id,
                    }).execute()
                    prod_id = new_prod.data[0]["id"]

                # Create credit
                client.table("credits").insert({
                    "user_id": user_id,
                    "production_id": prod_id,
                    "position": credit.get("position"),
                    "description": credit.get("description"),
                    "production_date": credit.get("productionDate") or None,
                }).execute()

        return {"message": "Filmmaker profile created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# FILMMAKER APPLICATIONS
# =====================================================

class FilmmakerApplicationData(BaseModel):
    full_name: str
    display_name: str
    email: str
    location: str
    portfolio_link: str
    professional_profile_link: Optional[str] = None
    years_of_experience: str
    primary_roles: List[str]
    top_projects: List[dict]
    join_reason: str


@router.post("/filmmaker/application")
async def submit_filmmaker_application(
    data: FilmmakerApplicationData,
    authorization: str = Header(None)
):
    """Submit a filmmaker application"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    try:
        client = get_client()
        response = client.table("filmmaker_applications").insert({
            "user_id": user_id,
            "full_name": data.full_name,
            "display_name": data.display_name,
            "email": data.email,
            "location": data.location,
            "portfolio_link": data.portfolio_link,
            "professional_profile_link": data.professional_profile_link,
            "years_of_experience": data.years_of_experience,
            "primary_roles": data.primary_roles,
            "top_projects": data.top_projects,
            "join_reason": data.join_reason,
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to submit application")

        return {"message": "Application submitted successfully", "id": response.data[0]["id"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
