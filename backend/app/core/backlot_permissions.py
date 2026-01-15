"""
Backlot Permission Helpers

This module provides permission checking utilities for Backlot project access control.
It implements a layered permission system:
1. Project owner always has full access
2. Showrunners have full access to their assigned projects
3. View profiles define role-based tab/section visibility with view/edit permissions
4. Per-user overrides can customize permissions for specific users
"""
from typing import Dict, Any, Optional, List, Tuple
from app.core.database import get_client


# Default view/edit configs per Backlot role
DEFAULT_VIEW_CONFIGS: Dict[str, Dict[str, Any]] = {
    "showrunner": {
        "tabs": {
            "overview": {"view": True, "edit": True},
            "script": {"view": True, "edit": True},
            "shot-lists": {"view": True, "edit": True},
            "coverage": {"view": True, "edit": True},
            "schedule": {"view": True, "edit": True},
            "call-sheets": {"view": True, "edit": True},
            "casting": {"view": True, "edit": True},
            "locations": {"view": True, "edit": True},
            "gear": {"view": True, "edit": True},
            "dailies": {"view": True, "edit": True},
            "review": {"view": True, "edit": True},
            "assets": {"view": True, "edit": True},
            "budget": {"view": True, "edit": True},
            "daily-budget": {"view": True, "edit": True},
            "receipts": {"view": True, "edit": True},
            "analytics": {"view": True, "edit": True},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": True, "edit": True},
            "clearances": {"view": True, "edit": True},
            "credits": {"view": True, "edit": True},
            "settings": {"view": True, "edit": True},
            "timecards": {"view": True, "edit": True},
            "scene-view": {"view": True, "edit": True},
            "day-view": {"view": True, "edit": True},
            "person-view": {"view": True, "edit": True},
            "access": {"view": True, "edit": True},
            # Camera & Continuity tools
            "camera-continuity": {"view": True, "edit": True},
            "camera": {"view": True, "edit": True},
            # Continuity workspace
            "continuity": {"view": True, "edit": True},
            # Utilities
            "checkin": {"view": True, "edit": True},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": True, "edit": True},
            "admin_tools": {"view": True, "edit": True},
            # Camera & Continuity sub-sections
            "shot_list": {"view": True, "edit": True},
            "slate_logger": {"view": True, "edit": True},
            "camera_media": {"view": True, "edit": True},
            "continuity_notes": {"view": True, "edit": True},
            # Continuity workspace sections
            "lining_marks": {"view": True, "edit": True},
            "take_notes": {"view": True, "edit": True},
            "continuity_photos": {"view": True, "edit": True},
            # Utility sections
            "day_settings": {"view": True, "edit": True},
            "checkin_admin": {"view": True, "edit": True},
        },
    },
    "producer": {
        "tabs": {
            "overview": {"view": True, "edit": True},
            "script": {"view": True, "edit": True},
            "shot-lists": {"view": True, "edit": True},
            "coverage": {"view": True, "edit": True},
            "schedule": {"view": True, "edit": True},
            "call-sheets": {"view": True, "edit": True},
            "casting": {"view": True, "edit": True},
            "locations": {"view": True, "edit": True},
            "gear": {"view": True, "edit": True},
            "dailies": {"view": True, "edit": True},
            "review": {"view": True, "edit": True},
            "assets": {"view": True, "edit": True},
            "budget": {"view": True, "edit": True},
            "daily-budget": {"view": True, "edit": True},
            "receipts": {"view": True, "edit": True},
            "analytics": {"view": True, "edit": True},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": True, "edit": True},
            "clearances": {"view": True, "edit": True},
            "credits": {"view": True, "edit": True},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": True},
            "scene-view": {"view": True, "edit": True},
            "day-view": {"view": True, "edit": True},
            "person-view": {"view": True, "edit": True},
            "access": {"view": True, "edit": False},
            # Camera & Continuity tools
            "camera-continuity": {"view": True, "edit": True},
            "camera": {"view": True, "edit": True},
            # Continuity workspace - view only for producer
            "continuity": {"view": True, "edit": False},
            # Utilities
            "checkin": {"view": True, "edit": True},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": True, "edit": True},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections
            "shot_list": {"view": True, "edit": True},
            "slate_logger": {"view": True, "edit": True},
            "camera_media": {"view": True, "edit": True},
            "continuity_notes": {"view": True, "edit": True},
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": True},
            "checkin_admin": {"view": True, "edit": True},
        },
    },
    "director": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": True},
            "shot-lists": {"view": True, "edit": True},
            "coverage": {"view": True, "edit": True},
            "schedule": {"view": True, "edit": True},
            "call-sheets": {"view": True, "edit": False},
            "casting": {"view": True, "edit": True},
            "locations": {"view": True, "edit": False},
            "gear": {"view": True, "edit": False},
            "dailies": {"view": True, "edit": False},
            "review": {"view": True, "edit": True},
            "assets": {"view": True, "edit": False},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": False, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": True, "edit": False},
            "clearances": {"view": True, "edit": False},
            "credits": {"view": True, "edit": True},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": False},
            "scene-view": {"view": True, "edit": False},
            "day-view": {"view": True, "edit": False},
            "person-view": {"view": True, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools
            "camera-continuity": {"view": True, "edit": True},
            "camera": {"view": True, "edit": True},
            # Continuity workspace - view only for director
            "continuity": {"view": True, "edit": False},
            # Utilities
            "checkin": {"view": True, "edit": False},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections
            "shot_list": {"view": True, "edit": True},
            "slate_logger": {"view": True, "edit": False},
            "camera_media": {"view": True, "edit": False},
            "continuity_notes": {"view": True, "edit": True},
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": False},
            "checkin_admin": {"view": False, "edit": False},
        },
    },
    "first_ad": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": False},
            "shot-lists": {"view": True, "edit": True},
            "coverage": {"view": True, "edit": True},
            "schedule": {"view": True, "edit": True},
            "call-sheets": {"view": True, "edit": True},
            "casting": {"view": True, "edit": False},
            "locations": {"view": True, "edit": False},
            "gear": {"view": True, "edit": False},
            "dailies": {"view": True, "edit": False},
            "review": {"view": True, "edit": False},
            "assets": {"view": False, "edit": False},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": True, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": True, "edit": False},
            "clearances": {"view": True, "edit": False},
            "credits": {"view": False, "edit": False},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": True},
            "scene-view": {"view": True, "edit": False},
            "day-view": {"view": True, "edit": False},
            "person-view": {"view": True, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools
            "camera-continuity": {"view": True, "edit": True},
            "camera": {"view": True, "edit": True},
            # Continuity workspace - view only for 1st AD
            "continuity": {"view": True, "edit": False},
            # Utilities
            "checkin": {"view": True, "edit": True},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections
            "shot_list": {"view": True, "edit": True},
            "slate_logger": {"view": True, "edit": True},
            "camera_media": {"view": True, "edit": False},
            "continuity_notes": {"view": True, "edit": False},
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": True},
            "checkin_admin": {"view": True, "edit": True},
        },
    },
    "dp": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": False},
            "shot-lists": {"view": True, "edit": True},
            "coverage": {"view": True, "edit": True},
            "schedule": {"view": True, "edit": False},
            "call-sheets": {"view": True, "edit": False},
            "casting": {"view": False, "edit": False},
            "locations": {"view": True, "edit": False},
            "gear": {"view": True, "edit": True},
            "dailies": {"view": True, "edit": True},
            "review": {"view": True, "edit": False},
            "assets": {"view": False, "edit": False},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": False, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": False, "edit": False},
            "clearances": {"view": False, "edit": False},
            "credits": {"view": False, "edit": False},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": False},
            "scene-view": {"view": True, "edit": False},
            "day-view": {"view": True, "edit": False},
            "person-view": {"view": False, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools - DP has full access
            "camera-continuity": {"view": True, "edit": True},
            "camera": {"view": True, "edit": True},
            # Continuity workspace - view only for DP
            "continuity": {"view": True, "edit": False},
            # Utilities
            "checkin": {"view": True, "edit": False},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections - DP has full edit on camera tools
            "shot_list": {"view": True, "edit": True},
            "slate_logger": {"view": True, "edit": True},
            "camera_media": {"view": True, "edit": True},
            "continuity_notes": {"view": True, "edit": True},
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": False},
            "checkin_admin": {"view": False, "edit": False},
        },
    },
    "editor": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": False},
            "shot-lists": {"view": True, "edit": False},
            "coverage": {"view": True, "edit": False},
            "schedule": {"view": False, "edit": False},
            "call-sheets": {"view": False, "edit": False},
            "casting": {"view": False, "edit": False},
            "locations": {"view": False, "edit": False},
            "gear": {"view": False, "edit": False},
            "dailies": {"view": True, "edit": True},
            "review": {"view": True, "edit": True},
            "assets": {"view": True, "edit": True},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": False, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": False, "edit": False},
            "clearances": {"view": False, "edit": False},
            "credits": {"view": True, "edit": True},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": False},
            "scene-view": {"view": True, "edit": False},
            "day-view": {"view": True, "edit": False},
            "person-view": {"view": False, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools - editor has view only
            "camera-continuity": {"view": True, "edit": False},
            "camera": {"view": True, "edit": False},
            # Continuity workspace - view only for editor
            "continuity": {"view": True, "edit": False},
            # Utilities
            "checkin": {"view": True, "edit": False},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections - view only
            "shot_list": {"view": True, "edit": False},
            "slate_logger": {"view": True, "edit": False},
            "camera_media": {"view": True, "edit": False},
            "continuity_notes": {"view": True, "edit": False},
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": False},
            "checkin_admin": {"view": False, "edit": False},
        },
    },
    "department_head": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": False},
            "shot-lists": {"view": True, "edit": False},
            "coverage": {"view": False, "edit": False},
            "schedule": {"view": True, "edit": True},
            "call-sheets": {"view": True, "edit": False},
            "casting": {"view": False, "edit": False},
            "locations": {"view": True, "edit": False},
            "gear": {"view": True, "edit": False},
            "dailies": {"view": True, "edit": False},
            "review": {"view": False, "edit": False},
            "assets": {"view": False, "edit": False},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": False, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": True, "edit": False},
            "clearances": {"view": False, "edit": False},
            "credits": {"view": False, "edit": False},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": False},
            "scene-view": {"view": True, "edit": False},
            "day-view": {"view": True, "edit": False},
            "person-view": {"view": False, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools - dept head can view, edit continuity for their dept
            "camera-continuity": {"view": True, "edit": False},
            "camera": {"view": True, "edit": False},
            # Continuity workspace - view only for department head
            "continuity": {"view": True, "edit": False},
            # Utilities
            "checkin": {"view": True, "edit": False},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections
            "shot_list": {"view": True, "edit": False},
            "slate_logger": {"view": True, "edit": False},
            "camera_media": {"view": True, "edit": False},
            "continuity_notes": {"view": True, "edit": True},  # Can edit for their department
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": False},
            "checkin_admin": {"view": False, "edit": False},
        },
    },
    "crew": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": False},
            "shot-lists": {"view": False, "edit": False},
            "coverage": {"view": False, "edit": False},
            "schedule": {"view": True, "edit": False},
            "call-sheets": {"view": True, "edit": False},
            "casting": {"view": False, "edit": False},
            "locations": {"view": False, "edit": False},
            "gear": {"view": False, "edit": False},
            "dailies": {"view": False, "edit": False},
            "review": {"view": False, "edit": False},
            "assets": {"view": False, "edit": False},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": False, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": False},
            "updates": {"view": True, "edit": False},
            "contacts": {"view": False, "edit": False},
            "clearances": {"view": False, "edit": False},
            "credits": {"view": False, "edit": False},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": False},
            "scene-view": {"view": True, "edit": False},
            "day-view": {"view": True, "edit": False},
            "person-view": {"view": False, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools - crew has view only
            "camera-continuity": {"view": True, "edit": False},
            "camera": {"view": True, "edit": False},
            # Continuity workspace - crew has view only
            "continuity": {"view": True, "edit": False},
            # Utilities - can check in
            "checkin": {"view": True, "edit": False},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections - view only
            "shot_list": {"view": True, "edit": False},
            "slate_logger": {"view": True, "edit": False},
            "camera_media": {"view": True, "edit": False},
            "continuity_notes": {"view": True, "edit": False},
            # Continuity workspace sections - view only
            "lining_marks": {"view": True, "edit": False},
            "take_notes": {"view": True, "edit": False},
            "continuity_photos": {"view": True, "edit": False},
            # Utility sections
            "day_settings": {"view": True, "edit": False},
            "checkin_admin": {"view": False, "edit": False},
        },
    },
    # Script Supervisor - full access to Continuity workspace
    "script_supervisor": {
        "tabs": {
            "overview": {"view": True, "edit": False},
            "script": {"view": True, "edit": True},
            "shot-lists": {"view": True, "edit": True},
            "coverage": {"view": True, "edit": True},
            "schedule": {"view": True, "edit": False},
            "call-sheets": {"view": True, "edit": False},
            "casting": {"view": False, "edit": False},
            "locations": {"view": True, "edit": False},
            "gear": {"view": True, "edit": False},
            "dailies": {"view": True, "edit": False},
            "review": {"view": True, "edit": False},
            "assets": {"view": False, "edit": False},
            "budget": {"view": False, "edit": False},
            "daily-budget": {"view": False, "edit": False},
            "receipts": {"view": False, "edit": False},
            "analytics": {"view": False, "edit": False},
            "tasks": {"view": True, "edit": True},
            "updates": {"view": True, "edit": True},
            "contacts": {"view": True, "edit": False},
            "clearances": {"view": False, "edit": False},
            "credits": {"view": True, "edit": False},
            "settings": {"view": False, "edit": False},
            "timecards": {"view": True, "edit": True},
            "scene-view": {"view": True, "edit": True},
            "day-view": {"view": True, "edit": True},
            "person-view": {"view": True, "edit": False},
            "access": {"view": False, "edit": False},
            # Camera & Continuity tools - full access
            "camera-continuity": {"view": True, "edit": True},
            "camera": {"view": True, "edit": True},
            # Continuity workspace - FULL ACCESS (primary role)
            "continuity": {"view": True, "edit": True},
            # Utilities
            "checkin": {"view": True, "edit": False},
            "my-space": {"view": True, "edit": True},
        },
        "sections": {
            "budget_numbers": {"view": False, "edit": False},
            "admin_tools": {"view": False, "edit": False},
            # Camera & Continuity sub-sections - full access
            "shot_list": {"view": True, "edit": True},
            "slate_logger": {"view": True, "edit": True},
            "camera_media": {"view": True, "edit": True},
            "continuity_notes": {"view": True, "edit": True},
            # Continuity workspace sections - FULL ACCESS
            "lining_marks": {"view": True, "edit": True},
            "take_notes": {"view": True, "edit": True},
            "continuity_photos": {"view": True, "edit": True},
            # Utility sections
            "day_settings": {"view": True, "edit": True},
            "checkin_admin": {"view": False, "edit": False},
        },
    },
}


def normalize_permission_value(value: Any) -> Dict[str, bool]:
    """
    Normalize a permission value to {view, edit} format.
    Handles both boolean (legacy) and object formats.
    """
    if isinstance(value, bool):
        # Legacy boolean format: true = view only, edit follows role defaults
        return {"view": value, "edit": False}
    elif isinstance(value, dict):
        return {
            "view": value.get("view", False),
            "edit": value.get("edit", False),
        }
    return {"view": False, "edit": False}


def merge_configs(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge an override config into a base config.
    Override values take precedence.
    """
    result = {
        "tabs": dict(base.get("tabs", {})),
        "sections": dict(base.get("sections", {})),
    }

    # Merge tabs
    if "tabs" in override:
        for key, value in override["tabs"].items():
            result["tabs"][key] = normalize_permission_value(value)

    # Merge sections
    if "sections" in override:
        for key, value in override["sections"].items():
            result["sections"][key] = normalize_permission_value(value)

    return result


async def get_user_backlot_role(project_id: str, user_id: str) -> Optional[str]:
    """
    Get the user's primary Backlot role for a project.
    Returns None if user has no role assigned.
    """
    client = get_client()

    # First check for primary role
    response = client.table("backlot_project_roles").select("backlot_role").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).eq(
        "is_primary", True
    ).limit(1).execute()

    if response.data and len(response.data) > 0:
        return response.data[0]["backlot_role"]

    # If no primary, get any role
    response = client.table("backlot_project_roles").select("backlot_role").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).order("created_at").limit(1).execute()

    if response.data and len(response.data) > 0:
        return response.data[0]["backlot_role"]

    return None


async def get_project_view_profile(project_id: str, backlot_role: str) -> Optional[Dict[str, Any]]:
    """
    Get the custom view profile for a role in a project.
    Returns None if no custom profile exists.
    """
    client = get_client()

    response = client.table("backlot_project_view_profiles").select("config").eq(
        "project_id", project_id
    ).eq(
        "backlot_role", backlot_role
    ).eq(
        "is_default", True
    ).limit(1).execute()

    if response.data and len(response.data) > 0:
        return response.data[0]["config"]

    return None


async def get_user_view_override(project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user-specific view permission overrides.
    Returns None if no overrides exist.
    """
    client = get_client()

    response = client.table("backlot_project_view_overrides").select("config").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).limit(1).execute()

    if response.data and len(response.data) > 0:
        return response.data[0]["config"]

    return None


async def is_project_owner(project_id: str, user_id: str) -> bool:
    """Check if user is the project owner."""
    client = get_client()

    response = client.table("backlot_projects").select("owner_id").eq(
        "id", project_id
    ).limit(1).execute()

    if response.data and len(response.data) > 0:
        # Convert both to strings to handle UUID objects from database
        return str(response.data[0]["owner_id"]) == str(user_id)

    return False


async def is_project_showrunner(project_id: str, user_id: str) -> bool:
    """Check if user is a showrunner on the project."""
    client = get_client()

    response = client.table("backlot_project_roles").select("id").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).eq(
        "backlot_role", "showrunner"
    ).limit(1).execute()

    return response.data is not None and len(response.data) > 0


async def is_project_admin(project_id: str, user_id: str) -> bool:
    """Check if user is an admin member on the project."""
    client = get_client()

    response = client.table("backlot_project_members").select("id").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).eq(
        "role", "admin"
    ).limit(1).execute()

    return response.data is not None and len(response.data) > 0


async def can_manage_access(project_id: str, user_id: str) -> bool:
    """
    Check if user can manage team access (add/remove members, modify permissions).
    Returns True for project owners, showrunners, and admins.
    """
    if await is_project_owner(project_id, user_id):
        return True
    if await is_project_showrunner(project_id, user_id):
        return True
    if await is_project_admin(project_id, user_id):
        return True
    return False


async def get_effective_view_config(project_id: str, user_id: str) -> Dict[str, Any]:
    """
    Get the effective view configuration for a user on a project.

    Resolution order:
    1. If project owner -> full access
    2. Check org owner/admin of project's org -> full access
    3. Check org collaborative access -> use org_project_access permissions
    4. Check external seat (freelancer/client) -> use seat permissions
    5. Get user's backlot role -> base config
    6. Check for project-specific view profile -> merge
    7. Check for user-specific overrides -> merge

    Returns config in format:
    {
        "role": "showrunner" | "producer" | etc,
        "is_owner": bool,
        "has_overrides": bool,
        "access_type": "owner" | "org_admin" | "org_collaborative" | "external_seat" | "member",
        "tabs": { "tab_name": { "view": bool, "edit": bool }, ... },
        "sections": { "section_name": { "view": bool, "edit": bool }, ... }
    }
    """
    client = get_client()

    # Check if owner
    if await is_project_owner(project_id, user_id):
        owner_config = DEFAULT_VIEW_CONFIGS["showrunner"].copy()
        return {
            "role": "owner",
            "is_owner": True,
            "has_overrides": False,
            "access_type": "owner",
            **owner_config,
        }

    # Check organization access
    org_access = await get_org_project_access(project_id, user_id)
    if org_access:
        if org_access["role"] in ("owner", "admin"):
            # Org owners/admins get full access to org projects
            owner_config = DEFAULT_VIEW_CONFIGS["showrunner"].copy()
            return {
                "role": "org_admin",
                "is_owner": False,
                "has_overrides": False,
                "access_type": "org_admin",
                "organization_id": org_access["organization_id"],
                **owner_config,
            }
        elif org_access["role"] == "collaborative":
            # Collaborative members get their custom tab permissions
            return {
                "role": "collaborative",
                "is_owner": False,
                "has_overrides": True,
                "access_type": "org_collaborative",
                "organization_id": org_access["organization_id"],
                "tabs": org_access.get("tab_permissions", {}),
                "sections": {},
            }

    # Check external seat (freelancer/client)
    external_seat = await get_external_seat_access(project_id, user_id)
    if external_seat:
        if external_seat["seat_type"] == "project":
            # Freelancers get limited access based on their permissions
            freelancer_tabs = {
                "overview": {"view": True, "edit": False},
                "timecards": {"view": external_seat.get("can_timecard", True), "edit": external_seat.get("can_timecard", True)},
                "receipts": {"view": external_seat.get("can_expense", True), "edit": external_seat.get("can_expense", True)},
            }
            return {
                "role": "freelancer",
                "is_owner": False,
                "has_overrides": True,
                "access_type": "external_seat",
                "seat_type": "project",
                "tabs": freelancer_tabs,
                "sections": {},
            }
        elif external_seat["seat_type"] == "view_only":
            # Clients get custom tab visibility (view only)
            client_tabs = {}
            for tab, visible in (external_seat.get("tab_permissions") or {}).items():
                client_tabs[tab] = {"view": visible, "edit": False}
            return {
                "role": "client",
                "is_owner": False,
                "has_overrides": True,
                "access_type": "external_seat",
                "seat_type": "view_only",
                "tabs": client_tabs,
                "sections": {},
            }

    # Get user's role (standard project member flow)
    backlot_role = await get_user_backlot_role(project_id, user_id)
    if not backlot_role:
        backlot_role = "crew"  # Default to crew if no role assigned

    # Start with default config for role
    base_config = DEFAULT_VIEW_CONFIGS.get(backlot_role, DEFAULT_VIEW_CONFIGS["crew"]).copy()

    # Check for project-specific view profile
    custom_profile = await get_project_view_profile(project_id, backlot_role)
    if custom_profile:
        base_config = merge_configs(base_config, custom_profile)

    # Check for user-specific overrides
    has_overrides = False
    user_override = await get_user_view_override(project_id, user_id)
    if user_override:
        has_overrides = True
        base_config = merge_configs(base_config, user_override)

    return {
        "role": backlot_role,
        "is_owner": False,
        "has_overrides": has_overrides,
        "access_type": "member",
        **base_config,
    }


async def can_view_tab(project_id: str, user_id: str, tab: str) -> bool:
    """
    Check if user can view a specific tab.
    """
    config = await get_effective_view_config(project_id, user_id)
    tab_perms = config.get("tabs", {}).get(tab, {"view": False, "edit": False})
    return normalize_permission_value(tab_perms).get("view", False)


async def can_edit_tab(project_id: str, user_id: str, tab: str) -> bool:
    """
    Check if user can edit content in a specific tab.
    """
    config = await get_effective_view_config(project_id, user_id)
    tab_perms = config.get("tabs", {}).get(tab, {"view": False, "edit": False})
    return normalize_permission_value(tab_perms).get("edit", False)


async def can_view_section(project_id: str, user_id: str, section: str) -> bool:
    """
    Check if user can view a specific section (e.g., budget_numbers).
    """
    config = await get_effective_view_config(project_id, user_id)
    section_perms = config.get("sections", {}).get(section, {"view": False, "edit": False})
    return normalize_permission_value(section_perms).get("view", False)


async def can_edit_section(project_id: str, user_id: str, section: str) -> bool:
    """
    Check if user can edit content in a specific section.
    """
    config = await get_effective_view_config(project_id, user_id)
    section_perms = config.get("sections", {}).get(section, {"view": False, "edit": False})
    return normalize_permission_value(section_perms).get("edit", False)


async def get_all_backlot_roles() -> List[str]:
    """Get list of all valid Backlot roles."""
    return list(DEFAULT_VIEW_CONFIGS.keys())


async def get_default_config_for_role(role: str) -> Dict[str, Any]:
    """Get the default view config for a specific role."""
    return DEFAULT_VIEW_CONFIGS.get(role, DEFAULT_VIEW_CONFIGS["crew"]).copy()


# =============================================================================
# Organization and External Seat Access
# =============================================================================

async def get_org_project_access(project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Check if user has access to project through organization membership.

    Returns organization access info if user is:
    - Owner/admin of the org that owns this project
    - Collaborative member with explicit project access

    Returns None if no org access.
    """
    client = get_client()

    # Get project's organization
    project_resp = client.table("backlot_projects").select("organization_id").eq(
        "id", project_id
    ).limit(1).execute()

    if not project_resp.data or not project_resp.data[0].get("organization_id"):
        return None

    org_id = project_resp.data[0]["organization_id"]

    # Check if user is an org member
    member_resp = client.table("organization_members").select("role, can_create_projects").eq(
        "organization_id", org_id
    ).eq("user_id", user_id).eq("status", "active").limit(1).execute()

    if not member_resp.data:
        return None

    member = member_resp.data[0]
    role = member["role"]

    if role in ("owner", "admin"):
        # Org owners/admins have full access to all org projects
        return {
            "organization_id": org_id,
            "role": role,
            "can_create_projects": True,
        }
    elif role == "collaborative":
        # Collaborative members need explicit project access
        access_resp = client.table("organization_project_access").select("tab_permissions").eq(
            "organization_id", org_id
        ).eq("user_id", user_id).eq("project_id", project_id).limit(1).execute()

        if access_resp.data:
            return {
                "organization_id": org_id,
                "role": role,
                "can_create_projects": member.get("can_create_projects", False),
                "tab_permissions": access_resp.data[0].get("tab_permissions") or {},
            }

    return None


async def get_external_seat_access(project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Check if user has an external seat (freelancer/client) on this project.

    Returns seat info if found, None otherwise.
    """
    client = get_client()

    seat_resp = client.table("backlot_project_external_seats").select("*").eq(
        "project_id", project_id
    ).eq("user_id", user_id).eq("status", "active").limit(1).execute()

    if seat_resp.data:
        return seat_resp.data[0]

    return None


async def has_backlot_access(user_id: str) -> Dict[str, Any]:
    """
    Check if user has Backlot access through any means.

    Returns:
    {
        "has_access": bool,
        "reason": "admin" | "subscription" | "organization_seat" | "no_access",
        "organization_id": str or None,
        "organization_name": str or None,
        "role": str or None,
        "can_create_projects": bool
    }
    """
    from app.core.database import execute_single

    # Check profile flags and subscription
    profile = execute_single("""
        SELECT id, is_admin, is_superadmin, backlot_subscription_status
        FROM profiles WHERE id = :user_id
    """, {"user_id": user_id})

    if not profile:
        return {"has_access": False, "reason": "no_profile"}

    # Admins always have access
    if profile.get("is_admin") or profile.get("is_superadmin"):
        return {"has_access": True, "reason": "admin", "can_create_projects": True}

    # Check individual subscription
    if profile.get("backlot_subscription_status") in ["active", "trialing"]:
        return {"has_access": True, "reason": "subscription", "can_create_projects": True}

    # Check organization seat
    org_seat = execute_single("""
        SELECT
            o.id as organization_id,
            o.name as organization_name,
            om.role,
            om.can_create_projects
        FROM organization_members om
        JOIN organizations o ON om.organization_id = o.id
        WHERE om.user_id = :user_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'collaborative')
          AND o.backlot_enabled = TRUE
          AND o.backlot_billing_status IN ('free', 'trial', 'active')
        LIMIT 1
    """, {"user_id": user_id})

    if org_seat:
        return {
            "has_access": True,
            "reason": "organization_seat",
            "organization_id": org_seat["organization_id"],
            "organization_name": org_seat["organization_name"],
            "role": org_seat["role"],
            "can_create_projects": org_seat["can_create_projects"] or org_seat["role"] in ("owner", "admin"),
        }

    return {"has_access": False, "reason": "no_access", "can_create_projects": False}


async def transfer_work_on_removal(project_id: str, removed_user_id: str, new_owner_id: str = None) -> Dict[str, int]:
    """
    Transfer work items from a removed user to the project owner (or specified user).

    Transfers:
    - Timecards
    - Expenses/receipts
    - Invoices created by user

    Returns counts of transferred items.
    """
    from app.core.database import execute_update, execute_single

    # Get project owner if no new owner specified
    if not new_owner_id:
        project = execute_single(
            "SELECT owner_id FROM backlot_projects WHERE id = :project_id",
            {"project_id": project_id}
        )
        new_owner_id = project["owner_id"] if project else None

    if not new_owner_id:
        return {"error": "No owner found for work transfer"}

    transferred = {
        "timecards": 0,
        "receipts": 0,
        "invoices": 0,
    }

    # Transfer timecards
    result = execute_update("""
        UPDATE backlot_timecards
        SET notes = COALESCE(notes, '') || ' [Transferred from departed team member]'
        WHERE project_id = :project_id AND user_id = :removed_user_id
        RETURNING id
    """, {"project_id": project_id, "removed_user_id": removed_user_id})
    # Note: We don't change user_id as timecards should stay attributed to original worker

    # Transfer receipt/expense ownership
    result = execute_update("""
        UPDATE backlot_receipt_entries
        SET notes = COALESCE(notes, '') || ' [Transferred from departed team member]'
        WHERE project_id = :project_id AND submitted_by = :removed_user_id
        RETURNING id
    """, {"project_id": project_id, "removed_user_id": removed_user_id})

    return transferred
