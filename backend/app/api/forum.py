"""
Forum (The Backlot) API Routes - Enhanced
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.supabase import get_supabase_client
from app.schemas.forum import (
    ForumThread, ForumThreadCreate, ForumThreadUpdate,
    ForumReply, ForumReplyCreate,
    ForumCategory
)

router = APIRouter()


# Categories
@router.get("/categories", response_model=List[ForumCategory])
async def list_categories():
    """List all forum categories"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("forum_categories").select("*").order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/categories", response_model=ForumCategory)
async def create_category(name: str, description: str, slug: str):
    """Create forum category (admin only)"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("forum_categories").insert({
            "name": name,
            "description": description,
            "slug": slug
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Threads
@router.get("/threads", response_model=List[ForumThread])
async def list_threads(
    skip: int = 0,
    limit: int = 20,
    category_id: Optional[str] = None,
    is_pinned: Optional[bool] = None
):
    """List forum threads"""
    try:
        supabase = get_supabase_client()
        query = supabase.table("forum_threads").select("*")
        
        if category_id:
            query = query.eq("category_id", category_id)
        if is_pinned is not None:
            query = query.eq("is_pinned", is_pinned)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/threads/{thread_id}", response_model=ForumThread)
async def get_thread(thread_id: str):
    """Get thread by ID"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("forum_threads").select("*").eq("id", thread_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/threads", response_model=ForumThread)
async def create_thread(thread: ForumThreadCreate, author_id: str):
    """Create new thread"""
    try:
        supabase = get_supabase_client()
        data = thread.model_dump()
        data["author_id"] = author_id
        data["reply_count"] = 0
        
        response = supabase.table("forum_threads").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/threads/{thread_id}", response_model=ForumThread)
async def update_thread(thread_id: str, thread: ForumThreadUpdate):
    """Update thread"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("forum_threads").update(
            thread.model_dump(exclude_unset=True)
        ).eq("id", thread_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    """Delete thread (admin only)"""
    try:
        supabase = get_supabase_client()
        
        # Delete all replies first
        supabase.table("forum_replies").delete().eq("thread_id", thread_id).execute()
        
        # Delete thread
        supabase.table("forum_threads").delete().eq("id", thread_id).execute()
        
        return {"message": "Thread deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Replies
@router.get("/threads/{thread_id}/replies", response_model=List[ForumReply])
async def list_thread_replies(thread_id: str, skip: int = 0, limit: int = 50):
    """List thread replies"""
    try:
        supabase = get_supabase_client()
        response = supabase.table("forum_replies").select("*").eq(
            "thread_id", thread_id
        ).range(skip, skip + limit - 1).order("created_at").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/replies", response_model=ForumReply)
async def create_reply(reply: ForumReplyCreate, author_id: str):
    """Create thread reply"""
    try:
        supabase = get_supabase_client()
        data = reply.model_dump()
        data["author_id"] = author_id
        
        # Insert reply
        response = supabase.table("forum_replies").insert(data).execute()
        
        # Increment thread reply count
        supabase.rpc("increment_thread_replies", {"thread_id": reply.thread_id}).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/replies/{reply_id}")
async def delete_reply(reply_id: str):
    """Delete reply (admin only)"""
    try:
        supabase = get_supabase_client()
        
        # Get thread_id before deleting
        reply_data = supabase.table("forum_replies").select("thread_id").eq("id", reply_id).execute()
        
        if reply_data.data:
            thread_id = reply_data.data[0]["thread_id"]
            
            # Delete reply
            supabase.table("forum_replies").delete().eq("id", reply_id).execute()
            
            # Decrement thread reply count
            supabase.rpc("decrement_thread_replies", {"thread_id": thread_id}).execute()
        
        return {"message": "Reply deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
