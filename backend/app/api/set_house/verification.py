"""
Set House Verification API

Endpoints for booking start/end verification sessions.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/verification", tags=["Set House Verification"])


# ============================================================================
# SCHEMAS
# ============================================================================

class VerificationSessionCreate(BaseModel):
    transaction_id: str
    verification_type: str  # booking_start, booking_end
    items_to_verify: List[dict] = []


class VerificationItemComplete(BaseModel):
    space_id: Optional[str] = None
    package_instance_id: Optional[str] = None
    condition_grade: Optional[str] = None
    condition_notes: Optional[str] = None
    photos: Optional[List[str]] = None


class SignatureCapture(BaseModel):
    signature_url: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# VERIFICATION SESSION ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_verification_sessions(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    verification_type: Optional[str] = Query(None, description="Filter by type"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List verification sessions for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query, execute_single

    conditions = ["vs.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("vs.status = :status")
        params["status"] = status

    if verification_type:
        conditions.append("vs.verification_type = :verification_type")
        params["verification_type"] = verification_type

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_verification_sessions vs WHERE {where_clause}",
        params
    )

    sessions = execute_query(
        f"""
        SELECT vs.*, t.reference_number as transaction_reference,
               p.display_name as completed_by_name
        FROM set_house_verification_sessions vs
        LEFT JOIN set_house_transactions t ON t.id = vs.transaction_id
        LEFT JOIN profiles p ON p.id = vs.completed_by
        WHERE {where_clause}
        ORDER BY vs.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"sessions": sessions, "total": count_result["total"] if count_result else 0}


@router.post("/{org_id}")
async def create_verification_session(
    org_id: str,
    data: VerificationSessionCreate,
    user=Depends(get_current_user)
):
    """Create a new verification session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    import json
    import secrets

    # Generate token for async link
    token = secrets.token_urlsafe(32)

    session = execute_insert(
        """
        INSERT INTO set_house_verification_sessions (
            organization_id, transaction_id, verification_type,
            items_to_verify, token, status
        ) VALUES (
            :org_id, :transaction_id, :verification_type,
            :items_to_verify, :token, 'pending'
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "transaction_id": data.transaction_id,
            "verification_type": data.verification_type,
            "items_to_verify": json.dumps(data.items_to_verify),
            "token": token
        }
    )

    if not session:
        raise HTTPException(status_code=500, detail="Failed to create verification session")

    return {"session": session}


@router.get("/{org_id}/{session_id}")
async def get_verification_session(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Get a verification session with items."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    session = execute_single(
        """
        SELECT vs.*, t.reference_number as transaction_reference,
               p.display_name as completed_by_name
        FROM set_house_verification_sessions vs
        LEFT JOIN set_house_transactions t ON t.id = vs.transaction_id
        LEFT JOIN profiles p ON p.id = vs.completed_by
        WHERE vs.id = :session_id AND vs.organization_id = :org_id
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    items = execute_query(
        """
        SELECT vi.*, s.name as space_name, s.internal_id as space_internal_id,
               pi.name as package_name, vp.display_name as verified_by_name
        FROM set_house_verification_items vi
        LEFT JOIN set_house_spaces s ON s.id = vi.space_id
        LEFT JOIN set_house_package_instances pi ON pi.id = vi.package_instance_id
        LEFT JOIN profiles vp ON vp.id = vi.verified_by
        WHERE vi.session_id = :session_id
        """,
        {"session_id": session_id}
    )

    session["items"] = items
    return {"session": session}


@router.post("/{org_id}/{session_id}/start")
async def start_verification(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Start a verification session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    session = execute_insert(
        """
        UPDATE set_house_verification_sessions
        SET status = 'in_progress', started_at = :now, updated_at = NOW()
        WHERE id = :session_id AND organization_id = :org_id
        RETURNING *
        """,
        {
            "session_id": session_id,
            "org_id": org_id,
            "now": datetime.now(timezone.utc)
        }
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    return {"session": session}


@router.post("/{org_id}/{session_id}/verify-item")
async def verify_item(
    org_id: str,
    session_id: str,
    data: VerificationItemComplete,
    user=Depends(get_current_user)
):
    """Verify an item in the session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_insert, execute_single
    from datetime import datetime, timezone
    import json

    # Check session exists
    session = execute_single(
        "SELECT * FROM set_house_verification_sessions WHERE id = :session_id AND organization_id = :org_id",
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    # Create or update verification item
    item = execute_insert(
        """
        INSERT INTO set_house_verification_items (
            session_id, space_id, package_instance_id,
            is_verified, verified_at, verified_by,
            condition_grade, condition_notes, photos
        ) VALUES (
            :session_id, :space_id, :package_instance_id,
            TRUE, :now, :verified_by,
            :condition_grade, :condition_notes, :photos
        )
        ON CONFLICT (session_id, COALESCE(space_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET
            is_verified = TRUE, verified_at = :now, verified_by = :verified_by,
            condition_grade = :condition_grade, condition_notes = :condition_notes,
            photos = :photos
        RETURNING *
        """,
        {
            "session_id": session_id,
            "space_id": data.space_id,
            "package_instance_id": data.package_instance_id,
            "now": datetime.now(timezone.utc),
            "verified_by": profile_id,
            "condition_grade": data.condition_grade,
            "condition_notes": data.condition_notes,
            "photos": json.dumps(data.photos or [])
        }
    )

    # Update session items_verified
    items_verified = json.loads(session["items_verified"]) if session["items_verified"] else []
    items_verified.append({
        "space_id": data.space_id,
        "package_instance_id": data.package_instance_id,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verified_by": profile_id
    })

    execute_insert(
        "UPDATE set_house_verification_sessions SET items_verified = :items_verified, updated_at = NOW() WHERE id = :session_id",
        {"session_id": session_id, "items_verified": json.dumps(items_verified)}
    )

    return {"item": item}


@router.post("/{org_id}/{session_id}/signature")
async def capture_signature(
    org_id: str,
    session_id: str,
    data: SignatureCapture,
    user=Depends(get_current_user)
):
    """Capture signature for verification session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    session = execute_insert(
        """
        UPDATE set_house_verification_sessions
        SET signature_url = :signature_url, signature_captured_at = :now, updated_at = NOW()
        WHERE id = :session_id AND organization_id = :org_id
        RETURNING *
        """,
        {
            "session_id": session_id,
            "org_id": org_id,
            "signature_url": data.signature_url,
            "now": datetime.now(timezone.utc)
        }
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    return {"session": session}


@router.post("/{org_id}/{session_id}/complete")
async def complete_verification(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Complete a verification session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    session = execute_insert(
        """
        UPDATE set_house_verification_sessions
        SET status = 'completed', completed_at = :now, completed_by = :user_id, updated_at = NOW()
        WHERE id = :session_id AND organization_id = :org_id
        RETURNING *
        """,
        {
            "session_id": session_id,
            "org_id": org_id,
            "now": datetime.now(timezone.utc),
            "user_id": profile_id
        }
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    return {"session": session}


# ============================================================================
# PUBLIC VERIFICATION (for async links)
# ============================================================================

@router.get("/public/{token}")
async def get_public_verification(token: str):
    """Get verification session by public token (no auth required)."""
    from app.core.database import execute_single, execute_query

    session = execute_single(
        """
        SELECT vs.*, t.reference_number as transaction_reference,
               o.name as organization_name
        FROM set_house_verification_sessions vs
        JOIN set_house_transactions t ON t.id = vs.transaction_id
        JOIN organizations o ON o.id = vs.organization_id
        WHERE vs.token = :token AND vs.status != 'expired'
        """,
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found or expired")

    # Get spaces to verify from transaction
    items = execute_query(
        """
        SELECT ti.*, s.name as space_name, s.internal_id as space_internal_id,
               pi.name as package_name
        FROM set_house_transaction_items ti
        LEFT JOIN set_house_spaces s ON s.id = ti.space_id
        LEFT JOIN set_house_package_instances pi ON pi.id = ti.package_instance_id
        WHERE ti.transaction_id = :transaction_id
        """,
        {"transaction_id": session["transaction_id"]}
    )

    session["items_to_verify"] = items
    return {"session": session}


@router.post("/public/{token}/verify-item")
async def public_verify_item(
    token: str,
    data: VerificationItemComplete
):
    """Verify an item via public link (no auth required)."""
    from app.core.database import execute_single, execute_insert
    from datetime import datetime, timezone
    import json

    session = execute_single(
        "SELECT * FROM set_house_verification_sessions WHERE token = :token AND status != 'expired'",
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found or expired")

    # Create verification item
    item = execute_insert(
        """
        INSERT INTO set_house_verification_items (
            session_id, space_id, package_instance_id,
            is_verified, verified_at,
            condition_grade, condition_notes, photos
        ) VALUES (
            :session_id, :space_id, :package_instance_id,
            TRUE, :now,
            :condition_grade, :condition_notes, :photos
        )
        RETURNING *
        """,
        {
            "session_id": session["id"],
            "space_id": data.space_id,
            "package_instance_id": data.package_instance_id,
            "now": datetime.now(timezone.utc),
            "condition_grade": data.condition_grade,
            "condition_notes": data.condition_notes,
            "photos": json.dumps(data.photos or [])
        }
    )

    return {"item": item}


@router.post("/public/{token}/signature")
async def public_capture_signature(
    token: str,
    data: SignatureCapture
):
    """Capture signature via public link (no auth required)."""
    from app.core.database import execute_single, execute_insert
    from datetime import datetime, timezone

    session = execute_single(
        "SELECT * FROM set_house_verification_sessions WHERE token = :token AND status != 'expired'",
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found or expired")

    session = execute_insert(
        """
        UPDATE set_house_verification_sessions
        SET signature_url = :signature_url, signature_captured_at = :now, updated_at = NOW()
        WHERE token = :token
        RETURNING *
        """,
        {
            "token": token,
            "signature_url": data.signature_url,
            "now": datetime.now(timezone.utc)
        }
    )

    return {"session": session}


@router.post("/public/{token}/complete")
async def public_complete_verification(token: str):
    """Complete verification via public link (no auth required)."""
    from app.core.database import execute_insert
    from datetime import datetime, timezone

    session = execute_insert(
        """
        UPDATE set_house_verification_sessions
        SET status = 'completed', completed_at = :now, updated_at = NOW()
        WHERE token = :token AND status != 'expired'
        RETURNING *
        """,
        {"token": token, "now": datetime.now(timezone.utc)}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found or expired")

    return {"session": session}
