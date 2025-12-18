"""
Second Watch Order API Routes
The Order is a professional, God-centered guild for filmmakers and crew.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.database import get_client
from app.core.auth import get_current_user, get_current_user_optional
from app.core.deps import (
    get_user_profile,
    get_user_profile_optional,
    require_admin,
    require_staff,
    require_order_member,
    require_lodge_officer,
    require_partner,
)
from app.core.roles import (
    is_staff,
    is_admin_or_higher,
    can_access_order,
    can_manage_lodge,
    can_access_partner_tools,
)
from app.models.order import (
    OrderMemberProfile, OrderApplication, Lodge, LodgeMembership,
    OrderJob, OrderJobApplication, OrderBookingRequest,
    OrderMemberStatus, OrderApplicationStatus, LodgeStatus,
    LodgeMembershipStatus, OrderJobVisibility, OrderJobApplicationStatus,
    PrimaryTrack, OrderJobType
)
from app.schemas.order import (
    # Application schemas
    OrderApplicationCreate, OrderApplicationResponse, OrderApplicationAdminUpdate,
    OrderApplicationListResponse,
    # Profile schemas
    OrderMemberProfileCreate, OrderMemberProfileUpdate, OrderMemberProfileResponse,
    OrderMemberAdminUpdate, OrderMemberListResponse, OrderMemberDirectoryEntry,
    # Lodge schemas
    LodgeCreate, LodgeUpdate, LodgeResponse, LodgeListResponse,
    LodgeMembershipResponse, LodgeJoinRequest,
    # Job schemas
    OrderJobCreate, OrderJobUpdate, OrderJobResponse, OrderJobListResponse,
    OrderJobApplicationCreate, OrderJobApplicationResponse,
    OrderJobApplicationAdminUpdate, OrderJobApplicationListResponse,
    # Booking schemas
    OrderBookingRequestCreate, OrderBookingRequestResponse, OrderBookingRequestUpdate,
    # Stats schemas
    OrderDashboardStats, OrderAdminStats, LodgeStats
)

router = APIRouter()


# ============ Helper Functions ============

def get_user_id(user) -> str:
    """Extract user ID from Supabase user object"""
    if hasattr(user, 'id'):
        return str(user.id)
    return str(user.get("id", ""))


def get_user_email(user) -> str:
    """Extract email from Supabase user object"""
    if hasattr(user, 'email'):
        return str(user.email)
    return str(user.get("email", ""))


def get_user_name(user) -> Optional[str]:
    """Extract display name from Supabase user object"""
    if hasattr(user, 'user_metadata'):
        metadata = user.user_metadata
    else:
        metadata = user.get("user_metadata", {})

    return metadata.get("full_name") or metadata.get("name") or metadata.get("display_name")


# ============ Legacy Helper Functions (for backwards compatibility) ============
# These are deprecated - use the new role system from app.core.roles instead

def check_user_role(user, allowed_roles: List[str]) -> bool:
    """DEPRECATED: Check if user has required role. Use app.core.roles instead."""
    if hasattr(user, 'user_metadata'):
        metadata = user.user_metadata
    else:
        metadata = user.get("user_metadata", {})

    user_role = metadata.get("role", "free")
    return user_role in allowed_roles


def is_admin(user) -> bool:
    """DEPRECATED: Check if user is admin. Use is_admin_or_higher() or is_staff() instead."""
    if hasattr(user, 'user_metadata'):
        metadata = user.user_metadata
    else:
        metadata = user.get("user_metadata", {})

    return metadata.get("role") == "admin" or metadata.get("is_moderator", False)


def is_partner(user) -> bool:
    """DEPRECATED: Check if user is a partner. Use can_access_partner_tools() instead."""
    return check_user_role(user, ["partner", "admin"])


async def get_order_member_profile(user_id: str) -> Optional[dict]:
    """Get Order member profile from database"""
    client = get_client()
    result = client.table("order_member_profiles").select("*").eq("user_id", user_id).execute()
    # Return first result or None (don't use .single() which throws on 0 rows)
    return result.data[0] if result.data and len(result.data) > 0 else None


async def is_order_member(user_id: str) -> bool:
    """Check if user is an active Order member"""
    profile = await get_order_member_profile(user_id)
    if not profile:
        return False
    return profile.get("status") in [OrderMemberStatus.PROBATIONARY.value, OrderMemberStatus.ACTIVE.value]


async def require_order_member(user = Depends(get_current_user)):
    """Dependency that requires user to be an Order member"""
    user_id = get_user_id(user)
    if not await is_order_member(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order membership required"
        )
    return user


async def require_admin(user = Depends(get_current_user)):
    """Dependency that requires admin role"""
    if not is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


# ============ Order Application Endpoints ============

@router.post("/applications", response_model=OrderApplicationResponse)
async def submit_application(
    application: OrderApplicationCreate,
    user = Depends(get_current_user)
):
    """Submit application to join The Order"""
    user_id = get_user_id(user)
    client = get_client()

    # Check if user already has a pending or approved application
    existing = client.table("order_applications").select("*").eq("user_id", user_id).in_("status", ["pending", "approved"]).execute()

    if existing.data:
        existing_status = existing.data[0].get("status")
        if existing_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have a pending application"
            )
        elif existing_status == "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your application has already been approved"
            )

    # Check if user is already an Order member
    if await is_order_member(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already an Order member"
        )

    # Create application
    app_data = {
        "user_id": user_id,
        "primary_track": application.primary_track.value,
        "city": application.city,
        "region": application.region,
        "portfolio_links": application.portfolio_links,
        "statement": application.statement,
        "years_experience": application.years_experience,
        "current_role": application.current_role,
        "status": OrderApplicationStatus.PENDING.value,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("order_applications").insert(app_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create application")

    response_data = result.data[0]
    response_data["applicant_name"] = get_user_name(user)
    response_data["applicant_email"] = get_user_email(user)

    return OrderApplicationResponse(**response_data)


@router.get("/applications/me", response_model=Optional[OrderApplicationResponse])
async def get_my_application(user = Depends(get_current_user)):
    """Get current user's application"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_applications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()

    if not result.data:
        return None

    response_data = result.data[0]
    response_data["applicant_name"] = get_user_name(user)
    response_data["applicant_email"] = get_user_email(user)

    return OrderApplicationResponse(**response_data)


@router.get("/applications", response_model=OrderApplicationListResponse)
async def list_applications(
    status: Optional[OrderApplicationStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(require_admin)
):
    """List all applications (admin only)"""
    client = get_client()

    query = client.table("order_applications").select("*", count="exact")

    if status:
        query = query.eq("status", status.value)

    query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
    result = query.execute()

    # Get user details for each application
    applications = []
    for app in result.data or []:
        # TODO: Fetch user name/email from profiles table
        app["applicant_name"] = None
        app["applicant_email"] = None
        applications.append(OrderApplicationResponse(**app))

    return OrderApplicationListResponse(
        applications=applications,
        total=result.count or 0,
        skip=skip,
        limit=limit
    )


@router.post("/applications/{application_id}/approve", response_model=OrderApplicationResponse)
async def approve_application(
    application_id: int,
    user = Depends(require_admin)
):
    """Approve an application (admin only)"""
    client = get_client()
    admin_id = get_user_id(user)

    # Get the application
    app_result = client.table("order_applications").select("*").eq("id", application_id).single().execute()

    if not app_result.data:
        raise HTTPException(status_code=404, detail="Application not found")

    application = app_result.data

    if application["status"] != OrderApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application is already {application['status']}"
        )

    # Update application status
    now = datetime.utcnow().isoformat()
    update_result = client.table("order_applications").update({
        "status": OrderApplicationStatus.APPROVED.value,
        "reviewed_by_id": admin_id,
        "reviewed_at": now,
        "updated_at": now,
    }).eq("id", application_id).execute()

    # Create Order member profile
    applicant_user_id = application["user_id"]

    # Check if profile already exists (shouldn't, but be safe)
    existing_profile = client.table("order_member_profiles").select("id").eq("user_id", applicant_user_id).execute()

    if not existing_profile.data:
        profile_data = {
            "user_id": applicant_user_id,
            "primary_track": application["primary_track"],
            "city": application.get("city"),
            "region": application.get("region"),
            "years_experience": application.get("years_experience"),
            "status": OrderMemberStatus.PROBATIONARY.value,
            "joined_at": now,
            "dues_status": "pending",
            "created_at": now,
            "updated_at": now,
        }
        client.table("order_member_profiles").insert(profile_data).execute()

    # TODO: Send notification email to applicant
    # TODO: Initiate Stripe subscription for dues

    return OrderApplicationResponse(**update_result.data[0])


@router.post("/applications/{application_id}/reject", response_model=OrderApplicationResponse)
async def reject_application(
    application_id: int,
    update: OrderApplicationAdminUpdate,
    user = Depends(require_admin)
):
    """Reject an application (admin only)"""
    client = get_client()
    admin_id = get_user_id(user)

    # Get the application
    app_result = client.table("order_applications").select("*").eq("id", application_id).single().execute()

    if not app_result.data:
        raise HTTPException(status_code=404, detail="Application not found")

    if app_result.data["status"] != OrderApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application is already {app_result.data['status']}"
        )

    # Update application status
    now = datetime.utcnow().isoformat()
    update_result = client.table("order_applications").update({
        "status": OrderApplicationStatus.REJECTED.value,
        "reviewed_by_id": admin_id,
        "reviewed_at": now,
        "rejection_reason": update.rejection_reason,
        "updated_at": now,
    }).eq("id", application_id).execute()

    # TODO: Send notification email to applicant

    return OrderApplicationResponse(**update_result.data[0])


# ============ Order Member Profile Endpoints ============

@router.get("/profile/me", response_model=Optional[OrderMemberProfileResponse])
async def get_my_profile(user = Depends(get_current_user)):
    """Get current user's Order profile"""
    user_id = get_user_id(user)
    profile = await get_order_member_profile(user_id)

    if not profile:
        return None

    # Add user info
    profile["user_name"] = get_user_name(user)
    profile["user_email"] = get_user_email(user)

    # Get lodge info if member of one
    if profile.get("lodge_id"):
        client = get_client()
        lodge_result = client.table("order_lodges").select("name, city").eq("id", profile["lodge_id"]).single().execute()
        if lodge_result.data:
            profile["lodge_name"] = lodge_result.data["name"]
            profile["lodge_city"] = lodge_result.data["city"]

    return OrderMemberProfileResponse(**profile)


@router.post("/profile", response_model=OrderMemberProfileResponse)
async def create_or_update_profile(
    profile_data: OrderMemberProfileCreate,
    user = Depends(get_current_user)
):
    """Create or update Order member profile"""
    user_id = get_user_id(user)
    client = get_client()

    # Check if user has an approved application or existing profile
    existing_profile = await get_order_member_profile(user_id)

    if not existing_profile:
        # Check for approved application
        app_result = client.table("order_applications").select("id").eq("user_id", user_id).eq("status", "approved").execute()

        if not app_result.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must have an approved application to create a profile"
            )

    now = datetime.utcnow().isoformat()

    data = {
        "primary_track": profile_data.primary_track.value,
        "secondary_tracks": profile_data.secondary_tracks,
        "city": profile_data.city,
        "region": profile_data.region,
        "portfolio_url": str(profile_data.portfolio_url) if profile_data.portfolio_url else None,
        "imdb_url": str(profile_data.imdb_url) if profile_data.imdb_url else None,
        "youtube_url": str(profile_data.youtube_url) if profile_data.youtube_url else None,
        "vimeo_url": str(profile_data.vimeo_url) if profile_data.vimeo_url else None,
        "website_url": str(profile_data.website_url) if profile_data.website_url else None,
        "gear_summary": profile_data.gear_summary,
        "bio": profile_data.bio,
        "years_experience": profile_data.years_experience,
        "availability_status": profile_data.availability_status,
        "updated_at": now,
    }

    if existing_profile:
        # Update existing
        result = client.table("order_member_profiles").update(data).eq("user_id", user_id).execute()
    else:
        # Create new
        data["user_id"] = user_id
        data["status"] = OrderMemberStatus.PROBATIONARY.value
        data["joined_at"] = now
        data["dues_status"] = "pending"
        data["created_at"] = now
        result = client.table("order_member_profiles").insert(data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save profile")

    response_data = result.data[0]
    response_data["user_name"] = get_user_name(user)
    response_data["user_email"] = get_user_email(user)

    return OrderMemberProfileResponse(**response_data)


@router.patch("/profile", response_model=OrderMemberProfileResponse)
async def update_profile(
    profile_update: OrderMemberProfileUpdate,
    user = Depends(require_order_member)
):
    """Update Order member profile fields"""
    user_id = get_user_id(user)
    client = get_client()

    # Build update dict with only provided fields
    update_data = {}
    for field, value in profile_update.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "primary_track":
                update_data[field] = value.value
            elif field in ["portfolio_url", "imdb_url", "youtube_url", "vimeo_url", "website_url"]:
                update_data[field] = str(value) if value else None
            else:
                update_data[field] = value

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_member_profiles").update(update_data).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update profile")

    response_data = result.data[0]
    response_data["user_name"] = get_user_name(user)
    response_data["user_email"] = get_user_email(user)

    return OrderMemberProfileResponse(**response_data)


@router.get("/members", response_model=OrderMemberListResponse)
async def list_members(
    track: Optional[PrimaryTrack] = None,
    city: Optional[str] = None,
    lodge_id: Optional[int] = None,
    status: Optional[OrderMemberStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(require_admin)
):
    """List all Order members (admin only)"""
    client = get_client()

    query = client.table("order_member_profiles").select("*", count="exact")

    if track:
        query = query.eq("primary_track", track.value)
    if city:
        query = query.ilike("city", f"%{city}%")
    if lodge_id:
        query = query.eq("lodge_id", lodge_id)
    if status:
        query = query.eq("status", status.value)

    query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
    result = query.execute()

    members = [OrderMemberProfileResponse(**m) for m in (result.data or [])]

    return OrderMemberListResponse(
        members=members,
        total=result.count or 0,
        skip=skip,
        limit=limit
    )


@router.patch("/members/{user_id}", response_model=OrderMemberProfileResponse)
async def admin_update_member(
    user_id: str,
    update: OrderMemberAdminUpdate,
    admin = Depends(require_admin)
):
    """Update member status (admin only) - suspend, expel, etc."""
    client = get_client()

    # Verify member exists
    existing = client.table("order_member_profiles").select("*").eq("user_id", user_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.utcnow().isoformat()
    update_data = {
        "status": update.status.value,
        "updated_at": now,
    }

    result = client.table("order_member_profiles").update(update_data).eq("user_id", user_id).execute()

    # TODO: Send notification email about status change
    # TODO: Handle Stripe subscription cancellation if expelled

    return OrderMemberProfileResponse(**result.data[0])


@router.get("/directory", response_model=List[OrderMemberDirectoryEntry])
async def get_member_directory(
    track: Optional[PrimaryTrack] = None,
    city: Optional[str] = None,
    lodge_id: Optional[int] = None,
    availability: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(require_order_member)
):
    """Get searchable directory of Order members (Order members only)"""
    client = get_client()

    # Only show active/probationary members in directory
    query = client.table("order_member_profiles").select("*").in_("status", ["active", "probationary"])

    if track:
        query = query.eq("primary_track", track.value)
    if city:
        query = query.ilike("city", f"%{city}%")
    if lodge_id:
        query = query.eq("lodge_id", lodge_id)
    if availability:
        query = query.eq("availability_status", availability)

    query = query.order("primary_track").range(skip, skip + limit - 1)
    result = query.execute()

    # TODO: Join with user profiles to get names
    # TODO: Join with lodges to get lodge names
    # TODO: Implement search across name/bio/city

    entries = []
    for member in result.data or []:
        entry = OrderMemberDirectoryEntry(
            user_id=member["user_id"],
            user_name=None,  # TODO: fetch from profiles
            primary_track=member["primary_track"],
            city=member.get("city"),
            region=member.get("region"),
            lodge_name=None,  # TODO: fetch from lodges
            availability_status=member.get("availability_status"),
            years_experience=member.get("years_experience"),
            bio=member.get("bio", "")[:200] if member.get("bio") else None,
        )
        entries.append(entry)

    return entries


@router.get("/members/{user_id}", response_model=OrderMemberProfileResponse)
async def get_member_profile(
    user_id: str,
    current_user = Depends(require_order_member)
):
    """Get a specific Order member's profile (Order members only)"""
    client = get_client()

    result = client.table("order_member_profiles").select("*").eq("user_id", user_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Member not found")

    profile = result.data

    # Only show active/probationary members
    if profile["status"] not in ["active", "probationary"]:
        raise HTTPException(status_code=404, detail="Member not found")

    # Get lodge info
    if profile.get("lodge_id"):
        lodge_result = client.table("order_lodges").select("name, city").eq("id", profile["lodge_id"]).single().execute()
        if lodge_result.data:
            profile["lodge_name"] = lodge_result.data["name"]
            profile["lodge_city"] = lodge_result.data["city"]

    # TODO: Fetch user name/email from profiles table

    return OrderMemberProfileResponse(**profile)


# ============ Lodge Endpoints ============

@router.get("/lodges", response_model=LodgeListResponse)
async def list_lodges(
    status: Optional[LodgeStatus] = None,
    city: Optional[str] = None,
    user = Depends(get_current_user_optional)
):
    """List all lodges (public for forming/active)"""
    client = get_client()

    query = client.table("order_lodges").select("*", count="exact")

    # Non-admins only see forming/active lodges
    if not (user and is_admin(user)):
        query = query.in_("status", ["forming", "active"])
    elif status:
        query = query.eq("status", status.value)

    if city:
        query = query.ilike("city", f"%{city}%")

    query = query.order("name")
    result = query.execute()

    lodges = []
    for lodge in result.data or []:
        # Get member count
        member_count_result = client.table("order_lodge_memberships").select("id", count="exact").eq("lodge_id", lodge["id"]).eq("status", "active").execute()
        lodge["member_count"] = member_count_result.count or 0

        lodges.append(LodgeResponse(**lodge))

    return LodgeListResponse(lodges=lodges, total=result.count or 0)


@router.get("/lodges/my", response_model=List[LodgeMembershipResponse])
async def get_my_lodge_memberships(user = Depends(require_order_member)):
    """Get current user's lodge memberships"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_lodge_memberships").select("*, order_lodges(name, city)").eq("user_id", user_id).execute()

    memberships = []
    for m in result.data or []:
        lodge_info = m.pop("order_lodges", {}) or {}
        m["lodge_name"] = lodge_info.get("name")
        m["lodge_city"] = lodge_info.get("city")
        # Handle potential null is_officer
        if m.get("is_officer") is None:
            m["is_officer"] = False
        memberships.append(LodgeMembershipResponse(**m))

    return memberships


@router.get("/lodges/{lodge_id}", response_model=LodgeResponse)
async def get_lodge(
    lodge_id: int,
    user = Depends(get_current_user_optional)
):
    """Get lodge details"""
    client = get_client()

    result = client.table("order_lodges").select("*").eq("id", lodge_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Lodge not found")

    lodge = result.data

    # Non-admins can't see inactive lodges
    if not (user and is_admin(user)) and lodge["status"] == "inactive":
        raise HTTPException(status_code=404, detail="Lodge not found")

    # Get member count
    member_count_result = client.table("order_lodge_memberships").select("id", count="exact").eq("lodge_id", lodge_id).eq("status", "active").execute()
    lodge["member_count"] = member_count_result.count or 0

    return LodgeResponse(**lodge)


@router.post("/lodges/{lodge_id}/join", response_model=LodgeMembershipResponse)
async def join_lodge(
    lodge_id: int,
    user = Depends(require_order_member)
):
    """Join a lodge (Order members only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify lodge exists and is joinable
    lodge_result = client.table("order_lodges").select("*").eq("id", lodge_id).single().execute()

    if not lodge_result.data:
        raise HTTPException(status_code=404, detail="Lodge not found")

    lodge = lodge_result.data
    if lodge["status"] == "inactive":
        raise HTTPException(status_code=400, detail="This lodge is not accepting members")

    # Check if already a member
    existing = client.table("order_lodge_memberships").select("*").eq("user_id", user_id).eq("lodge_id", lodge_id).execute()

    if existing.data:
        membership = existing.data[0]
        if membership["status"] == "active":
            raise HTTPException(status_code=400, detail="You are already a member of this lodge")
        elif membership["status"] == "pending":
            raise HTTPException(status_code=400, detail="Your membership is pending approval")

    # Create membership
    now = datetime.utcnow().isoformat()
    membership_data = {
        "user_id": user_id,
        "lodge_id": lodge_id,
        "status": LodgeMembershipStatus.ACTIVE.value,  # Or PENDING if approval required
        "joined_at": now,
        "dues_status": "pending",
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_lodge_memberships").insert(membership_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to join lodge")

    # Update member profile with lodge_id
    client.table("order_member_profiles").update({
        "lodge_id": lodge_id,
        "updated_at": now,
    }).eq("user_id", user_id).execute()

    response_data = result.data[0]
    response_data["lodge_name"] = lodge["name"]
    response_data["lodge_city"] = lodge["city"]

    # TODO: Initiate Stripe subscription for lodge dues

    return LodgeMembershipResponse(**response_data)


@router.post("/lodges", response_model=LodgeResponse)
async def create_lodge(
    lodge: LodgeCreate,
    user = Depends(require_admin)
):
    """Create a new lodge (admin only)"""
    client = get_client()

    # Check slug is unique
    existing = client.table("order_lodges").select("id").eq("slug", lodge.slug).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Lodge slug already exists")

    now = datetime.utcnow().isoformat()
    lodge_data = {
        "name": lodge.name,
        "slug": lodge.slug,
        "city": lodge.city,
        "region": lodge.region,
        "description": lodge.description,
        "base_lodge_dues_cents": lodge.base_lodge_dues_cents,
        "contact_email": lodge.contact_email,
        "contact_user_id": lodge.contact_user_id,
        "status": LodgeStatus.FORMING.value,
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_lodges").insert(lodge_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create lodge")

    response_data = result.data[0]
    response_data["member_count"] = 0

    return LodgeResponse(**response_data)


@router.patch("/lodges/{lodge_id}", response_model=LodgeResponse)
async def update_lodge(
    lodge_id: int,
    lodge_update: LodgeUpdate,
    user = Depends(require_admin)
):
    """Update a lodge (admin only)"""
    client = get_client()

    # Verify lodge exists
    existing = client.table("order_lodges").select("*").eq("id", lodge_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Lodge not found")

    update_data = {}
    for field, value in lodge_update.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "status":
                update_data[field] = value.value
            else:
                update_data[field] = value

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_lodges").update(update_data).eq("id", lodge_id).execute()

    response_data = result.data[0]

    # Get member count
    member_count_result = client.table("order_lodge_memberships").select("id", count="exact").eq("lodge_id", lodge_id).eq("status", "active").execute()
    response_data["member_count"] = member_count_result.count or 0

    return LodgeResponse(**response_data)


# ============ Job Endpoints ============

@router.get("/jobs", response_model=OrderJobListResponse)
async def list_jobs(
    job_type: Optional[OrderJobType] = None,
    visibility: Optional[OrderJobVisibility] = None,
    lodge_id: Optional[int] = None,
    active_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(get_current_user_optional)
):
    """List jobs (visibility-aware)"""
    client = get_client()
    user_id = get_user_id(user) if user else None
    is_member = await is_order_member(user_id) if user_id else False

    query = client.table("order_jobs").select("*", count="exact")

    if active_only:
        query = query.eq("is_active", True)

    if job_type:
        query = query.eq("job_type", job_type.value)

    if lodge_id:
        query = query.eq("lodge_id", lodge_id)

    # Visibility filtering
    if not is_member:
        # Non-members can only see public jobs
        query = query.eq("visibility", OrderJobVisibility.PUBLIC.value)
    elif visibility:
        query = query.eq("visibility", visibility.value)
    # Order members see all jobs (order_only, order_priority, public)

    query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
    result = query.execute()

    jobs = []
    for job in result.data or []:
        # Check if current user has applied
        if user_id:
            app_check = client.table("order_job_applications").select("id").eq("job_id", job["id"]).eq("user_id", user_id).execute()
            job["user_has_applied"] = bool(app_check.data)
        else:
            job["user_has_applied"] = False

        # Get application count
        app_count = client.table("order_job_applications").select("id", count="exact").eq("job_id", job["id"]).execute()
        job["application_count"] = app_count.count or 0

        jobs.append(OrderJobResponse(**job))

    return OrderJobListResponse(
        jobs=jobs,
        total=result.count or 0,
        skip=skip,
        limit=limit
    )


@router.get("/jobs/{job_id}", response_model=OrderJobResponse)
async def get_job(
    job_id: int,
    user = Depends(get_current_user_optional)
):
    """Get job details"""
    client = get_client()
    user_id = get_user_id(user) if user else None
    is_member = await is_order_member(user_id) if user_id else False

    result = client.table("order_jobs").select("*").eq("id", job_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data

    # Check visibility
    if job["visibility"] == OrderJobVisibility.ORDER_ONLY.value and not is_member:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if current user has applied
    if user_id:
        app_check = client.table("order_job_applications").select("id").eq("job_id", job_id).eq("user_id", user_id).execute()
        job["user_has_applied"] = bool(app_check.data)
    else:
        job["user_has_applied"] = False

    # Get application count
    app_count = client.table("order_job_applications").select("id", count="exact").eq("job_id", job_id).execute()
    job["application_count"] = app_count.count or 0

    return OrderJobResponse(**job)


@router.post("/jobs", response_model=OrderJobResponse)
async def create_job(
    job: OrderJobCreate,
    user = Depends(get_current_user)
):
    """Create a job posting (admin/partner only)"""
    if not (is_admin(user) or is_partner(user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and partners can post jobs"
        )

    user_id = get_user_id(user)
    client = get_client()

    now = datetime.utcnow().isoformat()
    job_data = {
        "title": job.title,
        "description": job.description,
        "location": job.location,
        "job_type": job.job_type.value,
        "roles_needed": job.roles_needed,
        "pay_info": job.pay_info,
        "is_paid": job.is_paid,
        "visibility": job.visibility.value,
        "created_by_id": user_id,
        "lodge_id": job.lodge_id,
        "organization_name": job.organization_name,
        "is_active": True,
        "starts_at": job.starts_at.isoformat() if job.starts_at else None,
        "ends_at": job.ends_at.isoformat() if job.ends_at else None,
        "application_deadline": job.application_deadline.isoformat() if job.application_deadline else None,
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_jobs").insert(job_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")

    response_data = result.data[0]
    response_data["application_count"] = 0
    response_data["user_has_applied"] = False

    return OrderJobResponse(**response_data)


@router.patch("/jobs/{job_id}", response_model=OrderJobResponse)
async def update_job(
    job_id: int,
    job_update: OrderJobUpdate,
    user = Depends(get_current_user)
):
    """Update a job posting"""
    client = get_client()
    user_id = get_user_id(user)

    # Get existing job
    existing = client.table("order_jobs").select("*").eq("id", job_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Only creator or admin can update
    if existing.data["created_by_id"] != user_id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Not authorized to update this job")

    update_data = {}
    for field, value in job_update.model_dump(exclude_unset=True).items():
        if value is not None:
            if field in ["job_type", "visibility"]:
                update_data[field] = value.value
            elif field in ["starts_at", "ends_at", "application_deadline"]:
                update_data[field] = value.isoformat() if value else None
            else:
                update_data[field] = value

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_jobs").update(update_data).eq("id", job_id).execute()

    response_data = result.data[0]

    # Get application count
    app_count = client.table("order_job_applications").select("id", count="exact").eq("job_id", job_id).execute()
    response_data["application_count"] = app_count.count or 0

    return OrderJobResponse(**response_data)


@router.post("/jobs/{job_id}/apply", response_model=OrderJobApplicationResponse)
async def apply_to_job(
    job_id: int,
    application: OrderJobApplicationCreate,
    user = Depends(require_order_member)
):
    """Apply to a job (Order members only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify job exists and is active
    job_result = client.table("order_jobs").select("*").eq("id", job_id).single().execute()
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = job_result.data
    if not job["is_active"]:
        raise HTTPException(status_code=400, detail="This job is no longer accepting applications")

    # Check deadline
    if job.get("application_deadline"):
        deadline = datetime.fromisoformat(job["application_deadline"].replace("Z", "+00:00"))
        if datetime.utcnow() > deadline:
            raise HTTPException(status_code=400, detail="Application deadline has passed")

    # Check if already applied
    existing = client.table("order_job_applications").select("id").eq("job_id", job_id).eq("user_id", user_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    now = datetime.utcnow().isoformat()
    app_data = {
        "job_id": job_id,
        "user_id": user_id,
        "cover_note": application.cover_note,
        "portfolio_url": str(application.portfolio_url) if application.portfolio_url else None,
        "status": OrderJobApplicationStatus.SUBMITTED.value,
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_job_applications").insert(app_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to submit application")

    response_data = result.data[0]
    response_data["job_title"] = job["title"]
    response_data["applicant_name"] = get_user_name(user)

    # TODO: Send notification to job poster

    return OrderJobApplicationResponse(**response_data)


@router.get("/jobs/applications/my", response_model=OrderJobApplicationListResponse)
async def get_my_job_applications(
    user = Depends(require_order_member)
):
    """Get current user's job applications"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_job_applications").select("*, order_jobs(title)").eq("user_id", user_id).order("created_at", desc=True).execute()

    applications = []
    for app in result.data or []:
        job_info = app.pop("order_jobs", {}) or {}
        app["job_title"] = job_info.get("title")
        applications.append(OrderJobApplicationResponse(**app))

    return OrderJobApplicationListResponse(
        applications=applications,
        total=len(applications)
    )


# ============ Booking Request Endpoints ============

@router.post("/booking-requests", response_model=OrderBookingRequestResponse)
async def create_booking_request(
    request: OrderBookingRequestCreate,
    user = Depends(get_current_user_optional)
):
    """Create a booking request for an Order member (public endpoint)"""
    client = get_client()

    # Verify target user is an Order member
    target_profile = await get_order_member_profile(request.target_user_id)
    if not target_profile:
        raise HTTPException(status_code=404, detail="Member not found")

    if target_profile["status"] not in ["active", "probationary"]:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.utcnow().isoformat()
    booking_data = {
        "target_user_id": request.target_user_id,
        "requester_user_id": get_user_id(user) if user else None,
        "requester_name": request.requester_name,
        "requester_email": request.requester_email,
        "requester_phone": request.requester_phone,
        "requester_org": request.requester_org,
        "project_title": request.project_title,
        "details": request.details,
        "location": request.location,
        "dates": request.dates,
        "budget_range": request.budget_range,
        "roles_needed": request.roles_needed,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_booking_requests").insert(booking_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create booking request")

    # TODO: Send email notification to target user
    # TODO: Send confirmation email to requester

    return OrderBookingRequestResponse(**result.data[0])


@router.get("/booking-requests/my", response_model=List[OrderBookingRequestResponse])
async def get_my_booking_requests(
    user = Depends(require_order_member)
):
    """Get booking requests for current user (as target)"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_booking_requests").select("*").eq("target_user_id", user_id).order("created_at", desc=True).execute()

    return [OrderBookingRequestResponse(**r) for r in (result.data or [])]


@router.patch("/booking-requests/{request_id}", response_model=OrderBookingRequestResponse)
async def update_booking_request(
    request_id: int,
    update: OrderBookingRequestUpdate,
    user = Depends(require_order_member)
):
    """Update booking request status (by target member)"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify request exists and belongs to user
    existing = client.table("order_booking_requests").select("*").eq("id", request_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Booking request not found")

    if existing.data["target_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this request")

    update_data = {
        "status": update.status,
        "response_notes": update.response_notes,
        "updated_at": datetime.utcnow().isoformat(),
    }

    result = client.table("order_booking_requests").update(update_data).eq("id", request_id).execute()

    # TODO: Send email notification to requester about status change

    return OrderBookingRequestResponse(**result.data[0])


# ============ Dashboard & Stats Endpoints ============

@router.get("/dashboard", response_model=OrderDashboardStats)
async def get_order_dashboard(user = Depends(get_current_user)):
    """Get Order dashboard stats for current user"""
    user_id = get_user_id(user)
    client = get_client()

    profile = await get_order_member_profile(user_id)

    if not profile:
        return OrderDashboardStats(
            is_order_member=False,
            pending_booking_requests=0,
            active_job_applications=0,
        )

    # Get pending booking requests count
    booking_count = client.table("order_booking_requests").select("id", count="exact").eq("target_user_id", user_id).eq("status", "pending").execute()

    # Get active job applications count
    job_app_count = client.table("order_job_applications").select("id", count="exact").eq("user_id", user_id).in_("status", ["submitted", "reviewed"]).execute()

    # Get lodge name if member
    lodge_name = None
    if profile.get("lodge_id"):
        lodge_result = client.table("order_lodges").select("name").eq("id", profile["lodge_id"]).single().execute()
        if lodge_result.data:
            lodge_name = lodge_result.data["name"]

    return OrderDashboardStats(
        is_order_member=True,
        membership_status=profile["status"],
        dues_status=profile.get("dues_status"),
        primary_track=profile["primary_track"],
        lodge_id=profile.get("lodge_id"),
        lodge_name=lodge_name,
        joined_at=profile.get("joined_at"),
        pending_booking_requests=booking_count.count or 0,
        active_job_applications=job_app_count.count or 0,
    )


from fastapi import Header
from pydantic import BaseModel


# ============ Profile Settings Endpoints ============

class OrderProfileSettingsResponse(BaseModel):
    user_id: str
    public_visibility: str = "members-only"  # public, members-only, private
    show_booking_form: bool = True
    show_portfolio: bool = True


class OrderProfileSettingsUpdate(BaseModel):
    public_visibility: Optional[str] = None
    show_booking_form: Optional[bool] = None
    show_portfolio: Optional[bool] = None


@router.get("/profile-settings/me")
async def get_my_order_profile_settings(authorization: str = Header(None)):
    """Get Order profile settings for current user"""
    from app.api.profiles import get_current_user_from_token

    try:
        current_user = await get_current_user_from_token(authorization)
        user_id = current_user["id"]
    except Exception:
        return None

    client = get_client()

    # Try to fetch existing settings
    result = client.table("order_profile_settings").select("*").eq(
        "user_id", user_id
    ).execute()

    if result.data:
        return result.data[0]

    # Create default settings
    default_settings = {
        "user_id": user_id,
        "public_visibility": "members-only",
        "show_booking_form": True,
        "show_portfolio": True,
    }

    insert_result = client.table("order_profile_settings").insert(
        default_settings
    ).execute()

    return insert_result.data[0] if insert_result.data else default_settings


@router.put("/profile-settings/me")
async def update_my_order_profile_settings(
    updates: OrderProfileSettingsUpdate,
    authorization: str = Header(None)
):
    """Update Order profile settings for current user"""
    from app.api.profiles import get_current_user_from_token

    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    client = get_client()

    # Build update dict
    update_data = updates.model_dump(exclude_unset=True)
    update_data["user_id"] = user_id

    result = client.table("order_profile_settings").upsert(
        update_data, on_conflict="user_id"
    ).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to update settings")

    return result.data[0]


@router.get("/profile-settings/{user_id}")
async def get_order_profile_settings_for_user(user_id: str):
    """Get Order profile settings for a specific user (for viewing other profiles)"""
    client = get_client()

    result = client.table("order_profile_settings").select("*").eq(
        "user_id", user_id
    ).execute()

    if not result.data:
        return None

    return result.data[0]


@router.get("/admin/stats", response_model=OrderAdminStats)
async def get_admin_stats(user = Depends(require_admin)):
    """Get Order admin statistics"""
    client = get_client()

    # Member counts by status
    total_members = client.table("order_member_profiles").select("id", count="exact").execute()
    active_members = client.table("order_member_profiles").select("id", count="exact").eq("status", "active").execute()
    probationary_members = client.table("order_member_profiles").select("id", count="exact").eq("status", "probationary").execute()
    suspended_members = client.table("order_member_profiles").select("id", count="exact").eq("status", "suspended").execute()

    # Pending applications
    pending_apps = client.table("order_applications").select("id", count="exact").eq("status", "pending").execute()

    # Lodge counts
    total_lodges = client.table("order_lodges").select("id", count="exact").execute()
    active_lodges = client.table("order_lodges").select("id", count="exact").eq("status", "active").execute()

    # Active jobs
    active_jobs = client.table("order_jobs").select("id", count="exact").eq("is_active", True).execute()

    # Members by track
    track_results = client.table("order_member_profiles").select("primary_track").execute()
    members_by_track = {}
    for member in track_results.data or []:
        track = member["primary_track"]
        members_by_track[track] = members_by_track.get(track, 0) + 1

    # Members by city
    city_results = client.table("order_member_profiles").select("city").not_.is_("city", "null").execute()
    members_by_city = {}
    for member in city_results.data or []:
        city = member["city"]
        if city:
            members_by_city[city] = members_by_city.get(city, 0) + 1

    return OrderAdminStats(
        total_members=total_members.count or 0,
        active_members=active_members.count or 0,
        probationary_members=probationary_members.count or 0,
        suspended_members=suspended_members.count or 0,
        pending_applications=pending_apps.count or 0,
        total_lodges=total_lodges.count or 0,
        active_lodges=active_lodges.count or 0,
        active_jobs=active_jobs.count or 0,
        members_by_track=members_by_track,
        members_by_city=members_by_city,
    )
