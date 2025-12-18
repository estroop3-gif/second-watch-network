"""
Connections API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from app.schemas.connections import Connection, ConnectionCreate, ConnectionUpdate

router = APIRouter()


@router.post("/", response_model=Connection)
async def create_connection_request(connection: ConnectionCreate, requester_id: str):
    """Send connection request"""
    try:
        client = get_client()
        data = connection.model_dump()
        data["requester_id"] = requester_id
        data["status"] = "pending"
        
        response = client.table("connections").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[Connection])
async def list_connections(
    user_id: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """List user's connections"""
    try:
        client = get_client()
        query = client.table("connections").select("*").or_(
            f"requester_id.eq.{user_id},recipient_id.eq.{user_id}"
        )
        
        if status:
            query = query.eq("status", status)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{connection_id}", response_model=Connection)
async def update_connection(connection_id: str, update: ConnectionUpdate):
    """Update connection status (accept/deny)"""
    try:
        client = get_client()
        response = client.table("connections").update(
            update.model_dump()
        ).eq("id", connection_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
