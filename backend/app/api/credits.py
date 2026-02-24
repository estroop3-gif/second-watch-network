"""
Credits API Routes
"""
from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from app.core.database import get_client
from app.api.community import get_current_user_from_token
from pydantic import BaseModel
from datetime import date

router = APIRouter()


@router.get("/my-credits")
async def get_my_credits(authorization: str = Header(None)):
    """Get current user's credits for application selection"""
    from app.api.users import get_profile_id_from_cognito_id
    from app.core.database import execute_query

    user = await get_current_user_from_token(authorization)
    cognito_id = user["id"]

    # Convert Cognito ID to profile UUID
    profile_id = get_profile_id_from_cognito_id(cognito_id)
    if not profile_id:
        raise HTTPException(status_code=401, detail="Profile not found")

    try:
        credits = []

        # Get project credits with project titles using raw SQL (more reliable)
        project_credits = execute_query("""
            SELECT pc.id, pc.credit_role, pc.department, pc.is_primary, bp.title as project_title
            FROM backlot_project_credits pc
            LEFT JOIN backlot_projects bp ON bp.id = pc.project_id
            WHERE pc.user_id = :user_id AND pc.is_public = true
            ORDER BY pc.is_primary DESC
        """, {"user_id": profile_id})

        for c in (project_credits or []):
            credits.append({
                "id": str(c["id"]),
                "project_title": c.get("project_title") or "Unknown Project",
                "role": c.get("credit_role"),
                "department": c.get("department"),
                "is_primary": c.get("is_primary", False),
                "source": "project",
            })

        # Get manual credits with production titles
        manual_credits = execute_query("""
            SELECT c.id, c.position, p.title as project_title
            FROM credits c
            LEFT JOIN productions p ON p.id = c.production_id
            WHERE c.user_id = :user_id
            ORDER BY c.created_at DESC
        """, {"user_id": profile_id})

        for c in (manual_credits or []):
            credits.append({
                "id": str(c["id"]),
                "project_title": c.get("project_title") or "Unknown Production",
                "role": c.get("position"),
                "department": None,
                "is_primary": False,
                "source": "manual",
            })

        return {"credits": credits}
    except Exception as e:
        print(f"Error in get_my_credits: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class CreditCreate(BaseModel):
    position: str
    production_title: str
    production_id: Optional[str] = None
    description: Optional[str] = None
    production_date: Optional[str] = None


class CreditUpdate(BaseModel):
    position: Optional[str] = None
    production_title: Optional[str] = None
    production_id: Optional[str] = None
    description: Optional[str] = None
    production_date: Optional[str] = None


@router.get("/")
async def list_credits(user_id: str):
    """List user's project credits with production details"""
    try:
        client = get_client()
        response = client.table("credits").select(
            "*, productions(id, title)"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

        # Format response to include production title
        credits = []
        for c in (response.data or []):
            credits.append({
                "id": c.get("id"),
                "user_id": c.get("user_id"),
                "production_id": c.get("production_id"),
                "position": c.get("position"),
                "description": c.get("description"),
                "production_date": c.get("production_date"),
                "created_at": c.get("created_at"),
                "productions": c.get("productions"),
            })

        return credits
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/")
async def create_credit(credit: CreditCreate, user_id: str):
    """Create project credit - uses production_id if provided, else finds or creates by title"""
    try:
        client = get_client()
        import re

        production_id = None
        production_title = credit.production_title

        if credit.production_id:
            # Use the provided production_id directly
            production_id = credit.production_id
            # Verify it exists
            prod_check = client.table("productions").select("id, name, title").eq(
                "id", production_id
            ).execute()
            if prod_check.data:
                production_title = prod_check.data[0].get("name") or prod_check.data[0].get("title") or production_title
        else:
            # Find existing production by title (check both name and title columns)
            production_result = client.table("productions").select("id").eq(
                "title", credit.production_title
            ).execute()

            if not production_result.data:
                # Also try by name
                production_result = client.table("productions").select("id").eq(
                    "name", credit.production_title
                ).execute()

            if production_result.data:
                production_id = production_result.data[0]["id"]
            else:
                # Create new production with both name and title
                slug = re.sub(r'[^a-zA-Z0-9]+', '-', credit.production_title.lower()).strip('-')
                new_production = client.table("productions").insert({
                    "name": credit.production_title,
                    "title": credit.production_title,
                    "slug": slug,
                    "created_by": user_id,
                    "created_by_user_id": user_id,
                }).execute()
                production_id = new_production.data[0]["id"]

        # Create the credit
        credit_data = {
            "user_id": user_id,
            "production_id": production_id,
            "position": credit.position,
            "description": credit.description,
            "production_date": credit.production_date,
        }

        response = client.table("credits").insert(credit_data).execute()

        # Return with production info
        return {
            **response.data[0],
            "productions": {"id": production_id, "title": production_title}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{credit_id}")
async def update_credit(credit_id: str, credit: CreditUpdate, user_id: str):
    """Update a credit - optionally updates production via production_id or title"""
    try:
        client = get_client()
        import re

        update_data = {}

        # If production_id is provided, use it directly
        if credit.production_id:
            update_data["production_id"] = credit.production_id
        elif credit.production_title:
            # Find or create production by title
            production_result = client.table("productions").select("id").eq(
                "title", credit.production_title
            ).execute()

            if not production_result.data:
                production_result = client.table("productions").select("id").eq(
                    "name", credit.production_title
                ).execute()

            if production_result.data:
                update_data["production_id"] = production_result.data[0]["id"]
            else:
                slug = re.sub(r'[^a-zA-Z0-9]+', '-', credit.production_title.lower()).strip('-')
                new_production = client.table("productions").insert({
                    "name": credit.production_title,
                    "title": credit.production_title,
                    "slug": slug,
                    "created_by": user_id,
                    "created_by_user_id": user_id,
                }).execute()
                update_data["production_id"] = new_production.data[0]["id"]

        if credit.position is not None:
            update_data["position"] = credit.position
        if credit.description is not None:
            update_data["description"] = credit.description
        if credit.production_date is not None:
            update_data["production_date"] = credit.production_date

        if update_data:
            response = client.table("credits").update(update_data).eq(
                "id", credit_id
            ).execute()
            return response.data[0] if response.data else {"message": "Updated"}

        return {"message": "No updates provided"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{credit_id}")
async def delete_credit(credit_id: str):
    """Delete credit"""
    try:
        client = get_client()
        client.table("credits").delete().eq("id", credit_id).execute()
        return {"message": "Credit deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
