"""
Dashboard Settings API
Handles user dashboard customization and theme preferences
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_client, execute_insert, execute_single, execute_query
from app.api.users import get_profile_id_from_cognito_id
import jwt
import json
from datetime import datetime

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class SectionCustomization(BaseModel):
    sectionId: str
    visible: bool = True
    order: int = 0
    size: str = "medium"  # small, medium, large


class CustomWidget(BaseModel):
    id: str
    type: str = "quick_link"  # quick_link, note, countdown
    label: str
    href: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0


class DashboardSettingsUpdate(BaseModel):
    sections: List[SectionCustomization]
    custom_widgets: Optional[List[CustomWidget]] = []
    quick_actions_order: Optional[List[str]] = []
    layout_mode: Optional[str] = "auto"


class DashboardTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "private"
    target_roles: Optional[List[str]] = []
    sections: List[SectionCustomization]
    custom_widgets: Optional[List[CustomWidget]] = []
    layout_mode: Optional[str] = "auto"


# ============================================================================
# HELPERS
# ============================================================================

def get_user_id_from_token(authorization: str) -> str:
    """Extract user ID from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    try:
        # Decode without verification (verification happens at API Gateway)
        decoded = jwt.decode(token, options={"verify_signature": False})
        cognito_id = decoded.get("sub")
        if not cognito_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Get profile ID from Cognito ID
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        return profile_id
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_user_effective_role(user_id: str) -> str:
    """Get user's highest priority role"""
    client = get_client()
    try:
        response = client.table("profiles").select(
            "is_superadmin, is_admin, is_moderator, is_filmmaker, is_partner, is_premium, is_order_member, is_lodge_officer"
        ).eq("id", user_id).single().execute()

        if not response.data:
            return "free"

        profile = response.data

        # Return highest priority role
        if profile.get("is_superadmin"):
            return "superadmin"
        if profile.get("is_admin"):
            return "admin"
        if profile.get("is_moderator"):
            return "moderator"
        if profile.get("is_lodge_officer"):
            return "lodge_officer"
        if profile.get("is_order_member"):
            return "order_member"
        if profile.get("is_partner"):
            return "partner"
        if profile.get("is_filmmaker"):
            return "filmmaker"
        if profile.get("is_premium"):
            return "premium"

        return "free"
    except Exception:
        return "free"


# ============================================================================
# USER DASHBOARD SETTINGS
# ============================================================================

@router.get("/me")
async def get_my_dashboard_settings(authorization: str = Header(None)):
    """Get current user's dashboard settings, or role defaults if none exist"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Try to get user's custom settings
        response = client.table("user_dashboard_settings").select("*").eq("user_id", user_id).single().execute()

        if response.data:
            return {
                "customization": response.data,
                "isCustomized": True
            }
    except Exception:
        pass

    # No custom settings - get role defaults
    role = get_user_effective_role(user_id)

    try:
        defaults = client.table("role_default_dashboards").select("*").eq("role_name", role).single().execute()

        if defaults.data:
            return {
                "customization": {
                    "sections": defaults.data.get("sections", []),
                    "custom_widgets": defaults.data.get("default_widgets", []),
                    "quick_actions_order": defaults.data.get("quick_actions_order", []),
                    "layout_mode": defaults.data.get("layout_mode", "auto"),
                    "derived_from_role": role
                },
                "isCustomized": False,
                "effectiveRole": role
            }
    except Exception:
        pass

    # Fallback - return empty config
    return {
        "customization": {
            "sections": [],
            "custom_widgets": [],
            "quick_actions_order": [],
            "layout_mode": "auto"
        },
        "isCustomized": False,
        "effectiveRole": role
    }


@router.put("/me")
async def update_my_dashboard_settings(
    settings: DashboardSettingsUpdate,
    authorization: str = Header(None)
):
    """Update user's dashboard settings (upsert)"""
    user_id = get_user_id_from_token(authorization)
    role = get_user_effective_role(user_id)

    try:
        # Serialize JSONB fields
        sections_json = json.dumps([s.dict() for s in settings.sections])
        widgets_json = json.dumps([w.dict() for w in (settings.custom_widgets or [])])
        quick_actions_json = json.dumps(settings.quick_actions_order or [])

        query = """
            INSERT INTO user_dashboard_settings
                (user_id, sections, custom_widgets, quick_actions_order, layout_mode, derived_from_role, updated_at)
            VALUES
                (:user_id, CAST(:sections AS jsonb), CAST(:custom_widgets AS jsonb), CAST(:quick_actions_order AS jsonb), :layout_mode, :derived_from_role, :updated_at)
            ON CONFLICT (user_id) DO UPDATE SET
                sections = EXCLUDED.sections,
                custom_widgets = EXCLUDED.custom_widgets,
                quick_actions_order = EXCLUDED.quick_actions_order,
                layout_mode = EXCLUDED.layout_mode,
                derived_from_role = EXCLUDED.derived_from_role,
                updated_at = EXCLUDED.updated_at
            RETURNING *
        """

        result = execute_insert(query, {
            "user_id": user_id,
            "sections": sections_json,
            "custom_widgets": widgets_json,
            "quick_actions_order": quick_actions_json,
            "layout_mode": settings.layout_mode or "auto",
            "derived_from_role": role,
            "updated_at": datetime.utcnow().isoformat()
        })

        return result if result else {"message": "Settings updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/me/reset")
async def reset_dashboard_to_defaults(authorization: str = Header(None)):
    """Reset user's dashboard to their role's default"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Delete user's custom settings
        client.table("user_dashboard_settings").delete().eq("user_id", user_id).execute()

        # Return fresh role defaults
        role = get_user_effective_role(user_id)
        defaults = client.table("role_default_dashboards").select("*").eq("role_name", role).single().execute()

        return {
            "message": "Dashboard reset to defaults",
            "customization": defaults.data if defaults.data else {},
            "effectiveRole": role
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# ROLE DEFAULTS (ADMIN ONLY)
# ============================================================================

@router.get("/role-defaults")
async def list_role_defaults(authorization: str = Header(None)):
    """List all role default dashboard configurations (admin only)"""
    user_id = get_user_id_from_token(authorization)
    role = get_user_effective_role(user_id)

    if role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()
    response = client.table("role_default_dashboards").select("*").execute()
    return response.data


@router.get("/role-defaults/{role_name}")
async def get_role_default(role_name: str):
    """Get default dashboard for a specific role"""
    client = get_client()

    try:
        response = client.table("role_default_dashboards").select("*").eq("role_name", role_name).single().execute()
        return response.data
    except Exception:
        return None


@router.put("/role-defaults/{role_name}")
async def update_role_default(
    role_name: str,
    settings: DashboardSettingsUpdate,
    authorization: str = Header(None)
):
    """Update default dashboard for a role (admin only)"""
    user_id = get_user_id_from_token(authorization)
    role = get_user_effective_role(user_id)

    if role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # Serialize JSONB fields
        sections_json = json.dumps([s.dict() for s in settings.sections])
        widgets_json = json.dumps([w.dict() for w in (settings.custom_widgets or [])])
        quick_actions_json = json.dumps(settings.quick_actions_order or [])

        query = """
            INSERT INTO role_default_dashboards
                (role_name, sections, default_widgets, quick_actions_order, layout_mode, updated_by, updated_at)
            VALUES
                (:role_name, CAST(:sections AS jsonb), CAST(:default_widgets AS jsonb), CAST(:quick_actions_order AS jsonb), :layout_mode, :updated_by, :updated_at)
            ON CONFLICT (role_name) DO UPDATE SET
                sections = EXCLUDED.sections,
                default_widgets = EXCLUDED.default_widgets,
                quick_actions_order = EXCLUDED.quick_actions_order,
                layout_mode = EXCLUDED.layout_mode,
                updated_by = EXCLUDED.updated_by,
                updated_at = EXCLUDED.updated_at
            RETURNING *
        """

        result = execute_insert(query, {
            "role_name": role_name,
            "sections": sections_json,
            "default_widgets": widgets_json,
            "quick_actions_order": quick_actions_json,
            "layout_mode": settings.layout_mode or "auto",
            "updated_by": user_id,
            "updated_at": datetime.utcnow().isoformat()
        })

        return result if result else {"message": "Role defaults updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# DASHBOARD TEMPLATES (SHAREABLE LAYOUTS)
# ============================================================================

@router.get("/templates")
async def list_public_templates(
    role: Optional[str] = None,
    featured: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """List public dashboard templates, optionally filtered by role"""
    client = get_client()

    query = client.table("dashboard_templates").select(
        "*, profiles!created_by(full_name, username, avatar_url)"
    ).eq("visibility", "public").eq("is_approved", True)

    if featured:
        query = query.eq("is_featured", True)

    if role:
        query = query.contains("target_roles", [role])

    query = query.order("use_count", desc=True).range(skip, skip + limit - 1)

    response = query.execute()
    return response.data


@router.get("/templates/mine")
async def list_my_templates(authorization: str = Header(None)):
    """List current user's templates"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    response = client.table("dashboard_templates").select("*").eq("created_by", user_id).order("created_at", desc=True).execute()
    return response.data


@router.post("/templates")
async def create_dashboard_template(
    template: DashboardTemplateCreate,
    authorization: str = Header(None)
):
    """Create a new dashboard template from current settings"""
    user_id = get_user_id_from_token(authorization)

    try:
        # Serialize JSONB fields
        target_roles_json = json.dumps(template.target_roles or [])
        sections_json = json.dumps([s.dict() for s in template.sections])
        widgets_json = json.dumps([w.dict() for w in (template.custom_widgets or [])])

        query = """
            INSERT INTO dashboard_templates
                (created_by, name, description, visibility, target_roles, sections, custom_widgets, layout_mode, is_approved)
            VALUES
                (:created_by, :name, :description, :visibility, CAST(:target_roles AS jsonb), CAST(:sections AS jsonb), CAST(:custom_widgets AS jsonb), :layout_mode, :is_approved)
            RETURNING *
        """

        result = execute_insert(query, {
            "created_by": user_id,
            "name": template.name,
            "description": template.description,
            "visibility": template.visibility,
            "target_roles": target_roles_json,
            "sections": sections_json,
            "custom_widgets": widgets_json,
            "layout_mode": template.layout_mode or "auto",
            "is_approved": template.visibility != "public"
        })

        return result if result else {"message": "Template created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/templates/{template_id}")
async def get_template(template_id: str, authorization: str = Header(None)):
    """Get a specific template (respects visibility)"""
    client = get_client()
    user_id = None

    try:
        user_id = get_user_id_from_token(authorization)
    except:
        pass

    try:
        response = client.table("dashboard_templates").select(
            "*, profiles!created_by(full_name, username, avatar_url)"
        ).eq("id", template_id).single().execute()

        template = response.data

        # Check visibility
        if template["visibility"] == "private" and template["created_by"] != user_id:
            raise HTTPException(status_code=404, detail="Template not found")

        return template
    except Exception as e:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/{template_id}/apply")
async def apply_template(template_id: str, authorization: str = Header(None)):
    """Apply a shared template to user's dashboard"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Get the template
        template = client.table("dashboard_templates").select("*").eq("id", template_id).single().execute()

        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")

        tpl = template.data

        # Check visibility
        if tpl["visibility"] == "private" and tpl["created_by"] != user_id:
            raise HTTPException(status_code=404, detail="Template not found")

        # Serialize JSONB fields (data from DB might already be parsed)
        sections_json = json.dumps(tpl["sections"]) if isinstance(tpl["sections"], list) else tpl["sections"]
        widgets_json = json.dumps(tpl.get("custom_widgets", [])) if isinstance(tpl.get("custom_widgets", []), list) else tpl.get("custom_widgets", "[]")
        quick_actions_json = json.dumps(tpl.get("quick_actions_order", [])) if isinstance(tpl.get("quick_actions_order", []), list) else tpl.get("quick_actions_order", "[]")

        query = """
            INSERT INTO user_dashboard_settings
                (user_id, sections, custom_widgets, quick_actions_order, layout_mode, derived_from_template_id, updated_at)
            VALUES
                (:user_id, CAST(:sections AS jsonb), CAST(:custom_widgets AS jsonb), CAST(:quick_actions_order AS jsonb), :layout_mode, :derived_from_template_id, :updated_at)
            ON CONFLICT (user_id) DO UPDATE SET
                sections = EXCLUDED.sections,
                custom_widgets = EXCLUDED.custom_widgets,
                quick_actions_order = EXCLUDED.quick_actions_order,
                layout_mode = EXCLUDED.layout_mode,
                derived_from_template_id = EXCLUDED.derived_from_template_id,
                updated_at = EXCLUDED.updated_at
            RETURNING *
        """

        result = execute_insert(query, {
            "user_id": user_id,
            "sections": sections_json,
            "custom_widgets": widgets_json,
            "quick_actions_order": quick_actions_json,
            "layout_mode": tpl.get("layout_mode", "auto"),
            "derived_from_template_id": template_id,
            "updated_at": datetime.utcnow().isoformat()
        })

        # Increment use count
        client.table("dashboard_templates").update({
            "use_count": tpl.get("use_count", 0) + 1
        }).eq("id", template_id).execute()

        return {"message": "Template applied", "settings": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, authorization: str = Header(None)):
    """Delete a template (owner only)"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        template = client.table("dashboard_templates").select("created_by").eq("id", template_id).single().execute()

        if not template.data or template.data["created_by"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this template")

        client.table("dashboard_templates").delete().eq("id", template_id).execute()
        return {"message": "Template deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
