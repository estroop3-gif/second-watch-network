"""
Directory API Routes - Site-wide user search for adding members to projects
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_client

router = APIRouter()


class DirectoryUser(BaseModel):
    """User profile data for directory search results"""
    profile_id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None


class DirectorySearchResponse(BaseModel):
    """Response from directory search"""
    users: List[DirectoryUser]
    total: int
    limit: int
    offset: int


async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:

        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


@router.get("/users", response_model=DirectorySearchResponse)
async def search_directory_users(
    q: Optional[str] = Query(None, description="Search term for username, full name, or display name"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    exclude_project: Optional[str] = Query(None, description="Exclude users who are already members of this project"),
    authorization: str = Header(None)
):
    """
    Search across all users visible in the Community directory.

    Returns users who have community_visible = true OR are filmmakers.
    Results include profile_id, username, full_name, display_name, avatar_url.

    Used by the Backlot "Add from Network" feature to find users to add to projects.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Build the base query - select from profiles
        # Include users who are community visible or have filmmaker profiles
        base_query = client.table("profiles").select(
            "id, username, full_name, display_name, avatar_url, created_at, community_visible"
        )

        # Get user IDs to exclude (existing project members)
        excluded_user_ids = set()
        if exclude_project:
            # Get existing project members
            members_resp = client.table("backlot_project_members").select(
                "user_id"
            ).eq("project_id", exclude_project).execute()

            if members_resp.data:
                excluded_user_ids = {m["user_id"] for m in members_resp.data}

            # Also exclude the project owner
            project_resp = client.table("backlot_projects").select(
                "owner_id"
            ).eq("id", exclude_project).execute()

            if project_resp.data:
                excluded_user_ids.add(project_resp.data[0]["owner_id"])

        # Get filmmaker user IDs (they should always be visible in directory)
        filmmaker_resp = client.table("filmmaker_profiles").select("user_id").execute()
        filmmaker_user_ids = {f["user_id"] for f in (filmmaker_resp.data or [])}

        # Execute the query with search filter if provided
        if q and q.strip():
            search_term = q.strip()
            # Search across username, full_name, and display_name
            response = base_query.or_(
                f"username.ilike.%{search_term}%,full_name.ilike.%{search_term}%,display_name.ilike.%{search_term}%"
            ).order("full_name", desc=False, nullsfirst=False).execute()
        else:
            response = base_query.order("full_name", desc=False, nullsfirst=False).execute()

        # Filter results:
        # 1. Must be community_visible=true OR be a filmmaker
        # 2. Must not be in excluded_user_ids
        all_profiles = response.data or []
        filtered_profiles = []

        for profile in all_profiles:
            user_id = profile["id"]

            # Skip excluded users
            if user_id in excluded_user_ids:
                continue

            # Include if community_visible or is a filmmaker
            is_visible = profile.get("community_visible", False)
            is_filmmaker = user_id in filmmaker_user_ids

            if is_visible or is_filmmaker:
                filtered_profiles.append(profile)

        # Apply pagination
        total = len(filtered_profiles)
        paginated_profiles = filtered_profiles[offset:offset + limit]

        # Convert to response format
        users = [
            DirectoryUser(
                profile_id=p["id"],
                username=p.get("username"),
                full_name=p.get("full_name"),
                display_name=p.get("display_name"),
                avatar_url=p.get("avatar_url"),
                created_at=p.get("created_at"),
            )
            for p in paginated_profiles
        ]

        return DirectorySearchResponse(
            users=users,
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}/project-membership")
async def check_project_membership(
    user_id: str,
    project_id: str = Query(..., description="Project ID to check membership for"),
    authorization: str = Header(None)
):
    """
    Check if a user is already a member of a specific project.
    Returns membership status and role if member.
    """
    current_user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Check if user is project owner
        project_resp = client.table("backlot_projects").select(
            "owner_id"
        ).eq("id", project_id).execute()

        if not project_resp.data:
            raise HTTPException(status_code=404, detail="Project not found")

        if project_resp.data[0]["owner_id"] == user_id:
            return {
                "is_member": True,
                "role": "owner",
                "message": "User is the project owner"
            }

        # Check project members
        member_resp = client.table("backlot_project_members").select(
            "id, role, production_role"
        ).eq("project_id", project_id).eq("user_id", user_id).execute()

        if member_resp.data:
            member = member_resp.data[0]
            return {
                "is_member": True,
                "role": member["role"],
                "production_role": member.get("production_role"),
                "message": "User is already a project member"
            }

        return {
            "is_member": False,
            "role": None,
            "message": "User is not a member of this project"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
