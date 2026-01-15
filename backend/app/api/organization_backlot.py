"""
Organization Backlot API

Manages organization-based Backlot access including:
- Backlot seat management (owner, admin, collaborative)
- Project access for collaborative seats
- Organization Backlot projects
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update, get_client
from app.core.logging import get_logger
from app.api.users import get_profile_id_from_cognito_id

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class BacklotSeatCreate(BaseModel):
    """Add a Backlot seat to organization."""
    user_id: str
    role: str = Field(default="collaborative", pattern="^(owner|admin|collaborative)$")
    can_create_projects: bool = False


class BacklotSeatUpdate(BaseModel):
    """Update a Backlot seat."""
    role: Optional[str] = Field(None, pattern="^(owner|admin|collaborative)$")
    can_create_projects: Optional[bool] = None


class BacklotSeatResponse(BaseModel):
    """Backlot seat response."""
    id: str
    organization_id: str
    user_id: str
    role: str
    can_create_projects: bool
    status: str
    joined_at: Optional[str]
    # User info
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_avatar: Optional[str] = None


class ProjectAccessGrant(BaseModel):
    """Grant project access to a collaborative seat."""
    project_id: str
    tab_permissions: Optional[Dict[str, Dict[str, bool]]] = None  # {"tab_name": {"view": true, "edit": false}}


class ProjectAccessUpdate(BaseModel):
    """Update project access permissions."""
    tab_permissions: Dict[str, Dict[str, bool]]


class ProjectAccessResponse(BaseModel):
    """Project access response."""
    id: str
    organization_id: str
    user_id: str
    project_id: str
    project_name: Optional[str] = None
    tab_permissions: Dict[str, Any]
    granted_by: Optional[str] = None
    granted_at: Optional[str] = None


class OrganizationBacklotStatus(BaseModel):
    """Organization Backlot status."""
    organization_id: str
    organization_name: str
    backlot_enabled: bool
    backlot_billing_status: str
    backlot_seat_limit: int
    seats_used: int
    seats_available: int
    projects_count: int


class EnableBacklotRequest(BaseModel):
    """Enable Backlot for organization."""
    seat_limit: int = 5


# =============================================================================
# Helper Functions
# =============================================================================

async def get_user_profile_id(user: Dict[str, Any]) -> str:
    """Get profile ID from user object."""
    if user.get("profile_id"):
        return user["profile_id"]
    if user.get("id"):
        return user["id"]
    if user.get("sub"):
        return await get_profile_id_from_cognito_id(user["sub"])
    raise HTTPException(status_code=401, detail="Could not determine user profile")


async def check_org_backlot_admin(organization_id: str, user_id: str) -> Dict[str, Any]:
    """
    Check if user has admin access to organization's Backlot settings.
    Must be owner or admin.
    """
    member = execute_single("""
        SELECT om.*, o.backlot_enabled, o.backlot_billing_status
        FROM organization_members om
        JOIN organizations o ON om.organization_id = o.id
        WHERE om.organization_id = :organization_id
          AND om.user_id = :user_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin')
    """, {"organization_id": organization_id, "user_id": user_id})

    if not member:
        raise HTTPException(
            status_code=403,
            detail="You must be an organization owner or admin to manage Backlot settings"
        )

    return member


async def check_org_backlot_enabled(organization_id: str) -> Dict[str, Any]:
    """Check if organization has Backlot enabled."""
    org = execute_single("""
        SELECT id, name, backlot_enabled, backlot_billing_status, backlot_seat_limit
        FROM organizations
        WHERE id = :organization_id
    """, {"organization_id": organization_id})

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.get("backlot_enabled"):
        raise HTTPException(status_code=400, detail="Backlot is not enabled for this organization")

    return org


def count_backlot_seats(organization_id: str) -> int:
    """Count active Backlot seats in organization."""
    result = execute_single("""
        SELECT COUNT(*) as count
        FROM organization_members
        WHERE organization_id = :organization_id
          AND status = 'active'
          AND role IN ('owner', 'admin', 'collaborative')
    """, {"organization_id": organization_id})
    return result["count"] if result else 0


# =============================================================================
# Organization Backlot Status
# =============================================================================

@router.get("/organizations/{organization_id}/backlot/status", response_model=OrganizationBacklotStatus)
async def get_backlot_status(
    organization_id: str,
    user = Depends(get_current_user)
):
    """Get organization's Backlot status including seat usage."""
    user_id = await get_user_profile_id(user)

    # Check membership (any active member can view status)
    member = execute_single("""
        SELECT om.role FROM organization_members om
        WHERE om.organization_id = :organization_id
          AND om.user_id = :user_id
          AND om.status = 'active'
    """, {"organization_id": organization_id, "user_id": user_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    # Get org info with seat counts
    org = execute_single("""
        SELECT
            o.id as organization_id,
            o.name as organization_name,
            o.backlot_enabled,
            o.backlot_billing_status,
            o.backlot_seat_limit,
            (SELECT COUNT(*) FROM organization_members om2
             WHERE om2.organization_id = o.id
               AND om2.status = 'active'
               AND om2.role IN ('owner', 'admin', 'collaborative')) as seats_used,
            (SELECT COUNT(*) FROM backlot_projects bp
             WHERE bp.organization_id = o.id) as projects_count
        FROM organizations o
        WHERE o.id = :organization_id
    """, {"organization_id": organization_id})

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    seats_available = org["backlot_seat_limit"] - org["seats_used"] if org["backlot_seat_limit"] > 0 else -1  # -1 = unlimited

    return OrganizationBacklotStatus(
        organization_id=org["organization_id"],
        organization_name=org["organization_name"],
        backlot_enabled=org["backlot_enabled"] or False,
        backlot_billing_status=org["backlot_billing_status"] or "none",
        backlot_seat_limit=org["backlot_seat_limit"] or 0,
        seats_used=org["seats_used"] or 0,
        seats_available=seats_available,
        projects_count=org["projects_count"] or 0
    )


@router.post("/organizations/{organization_id}/backlot/enable")
async def enable_backlot(
    organization_id: str,
    request: EnableBacklotRequest,
    user = Depends(get_current_user)
):
    """Enable Backlot for an organization. Owner only."""
    user_id = await get_user_profile_id(user)

    # Only owner can enable Backlot
    member = execute_single("""
        SELECT * FROM organization_members
        WHERE organization_id = :organization_id
          AND user_id = :user_id
          AND status = 'active'
          AND role = 'owner'
    """, {"organization_id": organization_id, "user_id": user_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only organization owners can enable Backlot")

    # Enable Backlot
    execute_update("""
        UPDATE organizations
        SET backlot_enabled = TRUE,
            backlot_seat_limit = :seat_limit,
            backlot_billing_status = 'free',
            updated_at = NOW()
        WHERE id = :organization_id
    """, {"organization_id": organization_id, "seat_limit": request.seat_limit})

    logger.info(f"Backlot enabled for organization {organization_id} with {request.seat_limit} seats")

    return {"success": True, "message": "Backlot enabled for organization"}


# =============================================================================
# Backlot Seat Management
# =============================================================================

@router.get("/organizations/{organization_id}/backlot/seats", response_model=List[BacklotSeatResponse])
async def list_backlot_seats(
    organization_id: str,
    user = Depends(get_current_user)
):
    """List all Backlot seats in organization."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    seats = execute_query("""
        SELECT
            om.id,
            om.organization_id,
            om.user_id,
            om.role,
            om.can_create_projects,
            om.status,
            om.joined_at,
            p.display_name as user_name,
            p.email as user_email,
            p.avatar_url as user_avatar
        FROM organization_members om
        JOIN profiles p ON om.user_id = p.id
        WHERE om.organization_id = :organization_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'collaborative')
        ORDER BY
            CASE om.role
                WHEN 'owner' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'collaborative' THEN 3
            END,
            om.joined_at
    """, {"organization_id": organization_id})

    return [BacklotSeatResponse(
        id=s["id"],
        organization_id=s["organization_id"],
        user_id=s["user_id"],
        role=s["role"],
        can_create_projects=s["can_create_projects"] or False,
        status=s["status"],
        joined_at=str(s["joined_at"]) if s["joined_at"] else None,
        user_name=s["user_name"],
        user_email=s["user_email"],
        user_avatar=s["user_avatar"]
    ) for s in seats]


@router.post("/organizations/{organization_id}/backlot/seats", response_model=BacklotSeatResponse)
async def add_backlot_seat(
    organization_id: str,
    seat: BacklotSeatCreate,
    user = Depends(get_current_user)
):
    """Add a new Backlot seat to the organization."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)
    org = await check_org_backlot_enabled(organization_id)

    # Check seat limit
    current_seats = count_backlot_seats(organization_id)
    if org["backlot_seat_limit"] > 0 and current_seats >= org["backlot_seat_limit"]:
        raise HTTPException(
            status_code=400,
            detail=f"Seat limit reached ({org['backlot_seat_limit']}). Upgrade your plan to add more seats."
        )

    # Check if user exists
    target_user = execute_single("SELECT id, display_name, email, avatar_url FROM profiles WHERE id = :user_id", {"user_id": seat.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = execute_single("""
        SELECT id, role, status FROM organization_members
        WHERE organization_id = :organization_id AND user_id = :user_id
    """, {"organization_id": organization_id, "user_id": seat.user_id})

    if existing:
        if existing["status"] == "active" and existing["role"] in ("owner", "admin", "collaborative"):
            raise HTTPException(status_code=400, detail="User already has a Backlot seat in this organization")

        # Update existing membership to new role
        execute_update("""
            UPDATE organization_members
            SET role = :role, can_create_projects = :can_create, status = 'active', updated_at = NOW()
            WHERE organization_id = :organization_id AND user_id = :user_id
        """, {
            "organization_id": organization_id,
            "user_id": seat.user_id,
            "role": seat.role,
            "can_create": seat.can_create_projects
        })
        member_id = existing["id"]
    else:
        # Create new membership
        result = execute_insert("""
            INSERT INTO organization_members (organization_id, user_id, role, can_create_projects, status, joined_at)
            VALUES (:organization_id, :user_id, :role, :can_create, 'active', NOW())
            RETURNING id
        """, {
            "organization_id": organization_id,
            "user_id": seat.user_id,
            "role": seat.role,
            "can_create": seat.can_create_projects
        })
        member_id = result["id"]

    logger.info(f"Added Backlot seat for user {seat.user_id} in org {organization_id} as {seat.role}")

    return BacklotSeatResponse(
        id=member_id,
        organization_id=organization_id,
        user_id=seat.user_id,
        role=seat.role,
        can_create_projects=seat.can_create_projects,
        status="active",
        joined_at=str(datetime.now()),
        user_name=target_user["display_name"],
        user_email=target_user["email"],
        user_avatar=target_user["avatar_url"]
    )


@router.patch("/organizations/{organization_id}/backlot/seats/{target_user_id}", response_model=BacklotSeatResponse)
async def update_backlot_seat(
    organization_id: str,
    target_user_id: str,
    seat: BacklotSeatUpdate,
    user = Depends(get_current_user)
):
    """Update a Backlot seat (role, can_create_projects)."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    # Get existing seat
    existing = execute_single("""
        SELECT om.*, p.display_name as user_name, p.email as user_email, p.avatar_url as user_avatar
        FROM organization_members om
        JOIN profiles p ON om.user_id = p.id
        WHERE om.organization_id = :organization_id
          AND om.user_id = :target_user_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'collaborative')
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Backlot seat not found")

    # Build update
    updates = []
    params = {"organization_id": organization_id, "target_user_id": target_user_id}

    if seat.role is not None:
        # Cannot demote the last owner
        if existing["role"] == "owner" and seat.role != "owner":
            owner_count = execute_single("""
                SELECT COUNT(*) as count FROM organization_members
                WHERE organization_id = :organization_id AND role = 'owner' AND status = 'active'
            """, {"organization_id": organization_id})
            if owner_count["count"] <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the last owner")

        updates.append("role = :role")
        params["role"] = seat.role

    if seat.can_create_projects is not None:
        updates.append("can_create_projects = :can_create")
        params["can_create"] = seat.can_create_projects

    if updates:
        updates.append("updated_at = NOW()")
        execute_update(f"""
            UPDATE organization_members
            SET {', '.join(updates)}
            WHERE organization_id = :organization_id AND user_id = :target_user_id
        """, params)

    # Return updated seat
    updated = execute_single("""
        SELECT om.*, p.display_name as user_name, p.email as user_email, p.avatar_url as user_avatar
        FROM organization_members om
        JOIN profiles p ON om.user_id = p.id
        WHERE om.organization_id = :organization_id AND om.user_id = :target_user_id
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    return BacklotSeatResponse(
        id=updated["id"],
        organization_id=updated["organization_id"],
        user_id=updated["user_id"],
        role=updated["role"],
        can_create_projects=updated["can_create_projects"] or False,
        status=updated["status"],
        joined_at=str(updated["joined_at"]) if updated["joined_at"] else None,
        user_name=updated["user_name"],
        user_email=updated["user_email"],
        user_avatar=updated["user_avatar"]
    )


@router.delete("/organizations/{organization_id}/backlot/seats/{target_user_id}")
async def remove_backlot_seat(
    organization_id: str,
    target_user_id: str,
    user = Depends(get_current_user)
):
    """Remove a Backlot seat from the organization."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    # Get existing seat
    existing = execute_single("""
        SELECT * FROM organization_members
        WHERE organization_id = :organization_id
          AND user_id = :target_user_id
          AND status = 'active'
          AND role IN ('owner', 'admin', 'collaborative')
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Backlot seat not found")

    # Cannot remove the last owner
    if existing["role"] == "owner":
        owner_count = execute_single("""
            SELECT COUNT(*) as count FROM organization_members
            WHERE organization_id = :organization_id AND role = 'owner' AND status = 'active'
        """, {"organization_id": organization_id})
        if owner_count["count"] <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last owner")

    # Remove from organization (set status to removed)
    execute_update("""
        UPDATE organization_members
        SET status = 'removed', updated_at = NOW()
        WHERE organization_id = :organization_id AND user_id = :target_user_id
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    # Remove all project access for this user
    execute_update("""
        DELETE FROM organization_project_access
        WHERE organization_id = :organization_id AND user_id = :target_user_id
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    # TODO: Transfer work items to project owner (call transfer_work_on_removal)

    logger.info(f"Removed Backlot seat for user {target_user_id} from org {organization_id}")

    return {"success": True, "message": "Backlot seat removed"}


# =============================================================================
# Project Access for Collaborative Seats
# =============================================================================

@router.get("/organizations/{organization_id}/backlot/seats/{target_user_id}/projects", response_model=List[ProjectAccessResponse])
async def list_user_project_access(
    organization_id: str,
    target_user_id: str,
    user = Depends(get_current_user)
):
    """List projects a collaborative seat can access."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    access_list = execute_query("""
        SELECT
            opa.id,
            opa.organization_id,
            opa.user_id,
            opa.project_id,
            bp.name as project_name,
            opa.tab_permissions,
            opa.granted_by,
            opa.granted_at
        FROM organization_project_access opa
        JOIN backlot_projects bp ON opa.project_id = bp.id
        WHERE opa.organization_id = :organization_id
          AND opa.user_id = :target_user_id
        ORDER BY bp.name
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    return [ProjectAccessResponse(
        id=a["id"],
        organization_id=a["organization_id"],
        user_id=a["user_id"],
        project_id=a["project_id"],
        project_name=a["project_name"],
        tab_permissions=a["tab_permissions"] or {},
        granted_by=a["granted_by"],
        granted_at=str(a["granted_at"]) if a["granted_at"] else None
    ) for a in access_list]


@router.post("/organizations/{organization_id}/backlot/seats/{target_user_id}/projects", response_model=ProjectAccessResponse)
async def grant_project_access(
    organization_id: str,
    target_user_id: str,
    access: ProjectAccessGrant,
    user = Depends(get_current_user)
):
    """Grant a collaborative seat access to a project."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    # Verify the project belongs to this organization
    project = execute_single("""
        SELECT id, name, organization_id FROM backlot_projects
        WHERE id = :project_id
    """, {"project_id": access.project_id})

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project["organization_id"] != organization_id:
        raise HTTPException(status_code=400, detail="Project does not belong to this organization")

    # Verify target user is a collaborative member
    member = execute_single("""
        SELECT * FROM organization_members
        WHERE organization_id = :organization_id
          AND user_id = :target_user_id
          AND status = 'active'
          AND role = 'collaborative'
    """, {"organization_id": organization_id, "target_user_id": target_user_id})

    if not member:
        raise HTTPException(status_code=400, detail="User must be a collaborative member to grant project access")

    # Check if access already exists
    existing = execute_single("""
        SELECT id FROM organization_project_access
        WHERE organization_id = :organization_id
          AND user_id = :target_user_id
          AND project_id = :project_id
    """, {"organization_id": organization_id, "target_user_id": target_user_id, "project_id": access.project_id})

    if existing:
        raise HTTPException(status_code=400, detail="User already has access to this project")

    # Grant access
    result = execute_insert("""
        INSERT INTO organization_project_access
            (organization_id, user_id, project_id, tab_permissions, granted_by, granted_at)
        VALUES
            (:organization_id, :target_user_id, :project_id, :tab_permissions, :granted_by, NOW())
        RETURNING id, granted_at
    """, {
        "organization_id": organization_id,
        "target_user_id": target_user_id,
        "project_id": access.project_id,
        "tab_permissions": access.tab_permissions or {},
        "granted_by": user_id
    })

    logger.info(f"Granted project {access.project_id} access to user {target_user_id} in org {organization_id}")

    return ProjectAccessResponse(
        id=result["id"],
        organization_id=organization_id,
        user_id=target_user_id,
        project_id=access.project_id,
        project_name=project["name"],
        tab_permissions=access.tab_permissions or {},
        granted_by=user_id,
        granted_at=str(result["granted_at"])
    )


@router.patch("/organizations/{organization_id}/backlot/seats/{target_user_id}/projects/{project_id}")
async def update_project_access(
    organization_id: str,
    target_user_id: str,
    project_id: str,
    access: ProjectAccessUpdate,
    user = Depends(get_current_user)
):
    """Update tab permissions for a user's project access."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    # Verify access exists
    existing = execute_single("""
        SELECT id FROM organization_project_access
        WHERE organization_id = :organization_id
          AND user_id = :target_user_id
          AND project_id = :project_id
    """, {"organization_id": organization_id, "target_user_id": target_user_id, "project_id": project_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Project access not found")

    # Update permissions
    execute_update("""
        UPDATE organization_project_access
        SET tab_permissions = :tab_permissions, updated_at = NOW()
        WHERE organization_id = :organization_id
          AND user_id = :target_user_id
          AND project_id = :project_id
    """, {
        "organization_id": organization_id,
        "target_user_id": target_user_id,
        "project_id": project_id,
        "tab_permissions": access.tab_permissions
    })

    return {"success": True, "message": "Project access updated"}


@router.delete("/organizations/{organization_id}/backlot/seats/{target_user_id}/projects/{project_id}")
async def revoke_project_access(
    organization_id: str,
    target_user_id: str,
    project_id: str,
    user = Depends(get_current_user)
):
    """Revoke a user's access to a project."""
    user_id = await get_user_profile_id(user)
    await check_org_backlot_admin(organization_id, user_id)

    # Delete access
    execute_update("""
        DELETE FROM organization_project_access
        WHERE organization_id = :organization_id
          AND user_id = :target_user_id
          AND project_id = :project_id
    """, {"organization_id": organization_id, "target_user_id": target_user_id, "project_id": project_id})

    # TODO: Transfer work items to project owner

    logger.info(f"Revoked project {project_id} access from user {target_user_id} in org {organization_id}")

    return {"success": True, "message": "Project access revoked"}


# =============================================================================
# Organization Backlot Projects
# =============================================================================

@router.get("/organizations/{organization_id}/projects")
async def list_organization_projects(
    organization_id: str,
    user = Depends(get_current_user)
):
    """List all Backlot projects owned by the organization."""
    user_id = await get_user_profile_id(user)

    # Check membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :organization_id
          AND user_id = :user_id
          AND status = 'active'
    """, {"organization_id": organization_id, "user_id": user_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    # Get projects based on role
    if member["role"] in ("owner", "admin"):
        # Owners/admins see all projects
        projects = execute_query("""
            SELECT bp.*, p.display_name as owner_name
            FROM backlot_projects bp
            LEFT JOIN profiles p ON bp.owner_id = p.id
            WHERE bp.organization_id = :organization_id
            ORDER BY bp.updated_at DESC
        """, {"organization_id": organization_id})
    else:
        # Collaborative members only see projects they have access to
        projects = execute_query("""
            SELECT bp.*, p.display_name as owner_name
            FROM backlot_projects bp
            LEFT JOIN profiles p ON bp.owner_id = p.id
            JOIN organization_project_access opa ON bp.id = opa.project_id
            WHERE bp.organization_id = :organization_id
              AND opa.user_id = :user_id
            ORDER BY bp.updated_at DESC
        """, {"organization_id": organization_id, "user_id": user_id})

    return projects


@router.post("/projects/{project_id}/organization")
async def assign_project_to_organization(
    project_id: str,
    organization_id: Optional[str] = None,
    user = Depends(get_current_user)
):
    """
    Assign or unassign a project to/from an organization.
    Only project owner or org admin can do this.
    """
    user_id = await get_user_profile_id(user)

    # Check project ownership
    project = execute_single("""
        SELECT id, owner_id, organization_id FROM backlot_projects WHERE id = :project_id
    """, {"project_id": project_id})

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project["owner_id"] == user_id

    if organization_id:
        # Assigning to organization
        org = await check_org_backlot_enabled(organization_id)

        # Check if user is org admin
        is_org_admin = execute_single("""
            SELECT id FROM organization_members
            WHERE organization_id = :organization_id
              AND user_id = :user_id
              AND status = 'active'
              AND role IN ('owner', 'admin')
        """, {"organization_id": organization_id, "user_id": user_id})

        if not is_owner and not is_org_admin:
            raise HTTPException(status_code=403, detail="Must be project owner or organization admin")

    else:
        # Unassigning from organization
        if not is_owner:
            # Check if user is admin of current org
            if project["organization_id"]:
                is_org_admin = execute_single("""
                    SELECT id FROM organization_members
                    WHERE organization_id = :organization_id
                      AND user_id = :user_id
                      AND status = 'active'
                      AND role IN ('owner', 'admin')
                """, {"organization_id": project["organization_id"], "user_id": user_id})
                if not is_org_admin:
                    raise HTTPException(status_code=403, detail="Must be project owner or organization admin")
            else:
                raise HTTPException(status_code=403, detail="Must be project owner")

    # Update project
    execute_update("""
        UPDATE backlot_projects
        SET organization_id = :organization_id, updated_at = NOW()
        WHERE id = :project_id
    """, {"project_id": project_id, "organization_id": organization_id})

    action = "assigned to" if organization_id else "removed from"
    logger.info(f"Project {project_id} {action} organization {organization_id}")

    return {"success": True, "message": f"Project {action} organization"}


# =============================================================================
# User's Backlot Organizations (for dashboard/access check)
# =============================================================================

@router.get("/organizations/my-backlot-orgs")
async def get_my_backlot_organizations(
    user = Depends(get_current_user)
):
    """Get all organizations where user has Backlot access."""
    user_id = await get_user_profile_id(user)

    orgs = execute_query("""
        SELECT
            o.id,
            o.name,
            o.slug,
            o.logo_url,
            o.backlot_enabled,
            o.backlot_billing_status,
            o.backlot_seat_limit,
            om.role,
            om.can_create_projects,
            (SELECT COUNT(*) FROM organization_members om2
             WHERE om2.organization_id = o.id
               AND om2.status = 'active'
               AND om2.role IN ('owner', 'admin', 'collaborative')) as seats_used,
            (SELECT COUNT(*) FROM backlot_projects bp
             WHERE bp.organization_id = o.id) as projects_count
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = :user_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'collaborative')
          AND o.backlot_enabled = TRUE
        ORDER BY o.name
    """, {"user_id": user_id})

    return orgs
