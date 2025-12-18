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


@router.delete("/{connection_id}")
async def delete_connection(connection_id: str):
    """Delete/cancel a connection request"""
    try:
        client = get_client()
        client.table("connections").delete().eq("id", connection_id).execute()
        return {"message": "Connection deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/relationship/{peer_id}")
async def get_connection_relationship(peer_id: str, user_id: str):
    """Get connection relationship between current user and a peer"""
    try:
        client = get_client()
        response = client.table("connections").select("*").or_(
            f"and(requester_id.eq.{user_id},addressee_id.eq.{peer_id}),and(requester_id.eq.{peer_id},addressee_id.eq.{user_id})"
        ).order("created_at", desc=True).limit(1).execute()

        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
