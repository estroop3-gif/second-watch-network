"""
Forum (The Backlot) API Routes - Enhanced
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
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
        client = get_client()
        response = client.table("forum_categories").select("*").order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/categories", response_model=ForumCategory)
async def create_category(name: str, description: str, slug: str):
    """Create forum category (admin only)"""
    try:
        client = get_client()
        response = client.table("forum_categories").insert({
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
        client = get_client()
        query = client.table("forum_threads").select("*")

        if category_id:
            query = query.eq("category_id", category_id)
        if is_pinned is not None:
            query = query.eq("is_pinned", is_pinned)

        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/threads-with-details")
async def list_threads_with_details(
    skip: int = 0,
    limit: int = 50,
    category_slug: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "active"
):
    """
    List forum threads with full details from view.
    Supports search by title and sorting by activity or latest.
    """
    try:
        client = get_client()
        query = client.table("forum_threads_with_details").select("*")

        if category_slug:
            query = query.eq("category_slug", category_slug)

        if search:
            query = query.ilike("title", f"%{search}%")

        # Always sort pinned first, then by selected sort field
        query = query.order("is_pinned", desc=True)

        if sort_by == "latest":
            query = query.order("created_at", desc=True)
        else:
            # "active" - sort by last reply, with fallback to created_at
            query = query.order("last_reply_at", desc=True)

        response = query.range(skip, skip + limit - 1).execute()
        return response.data or []
    except Exception as e:
        print(f"Error fetching threads: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/threads/{thread_id}", response_model=ForumThread)
async def get_thread(thread_id: str):
    """Get thread by ID"""
    try:
        client = get_client()
        response = client.table("forum_threads").select("*").eq("id", thread_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Thread not found")

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/threads/{thread_id}/details")
async def get_thread_with_details(thread_id: str):
    """Get thread with full details from view (author info, reply count, etc.)"""
    try:
        client = get_client()
        response = client.table("forum_threads_with_details").select("*").eq("id", thread_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Thread not found")

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/threads", response_model=ForumThread)
async def create_thread(thread: ForumThreadCreate, author_id: str):
    """Create new thread"""
    try:
        client = get_client()
        data = thread.model_dump()
        data["author_id"] = author_id
        data["reply_count"] = 0
        
        response = client.table("forum_threads").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/threads/{thread_id}", response_model=ForumThread)
async def update_thread(thread_id: str, thread: ForumThreadUpdate):
    """Update thread"""
    try:
        client = get_client()
        response = client.table("forum_threads").update(
            thread.model_dump(exclude_unset=True)
        ).eq("id", thread_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    """Delete thread (admin only)"""
    try:
        client = get_client()
        
        # Delete all replies first
        client.table("forum_replies").delete().eq("thread_id", thread_id).execute()
        
        # Delete thread
        client.table("forum_threads").delete().eq("id", thread_id).execute()
        
        return {"message": "Thread deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Replies
@router.get("/threads/{thread_id}/replies", response_model=List[ForumReply])
async def list_thread_replies(thread_id: str, skip: int = 0, limit: int = 50):
    """List thread replies"""
    try:
        client = get_client()
        response = client.table("forum_replies").select("*").eq(
            "thread_id", thread_id
        ).range(skip, skip + limit - 1).order("created_at").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/threads/{thread_id}/replies-with-profiles")
async def list_thread_replies_with_profiles(thread_id: str):
    """List thread replies with author profile info from view"""
    try:
        client = get_client()
        response = client.table("forum_replies_with_profiles").select("*").eq(
            "thread_id", thread_id
        ).order("created_at").execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/replies", response_model=ForumReply)
async def create_reply(reply: ForumReplyCreate, author_id: str):
    """Create thread reply"""
    try:
        client = get_client()
        data = reply.model_dump()
        data["author_id"] = author_id
        
        # Insert reply
        response = client.table("forum_replies").insert(data).execute()
        
        # Increment thread reply count
        client.rpc("increment_thread_replies", {"thread_id": reply.thread_id}).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/replies/{reply_id}")
async def delete_reply(reply_id: str):
    """Delete reply (admin only)"""
    try:
        client = get_client()
        
        # Get thread_id before deleting
        reply_data = client.table("forum_replies").select("thread_id").eq("id", reply_id).execute()
        
        if reply_data.data:
            thread_id = reply_data.data[0]["thread_id"]
            
            # Delete reply
            client.table("forum_replies").delete().eq("id", reply_id).execute()
            
            # Decrement thread reply count
            client.rpc("decrement_thread_replies", {"thread_id": thread_id}).execute()
        
        return {"message": "Reply deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
