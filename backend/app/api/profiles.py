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
        # Get current avatar URL to delete old file
        profile_result = client.table("profiles").select("avatar_url").eq("id", user_id).execute()
        old_avatar_url = profile_result.data[0].get("avatar_url") if profile_result.data else None

        # Delete old avatar if it exists and is in our S3 bucket
        if old_avatar_url and "s3." in old_avatar_url and "swn-avatars" in old_avatar_url:
            try:
                # Extract path from URL
                old_path = old_avatar_url.split("/")[-2] + "/" + old_avatar_url.split("/")[-1]
                storage_client.from_("avatars").remove([old_path])
            except Exception as e:
                print(f"Warning: Could not delete old avatar: {e}")

        # Upload new avatar to S3
        file_content = await file.read()
        file_obj = io.BytesIO(file_content)

        storage_client.from_("avatars").upload(
            unique_filename,
            file_obj,
            {"content_type": file.content_type}
        )

        # Get public URL
        avatar_url = storage_client.from_("avatars").get_public_url(unique_filename)

        # Update profiles table
        client.table("profiles").update({
            "avatar_url": avatar_url
        }).eq("id", user_id).execute()

        # Update filmmaker_profiles table if exists
        client.table("filmmaker_profiles").update({
            "profile_image_url": avatar_url
        }).eq("user_id", user_id).execute()

        return AvatarUploadResponse(
            success=True,
            avatar_url=avatar_url,
            message="Avatar uploaded successfully"
        )

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

        # First get the base profile by username
        profile_result = client.table("profiles").select(
            "id, username, email, avatar_url, full_name, display_name, location_visible"
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

        # Get credits with production details
        credits_result = client.table("credits").select(
            "*, productions(id, title)"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

        # Combine data in the format expected by the frontend
        return {
            "user_id": user_id,
            "profile": base_profile,
            "profile_image_url": filmmaker.get("profile_image_url") or base_profile.get("avatar_url"),
            "full_name": filmmaker.get("full_name") or base_profile.get("full_name"),
            "display_name": filmmaker.get("display_name") or base_profile.get("display_name"),
            "email": base_profile.get("email"),
            "bio": filmmaker.get("bio"),
            "location": filmmaker.get("location") if base_profile.get("location_visible", True) else None,
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
            "credits": credits_result.data or [],
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
async def get_user_credits(user_id: str):
    """Get all credits for a user with production titles"""
    try:
        client = get_client()
        response = client.table("credits").select(
            "*, productions(id, title)"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

        # Map to expected format
        credits = []
        for c in (response.data or []):
            credits.append({
                "id": c.get("id"),
                "user_id": c.get("user_id"),
                "title": c.get("productions", {}).get("title") if c.get("productions") else "Unknown Production",
                "role": c.get("position"),
                "year": None,  # Could extract from production_date if needed
                "description": c.get("description"),
                "created_at": c.get("created_at"),
                "updated_at": c.get("updated_at"),
            })

        return credits
    except Exception as e:
        # Table might not exist yet
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
            "location_visible": data.location_visible,
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
