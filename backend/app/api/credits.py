"""
Credits API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List
from app.core.supabase import get_supabase_client
from pydantic import BaseModel
from datetime import date

router = APIRouter()


class CreditBase(BaseModel):
    position: str
    production: str
    production_date: date


class CreditCreate(CreditBase):
    pass


class Credit(CreditBase):
    id: str
    user_id: str
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[Credit])
async def list_credits(user_id: str):
    """List user's project credits"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("credits").select("*").eq(
            "user_id", user_id
        ).order("production_date", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Credit)
async def create_credit(credit: CreditCreate, user_id: str):
    """Create project credit"""
    try:
        supabase = get_supabase_client()
        data = credit.model_dump()
        data["user_id"] = user_id
        
        response = supabase.table("credits").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{credit_id}")
async def delete_credit(credit_id: str):
    """Delete credit"""
    try:
        supabase = get_supabase_client()
        supabase.table("credits").delete().eq("id", credit_id).execute()
        return {"message": "Credit deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
