"""
FastAPI Dependencies for Role-Based Access Control
Provides dependency injection functions for protecting routes based on user roles.

Usage:
    from app.core.deps import require_admin, require_order_member

    @router.get("/admin-only")
    async def admin_route(user = Depends(require_admin)):
        # Only admins can access
        pass

    @router.get("/order-route")
    async def order_route(profile = Depends(require_order_member)):
        # Only order members can access
        pass
"""
from fastapi import Depends, HTTPException, status
from typing import Optional, List, Dict, Any

from app.core.auth import get_current_user, get_current_user_optional
from app.core.database import get_client
from app.core.roles import (
    RoleType,
    get_active_roles_from_profile,
    get_primary_role,
    has_role,
    has_any_role,
    is_superadmin,
    is_admin_or_higher,
    is_staff,
    can_access_order,
    can_manage_lodge,
    can_submit_to_greenroom,
    can_vote_in_greenroom,
    can_access_partner_tools,
)
from app.core.badges import get_badge_for_display, get_all_badges_for_display


async def get_user_profile(user = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get the current user's profile from the database.

    Args:
        user: The authenticated user from Cognito

    Returns:
        Profile dictionary with user data and role flags

    Raises:
        HTTPException: If profile not found or database error
    """
    try:
        client = get_client()
        user_id = user["id"]

        response = client.table("profiles").select("*").eq("id", user_id).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load user profile: {str(e)}"
        )


async def get_user_profile_optional(
    user = Depends(get_current_user_optional)
) -> Optional[Dict[str, Any]]:
    """
    Get the current user's profile if authenticated.

    Args:
        user: The authenticated user from Cognito (optional)

    Returns:
        Profile dictionary or None if not authenticated
    """
    if not user:
        return None

    try:
        client = get_client()
        user_id = user["id"]

        response = client.table("profiles").select("*").eq("id", user_id).single().execute()
        return response.data

    except Exception:
        return None


async def get_user_with_badge(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Get user profile with primary badge information included.

    Args:
        profile: User profile from get_user_profile

    Returns:
        Profile with 'primary_badge' and 'all_badges' fields added
    """
    profile_copy = dict(profile)
    profile_copy["primary_badge"] = get_badge_for_display(profile)
    profile_copy["all_badges"] = get_all_badges_for_display(profile)
    return profile_copy


# ============================================================================
# Role Requirement Dependencies
# ============================================================================

async def require_superadmin(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require superadmin role for access.

    Raises:
        HTTPException: If user is not a superadmin
    """
    if not is_superadmin(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    return profile


async def require_admin(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require admin or superadmin role for access.

    Raises:
        HTTPException: If user is not an admin or superadmin
    """
    if not is_admin_or_higher(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return profile


async def require_staff(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require staff role (superadmin, admin, or moderator) for access.

    Raises:
        HTTPException: If user is not staff
    """
    if not is_staff(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )
    return profile


async def require_moderator(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require moderator, admin, or superadmin role for access.
    Alias for require_staff.

    Raises:
        HTTPException: If user is not a moderator or higher
    """
    return await require_staff(profile)


async def require_order_member(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require Order membership for access.

    Raises:
        HTTPException: If user is not an Order member
    """
    if not can_access_order(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order membership required"
        )
    return profile


async def require_lodge_officer(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require lodge officer role for access.

    Raises:
        HTTPException: If user is not a lodge officer or admin
    """
    if not can_manage_lodge(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lodge officer access required"
        )
    return profile


async def require_filmmaker(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require filmmaker role for access.

    Raises:
        HTTPException: If user is not a filmmaker or admin
    """
    if not can_submit_to_greenroom(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Filmmaker access required"
        )
    return profile


async def require_sales_admin(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require sales admin, admin, or superadmin role for CRM management.

    Raises:
        HTTPException: If user is not a sales admin or higher
    """
    if not has_any_role(profile, [RoleType.SALES_ADMIN, RoleType.ADMIN, RoleType.SUPERADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales admin access required"
        )
    return profile


async def require_sales_agent(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require sales agent, sales admin, admin, or superadmin role for CRM access.

    Raises:
        HTTPException: If user is not a sales agent or admin
    """
    if not has_any_role(profile, [RoleType.SALES_AGENT, RoleType.SALES_REP, RoleType.SALES_ADMIN, RoleType.ADMIN, RoleType.SUPERADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales agent access required"
        )
    return profile


async def require_sales_rep(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require sales rep, sales agent, sales admin, admin, or superadmin role for access.

    Raises:
        HTTPException: If user is not a sales rep or higher
    """
    if not has_any_role(profile, [RoleType.SALES_REP, RoleType.SALES_AGENT, RoleType.SALES_ADMIN, RoleType.ADMIN, RoleType.SUPERADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales rep access required"
        )
    return profile


async def require_partner(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require partner role for access.

    Raises:
        HTTPException: If user is not a partner or admin
    """
    if not can_access_partner_tools(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner access required"
        )
    return profile


async def require_premium(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require premium subscription for access.

    Raises:
        HTTPException: If user is not premium or staff
    """
    if not has_any_role(profile, [RoleType.PREMIUM, RoleType.SUPERADMIN, RoleType.ADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required"
        )
    return profile


async def require_greenroom_voter(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
    """
    Require ability to vote in Green Room.

    Raises:
        HTTPException: If user cannot vote in Green Room
    """
    if not can_vote_in_greenroom(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium, Filmmaker, or Partner membership required to vote"
        )
    return profile


async def require_premium_content_access(
    profile: Dict[str, Any] = Depends(get_user_profile)
) -> Dict[str, Any]:
    """
    Require access to premium streaming content.

    Premium content access is granted to:
    - All Order members (BASE tier and above)
    - Staff members (admin, moderator, superadmin)
    - Premium subscribers

    This is used to gate access to premium World episodes.

    Raises:
        HTTPException: If user doesn't have premium content access
    """
    # Order members get premium access (any tier)
    if profile.get("is_order_member"):
        return profile

    # Staff always have access
    if is_staff(profile):
        return profile

    # Premium subscribers have access
    if has_role(profile, RoleType.PREMIUM):
        return profile

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Order membership or premium subscription required for this content"
    )


async def require_premium_content_access_optional(
    profile: Optional[Dict[str, Any]] = Depends(get_user_profile_optional)
) -> Optional[Dict[str, Any]]:
    """
    Check premium content access without requiring authentication.

    Returns the profile if user has access, None otherwise.
    Useful for showing different UI based on access level.
    """
    if not profile:
        return None

    # Check same conditions as require_premium_content_access
    if profile.get("is_order_member"):
        return profile

    if is_staff(profile):
        return profile

    if has_role(profile, RoleType.PREMIUM):
        return profile

    return None


# ============================================================================
# Flexible Role Requirement Factory
# ============================================================================

def require_any_role(*roles: RoleType):
    """
    Factory function to create a dependency that requires any of the specified roles.

    Usage:
        @router.get("/mixed-route")
        async def route(profile = Depends(require_any_role(RoleType.ADMIN, RoleType.PARTNER))):
            pass
    """
    async def role_checker(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
        if not has_any_role(profile, list(roles)):
            role_names = ", ".join(r.value for r in roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of the following roles required: {role_names}"
            )
        return profile

    return role_checker


def require_all_roles(*roles: RoleType):
    """
    Factory function to create a dependency that requires all of the specified roles.

    Usage:
        @router.get("/multi-role-route")
        async def route(profile = Depends(require_all_roles(RoleType.FILMMAKER, RoleType.ORDER_MEMBER))):
            pass
    """
    async def role_checker(profile: Dict[str, Any] = Depends(get_user_profile)) -> Dict[str, Any]:
        active = get_active_roles_from_profile(profile)
        required = set(roles)
        if not required.issubset(active):
            role_names = ", ".join(r.value for r in roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"All of the following roles required: {role_names}"
            )
        return profile

    return role_checker
