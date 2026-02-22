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
    require_staff,
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
    CraftHouse, CraftHouseMembership, Fellowship, FellowshipMembership,
    GovernancePosition, DuesPayment,
    OrderMemberStatus, OrderApplicationStatus, LodgeStatus,
    LodgeMembershipStatus, OrderJobVisibility, OrderJobApplicationStatus,
    PrimaryTrack, OrderJobType, MembershipTier, CraftHouseStatus,
    CraftHouseRole, FellowshipType, FellowshipRole,
    GovernancePositionType, GovernanceScopeType, DuesPaymentStatus
)
from app.schemas.order import (
    # Application schemas
    OrderApplicationCreate, OrderApplicationResponse, OrderApplicationAdminUpdate,
    OrderApplicationListResponse,
    # Profile schemas
    OrderMemberProfileCreate, OrderMemberProfileUpdate, OrderMemberProfileResponse,
    OrderMemberAdminUpdate, OrderMemberListResponse, OrderMemberDirectoryEntry,
    OrderMemberTierUpdate, OrderMemberLodgeAssignment,
    # Lodge schemas
    LodgeCreate, LodgeUpdate, LodgeResponse, LodgeListResponse,
    LodgeMembershipResponse, LodgeJoinRequest, LodgeOfficerAppoint, LodgeMembershipUpdate,
    # Job schemas
    OrderJobCreate, OrderJobUpdate, OrderJobResponse, OrderJobListResponse,
    OrderJobApplicationCreate, OrderJobApplicationResponse,
    OrderJobApplicationAdminUpdate, OrderJobApplicationListResponse,
    # Booking schemas
    OrderBookingRequestCreate, OrderBookingRequestResponse, OrderBookingRequestUpdate,
    # Stats schemas
    OrderDashboardStats, OrderAdminStats, LodgeStats,
    # Craft House schemas
    CraftHouseCreate, CraftHouseUpdate, CraftHouseResponse, CraftHouseListResponse,
    CraftHouseMembershipResponse, CraftHouseMemberResponse, CraftHouseMemberListResponse,
    CraftHouseLeadershipAppoint, CraftHouseMembershipUpdate,
    # Craft House Discussion schemas
    CraftHouseTopicCreate, CraftHouseTopicUpdate, CraftHouseTopicResponse, CraftHouseTopicListResponse,
    CraftHouseThreadCreate, CraftHouseThreadUpdate, CraftHouseThreadResponse, CraftHouseThreadListResponse,
    CraftHouseThreadDetailResponse, CraftHouseReplyCreate, CraftHouseReplyUpdate, CraftHouseReplyResponse,
    CraftHouseReplyListResponse, CraftHouseMemberRoleUpdate,
    # Fellowship schemas
    FellowshipCreate, FellowshipUpdate, FellowshipResponse, FellowshipListResponse,
    FellowshipMembershipResponse, FellowshipLeadershipAppoint, FellowshipMembershipUpdate,
    # Governance schemas
    GovernancePositionCreate, GovernancePositionUpdate, GovernancePositionResponse,
    GovernancePositionListResponse, HighCouncilResponse,
    # Membership tier schemas
    MembershipTierInfo, MembershipStatusResponse, MembershipUpgradeRequest,
    MembershipUpgradeResponse, DuesPaymentResponse, DuesPaymentListResponse,
    OrderDashboardStatsExtended,
    # Event schemas
    OrderEventCreate, OrderEventUpdate, OrderEventResponse, OrderEventListResponse,
    OrderEventRSVPCreate, OrderEventRSVPResponse,
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


async def require_order_member_local(user = Depends(get_current_user)):
    """Dependency that requires user to be an Order member"""
    user_id = get_user_id(user)
    if not await is_order_member(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order membership required"
        )
    return user


async def require_admin_local(user = Depends(get_current_user)):
    """Dependency that requires admin role - checks profile is_admin flag"""
    user_id = get_user_id(user)
    client = get_client()

    # Check profile for admin status
    profile = client.table("profiles").select("is_admin, is_superadmin").eq("id", user_id).single().execute()

    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    if not (profile.data.get("is_admin") or profile.data.get("is_superadmin")):
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
    user = Depends(require_admin_local)
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
    user = Depends(require_admin_local)
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
    # Note: Dues checkout is initiated by the member via POST /membership/checkout after approval

    return OrderApplicationResponse(**update_result.data[0])


@router.post("/applications/{application_id}/reject", response_model=OrderApplicationResponse)
async def reject_application(
    application_id: int,
    update: OrderApplicationAdminUpdate,
    user = Depends(require_admin_local)
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
    user = Depends(require_order_member_local)
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
    user = Depends(require_admin_local)
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
    admin = Depends(require_admin_local)
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
    user = Depends(require_order_member_local)
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
    current_user = Depends(require_order_member_local)
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
async def get_my_lodge_memberships(user = Depends(require_order_member_local)):
    """Get current user's lodge memberships"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_lodge_memberships").select("*").eq("user_id", user_id).execute()

    memberships = []
    for m in result.data or []:
        # Get lodge info separately
        if m.get("lodge_id"):
            lodge_result = client.table("order_lodges").select("name, city").eq("id", m["lodge_id"]).single().execute()
            if lodge_result.data:
                m["lodge_name"] = lodge_result.data.get("name")
                m["lodge_city"] = lodge_result.data.get("city")
            else:
                m["lodge_name"] = None
                m["lodge_city"] = None
        else:
            m["lodge_name"] = None
            m["lodge_city"] = None
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
    user = Depends(require_order_member_local)
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

    # Note: Lodge dues are included in main Order membership dues (POST /membership/checkout)

    return LodgeMembershipResponse(**response_data)


@router.post("/lodges", response_model=LodgeResponse)
async def create_lodge(
    lodge: LodgeCreate,
    user = Depends(require_admin_local)
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
    user = Depends(require_admin_local)
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
    user = Depends(require_order_member_local)
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
    user = Depends(require_order_member_local)
):
    """Get current user's job applications"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_job_applications").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()

    applications = []
    for app in result.data or []:
        # Get job title separately
        if app.get("job_id"):
            job_result = client.table("order_jobs").select("title").eq("id", app["job_id"]).single().execute()
            app["job_title"] = job_result.data.get("title") if job_result.data else None
        else:
            app["job_title"] = None
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
    user = Depends(require_order_member_local)
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
    user = Depends(require_order_member_local)
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
async def get_admin_stats(user = Depends(require_admin_local)):
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
    city_results = client.table("order_member_profiles").select("city").execute()
    members_by_city = {}
    for member in city_results.data or []:
        city = member.get("city")
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


# ============ Craft House Endpoints ============

@router.get("/craft-houses", response_model=CraftHouseListResponse)
async def list_craft_houses(
    status: Optional[CraftHouseStatus] = None,
    user = Depends(get_current_user_optional)
):
    """List all craft houses"""
    client = get_client()

    query = client.table("order_craft_houses").select("*", count="exact")

    if status:
        query = query.eq("status", status.value)
    else:
        # Default: only show active craft houses for non-admins
        if not (user and is_admin(user)):
            query = query.eq("status", "active")

    query = query.order("name")
    result = query.execute()

    craft_houses = []
    for house in result.data or []:
        # Get member count
        member_count_result = client.table("order_craft_house_memberships").select(
            "id", count="exact"
        ).eq("craft_house_id", house["id"]).execute()
        house["member_count"] = member_count_result.count or 0

        # Parse primary_tracks if stored as string
        if house.get("primary_tracks"):
            if isinstance(house["primary_tracks"], str):
                import json
                try:
                    house["primary_tracks"] = json.loads(house["primary_tracks"])
                except:
                    house["primary_tracks"] = []

        craft_houses.append(CraftHouseResponse(**house))

    return CraftHouseListResponse(craft_houses=craft_houses, total=result.count or 0)


@router.get("/craft-houses/{craft_house_id}", response_model=CraftHouseResponse)
async def get_craft_house(
    craft_house_id: int,
    user = Depends(get_current_user_optional)
):
    """Get craft house details"""
    client = get_client()

    result = client.table("order_craft_houses").select("*").eq("id", craft_house_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Craft House not found")

    house = result.data

    # Get member count
    member_count_result = client.table("order_craft_house_memberships").select(
        "id", count="exact"
    ).eq("craft_house_id", craft_house_id).execute()
    house["member_count"] = member_count_result.count or 0

    # Get craft steward name
    steward_result = client.table("order_craft_house_memberships").select(
        "user_id"
    ).eq("craft_house_id", craft_house_id).eq("role", "steward").execute()

    if steward_result.data:
        steward_user_id = steward_result.data[0]["user_id"]
        profile_result = client.table("profiles").select("display_name").eq("id", steward_user_id).execute()
        if profile_result.data:
            house["steward_name"] = profile_result.data[0].get("display_name")

    return CraftHouseResponse(**house)


@router.get("/craft-houses/slug/{slug}", response_model=CraftHouseResponse)
async def get_craft_house_by_slug(
    slug: str,
    user = Depends(get_current_user_optional)
):
    """Get craft house details by slug"""
    client = get_client()

    result = client.table("order_craft_houses").select("*").eq("slug", slug).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Craft House not found")

    house = result.data
    craft_house_id = house["id"]

    # Get member count
    member_count_result = client.table("order_craft_house_memberships").select(
        "id", count="exact"
    ).eq("craft_house_id", craft_house_id).execute()
    house["member_count"] = member_count_result.count or 0

    # Get craft steward name
    steward_result = client.table("order_craft_house_memberships").select(
        "user_id"
    ).eq("craft_house_id", craft_house_id).eq("role", "steward").execute()

    if steward_result.data:
        steward_user_id = steward_result.data[0]["user_id"]
        profile_result = client.table("profiles").select("display_name").eq("id", steward_user_id).execute()
        if profile_result.data:
            house["steward_name"] = profile_result.data[0].get("display_name")

    return CraftHouseResponse(**house)


@router.get("/craft-houses/{craft_house_id}/members", response_model=CraftHouseMemberListResponse)
async def get_craft_house_members(
    craft_house_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(require_order_member_local)
):
    """Get members of a craft house (Order members only)"""
    client = get_client()

    # Verify craft house exists
    house_result = client.table("order_craft_houses").select("id").eq("id", craft_house_id).execute()
    if not house_result.data:
        raise HTTPException(status_code=404, detail="Craft House not found")

    # Get memberships with user info
    result = client.table("order_craft_house_memberships").select(
        "*, order_member_profiles!inner(user_id, primary_track, city)"
    ).eq("craft_house_id", craft_house_id).order("role", desc=True).range(skip, skip + limit - 1).execute()

    members = []
    for m in result.data or []:
        profile = m.pop("order_member_profiles", {}) or {}
        # Get user name from profiles
        user_profile = client.table("profiles").select("display_name").eq("id", m["user_id"]).execute()
        user_name = user_profile.data[0].get("display_name") if user_profile.data else None

        members.append(CraftHouseMemberResponse(
            user_id=m["user_id"],
            user_name=user_name,
            role=m["role"],
            primary_track=profile.get("primary_track"),
            city=profile.get("city"),
            joined_at=m["joined_at"],
        ))

    # Get total count
    count_result = client.table("order_craft_house_memberships").select(
        "id", count="exact"
    ).eq("craft_house_id", craft_house_id).execute()

    return CraftHouseMemberListResponse(members=members, total=count_result.count or 0)


@router.post("/craft-houses/{craft_house_id}/join", response_model=CraftHouseMembershipResponse)
async def join_craft_house(
    craft_house_id: int,
    user = Depends(require_order_member_local)
):
    """Join a craft house (Order members only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify craft house exists and is active
    house_result = client.table("order_craft_houses").select("*").eq("id", craft_house_id).single().execute()
    if not house_result.data:
        raise HTTPException(status_code=404, detail="Craft House not found")

    if house_result.data["status"] != "active":
        raise HTTPException(status_code=400, detail="This Craft House is not accepting members")

    # Check if already a member
    existing = client.table("order_craft_house_memberships").select("id").eq(
        "user_id", user_id
    ).eq("craft_house_id", craft_house_id).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="You are already a member of this Craft House")

    # Create membership
    now = datetime.utcnow().isoformat()
    membership_data = {
        "user_id": user_id,
        "craft_house_id": craft_house_id,
        "role": "member",
        "joined_at": now,
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_craft_house_memberships").insert(membership_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to join Craft House")

    response = result.data[0]
    response["craft_house_name"] = house_result.data["name"]

    return CraftHouseMembershipResponse(**response)


@router.delete("/craft-houses/{craft_house_id}/leave")
async def leave_craft_house(
    craft_house_id: int,
    user = Depends(require_order_member_local)
):
    """Leave a craft house"""
    user_id = get_user_id(user)
    client = get_client()

    # Check if member
    existing = client.table("order_craft_house_memberships").select("id, role").eq(
        "user_id", user_id
    ).eq("craft_house_id", craft_house_id).execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="You are not a member of this Craft House")

    # Stewards cannot leave directly (must transfer role first)
    if existing.data[0]["role"] == "steward":
        raise HTTPException(
            status_code=400,
            detail="Craft Stewards must transfer their role before leaving"
        )

    # Delete membership
    client.table("order_craft_house_memberships").delete().eq(
        "user_id", user_id
    ).eq("craft_house_id", craft_house_id).execute()

    return {"message": "Successfully left Craft House"}


@router.get("/craft-houses/my/memberships", response_model=List[CraftHouseMembershipResponse])
async def get_my_craft_house_memberships(user = Depends(require_order_member_local)):
    """Get current user's craft house memberships"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_craft_house_memberships").select("*").eq("user_id", user_id).execute()

    memberships = []
    for m in result.data or []:
        # Get craft house name separately
        if m.get("craft_house_id"):
            house_result = client.table("order_craft_houses").select("name").eq("id", m["craft_house_id"]).single().execute()
            m["craft_house_name"] = house_result.data.get("name") if house_result.data else None
        else:
            m["craft_house_name"] = None
        memberships.append(CraftHouseMembershipResponse(**m))

    return memberships


# ============ Craft House Discussion Endpoints ============

async def get_user_craft_house_membership(user_id: str, craft_house_id: int, client):
    """Get user's membership in a craft house"""
    result = client.table("order_craft_house_memberships").select("*").eq(
        "user_id", user_id
    ).eq("craft_house_id", craft_house_id).execute()
    return result.data[0] if result.data else None


async def is_craft_house_steward(user_id: str, craft_house_id: int, client) -> bool:
    """Check if user is a steward of the craft house"""
    membership = await get_user_craft_house_membership(user_id, craft_house_id, client)
    return membership and membership.get("role") == "steward"


async def can_view_topic(user_id: Optional[str], topic_data: dict, client) -> bool:
    """Check if user can view a topic (handles members-only)"""
    if not topic_data.get("is_members_only"):
        return True  # Public to Order
    if not user_id:
        return False
    # Check membership
    membership = await get_user_craft_house_membership(user_id, topic_data["craft_house_id"], client)
    return membership is not None


@router.get("/craft-houses/{craft_house_id}/topics", response_model=CraftHouseTopicListResponse)
async def list_craft_house_topics(
    craft_house_id: int,
    user = Depends(get_current_user_optional)
):
    """List discussion topics for a craft house"""
    client = get_client()
    user_id = get_user_id(user) if user else None

    # Get craft house
    house = client.table("order_craft_houses").select("id, name").eq("id", craft_house_id).single().execute()
    if not house.data:
        raise HTTPException(status_code=404, detail="Craft house not found")

    # Get user's membership to filter members-only topics
    is_member = False
    if user_id:
        membership = await get_user_craft_house_membership(user_id, craft_house_id, client)
        is_member = membership is not None

    # Get topics
    query = client.table("craft_house_topics").select("*").eq(
        "craft_house_id", craft_house_id
    ).eq("is_active", True).order("sort_order").order("name")

    result = query.execute()

    # Filter members-only topics for non-members
    topics = []
    for topic in result.data or []:
        if topic.get("is_members_only") and not is_member:
            continue
        # Get creator name
        if topic.get("created_by"):
            creator = client.table("profiles").select("display_name").eq("id", topic["created_by"]).single().execute()
            topic["created_by_name"] = creator.data.get("display_name") if creator.data else None
        topics.append(CraftHouseTopicResponse(**topic))

    return CraftHouseTopicListResponse(
        topics=topics,
        craft_house_id=craft_house_id,
        craft_house_name=house.data["name"]
    )


@router.post("/craft-houses/{craft_house_id}/topics", response_model=CraftHouseTopicResponse)
async def create_craft_house_topic(
    craft_house_id: int,
    topic: CraftHouseTopicCreate,
    user = Depends(require_order_member_local)
):
    """Create a new discussion topic (steward only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Check if steward
    if not await is_craft_house_steward(user_id, craft_house_id, client):
        raise HTTPException(status_code=403, detail="Only stewards can create topics")

    # Check for duplicate slug
    existing = client.table("craft_house_topics").select("id").eq(
        "craft_house_id", craft_house_id
    ).eq("slug", topic.slug).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A topic with this slug already exists")

    # Create topic
    data = {
        "craft_house_id": craft_house_id,
        "created_by": user_id,
        **topic.model_dump()
    }
    result = client.table("craft_house_topics").insert(data).execute()

    return CraftHouseTopicResponse(**result.data[0])


@router.patch("/craft-houses/topics/{topic_id}", response_model=CraftHouseTopicResponse)
async def update_craft_house_topic(
    topic_id: str,
    update: CraftHouseTopicUpdate,
    user = Depends(require_order_member_local)
):
    """Update a discussion topic (steward only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get topic
    topic = client.table("craft_house_topics").select("*").eq("id", topic_id).single().execute()
    if not topic.data:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Check if steward
    if not await is_craft_house_steward(user_id, topic.data["craft_house_id"], client):
        raise HTTPException(status_code=403, detail="Only stewards can update topics")

    # Update topic
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("craft_house_topics").update(update_data).eq("id", topic_id).execute()

    return CraftHouseTopicResponse(**result.data[0])


@router.get("/craft-houses/{craft_house_id}/threads", response_model=CraftHouseThreadListResponse)
async def list_craft_house_threads(
    craft_house_id: int,
    topic_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user = Depends(get_current_user_optional)
):
    """List discussion threads for a craft house"""
    client = get_client()
    user_id = get_user_id(user) if user else None

    # Get user's membership
    is_member = False
    if user_id:
        membership = await get_user_craft_house_membership(user_id, craft_house_id, client)
        is_member = membership is not None

    # Get visible topic IDs
    topics_query = client.table("craft_house_topics").select("id, name, is_members_only").eq(
        "craft_house_id", craft_house_id
    ).eq("is_active", True)
    if topic_id:
        topics_query = topics_query.eq("id", topic_id)
    topics_result = topics_query.execute()

    visible_topic_ids = []
    topic_names = {}
    for t in topics_result.data or []:
        if t.get("is_members_only") and not is_member:
            continue
        visible_topic_ids.append(t["id"])
        topic_names[t["id"]] = t["name"]

    if not visible_topic_ids:
        return CraftHouseThreadListResponse(threads=[], total=0, skip=skip, limit=limit)

    # Get threads
    query = client.table("craft_house_threads").select("*", count="exact").in_(
        "topic_id", visible_topic_ids
    ).order("is_pinned", desc=True).order("last_activity_at", desc=True).range(skip, skip + limit - 1)

    result = query.execute()

    threads = []
    for thread in result.data or []:
        # Get author info
        author = client.table("profiles").select("display_name, avatar_url").eq(
            "id", thread["user_id"]
        ).single().execute()
        thread["user_name"] = author.data.get("display_name") if author.data else None
        thread["user_avatar"] = author.data.get("avatar_url") if author.data else None
        thread["topic_name"] = topic_names.get(thread["topic_id"])

        # Get last replier name
        if thread.get("last_reply_by"):
            replier = client.table("profiles").select("display_name").eq(
                "id", thread["last_reply_by"]
            ).single().execute()
            thread["last_reply_by_name"] = replier.data.get("display_name") if replier.data else None

        threads.append(CraftHouseThreadResponse(**thread))

    return CraftHouseThreadListResponse(
        threads=threads,
        total=result.count or 0,
        skip=skip,
        limit=limit
    )


@router.post("/craft-houses/{craft_house_id}/threads", response_model=CraftHouseThreadResponse)
async def create_craft_house_thread(
    craft_house_id: int,
    thread: CraftHouseThreadCreate,
    user = Depends(require_order_member_local)
):
    """Create a new discussion thread (members only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Check membership
    membership = await get_user_craft_house_membership(user_id, craft_house_id, client)
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member to post")

    # Verify topic exists and belongs to this craft house
    topic = client.table("craft_house_topics").select("id, name, craft_house_id").eq(
        "id", thread.topic_id
    ).single().execute()
    if not topic.data or topic.data["craft_house_id"] != craft_house_id:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Only stewards can create announcements
    if thread.is_announcement and membership.get("role") != "steward":
        raise HTTPException(status_code=403, detail="Only stewards can create announcements")

    # Create thread
    data = {
        "user_id": user_id,
        "topic_id": thread.topic_id,
        "title": thread.title,
        "content": thread.content,
        "is_announcement": thread.is_announcement,
        "last_activity_at": datetime.utcnow().isoformat()
    }
    result = client.table("craft_house_threads").insert(data).execute()

    # Get author info for response
    author = client.table("profiles").select("display_name, avatar_url").eq("id", user_id).single().execute()
    thread_data = result.data[0]
    thread_data["user_name"] = author.data.get("display_name") if author.data else None
    thread_data["user_avatar"] = author.data.get("avatar_url") if author.data else None
    thread_data["topic_name"] = topic.data["name"]

    return CraftHouseThreadResponse(**thread_data)


@router.get("/craft-houses/threads/{thread_id}", response_model=CraftHouseThreadDetailResponse)
async def get_craft_house_thread(
    thread_id: str,
    user = Depends(get_current_user_optional)
):
    """Get a single thread with its replies"""
    client = get_client()
    user_id = get_user_id(user) if user else None

    # Get thread
    thread = client.table("craft_house_threads").select("*").eq("id", thread_id).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get topic to check visibility
    topic = client.table("craft_house_topics").select("*").eq("id", thread.data["topic_id"]).single().execute()
    if not topic.data:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Check access
    if not await can_view_topic(user_id, topic.data, client):
        raise HTTPException(status_code=403, detail="Members only topic")

    # Increment view count
    client.table("craft_house_threads").update({
        "view_count": (thread.data.get("view_count") or 0) + 1
    }).eq("id", thread_id).execute()

    # Get author info
    author = client.table("profiles").select("display_name, avatar_url").eq(
        "id", thread.data["user_id"]
    ).single().execute()
    thread.data["user_name"] = author.data.get("display_name") if author.data else None
    thread.data["user_avatar"] = author.data.get("avatar_url") if author.data else None
    thread.data["topic_name"] = topic.data["name"]

    # Get replies
    replies_result = client.table("craft_house_replies").select("*").eq(
        "thread_id", thread_id
    ).order("created_at").execute()

    replies = []
    for reply in replies_result.data or []:
        reply_author = client.table("profiles").select("display_name, avatar_url").eq(
            "id", reply["user_id"]
        ).single().execute()
        reply["user_name"] = reply_author.data.get("display_name") if reply_author.data else None
        reply["user_avatar"] = reply_author.data.get("avatar_url") if reply_author.data else None
        replies.append(CraftHouseReplyResponse(**reply))

    return CraftHouseThreadDetailResponse(
        thread=CraftHouseThreadResponse(**thread.data),
        replies=replies,
        total_replies=len(replies)
    )


@router.patch("/craft-houses/threads/{thread_id}", response_model=CraftHouseThreadResponse)
async def update_craft_house_thread(
    thread_id: str,
    update: CraftHouseThreadUpdate,
    user = Depends(require_order_member_local)
):
    """Update a thread (author or steward)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get thread
    thread = client.table("craft_house_threads").select("*").eq("id", thread_id).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get topic for craft house ID
    topic = client.table("craft_house_topics").select("craft_house_id, name").eq(
        "id", thread.data["topic_id"]
    ).single().execute()

    # Check permission (author or steward)
    is_author = thread.data["user_id"] == user_id
    is_steward = await is_craft_house_steward(user_id, topic.data["craft_house_id"], client)

    if not is_author and not is_steward:
        raise HTTPException(status_code=403, detail="Not authorized to update this thread")

    # Only stewards can pin/lock
    if (update.is_pinned is not None or update.is_locked is not None) and not is_steward:
        raise HTTPException(status_code=403, detail="Only stewards can pin or lock threads")

    # Update thread
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("craft_house_threads").update(update_data).eq("id", thread_id).execute()

    # Add enrichment
    author = client.table("profiles").select("display_name, avatar_url").eq(
        "id", result.data[0]["user_id"]
    ).single().execute()
    result.data[0]["user_name"] = author.data.get("display_name") if author.data else None
    result.data[0]["user_avatar"] = author.data.get("avatar_url") if author.data else None
    result.data[0]["topic_name"] = topic.data["name"]

    return CraftHouseThreadResponse(**result.data[0])


@router.delete("/craft-houses/threads/{thread_id}")
async def delete_craft_house_thread(
    thread_id: str,
    user = Depends(require_order_member_local)
):
    """Delete a thread (author or steward)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get thread
    thread = client.table("craft_house_threads").select("*").eq("id", thread_id).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get topic for craft house ID
    topic = client.table("craft_house_topics").select("craft_house_id").eq(
        "id", thread.data["topic_id"]
    ).single().execute()

    # Check permission (author or steward)
    is_author = thread.data["user_id"] == user_id
    is_steward = await is_craft_house_steward(user_id, topic.data["craft_house_id"], client)

    if not is_author and not is_steward:
        raise HTTPException(status_code=403, detail="Not authorized to delete this thread")

    # Delete thread (cascade deletes replies)
    client.table("craft_house_threads").delete().eq("id", thread_id).execute()

    return {"message": "Thread deleted"}


@router.post("/craft-houses/threads/{thread_id}/pin")
async def toggle_pin_thread(
    thread_id: str,
    user = Depends(require_order_member_local)
):
    """Pin or unpin a thread (steward only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get thread
    thread = client.table("craft_house_threads").select("*").eq("id", thread_id).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Get topic for craft house ID
    topic = client.table("craft_house_topics").select("craft_house_id").eq(
        "id", thread.data["topic_id"]
    ).single().execute()

    # Check if steward
    if not await is_craft_house_steward(user_id, topic.data["craft_house_id"], client):
        raise HTTPException(status_code=403, detail="Only stewards can pin threads")

    # Toggle pin
    new_pinned = not thread.data.get("is_pinned", False)
    client.table("craft_house_threads").update({
        "is_pinned": new_pinned,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", thread_id).execute()

    return {"is_pinned": new_pinned}


@router.post("/craft-houses/threads/{thread_id}/replies", response_model=CraftHouseReplyResponse)
async def create_craft_house_reply(
    thread_id: str,
    reply: CraftHouseReplyCreate,
    user = Depends(require_order_member_local)
):
    """Add a reply to a thread (members only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get thread
    thread = client.table("craft_house_threads").select("*").eq("id", thread_id).single().execute()
    if not thread.data:
        raise HTTPException(status_code=404, detail="Thread not found")

    if thread.data.get("is_locked"):
        raise HTTPException(status_code=403, detail="This thread is locked")

    # Get topic for craft house ID
    topic = client.table("craft_house_topics").select("craft_house_id").eq(
        "id", thread.data["topic_id"]
    ).single().execute()

    # Check membership
    membership = await get_user_craft_house_membership(user_id, topic.data["craft_house_id"], client)
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member to reply")

    # Create reply
    data = {
        "thread_id": thread_id,
        "user_id": user_id,
        "content": reply.content,
        "parent_reply_id": reply.parent_reply_id
    }
    result = client.table("craft_house_replies").insert(data).execute()

    # Get author info
    author = client.table("profiles").select("display_name, avatar_url").eq("id", user_id).single().execute()
    reply_data = result.data[0]
    reply_data["user_name"] = author.data.get("display_name") if author.data else None
    reply_data["user_avatar"] = author.data.get("avatar_url") if author.data else None

    return CraftHouseReplyResponse(**reply_data)


@router.patch("/craft-houses/replies/{reply_id}", response_model=CraftHouseReplyResponse)
async def update_craft_house_reply(
    reply_id: str,
    update: CraftHouseReplyUpdate,
    user = Depends(require_order_member_local)
):
    """Update a reply (author only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get reply
    reply = client.table("craft_house_replies").select("*").eq("id", reply_id).single().execute()
    if not reply.data:
        raise HTTPException(status_code=404, detail="Reply not found")

    # Check author
    if reply.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the author can edit this reply")

    # Update reply
    result = client.table("craft_house_replies").update({
        "content": update.content,
        "is_edited": True,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", reply_id).execute()

    # Get author info
    author = client.table("profiles").select("display_name, avatar_url").eq("id", user_id).single().execute()
    result.data[0]["user_name"] = author.data.get("display_name") if author.data else None
    result.data[0]["user_avatar"] = author.data.get("avatar_url") if author.data else None

    return CraftHouseReplyResponse(**result.data[0])


@router.delete("/craft-houses/replies/{reply_id}")
async def delete_craft_house_reply(
    reply_id: str,
    user = Depends(require_order_member_local)
):
    """Delete a reply (author or steward)"""
    user_id = get_user_id(user)
    client = get_client()

    # Get reply
    reply = client.table("craft_house_replies").select("*").eq("id", reply_id).single().execute()
    if not reply.data:
        raise HTTPException(status_code=404, detail="Reply not found")

    # Get thread and topic for permission check
    thread = client.table("craft_house_threads").select("topic_id").eq(
        "id", reply.data["thread_id"]
    ).single().execute()
    topic = client.table("craft_house_topics").select("craft_house_id").eq(
        "id", thread.data["topic_id"]
    ).single().execute()

    # Check permission (author or steward)
    is_author = reply.data["user_id"] == user_id
    is_steward = await is_craft_house_steward(user_id, topic.data["craft_house_id"], client)

    if not is_author and not is_steward:
        raise HTTPException(status_code=403, detail="Not authorized to delete this reply")

    # Delete reply
    client.table("craft_house_replies").delete().eq("id", reply_id).execute()

    return {"message": "Reply deleted"}


@router.post("/craft-houses/{craft_house_id}/members/{member_user_id}/role")
async def update_member_role(
    craft_house_id: int,
    member_user_id: str,
    role_update: CraftHouseMemberRoleUpdate,
    user = Depends(require_order_member_local)
):
    """Update a member's role (steward only)"""
    user_id = get_user_id(user)
    client = get_client()

    # Check if steward
    if not await is_craft_house_steward(user_id, craft_house_id, client):
        raise HTTPException(status_code=403, detail="Only stewards can change member roles")

    # Cannot demote yourself from steward
    if member_user_id == user_id and role_update.role != CraftHouseRole.STEWARD:
        raise HTTPException(status_code=400, detail="Cannot demote yourself. Transfer stewardship first.")

    # Get member
    membership = await get_user_craft_house_membership(member_user_id, craft_house_id, client)
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    # Update role
    client.table("order_craft_house_memberships").update({
        "role": role_update.role.value
    }).eq("user_id", member_user_id).eq("craft_house_id", craft_house_id).execute()

    return {"message": f"Member role updated to {role_update.role.value}"}


# ============ Fellowship Endpoints ============

@router.get("/fellowships", response_model=FellowshipListResponse)
async def list_fellowships(
    fellowship_type: Optional[FellowshipType] = None,
    user = Depends(get_current_user_optional)
):
    """List all fellowships"""
    client = get_client()

    query = client.table("order_fellowships").select("*", count="exact")

    if fellowship_type:
        query = query.eq("fellowship_type", fellowship_type.value)

    # Non-admins only see visible fellowships
    if not (user and is_admin(user)):
        query = query.eq("is_visible", True).eq("status", "active")

    query = query.order("name")
    result = query.execute()

    fellowships = []
    for fellowship in result.data or []:
        # Get member count
        member_count_result = client.table("order_fellowship_memberships").select(
            "id", count="exact"
        ).eq("fellowship_id", fellowship["id"]).execute()
        fellowship["member_count"] = member_count_result.count or 0

        fellowships.append(FellowshipResponse(**fellowship))

    return FellowshipListResponse(fellowships=fellowships, total=result.count or 0)


@router.get("/fellowships/{fellowship_id}", response_model=FellowshipResponse)
async def get_fellowship(
    fellowship_id: int,
    user = Depends(get_current_user_optional)
):
    """Get fellowship details"""
    client = get_client()

    result = client.table("order_fellowships").select("*").eq("id", fellowship_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Fellowship not found")

    fellowship = result.data

    # Check visibility
    if not fellowship.get("is_visible") and not (user and is_admin(user)):
        raise HTTPException(status_code=404, detail="Fellowship not found")

    # Get member count
    member_count_result = client.table("order_fellowship_memberships").select(
        "id", count="exact"
    ).eq("fellowship_id", fellowship_id).execute()
    fellowship["member_count"] = member_count_result.count or 0

    return FellowshipResponse(**fellowship)


@router.post("/fellowships/{fellowship_id}/join", response_model=FellowshipMembershipResponse)
async def join_fellowship(
    fellowship_id: int,
    user = Depends(require_order_member_local)
):
    """Join a fellowship (Order members only, opt-in fellowships)"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify fellowship exists and is joinable
    fellowship_result = client.table("order_fellowships").select("*").eq(
        "id", fellowship_id
    ).single().execute()

    if not fellowship_result.data:
        raise HTTPException(status_code=404, detail="Fellowship not found")

    fellowship = fellowship_result.data

    if fellowship["status"] != "active":
        raise HTTPException(status_code=400, detail="This Fellowship is not accepting members")

    if not fellowship["is_opt_in"]:
        raise HTTPException(
            status_code=400,
            detail="This Fellowship is not opt-in. Members are assigned automatically."
        )

    # Check if already a member
    existing = client.table("order_fellowship_memberships").select("id").eq(
        "user_id", user_id
    ).eq("fellowship_id", fellowship_id).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="You are already a member of this Fellowship")

    # Create membership
    now = datetime.utcnow().isoformat()
    membership_data = {
        "user_id": user_id,
        "fellowship_id": fellowship_id,
        "role": "member",
        "joined_at": now,
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_fellowship_memberships").insert(membership_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to join Fellowship")

    response = result.data[0]
    response["fellowship_name"] = fellowship["name"]

    return FellowshipMembershipResponse(**response)


@router.delete("/fellowships/{fellowship_id}/leave")
async def leave_fellowship(
    fellowship_id: int,
    user = Depends(require_order_member_local)
):
    """Leave a fellowship"""
    user_id = get_user_id(user)
    client = get_client()

    # Check if member
    existing = client.table("order_fellowship_memberships").select("id").eq(
        "user_id", user_id
    ).eq("fellowship_id", fellowship_id).execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="You are not a member of this Fellowship")

    # Delete membership
    client.table("order_fellowship_memberships").delete().eq(
        "user_id", user_id
    ).eq("fellowship_id", fellowship_id).execute()

    return {"message": "Successfully left Fellowship"}


@router.get("/fellowships/my/memberships", response_model=List[FellowshipMembershipResponse])
async def get_my_fellowship_memberships(user = Depends(require_order_member_local)):
    """Get current user's fellowship memberships"""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_fellowship_memberships").select("*").eq("user_id", user_id).execute()

    memberships = []
    for m in result.data or []:
        # Get fellowship name separately
        if m.get("fellowship_id"):
            fellowship_result = client.table("order_fellowships").select("name").eq("id", m["fellowship_id"]).single().execute()
            m["fellowship_name"] = fellowship_result.data.get("name") if fellowship_result.data else None
        else:
            m["fellowship_name"] = None
        memberships.append(FellowshipMembershipResponse(**m))

    return memberships


# ============ Governance Endpoints ============

@router.get("/governance/positions", response_model=GovernancePositionListResponse)
async def list_governance_positions(
    position_type: Optional[GovernancePositionType] = None,
    scope_type: Optional[GovernanceScopeType] = None,
    scope_id: Optional[int] = None,
    active_only: bool = True,
    user = Depends(get_current_user_optional)
):
    """List governance positions"""
    client = get_client()

    query = client.table("order_governance_positions").select("*", count="exact")

    if position_type:
        query = query.eq("position_type", position_type.value)
    if scope_type:
        query = query.eq("scope_type", scope_type.value)
    if scope_id:
        query = query.eq("scope_id", scope_id)
    if active_only:
        query = query.eq("is_active", True)

    query = query.order("position_type").order("started_at", desc=True)
    result = query.execute()

    positions = []
    for pos in result.data or []:
        # Get user name
        user_profile = client.table("profiles").select("display_name").eq(
            "id", pos["user_id"]
        ).execute()
        pos["user_name"] = user_profile.data[0].get("display_name") if user_profile.data else None

        # Get scope name if applicable
        if pos.get("scope_type") and pos.get("scope_id"):
            if pos["scope_type"] == "lodge":
                scope_result = client.table("order_lodges").select("name").eq(
                    "id", pos["scope_id"]
                ).execute()
            elif pos["scope_type"] == "craft_house":
                scope_result = client.table("order_craft_houses").select("name").eq(
                    "id", pos["scope_id"]
                ).execute()
            elif pos["scope_type"] == "fellowship":
                scope_result = client.table("order_fellowships").select("name").eq(
                    "id", pos["scope_id"]
                ).execute()
            else:
                scope_result = None

            if scope_result and scope_result.data:
                pos["scope_name"] = scope_result.data[0].get("name")

        positions.append(GovernancePositionResponse(**pos))

    return GovernancePositionListResponse(positions=positions, total=result.count or 0)


@router.get("/governance/high-council", response_model=HighCouncilResponse)
async def get_high_council(user = Depends(get_current_user_optional)):
    """Get High Council leadership"""
    client = get_client()

    # Get Grand Master
    grand_master_result = client.table("order_governance_positions").select("*").eq(
        "position_type", "grand_master"
    ).eq("is_active", True).execute()

    grand_master = None
    if grand_master_result.data:
        gm = grand_master_result.data[0]
        user_profile = client.table("profiles").select("display_name").eq(
            "id", gm["user_id"]
        ).execute()
        gm["user_name"] = user_profile.data[0].get("display_name") if user_profile.data else None
        grand_master = GovernancePositionResponse(**gm)

    # Get High Council members
    council_result = client.table("order_governance_positions").select("*").eq(
        "position_type", "high_council"
    ).eq("is_active", True).order("started_at").execute()

    council_members = []
    for pos in council_result.data or []:
        user_profile = client.table("profiles").select("display_name").eq(
            "id", pos["user_id"]
        ).execute()
        pos["user_name"] = user_profile.data[0].get("display_name") if user_profile.data else None
        council_members.append(GovernancePositionResponse(**pos))

    return HighCouncilResponse(grand_master=grand_master, council_members=council_members)


# ============ Admin Management Endpoints ============

# --- Governance Position Management ---

@router.post("/admin/governance/positions", response_model=GovernancePositionResponse)
async def create_governance_position(
    position: GovernancePositionCreate,
    user = Depends(require_admin_local)
):
    """Create a new governance position (admin only)"""
    admin_id = get_user_id(user)
    client = get_client()

    # Verify the target user is an Order member
    target_profile = await get_order_member_profile(position.user_id)
    if not target_profile:
        raise HTTPException(status_code=400, detail="Target user is not an Order member")

    # For Grand Master, deactivate any existing
    if position.position_type == GovernancePositionType.GRAND_MASTER:
        client.table("order_governance_positions").update({
            "is_active": False,
            "ended_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("position_type", "grand_master").eq("is_active", True).execute()

    now = datetime.utcnow().isoformat()
    position_data = {
        "user_id": position.user_id,
        "position_type": position.position_type.value,
        "scope_type": position.scope_type.value if position.scope_type else None,
        "scope_id": position.scope_id,
        "title": position.title,
        "description": position.description,
        "appointed_by": admin_id,
        "started_at": now,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    result = client.table("order_governance_positions").insert(position_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create governance position")

    pos = result.data[0]
    # Get user name
    user_profile = client.table("profiles").select("display_name").eq("id", pos["user_id"]).execute()
    pos["user_name"] = user_profile.data[0].get("display_name") if user_profile.data else None

    return GovernancePositionResponse(**pos)


@router.patch("/admin/governance/positions/{position_id}", response_model=GovernancePositionResponse)
async def update_governance_position(
    position_id: int,
    update: GovernancePositionUpdate,
    user = Depends(require_admin_local)
):
    """Update a governance position (admin only)"""
    client = get_client()

    # Verify position exists
    existing = client.table("order_governance_positions").select("*").eq("id", position_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Governance position not found")

    update_data = update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_governance_positions").update(update_data).eq("id", position_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update governance position")

    pos = result.data[0]
    # Get user name
    user_profile = client.table("profiles").select("display_name").eq("id", pos["user_id"]).execute()
    pos["user_name"] = user_profile.data[0].get("display_name") if user_profile.data else None

    return GovernancePositionResponse(**pos)


@router.delete("/admin/governance/positions/{position_id}")
async def remove_governance_position(
    position_id: int,
    user = Depends(require_admin_local)
):
    """Remove/end a governance position (admin only)"""
    client = get_client()

    # Verify position exists
    existing = client.table("order_governance_positions").select("id").eq("id", position_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Governance position not found")

    # End the position rather than delete
    now = datetime.utcnow().isoformat()
    client.table("order_governance_positions").update({
        "is_active": False,
        "ended_at": now,
        "updated_at": now
    }).eq("id", position_id).execute()

    return {"message": "Governance position ended"}


# --- Lodge Officer Management ---

@router.post("/admin/lodges/{lodge_id}/officers", response_model=LodgeMembershipResponse)
async def appoint_lodge_officer(
    lodge_id: int,
    appointment: LodgeOfficerAppoint,
    user = Depends(require_admin_local)
):
    """Appoint a lodge officer (admin only)"""
    client = get_client()

    # Verify lodge exists
    lodge_result = client.table("order_lodges").select("*").eq("id", lodge_id).single().execute()
    if not lodge_result.data:
        raise HTTPException(status_code=404, detail="Lodge not found")

    # Verify user is an Order member
    target_profile = await get_order_member_profile(appointment.user_id)
    if not target_profile:
        raise HTTPException(status_code=400, detail="Target user is not an Order member")

    # Check if user is already a lodge member
    existing = client.table("order_lodge_memberships").select("*").eq(
        "user_id", appointment.user_id
    ).eq("lodge_id", lodge_id).execute()

    now = datetime.utcnow().isoformat()

    if existing.data:
        # Update existing membership to make them an officer
        result = client.table("order_lodge_memberships").update({
            "is_officer": True,
            "officer_title": appointment.officer_title,
            "updated_at": now
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        # Create new membership as officer
        membership_data = {
            "user_id": appointment.user_id,
            "lodge_id": lodge_id,
            "status": "active",
            "is_officer": True,
            "officer_title": appointment.officer_title,
            "joined_at": now,
            "created_at": now,
            "updated_at": now
        }
        result = client.table("order_lodge_memberships").insert(membership_data).execute()

        # Also update member profile lodge_id
        client.table("order_member_profiles").update({
            "lodge_id": lodge_id,
            "updated_at": now
        }).eq("user_id", appointment.user_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to appoint lodge officer")

    response = result.data[0]
    response["lodge_name"] = lodge_result.data["name"]
    response["lodge_city"] = lodge_result.data.get("city")

    return LodgeMembershipResponse(**response)


@router.delete("/admin/lodges/{lodge_id}/officers/{officer_user_id}")
async def remove_lodge_officer(
    lodge_id: int,
    officer_user_id: str,
    user = Depends(require_admin_local)
):
    """Remove officer status from a lodge member (admin only)"""
    client = get_client()

    # Find the membership
    existing = client.table("order_lodge_memberships").select("*").eq(
        "user_id", officer_user_id
    ).eq("lodge_id", lodge_id).execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Lodge membership not found")

    # Remove officer status
    now = datetime.utcnow().isoformat()
    client.table("order_lodge_memberships").update({
        "is_officer": False,
        "officer_title": None,
        "updated_at": now
    }).eq("id", existing.data[0]["id"]).execute()

    return {"message": "Officer status removed"}


@router.patch("/admin/lodge-memberships/{membership_id}", response_model=LodgeMembershipResponse)
async def update_lodge_membership(
    membership_id: int,
    update: LodgeMembershipUpdate,
    user = Depends(require_admin_local)
):
    """Update a lodge membership (admin only)"""
    client = get_client()

    # Verify membership exists
    existing = client.table("order_lodge_memberships").select(
        "*, order_lodges(name, city)"
    ).eq("id", membership_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Lodge membership not found")

    update_data = update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_lodge_memberships").update(update_data).eq("id", membership_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update lodge membership")

    response = result.data[0]
    lodge_info = existing.data.get("order_lodges", {}) or {}
    response["lodge_name"] = lodge_info.get("name")
    response["lodge_city"] = lodge_info.get("city")

    return LodgeMembershipResponse(**response)


# --- Craft House Leadership Management ---

@router.post("/admin/craft-houses/{craft_house_id}/leadership", response_model=CraftHouseMembershipResponse)
async def appoint_craft_house_leadership(
    craft_house_id: int,
    appointment: CraftHouseLeadershipAppoint,
    user = Depends(require_admin_local)
):
    """Appoint Craft Master or Deputy (admin only)"""
    client = get_client()

    # Verify craft house exists
    house_result = client.table("order_craft_houses").select("*").eq("id", craft_house_id).single().execute()
    if not house_result.data:
        raise HTTPException(status_code=404, detail="Craft House not found")

    # Verify user is an Order member
    target_profile = await get_order_member_profile(appointment.user_id)
    if not target_profile:
        raise HTTPException(status_code=400, detail="Target user is not an Order member")

    # If appointing a new steward, demote the current steward
    if appointment.role == CraftHouseRole.STEWARD:
        client.table("order_craft_house_memberships").update({
            "role": "member",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("craft_house_id", craft_house_id).eq("role", "steward").execute()

    now = datetime.utcnow().isoformat()

    # Check if user is already a member
    existing = client.table("order_craft_house_memberships").select("*").eq(
        "user_id", appointment.user_id
    ).eq("craft_house_id", craft_house_id).execute()

    if existing.data:
        # Update existing membership
        result = client.table("order_craft_house_memberships").update({
            "role": appointment.role.value,
            "updated_at": now
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        # Create new membership with leadership role
        membership_data = {
            "user_id": appointment.user_id,
            "craft_house_id": craft_house_id,
            "role": appointment.role.value,
            "joined_at": now,
            "created_at": now,
            "updated_at": now
        }
        result = client.table("order_craft_house_memberships").insert(membership_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to appoint leadership")

    response = result.data[0]
    response["craft_house_name"] = house_result.data["name"]

    return CraftHouseMembershipResponse(**response)


@router.delete("/admin/craft-houses/{craft_house_id}/leadership/{leader_user_id}")
async def remove_craft_house_leadership(
    craft_house_id: int,
    leader_user_id: str,
    user = Depends(require_admin_local)
):
    """Remove leadership role from craft house member (admin only)"""
    client = get_client()

    # Find the membership
    existing = client.table("order_craft_house_memberships").select("*").eq(
        "user_id", leader_user_id
    ).eq("craft_house_id", craft_house_id).execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Craft house membership not found")

    # Demote to regular member
    now = datetime.utcnow().isoformat()
    client.table("order_craft_house_memberships").update({
        "role": "member",
        "updated_at": now
    }).eq("id", existing.data[0]["id"]).execute()

    return {"message": "Leadership role removed"}


@router.patch("/admin/craft-house-memberships/{membership_id}", response_model=CraftHouseMembershipResponse)
async def update_craft_house_membership(
    membership_id: int,
    update: CraftHouseMembershipUpdate,
    user = Depends(require_admin_local)
):
    """Update a craft house membership role (admin only)"""
    client = get_client()

    # Verify membership exists
    existing = client.table("order_craft_house_memberships").select("*").eq("id", membership_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Craft house membership not found")

    update_data = update.model_dump(exclude_unset=True)
    if update_data.get("role"):
        update_data["role"] = update_data["role"].value
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_craft_house_memberships").update(update_data).eq("id", membership_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update membership")

    response = result.data[0]
    # Get craft house name separately
    if existing.data.get("craft_house_id"):
        house_result = client.table("order_craft_houses").select("name").eq("id", existing.data["craft_house_id"]).single().execute()
        response["craft_house_name"] = house_result.data.get("name") if house_result.data else None
    else:
        response["craft_house_name"] = None

    return CraftHouseMembershipResponse(**response)


# --- Fellowship Leadership Management ---

@router.post("/admin/fellowships/{fellowship_id}/leadership", response_model=FellowshipMembershipResponse)
async def appoint_fellowship_leadership(
    fellowship_id: int,
    appointment: FellowshipLeadershipAppoint,
    user = Depends(require_admin_local)
):
    """Appoint Fellowship Leader or Coordinator (admin only)"""
    client = get_client()

    # Verify fellowship exists
    fellowship_result = client.table("order_fellowships").select("*").eq("id", fellowship_id).single().execute()
    if not fellowship_result.data:
        raise HTTPException(status_code=404, detail="Fellowship not found")

    # Verify user is an Order member
    target_profile = await get_order_member_profile(appointment.user_id)
    if not target_profile:
        raise HTTPException(status_code=400, detail="Target user is not an Order member")

    # If appointing a new leader, demote the current leader
    if appointment.role == FellowshipRole.LEADER:
        client.table("order_fellowship_memberships").update({
            "role": "member",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("fellowship_id", fellowship_id).eq("role", "leader").execute()

    now = datetime.utcnow().isoformat()

    # Check if user is already a member
    existing = client.table("order_fellowship_memberships").select("*").eq(
        "user_id", appointment.user_id
    ).eq("fellowship_id", fellowship_id).execute()

    if existing.data:
        # Update existing membership
        result = client.table("order_fellowship_memberships").update({
            "role": appointment.role.value,
            "updated_at": now
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        # Create new membership with leadership role
        membership_data = {
            "user_id": appointment.user_id,
            "fellowship_id": fellowship_id,
            "role": appointment.role.value,
            "joined_at": now,
            "created_at": now,
            "updated_at": now
        }
        result = client.table("order_fellowship_memberships").insert(membership_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to appoint leadership")

    response = result.data[0]
    response["fellowship_name"] = fellowship_result.data["name"]

    return FellowshipMembershipResponse(**response)


@router.delete("/admin/fellowships/{fellowship_id}/leadership/{leader_user_id}")
async def remove_fellowship_leadership(
    fellowship_id: int,
    leader_user_id: str,
    user = Depends(require_admin_local)
):
    """Remove leadership role from fellowship member (admin only)"""
    client = get_client()

    # Find the membership
    existing = client.table("order_fellowship_memberships").select("*").eq(
        "user_id", leader_user_id
    ).eq("fellowship_id", fellowship_id).execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Fellowship membership not found")

    # Demote to regular member
    now = datetime.utcnow().isoformat()
    client.table("order_fellowship_memberships").update({
        "role": "member",
        "updated_at": now
    }).eq("id", existing.data[0]["id"]).execute()

    return {"message": "Leadership role removed"}


@router.patch("/admin/fellowship-memberships/{membership_id}", response_model=FellowshipMembershipResponse)
async def update_fellowship_membership(
    membership_id: int,
    update: FellowshipMembershipUpdate,
    user = Depends(require_admin_local)
):
    """Update a fellowship membership role (admin only)"""
    client = get_client()

    # Verify membership exists
    existing = client.table("order_fellowship_memberships").select("*").eq("id", membership_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Fellowship membership not found")

    update_data = update.model_dump(exclude_unset=True)
    if update_data.get("role"):
        update_data["role"] = update_data["role"].value
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("order_fellowship_memberships").update(update_data).eq("id", membership_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update membership")

    response = result.data[0]
    # Get fellowship name separately
    if existing.data.get("fellowship_id"):
        fellowship_result = client.table("order_fellowships").select("name").eq("id", existing.data["fellowship_id"]).single().execute()
        response["fellowship_name"] = fellowship_result.data.get("name") if fellowship_result.data else None
    else:
        response["fellowship_name"] = None

    return FellowshipMembershipResponse(**response)


# --- Member Management ---

@router.patch("/admin/members/{member_user_id}/tier", response_model=OrderMemberProfileResponse)
async def update_member_tier(
    member_user_id: str,
    update: OrderMemberTierUpdate,
    user = Depends(require_admin_local)
):
    """Update a member's tier (admin only)"""
    client = get_client()

    # Verify member exists
    profile = await get_order_member_profile(member_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Order member not found")

    now = datetime.utcnow().isoformat()
    update_data = {
        "membership_tier": update.membership_tier.value,
        "tier_started_at": now,
        "updated_at": now
    }

    result = client.table("order_member_profiles").update(update_data).eq("user_id", member_user_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update member tier")

    response = result.data[0]

    # Get user info
    user_profile = client.table("profiles").select("display_name, email").eq("id", member_user_id).execute()
    if user_profile.data:
        response["user_name"] = user_profile.data[0].get("display_name")
        response["user_email"] = user_profile.data[0].get("email")

    return OrderMemberProfileResponse(**response)


@router.patch("/admin/members/{member_user_id}/lodge", response_model=OrderMemberProfileResponse)
async def assign_member_to_lodge(
    member_user_id: str,
    assignment: OrderMemberLodgeAssignment,
    user = Depends(require_admin_local)
):
    """Assign a member to a lodge (admin only)"""
    client = get_client()

    # Verify member exists
    profile = await get_order_member_profile(member_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Order member not found")

    # Verify lodge exists
    lodge_result = client.table("order_lodges").select("*").eq("id", assignment.lodge_id).single().execute()
    if not lodge_result.data:
        raise HTTPException(status_code=404, detail="Lodge not found")

    now = datetime.utcnow().isoformat()

    # Remove from any existing lodge
    if profile.get("lodge_id"):
        client.table("order_lodge_memberships").delete().eq(
            "user_id", member_user_id
        ).eq("lodge_id", profile["lodge_id"]).execute()

    # Update profile with new lodge
    result = client.table("order_member_profiles").update({
        "lodge_id": assignment.lodge_id,
        "updated_at": now
    }).eq("user_id", member_user_id).execute()

    # Create lodge membership
    membership_data = {
        "user_id": member_user_id,
        "lodge_id": assignment.lodge_id,
        "status": "active",
        "is_officer": assignment.is_officer,
        "officer_title": assignment.officer_title if assignment.is_officer else None,
        "joined_at": now,
        "created_at": now,
        "updated_at": now
    }
    client.table("order_lodge_memberships").insert(membership_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to assign member to lodge")

    response = result.data[0]
    response["lodge_name"] = lodge_result.data["name"]
    response["lodge_city"] = lodge_result.data.get("city")

    # Get user info
    user_profile = client.table("profiles").select("display_name, email").eq("id", member_user_id).execute()
    if user_profile.data:
        response["user_name"] = user_profile.data[0].get("display_name")
        response["user_email"] = user_profile.data[0].get("email")

    return OrderMemberProfileResponse(**response)


@router.delete("/admin/members/{member_user_id}/lodge")
async def remove_member_from_lodge(
    member_user_id: str,
    user = Depends(require_admin_local)
):
    """Remove a member from their lodge (admin only)"""
    client = get_client()

    # Verify member exists
    profile = await get_order_member_profile(member_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Order member not found")

    if not profile.get("lodge_id"):
        raise HTTPException(status_code=400, detail="Member is not in a lodge")

    now = datetime.utcnow().isoformat()

    # Remove lodge membership
    client.table("order_lodge_memberships").delete().eq(
        "user_id", member_user_id
    ).eq("lodge_id", profile["lodge_id"]).execute()

    # Update profile
    client.table("order_member_profiles").update({
        "lodge_id": None,
        "updated_at": now
    }).eq("user_id", member_user_id).execute()

    return {"message": "Member removed from lodge"}


@router.patch("/admin/members/{member_user_id}/status", response_model=OrderMemberProfileResponse)
async def update_member_status(
    member_user_id: str,
    update: OrderMemberAdminUpdate,
    user = Depends(require_admin_local)
):
    """Update a member's status (admin only)"""
    client = get_client()

    # Verify member exists
    profile = await get_order_member_profile(member_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Order member not found")

    now = datetime.utcnow().isoformat()
    update_data = {
        "status": update.status.value,
        "updated_at": now
    }

    result = client.table("order_member_profiles").update(update_data).eq("user_id", member_user_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update member status")

    response = result.data[0]

    # Get user info
    user_profile = client.table("profiles").select("display_name, email").eq("id", member_user_id).execute()
    if user_profile.data:
        response["user_name"] = user_profile.data[0].get("display_name")
        response["user_email"] = user_profile.data[0].get("email")

    return OrderMemberProfileResponse(**response)


# --- Admin List Endpoints ---

@router.get("/admin/members", response_model=OrderMemberListResponse)
async def list_all_members(
    status: Optional[OrderMemberStatus] = None,
    tier: Optional[MembershipTier] = None,
    lodge_id: Optional[int] = None,
    track: Optional[PrimaryTrack] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(require_admin_local)
):
    """List all Order members with filters (admin only)"""
    client = get_client()

    query = client.table("order_member_profiles").select("*", count="exact")

    if status:
        query = query.eq("status", status.value)
    if tier:
        query = query.eq("membership_tier", tier.value)
    if lodge_id:
        query = query.eq("lodge_id", lodge_id)
    if track:
        query = query.eq("primary_track", track.value)

    query = query.order("created_at", desc=True).range(skip, skip + limit - 1)
    result = query.execute()

    members = []
    for m in result.data or []:
        # Get user info
        user_profile = client.table("profiles").select("display_name, email").eq("id", m["user_id"]).execute()
        if user_profile.data:
            m["user_name"] = user_profile.data[0].get("display_name")
            m["user_email"] = user_profile.data[0].get("email")

            # Filter by search if provided
            if search:
                search_lower = search.lower()
                name = (m.get("user_name") or "").lower()
                email = (m.get("user_email") or "").lower()
                if search_lower not in name and search_lower not in email:
                    continue

        # Get lodge name if applicable
        if m.get("lodge_id"):
            lodge_result = client.table("order_lodges").select("name, city").eq("id", m["lodge_id"]).execute()
            if lodge_result.data:
                m["lodge_name"] = lodge_result.data[0].get("name")
                m["lodge_city"] = lodge_result.data[0].get("city")

        members.append(OrderMemberProfileResponse(**m))

    return OrderMemberListResponse(members=members, total=result.count or 0, skip=skip, limit=limit)


@router.get("/admin/lodges/{lodge_id}/members", response_model=OrderMemberListResponse)
async def list_lodge_members(
    lodge_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user = Depends(require_admin_local)
):
    """List all members in a lodge (admin only)"""
    client = get_client()

    # Verify lodge exists
    lodge_result = client.table("order_lodges").select("*").eq("id", lodge_id).single().execute()
    if not lodge_result.data:
        raise HTTPException(status_code=404, detail="Lodge not found")

    result = client.table("order_member_profiles").select(
        "*", count="exact"
    ).eq("lodge_id", lodge_id).range(skip, skip + limit - 1).execute()

    members = []
    for m in result.data or []:
        # Get user info
        user_profile = client.table("profiles").select("display_name, email").eq("id", m["user_id"]).execute()
        if user_profile.data:
            m["user_name"] = user_profile.data[0].get("display_name")
            m["user_email"] = user_profile.data[0].get("email")

        m["lodge_name"] = lodge_result.data["name"]
        m["lodge_city"] = lodge_result.data.get("city")
        members.append(OrderMemberProfileResponse(**m))

    return OrderMemberListResponse(members=members, total=result.count or 0, skip=skip, limit=limit)


# ============ Membership Tier Endpoints ============

MEMBERSHIP_TIERS = {
    MembershipTier.BASE: MembershipTierInfo(
        tier=MembershipTier.BASE,
        name="Base Member",
        price_cents=5000,  # $50
        description="Full access to the Order",
        benefits=[
            "Member directory access",
            "Order job board",
            "Lodge membership",
            "Craft House membership",
            "Fellowship access",
        ]
    ),
    MembershipTier.STEWARD: MembershipTierInfo(
        tier=MembershipTier.STEWARD,
        name="Steward",
        price_cents=10000,  # $100
        description="Enhanced benefits for committed members",
        benefits=[
            "All Base benefits",
            "Priority job access",
            "Mentorship matching",
            "Featured directory listing",
            "Steward badge",
        ]
    ),
    MembershipTier.PATRON: MembershipTierInfo(
        tier=MembershipTier.PATRON,
        name="Patron",
        price_cents=25000,  # $250
        description="Leadership tier with governance rights",
        benefits=[
            "All Steward benefits",
            "Governance voting rights",
            "Founding member credits",
            "Patron badge",
            "Direct council access",
        ]
    ),
}


@router.get("/membership/tiers", response_model=List[MembershipTierInfo])
async def get_membership_tiers():
    """Get available membership tiers and pricing"""
    return list(MEMBERSHIP_TIERS.values())


@router.get("/membership/me", response_model=MembershipStatusResponse)
async def get_my_membership_status(user = Depends(get_current_user)):
    """Get current user's membership status"""
    user_id = get_user_id(user)
    profile = await get_order_member_profile(user_id)

    if not profile:
        return MembershipStatusResponse(is_order_member=False)

    return MembershipStatusResponse(
        is_order_member=True,
        membership_status=profile.get("status"),
        membership_tier=profile.get("membership_tier"),
        tier_started_at=profile.get("tier_started_at"),
        dues_status=profile.get("dues_status"),
        stripe_customer_id=profile.get("stripe_customer_id"),
    )


@router.get("/dashboard/extended", response_model=OrderDashboardStatsExtended)
async def get_extended_dashboard(user = Depends(get_current_user)):
    """Get extended Order dashboard with craft houses, fellowships, and governance"""
    user_id = get_user_id(user)
    client = get_client()

    profile = await get_order_member_profile(user_id)

    if not profile:
        return OrderDashboardStatsExtended(is_order_member=False)

    # Get lodge name
    lodge_name = None
    if profile.get("lodge_id"):
        lodge_result = client.table("order_lodges").select("name").eq(
            "id", profile["lodge_id"]
        ).single().execute()
        if lodge_result.data:
            lodge_name = lodge_result.data["name"]

    # Get craft house memberships
    craft_houses_result = client.table("order_craft_house_memberships").select(
        "*"
    ).eq("user_id", user_id).execute()

    craft_houses = []
    for m in craft_houses_result.data or []:
        # Get craft house name separately
        if m.get("craft_house_id"):
            house_result = client.table("order_craft_houses").select("name").eq("id", m["craft_house_id"]).single().execute()
            m["craft_house_name"] = house_result.data.get("name") if house_result.data else None
        else:
            m["craft_house_name"] = None
        craft_houses.append(CraftHouseMembershipResponse(**m))

    # Get fellowship memberships
    fellowships_result = client.table("order_fellowship_memberships").select(
        "*"
    ).eq("user_id", user_id).execute()

    fellowships = []
    for m in fellowships_result.data or []:
        # Get fellowship name separately
        if m.get("fellowship_id"):
            fellowship_result = client.table("order_fellowships").select("name").eq("id", m["fellowship_id"]).single().execute()
            m["fellowship_name"] = fellowship_result.data.get("name") if fellowship_result.data else None
        else:
            m["fellowship_name"] = None
        fellowships.append(FellowshipMembershipResponse(**m))

    # Get governance positions
    governance_result = client.table("order_governance_positions").select("*").eq(
        "user_id", user_id
    ).eq("is_active", True).execute()

    governance_positions = [GovernancePositionResponse(**p) for p in (governance_result.data or [])]

    # Get pending booking requests
    booking_count = client.table("order_booking_requests").select(
        "id", count="exact"
    ).eq("target_user_id", user_id).eq("status", "pending").execute()

    # Get active job applications
    job_app_count = client.table("order_job_applications").select(
        "id", count="exact"
    ).eq("user_id", user_id).in_("status", ["submitted", "reviewed"]).execute()

    return OrderDashboardStatsExtended(
        is_order_member=True,
        membership_status=profile.get("status"),
        membership_tier=profile.get("membership_tier"),
        dues_status=profile.get("dues_status"),
        primary_track=profile.get("primary_track"),
        lodge_id=profile.get("lodge_id"),
        lodge_name=lodge_name,
        craft_houses=craft_houses,
        fellowships=fellowships,
        joined_at=profile.get("joined_at"),
        pending_booking_requests=booking_count.count or 0,
        active_job_applications=job_app_count.count or 0,
        governance_positions=governance_positions,
    )


# ============ Order Events Endpoints ============

@router.get("/events", response_model=OrderEventListResponse)
async def list_events(
    event_type: Optional[str] = Query(None),
    lodge_id: Optional[int] = Query(None),
    craft_house_id: Optional[int] = Query(None),
    fellowship_id: Optional[int] = Query(None),
    upcoming_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    user = Depends(get_current_user)
):
    """List Order events - available to all Order members"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify user is an Order member
    profile = await get_order_member_profile(user_id)
    if not profile:
        raise HTTPException(status_code=403, detail="Must be an Order member to view events")

    # Build query
    query = client.table("order_events").select("*", count="exact").eq("is_active", True)

    if event_type:
        query = query.eq("event_type", event_type)
    if lodge_id:
        query = query.eq("lodge_id", lodge_id)
    if craft_house_id:
        query = query.eq("craft_house_id", craft_house_id)
    if fellowship_id:
        query = query.eq("fellowship_id", fellowship_id)
    if upcoming_only:
        query = query.gte("start_date", datetime.utcnow().isoformat())

    # Order by start date and paginate
    query = query.order("start_date").range(skip, skip + limit - 1)
    result = query.execute()

    events = []
    for event in result.data or []:
        # Get RSVP count
        rsvp_result = client.table("order_event_rsvps").select(
            "id", count="exact"
        ).eq("event_id", event["id"]).eq("status", "attending").execute()

        # Get user's RSVP status
        user_rsvp = client.table("order_event_rsvps").select("status").eq(
            "event_id", event["id"]
        ).eq("user_id", user_id).execute()

        # Get related names
        lodge_name = None
        if event.get("lodge_id"):
            lodge_result = client.table("order_lodges").select("name").eq(
                "id", event["lodge_id"]
            ).single().execute()
            if lodge_result.data:
                lodge_name = lodge_result.data["name"]

        craft_house_name = None
        if event.get("craft_house_id"):
            ch_result = client.table("order_craft_houses").select("name").eq(
                "id", event["craft_house_id"]
            ).single().execute()
            if ch_result.data:
                craft_house_name = ch_result.data["name"]

        fellowship_name = None
        if event.get("fellowship_id"):
            f_result = client.table("order_fellowships").select("name").eq(
                "id", event["fellowship_id"]
            ).single().execute()
            if f_result.data:
                fellowship_name = f_result.data["name"]

        # Get creator name
        created_by_name = None
        if event.get("created_by"):
            creator_result = client.table("profiles").select("display_name").eq(
                "id", event["created_by"]
            ).single().execute()
            if creator_result.data:
                created_by_name = creator_result.data["display_name"]

        events.append(OrderEventResponse(
            **event,
            lodge_name=lodge_name,
            craft_house_name=craft_house_name,
            fellowship_name=fellowship_name,
            created_by_name=created_by_name,
            rsvp_count=rsvp_result.count or 0,
            user_rsvp_status=user_rsvp.data[0]["status"] if user_rsvp.data else None,
        ))

    return OrderEventListResponse(
        events=events,
        total=result.count or 0,
        skip=skip,
        limit=limit,
    )


@router.get("/events/{event_id}", response_model=OrderEventResponse)
async def get_event(event_id: int, user = Depends(get_current_user)):
    """Get a single Order event by ID"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify user is an Order member
    profile = await get_order_member_profile(user_id)
    if not profile:
        raise HTTPException(status_code=403, detail="Must be an Order member to view events")

    result = client.table("order_events").select("*").eq("id", event_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = result.data

    # Get RSVP count
    rsvp_result = client.table("order_event_rsvps").select(
        "id", count="exact"
    ).eq("event_id", event_id).eq("status", "attending").execute()

    # Get user's RSVP status
    user_rsvp = client.table("order_event_rsvps").select("status").eq(
        "event_id", event_id
    ).eq("user_id", user_id).execute()

    # Get related names
    lodge_name = None
    if event.get("lodge_id"):
        lodge_result = client.table("order_lodges").select("name").eq(
            "id", event["lodge_id"]
        ).single().execute()
        if lodge_result.data:
            lodge_name = lodge_result.data["name"]

    craft_house_name = None
    if event.get("craft_house_id"):
        ch_result = client.table("order_craft_houses").select("name").eq(
            "id", event["craft_house_id"]
        ).single().execute()
        if ch_result.data:
            craft_house_name = ch_result.data["name"]

    fellowship_name = None
    if event.get("fellowship_id"):
        f_result = client.table("order_fellowships").select("name").eq(
            "id", event["fellowship_id"]
        ).single().execute()
        if f_result.data:
            fellowship_name = f_result.data["name"]

    created_by_name = None
    if event.get("created_by"):
        creator_result = client.table("profiles").select("display_name").eq(
            "id", event["created_by"]
        ).single().execute()
        if creator_result.data:
            created_by_name = creator_result.data["display_name"]

    return OrderEventResponse(
        **event,
        lodge_name=lodge_name,
        craft_house_name=craft_house_name,
        fellowship_name=fellowship_name,
        created_by_name=created_by_name,
        rsvp_count=rsvp_result.count or 0,
        user_rsvp_status=user_rsvp.data[0]["status"] if user_rsvp.data else None,
    )


@router.post("/events", response_model=OrderEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(event_data: OrderEventCreate, user = Depends(get_current_user)):
    """Create a new Order event - admins and lodge officers can create events"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify user is an Order member
    profile = await get_order_member_profile(user_id)
    if not profile:
        raise HTTPException(status_code=403, detail="Must be an Order member to create events")

    # Get user profile for admin check
    user_profile = client.table("profiles").select("is_admin, is_staff").eq("id", user_id).single().execute()
    is_user_admin = user_profile.data and (user_profile.data.get("is_admin") or user_profile.data.get("is_staff"))

    # Check if user can create this type of event
    can_create = False

    if is_user_admin:
        can_create = True
    elif event_data.lodge_id:
        # Check if user is a lodge officer for this lodge
        officer_check = client.table("order_lodge_memberships").select("is_officer").eq(
            "user_id", user_id
        ).eq("lodge_id", event_data.lodge_id).eq("is_officer", True).execute()
        can_create = bool(officer_check.data)
    elif event_data.craft_house_id:
        # Check if user is a craft house steward
        steward_check = client.table("order_craft_house_memberships").select("role").eq(
            "user_id", user_id
        ).eq("craft_house_id", event_data.craft_house_id).eq("role", "steward").execute()
        can_create = bool(steward_check.data)
    elif event_data.fellowship_id:
        # Check if user is a fellowship leader
        leader_check = client.table("order_fellowship_memberships").select("role").eq(
            "user_id", user_id
        ).eq("fellowship_id", event_data.fellowship_id).in_("role", ["leader", "coordinator"]).execute()
        can_create = bool(leader_check.data)

    if not can_create:
        raise HTTPException(
            status_code=403,
            detail="You must be an admin or leader of the associated lodge/craft house/fellowship to create events"
        )

    # Create event
    event_dict = event_data.model_dump()
    event_dict["created_by"] = user_id
    event_dict["start_date"] = event_data.start_date.isoformat()
    if event_data.end_date:
        event_dict["end_date"] = event_data.end_date.isoformat()

    result = client.table("order_events").insert(event_dict).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create event")

    event = result.data[0]

    # Get creator name
    created_by_name = None
    creator_result = client.table("profiles").select("display_name").eq("id", user_id).single().execute()
    if creator_result.data:
        created_by_name = creator_result.data["display_name"]

    return OrderEventResponse(
        **event,
        created_by_name=created_by_name,
        rsvp_count=0,
        user_rsvp_status=None,
    )


@router.patch("/events/{event_id}", response_model=OrderEventResponse)
async def update_event(event_id: int, event_data: OrderEventUpdate, user = Depends(get_current_user)):
    """Update an Order event"""
    user_id = get_user_id(user)
    client = get_client()

    # Get the event
    event_result = client.table("order_events").select("*").eq("id", event_id).single().execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = event_result.data

    # Check permissions
    user_profile = client.table("profiles").select("is_admin, is_staff").eq("id", user_id).single().execute()
    is_user_admin = user_profile.data and (user_profile.data.get("is_admin") or user_profile.data.get("is_staff"))

    if not is_user_admin and event.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="You can only update events you created")

    # Update event
    update_dict = event_data.model_dump(exclude_unset=True)
    if "start_date" in update_dict and update_dict["start_date"]:
        update_dict["start_date"] = update_dict["start_date"].isoformat()
    if "end_date" in update_dict and update_dict["end_date"]:
        update_dict["end_date"] = update_dict["end_date"].isoformat()

    if update_dict:
        result = client.table("order_events").update(update_dict).eq("id", event_id).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update event")
        event = result.data[0]

    # Get RSVP count
    rsvp_result = client.table("order_event_rsvps").select(
        "id", count="exact"
    ).eq("event_id", event_id).eq("status", "attending").execute()

    return OrderEventResponse(
        **event,
        rsvp_count=rsvp_result.count or 0,
    )


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: int, user = Depends(get_current_user)):
    """Cancel/delete an Order event"""
    user_id = get_user_id(user)
    client = get_client()

    # Get the event
    event_result = client.table("order_events").select("*").eq("id", event_id).single().execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    event = event_result.data

    # Check permissions
    user_profile = client.table("profiles").select("is_admin, is_staff").eq("id", user_id).single().execute()
    is_user_admin = user_profile.data and (user_profile.data.get("is_admin") or user_profile.data.get("is_staff"))

    if not is_user_admin and event.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="You can only delete events you created")

    # Soft delete by setting is_active to false
    client.table("order_events").update({"is_active": False}).eq("id", event_id).execute()


@router.post("/events/{event_id}/rsvp", response_model=OrderEventRSVPResponse)
async def rsvp_to_event(event_id: int, rsvp_data: OrderEventRSVPCreate, user = Depends(get_current_user)):
    """RSVP to an Order event"""
    user_id = get_user_id(user)
    client = get_client()

    # Verify user is an Order member
    profile = await get_order_member_profile(user_id)
    if not profile:
        raise HTTPException(status_code=403, detail="Must be an Order member to RSVP")

    # Verify event exists and is active
    event_result = client.table("order_events").select("id, max_attendees").eq("id", event_id).eq("is_active", True).single().execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check max attendees if applicable
    if event_result.data.get("max_attendees") and rsvp_data.status == "attending":
        rsvp_count = client.table("order_event_rsvps").select(
            "id", count="exact"
        ).eq("event_id", event_id).eq("status", "attending").execute()
        if rsvp_count.count and rsvp_count.count >= event_result.data["max_attendees"]:
            raise HTTPException(status_code=400, detail="Event is at capacity")

    # Upsert RSVP
    rsvp_dict = {
        "event_id": event_id,
        "user_id": user_id,
        "status": rsvp_data.status,
    }

    result = client.table("order_event_rsvps").upsert(
        rsvp_dict,
        on_conflict="event_id,user_id"
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to RSVP")

    # Get user name
    user_name = None
    user_result = client.table("profiles").select("display_name").eq("id", user_id).single().execute()
    if user_result.data:
        user_name = user_result.data["display_name"]

    return OrderEventRSVPResponse(
        **result.data[0],
        user_name=user_name,
    )


@router.delete("/events/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_rsvp(event_id: int, user = Depends(get_current_user)):
    """Cancel RSVP to an Order event"""
    user_id = get_user_id(user)
    client = get_client()

    client.table("order_event_rsvps").delete().eq("event_id", event_id).eq("user_id", user_id).execute()


@router.get("/events/{event_id}/rsvps", response_model=List[OrderEventRSVPResponse])
async def get_event_rsvps(event_id: int, user = Depends(get_current_user)):
    """Get all RSVPs for an event - available to event creator and admins"""
    user_id = get_user_id(user)
    client = get_client()

    # Get the event
    event_result = client.table("order_events").select("created_by").eq("id", event_id).single().execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permissions
    user_profile = client.table("profiles").select("is_admin, is_staff").eq("id", user_id).single().execute()
    is_user_admin = user_profile.data and (user_profile.data.get("is_admin") or user_profile.data.get("is_staff"))

    if not is_user_admin and event_result.data.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="You can only view RSVPs for events you created")

    result = client.table("order_event_rsvps").select(
        "*, profiles(display_name)"
    ).eq("event_id", event_id).execute()

    rsvps = []
    for rsvp in result.data or []:
        profile_info = rsvp.pop("profiles", {}) or {}
        rsvps.append(OrderEventRSVPResponse(
            **rsvp,
            user_name=profile_info.get("display_name"),
        ))

    return rsvps


# ============ Dues Payment Endpoints ============

ORDER_TIER_PRICE_MAP = {
    MembershipTier.BASE: "STRIPE_ORDER_BASE_PRICE_ID",
    MembershipTier.STEWARD: "STRIPE_ORDER_STEWARD_PRICE_ID",
    MembershipTier.PATRON: "STRIPE_ORDER_PATRON_PRICE_ID",
}


@router.post("/membership/checkout", response_model=MembershipUpgradeResponse)
async def create_dues_checkout(
    request: MembershipUpgradeRequest,
    user=Depends(get_current_user),
):
    """Create a Stripe Checkout session for Order membership dues."""
    from app.core.config import settings
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    user_id = get_user_id(user)
    email = get_user_email(user)
    client = get_client()

    # Must be an approved Order member
    profile = await get_order_member_profile(user_id)
    if not profile:
        raise HTTPException(status_code=403, detail="You must be an Order member to pay dues")

    if profile.get("status") not in (
        OrderMemberStatus.PROBATIONARY.value,
        OrderMemberStatus.ACTIVE.value,
    ):
        raise HTTPException(status_code=400, detail="Your membership status does not allow dues payment")

    # Resolve Stripe price ID for the requested tier
    price_attr = ORDER_TIER_PRICE_MAP.get(request.target_tier)
    if not price_attr:
        raise HTTPException(status_code=400, detail="Invalid membership tier")

    price_id = getattr(settings, price_attr, "")
    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price not configured for Order {request.target_tier.value} tier")

    # Get or create Stripe customer on the user's personal profile
    user_profile = client.table("profiles").select("id, stripe_customer_id").eq("id", user_id).single().execute()
    customer_id = user_profile.data.get("stripe_customer_id") if user_profile.data else None

    if not customer_id:
        customer = stripe.Customer.create(email=email, metadata={"user_id": user_id})
        customer_id = customer.id
        if user_profile.data:
            client.table("profiles").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()

    # Build URLs
    base_url = settings.FRONTEND_URL
    return_path = request.return_url or "/order"
    success_url = f"{base_url}{return_path}?dues=success"
    cancel_url = f"{base_url}{return_path}?dues=cancelled"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "product": "order_dues",
            "tier": request.target_tier.value,
        },
        subscription_data={
            "metadata": {
                "user_id": user_id,
                "product": "order_dues",
                "tier": request.target_tier.value,
            },
        },
    )

    return MembershipUpgradeResponse(checkout_url=session.url, session_id=session.id)


@router.get("/membership/dues", response_model=DuesPaymentListResponse)
async def get_my_dues_payments(user=Depends(get_current_user)):
    """Get current user's dues payment history."""
    user_id = get_user_id(user)
    client = get_client()

    result = client.table("order_dues_payments").select("*").eq(
        "user_id", user_id
    ).order("created_at", desc=True).execute()

    payments = [DuesPaymentResponse(**p) for p in (result.data or [])]
    return DuesPaymentListResponse(payments=payments, total=len(payments))


@router.post("/membership/portal")
async def create_dues_portal_session(user=Depends(get_current_user)):
    """Create a Stripe billing portal session for managing Order dues subscription."""
    from app.core.config import settings
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    user_id = get_user_id(user)
    client = get_client()

    user_profile = client.table("profiles").select("stripe_customer_id").eq("id", user_id).single().execute()
    customer_id = user_profile.data.get("stripe_customer_id") if user_profile.data else None

    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}/order",
    )

    return {"url": session.url}
