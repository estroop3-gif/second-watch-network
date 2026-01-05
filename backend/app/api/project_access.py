"""
Project Access API - Team & Access management for Backlot projects
Handles project members, roles, view profiles, and per-user permission overrides
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.database import get_client, execute_single
from app.core.backlot_permissions import (
    get_effective_view_config,
    can_manage_access,
    get_all_backlot_roles,
    get_default_config_for_role,
    DEFAULT_VIEW_CONFIGS,
)

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> str:
    """
    Look up the profile ID from a Cognito user ID.
    Returns the profile ID or None if not found.
    """
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)
    # First try cognito_user_id (preferred, exact match)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    # Fallback: check if it's already a profile ID
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if not profile_row:
        return None
    return str(profile_row["id"])


# =============================================================================
# MODELS
# =============================================================================

class PermissionValue(BaseModel):
    view: bool = False
    edit: bool = False


class ViewConfig(BaseModel):
    tabs: Dict[str, PermissionValue] = {}
    sections: Dict[str, PermissionValue] = {}


class ProjectMember(BaseModel):
    id: str
    project_id: str
    user_id: str
    role: str  # owner, admin, editor, viewer
    production_role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    invited_by: Optional[str] = None
    joined_at: str
    # Profile info
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None
    user_username: Optional[str] = None


class ProjectRole(BaseModel):
    id: str
    project_id: str
    user_id: str
    backlot_role: str
    is_primary: bool = False
    created_at: str


class MemberWithRoles(ProjectMember):
    backlot_roles: List[str] = []
    primary_role: Optional[str] = None
    has_overrides: bool = False


class ViewProfile(BaseModel):
    id: str
    project_id: str
    backlot_role: str
    label: str
    is_default: bool = False
    config: Dict[str, Any] = {}
    created_by_user_id: str
    created_at: str
    updated_at: str


class ViewOverride(BaseModel):
    id: str
    project_id: str
    user_id: str
    config: Dict[str, Any] = {}
    created_at: str
    updated_at: str
    # Computed
    user_name: Optional[str] = None


class EffectiveConfig(BaseModel):
    role: str
    is_owner: bool = False
    has_overrides: bool = False
    tabs: Dict[str, Dict[str, bool]] = {}
    sections: Dict[str, Dict[str, bool]] = {}


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "viewer"  # owner, admin, editor, viewer
    backlot_role: Optional[str] = None  # showrunner, producer, etc.
    production_role: Optional[str] = None
    department: Optional[str] = None


class UpdateMemberRequest(BaseModel):
    role: Optional[str] = None
    production_role: Optional[str] = None
    department: Optional[str] = None


class AssignRoleRequest(BaseModel):
    user_id: str
    backlot_role: str
    is_primary: bool = False


class RemoveRoleRequest(BaseModel):
    user_id: str
    backlot_role: str


class UpdateViewProfileRequest(BaseModel):
    config: Dict[str, Any]
    label: Optional[str] = None


class UpdateOverrideRequest(BaseModel):
    config: Dict[str, Any]


class RolePreset(BaseModel):
    role: str
    label: str
    config: Dict[str, Any]


class AddMemberFromContactRequest(BaseModel):
    contact_id: str
    role: str = "viewer"  # owner, admin, editor, viewer
    backlot_role: Optional[str] = None  # showrunner, producer, etc.


class UnifiedPerson(BaseModel):
    """Unified view of a person (team member, contact, or both)"""
    id: str  # Primary identifier
    source: str  # 'team', 'contact', or 'both'
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    # Team member fields
    access_role: Optional[str] = None  # owner, admin, editor, viewer
    backlot_roles: List[str] = []
    primary_role: Optional[str] = None
    user_avatar: Optional[str] = None
    user_username: Optional[str] = None
    # Contact fields
    contact_type: Optional[str] = None
    contact_status: Optional[str] = None
    company: Optional[str] = None
    role_interest: Optional[str] = None
    # Relationship identifiers
    is_team_member: bool = False
    has_account: bool = False  # has user_id
    contact_id: Optional[str] = None
    member_id: Optional[str] = None
    user_id: Optional[str] = None


class UnifiedPeopleResponse(BaseModel):
    team: List[MemberWithRoles]
    contacts: List[Dict[str, Any]]
    unified: List[UnifiedPerson]


# Role interest to backlot role mapping
ROLE_INTEREST_MAPPING = {
    "producer": "producer",
    "line producer": "producer",
    "executive producer": "producer",
    "director": "director",
    "1st ad": "first_ad",
    "first ad": "first_ad",
    "ad": "first_ad",
    "assistant director": "first_ad",
    "dp": "dp",
    "cinematographer": "dp",
    "director of photography": "dp",
    "camera": "dp",
    "editor": "editor",
    "post": "editor",
    "post production": "editor",
    "script supervisor": "script_supervisor",
    "scripter": "script_supervisor",
    "department head": "department_head",
    "key": "department_head",
    "showrunner": "showrunner",
}


def suggest_backlot_role(role_interest: Optional[str]) -> Optional[str]:
    """Suggest a backlot role based on contact's role_interest"""
    if not role_interest:
        return None
    role_lower = role_interest.lower().strip()
    # Check direct mappings
    if role_lower in ROLE_INTEREST_MAPPING:
        return ROLE_INTEREST_MAPPING[role_lower]
    # Check partial matches
    for key, value in ROLE_INTEREST_MAPPING.items():
        if key in role_lower or role_lower in key:
            return value
    return "crew"  # Default


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:

        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# =============================================================================
# MEMBER MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/access/members", response_model=List[MemberWithRoles])
async def list_project_members(
    project_id: str,
    authorization: str = Header(None)
):
    """
    List all project members with their roles and permission status
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get project info first
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    owner_id = str(project_resp.data[0]["owner_id"])

    # Get all members (without profile join - avoid PostgREST schema cache issues)
    members_resp = client.table("backlot_project_members").select("*").eq(
        "project_id", project_id
    ).order("joined_at").execute()

    members = members_resp.data or []

    # Collect all user IDs we need profiles for (convert to strings)
    member_user_ids = [str(m["user_id"]) for m in members]
    all_user_ids = list(set(member_user_ids + [owner_id]))

    # Fetch all profiles in a single query
    profiles_by_id: Dict[str, Dict] = {}
    if all_user_ids:
        profiles_resp = client.table("profiles").select(
            "id, full_name, avatar_url, username"
        ).in_("id", all_user_ids).execute()
        for p in (profiles_resp.data or []):
            profiles_by_id[str(p["id"])] = p

    # Get all backlot roles for this project
    roles_resp = client.table("backlot_project_roles").select("*").eq("project_id", project_id).execute()
    roles_by_user: Dict[str, List[Dict]] = {}
    for r in (roles_resp.data or []):
        uid = str(r["user_id"])
        if uid not in roles_by_user:
            roles_by_user[uid] = []
        roles_by_user[uid].append(r)

    # Get all user overrides
    overrides_resp = client.table("backlot_project_view_overrides").select("user_id").eq("project_id", project_id).execute()
    users_with_overrides = set(str(o["user_id"]) for o in (overrides_resp.data or []))

    result = []

    # Add owner first if not in members
    owner_in_members = any(str(m["user_id"]) == owner_id for m in members)
    if not owner_in_members:
        owner_profile = profiles_by_id.get(owner_id, {})

        owner_roles = roles_by_user.get(owner_id, [])
        primary_role = next((r["backlot_role"] for r in owner_roles if r.get("is_primary")), None)
        if not primary_role and owner_roles:
            primary_role = owner_roles[0]["backlot_role"]

        result.append(MemberWithRoles(
            id="owner",
            project_id=project_id,
            user_id=owner_id,
            role="owner",
            joined_at=datetime.utcnow().isoformat(),
            user_name=owner_profile.get("full_name"),
            user_avatar=owner_profile.get("avatar_url"),
            user_username=owner_profile.get("username"),
            backlot_roles=[r["backlot_role"] for r in owner_roles],
            primary_role=primary_role or "showrunner",
            has_overrides=owner_id in users_with_overrides,
        ))

    # Add regular members
    for m in members:
        user_id_str = str(m["user_id"])
        profile = profiles_by_id.get(user_id_str, {})
        user_roles = roles_by_user.get(user_id_str, [])
        primary_role = next((r["backlot_role"] for r in user_roles if r.get("is_primary")), None)
        if not primary_role and user_roles:
            primary_role = user_roles[0]["backlot_role"]

        # Owner flag for members who are also owners
        member_role = "owner" if str(m["user_id"]) == owner_id else m.get("role", "viewer")

        # Convert UUID and datetime to strings
        member_id = str(m["id"]) if m.get("id") else ""
        member_project_id = str(m["project_id"]) if m.get("project_id") else project_id
        member_user_id = str(m["user_id"]) if m.get("user_id") else ""
        joined_at = m.get("joined_at", "")
        if hasattr(joined_at, 'isoformat'):
            joined_at = joined_at.isoformat()
        elif joined_at is None:
            joined_at = ""

        result.append(MemberWithRoles(
            id=member_id,
            project_id=member_project_id,
            user_id=member_user_id,
            role=member_role,
            production_role=m.get("production_role"),
            department=m.get("department"),
            phone=m.get("phone"),
            email=m.get("email"),
            invited_by=str(m["invited_by"]) if m.get("invited_by") else None,
            joined_at=joined_at,
            user_name=profile.get("full_name"),
            user_avatar=profile.get("avatar_url"),
            user_username=profile.get("username"),
            backlot_roles=[r["backlot_role"] for r in user_roles],
            primary_role=primary_role,
            has_overrides=member_user_id in users_with_overrides,
        ))

    return result


@router.post("/projects/{project_id}/access/members", response_model=MemberWithRoles)
async def add_member(
    project_id: str,
    request: AddMemberRequest,
    authorization: str = Header(None)
):
    """
    Add a new member to the project
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage team access")

    # Check if user is already a member
    existing_resp = client.table("backlot_project_members").select("id").eq(
        "project_id", project_id
    ).eq("user_id", request.user_id).execute()

    if existing_resp.data:
        raise HTTPException(status_code=400, detail="User is already a member of this project")

    # Add member
    member_data = {
        "project_id": project_id,
        "user_id": request.user_id,
        "role": request.role,
        "production_role": request.production_role,
        "department": request.department,
        "invited_by": profile_id,
    }

    create_resp = client.table("backlot_project_members").insert(member_data).execute()
    if not create_resp.data:
        raise HTTPException(status_code=500, detail="Failed to add member")

    member = create_resp.data[0]

    # Assign backlot role if provided
    if request.backlot_role:
        role_resp = client.table("backlot_project_roles").insert({
            "project_id": project_id,
            "user_id": request.user_id,
            "backlot_role": request.backlot_role,
            "is_primary": True,
        }).execute()

    # Get profile info
    profile_resp = client.table("profiles").select("full_name, avatar_url, username").eq("id", request.user_id).execute()
    profile = profile_resp.data[0] if profile_resp.data else {}

    return MemberWithRoles(
        id=member["id"],
        project_id=member["project_id"],
        user_id=member["user_id"],
        role=member["role"],
        production_role=member.get("production_role"),
        department=member.get("department"),
        invited_by=member.get("invited_by"),
        joined_at=member.get("joined_at", ""),
        user_name=profile.get("full_name"),
        user_avatar=profile.get("avatar_url"),
        user_username=profile.get("username"),
        backlot_roles=[request.backlot_role] if request.backlot_role else [],
        primary_role=request.backlot_role,
        has_overrides=False,
    )


@router.patch("/projects/{project_id}/access/members/{member_id}")
async def update_member(
    project_id: str,
    member_id: str,
    request: UpdateMemberRequest,
    authorization: str = Header(None)
):
    """
    Update a member's project role or info
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage team access")

    update_data = {}
    if request.role is not None:
        update_data["role"] = request.role
    if request.production_role is not None:
        update_data["production_role"] = request.production_role
    if request.department is not None:
        update_data["department"] = request.department

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    update_resp = client.table("backlot_project_members").update(update_data).eq(
        "id", member_id
    ).eq("project_id", project_id).execute()

    if not update_resp.data:
        raise HTTPException(status_code=404, detail="Member not found")

    return {"success": True}


@router.delete("/projects/{project_id}/access/members/{member_id}")
async def remove_member(
    project_id: str,
    member_id: str,
    authorization: str = Header(None)
):
    """
    Remove a member from the project
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage team access")

    # Get member to check if they're the owner
    member_resp = client.table("backlot_project_members").select("user_id").eq(
        "id", member_id
    ).eq("project_id", project_id).execute()

    if not member_resp.data:
        raise HTTPException(status_code=404, detail="Member not found")

    member_user_id = member_resp.data[0]["user_id"]

    # Check if trying to remove owner
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == member_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove project owner")

    # Delete member and their roles/overrides
    client.table("backlot_project_members").delete().eq("id", member_id).execute()
    client.table("backlot_project_roles").delete().eq("project_id", project_id).eq("user_id", member_user_id).execute()
    client.table("backlot_project_view_overrides").delete().eq("project_id", project_id).eq("user_id", member_user_id).execute()

    return {"success": True}


# =============================================================================
# ROLE ASSIGNMENT ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/access/roles")
async def assign_role(
    project_id: str,
    request: AssignRoleRequest,
    authorization: str = Header(None)
):
    """
    Assign a Backlot role to a user
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage roles")

    # Validate role
    valid_roles = await get_all_backlot_roles()
    if request.backlot_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    # Check if role already assigned
    existing_resp = client.table("backlot_project_roles").select("id, is_primary").eq(
        "project_id", project_id
    ).eq("user_id", request.user_id).eq("backlot_role", request.backlot_role).execute()

    if existing_resp.data:
        # Update primary status if different
        if existing_resp.data[0]["is_primary"] != request.is_primary:
            if request.is_primary:
                # Clear other primary flags for this user
                client.table("backlot_project_roles").update({"is_primary": False}).eq(
                    "project_id", project_id
                ).eq("user_id", request.user_id).execute()

            client.table("backlot_project_roles").update({"is_primary": request.is_primary}).eq(
                "id", existing_resp.data[0]["id"]
            ).execute()

        return {"success": True, "message": "Role updated"}

    # If setting as primary, clear other primary flags
    if request.is_primary:
        client.table("backlot_project_roles").update({"is_primary": False}).eq(
            "project_id", project_id
        ).eq("user_id", request.user_id).execute()

    # Create role assignment
    create_resp = client.table("backlot_project_roles").insert({
        "project_id": project_id,
        "user_id": request.user_id,
        "backlot_role": request.backlot_role,
        "is_primary": request.is_primary,
    }).execute()

    if not create_resp.data:
        raise HTTPException(status_code=500, detail="Failed to assign role")

    return {"success": True}


@router.delete("/projects/{project_id}/access/roles")
async def remove_role(
    project_id: str,
    request: RemoveRoleRequest,
    authorization: str = Header(None)
):
    """
    Remove a Backlot role from a user
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage roles")

    client.table("backlot_project_roles").delete().eq(
        "project_id", project_id
    ).eq("user_id", request.user_id).eq("backlot_role", request.backlot_role).execute()

    return {"success": True}


# =============================================================================
# VIEW PROFILE ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/access/profiles", response_model=List[ViewProfile])
async def list_view_profiles(
    project_id: str,
    authorization: str = Header(None)
):
    """
    List all custom view profiles for the project
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to view profiles")

    profiles_resp = client.table("backlot_project_view_profiles").select("*").eq(
        "project_id", project_id
    ).order("backlot_role").execute()

    return [ViewProfile(**p) for p in (profiles_resp.data or [])]


@router.get("/projects/{project_id}/access/profiles/defaults")
async def get_default_profiles(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get the default view config presets for all roles
    """
    user = await get_current_user_from_token(authorization)

    presets = []
    for role in await get_all_backlot_roles():
        config = await get_default_config_for_role(role)
        presets.append({
            "role": role,
            "label": role.replace("_", " ").title(),
            "config": config,
        })

    return presets


@router.put("/projects/{project_id}/access/profiles/{role}")
async def update_view_profile(
    project_id: str,
    role: str,
    request: UpdateViewProfileRequest,
    authorization: str = Header(None)
):
    """
    Update or create a custom view profile for a role
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage profiles")

    # Validate role
    valid_roles = await get_all_backlot_roles()
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role")

    # Check for existing profile
    existing_resp = client.table("backlot_project_view_profiles").select("id").eq(
        "project_id", project_id
    ).eq("backlot_role", role).eq("is_default", True).execute()

    profile_data = {
        "config": request.config,
        "label": request.label or role.replace("_", " ").title(),
    }

    if existing_resp.data:
        # Update existing
        update_resp = client.table("backlot_project_view_profiles").update(profile_data).eq(
            "id", existing_resp.data[0]["id"]
        ).execute()
        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to update profile")
        return ViewProfile(**update_resp.data[0])
    else:
        # Create new
        profile_data.update({
            "project_id": project_id,
            "backlot_role": role,
            "is_default": True,
            "created_by_user_id": profile_id,
        })
        create_resp = client.table("backlot_project_view_profiles").insert(profile_data).execute()
        if not create_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create profile")
        return ViewProfile(**create_resp.data[0])


@router.delete("/projects/{project_id}/access/profiles/{role}")
async def delete_view_profile(
    project_id: str,
    role: str,
    authorization: str = Header(None)
):
    """
    Delete a custom view profile (reverts to system defaults)
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage profiles")

    client.table("backlot_project_view_profiles").delete().eq(
        "project_id", project_id
    ).eq("backlot_role", role).execute()

    return {"success": True}


# =============================================================================
# USER OVERRIDE ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/access/overrides", response_model=List[ViewOverride])
async def list_overrides(
    project_id: str,
    authorization: str = Header(None)
):
    """
    List all per-user view overrides for the project
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to view overrides")

    # Get overrides without profile join (avoid PostgREST schema cache issues)
    overrides_resp = client.table("backlot_project_view_overrides").select("*").eq(
        "project_id", project_id
    ).execute()

    overrides = overrides_resp.data or []

    # Fetch profiles separately
    user_ids = [o["user_id"] for o in overrides]
    profiles_by_id: Dict[str, Dict] = {}
    if user_ids:
        profiles_resp = client.table("profiles").select("id, full_name").in_("id", user_ids).execute()
        for p in (profiles_resp.data or []):
            profiles_by_id[p["id"]] = p

    result = []
    for o in overrides:
        profile = profiles_by_id.get(o["user_id"], {})
        result.append(ViewOverride(
            id=o["id"],
            project_id=o["project_id"],
            user_id=o["user_id"],
            config=o.get("config", {}),
            created_at=o.get("created_at", ""),
            updated_at=o.get("updated_at", ""),
            user_name=profile.get("full_name"),
        ))

    return result


@router.get("/projects/{project_id}/access/overrides/{user_id}", response_model=ViewOverride)
async def get_user_override(
    project_id: str,
    user_id: str,
    authorization: str = Header(None)
):
    """
    Get a specific user's override config
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    # Users can view their own override, admins can view any
    if user_id != profile_id and not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get override without profile join (avoid PostgREST schema cache issues)
    override_resp = client.table("backlot_project_view_overrides").select("*").eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()

    if not override_resp.data:
        raise HTTPException(status_code=404, detail="No override found for this user")

    o = override_resp.data[0]

    # Fetch profile separately
    profile_resp = client.table("profiles").select("full_name").eq("id", user_id).execute()
    profile = profile_resp.data[0] if profile_resp.data else {}

    return ViewOverride(
        id=o["id"],
        project_id=o["project_id"],
        user_id=o["user_id"],
        config=o.get("config", {}),
        created_at=o.get("created_at", ""),
        updated_at=o.get("updated_at", ""),
        user_name=profile.get("full_name"),
    )


@router.put("/projects/{project_id}/access/overrides/{user_id}")
async def update_user_override(
    project_id: str,
    user_id: str,
    request: UpdateOverrideRequest,
    authorization: str = Header(None)
):
    """
    Create or update a user's permission overrides
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage overrides")

    # Check if override exists
    existing_resp = client.table("backlot_project_view_overrides").select("id").eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()

    if existing_resp.data:
        # Update existing
        update_resp = client.table("backlot_project_view_overrides").update({
            "config": request.config
        }).eq("id", existing_resp.data[0]["id"]).execute()

        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to update override")
        return {"success": True, "id": update_resp.data[0]["id"]}
    else:
        # Create new
        create_resp = client.table("backlot_project_view_overrides").insert({
            "project_id": project_id,
            "user_id": user_id,
            "config": request.config,
        }).execute()

        if not create_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create override")
        return {"success": True, "id": create_resp.data[0]["id"]}


@router.delete("/projects/{project_id}/access/overrides/{user_id}")
async def delete_user_override(
    project_id: str,
    user_id: str,
    authorization: str = Header(None)
):
    """
    Delete a user's permission overrides (revert to role defaults)
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage overrides")

    client.table("backlot_project_view_overrides").delete().eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()

    return {"success": True}


# =============================================================================
# EFFECTIVE CONFIG ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/access/effective-config", response_model=EffectiveConfig)
async def get_my_effective_config(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get the current user's effective view config for the project
    """
    user = await get_current_user_from_token(authorization)

    # Convert Cognito user ID to profile ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    config = await get_effective_view_config(project_id, profile_id)

    return EffectiveConfig(
        role=config.get("role", "crew"),
        is_owner=config.get("is_owner", False),
        has_overrides=config.get("has_overrides", False),
        tabs=config.get("tabs", {}),
        sections=config.get("sections", {}),
    )


@router.get("/projects/{project_id}/access/effective-config/{user_id}", response_model=EffectiveConfig)
async def get_user_effective_config(
    project_id: str,
    user_id: str,
    authorization: str = Header(None)
):
    """
    Get a specific user's effective view config (admin only)
    """
    user = await get_current_user_from_token(authorization)

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied")

    config = await get_effective_view_config(project_id, user_id)

    return EffectiveConfig(
        role=config.get("role", "crew"),
        is_owner=config.get("is_owner", False),
        has_overrides=config.get("has_overrides", False),
        tabs=config.get("tabs", {}),
        sections=config.get("sections", {}),
    )


@router.get("/projects/{project_id}/access/preview/{role}", response_model=EffectiveConfig)
async def preview_role_config(
    project_id: str,
    role: str,
    authorization: str = Header(None)
):
    """
    Preview what a user with a specific role would see (view as role)
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get project-specific profile if exists
    profile_resp = client.table("backlot_project_view_profiles").select("config").eq(
        "project_id", project_id
    ).eq("backlot_role", role).eq("is_default", True).execute()

    if profile_resp.data:
        config = profile_resp.data[0]["config"]
    else:
        config = await get_default_config_for_role(role)

    return EffectiveConfig(
        role=role,
        is_owner=False,
        has_overrides=False,
        tabs=config.get("tabs", {}),
        sections=config.get("sections", {}),
    )


# =============================================================================
# UNIFIED PEOPLE ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/people", response_model=UnifiedPeopleResponse)
async def get_unified_people(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get unified view of all people associated with the project.
    Combines team members and contacts, de-duplicating where user_id matches.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify project exists
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    owner_id = str(project_resp.data[0]["owner_id"])

    # Get all team members (reuse existing logic)
    members_resp = client.table("backlot_project_members").select("*").eq(
        "project_id", project_id
    ).order("joined_at").execute()
    members = members_resp.data or []

    # Collect all user IDs for profile lookup
    member_user_ids = [str(m["user_id"]) for m in members]
    all_user_ids = list(set(member_user_ids + [owner_id]))

    # Fetch all profiles
    profiles_by_id: Dict[str, Dict] = {}
    if all_user_ids:
        profiles_resp = client.table("profiles").select(
            "id, full_name, avatar_url, username"
        ).in_("id", all_user_ids).execute()
        for p in (profiles_resp.data or []):
            profiles_by_id[str(p["id"])] = p

    # Get all backlot roles for this project
    roles_resp = client.table("backlot_project_roles").select("*").eq("project_id", project_id).execute()
    roles_by_user: Dict[str, List[Dict]] = {}
    for r in (roles_resp.data or []):
        uid = str(r["user_id"])
        if uid not in roles_by_user:
            roles_by_user[uid] = []
        roles_by_user[uid].append(r)

    # Get all user overrides
    overrides_resp = client.table("backlot_project_view_overrides").select("user_id").eq("project_id", project_id).execute()
    users_with_overrides = set(str(o["user_id"]) for o in (overrides_resp.data or []))

    # Build team member list
    team_members: List[MemberWithRoles] = []
    team_by_user_id: Dict[str, MemberWithRoles] = {}

    # Add owner first if not in members
    owner_in_members = any(str(m["user_id"]) == owner_id for m in members)
    if not owner_in_members:
        owner_profile = profiles_by_id.get(owner_id, {})
        owner_roles = roles_by_user.get(owner_id, [])
        primary_role = next((r["backlot_role"] for r in owner_roles if r.get("is_primary")), None)
        if not primary_role and owner_roles:
            primary_role = owner_roles[0]["backlot_role"]

        owner_member = MemberWithRoles(
            id="owner",
            project_id=project_id,
            user_id=owner_id,
            role="owner",
            joined_at=datetime.utcnow().isoformat(),
            user_name=owner_profile.get("full_name"),
            user_avatar=owner_profile.get("avatar_url"),
            user_username=owner_profile.get("username"),
            backlot_roles=[r["backlot_role"] for r in owner_roles],
            primary_role=primary_role or "showrunner",
            has_overrides=owner_id in users_with_overrides,
        )
        team_members.append(owner_member)
        team_by_user_id[owner_id] = owner_member

    # Add regular members
    for m in members:
        user_id_str = str(m["user_id"])
        profile = profiles_by_id.get(user_id_str, {})
        user_roles = roles_by_user.get(user_id_str, [])
        primary_role = next((r["backlot_role"] for r in user_roles if r.get("is_primary")), None)
        if not primary_role and user_roles:
            primary_role = user_roles[0]["backlot_role"]

        member_role = "owner" if user_id_str == owner_id else m.get("role", "viewer")

        # Convert UUID and datetime to strings
        member_id = str(m["id"]) if m.get("id") else ""
        joined_at = m.get("joined_at", "")
        if hasattr(joined_at, 'isoformat'):
            joined_at = joined_at.isoformat()
        elif joined_at is None:
            joined_at = ""

        member = MemberWithRoles(
            id=member_id,
            project_id=project_id,
            user_id=user_id_str,
            role=member_role,
            production_role=m.get("production_role"),
            department=m.get("department"),
            phone=m.get("phone"),
            email=m.get("email"),
            invited_by=str(m["invited_by"]) if m.get("invited_by") else None,
            joined_at=joined_at,
            user_name=profile.get("full_name"),
            user_avatar=profile.get("avatar_url"),
            user_username=profile.get("username"),
            backlot_roles=[r["backlot_role"] for r in user_roles],
            primary_role=primary_role,
            has_overrides=user_id_str in users_with_overrides,
        )
        team_members.append(member)
        team_by_user_id[user_id_str] = member

    # Get all contacts
    contacts_resp = client.table("backlot_project_contacts").select("*").eq(
        "project_id", project_id
    ).order("created_at", desc=True).execute()
    contacts = contacts_resp.data or []

    # Build unified list
    unified_people: List[UnifiedPerson] = []
    processed_user_ids: set = set()

    # First, add all team members to unified list
    for member in team_members:
        unified_people.append(UnifiedPerson(
            id=f"team_{member.user_id}",
            source="team",
            name=member.user_name or "Unknown",
            email=member.email,
            phone=member.phone,
            access_role=member.role,
            backlot_roles=member.backlot_roles,
            primary_role=member.primary_role,
            user_avatar=member.user_avatar,
            user_username=member.user_username,
            is_team_member=True,
            has_account=True,
            member_id=member.id,
            user_id=member.user_id,
        ))
        processed_user_ids.add(member.user_id)

    # Then add contacts, merging if they're also team members
    for contact in contacts:
        contact_user_id = str(contact["user_id"]) if contact.get("user_id") else None

        if contact_user_id and contact_user_id in processed_user_ids:
            # This contact is also a team member - update the unified entry to 'both'
            for up in unified_people:
                if up.user_id == contact_user_id:
                    up.source = "both"
                    up.contact_id = str(contact["id"])
                    up.contact_type = contact.get("contact_type")
                    up.contact_status = contact.get("status")
                    up.company = contact.get("company")
                    up.role_interest = contact.get("role_interest")
                    # Prefer team member email/phone if available
                    if not up.email:
                        up.email = contact.get("email")
                    if not up.phone:
                        up.phone = contact.get("phone")
                    break
        else:
            # Pure contact (not a team member)
            unified_people.append(UnifiedPerson(
                id=f"contact_{contact['id']}",
                source="contact",
                name=contact.get("name", "Unknown"),
                email=contact.get("email"),
                phone=contact.get("phone"),
                contact_type=contact.get("contact_type"),
                contact_status=contact.get("status"),
                company=contact.get("company"),
                role_interest=contact.get("role_interest"),
                is_team_member=False,
                has_account=bool(contact_user_id),
                contact_id=str(contact["id"]),
                user_id=contact_user_id,
            ))

    return UnifiedPeopleResponse(
        team=team_members,
        contacts=contacts,
        unified=unified_people,
    )


@router.post("/projects/{project_id}/access/members/from-contact", response_model=MemberWithRoles)
async def add_member_from_contact(
    project_id: str,
    request: AddMemberFromContactRequest,
    authorization: str = Header(None)
):
    """
    Convert a contact to a team member.
    The contact must have a user_id (linked to a system account).
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Convert Cognito user ID to profile ID for permission check
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not await can_manage_access(project_id, profile_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage team access")

    # Get the contact
    contact_resp = client.table("backlot_project_contacts").select("*").eq(
        "id", request.contact_id
    ).eq("project_id", project_id).execute()

    if not contact_resp.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact = contact_resp.data[0]

    # Verify contact has a linked user account
    if not contact.get("user_id"):
        raise HTTPException(
            status_code=400,
            detail="This contact is not linked to a user account. They must first create an account or be linked to an existing user."
        )

    contact_user_id = str(contact["user_id"])

    # Check if user is already a team member
    existing_resp = client.table("backlot_project_members").select("id").eq(
        "project_id", project_id
    ).eq("user_id", contact_user_id).execute()

    if existing_resp.data:
        raise HTTPException(status_code=400, detail="This person is already a team member")

    # Determine backlot role - use provided, or suggest from role_interest
    backlot_role = request.backlot_role
    if not backlot_role:
        backlot_role = suggest_backlot_role(contact.get("role_interest"))

    # Add as team member
    member_data = {
        "project_id": project_id,
        "user_id": contact_user_id,
        "role": request.role,
        "production_role": contact.get("role_interest"),  # Use role_interest as production_role
        "phone": contact.get("phone"),
        "email": contact.get("email"),
        "invited_by": user["id"],
    }

    create_resp = client.table("backlot_project_members").insert(member_data).execute()
    if not create_resp.data:
        raise HTTPException(status_code=500, detail="Failed to add member")

    member = create_resp.data[0]

    # Assign backlot role if we have one
    if backlot_role:
        client.table("backlot_project_roles").insert({
            "project_id": project_id,
            "user_id": contact_user_id,
            "backlot_role": backlot_role,
            "is_primary": True,
        }).execute()

    # Update contact status to "confirmed"
    client.table("backlot_project_contacts").update({
        "status": "confirmed"
    }).eq("id", request.contact_id).execute()

    # Get profile info
    profile_resp = client.table("profiles").select("full_name, avatar_url, username").eq("id", contact_user_id).execute()
    profile = profile_resp.data[0] if profile_resp.data else {}

    return MemberWithRoles(
        id=str(member["id"]),
        project_id=str(member["project_id"]),
        user_id=str(member["user_id"]),
        role=member["role"],
        production_role=member.get("production_role"),
        phone=member.get("phone"),
        email=member.get("email"),
        invited_by=str(member["invited_by"]) if member.get("invited_by") else None,
        joined_at=member.get("joined_at", ""),
        user_name=profile.get("full_name") or contact.get("name"),
        user_avatar=profile.get("avatar_url"),
        user_username=profile.get("username"),
        backlot_roles=[backlot_role] if backlot_role else [],
        primary_role=backlot_role,
        has_overrides=False,
    )


@router.get("/projects/{project_id}/people/suggest-role")
async def suggest_role_for_contact(
    project_id: str,
    contact_id: str = Query(...),
    authorization: str = Header(None)
):
    """
    Get a suggested backlot role for a contact based on their role_interest
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get the contact
    contact_resp = client.table("backlot_project_contacts").select("role_interest").eq(
        "id", contact_id
    ).eq("project_id", project_id).execute()

    if not contact_resp.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    role_interest = contact_resp.data[0].get("role_interest")
    suggested_role = suggest_backlot_role(role_interest)

    return {
        "role_interest": role_interest,
        "suggested_role": suggested_role,
    }
