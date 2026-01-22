"""
Cover Letter Templates API
CRUD operations for user cover letter templates
"""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_client

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class CoverLetterTemplateInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)
    is_default: bool = False


class CoverLetterTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = Field(None, min_length=1)
    is_default: Optional[bool] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from JWT token and convert to profile UUID"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    from app.core.auth import verify_token
    from app.api.users import get_profile_id_from_cognito_id

    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # verify_token returns 'id' key, but some paths may return 'sub'
    cognito_id = payload.get("id") or payload.get("sub")

    # Convert Cognito ID to profile UUID
    profile_id = get_profile_id_from_cognito_id(cognito_id)
    if not profile_id:
        raise HTTPException(status_code=401, detail="Profile not found")

    return profile_id


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
async def list_cover_letter_templates(authorization: str = Header(None)):
    """List all cover letter templates for current user"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    result = db.table("cover_letter_templates") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("is_default", desc=True) \
        .order("use_count", desc=True) \
        .order("created_at", desc=True) \
        .execute()

    return result.data or []


@router.post("")
async def create_cover_letter_template(
    input: CoverLetterTemplateInput,
    authorization: str = Header(None)
):
    """Create a new cover letter template"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # If setting as default, unset other defaults first
    if input.is_default:
        db.table("cover_letter_templates") \
            .update({"is_default": False}) \
            .eq("user_id", user_id) \
            .eq("is_default", True) \
            .execute()

    result = db.table("cover_letter_templates").insert({
        "user_id": user_id,
        "name": input.name,
        "content": input.content,
        "is_default": input.is_default,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create template")

    return result.data[0]


@router.get("/{template_id}")
async def get_cover_letter_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Get a specific cover letter template"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    result = db.table("cover_letter_templates") \
        .select("*") \
        .eq("id", template_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Template not found")

    return result.data


@router.put("/{template_id}")
async def update_cover_letter_template(
    template_id: str,
    input: CoverLetterTemplateUpdate,
    authorization: str = Header(None)
):
    """Update a cover letter template"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Verify ownership
    existing = db.table("cover_letter_templates") \
        .select("id") \
        .eq("id", template_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = {"updated_at": datetime.utcnow().isoformat()}

    if input.name is not None:
        update_data["name"] = input.name
    if input.content is not None:
        update_data["content"] = input.content
    if input.is_default is not None:
        # If setting as default, unset other defaults first
        if input.is_default:
            db.table("cover_letter_templates") \
                .update({"is_default": False}) \
                .eq("user_id", user_id) \
                .eq("is_default", True) \
                .neq("id", template_id) \
                .execute()
        update_data["is_default"] = input.is_default

    result = db.table("cover_letter_templates") \
        .update(update_data) \
        .eq("id", template_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update template")

    return result.data[0]


@router.delete("/{template_id}")
async def delete_cover_letter_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Delete a cover letter template"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Verify ownership
    existing = db.table("cover_letter_templates") \
        .select("id") \
        .eq("id", template_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")

    db.table("cover_letter_templates") \
        .delete() \
        .eq("id", template_id) \
        .execute()

    return {"success": True, "message": "Template deleted"}


@router.patch("/{template_id}/set-default")
async def set_default_cover_letter_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Set a template as the default"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Verify ownership
    existing = db.table("cover_letter_templates") \
        .select("id") \
        .eq("id", template_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")

    # Unset other defaults
    db.table("cover_letter_templates") \
        .update({"is_default": False}) \
        .eq("user_id", user_id) \
        .eq("is_default", True) \
        .execute()

    # Set this one as default
    result = db.table("cover_letter_templates") \
        .update({"is_default": True, "updated_at": datetime.utcnow().isoformat()}) \
        .eq("id", template_id) \
        .execute()

    return result.data[0] if result.data else {"success": True}


@router.post("/{template_id}/record-use")
async def record_template_use(
    template_id: str,
    authorization: str = Header(None)
):
    """Record that a template was used"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Get current use_count
    existing = db.table("cover_letter_templates") \
        .select("use_count") \
        .eq("id", template_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Template not found")

    new_count = (existing.data.get("use_count") or 0) + 1

    result = db.table("cover_letter_templates") \
        .update({
            "use_count": new_count,
            "last_used_at": datetime.utcnow().isoformat()
        }) \
        .eq("id", template_id) \
        .execute()

    return {"success": True, "use_count": new_count}
