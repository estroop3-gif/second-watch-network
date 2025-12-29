"""
Admin Storage API
Endpoints for monitoring and managing user storage quotas
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from app.core.database import get_client

router = APIRouter()


async def get_current_user_from_token(token: str) -> Dict[str, Any]:
    """Extract and validate user from token"""
    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "sub": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def require_admin(authorization: str) -> dict:
    """Verify user is admin"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization.replace("Bearer ", "")
    user = await get_current_user_from_token(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = user.get("id") or user.get("sub")
    client = get_client()

    profile = client.table("profiles").select("is_admin, is_superadmin").eq("id", user_id).single().execute()

    if not profile.data or not (profile.data.get("is_admin") or profile.data.get("is_superadmin")):
        raise HTTPException(status_code=403, detail="Admin access required")

    return {"id": user_id, **profile.data}


class SetQuotaRequest(BaseModel):
    quota_bytes: int


def format_bytes(bytes_val: int) -> str:
    """Format bytes to human-readable string"""
    if bytes_val is None:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(bytes_val) < 1024.0:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} PB"


@router.get("/overview")
async def get_storage_overview(authorization: str = Header(None)):
    """Get platform-wide storage statistics"""
    await require_admin(authorization)

    client = get_client()

    # Get total storage used
    total_result = client.table("user_storage_usage").select(
        "total_bytes_used, backlot_files_bytes, backlot_media_bytes, avatar_bytes"
    ).execute()

    total_bytes = 0
    backlot_files = 0
    backlot_media = 0
    avatars = 0

    for row in (total_result.data or []):
        total_bytes += row.get("total_bytes_used") or 0
        backlot_files += row.get("backlot_files_bytes") or 0
        backlot_media += row.get("backlot_media_bytes") or 0
        avatars += row.get("avatar_bytes") or 0

    # Get user count
    user_count = client.table("profiles").select("id", count="exact").execute()

    # Get users with storage usage
    users_with_storage = client.table("user_storage_usage").select("id", count="exact").gt("total_bytes_used", 0).execute()

    # Get top 10 users by storage
    top_users_result = client.table("user_storage_usage").select(
        "user_id, total_bytes_used, custom_quota_bytes, profiles(id, display_name, email, avatar_url)"
    ).order("total_bytes_used", desc=True).limit(10).execute()

    top_users = []
    for row in (top_users_result.data or []):
        profile = row.get("profiles") or {}
        top_users.append({
            "user_id": row["user_id"],
            "display_name": profile.get("display_name"),
            "email": profile.get("email"),
            "avatar_url": profile.get("avatar_url"),
            "bytes_used": row["total_bytes_used"],
            "bytes_used_formatted": format_bytes(row["total_bytes_used"]),
            "custom_quota": row.get("custom_quota_bytes")
        })

    # Get users near quota (>80%)
    users_near_quota = []
    all_usage = client.table("user_storage_usage").select(
        "user_id, total_bytes_used, custom_quota_bytes, profiles(id, display_name, email)"
    ).gt("total_bytes_used", 0).execute()

    for row in (all_usage.data or []):
        usage = row["total_bytes_used"] or 0
        custom_quota = row.get("custom_quota_bytes")

        # Get effective quota from roles if no custom quota
        if custom_quota:
            effective_quota = custom_quota
        else:
            # Get max quota from user's roles
            roles_result = client.table("user_roles").select(
                "custom_roles(storage_quota_bytes)"
            ).eq("user_id", row["user_id"]).execute()

            max_quota = 1073741824  # 1GB default
            for role in (roles_result.data or []):
                role_quota = role.get("custom_roles", {}).get("storage_quota_bytes") or 0
                if role_quota > max_quota:
                    max_quota = role_quota
            effective_quota = max_quota

        if effective_quota > 0:
            percentage = (usage / effective_quota) * 100
            if percentage >= 80:
                profile = row.get("profiles") or {}
                users_near_quota.append({
                    "user_id": row["user_id"],
                    "display_name": profile.get("display_name"),
                    "email": profile.get("email"),
                    "bytes_used": usage,
                    "bytes_used_formatted": format_bytes(usage),
                    "quota_bytes": effective_quota,
                    "quota_formatted": format_bytes(effective_quota),
                    "percentage": round(percentage, 1)
                })

    # Sort by percentage descending
    users_near_quota.sort(key=lambda x: x["percentage"], reverse=True)

    return {
        "total_bytes_used": total_bytes,
        "total_formatted": format_bytes(total_bytes),
        "breakdown": {
            "backlot_files": {
                "bytes": backlot_files,
                "formatted": format_bytes(backlot_files)
            },
            "backlot_media": {
                "bytes": backlot_media,
                "formatted": format_bytes(backlot_media)
            },
            "avatars": {
                "bytes": avatars,
                "formatted": format_bytes(avatars)
            }
        },
        "total_users": user_count.count or 0,
        "users_with_storage": users_with_storage.count or 0,
        "top_users": top_users,
        "users_near_quota": users_near_quota[:10]  # Top 10 users near quota
    }


@router.get("/users")
async def get_users_storage(
    skip: int = 0,
    limit: int = 50,
    sort_by: str = "total_bytes_used",
    sort_order: str = "desc",
    search: str = None,
    authorization: str = Header(None)
):
    """List users with their storage usage"""
    await require_admin(authorization)

    client = get_client()

    # Build query
    query = client.table("user_storage_usage").select(
        "*, profiles(id, display_name, email, avatar_url)",
        count="exact"
    )

    # Order
    desc = sort_order.lower() == "desc"
    if sort_by in ["total_bytes_used", "last_updated", "created_at"]:
        query = query.order(sort_by, desc=desc)
    else:
        query = query.order("total_bytes_used", desc=True)

    # Pagination
    query = query.range(skip, skip + limit - 1)

    result = query.execute()

    users = []
    for row in (result.data or []):
        profile = row.get("profiles") or {}
        custom_quota = row.get("custom_quota_bytes")

        # Get effective quota
        if custom_quota:
            effective_quota = custom_quota
        else:
            roles_result = client.table("user_roles").select(
                "custom_roles(storage_quota_bytes)"
            ).eq("user_id", row["user_id"]).execute()

            max_quota = 1073741824
            for role in (roles_result.data or []):
                role_quota = role.get("custom_roles", {}).get("storage_quota_bytes") or 0
                if role_quota > max_quota:
                    max_quota = role_quota
            effective_quota = max_quota

        usage = row.get("total_bytes_used") or 0
        percentage = (usage / effective_quota * 100) if effective_quota > 0 else 0

        users.append({
            "user_id": row["user_id"],
            "display_name": profile.get("display_name"),
            "email": profile.get("email"),
            "avatar_url": profile.get("avatar_url"),
            "bytes_used": usage,
            "bytes_used_formatted": format_bytes(usage),
            "quota_bytes": effective_quota,
            "quota_formatted": format_bytes(effective_quota),
            "custom_quota_bytes": custom_quota,
            "percentage": round(percentage, 1),
            "last_updated": row.get("last_updated")
        })

    return {
        "users": users,
        "total": result.count or 0
    }


@router.get("/users/{user_id}")
async def get_user_storage_detail(user_id: str, authorization: str = Header(None)):
    """Get detailed storage breakdown for a user"""
    await require_admin(authorization)

    client = get_client()

    # Get storage usage
    usage = client.table("user_storage_usage").select("*").eq("user_id", user_id).single().execute()

    # Get user profile
    profile = client.table("profiles").select("id, display_name, email, avatar_url").eq("id", user_id).single().execute()

    if not profile.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's roles
    roles_result = client.table("user_roles").select(
        "custom_roles(id, name, display_name, storage_quota_bytes)"
    ).eq("user_id", user_id).execute()

    roles = [r.get("custom_roles") for r in (roles_result.data or []) if r.get("custom_roles")]

    # Calculate effective quota
    custom_quota = usage.data.get("custom_quota_bytes") if usage.data else None
    if custom_quota:
        effective_quota = custom_quota
    else:
        max_quota = 1073741824
        for role in roles:
            role_quota = role.get("storage_quota_bytes") or 0
            if role_quota > max_quota:
                max_quota = role_quota
        effective_quota = max_quota

    usage_data = usage.data or {
        "total_bytes_used": 0,
        "backlot_files_bytes": 0,
        "backlot_media_bytes": 0,
        "avatar_bytes": 0
    }

    total_used = usage_data.get("total_bytes_used") or 0
    percentage = (total_used / effective_quota * 100) if effective_quota > 0 else 0

    # Get recent files (top 10 largest)
    files_result = client.table("backlot_files").select(
        "id, file_name, file_size, file_type, created_at"
    ).eq("uploaded_by", user_id).order("file_size", desc=True).limit(10).execute()

    return {
        "user": profile.data,
        "roles": roles,
        "storage": {
            "total_bytes_used": total_used,
            "total_formatted": format_bytes(total_used),
            "quota_bytes": effective_quota,
            "quota_formatted": format_bytes(effective_quota),
            "custom_quota_bytes": custom_quota,
            "percentage": round(percentage, 1),
            "breakdown": {
                "backlot_files": {
                    "bytes": usage_data.get("backlot_files_bytes") or 0,
                    "formatted": format_bytes(usage_data.get("backlot_files_bytes") or 0)
                },
                "backlot_media": {
                    "bytes": usage_data.get("backlot_media_bytes") or 0,
                    "formatted": format_bytes(usage_data.get("backlot_media_bytes") or 0)
                },
                "avatars": {
                    "bytes": usage_data.get("avatar_bytes") or 0,
                    "formatted": format_bytes(usage_data.get("avatar_bytes") or 0)
                }
            },
            "last_updated": usage_data.get("last_updated")
        },
        "largest_files": [
            {
                "id": f["id"],
                "name": f["file_name"],
                "size": f["file_size"],
                "size_formatted": format_bytes(f["file_size"]),
                "type": f["file_type"],
                "created_at": f["created_at"]
            }
            for f in (files_result.data or [])
        ]
    }


@router.put("/users/{user_id}/quota")
async def set_user_quota(user_id: str, data: SetQuotaRequest, authorization: str = Header(None)):
    """Set custom quota for a specific user"""
    await require_admin(authorization)

    client = get_client()

    # Verify user exists
    user = client.table("profiles").select("id").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Upsert storage usage with custom quota
    result = client.table("user_storage_usage").upsert({
        "user_id": user_id,
        "custom_quota_bytes": data.quota_bytes,
        "last_updated": datetime.utcnow().isoformat()
    }).execute()

    return {
        "success": True,
        "message": "Custom quota set",
        "quota_bytes": data.quota_bytes,
        "quota_formatted": format_bytes(data.quota_bytes)
    }


@router.delete("/users/{user_id}/quota")
async def remove_user_quota(user_id: str, authorization: str = Header(None)):
    """Remove custom quota for a user (will use role-based quota)"""
    await require_admin(authorization)

    client = get_client()

    # Update storage usage to remove custom quota
    client.table("user_storage_usage").update({
        "custom_quota_bytes": None,
        "last_updated": datetime.utcnow().isoformat()
    }).eq("user_id", user_id).execute()

    return {
        "success": True,
        "message": "Custom quota removed, user will use role-based quota"
    }


@router.post("/recalculate")
async def recalculate_storage(authorization: str = Header(None)):
    """Recalculate storage usage for all users from backlot_files"""
    await require_admin(authorization)

    client = get_client()

    # This will recalculate storage for all users
    # Get all users with files
    result = client.rpc("recalculate_all_storage").execute()

    # Fallback: do it manually if RPC doesn't exist
    try:
        # Get all unique uploaders
        uploaders = client.table("backlot_files").select("uploaded_by").execute()
        unique_users = set(row["uploaded_by"] for row in (uploaders.data or []) if row.get("uploaded_by"))

        updated = 0
        for user_id in unique_users:
            # Calculate total for user
            files = client.table("backlot_files").select("file_size").eq("uploaded_by", user_id).execute()
            total = sum(f.get("file_size") or 0 for f in (files.data or []))

            # Upsert
            client.table("user_storage_usage").upsert({
                "user_id": user_id,
                "total_bytes_used": total,
                "backlot_files_bytes": total,
                "last_updated": datetime.utcnow().isoformat()
            }).execute()
            updated += 1

        return {
            "success": True,
            "message": f"Storage recalculated for {updated} users"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recalculation failed: {str(e)}")
