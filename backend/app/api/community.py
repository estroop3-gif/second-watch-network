"""
Community/Search API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.supabase import get_supabase_client

router = APIRouter()


@router.get("/filmmakers")
async def search_filmmakers(
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "updated_at"
):
    """Search and list filmmakers with pagination"""
    try:
        supabase = get_supabase_client()
        
        # Join profiles and filmmaker_profiles
        db_query = supabase.table("filmmaker_profiles").select(
            "*, profiles(*)"
        )
        
        # Search by name or username if query provided
        if query:
            db_query = db_query.or_(
                f"profiles.full_name.ilike.%{query}%,profiles.username.ilike.%{query}%"
            )
        
        # Sorting
        response = db_query.range(skip, skip + limit - 1).order(
            sort_by, desc=True
        ).execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
async def global_search(query: str, type: Optional[str] = None):
    """Global search across multiple entities"""
    try:
        supabase = get_supabase_client()
        results = {
            "filmmakers": [],
            "threads": [],
            "content": []
        }
        
        if not type or type == "filmmakers":
            filmmakers = supabase.table("profiles").select("*").ilike(
                "full_name", f"%{query}%"
            ).limit(10).execute()
            results["filmmakers"] = filmmakers.data
        
        if not type or type == "threads":
            threads = supabase.table("forum_threads").select("*").ilike(
                "title", f"%{query}%"
            ).limit(10).execute()
            results["threads"] = threads.data
        
        if not type or type == "content":
            content = supabase.table("content").select("*").ilike(
                "title", f"%{query}%"
            ).limit(10).execute()
            results["content"] = content.data
        
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
