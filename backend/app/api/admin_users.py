"""
Admin Users API
Endpoints for admin user creation and management
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
import secrets
import string

from app.core.database import get_client, get_db_session

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


class CreateUserRequest(BaseModel):
    email: EmailStr
    display_name: str
    full_name: Optional[str] = None
    role_ids: List[str] = []
    platform_roles: List[str] = []
    custom_quota_bytes: Optional[int] = None
    send_welcome_email: bool = True
    custom_password: Optional[str] = None


class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None


def generate_temp_password(length: int = 16) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    # Ensure at least one of each required type
    password = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*")
    ]
    # Fill the rest
    password.extend(secrets.choice(alphabet) for _ in range(length - 4))
    # Shuffle
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)


@router.post("/create")
async def admin_create_user(data: CreateUserRequest, authorization: str = Header(None)):
    """Admin creates a new user account"""
    admin = await require_admin(authorization)

    client = get_client()

    # Check if email already exists
    existing = client.table("profiles").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        from app.core.cognito import CognitoAuth
        import boto3

        # Use custom password if provided, otherwise generate one
        temp_password = data.custom_password if data.custom_password else generate_temp_password()

        # Create Cognito user
        cognito_result = CognitoAuth.admin_create_user(
            email=data.email,
            name=data.display_name,
            temporary_password=temp_password
        )

        if cognito_result.get("error"):
            raise HTTPException(status_code=400, detail=cognito_result["error"]["message"])

        cognito_user = cognito_result.get("user", {})
        cognito_user_id = cognito_user.get("id") or cognito_user.get("Username")

        # Create profile in database
        profile_data = {
            "id": cognito_user_id,
            "email": data.email,
            "display_name": data.display_name,
            "full_name": data.full_name or data.display_name,
            "created_by": admin["id"],
            "created_by_admin": True,
            "temp_password": temp_password,
            "temp_password_set_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        profile_result = client.table("profiles").insert(profile_data).execute()

        if not profile_result.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")

        user_id = profile_result.data[0]["id"]

        # Assign roles if provided
        if data.role_ids:
            # Verify roles exist and get their names
            roles = client.table("custom_roles").select("id, name").in_("id", data.role_ids).execute()
            valid_roles = roles.data or []
            valid_role_ids = [r["id"] for r in valid_roles]
            role_names = [r["name"] for r in valid_roles]

            if valid_role_ids:
                # Insert into user_roles table
                assignments = [
                    {
                        "user_id": user_id,
                        "role_id": role_id,
                        "assigned_by": admin["id"],
                        "assigned_at": datetime.utcnow().isoformat()
                    }
                    for role_id in valid_role_ids
                ]
                client.table("user_roles").insert(assignments).execute()

                # Also set boolean flags on profiles for compatibility
                role_flags = {}
                role_to_flag = {
                    "superadmin": "is_superadmin",
                    "admin": "is_admin",
                    "moderator": "is_moderator",
                    "sales_admin": "is_sales_admin",
                    "sales_agent": "is_sales_agent",
                    "sales_rep": "is_sales_rep",
                    "lodge_officer": "is_lodge_officer",
                    "order_member": "is_order_member",
                    "partner": "is_partner",
                    "filmmaker": "is_filmmaker",
                    "basic_filmmaker": "is_filmmaker",
                    "pro_filmmaker": "is_filmmaker",
                    "premium": "is_premium",
                    "alpha_tester": "is_alpha_tester",
                }
                for role_name in role_names:
                    flag = role_to_flag.get(role_name)
                    if flag:
                        role_flags[flag] = True

                if role_flags:
                    client.table("profiles").update(role_flags).eq("id", user_id).execute()

        # Handle platform roles (boolean flags on profiles)
        if data.platform_roles:
            platform_flags = {}
            platform_role_to_flag = {
                "superadmin": "is_superadmin",
                "admin": "is_admin",
                "moderator": "is_moderator",
                "sales_admin": "is_sales_admin",
                "sales_agent": "is_sales_agent",
                "sales_rep": "is_sales_rep",
                "lodge_officer": "is_lodge_officer",
                "order_member": "is_order_member",
                "partner": "is_partner",
                "filmmaker": "is_filmmaker",
                "premium": "is_premium",
                "alpha_tester": "is_alpha_tester",
            }
            for role_name in data.platform_roles:
                flag = platform_role_to_flag.get(role_name)
                if flag:
                    platform_flags[flag] = True
            if platform_flags:
                client.table("profiles").update(platform_flags).eq("id", user_id).execute()

        # Initialize storage tracking
        storage_data = {
            "user_id": user_id,
            "total_bytes_used": 0,
            "backlot_files_bytes": 0,
            "backlot_media_bytes": 0,
            "avatar_bytes": 0,
            "custom_quota_bytes": data.custom_quota_bytes,
            "created_at": datetime.utcnow().isoformat(),
            "last_updated": datetime.utcnow().isoformat()
        }
        client.table("user_storage_usage").insert(storage_data).execute()

        # Send welcome email if requested
        email_sent = False
        email_error = None
        if data.send_welcome_email:
            try:
                from app.services.email_service import send_welcome_email
                result = await send_welcome_email(
                    email=data.email,
                    name=data.display_name,
                    temp_password=temp_password
                )
                email_sent = result.get("success", False) if isinstance(result, dict) else False
                if not email_sent and isinstance(result, dict):
                    email_error = result.get("error")
            except Exception as e:
                email_error = str(e)

        # Build response message
        if data.send_welcome_email:
            if email_sent:
                message = "User created successfully. Welcome email sent with login instructions."
            elif email_error:
                message = f"User created successfully. Warning: Welcome email failed to send ({email_error}). Temp password is included below."
            else:
                message = "User created successfully. Welcome email may not have been delivered. Temp password is included below."
        else:
            message = "User created successfully. Temporary password provided - share securely with user."

        return {
            "success": True,
            "user": {
                "id": user_id,
                "email": data.email,
                "display_name": data.display_name,
                "roles_assigned": len(data.role_ids)
            },
            "temp_password": temp_password,
            "email_sent": email_sent,
            "email_error": email_error,
            "message": message
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.get("/")
async def list_users_with_roles(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    role_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """List users with their roles and storage info"""
    await require_admin(authorization)

    client = get_client()

    # Build query
    query = client.table("profiles").select(
        "id, email, display_name, full_name, avatar_url, is_admin, is_filmmaker, is_partner, created_at, created_by_admin",
        count="exact"
    )

    # Search filter
    if search:
        query = query.or_(f"email.ilike.%{search}%,display_name.ilike.%{search}%")

    # Pagination
    query = query.order("created_at", desc=True).range(skip, skip + limit - 1)

    result = query.execute()

    users = []
    for profile in (result.data or []):
        user_id = profile["id"]

        # Get user's roles
        roles_result = client.table("user_roles").select(
            "custom_roles(id, name, display_name, color, storage_quota_bytes)"
        ).eq("user_id", user_id).execute()

        roles = [r.get("custom_roles") for r in (roles_result.data or []) if r.get("custom_roles")]

        # Get storage usage
        storage_result = client.table("user_storage_usage").select(
            "total_bytes_used, custom_quota_bytes"
        ).eq("user_id", user_id).single().execute()

        storage = storage_result.data or {"total_bytes_used": 0, "custom_quota_bytes": None}

        # Calculate effective quota
        custom_quota = storage.get("custom_quota_bytes")
        if custom_quota:
            effective_quota = custom_quota
        else:
            max_quota = 1073741824  # 1GB default
            for role in roles:
                role_quota = role.get("storage_quota_bytes") or 0
                if role_quota > max_quota:
                    max_quota = role_quota
            effective_quota = max_quota

        usage = storage.get("total_bytes_used") or 0
        percentage = (usage / effective_quota * 100) if effective_quota > 0 else 0

        # Filter by role if specified
        if role_id:
            role_ids = [r.get("id") for r in roles]
            if role_id not in role_ids:
                continue

        users.append({
            **profile,
            "roles": roles,
            "storage": {
                "bytes_used": usage,
                "quota_bytes": effective_quota,
                "custom_quota_bytes": custom_quota,
                "percentage": round(percentage, 1)
            }
        })

    return {
        "users": users,
        "total": result.count or 0
    }


@router.get("/{user_id}")
async def get_user_detail(user_id: str, authorization: str = Header(None)):
    """Get detailed user information"""
    await require_admin(authorization)

    client = get_client()

    # Get profile
    profile = client.table("profiles").select("*").eq("id", user_id).single().execute()

    if not profile.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Get roles
    roles_result = client.table("user_roles").select(
        "assigned_at, assigned_by, custom_roles(*)"
    ).eq("user_id", user_id).execute()

    roles = []
    for r in (roles_result.data or []):
        if r.get("custom_roles"):
            roles.append({
                **r["custom_roles"],
                "assigned_at": r["assigned_at"],
                "assigned_by": r["assigned_by"]
            })

    # Get storage
    storage = client.table("user_storage_usage").select("*").eq("user_id", user_id).single().execute()

    # Get creator info if admin-created
    creator = None
    if profile.data.get("created_by"):
        creator_result = client.table("profiles").select(
            "id, display_name, email"
        ).eq("id", profile.data["created_by"]).single().execute()
        creator = creator_result.data

    return {
        "user": profile.data,
        "roles": roles,
        "storage": storage.data,
        "created_by": creator
    }


@router.put("/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, authorization: str = Header(None)):
    """Update user profile (admin)"""
    await require_admin(authorization)

    client = get_client()

    # Build update data
    update_data = {"updated_at": datetime.utcnow().isoformat()}

    if data.display_name is not None:
        update_data["display_name"] = data.display_name
    if data.full_name is not None:
        update_data["full_name"] = data.full_name
    if data.bio is not None:
        update_data["bio"] = data.bio

    result = client.table("profiles").update(update_data).eq("id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return result.data[0]


@router.post("/{user_id}/reset-password")
async def reset_user_password(user_id: str, authorization: str = Header(None)):
    """Reset user password (sends reset email)"""
    await require_admin(authorization)

    client = get_client()

    # Get user email
    user = client.table("profiles").select("email").eq("id", user_id).single().execute()

    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.admin_reset_password(user.data["email"])

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        return {
            "success": True,
            "message": "Password reset email sent to user"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")


class SetPasswordRequest(BaseModel):
    password: str
    permanent: bool = True


@router.post("/{user_id}/set-password")
async def set_user_password(user_id: str, data: SetPasswordRequest, authorization: str = Header(None)):
    """Admin: Set a user's password directly"""
    await require_admin(authorization)

    client = get_client()

    user = client.table("profiles").select("email").eq("id", user_id).single().execute()

    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.admin_set_user_password(
            email=user.data["email"],
            password=data.password,
            permanent=data.permanent
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        # Update temp_password in profile so it's visible in admin drawer
        client.table("profiles").update({
            "temp_password": data.password,
            "temp_password_set_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()

        return {
            "success": True,
            "message": "Password set successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set password: {str(e)}")


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr


@router.post("/{user_id}/change-email")
async def change_user_email(user_id: str, data: ChangeEmailRequest, authorization: str = Header(None)):
    """Admin: Change a user's email address"""
    await require_admin(authorization)

    client = get_client()

    user = client.table("profiles").select("email").eq("id", user_id).single().execute()

    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    old_email = user.data["email"]

    if old_email == data.new_email:
        raise HTTPException(status_code=400, detail="New email is the same as current email")

    # Check if new email is already taken
    existing = client.table("profiles").select("id").eq("email", data.new_email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already in use by another account")

    try:
        from app.core.cognito import CognitoAuth

        # Update in Cognito first
        result = CognitoAuth.admin_update_email(
            old_email=old_email,
            new_email=data.new_email
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        # Update in database
        client.table("profiles").update({
            "email": data.new_email,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", user_id).execute()

        return {
            "success": True,
            "old_email": old_email,
            "new_email": data.new_email,
            "message": f"Email changed from {old_email} to {data.new_email}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to change email: {str(e)}")


@router.delete("/{user_id}")
async def delete_user(user_id: str, authorization: str = Header(None)):
    """Delete a user account"""
    admin = await require_admin(authorization)

    # Prevent self-deletion
    if admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    client = get_client()

    # Get user
    user = client.table("profiles").select("email, is_superadmin").eq("id", user_id).single().execute()

    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deleting superadmins
    if user.data.get("is_superadmin"):
        raise HTTPException(status_code=400, detail="Cannot delete superadmin accounts")

    try:
        from app.core.cognito import CognitoAuth
        from sqlalchemy import text

        # Delete from Cognito
        CognitoAuth.admin_delete_user(user.data["email"])

        # Clean up tables with non-CASCADE FK constraints before deleting profile.
        # Tables with ON DELETE CASCADE or ON DELETE SET NULL are handled by the DB.
        with get_db_session() as db:
            # CRM tables
            db.execute(text("DELETE FROM crm_email_accounts WHERE profile_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_email_internal_notes WHERE author_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_email_sequence_enrollments WHERE enrolled_by = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_email_sequences WHERE created_by = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_email_templates WHERE created_by = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_discussion_replies WHERE author_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_discussion_threads WHERE author_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_discussion_categories WHERE created_by = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_business_cards WHERE profile_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_ai_usage WHERE profile_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_contact_notes WHERE author_id = :uid"), {"uid": user_id})
            db.execute(text("DELETE FROM crm_training_resources WHERE author_id = :uid"), {"uid": user_id})
            db.execute(text("UPDATE crm_email_threads SET assigned_to = NULL WHERE assigned_to = :uid"), {"uid": user_id})
            # Notifications
            db.execute(text("DELETE FROM notifications WHERE user_id = :uid"), {"uid": user_id})

        # Delete from database (cascades to user_roles, user_storage_usage, etc.)
        client.table("profiles").delete().eq("id", user_id).execute()

        return {
            "success": True,
            "message": "User deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
