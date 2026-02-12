"""
Badge System Module
Manages user badges and their display properties.

Badge Hierarchy (descending priority):
1. Superadmin - "SUPERADMIN" (red/gold)
2. Admin - "ADMIN" (yellow)
3. Moderator - "MOD" (purple)
4. Sales Admin - "SALES ADMIN" (teal-cyan gradient)
5. Lodge Officer - "LODGE OFFICER" (gold)
6. Order Member - "ORDER" (emerald)
7. Sales Agent - "SALES" (teal)
8. Sales Rep - "SALES REP" (teal-green gradient)
9. Partner - "PARTNER" (blue)
10. Filmmaker - "FILMMAKER" (accent-yellow)
11. Premium - "PREMIUM" (gradient)
12. Free - "FREE" (gray)
"""
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from app.core.roles import RoleType, get_primary_role, get_active_roles_from_profile


@dataclass
class BadgeConfig:
    """Configuration for a badge type."""
    role: RoleType
    label: str
    short_label: str
    css_class: str  # Tailwind classes for styling
    priority: int  # Lower = higher priority
    description: str


# Badge configurations in priority order
BADGE_CONFIGS: Dict[RoleType, BadgeConfig] = {
    RoleType.SUPERADMIN: BadgeConfig(
        role=RoleType.SUPERADMIN,
        label="Superadmin",
        short_label="SUPERADMIN",
        css_class="bg-gradient-to-r from-red-600 to-yellow-500 text-white font-bold",
        priority=1,
        description="System administrator with full access"
    ),
    RoleType.ADMIN: BadgeConfig(
        role=RoleType.ADMIN,
        label="Admin",
        short_label="ADMIN",
        css_class="bg-accent-yellow text-charcoal-black font-bold",
        priority=2,
        description="Platform administrator"
    ),
    RoleType.MODERATOR: BadgeConfig(
        role=RoleType.MODERATOR,
        label="Moderator",
        short_label="MOD",
        css_class="bg-purple-600 text-white font-bold",
        priority=3,
        description="Content and community moderator"
    ),
    RoleType.SALES_ADMIN: BadgeConfig(
        role=RoleType.SALES_ADMIN,
        label="Sales Admin",
        short_label="SALES ADMIN",
        css_class="bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold",
        priority=4,
        description="CRM management and sales team leadership"
    ),
    RoleType.LODGE_OFFICER: BadgeConfig(
        role=RoleType.LODGE_OFFICER,
        label="Lodge Officer",
        short_label="LODGE OFFICER",
        css_class="bg-gradient-to-r from-yellow-600 to-amber-500 text-white font-bold",
        priority=5,
        description="Order lodge leadership"
    ),
    RoleType.ORDER_MEMBER: BadgeConfig(
        role=RoleType.ORDER_MEMBER,
        label="Order Member",
        short_label="ORDER",
        css_class="bg-emerald-600 text-white font-bold",
        priority=6,
        description="Member of The Second Watch Order"
    ),
    RoleType.SALES_AGENT: BadgeConfig(
        role=RoleType.SALES_AGENT,
        label="Sales Agent",
        short_label="SALES",
        css_class="bg-teal-500 text-white font-bold",
        priority=7,
        description="Sales team member"
    ),
    RoleType.SALES_REP: BadgeConfig(
        role=RoleType.SALES_REP,
        label="Sales Rep",
        short_label="SALES REP",
        css_class="bg-gradient-to-r from-teal-400 to-green-500 text-white font-bold",
        priority=8,
        description="Sales representative with platform access"
    ),
    RoleType.PARTNER: BadgeConfig(
        role=RoleType.PARTNER,
        label="Partner",
        short_label="PARTNER",
        css_class="bg-blue-500 text-white font-bold",
        priority=9,
        description="Business partner or sponsor"
    ),
    RoleType.FILMMAKER: BadgeConfig(
        role=RoleType.FILMMAKER,
        label="Filmmaker",
        short_label="FILMMAKER",
        css_class="bg-accent-yellow/80 text-charcoal-black font-bold",
        priority=10,
        description="Verified content creator"
    ),
    RoleType.PREMIUM: BadgeConfig(
        role=RoleType.PREMIUM,
        label="Premium",
        short_label="PREMIUM",
        css_class="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold",
        priority=11,
        description="Premium subscriber"
    ),
    RoleType.FREE: BadgeConfig(
        role=RoleType.FREE,
        label="Free",
        short_label="FREE",
        css_class="bg-muted-gray text-bone-white",
        priority=12,
        description="Free tier member"
    ),
}


def get_badge_config(role: RoleType) -> BadgeConfig:
    """
    Get badge configuration for a role.

    Args:
        role: The RoleType to get config for

    Returns:
        BadgeConfig for the role
    """
    return BADGE_CONFIGS.get(role, BADGE_CONFIGS[RoleType.FREE])


def get_primary_badge(profile: dict) -> BadgeConfig:
    """
    Get the primary (highest priority) badge for a user profile.

    Args:
        profile: Dictionary with profile data

    Returns:
        BadgeConfig for the user's primary role
    """
    primary_role = get_primary_role(profile)
    return get_badge_config(primary_role)


def get_all_badges(profile: dict) -> List[BadgeConfig]:
    """
    Get all badges for a user profile, sorted by priority.

    Args:
        profile: Dictionary with profile data

    Returns:
        List of BadgeConfig for all active roles, sorted by priority
    """
    active_roles = get_active_roles_from_profile(profile)
    badges = [get_badge_config(role) for role in active_roles]
    return sorted(badges, key=lambda b: b.priority)


def get_badge_for_display(profile: dict) -> Dict[str, Any]:
    """
    Get badge data formatted for frontend display.

    Args:
        profile: Dictionary with profile data

    Returns:
        Dictionary with badge display data
    """
    badge = get_primary_badge(profile)
    return {
        "role": badge.role.value,
        "label": badge.label,
        "short_label": badge.short_label,
        "css_class": badge.css_class,
        "description": badge.description,
    }


def get_all_badges_for_display(profile: dict) -> List[Dict[str, Any]]:
    """
    Get all badges formatted for frontend display.

    Args:
        profile: Dictionary with profile data

    Returns:
        List of badge display data dictionaries
    """
    badges = get_all_badges(profile)
    return [
        {
            "role": badge.role.value,
            "label": badge.label,
            "short_label": badge.short_label,
            "css_class": badge.css_class,
            "description": badge.description,
        }
        for badge in badges
    ]


# Export badge data for frontend sync
def get_badge_definitions() -> Dict[str, Dict[str, Any]]:
    """
    Get all badge definitions for frontend synchronization.

    Returns:
        Dictionary mapping role names to their badge configurations
    """
    return {
        role.value: {
            "label": config.label,
            "short_label": config.short_label,
            "css_class": config.css_class,
            "priority": config.priority,
            "description": config.description,
        }
        for role, config in BADGE_CONFIGS.items()
    }
