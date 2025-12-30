"""
Users API Routes
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from app.core.database import get_client, execute_query, execute_single

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> Optional[str]:
    """Look up profile ID from Cognito user ID"""
    uid_str = str(cognito_user_id)

    # Try cognito_user_id first
    result = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if result:
        return str(result["id"])

    # Fallback: try direct ID match
    result = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if result:
        return str(result["id"])

    return None


# All permission keys that can be set on roles
PERMISSION_KEYS = [
    # Parent permissions
    'can_access_backlot', 'can_access_greenroom', 'can_access_forum', 'can_access_community',
    'can_submit_content', 'can_upload_files', 'can_create_projects', 'can_invite_collaborators',
    'can_access_messages', 'can_access_submissions', 'can_access_order', 'can_access_profile',
    'can_moderate', 'can_admin',
    # Backlot
    'backlot_overview', 'backlot_scripts', 'backlot_callsheets', 'backlot_casting',
    'backlot_scenes', 'backlot_continuity', 'backlot_hotset', 'backlot_invoices',
    'backlot_timecards', 'backlot_expenses', 'backlot_budget', 'backlot_team',
    'backlot_files', 'backlot_coms', 'backlot_clearances', 'backlot_credits',
    # Green Room
    'greenroom_cycles', 'greenroom_submit', 'greenroom_vote', 'greenroom_results',
    # Forum
    'forum_read', 'forum_post', 'forum_reply', 'forum_react',
    # Community
    'community_collabs', 'community_apply_collabs', 'community_directory', 'community_connections',
    # Messages
    'messages_dm', 'messages_group', 'messages_attachments',
    # Submissions
    'submissions_create', 'submissions_view',
    # Order
    'order_directory', 'order_jobs', 'order_post_jobs', 'order_lodges', 'order_manage_lodge',
    # Profile
    'profile_edit', 'profile_availability', 'profile_resume', 'profile_filmmaker',
    # Moderation
    'mod_warn_users', 'mod_mute_users', 'mod_ban_users', 'mod_delete_content',
    'mod_review_reports', 'mod_review_flags',
    # Admin
    'admin_users', 'admin_roles', 'admin_applications', 'admin_submissions',
    'admin_greenroom', 'admin_forum', 'admin_settings', 'admin_billing', 'admin_audit',
]


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


@router.get("/me/permissions")
async def get_my_permissions(authorization: str = Header(None)):
    """Get current user's effective permissions from all assigned roles"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization.replace("Bearer ", "")
    user = await get_current_user_from_token(token)
    user_id = user.get("id") or user.get("sub")

    client = get_client()

    # Get user's profile for base permissions (is_admin, is_superadmin, etc.)
    try:
        profile_result = client.table("profiles").select(
            "is_admin, is_superadmin, is_moderator, is_premium, is_filmmaker, is_partner, is_order_member, is_lodge_officer"
        ).eq("id", user_id).limit(1).execute()
        profile_data = profile_result.data[0] if profile_result.data else {}
    except Exception:
        profile_data = {}

    # Get user's assigned roles with their permissions
    # Use explicit join format: alias:table!fk_column(columns)
    roles_result = client.table("user_roles").select(
        "role_id, custom_roles:custom_roles!role_id(*)"
    ).eq("user_id", user_id).execute()

    # Merge permissions from all roles (OR logic)
    merged_permissions: Dict[str, bool] = {key: False for key in PERMISSION_KEYS}
    role_names: List[str] = []

    for assignment in (roles_result.data or []):
        role = assignment.get("custom_roles")
        if role:
            role_names.append(role.get("name", ""))
            for key in PERMISSION_KEYS:
                if role.get(key):
                    merged_permissions[key] = True

    # Superadmins and admins get all permissions
    if profile_data:
        if profile_data.get("is_superadmin"):
            merged_permissions = {key: True for key in PERMISSION_KEYS}
            role_names.append("superadmin")
        elif profile_data.get("is_admin"):
            # Admins get all admin and moderation permissions
            for key in PERMISSION_KEYS:
                if key.startswith("admin_") or key.startswith("mod_") or key in ['can_admin', 'can_moderate']:
                    merged_permissions[key] = True
            role_names.append("admin")

        if profile_data.get("is_moderator"):
            role_names.append("moderator")
            for key in PERMISSION_KEYS:
                if key.startswith("mod_") or key == 'can_moderate':
                    merged_permissions[key] = True

    return {
        "user_id": user_id,
        "roles": role_names,
        "permissions": merged_permissions,
        "profile_flags": profile_data
    }


@router.get("/me/pending-documents")
async def get_my_pending_documents(authorization: str = Header(None)):
    """Get all pending documents (clearances) requiring the current user's signature"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization.replace("Bearer ", "")
    user = await get_current_user_from_token(token)
    cognito_id = user.get("id") or user.get("sub")

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(cognito_id)
    if not profile_id:
        return {"documents": []}

    # Query pending clearance recipients for this user
    # Note: backlot_clearance_items uses 'title' not 'name', and 'type' not 'clearance_type'
    # Field names are mapped to match frontend PendingDocument interface
    documents = execute_query("""
        SELECT
            r.id as recipient_id,
            r.clearance_id,
            r.signature_status,
            r.requires_signature,
            r.access_token,
            r.created_at as sent_at,
            r.viewed_at,
            c.id as clearance_item_id,
            c.title as clearance_title,
            c.description as document_description,
            c.type as clearance_type,
            c.project_id,
            c.file_url,
            c.file_name,
            c.expiration_date,
            COALESCE(c.batch_sign_allowed, false) as batch_sign_allowed,
            c.requested_date as due_date,
            p.title as project_title
        FROM backlot_clearance_recipients r
        JOIN backlot_clearance_items c ON r.clearance_id = c.id
        LEFT JOIN backlot_projects p ON c.project_id = p.id
        WHERE r.project_member_user_id = :user_id
          AND r.requires_signature = true
          AND r.signature_status IN ('pending', 'requested', 'not_started', 'viewed')
        ORDER BY r.created_at DESC
    """, {"user_id": profile_id})

    return {"documents": documents or []}


@router.get("/me/clearances/history")
async def get_my_clearance_history(authorization: str = Header(None)):
    """Get history of signed clearances for the current user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization.replace("Bearer ", "")
    user = await get_current_user_from_token(token)
    cognito_id = user.get("id") or user.get("sub")

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(cognito_id)
    if not profile_id:
        return {"documents": []}

    # Query signed clearances for this user
    # Note: backlot_clearance_items uses 'title' not 'name', and 'type' not 'clearance_type'
    documents = execute_query("""
        SELECT
            r.id as recipient_id,
            r.clearance_id,
            r.signature_status,
            r.signed_at,
            r.viewed_at,
            c.id as clearance_item_id,
            c.title as document_name,
            c.description as document_description,
            c.type as clearance_type,
            c.project_id,
            p.title as project_title
        FROM backlot_clearance_recipients r
        JOIN backlot_clearance_items c ON r.clearance_id = c.id
        LEFT JOIN backlot_projects p ON c.project_id = p.id
        WHERE r.project_member_user_id = :user_id
          AND r.signature_status = 'signed'
        ORDER BY r.signed_at DESC
    """, {"user_id": profile_id})

    return {"documents": documents or []}


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    role: str | None = None


@router.get("/{user_id}", response_model=UserProfile)
async def get_user(user_id: str):
    """Get user profile by ID"""
    try:
        client = get_client()
        response = client.table("profiles").select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{user_id}")
async def update_user(user_id: str, profile: UserProfile):
    """Update user profile"""
    try:
        client = get_client()
        response = client.table("profiles").update(
            profile.model_dump(exclude={"id"})
        ).eq("id", user_id).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_users(skip: int = 0, limit: int = 20):
    """List all users"""
    try:
        client = get_client()
        response = client.table("profiles").select("*").range(skip, skip + limit - 1).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
