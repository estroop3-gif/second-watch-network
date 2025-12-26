"""
Application Templates API Routes
Allows users to save and manage reusable application templates
"""
from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_client
from app.api.community import get_current_user_from_token

router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================

class ApplicationTemplateInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_default: bool = False
    cover_letter: Optional[str] = None
    elevator_pitch: Optional[str] = Field(None, max_length=100)
    rate_expectation: Optional[str] = None
    availability_notes: Optional[str] = None
    default_reel_url: Optional[str] = None
    default_headshot_url: Optional[str] = None
    default_resume_url: Optional[str] = None
    default_credit_ids: Optional[List[str]] = None


class ApplicationTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_default: Optional[bool] = None
    cover_letter: Optional[str] = None
    elevator_pitch: Optional[str] = Field(None, max_length=100)
    rate_expectation: Optional[str] = None
    availability_notes: Optional[str] = None
    default_reel_url: Optional[str] = None
    default_headshot_url: Optional[str] = None
    default_resume_url: Optional[str] = None
    default_credit_ids: Optional[List[str]] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/")
async def list_templates(
    authorization: str = Header(None)
):
    """List user's application templates"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        result = client.table("application_templates").select("*").eq(
            "user_id", user_id
        ).order("is_default", desc=True).order("use_count", desc=True).execute()

        return result.data or []

    except Exception as e:
        print(f"Error listing templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_template(
    template: ApplicationTemplateInput,
    authorization: str = Header(None)
):
    """Create a new application template"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # If setting as default, unset any existing default
        if template.is_default:
            client.table("application_templates").update({
                "is_default": False
            }).eq("user_id", user_id).eq("is_default", True).execute()

        template_data = {
            "user_id": user_id,
            "name": template.name,
            "description": template.description,
            "is_default": template.is_default,
            "cover_letter": template.cover_letter,
            "elevator_pitch": template.elevator_pitch,
            "rate_expectation": template.rate_expectation,
            "availability_notes": template.availability_notes,
            "default_reel_url": template.default_reel_url,
            "default_headshot_url": template.default_headshot_url,
            "default_resume_url": template.default_resume_url,
            "default_credit_ids": template.default_credit_ids or [],
        }

        result = client.table("application_templates").insert(template_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create template")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Get a single template"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        result = client.table("application_templates").select("*").eq(
            "id", template_id
        ).eq("user_id", user_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    template: ApplicationTemplateUpdate,
    authorization: str = Header(None)
):
    """Update an application template"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("application_templates").select("id").eq(
            "id", template_id
        ).eq("user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")

        # If setting as default, unset any existing default
        if template.is_default:
            client.table("application_templates").update({
                "is_default": False
            }).eq("user_id", user_id).eq("is_default", True).neq("id", template_id).execute()

        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}

        if template.name is not None:
            update_data["name"] = template.name
        if template.description is not None:
            update_data["description"] = template.description
        if template.is_default is not None:
            update_data["is_default"] = template.is_default
        if template.cover_letter is not None:
            update_data["cover_letter"] = template.cover_letter
        if template.elevator_pitch is not None:
            update_data["elevator_pitch"] = template.elevator_pitch
        if template.rate_expectation is not None:
            update_data["rate_expectation"] = template.rate_expectation
        if template.availability_notes is not None:
            update_data["availability_notes"] = template.availability_notes
        if template.default_reel_url is not None:
            update_data["default_reel_url"] = template.default_reel_url
        if template.default_headshot_url is not None:
            update_data["default_headshot_url"] = template.default_headshot_url
        if template.default_resume_url is not None:
            update_data["default_resume_url"] = template.default_resume_url
        if template.default_credit_ids is not None:
            update_data["default_credit_ids"] = template.default_credit_ids

        result = client.table("application_templates").update(update_data).eq(
            "id", template_id
        ).execute()

        return result.data[0] if result.data else {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Delete an application template"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("application_templates").select("id").eq(
            "id", template_id
        ).eq("user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")

        client.table("application_templates").delete().eq("id", template_id).execute()

        return {"success": True, "message": "Template deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{template_id}/set-default")
async def set_default_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Set a template as the default"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("application_templates").select("id").eq(
            "id", template_id
        ).eq("user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")

        # Unset any existing default
        client.table("application_templates").update({
            "is_default": False
        }).eq("user_id", user_id).eq("is_default", True).execute()

        # Set new default
        result = client.table("application_templates").update({
            "is_default": True,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", template_id).execute()

        return result.data[0] if result.data else {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error setting default template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{template_id}/use")
async def record_template_use(
    template_id: str,
    authorization: str = Header(None)
):
    """Record that a template was used (increments use_count)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Get current use count
        existing = client.table("application_templates").select("use_count").eq(
            "id", template_id
        ).eq("user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")

        new_count = (existing.data.get("use_count") or 0) + 1

        result = client.table("application_templates").update({
            "use_count": new_count,
            "last_used_at": datetime.utcnow().isoformat()
        }).eq("id", template_id).execute()

        return {"success": True, "use_count": new_count}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error recording template use: {e}")
        raise HTTPException(status_code=500, detail=str(e))
