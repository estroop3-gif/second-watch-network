"""
Admin Roles API
CRUD endpoints for custom role management
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.database import get_client

router = APIRouter()


async def get_current_user_from_token(token: str) -> Dict[str, Any]:
    """Extract and validate user from token"""
    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "sub": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


class RolePermissions(BaseModel):
    # Legacy/parent permissions
    can_access_backlot: bool = False
    can_access_greenroom: bool = False
    can_access_forum: bool = False
    can_access_community: bool = False
    can_submit_content: bool = False
    can_upload_files: bool = False
    can_create_projects: bool = False
    can_invite_collaborators: bool = False

    # Backlot granular permissions
    backlot_overview: bool = False
    backlot_scripts: bool = False
    backlot_callsheets: bool = False
    backlot_casting: bool = False
    backlot_scenes: bool = False
    backlot_continuity: bool = False
    backlot_hotset: bool = False
    backlot_invoices: bool = False
    backlot_timecards: bool = False
    backlot_expenses: bool = False
    backlot_budget: bool = False
    backlot_team: bool = False
    backlot_files: bool = False
    backlot_coms: bool = False
    backlot_clearances: bool = False
    backlot_credits: bool = False

    # Green Room permissions
    greenroom_cycles: bool = False
    greenroom_submit: bool = False
    greenroom_vote: bool = False
    greenroom_results: bool = False

    # Forum permissions
    forum_read: bool = False
    forum_post: bool = False
    forum_reply: bool = False
    forum_react: bool = False

    # Community permissions
    community_collabs: bool = False
    community_apply_collabs: bool = False
    community_directory: bool = False
    community_connections: bool = False

    # Messaging permissions
    can_access_messages: bool = False
    messages_dm: bool = False
    messages_group: bool = False
    messages_attachments: bool = False

    # Submissions permissions
    can_access_submissions: bool = False
    submissions_create: bool = False
    submissions_view: bool = False

    # Order permissions
    can_access_order: bool = False
    order_directory: bool = False
    order_jobs: bool = False
    order_post_jobs: bool = False
    order_lodges: bool = False
    order_manage_lodge: bool = False

    # Profile permissions
    can_access_profile: bool = True
    profile_edit: bool = True
    profile_availability: bool = False
    profile_resume: bool = False
    profile_filmmaker: bool = False

    # Moderation permissions
    can_moderate: bool = False
    mod_warn_users: bool = False
    mod_mute_users: bool = False
    mod_ban_users: bool = False
    mod_delete_content: bool = False
    mod_review_reports: bool = False
    mod_review_flags: bool = False

    # Admin permissions
    can_admin: bool = False
    admin_users: bool = False
    admin_roles: bool = False
    admin_applications: bool = False
    admin_submissions: bool = False
    admin_greenroom: bool = False
    admin_forum: bool = False
    admin_settings: bool = False
    admin_billing: bool = False
    admin_audit: bool = False


class CreateRoleRequest(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    color: Optional[str] = "#6B7280"
    storage_quota_bytes: Optional[int] = 1073741824  # 1GB default
    permissions: RolePermissions


class UpdateRoleRequest(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    storage_quota_bytes: Optional[int] = None
    permissions: Optional[RolePermissions] = None


async def require_admin(authorization: str) -> dict:
    """Verify user is admin"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization.replace("Bearer ", "")
    user = await get_current_user_from_token(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = user.get("id") or user.get("sub")
    client = get_client()

    profile = client.table("profiles").select("is_admin, is_superadmin").eq("id", user_id).single().execute()

    if not profile.data or not (profile.data.get("is_admin") or profile.data.get("is_superadmin")):
        raise HTTPException(status_code=403, detail="Admin access required")

    return {"id": user_id, **profile.data}


@router.get("/roles")
async def list_roles(authorization: str = Header(None)):
    """List all custom roles with user counts"""
    await require_admin(authorization)

    client = get_client()

    # Get all roles
    roles_result = client.table("custom_roles").select("*").order("is_system_role", desc=True).order("display_name").execute()

    if not roles_result.data:
        return {"roles": []}

    # Get user counts for each role
    roles_with_counts = []
    for role in roles_result.data:
        count_result = client.table("user_roles").select("id", count="exact").eq("role_id", role["id"]).execute()
        role["user_count"] = count_result.count or 0
        roles_with_counts.append(role)

    return {"roles": roles_with_counts}


@router.get("/roles/{role_id}")
async def get_role(role_id: str, authorization: str = Header(None)):
    """Get a single role by ID"""
    await require_admin(authorization)

    client = get_client()

    result = client.table("custom_roles").select("*").eq("id", role_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Get user count
    count_result = client.table("user_roles").select("id", count="exact").eq("role_id", role_id).execute()
    result.data["user_count"] = count_result.count or 0

    return result.data


@router.post("/roles")
async def create_role(data: CreateRoleRequest, authorization: str = Header(None)):
    """Create a new custom role"""
    admin = await require_admin(authorization)

    client = get_client()

    # Check for duplicate name
    existing = client.table("custom_roles").select("id").eq("name", data.name.lower().replace(" ", "_")).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Role name already exists")

    role_data = {
        "name": data.name.lower().replace(" ", "_"),
        "display_name": data.display_name,
        "description": data.description,
        "color": data.color,
        "storage_quota_bytes": data.storage_quota_bytes,
        "is_system_role": False,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        # Copy all permissions from the request
        **data.permissions.model_dump()
    }

    result = client.table("custom_roles").insert(role_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create role")

    return result.data[0]


@router.put("/roles/{role_id}")
async def update_role(role_id: str, data: UpdateRoleRequest, authorization: str = Header(None)):
    """Update an existing role"""
    await require_admin(authorization)

    client = get_client()

    # Get existing role
    existing = client.table("custom_roles").select("*").eq("id", role_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Build update data
    update_data = {"updated_at": datetime.utcnow().isoformat()}

    if data.display_name is not None:
        update_data["display_name"] = data.display_name
    if data.description is not None:
        update_data["description"] = data.description
    if data.color is not None:
        update_data["color"] = data.color
    if data.storage_quota_bytes is not None:
        update_data["storage_quota_bytes"] = data.storage_quota_bytes

    if data.permissions is not None:
        # Copy all permissions from the request
        update_data.update(data.permissions.model_dump())

    result = client.table("custom_roles").update(update_data).eq("id", role_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update role")

    return result.data[0]


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, authorization: str = Header(None)):
    """Delete a custom role (system roles cannot be deleted)"""
    await require_admin(authorization)

    client = get_client()

    # Get existing role
    existing = client.table("custom_roles").select("*").eq("id", role_id).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Role not found")

    if existing.data.get("is_system_role"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")

    # Check if role is assigned to users
    assignments = client.table("user_roles").select("id", count="exact").eq("role_id", role_id).execute()

    if assignments.count and assignments.count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role: {assignments.count} users are assigned to this role"
        )

    # Delete the role
    client.table("custom_roles").delete().eq("id", role_id).execute()

    return {"success": True, "message": "Role deleted"}


@router.post("/roles/{role_id}/assign/{user_id}")
async def assign_role_to_user(role_id: str, user_id: str, authorization: str = Header(None)):
    """Assign a role to a user"""
    admin = await require_admin(authorization)

    client = get_client()

    # Verify role exists
    role = client.table("custom_roles").select("id, name").eq("id", role_id).single().execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Verify user exists
    user = client.table("profiles").select("id").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already assigned
    existing = client.table("user_roles").select("id").eq("user_id", user_id).eq("role_id", role_id).execute()
    if existing.data:
        return {"success": True, "message": "Role already assigned"}

    # Create assignment
    assignment = {
        "user_id": user_id,
        "role_id": role_id,
        "assigned_by": admin["id"],
        "assigned_at": datetime.utcnow().isoformat()
    }

    result = client.table("user_roles").insert(assignment).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to assign role")

    return {"success": True, "message": "Role assigned"}


@router.delete("/roles/{role_id}/unassign/{user_id}")
async def unassign_role_from_user(role_id: str, user_id: str, authorization: str = Header(None)):
    """Remove a role from a user"""
    await require_admin(authorization)

    client = get_client()

    # Delete the assignment
    result = client.table("user_roles").delete().eq("user_id", user_id).eq("role_id", role_id).execute()

    return {"success": True, "message": "Role unassigned"}


@router.get("/roles/{role_id}/users")
async def get_role_users(role_id: str, skip: int = 0, limit: int = 50, authorization: str = Header(None)):
    """Get users assigned to a role"""
    await require_admin(authorization)

    client = get_client()

    # Verify role exists
    role = client.table("custom_roles").select("id, display_name").eq("id", role_id).single().execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Get user assignments with profile data
    result = client.table("user_roles").select(
        "id, assigned_at, user_id, profiles(id, display_name, email, avatar_url)"
    ).eq("role_id", role_id).range(skip, skip + limit - 1).execute()

    # Get total count
    count_result = client.table("user_roles").select("id", count="exact").eq("role_id", role_id).execute()

    return {
        "role": role.data,
        "users": result.data or [],
        "total": count_result.count or 0
    }


@router.get("/users/{user_id}/roles")
async def get_user_roles(user_id: str, authorization: str = Header(None)):
    """Get all roles assigned to a user"""
    await require_admin(authorization)

    client = get_client()

    result = client.table("user_roles").select(
        "id, assigned_at, role_id, custom_roles(*)"
    ).eq("user_id", user_id).execute()

    return {"roles": result.data or []}


@router.put("/users/{user_id}/roles")
async def update_user_roles(user_id: str, role_ids: List[str], authorization: str = Header(None)):
    """Set user's roles (replaces all existing role assignments)"""
    admin = await require_admin(authorization)

    client = get_client()

    # Verify user exists
    user = client.table("profiles").select("id").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify all roles exist
    if role_ids:
        roles = client.table("custom_roles").select("id").in_("id", role_ids).execute()
        if len(roles.data or []) != len(role_ids):
            raise HTTPException(status_code=400, detail="One or more roles not found")

    # Delete existing assignments
    client.table("user_roles").delete().eq("user_id", user_id).execute()

    # Create new assignments
    if role_ids:
        assignments = [
            {
                "user_id": user_id,
                "role_id": role_id,
                "assigned_by": admin["id"],
                "assigned_at": datetime.utcnow().isoformat()
            }
            for role_id in role_ids
        ]
        client.table("user_roles").insert(assignments).execute()

    return {"success": True, "message": "User roles updated"}
