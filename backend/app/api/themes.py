"""
Themes API
Handles user theme preferences and theme marketplace
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.core.database import get_client, execute_insert, execute_single
from app.api.users import get_profile_id_from_cognito_id
import jwt
import json
from datetime import datetime

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class ThemeColors(BaseModel):
    background: str
    backgroundSecondary: str
    foreground: str
    foregroundSecondary: Optional[str] = None
    foregroundMuted: Optional[str] = None
    card: str
    cardForeground: str
    primary: str
    primaryForeground: str
    secondary: str
    secondaryForeground: str
    accent: str
    accentForeground: str
    muted: str
    mutedForeground: str
    destructive: str
    destructiveForeground: str
    border: str
    input: str
    ring: str
    success: Optional[str] = "#22c55e"
    warning: Optional[str] = "#f59e0b"
    error: Optional[str] = "#ef4444"


class ThemeTypography(BaseModel):
    fontHeading: Optional[str] = "Space Grotesk"
    fontBody: Optional[str] = "IBM Plex Sans"
    fontDisplay: Optional[str] = "Permanent Marker"


class ThemeSpacing(BaseModel):
    borderRadius: Optional[str] = "none"  # none, sm, md, lg, xl, full
    density: Optional[str] = "comfortable"  # compact, comfortable, spacious


class ThemeEffects(BaseModel):
    enableGrain: Optional[bool] = True
    enableAnimations: Optional[bool] = True
    reducedMotion: Optional[bool] = False


class ThemeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    colors: ThemeColors
    typography: Optional[ThemeTypography] = None
    spacing: Optional[ThemeSpacing] = None
    effects: Optional[ThemeEffects] = None
    is_dark: bool = True
    visibility: str = "private"
    category: Optional[str] = None
    tags: Optional[List[str]] = []


class ThemeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    colors: Optional[ThemeColors] = None
    typography: Optional[ThemeTypography] = None
    spacing: Optional[ThemeSpacing] = None
    effects: Optional[ThemeEffects] = None
    is_dark: Optional[bool] = None
    visibility: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class UserThemePreferenceUpdate(BaseModel):
    active_preset_id: Optional[str] = None
    active_template_id: Optional[str] = None
    custom_colors: Optional[Dict[str, Any]] = None
    custom_typography: Optional[Dict[str, Any]] = None
    custom_spacing: Optional[Dict[str, Any]] = None
    custom_effects: Optional[Dict[str, Any]] = None


# ============================================================================
# HELPERS
# ============================================================================

def get_user_id_from_token(authorization: str) -> str:
    """Extract user ID from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        cognito_id = decoded.get("sub")
        if not cognito_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        return profile_id
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_user_role(user_id: str) -> str:
    """Get user's highest priority role"""
    client = get_client()
    try:
        response = client.table("profiles").select(
            "is_superadmin, is_admin"
        ).eq("id", user_id).single().execute()

        if response.data:
            if response.data.get("is_superadmin"):
                return "superadmin"
            if response.data.get("is_admin"):
                return "admin"
        return "user"
    except Exception:
        return "user"


# ============================================================================
# PRESET THEMES
# ============================================================================

@router.get("/presets")
async def get_preset_themes():
    """Get all system preset themes"""
    client = get_client()

    response = client.table("preset_themes").select("*").order("display_order").execute()
    return response.data


@router.get("/presets/{preset_id}")
async def get_preset_theme(preset_id: str):
    """Get a specific preset theme"""
    client = get_client()

    try:
        response = client.table("preset_themes").select("*").eq("id", preset_id).single().execute()
        return response.data
    except Exception:
        raise HTTPException(status_code=404, detail="Preset theme not found")


# ============================================================================
# USER THEME PREFERENCES
# ============================================================================

@router.get("/preferences")
async def get_theme_preferences(authorization: str = Header(None)):
    """Get user's theme preferences"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        response = client.table("user_themes").select("*").eq("user_id", user_id).single().execute()

        if response.data:
            # If user has an active template, fetch it
            active_theme = None
            if response.data.get("active_preset_id"):
                preset = client.table("preset_themes").select("*").eq("id", response.data["active_preset_id"]).single().execute()
                active_theme = preset.data if preset.data else None
            elif response.data.get("active_template_id"):
                template = client.table("theme_templates").select("*").eq("id", response.data["active_template_id"]).single().execute()
                active_theme = template.data if template.data else None

            return {
                "preferences": response.data,
                "activeTheme": active_theme
            }
    except Exception:
        pass

    # No preferences - return default
    default_preset = client.table("preset_themes").select("*").eq("id", "swn-classic").single().execute()

    return {
        "preferences": {
            "active_preset_id": "swn-classic",
            "active_template_id": None,
            "installed_template_ids": [],
            "favorite_template_ids": []
        },
        "activeTheme": default_preset.data if default_preset.data else None
    }


@router.put("/preferences")
async def update_theme_preferences(
    preferences: UserThemePreferenceUpdate,
    authorization: str = Header(None)
):
    """Update user's theme preferences"""
    user_id = get_user_id_from_token(authorization)

    try:
        # Build dynamic query parts
        columns = ["user_id", "updated_at"]
        placeholders = [":user_id", ":updated_at"]
        update_parts = ["updated_at = EXCLUDED.updated_at"]
        params = {
            "user_id": user_id,
            "updated_at": datetime.utcnow().isoformat()
        }

        if preferences.active_preset_id is not None:
            columns.extend(["active_preset_id", "active_template_id"])
            placeholders.extend([":active_preset_id", "NULL"])
            update_parts.extend(["active_preset_id = EXCLUDED.active_preset_id", "active_template_id = NULL"])
            params["active_preset_id"] = preferences.active_preset_id

        if preferences.active_template_id is not None:
            if "active_preset_id" not in columns:
                columns.append("active_preset_id")
                placeholders.append("NULL")
                update_parts.append("active_preset_id = NULL")
            columns.append("active_template_id")
            placeholders.append(":active_template_id")
            update_parts.append("active_template_id = EXCLUDED.active_template_id")
            params["active_template_id"] = preferences.active_template_id

        if preferences.custom_colors is not None:
            columns.append("custom_colors")
            placeholders.append("CAST(:custom_colors AS jsonb)")
            update_parts.append("custom_colors = EXCLUDED.custom_colors")
            params["custom_colors"] = json.dumps(preferences.custom_colors) if isinstance(preferences.custom_colors, dict) else preferences.custom_colors

        if preferences.custom_typography is not None:
            columns.append("custom_typography")
            placeholders.append("CAST(:custom_typography AS jsonb)")
            update_parts.append("custom_typography = EXCLUDED.custom_typography")
            params["custom_typography"] = json.dumps(preferences.custom_typography) if isinstance(preferences.custom_typography, dict) else preferences.custom_typography

        if preferences.custom_spacing is not None:
            columns.append("custom_spacing")
            placeholders.append("CAST(:custom_spacing AS jsonb)")
            update_parts.append("custom_spacing = EXCLUDED.custom_spacing")
            params["custom_spacing"] = json.dumps(preferences.custom_spacing) if isinstance(preferences.custom_spacing, dict) else preferences.custom_spacing

        if preferences.custom_effects is not None:
            columns.append("custom_effects")
            placeholders.append("CAST(:custom_effects AS jsonb)")
            update_parts.append("custom_effects = EXCLUDED.custom_effects")
            params["custom_effects"] = json.dumps(preferences.custom_effects) if isinstance(preferences.custom_effects, dict) else preferences.custom_effects

        query = f"""
            INSERT INTO user_themes ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT (user_id) DO UPDATE SET {', '.join(update_parts)}
            RETURNING *
        """

        result = execute_insert(query, params)
        return result if result else {"message": "Preferences updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/preferences/reset")
async def reset_theme_to_default(authorization: str = Header(None)):
    """Reset user's theme to platform default"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Delete user's theme preferences
        client.table("user_themes").delete().eq("user_id", user_id).execute()

        return {"message": "Theme reset to default", "active_preset_id": "swn-classic"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# USER'S CUSTOM THEMES
# ============================================================================

@router.get("/my-themes")
async def get_my_themes(authorization: str = Header(None)):
    """Get user's created themes"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    response = client.table("theme_templates").select("*").eq("created_by", user_id).order("created_at", desc=True).execute()
    return response.data


@router.post("/my-themes")
async def create_theme(
    theme: ThemeCreate,
    authorization: str = Header(None)
):
    """Create a new custom theme"""
    user_id = get_user_id_from_token(authorization)

    try:
        # Serialize JSONB fields
        colors_json = json.dumps(theme.colors.dict())
        typography_json = json.dumps(theme.typography.dict() if theme.typography else {})
        spacing_json = json.dumps(theme.spacing.dict() if theme.spacing else {})
        effects_json = json.dumps(theme.effects.dict() if theme.effects else {})
        tags_json = json.dumps(theme.tags or [])

        query = """
            INSERT INTO theme_templates
                (created_by, name, description, colors, typography, spacing, effects, is_dark, visibility, category, tags, is_approved)
            VALUES
                (:created_by, :name, :description, CAST(:colors AS jsonb), CAST(:typography AS jsonb), CAST(:spacing AS jsonb), CAST(:effects AS jsonb), :is_dark, :visibility, :category, CAST(:tags AS jsonb), :is_approved)
            RETURNING *
        """

        result = execute_insert(query, {
            "created_by": user_id,
            "name": theme.name,
            "description": theme.description,
            "colors": colors_json,
            "typography": typography_json,
            "spacing": spacing_json,
            "effects": effects_json,
            "is_dark": theme.is_dark,
            "visibility": theme.visibility,
            "category": theme.category,
            "tags": tags_json,
            "is_approved": theme.visibility != "public"
        })

        return result if result else {"message": "Theme created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/my-themes/{theme_id}")
async def update_my_theme(
    theme_id: str,
    updates: ThemeUpdate,
    authorization: str = Header(None)
):
    """Update a custom theme"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("theme_templates").select("created_by").eq("id", theme_id).single().execute()

        if not existing.data or existing.data["created_by"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this theme")

        # Build dynamic update query
        set_parts = ["updated_at = :updated_at"]
        params = {
            "theme_id": theme_id,
            "updated_at": datetime.utcnow().isoformat()
        }

        if updates.name is not None:
            set_parts.append("name = :name")
            params["name"] = updates.name
        if updates.description is not None:
            set_parts.append("description = :description")
            params["description"] = updates.description
        if updates.colors is not None:
            set_parts.append("colors = CAST(:colors AS jsonb)")
            params["colors"] = json.dumps(updates.colors.dict())
        if updates.typography is not None:
            set_parts.append("typography = CAST(:typography AS jsonb)")
            params["typography"] = json.dumps(updates.typography.dict())
        if updates.spacing is not None:
            set_parts.append("spacing = CAST(:spacing AS jsonb)")
            params["spacing"] = json.dumps(updates.spacing.dict())
        if updates.effects is not None:
            set_parts.append("effects = CAST(:effects AS jsonb)")
            params["effects"] = json.dumps(updates.effects.dict())
        if updates.is_dark is not None:
            set_parts.append("is_dark = :is_dark")
            params["is_dark"] = updates.is_dark
        if updates.visibility is not None:
            set_parts.append("visibility = :visibility")
            params["visibility"] = updates.visibility
            if updates.visibility == "public":
                set_parts.append("is_approved = false")
        if updates.category is not None:
            set_parts.append("category = :category")
            params["category"] = updates.category
        if updates.tags is not None:
            set_parts.append("tags = CAST(:tags AS jsonb)")
            params["tags"] = json.dumps(updates.tags)

        query = f"""
            UPDATE theme_templates
            SET {', '.join(set_parts)}
            WHERE id = :theme_id
            RETURNING *
        """

        result = execute_single(query, params)
        return result if result else {"message": "Theme updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/my-themes/{theme_id}")
async def delete_my_theme(theme_id: str, authorization: str = Header(None)):
    """Delete a custom theme"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("theme_templates").select("created_by").eq("id", theme_id).single().execute()

        if not existing.data or existing.data["created_by"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this theme")

        client.table("theme_templates").delete().eq("id", theme_id).execute()
        return {"message": "Theme deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# THEME MARKETPLACE
# ============================================================================

@router.get("/marketplace")
async def browse_marketplace(
    category: Optional[str] = None,
    tags: Optional[str] = None,  # Comma-separated
    sort: str = Query("popular", pattern="^(popular|newest|name)$"),
    search: Optional[str] = None,
    featured: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Browse published themes in marketplace"""
    client = get_client()

    query = client.table("theme_templates").select(
        "*, profiles!created_by(full_name, username, avatar_url)"
    ).eq("visibility", "public").eq("is_approved", True)

    if featured:
        query = query.eq("is_featured", True)

    if category:
        query = query.eq("category", category)

    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        query = query.overlaps("tags", tag_list)

    if search:
        query = query.ilike("name", f"%{search}%")

    # Sorting
    if sort == "popular":
        query = query.order("use_count", desc=True)
    elif sort == "newest":
        query = query.order("created_at", desc=True)
    else:
        query = query.order("name")

    query = query.range(skip, skip + limit - 1)

    response = query.execute()
    return response.data


@router.get("/marketplace/{theme_id}")
async def get_marketplace_theme(theme_id: str):
    """Get a specific marketplace theme"""
    client = get_client()

    try:
        response = client.table("theme_templates").select(
            "*, profiles!created_by(full_name, username, avatar_url)"
        ).eq("id", theme_id).eq("visibility", "public").single().execute()

        return response.data
    except Exception:
        raise HTTPException(status_code=404, detail="Theme not found")


@router.post("/install/{theme_id}")
async def install_theme(theme_id: str, authorization: str = Header(None)):
    """Install a marketplace theme"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Verify theme exists and is public
        theme = client.table("theme_templates").select("id, visibility, use_count").eq("id", theme_id).single().execute()

        if not theme.data:
            raise HTTPException(status_code=404, detail="Theme not found")

        if theme.data["visibility"] != "public":
            raise HTTPException(status_code=403, detail="Theme is not public")

        # Get or create user preferences
        prefs = client.table("user_themes").select("installed_template_ids").eq("user_id", user_id).single().execute()

        installed = prefs.data.get("installed_template_ids", []) if prefs.data else []

        if theme_id not in installed:
            installed.append(theme_id)

            # Use raw SQL for JSONB array field
            query = """
                INSERT INTO user_themes (user_id, installed_template_ids, updated_at)
                VALUES (:user_id, CAST(:installed_template_ids AS jsonb), :updated_at)
                ON CONFLICT (user_id) DO UPDATE SET
                    installed_template_ids = EXCLUDED.installed_template_ids,
                    updated_at = EXCLUDED.updated_at
            """
            execute_insert(query, {
                "user_id": user_id,
                "installed_template_ids": json.dumps(installed),
                "updated_at": datetime.utcnow().isoformat()
            })

            # Increment use count
            execute_single(
                "UPDATE theme_templates SET use_count = :use_count WHERE id = :theme_id",
                {"use_count": theme.data.get("use_count", 0) + 1, "theme_id": theme_id}
            )

        return {"message": "Theme installed", "installed_template_ids": installed}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/uninstall/{theme_id}")
async def uninstall_theme(theme_id: str, authorization: str = Header(None)):
    """Uninstall a marketplace theme"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        prefs = client.table("user_themes").select("installed_template_ids, active_template_id").eq("user_id", user_id).single().execute()

        if not prefs.data:
            return {"message": "Theme not installed"}

        installed = prefs.data.get("installed_template_ids", [])

        if theme_id in installed:
            installed.remove(theme_id)

            # Build dynamic update query
            set_parts = [
                "installed_template_ids = CAST(:installed_template_ids AS jsonb)",
                "updated_at = :updated_at"
            ]
            params = {
                "user_id": user_id,
                "installed_template_ids": json.dumps(installed),
                "updated_at": datetime.utcnow().isoformat()
            }

            # If this was the active theme, clear it
            if prefs.data.get("active_template_id") == theme_id:
                set_parts.append("active_template_id = NULL")
                set_parts.append("active_preset_id = 'swn-classic'")

            query = f"""
                UPDATE user_themes
                SET {', '.join(set_parts)}
                WHERE user_id = :user_id
            """
            execute_single(query, params)

        return {"message": "Theme uninstalled", "installed_template_ids": installed}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/like/{theme_id}")
async def toggle_like_theme(theme_id: str, authorization: str = Header(None)):
    """Toggle like on a marketplace theme"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        # Check if already liked
        existing = client.table("theme_likes").select("id").eq("user_id", user_id).eq("theme_id", theme_id).execute()

        if existing.data and len(existing.data) > 0:
            # Unlike
            client.table("theme_likes").delete().eq("user_id", user_id).eq("theme_id", theme_id).execute()

            # Decrement like count
            theme = client.table("theme_templates").select("like_count").eq("id", theme_id).single().execute()
            new_count = max(0, (theme.data.get("like_count", 0) - 1) if theme.data else 0)
            client.table("theme_templates").update({"like_count": new_count}).eq("id", theme_id).execute()

            return {"liked": False, "like_count": new_count}
        else:
            # Like
            client.table("theme_likes").insert({
                "user_id": user_id,
                "theme_id": theme_id
            }).execute()

            # Increment like count
            theme = client.table("theme_templates").select("like_count").eq("id", theme_id).single().execute()
            new_count = (theme.data.get("like_count", 0) + 1) if theme.data else 1
            client.table("theme_templates").update({"like_count": new_count}).eq("id", theme_id).execute()

            return {"liked": True, "like_count": new_count}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# INSTALLED THEMES
# ============================================================================

@router.get("/installed")
async def get_installed_themes(authorization: str = Header(None)):
    """Get user's installed marketplace themes"""
    user_id = get_user_id_from_token(authorization)
    client = get_client()

    try:
        prefs = client.table("user_themes").select("installed_template_ids").eq("user_id", user_id).single().execute()

        if not prefs.data or not prefs.data.get("installed_template_ids"):
            return []

        installed_ids = prefs.data["installed_template_ids"]

        # Fetch all installed themes
        response = client.table("theme_templates").select(
            "*, profiles!created_by(full_name, username, avatar_url)"
        ).in_("id", installed_ids).execute()

        return response.data
    except Exception:
        return []
