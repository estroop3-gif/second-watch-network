"""
Credits API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from pydantic import BaseModel
from datetime import date

router = APIRouter()


class CreditCreate(BaseModel):
    position: str
    production_title: str
    description: Optional[str] = None
    production_date: Optional[str] = None


class CreditUpdate(BaseModel):
    position: Optional[str] = None
    production_title: Optional[str] = None
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
    """Create project credit - finds or creates production by title"""
    try:
        client = get_client()

        # Find existing production by title
        production_result = client.table("productions").select("id").eq(
            "title", credit.production_title
        ).execute()

        production_id = None
        if production_result.data:
            production_id = production_result.data[0]["id"]
        else:
            # Create new production
            slug = credit.production_title.lower().replace(" ", "-")
            new_production = client.table("productions").insert({
                "title": credit.production_title,
                "slug": slug,
                "created_by": user_id,
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
            "productions": {"id": production_id, "title": credit.production_title}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{credit_id}")
async def update_credit(credit_id: str, credit: CreditUpdate, user_id: str):
    """Update a credit - optionally updates production title"""
    try:
        client = get_client()

        update_data = {}
        production_id = None

        # If production title is being updated, find or create production
        if credit.production_title:
            production_result = client.table("productions").select("id").eq(
                "title", credit.production_title
            ).execute()

            if production_result.data:
                production_id = production_result.data[0]["id"]
            else:
                slug = credit.production_title.lower().replace(" ", "-")
                new_production = client.table("productions").insert({
                    "title": credit.production_title,
                    "slug": slug,
                    "created_by": user_id,
                }).execute()
                production_id = new_production.data[0]["id"]

            update_data["production_id"] = production_id

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
