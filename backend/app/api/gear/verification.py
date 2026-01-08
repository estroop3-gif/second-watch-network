"""
Gear House Verification API

Endpoints for managing checkout/check-in verification sessions.
Includes both authenticated endpoints for organization members
and public endpoints for async receiver verification via token.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
import secrets
import json

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger
from app.services import gear_service

logger = get_logger(__name__)

router = APIRouter(prefix="/verification", tags=["Gear Verification"])


# ============================================================================
# SCHEMAS
# ============================================================================

class VerificationItemCreate(BaseModel):
    id: str
    type: str  # 'asset' or 'kit'
    name: str
    internal_id: Optional[str] = None
    parent_kit_id: Optional[str] = None


class SessionCreate(BaseModel):
    transaction_id: str
    verification_type: str  # sender_verification, receiver_verification, checkin_verification
    items: List[VerificationItemCreate]


class VerifyItemRequest(BaseModel):
    item_id: str
    method: str = "scan"  # scan, checkoff
    notes: Optional[str] = None


class DiscrepancyReport(BaseModel):
    item_id: str
    issue_type: str  # missing, damaged, wrong_item, extra_item
    notes: Optional[str] = None


class SignatureCapture(BaseModel):
    signature_data: str  # Base64 encoded signature image


class SendAsyncLinkRequest(BaseModel):
    email: str
    expires_hours: int = 48


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def generate_verification_token() -> str:
    """Generate a secure token for async verification links."""
    return secrets.token_urlsafe(32)


# ============================================================================
# AUTHENTICATED SESSION ENDPOINTS
# ============================================================================

@router.post("/{org_id}/sessions")
async def create_verification_session(
    org_id: str,
    data: SessionCreate,
    user=Depends(get_current_user)
):
    """Create a new verification session for a transaction."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # Validate verification type
    valid_types = ["sender_verification", "receiver_verification", "checkin_verification"]
    if data.verification_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verification type. Must be one of: {valid_types}"
        )

    # Verify transaction exists and belongs to org
    transaction = execute_single(
        """
        SELECT id, organization_id, status
        FROM gear_transactions
        WHERE id = :transaction_id
        """,
        {"transaction_id": data.transaction_id}
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if str(transaction["organization_id"]) != org_id:
        raise HTTPException(status_code=403, detail="Transaction does not belong to this organization")

    # Prepare items for storage
    items_to_verify = [item.model_dump() for item in data.items]

    # Create the session
    session = execute_insert(
        """
        INSERT INTO gear_verification_sessions (
            organization_id, transaction_id, verification_type,
            status, items_to_verify, items_verified, discrepancies
        )
        VALUES (
            :org_id, :transaction_id, :verification_type,
            'pending', :items_to_verify::jsonb, '[]'::jsonb, '[]'::jsonb
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "transaction_id": data.transaction_id,
            "verification_type": data.verification_type,
            "items_to_verify": json.dumps(items_to_verify)
        }
    )

    if not session:
        raise HTTPException(status_code=500, detail="Failed to create verification session")

    # Update transaction with verification session reference
    verification_column = f"{data.verification_type.replace('_verification', '')}_verification_session_id"
    required_column = f"{data.verification_type.replace('_verification', '')}_verification_required"

    execute_update(
        f"""
        UPDATE gear_transactions
        SET {verification_column} = :session_id,
            {required_column} = TRUE
        WHERE id = :transaction_id
        """,
        {"session_id": session["id"], "transaction_id": data.transaction_id}
    )

    return {"session": session}


@router.get("/{org_id}/sessions/{session_id}")
async def get_verification_session(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Get verification session details."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    session = execute_single(
        """
        SELECT vs.*, t.transaction_type, t.status as transaction_status,
               p.display_name as completed_by_name
        FROM gear_verification_sessions vs
        JOIN gear_transactions t ON t.id = vs.transaction_id
        LEFT JOIN profiles p ON p.id = vs.completed_by
        WHERE vs.id = :session_id AND vs.organization_id = :org_id
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    return {"session": session}


@router.get("/{org_id}/sessions")
async def list_verification_sessions(
    org_id: str,
    transaction_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    verification_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List verification sessions for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    query = """
        SELECT vs.*, t.transaction_type, p.display_name as completed_by_name
        FROM gear_verification_sessions vs
        JOIN gear_transactions t ON t.id = vs.transaction_id
        LEFT JOIN profiles p ON p.id = vs.completed_by
        WHERE vs.organization_id = :org_id
    """
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if transaction_id:
        query += " AND vs.transaction_id = :transaction_id"
        params["transaction_id"] = transaction_id

    if status:
        query += " AND vs.status = :status"
        params["status"] = status

    if verification_type:
        query += " AND vs.verification_type = :verification_type"
        params["verification_type"] = verification_type

    query += " ORDER BY vs.created_at DESC LIMIT :limit OFFSET :offset"

    sessions = execute_query(query, params)

    return {"sessions": sessions}


@router.post("/{org_id}/sessions/{session_id}/start")
async def start_verification(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Mark a verification session as in progress."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET status = 'in_progress', started_at = NOW()
        WHERE id = :session_id AND organization_id = :org_id AND status = 'pending'
        RETURNING *
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already started")

    return {"session": session}


@router.post("/{org_id}/sessions/{session_id}/verify-item")
async def verify_item(
    org_id: str,
    session_id: str,
    data: VerifyItemRequest,
    user=Depends(get_current_user)
):
    """Verify a single item in the session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # Get current session
    session = execute_single(
        """
        SELECT * FROM gear_verification_sessions
        WHERE id = :session_id AND organization_id = :org_id
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    # Parse current items
    items_to_verify = session.get("items_to_verify", [])
    items_verified = session.get("items_verified", [])

    # Check if item is in the to-verify list
    item_found = any(item["id"] == data.item_id for item in items_to_verify)
    if not item_found:
        raise HTTPException(status_code=400, detail="Item not in verification list")

    # Check if already verified
    already_verified = any(item["id"] == data.item_id for item in items_verified)
    if already_verified:
        raise HTTPException(status_code=400, detail="Item already verified")

    # Add to verified list
    verified_item = {
        "id": data.item_id,
        "verified_at": datetime.utcnow().isoformat(),
        "verified_by": profile_id,
        "method": data.method,
        "notes": data.notes
    }
    items_verified.append(verified_item)

    # Update session - set to in_progress if pending
    new_status = "in_progress" if session["status"] == "pending" else session["status"]

    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET items_verified = :items_verified::jsonb,
            status = :status,
            started_at = COALESCE(started_at, NOW())
        WHERE id = :session_id
        RETURNING *
        """,
        {
            "session_id": session_id,
            "items_verified": json.dumps(items_verified),
            "status": new_status
        }
    )

    # Calculate progress
    total = len(items_to_verify)
    verified = len(items_verified)
    progress = (verified / total * 100) if total > 0 else 100

    return {
        "session": updated_session,
        "item_verified": verified_item,
        "progress": {
            "total": total,
            "verified": verified,
            "remaining": total - verified,
            "percentage": round(progress, 1)
        }
    }


@router.post("/{org_id}/sessions/{session_id}/report-discrepancy")
async def report_discrepancy(
    org_id: str,
    session_id: str,
    data: DiscrepancyReport,
    user=Depends(get_current_user)
):
    """Report a discrepancy for an item."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    session = execute_single(
        """
        SELECT * FROM gear_verification_sessions
        WHERE id = :session_id AND organization_id = :org_id
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    discrepancies = session.get("discrepancies", [])

    # Add discrepancy
    discrepancy = {
        "item_id": data.item_id,
        "issue_type": data.issue_type,
        "notes": data.notes,
        "reported_by": profile_id,
        "reported_at": datetime.utcnow().isoformat()
    }
    discrepancies.append(discrepancy)

    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET discrepancies = :discrepancies::jsonb,
            status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
            started_at = COALESCE(started_at, NOW())
        WHERE id = :session_id
        RETURNING *
        """,
        {
            "session_id": session_id,
            "discrepancies": json.dumps(discrepancies)
        }
    )

    return {"session": updated_session, "discrepancy": discrepancy}


@router.post("/{org_id}/sessions/{session_id}/acknowledge-discrepancies")
async def acknowledge_discrepancies(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Acknowledge discrepancies and allow proceeding."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET discrepancy_acknowledged = TRUE
        WHERE id = :session_id AND organization_id = :org_id
        RETURNING *
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session": session}


@router.post("/{org_id}/sessions/{session_id}/signature")
async def capture_signature(
    org_id: str,
    session_id: str,
    data: SignatureCapture,
    user=Depends(get_current_user)
):
    """Capture signature for receiver verification."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # TODO: Upload signature to S3 and get URL
    # For now, store base64 directly (will need S3 integration later)
    signature_url = f"data:image/png;base64,{data.signature_data}"

    session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET signature_url = :signature_url,
            signature_captured_at = NOW()
        WHERE id = :session_id AND organization_id = :org_id
        RETURNING *
        """,
        {"session_id": session_id, "org_id": org_id, "signature_url": signature_url}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session": session}


@router.post("/{org_id}/sessions/{session_id}/complete")
async def complete_verification(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Complete a verification session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # Get session with org settings
    session = execute_single(
        """
        SELECT vs.*, gos.*
        FROM gear_verification_sessions vs
        JOIN gear_organization_settings gos ON gos.organization_id = vs.organization_id
        WHERE vs.id = :session_id AND vs.organization_id = :org_id
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    # Determine which discrepancy action to use based on verification type
    discrepancy_action = "warn"
    if session["verification_type"] == "sender_verification":
        # Determine if this is team or client based on transaction type
        transaction = execute_single(
            "SELECT transaction_type FROM gear_transactions WHERE id = :id",
            {"id": session["transaction_id"]}
        )
        if transaction and "rental" in transaction.get("transaction_type", ""):
            discrepancy_action = session.get("client_checkout_discrepancy_action", "warn")
        else:
            discrepancy_action = session.get("team_checkout_discrepancy_action", "warn")

    # Check if all items verified
    items_to_verify = session.get("items_to_verify", [])
    items_verified = session.get("items_verified", [])
    discrepancies = session.get("discrepancies", [])

    verified_ids = {item["id"] for item in items_verified}
    discrepancy_ids = {d["item_id"] for d in discrepancies}
    all_accounted = all(
        item["id"] in verified_ids or item["id"] in discrepancy_ids
        for item in items_to_verify
    )

    # If there are unacknowledged discrepancies and action is 'block', prevent completion
    if discrepancies and not session.get("discrepancy_acknowledged", False):
        if discrepancy_action == "block":
            raise HTTPException(
                status_code=400,
                detail="Cannot complete verification with unacknowledged discrepancies"
            )

    # Warn if not all items verified (but still allow completion if discrepancy action is 'warn')
    warnings = []
    if not all_accounted:
        unverified = [
            item for item in items_to_verify
            if item["id"] not in verified_ids and item["id"] not in discrepancy_ids
        ]
        if discrepancy_action == "block":
            raise HTTPException(
                status_code=400,
                detail=f"{len(unverified)} items not verified or reported"
            )
        warnings.append(f"{len(unverified)} items not verified")

    # Complete the session
    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET status = 'completed',
            completed_at = NOW(),
            completed_by = :completed_by
        WHERE id = :session_id
        RETURNING *
        """,
        {"session_id": session_id, "completed_by": profile_id}
    )

    # Update transaction completion timestamp
    completion_column = session["verification_type"].replace("_verification", "") + "_verification_completed_at"
    execute_update(
        f"""
        UPDATE gear_transactions
        SET {completion_column} = NOW()
        WHERE id = :transaction_id
        """,
        {"transaction_id": session["transaction_id"]}
    )

    return {
        "session": updated_session,
        "warnings": warnings if warnings else None
    }


@router.post("/{org_id}/sessions/{session_id}/send-async-link")
async def send_async_verification_link(
    org_id: str,
    session_id: str,
    data: SendAsyncLinkRequest,
    user=Depends(get_current_user)
):
    """Send an async verification link to a receiver."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    session = execute_single(
        """
        SELECT * FROM gear_verification_sessions
        WHERE id = :session_id AND organization_id = :org_id
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["verification_type"] != "receiver_verification":
        raise HTTPException(status_code=400, detail="Async links only available for receiver verification")

    # Generate secure token
    token = generate_verification_token()
    expires_at = datetime.utcnow() + timedelta(hours=data.expires_hours)

    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET token = :token,
            link_sent_to = :email,
            link_sent_at = NOW(),
            link_expires_at = :expires_at
        WHERE id = :session_id
        RETURNING *
        """,
        {
            "session_id": session_id,
            "token": token,
            "email": data.email,
            "expires_at": expires_at
        }
    )

    # TODO: Send email with verification link
    # For now, return the link directly
    verification_url = f"/gear/verify/{token}"

    logger.info(f"Async verification link generated for session {session_id}, sent to {data.email}")

    return {
        "session": updated_session,
        "verification_url": verification_url,
        "expires_at": expires_at.isoformat()
    }


@router.post("/{org_id}/sessions/{session_id}/cancel")
async def cancel_verification_session(
    org_id: str,
    session_id: str,
    user=Depends(get_current_user)
):
    """Cancel a verification session."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET status = 'cancelled'
        WHERE id = :session_id
          AND organization_id = :org_id
          AND status NOT IN ('completed', 'cancelled')
        RETURNING *
        """,
        {"session_id": session_id, "org_id": org_id}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or cannot be cancelled")

    return {"session": session}


# ============================================================================
# PUBLIC TOKEN-BASED ENDPOINTS (No authentication required)
# ============================================================================

@router.get("/public/{token}")
async def get_public_verification_session(token: str):
    """Get verification session by public token (no auth required)."""
    session = execute_single(
        """
        SELECT vs.id, vs.organization_id, vs.verification_type, vs.status,
               vs.items_to_verify, vs.items_verified, vs.discrepancies,
               vs.link_expires_at, vs.signature_url, vs.signature_captured_at,
               t.transaction_type, o.name as organization_name
        FROM gear_verification_sessions vs
        JOIN gear_transactions t ON t.id = vs.transaction_id
        JOIN organizations o ON o.id = vs.organization_id
        WHERE vs.token = :token
        """,
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found")

    # Check if expired
    if session.get("link_expires_at"):
        expires_at = session["link_expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            raise HTTPException(status_code=410, detail="Verification link has expired")

    if session["status"] in ["completed", "cancelled", "expired"]:
        raise HTTPException(status_code=400, detail=f"Session is {session['status']}")

    return {"session": session}


@router.post("/public/{token}/verify-item")
async def public_verify_item(
    token: str,
    data: VerifyItemRequest
):
    """Verify an item via public token (no auth required)."""
    # Get session by token
    session = execute_single(
        """
        SELECT * FROM gear_verification_sessions
        WHERE token = :token
        """,
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check expiration
    if session.get("link_expires_at"):
        expires_at = session["link_expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            raise HTTPException(status_code=410, detail="Verification link has expired")

    if session["status"] in ["completed", "cancelled", "expired"]:
        raise HTTPException(status_code=400, detail=f"Session is {session['status']}")

    # Same logic as authenticated verify-item
    items_to_verify = session.get("items_to_verify", [])
    items_verified = session.get("items_verified", [])

    item_found = any(item["id"] == data.item_id for item in items_to_verify)
    if not item_found:
        raise HTTPException(status_code=400, detail="Item not in verification list")

    already_verified = any(item["id"] == data.item_id for item in items_verified)
    if already_verified:
        raise HTTPException(status_code=400, detail="Item already verified")

    verified_item = {
        "id": data.item_id,
        "verified_at": datetime.utcnow().isoformat(),
        "verified_by": "public_receiver",
        "method": data.method,
        "notes": data.notes
    }
    items_verified.append(verified_item)

    new_status = "in_progress" if session["status"] == "pending" else session["status"]

    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET items_verified = :items_verified::jsonb,
            status = :status,
            started_at = COALESCE(started_at, NOW())
        WHERE id = :session_id
        RETURNING id, status, items_to_verify, items_verified, discrepancies
        """,
        {
            "session_id": session["id"],
            "items_verified": json.dumps(items_verified),
            "status": new_status
        }
    )

    total = len(items_to_verify)
    verified = len(items_verified)

    return {
        "session": updated_session,
        "item_verified": verified_item,
        "progress": {
            "total": total,
            "verified": verified,
            "remaining": total - verified,
            "percentage": round((verified / total * 100) if total > 0 else 100, 1)
        }
    }


@router.post("/public/{token}/signature")
async def public_capture_signature(
    token: str,
    data: SignatureCapture
):
    """Capture signature via public token (no auth required)."""
    session = execute_single(
        """
        SELECT * FROM gear_verification_sessions
        WHERE token = :token
        """,
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("link_expires_at"):
        expires_at = session["link_expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            raise HTTPException(status_code=410, detail="Verification link has expired")

    signature_url = f"data:image/png;base64,{data.signature_data}"

    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET signature_url = :signature_url,
            signature_captured_at = NOW()
        WHERE id = :session_id
        RETURNING id, status, signature_captured_at
        """,
        {"session_id": session["id"], "signature_url": signature_url}
    )

    return {"session": updated_session}


@router.post("/public/{token}/complete")
async def public_complete_verification(token: str):
    """Complete verification via public token (no auth required)."""
    session = execute_single(
        """
        SELECT vs.*, gos.receiver_verification_mode
        FROM gear_verification_sessions vs
        JOIN gear_organization_settings gos ON gos.organization_id = vs.organization_id
        WHERE vs.token = :token
        """,
        {"token": token}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("link_expires_at"):
        expires_at = session["link_expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            raise HTTPException(status_code=410, detail="Verification link has expired")

    if session["status"] == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    # Check receiver verification requirements
    receiver_mode = session.get("receiver_verification_mode", "none")
    errors = []

    if receiver_mode in ["signature", "signature_and_scan"]:
        if not session.get("signature_url"):
            errors.append("Signature is required")

    if receiver_mode in ["scan", "signature_and_scan"]:
        items_to_verify = session.get("items_to_verify", [])
        items_verified = session.get("items_verified", [])
        if len(items_verified) < len(items_to_verify):
            errors.append(f"All items must be verified ({len(items_verified)}/{len(items_to_verify)})")

    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    # Complete the session
    updated_session = execute_single(
        """
        UPDATE gear_verification_sessions
        SET status = 'completed',
            completed_at = NOW()
        WHERE id = :session_id
        RETURNING *
        """,
        {"session_id": session["id"]}
    )

    # Update transaction
    execute_update(
        """
        UPDATE gear_transactions
        SET receiver_verification_completed_at = NOW()
        WHERE id = :transaction_id
        """,
        {"transaction_id": session["transaction_id"]}
    )

    return {"session": updated_session, "message": "Verification completed successfully"}
