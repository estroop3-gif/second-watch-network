"""
Admin Profiles API Routes - Productions, Credits, Profile Configuration
Note: Auth is handled by frontend admin routing. Backend auth can be added later.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_client

router = APIRouter()


# === Schemas ===

class ProfileConfigUpdate(BaseModel):
    config_key: str
    config_value: dict | list | str


class PrivacyDefaultsUpdate(BaseModel):
    profile_visibility: Optional[str] = None
    show_email: Optional[bool] = None
    show_phone: Optional[bool] = None
    show_location: Optional[bool] = None
    show_credits: Optional[bool] = None
    allow_messages: Optional[str] = None


# === Productions Endpoints ===

@router.get("/productions")
async def list_all_productions(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    production_type: Optional[str] = None,
    user_id: Optional[str] = None
):
    """List all productions added by users"""
    try:
        client = get_client()
        query = client.table("productions").select(
            "*, created_by_user:profiles!created_by_user_id(id, full_name, username, avatar_url)",
            count="exact"
        )

        if search:
            query = query.or_(f"title.ilike.%{search}%,name.ilike.%{search}%")
        if production_type:
            query = query.eq("production_type", production_type)
        if user_id:
            query = query.eq("created_by_user_id", user_id)

        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        productions = response.data
        for prod in productions:
            credit_count = client.table("credits").select("id", count="exact").eq("production_id", prod["id"]).execute()
            prod["credit_count"] = credit_count.count or 0

        return {
            "productions": productions,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/productions/{production_id}")
async def get_production(production_id: str):
    """Get production details"""
    try:
        client = get_client()
        response = client.table("productions").select(
            "*, created_by_user:profiles!created_by_user_id(id, full_name, username, avatar_url, email)"
        ).eq("id", production_id).single().execute()

        production = response.data

        credits_response = client.table("credits").select(
            "*, user:profiles!user_id(id, full_name, username, avatar_url)"
        ).eq("production_id", production_id).execute()
        production["credits"] = credits_response.data

        return production
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/productions/{production_id}")
async def delete_production(production_id: str):
    """Delete a production"""
    try:
        client = get_client()
        client.table("credits").delete().eq("production_id", production_id).execute()
        client.table("productions").delete().eq("id", production_id).execute()
        return {"message": "Production deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Credits Endpoints ===

@router.get("/credits")
async def list_all_credits(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    user_id: Optional[str] = None,
    production_id: Optional[str] = None,
    is_featured: Optional[bool] = None
):
    """List all credits added by users"""
    try:
        client = get_client()
        query = client.table("credits").select(
            "*, user:profiles!user_id(id, full_name, username, avatar_url), production:productions(id, title, name, production_type)",
            count="exact"
        )

        if search:
            query = query.ilike("position", f"%{search}%")
        if user_id:
            query = query.eq("user_id", user_id)
        if production_id:
            query = query.eq("production_id", production_id)
        if is_featured is not None:
            query = query.eq("is_featured", is_featured)

        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        return {
            "credits": response.data,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/credits/{credit_id}")
async def delete_credit(credit_id: str):
    """Delete a credit"""
    try:
        client = get_client()
        client.table("credits").delete().eq("id", credit_id).execute()
        return {"message": "Credit deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/credits/{credit_id}/featured")
async def toggle_credit_featured(credit_id: str, is_featured: bool):
    """Toggle credit featured status"""
    try:
        client = get_client()
        response = client.table("credits").update({
            "is_featured": is_featured,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", credit_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Profile Configuration ===

@router.get("/config")
async def get_profile_config():
    """Get all profile configuration settings"""
    try:
        client = get_client()
        response = client.table("profile_config").select("*").execute()

        config = {}
        for row in response.data:
            config[row["config_key"]] = row["config_value"]

        return config
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/config")
async def update_profile_config(data: ProfileConfigUpdate):
    """Update a profile configuration setting"""
    try:
        client = get_client()

        response = client.table("profile_config").upsert({
            "config_key": data.config_key,
            "config_value": data.config_value,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()

        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/privacy-defaults")
async def get_privacy_defaults():
    """Get default privacy settings for new users"""
    try:
        client = get_client()
        response = client.table("profile_config").select("config_value").eq("config_key", "default_privacy").single().execute()
        return response.data.get("config_value", {}) if response.data else {}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/privacy-defaults")
async def update_privacy_defaults(data: PrivacyDefaultsUpdate):
    """Update default privacy settings"""
    try:
        client = get_client()

        current = client.table("profile_config").select("config_value").eq("config_key", "default_privacy").single().execute()
        current_value = current.data.get("config_value", {}) if current.data else {}

        update_data = data.model_dump(exclude_none=True)
        new_value = {**current_value, **update_data}

        response = client.table("profile_config").upsert({
            "config_key": "default_privacy",
            "config_value": new_value,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()

        return new_value
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Available Layouts ===

@router.get("/layouts")
async def get_available_layouts():
    """Get available profile layouts"""
    try:
        client = get_client()
        response = client.table("profile_config").select("config_value").eq("config_key", "available_layouts").single().execute()
        return response.data.get("config_value", ["standard"]) if response.data else ["standard"]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/layouts")
async def update_available_layouts(layouts: List[str]):
    """Update available profile layouts"""
    try:
        client = get_client()

        response = client.table("profile_config").upsert({
            "config_key": "available_layouts",
            "config_value": layouts,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()

        return layouts
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Visible Fields ===

@router.get("/visible-fields")
async def get_visible_fields():
    """Get fields visible on public profiles by default"""
    try:
        client = get_client()
        response = client.table("profile_config").select("config_value").eq("config_key", "visible_fields").single().execute()
        return response.data.get("config_value", []) if response.data else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/visible-fields")
async def update_visible_fields(fields: List[str]):
    """Update visible fields for public profiles"""
    try:
        client = get_client()

        response = client.table("profile_config").upsert({
            "config_key": "visible_fields",
            "config_value": fields,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()

        return fields
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Stats ===

@router.get("/stats")
async def get_profile_content_stats():
    """Get overview statistics for profile content"""
    try:
        client = get_client()

        total_productions = client.table("productions").select("id", count="exact").execute()
        total_credits = client.table("credits").select("id", count="exact").execute()
        featured_credits = client.table("credits").select("id", count="exact").eq("is_featured", True).execute()
        users_with_credits = client.table("credits").select("user_id").execute()
        unique_users = len(set(c["user_id"] for c in users_with_credits.data if c.get("user_id")))

        return {
            "total_productions": total_productions.count or 0,
            "total_credits": total_credits.count or 0,
            "featured_credits": featured_credits.count or 0,
            "users_with_credits": unique_users
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
