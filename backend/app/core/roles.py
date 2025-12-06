"""
Core Roles & Permissions Module
Centralized role definitions and permission checking for Second Watch Network.

Role Hierarchy (highest to lowest priority):
1. Superadmin - God mode, full system access
2. Admin - Can manage users, content, and moderate
3. Moderator - Can moderate content and users
4. Lodge Officer - Order lodge leadership
5. Order Member - Member of The Second Watch Order
6. Partner - Business/sponsor partner
7. Filmmaker - Content creator with verified profile
8. Premium - Paid subscriber
9. Free - Basic registered user

Note: Users can have multiple flags set (e.g., is_admin AND is_order_member).
The "primary role" for display purposes follows the hierarchy above.
"""
from typing import Optional, List, Set
from enum import Enum


class RoleType(str, Enum):
    """Role type enumeration for badge display and hierarchy."""
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    MODERATOR = "moderator"
    LODGE_OFFICER = "lodge_officer"
    ORDER_MEMBER = "order_member"
    PARTNER = "partner"
    FILMMAKER = "filmmaker"
    PREMIUM = "premium"
    FREE = "free"


# Role hierarchy - lower index = higher priority
ROLE_HIERARCHY: List[RoleType] = [
    RoleType.SUPERADMIN,
    RoleType.ADMIN,
    RoleType.MODERATOR,
    RoleType.LODGE_OFFICER,
    RoleType.ORDER_MEMBER,
    RoleType.PARTNER,
    RoleType.FILMMAKER,
    RoleType.PREMIUM,
    RoleType.FREE,
]


# Map of profile fields to role types
# The profile table has boolean flags for each role
PROFILE_ROLE_FIELDS = {
    "is_superadmin": RoleType.SUPERADMIN,
    "is_admin": RoleType.ADMIN,
    "is_moderator": RoleType.MODERATOR,
    "is_lodge_officer": RoleType.LODGE_OFFICER,
    "is_order_member": RoleType.ORDER_MEMBER,
    "is_partner": RoleType.PARTNER,
    "is_filmmaker": RoleType.FILMMAKER,
    "is_premium": RoleType.PREMIUM,
}


def get_active_roles_from_profile(profile: dict) -> Set[RoleType]:
    """
    Extract active roles from a profile dict (Supabase row).

    Args:
        profile: Dictionary with profile data including role boolean fields

    Returns:
        Set of active RoleType values
    """
    if not profile:
        return {RoleType.FREE}

    active_roles: Set[RoleType] = set()

    for field, role in PROFILE_ROLE_FIELDS.items():
        if profile.get(field, False):
            active_roles.add(role)

    # Also check legacy 'role' field for backwards compatibility
    legacy_role = profile.get("role")
    if legacy_role:
        legacy_map = {
            "admin": RoleType.ADMIN,
            "moderator": RoleType.MODERATOR,
            "partner": RoleType.PARTNER,
            "filmmaker": RoleType.FILMMAKER,
            "premium": RoleType.PREMIUM,
            "free": RoleType.FREE,
        }
        if legacy_role in legacy_map:
            active_roles.add(legacy_map[legacy_role])

    # Everyone has at least FREE role
    if not active_roles:
        active_roles.add(RoleType.FREE)

    return active_roles


def get_primary_role(profile: dict) -> RoleType:
    """
    Get the highest-priority role for display (badge) purposes.

    Args:
        profile: Dictionary with profile data

    Returns:
        The highest priority RoleType the user has
    """
    active_roles = get_active_roles_from_profile(profile)

    # Return highest priority role based on hierarchy
    for role in ROLE_HIERARCHY:
        if role in active_roles:
            return role

    return RoleType.FREE


def has_role(profile: dict, role: RoleType) -> bool:
    """
    Check if profile has a specific role.

    Args:
        profile: Dictionary with profile data
        role: The role to check for

    Returns:
        True if user has the specified role
    """
    active_roles = get_active_roles_from_profile(profile)
    return role in active_roles


def has_any_role(profile: dict, roles: List[RoleType]) -> bool:
    """
    Check if profile has any of the specified roles.

    Args:
        profile: Dictionary with profile data
        roles: List of roles to check

    Returns:
        True if user has at least one of the specified roles
    """
    active_roles = get_active_roles_from_profile(profile)
    return bool(active_roles & set(roles))


def has_all_roles(profile: dict, roles: List[RoleType]) -> bool:
    """
    Check if profile has all of the specified roles.

    Args:
        profile: Dictionary with profile data
        roles: List of roles to check

    Returns:
        True if user has all of the specified roles
    """
    active_roles = get_active_roles_from_profile(profile)
    return set(roles).issubset(active_roles)


def is_staff(profile: dict) -> bool:
    """
    Check if user is staff (superadmin, admin, or moderator).

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user has any staff role
    """
    return has_any_role(profile, [RoleType.SUPERADMIN, RoleType.ADMIN, RoleType.MODERATOR])


def is_admin_or_higher(profile: dict) -> bool:
    """
    Check if user is admin or superadmin.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user is admin or superadmin
    """
    return has_any_role(profile, [RoleType.SUPERADMIN, RoleType.ADMIN])


def is_superadmin(profile: dict) -> bool:
    """
    Check if user is superadmin (god mode).

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user is superadmin
    """
    return has_role(profile, RoleType.SUPERADMIN)


def can_manage_users(profile: dict) -> bool:
    """
    Check if user can manage other users.
    Only admins and superadmins can manage users.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can manage users
    """
    return is_admin_or_higher(profile)


def can_moderate(profile: dict) -> bool:
    """
    Check if user can moderate content.
    Superadmins, admins, and moderators can moderate.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can moderate
    """
    return is_staff(profile)


def can_access_order(profile: dict) -> bool:
    """
    Check if user can access Order features.
    Must be an Order member, lodge officer, or staff.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can access Order features
    """
    return has_any_role(profile, [
        RoleType.SUPERADMIN,
        RoleType.ADMIN,
        RoleType.MODERATOR,
        RoleType.ORDER_MEMBER,
        RoleType.LODGE_OFFICER,
    ])


def can_manage_lodge(profile: dict) -> bool:
    """
    Check if user can manage lodge settings.
    Must be a lodge officer or staff.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can manage lodge
    """
    return has_any_role(profile, [
        RoleType.SUPERADMIN,
        RoleType.ADMIN,
        RoleType.LODGE_OFFICER,
    ])


def can_submit_to_greenroom(profile: dict) -> bool:
    """
    Check if user can submit projects to Green Room.
    Must be a filmmaker or staff.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can submit to Green Room
    """
    return has_any_role(profile, [
        RoleType.SUPERADMIN,
        RoleType.ADMIN,
        RoleType.FILMMAKER,
    ])


def can_vote_in_greenroom(profile: dict) -> bool:
    """
    Check if user can vote in Green Room.
    Premium subscribers, filmmakers, partners, and staff can vote.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can vote in Green Room
    """
    return has_any_role(profile, [
        RoleType.SUPERADMIN,
        RoleType.ADMIN,
        RoleType.MODERATOR,
        RoleType.PARTNER,
        RoleType.FILMMAKER,
        RoleType.PREMIUM,
    ])


def can_access_partner_tools(profile: dict) -> bool:
    """
    Check if user can access partner/sponsor tools.
    Must be a partner or staff.

    Args:
        profile: Dictionary with profile data

    Returns:
        True if user can access partner tools
    """
    return has_any_role(profile, [
        RoleType.SUPERADMIN,
        RoleType.ADMIN,
        RoleType.PARTNER,
    ])
