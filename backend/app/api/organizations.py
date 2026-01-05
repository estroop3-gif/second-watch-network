"""
Organizations API

CRUD operations for organizations (studios/production companies)
that can own Worlds and receive payouts.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import re

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class OrganizationCreate(BaseModel):
    """Create organization request."""
    name: str = Field(..., min_length=2, max_length=200)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    payout_email: Optional[str] = None


class OrganizationUpdate(BaseModel):
    """Update organization request."""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    payout_email: Optional[str] = None


class OrganizationResponse(BaseModel):
    """Organization response."""
    id: str
    name: str
    slug: str
    description: Optional[str]
    logo_url: Optional[str]
    website_url: Optional[str]
    status: str
    payout_email: Optional[str]
    stripe_connect_onboarded: bool
    created_by: Optional[str]
    created_at: str
    member_count: Optional[int] = None
    worlds_count: Optional[int] = None


class MemberInvite(BaseModel):
    """Invite member request."""
    user_id: str
    role: str = Field(default="member", pattern="^(owner|admin|finance|creator|member)$")


class MemberResponse(BaseModel):
    """Organization member response."""
    id: str
    organization_id: str
    user_id: str
    role: str
    status: str
    joined_at: Optional[str]
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class AssignWorldRequest(BaseModel):
    """Assign world to organization request."""
    organization_id: Optional[str] = None  # None to remove from org


# =============================================================================
# Helper Functions
# =============================================================================

def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug[:100]


async def check_org_membership(
    organization_id: str,
    user_id: str,
    required_roles: List[str] = None
) -> Dict[str, Any]:
    """
    Check if user is a member of the organization with required role.

    Returns member record or None.
    """
    query = """
        SELECT * FROM organization_members
        WHERE organization_id = :organization_id
          AND user_id = :user_id
          AND status = 'active'
    """

    if required_roles:
        query += " AND role IN :roles"
        params = {
            "organization_id": organization_id,
            "user_id": user_id,
            "roles": tuple(required_roles)
        }
    else:
        params = {"organization_id": organization_id, "user_id": user_id}

    return execute_single(query, params)


# =============================================================================
# Organization CRUD
# =============================================================================

@router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(
    org: OrganizationCreate,
    user = Depends(get_current_user)
):
    """
    Create a new organization.

    The creating user becomes the owner.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Generate slug if not provided
    slug = org.slug or generate_slug(org.name)

    # Check for slug uniqueness
    existing = execute_single(
        "SELECT id FROM organizations WHERE slug = :slug",
        {"slug": slug}
    )

    if existing:
        # Add random suffix to make unique
        import secrets
        slug = f"{slug}-{secrets.token_hex(3)}"

    # Create organization
    org_data = execute_insert("""
        INSERT INTO organizations (name, slug, description, logo_url, website_url, payout_email, created_by, status)
        VALUES (:name, :slug, :description, :logo_url, :website_url, :payout_email, :created_by, 'pending')
        RETURNING *
    """, {
        "name": org.name,
        "slug": slug,
        "description": org.description,
        "logo_url": org.logo_url,
        "website_url": org.website_url,
        "payout_email": org.payout_email,
        "created_by": user_id,
    })

    if not org_data:
        raise HTTPException(500, "Failed to create organization")

    # Add creator as owner
    execute_insert("""
        INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
        VALUES (:org_id, :user_id, 'owner', 'active', NOW())
    """, {
        "org_id": org_data["id"],
        "user_id": user_id,
    })

    logger.info("organization_created", org_id=org_data["id"], created_by=user_id)

    return OrganizationResponse(
        id=org_data["id"],
        name=org_data["name"],
        slug=org_data["slug"],
        description=org_data.get("description"),
        logo_url=org_data.get("logo_url"),
        website_url=org_data.get("website_url"),
        status=org_data["status"],
        payout_email=org_data.get("payout_email"),
        stripe_connect_onboarded=org_data.get("stripe_connect_onboarded", False),
        created_by=org_data.get("created_by"),
        created_at=org_data["created_at"],
        member_count=1,
        worlds_count=0
    )


@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_my_organizations(
    user = Depends(get_current_user)
):
    """
    List organizations the current user belongs to.
    """
    user_id = user.get("profile_id") or user.get("id")

    orgs = execute_query("""
        SELECT
            o.*,
            om.role as my_role,
            (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND status = 'active') as member_count,
            (SELECT COUNT(*) FROM worlds WHERE organization_id = o.id) as worlds_count
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = :user_id
          AND om.status = 'active'
        ORDER BY o.name
    """, {"user_id": user_id})

    return [
        OrganizationResponse(
            id=org["id"],
            name=org["name"],
            slug=org["slug"],
            description=org.get("description"),
            logo_url=org.get("logo_url"),
            website_url=org.get("website_url"),
            status=org["status"],
            payout_email=org.get("payout_email"),
            stripe_connect_onboarded=org.get("stripe_connect_onboarded", False),
            created_by=org.get("created_by"),
            created_at=org["created_at"],
            member_count=org.get("member_count", 0),
            worlds_count=org.get("worlds_count", 0)
        )
        for org in orgs
    ]


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get organization details.

    User must be a member of the organization.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Check membership
    member = await check_org_membership(org_id, user_id)
    if not member:
        raise HTTPException(403, "You are not a member of this organization")

    org = execute_single("""
        SELECT
            o.*,
            (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND status = 'active') as member_count,
            (SELECT COUNT(*) FROM worlds WHERE organization_id = o.id) as worlds_count
        FROM organizations o
        WHERE o.id = :org_id
    """, {"org_id": org_id})

    if not org:
        raise HTTPException(404, "Organization not found")

    return OrganizationResponse(
        id=org["id"],
        name=org["name"],
        slug=org["slug"],
        description=org.get("description"),
        logo_url=org.get("logo_url"),
        website_url=org.get("website_url"),
        status=org["status"],
        payout_email=org.get("payout_email"),
        stripe_connect_onboarded=org.get("stripe_connect_onboarded", False),
        created_by=org.get("created_by"),
        created_at=org["created_at"],
        member_count=org.get("member_count", 0),
        worlds_count=org.get("worlds_count", 0)
    )


@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: str,
    updates: OrganizationUpdate,
    user = Depends(get_current_user)
):
    """
    Update organization details.

    Requires owner or admin role.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Check membership with admin+ role
    member = await check_org_membership(org_id, user_id, ["owner", "admin"])
    if not member:
        raise HTTPException(403, "You must be an admin or owner to update this organization")

    # Build update query
    update_fields = []
    params = {"org_id": org_id}

    if updates.name is not None:
        update_fields.append("name = :name")
        params["name"] = updates.name

    if updates.description is not None:
        update_fields.append("description = :description")
        params["description"] = updates.description

    if updates.logo_url is not None:
        update_fields.append("logo_url = :logo_url")
        params["logo_url"] = updates.logo_url

    if updates.website_url is not None:
        update_fields.append("website_url = :website_url")
        params["website_url"] = updates.website_url

    if updates.payout_email is not None:
        update_fields.append("payout_email = :payout_email")
        params["payout_email"] = updates.payout_email

    if not update_fields:
        raise HTTPException(400, "No fields to update")

    update_fields.append("updated_at = NOW()")

    query = f"""
        UPDATE organizations
        SET {', '.join(update_fields)}
        WHERE id = :org_id
        RETURNING *
    """

    org = execute_query(query, params)

    if not org:
        raise HTTPException(404, "Organization not found")

    org = org[0]

    logger.info("organization_updated", org_id=org_id, updated_by=user_id)

    return OrganizationResponse(
        id=org["id"],
        name=org["name"],
        slug=org["slug"],
        description=org.get("description"),
        logo_url=org.get("logo_url"),
        website_url=org.get("website_url"),
        status=org["status"],
        payout_email=org.get("payout_email"),
        stripe_connect_onboarded=org.get("stripe_connect_onboarded", False),
        created_by=org.get("created_by"),
        created_at=org["created_at"]
    )


# =============================================================================
# Member Management
# =============================================================================

@router.get("/organizations/{org_id}/members", response_model=List[MemberResponse])
async def list_organization_members(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    List all members of an organization.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Check membership
    member = await check_org_membership(org_id, user_id)
    if not member:
        raise HTTPException(403, "You are not a member of this organization")

    members = execute_query("""
        SELECT
            om.*,
            p.display_name as user_name,
            p.email as user_email
        FROM organization_members om
        JOIN profiles p ON om.user_id = p.id
        WHERE om.organization_id = :org_id
          AND om.status = 'active'
        ORDER BY
            CASE om.role
                WHEN 'owner' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'finance' THEN 3
                WHEN 'creator' THEN 4
                ELSE 5
            END,
            p.display_name
    """, {"org_id": org_id})

    return [
        MemberResponse(
            id=m["id"],
            organization_id=m["organization_id"],
            user_id=m["user_id"],
            role=m["role"],
            status=m["status"],
            joined_at=m.get("joined_at"),
            user_name=m.get("user_name"),
            user_email=m.get("user_email")
        )
        for m in members
    ]


@router.post("/organizations/{org_id}/members", response_model=MemberResponse)
async def add_organization_member(
    org_id: str,
    invite: MemberInvite,
    user = Depends(get_current_user)
):
    """
    Add a member to the organization.

    Requires owner or admin role.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Check membership with admin+ role
    member = await check_org_membership(org_id, user_id, ["owner", "admin"])
    if not member:
        raise HTTPException(403, "You must be an admin or owner to add members")

    # Cannot add another owner unless you're the owner
    if invite.role == "owner" and member["role"] != "owner":
        raise HTTPException(403, "Only the owner can add another owner")

    # Check if user exists
    target_user = execute_single(
        "SELECT id, display_name, email FROM profiles WHERE id = :user_id",
        {"user_id": invite.user_id}
    )

    if not target_user:
        raise HTTPException(404, "User not found")

    # Check if already a member
    existing = execute_single("""
        SELECT id FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
    """, {"org_id": org_id, "user_id": invite.user_id})

    if existing:
        # Update existing membership
        result = execute_query("""
            UPDATE organization_members
            SET role = :role, status = 'active', joined_at = COALESCE(joined_at, NOW()), updated_at = NOW()
            WHERE organization_id = :org_id AND user_id = :user_id
            RETURNING *
        """, {
            "org_id": org_id,
            "user_id": invite.user_id,
            "role": invite.role
        })
        member_data = result[0] if result else None
    else:
        # Create new membership
        member_data = execute_insert("""
            INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
            VALUES (:org_id, :user_id, :role, 'active', NOW())
            RETURNING *
        """, {
            "org_id": org_id,
            "user_id": invite.user_id,
            "role": invite.role
        })

    if not member_data:
        raise HTTPException(500, "Failed to add member")

    logger.info(
        "organization_member_added",
        org_id=org_id,
        new_member_id=invite.user_id,
        role=invite.role,
        added_by=user_id
    )

    return MemberResponse(
        id=member_data["id"],
        organization_id=member_data["organization_id"],
        user_id=member_data["user_id"],
        role=member_data["role"],
        status=member_data["status"],
        joined_at=member_data.get("joined_at"),
        user_name=target_user.get("display_name"),
        user_email=target_user.get("email")
    )


@router.put("/organizations/{org_id}/members/{member_user_id}")
async def update_member_role(
    org_id: str,
    member_user_id: str,
    role: str,
    user = Depends(get_current_user)
):
    """
    Update a member's role.

    Requires owner role to change roles.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Only owner can change roles
    member = await check_org_membership(org_id, user_id, ["owner"])
    if not member:
        raise HTTPException(403, "Only the owner can change member roles")

    # Cannot demote yourself from owner
    if member_user_id == user_id and role != "owner":
        raise HTTPException(400, "Cannot demote yourself from owner")

    # Validate role
    valid_roles = ["owner", "admin", "finance", "creator", "member"]
    if role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    result = execute_update("""
        UPDATE organization_members
        SET role = :role, updated_at = NOW()
        WHERE organization_id = :org_id AND user_id = :member_user_id AND status = 'active'
    """, {
        "org_id": org_id,
        "member_user_id": member_user_id,
        "role": role
    })

    if result == 0:
        raise HTTPException(404, "Member not found")

    return {"message": "Member role updated", "role": role}


@router.delete("/organizations/{org_id}/members/{member_user_id}")
async def remove_organization_member(
    org_id: str,
    member_user_id: str,
    user = Depends(get_current_user)
):
    """
    Remove a member from the organization.

    Requires owner or admin role.
    Members can also remove themselves.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Allow self-removal
    if member_user_id == user_id:
        # Check you're not the only owner
        owners = execute_query("""
            SELECT user_id FROM organization_members
            WHERE organization_id = :org_id AND role = 'owner' AND status = 'active'
        """, {"org_id": org_id})

        if len(owners) == 1 and owners[0]["user_id"] == user_id:
            raise HTTPException(400, "Cannot leave organization - you are the only owner")
    else:
        # Check admin+ role for removing others
        member = await check_org_membership(org_id, user_id, ["owner", "admin"])
        if not member:
            raise HTTPException(403, "You must be an admin or owner to remove members")

        # Admin cannot remove owner
        target_member = await check_org_membership(org_id, member_user_id)
        if target_member and target_member["role"] == "owner" and member["role"] != "owner":
            raise HTTPException(403, "Only an owner can remove another owner")

    result = execute_update("""
        UPDATE organization_members
        SET status = 'removed', updated_at = NOW()
        WHERE organization_id = :org_id AND user_id = :member_user_id AND status = 'active'
    """, {
        "org_id": org_id,
        "member_user_id": member_user_id
    })

    if result == 0:
        raise HTTPException(404, "Member not found")

    logger.info(
        "organization_member_removed",
        org_id=org_id,
        removed_member_id=member_user_id,
        removed_by=user_id
    )

    return {"message": "Member removed"}


# =============================================================================
# World Assignment
# =============================================================================

@router.put("/worlds/{world_id}/organization")
async def assign_world_to_organization(
    world_id: str,
    request: AssignWorldRequest,
    user = Depends(get_current_user)
):
    """
    Assign or unassign a world to/from an organization.

    User must be the world's creator AND an admin/owner of the target organization.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Get world and verify ownership
    world = execute_single("""
        SELECT id, title, creator_id, organization_id
        FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(404, "World not found")

    if world["creator_id"] != user_id:
        raise HTTPException(403, "You must be the world's creator to assign it to an organization")

    if request.organization_id:
        # Check org membership
        member = await check_org_membership(request.organization_id, user_id, ["owner", "admin", "creator"])
        if not member:
            raise HTTPException(403, "You must be an admin, owner, or creator in the organization")

        # Assign to org
        execute_update("""
            UPDATE worlds
            SET organization_id = :org_id, updated_at = NOW()
            WHERE id = :world_id
        """, {
            "org_id": request.organization_id,
            "world_id": world_id
        })

        logger.info(
            "world_assigned_to_org",
            world_id=world_id,
            organization_id=request.organization_id,
            assigned_by=user_id
        )

        return {"message": "World assigned to organization", "organization_id": request.organization_id}
    else:
        # Remove from org (back to individual)
        execute_update("""
            UPDATE worlds
            SET organization_id = NULL, updated_at = NOW()
            WHERE id = :world_id
        """, {"world_id": world_id})

        logger.info(
            "world_removed_from_org",
            world_id=world_id,
            removed_by=user_id
        )

        return {"message": "World removed from organization"}


# =============================================================================
# Public Lookup (for profiles)
# =============================================================================

@router.get("/organizations/by-slug/{slug}")
async def get_organization_by_slug(slug: str):
    """
    Get public organization info by slug.
    """
    org = execute_single("""
        SELECT
            id, name, slug, description, logo_url, website_url, status,
            (SELECT COUNT(*) FROM worlds WHERE organization_id = organizations.id AND status = 'published') as worlds_count
        FROM organizations
        WHERE slug = :slug AND status IN ('verified', 'active')
    """, {"slug": slug})

    if not org:
        raise HTTPException(404, "Organization not found")

    return {
        "id": org["id"],
        "name": org["name"],
        "slug": org["slug"],
        "description": org.get("description"),
        "logo_url": org.get("logo_url"),
        "website_url": org.get("website_url"),
        "worlds_count": org.get("worlds_count", 0)
    }
