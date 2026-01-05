"""
Permission System for Second Watch Network

This module provides fine-grained permission control beyond basic roles.
Permissions represent specific actions/capabilities that can be granted to roles.

Usage:
    from app.core.permissions import Permission, require_permissions

    @router.get("/admin/users")
    async def list_users(profile = Depends(require_permissions(Permission.USER_VIEW))):
        pass

    @router.post("/worlds")
    async def create_world(profile = Depends(require_permissions(Permission.WORLD_CREATE))):
        pass
"""
from enum import Enum
from typing import Set, Dict, Any, List
from functools import wraps

from fastapi import Depends, HTTPException, status

from app.core.roles import RoleType, get_active_roles_from_profile
from app.core.deps import get_user_profile


class Permission(str, Enum):
    """
    Fine-grained permissions for Second Watch Network.

    Naming convention: DOMAIN_ACTION
    - DOMAIN: The feature area (USER, WORLD, BACKLOT, ORDER, etc.)
    - ACTION: The operation (VIEW, CREATE, EDIT, DELETE, MANAGE, etc.)
    """

    # ============================================================================
    # User & Profile Management
    # ============================================================================
    USER_VIEW = "user:view"              # View user profiles
    USER_EDIT = "user:edit"              # Edit own profile
    USER_MANAGE = "user:manage"          # Manage other users (admin)
    USER_BAN = "user:ban"                # Ban/suspend users
    USER_ROLES = "user:roles"            # Assign/revoke roles

    # ============================================================================
    # Content Moderation
    # ============================================================================
    CONTENT_VIEW = "content:view"        # View content
    CONTENT_CREATE = "content:create"    # Create content
    CONTENT_EDIT = "content:edit"        # Edit own content
    CONTENT_DELETE = "content:delete"    # Delete own content
    CONTENT_MODERATE = "content:moderate"  # Moderate any content
    CONTENT_FEATURE = "content:feature"  # Feature/promote content

    # ============================================================================
    # Worlds (Streaming Platform)
    # ============================================================================
    WORLD_VIEW = "world:view"            # View published worlds
    WORLD_CREATE = "world:create"        # Create new worlds
    WORLD_EDIT = "world:edit"            # Edit own worlds
    WORLD_DELETE = "world:delete"        # Delete own worlds
    WORLD_PUBLISH = "world:publish"      # Publish/unpublish worlds
    WORLD_MANAGE = "world:manage"        # Manage any world (admin)
    WORLD_ANALYTICS = "world:analytics"  # View world analytics

    # ============================================================================
    # Backlot (Production Management)
    # ============================================================================
    BACKLOT_VIEW = "backlot:view"        # View backlot projects (own/invited)
    BACKLOT_CREATE = "backlot:create"    # Create backlot projects
    BACKLOT_MANAGE = "backlot:manage"    # Full project management
    BACKLOT_BUDGET = "backlot:budget"    # View/edit budgets
    BACKLOT_SCHEDULE = "backlot:schedule"  # Manage schedules
    BACKLOT_DAILIES = "backlot:dailies"  # Upload/review dailies
    BACKLOT_ADMIN = "backlot:admin"      # Admin all backlot features

    # ============================================================================
    # Green Room (Submissions)
    # ============================================================================
    GREENROOM_VIEW = "greenroom:view"    # View green room
    GREENROOM_SUBMIT = "greenroom:submit"  # Submit projects
    GREENROOM_VOTE = "greenroom:vote"    # Vote on submissions
    GREENROOM_MANAGE = "greenroom:manage"  # Manage submissions (admin)

    # ============================================================================
    # Order (Guild System)
    # ============================================================================
    ORDER_VIEW = "order:view"            # View order content
    ORDER_ACCESS = "order:access"        # Access order features
    ORDER_OFFICER = "order:officer"      # Order governance officer (funds, voting)
    ORDER_MANAGE_LODGE = "order:manage_lodge"  # Manage lodge settings
    ORDER_MANAGE_CRAFT = "order:manage_craft"  # Manage craft houses
    ORDER_ADMIN = "order:admin"          # Full order administration

    # ============================================================================
    # Community & Social
    # ============================================================================
    FORUM_VIEW = "forum:view"            # View forum posts
    FORUM_POST = "forum:post"            # Create forum posts
    FORUM_MODERATE = "forum:moderate"    # Moderate forum
    MESSAGE_SEND = "message:send"        # Send direct messages
    CONNECTION_MANAGE = "connection:manage"  # Manage connections

    # ============================================================================
    # Live Events
    # ============================================================================
    EVENT_VIEW = "event:view"            # View live events
    EVENT_CREATE = "event:create"        # Create live events
    EVENT_HOST = "event:host"            # Host live events
    EVENT_MANAGE = "event:manage"        # Manage all events

    # ============================================================================
    # System Administration
    # ============================================================================
    ADMIN_DASHBOARD = "admin:dashboard"  # Access admin dashboard
    ADMIN_USERS = "admin:users"          # Admin user management
    ADMIN_CONTENT = "admin:content"      # Admin content management
    ADMIN_SYSTEM = "admin:system"        # System configuration
    ADMIN_BILLING = "admin:billing"      # Billing/subscription management
    ADMIN_ANALYTICS = "admin:analytics"  # Platform-wide analytics


# ============================================================================
# Role → Permission Mapping
# ============================================================================

ROLE_PERMISSIONS: Dict[RoleType, Set[Permission]] = {
    RoleType.SUPERADMIN: set(Permission),  # All permissions

    RoleType.ADMIN: {
        # User management
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.USER_MANAGE,
        Permission.USER_BAN,
        Permission.USER_ROLES,
        # Content
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.CONTENT_DELETE,
        Permission.CONTENT_MODERATE,
        Permission.CONTENT_FEATURE,
        # Worlds
        Permission.WORLD_VIEW,
        Permission.WORLD_CREATE,
        Permission.WORLD_EDIT,
        Permission.WORLD_DELETE,
        Permission.WORLD_PUBLISH,
        Permission.WORLD_MANAGE,
        Permission.WORLD_ANALYTICS,
        # Backlot
        Permission.BACKLOT_VIEW,
        Permission.BACKLOT_CREATE,
        Permission.BACKLOT_MANAGE,
        Permission.BACKLOT_BUDGET,
        Permission.BACKLOT_SCHEDULE,
        Permission.BACKLOT_DAILIES,
        Permission.BACKLOT_ADMIN,
        # Green Room
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_SUBMIT,
        Permission.GREENROOM_VOTE,
        Permission.GREENROOM_MANAGE,
        # Order
        Permission.ORDER_VIEW,
        Permission.ORDER_ACCESS,
        Permission.ORDER_OFFICER,
        Permission.ORDER_MANAGE_LODGE,
        Permission.ORDER_MANAGE_CRAFT,
        Permission.ORDER_ADMIN,
        # Community
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.FORUM_MODERATE,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        # Events
        Permission.EVENT_VIEW,
        Permission.EVENT_CREATE,
        Permission.EVENT_HOST,
        Permission.EVENT_MANAGE,
        # Admin
        Permission.ADMIN_DASHBOARD,
        Permission.ADMIN_USERS,
        Permission.ADMIN_CONTENT,
        Permission.ADMIN_ANALYTICS,
    },

    RoleType.MODERATOR: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.USER_BAN,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.CONTENT_DELETE,
        Permission.CONTENT_MODERATE,
        Permission.WORLD_VIEW,
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_VOTE,
        Permission.ORDER_VIEW,
        Permission.ORDER_ACCESS,
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.FORUM_MODERATE,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        Permission.EVENT_VIEW,
        Permission.ADMIN_DASHBOARD,
    },

    RoleType.LODGE_OFFICER: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.WORLD_VIEW,
        Permission.BACKLOT_VIEW,
        Permission.BACKLOT_CREATE,
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_SUBMIT,
        Permission.GREENROOM_VOTE,
        Permission.ORDER_VIEW,
        Permission.ORDER_ACCESS,
        Permission.ORDER_OFFICER,
        Permission.ORDER_MANAGE_LODGE,
        Permission.ORDER_MANAGE_CRAFT,
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        Permission.EVENT_VIEW,
        Permission.EVENT_CREATE,
        Permission.EVENT_HOST,
    },

    RoleType.ORDER_MEMBER: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.WORLD_VIEW,
        Permission.BACKLOT_VIEW,
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_VOTE,
        Permission.ORDER_VIEW,
        Permission.ORDER_ACCESS,
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        Permission.EVENT_VIEW,
    },

    RoleType.PARTNER: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.WORLD_VIEW,
        Permission.WORLD_ANALYTICS,
        Permission.BACKLOT_VIEW,
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_VOTE,
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        Permission.EVENT_VIEW,
        Permission.EVENT_CREATE,
    },

    RoleType.FILMMAKER: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.CONTENT_DELETE,
        Permission.WORLD_VIEW,
        Permission.WORLD_CREATE,
        Permission.WORLD_EDIT,
        Permission.WORLD_DELETE,
        Permission.WORLD_PUBLISH,
        Permission.WORLD_ANALYTICS,
        Permission.BACKLOT_VIEW,
        Permission.BACKLOT_CREATE,
        Permission.BACKLOT_MANAGE,
        Permission.BACKLOT_BUDGET,
        Permission.BACKLOT_SCHEDULE,
        Permission.BACKLOT_DAILIES,
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_SUBMIT,
        Permission.GREENROOM_VOTE,
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        Permission.EVENT_VIEW,
        Permission.EVENT_CREATE,
        Permission.EVENT_HOST,
    },

    RoleType.PREMIUM: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.CONTENT_VIEW,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_EDIT,
        Permission.WORLD_VIEW,
        Permission.GREENROOM_VIEW,
        Permission.GREENROOM_VOTE,
        Permission.FORUM_VIEW,
        Permission.FORUM_POST,
        Permission.MESSAGE_SEND,
        Permission.CONNECTION_MANAGE,
        Permission.EVENT_VIEW,
    },

    RoleType.FREE: {
        Permission.USER_VIEW,
        Permission.USER_EDIT,
        Permission.CONTENT_VIEW,
        Permission.WORLD_VIEW,
        Permission.GREENROOM_VIEW,
        Permission.FORUM_VIEW,
        Permission.EVENT_VIEW,
    },
}


def get_permissions_for_profile(profile: Dict[str, Any]) -> Set[Permission]:
    """
    Get all permissions for a user profile based on their roles.

    Args:
        profile: User profile dictionary with role flags

    Returns:
        Set of all permissions the user has
    """
    active_roles = get_active_roles_from_profile(profile)
    permissions: Set[Permission] = set()

    for role in active_roles:
        if role in ROLE_PERMISSIONS:
            permissions.update(ROLE_PERMISSIONS[role])

    return permissions


def has_permission(profile: Dict[str, Any], permission: Permission) -> bool:
    """
    Check if a profile has a specific permission.

    Args:
        profile: User profile dictionary
        permission: The permission to check

    Returns:
        True if user has the permission
    """
    return permission in get_permissions_for_profile(profile)


def has_any_permission(profile: Dict[str, Any], permissions: List[Permission]) -> bool:
    """
    Check if a profile has any of the specified permissions.

    Args:
        profile: User profile dictionary
        permissions: List of permissions to check

    Returns:
        True if user has at least one permission
    """
    user_permissions = get_permissions_for_profile(profile)
    return bool(user_permissions & set(permissions))


def has_all_permissions(profile: Dict[str, Any], permissions: List[Permission]) -> bool:
    """
    Check if a profile has all of the specified permissions.

    Args:
        profile: User profile dictionary
        permissions: List of permissions to check

    Returns:
        True if user has all permissions
    """
    user_permissions = get_permissions_for_profile(profile)
    return set(permissions).issubset(user_permissions)


# ============================================================================
# FastAPI Dependencies
# ============================================================================

def require_permissions(*permissions: Permission):
    """
    Factory function to create a dependency that requires specific permissions.

    Usage:
        @router.get("/admin/users")
        async def list_users(profile = Depends(require_permissions(Permission.USER_MANAGE))):
            pass

        @router.post("/worlds")
        async def create_world(
            profile = Depends(require_permissions(Permission.WORLD_CREATE, Permission.CONTENT_CREATE))
        ):
            pass

    Args:
        permissions: One or more permissions required (user must have ALL)

    Returns:
        FastAPI dependency function
    """
    async def permission_checker(
        profile: Dict[str, Any] = Depends(get_user_profile)
    ) -> Dict[str, Any]:
        if not has_all_permissions(profile, list(permissions)):
            missing = set(permissions) - get_permissions_for_profile(profile)
            missing_names = ", ".join(p.value for p in missing)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {missing_names}"
            )
        return profile

    return permission_checker


def require_any_permission(*permissions: Permission):
    """
    Factory function to create a dependency that requires any of the specified permissions.

    Usage:
        @router.get("/content")
        async def view_content(
            profile = Depends(require_any_permission(Permission.CONTENT_VIEW, Permission.ADMIN_CONTENT))
        ):
            pass

    Args:
        permissions: Permissions to check (user needs at least ONE)

    Returns:
        FastAPI dependency function
    """
    async def permission_checker(
        profile: Dict[str, Any] = Depends(get_user_profile)
    ) -> Dict[str, Any]:
        if not has_any_permission(profile, list(permissions)):
            perm_names = ", ".join(p.value for p in permissions)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of the following permissions required: {perm_names}"
            )
        return profile

    return permission_checker
