"""
Content API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.core.database import get_client

router = APIRouter()


class Content(BaseModel):
    id: str | None = None
    title: str
    description: str | None = None
    content_type: str  # video, article, podcast
    url: str | None = None
    thumbnail_url: str | None = None
    creator_id: str
    status: str = "draft"  # draft, published, archived
    created_at: str | None = None


@router.get("/", response_model=List[Content])
async def list_content(skip: int = 0, limit: int = 20, content_type: str | None = None):
    """List all published content"""
    try:
        client = get_client()
        query = client.table("content").select("*").eq("status", "published")
        
        if content_type:
            query = query.eq("content_type", content_type)
        
        response = query.range(skip, skip + limit - 1).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{content_id}", response_model=Content)
async def get_content(content_id: str):
    """Get content by ID"""
    try:
        client = get_client()
        response = client.table("content").select("*").eq("id", content_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Content not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Content)
async def create_content(content: Content):
    """Create new content"""
    try:
        client = get_client()
        response = client.table("content").insert(content.model_dump(exclude={"id"})).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{content_id}", response_model=Content)
async def update_content(content_id: str, content: Content):
    """Update content"""
    try:
        client = get_client()
        response = client.table("content").update(
            content.model_dump(exclude={"id"})
        ).eq("id", content_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{content_id}")
async def delete_content(content_id: str):
    """Delete content"""
    try:
        client = get_client()
        client.table("content").delete().eq("id", content_id).execute()
        return {"message": "Content deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
