"""
Onboarding Wizard API Routes
Handles guided crew onboarding sessions and steps
"""
from fastapi import APIRouter, HTTPException, Header, Body, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
from app.core.database import get_client, execute_single, execute_query, execute_insert
from app.core.config import settings
import uuid
import secrets
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# =====================================================
# Helper Functions
# =====================================================

def get_profile_id_from_cognito_id(cognito_user_id: str) -> str:
    """
    Look up the profile ID from a Cognito user ID.
    Returns the profile ID or None if not found.
    """
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)
    # First try to find by cognito_user_id (preferred)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    # Fallback: check if it's already a profile ID
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if not profile_row:
        return None
    return str(profile_row["id"])


async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token using AWS Cognito.
    Returns the profile ID (not Cognito ID) for database lookups.
    """
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("[AUTH] Missing or invalid authorization header")
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            logger.warning("[AUTH] Token verification returned None")
            raise HTTPException(status_code=401, detail="Invalid token")

        cognito_id = user.get("user_id") or user.get("sub") or user.get("id")
        email = user.get("email")

        if not cognito_id:
            logger.warning(f"[AUTH] No cognito_id found in user object: {list(user.keys())}")
            raise HTTPException(status_code=401, detail="No user ID in token")

        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            logger.warning(f"[AUTH] No profile found for cognito_id: {cognito_id}")
            raise HTTPException(status_code=401, detail="User profile not found")

        return {"id": profile_id, "user_id": profile_id, "cognito_id": cognito_id, "email": email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTH] Authentication exception: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def serialize_row(row: dict) -> dict:
    """Convert a database row to JSON-serializable format."""
    if not row:
        return row
    result = {}
    for key, value in row.items():
        if isinstance(value, (datetime,)):
            result[key] = value.isoformat()
        elif hasattr(value, 'hex'):  # UUID
            result[key] = str(value)
        else:
            result[key] = value
    return result


def check_project_admin(project_id: str, profile_id: str) -> bool:
    """Check if user is admin/owner of the project."""
    client = get_client()
    # Check if user is the project owner
    project = client.table("backlot_projects").select("owner_id").eq("id", project_id).single().execute()
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if str(project.data.get("owner_id")) == profile_id:
        return True
    # Check if user is a crew member with admin role
    crew = execute_single(
        """SELECT role FROM backlot_crew_members
           WHERE project_id = :project_id AND profile_id = :profile_id
           AND role IN ('producer', 'executive_producer', 'line_producer', 'upm', 'admin')
           LIMIT 1""",
        {"project_id": project_id, "profile_id": profile_id}
    )
    if crew:
        return True
    return False


# =====================================================
# Pydantic Models
# =====================================================

class StartOnboardingRequest(BaseModel):
    """Request body to start an onboarding session."""
    package_id: Optional[str] = None
    deal_memo_id: Optional[str] = None
    custom_steps: Optional[List[Dict[str, Any]]] = None


class CompleteStepRequest(BaseModel):
    """Request body to complete an onboarding step."""
    form_data: Optional[Dict[str, Any]] = None
    signature_data: Optional[Dict[str, Any]] = None


class SaveProgressRequest(BaseModel):
    """Request body to save step progress."""
    form_data: Dict[str, Any]


class SaveToProfileRequest(BaseModel):
    """Request body to save reusable fields to profile."""
    fields: Dict[str, Any] = Field(..., description="Fields to save, e.g. address, emergency_contact")


# =====================================================
# Onboarding Endpoints
# =====================================================

@router.post("/projects/{project_id}/onboarding/{user_id}/start")
async def start_onboarding_session(
    project_id: str,
    user_id: str,
    body: StartOnboardingRequest = Body(default=StartOnboardingRequest()),
    authorization: str = Header(None),
):
    """
    Admin creates an onboarding session for a crew member.
    Auto-generates steps based on deal memo and package clearances.
    """
    admin_user = await get_current_user_from_token(authorization)
    admin_profile_id = admin_user["id"]

    # Verify admin access to project
    if not check_project_admin(project_id, admin_profile_id):
        raise HTTPException(status_code=403, detail="Admin access required for this project")

    client = get_client()

    # Check that target user exists
    target_profile = execute_single(
        "SELECT id, display_name, email FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": user_id}
    )
    if not target_profile:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Generate onboarding steps
    steps = []
    step_number = 1

    # Step 1: Deal memo review (if deal_memo_id provided)
    if body.deal_memo_id:
        deal_memo = execute_single(
            "SELECT id, status FROM backlot_deal_memos WHERE id::text = :dmid LIMIT 1",
            {"dmid": body.deal_memo_id}
        )
        if deal_memo:
            steps.append({
                "step_number": step_number,
                "step_type": "deal_memo_review",
                "title": "Review Deal Memo",
                "description": "Review and acknowledge your deal memo terms",
                "reference_id": body.deal_memo_id,
                "reference_type": "deal_memo",
                "required": True,
                "status": "pending",
                "form_data": None,
            })
            step_number += 1

    # Step 2+: Document signing steps from package clearances
    if body.package_id:
        clearances = execute_query(
            """SELECT id, title, document_type FROM backlot_package_clearances
               WHERE package_id::text = :pkg_id
               ORDER BY sort_order ASC, created_at ASC""",
            {"pkg_id": body.package_id}
        )
        for clearance in (clearances or []):
            steps.append({
                "step_number": step_number,
                "step_type": "document_sign",
                "title": f"Sign: {clearance.get('title', 'Document')}",
                "description": f"Review and sign {clearance.get('document_type', 'document')}",
                "reference_id": str(clearance["id"]),
                "reference_type": "clearance",
                "required": True,
                "status": "pending",
                "form_data": None,
            })
            step_number += 1

    # Common form fill steps
    common_form_steps = [
        {
            "step_type": "form_fill",
            "title": "Personal Information",
            "description": "Confirm your contact details and personal information",
            "form_fields": ["full_name", "email", "phone", "address"],
            "required": True,
        },
        {
            "step_type": "form_fill",
            "title": "Emergency Contact",
            "description": "Provide emergency contact information",
            "form_fields": ["emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"],
            "required": True,
        },
        {
            "step_type": "form_fill",
            "title": "Tax & Payment Info",
            "description": "Provide payment and tax information for payroll",
            "form_fields": ["tax_id_type", "payment_method", "bank_info"],
            "required": False,
        },
    ]

    for form_step in common_form_steps:
        steps.append({
            "step_number": step_number,
            "step_type": form_step["step_type"],
            "title": form_step["title"],
            "description": form_step["description"],
            "reference_id": None,
            "reference_type": None,
            "required": form_step["required"],
            "status": "pending",
            "form_data": None,
            "form_fields": form_step.get("form_fields"),
        })
        step_number += 1

    # Add any custom steps
    if body.custom_steps:
        for custom in body.custom_steps:
            steps.append({
                "step_number": step_number,
                "step_type": custom.get("step_type", "form_fill"),
                "title": custom.get("title", "Custom Step"),
                "description": custom.get("description", ""),
                "reference_id": custom.get("reference_id"),
                "reference_type": custom.get("reference_type"),
                "required": custom.get("required", False),
                "status": "pending",
                "form_data": None,
                "form_fields": custom.get("form_fields"),
            })
            step_number += 1

    # Generate access token for external link
    access_token = secrets.token_urlsafe(48)
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Create the onboarding session
    session_data = execute_insert(
        """INSERT INTO backlot_onboarding_sessions
           (id, project_id, user_id, created_by, access_token, status, current_step,
            total_steps, package_id, deal_memo_id, created_at, updated_at)
           VALUES (:id, :project_id, :user_id, :created_by, :access_token, 'in_progress',
                   1, :total_steps, :package_id, :deal_memo_id, :created_at, :updated_at)
           RETURNING *""",
        {
            "id": session_id,
            "project_id": project_id,
            "user_id": user_id,
            "created_by": admin_profile_id,
            "access_token": access_token,
            "total_steps": len(steps),
            "package_id": body.package_id,
            "deal_memo_id": body.deal_memo_id,
            "created_at": now,
            "updated_at": now,
        }
    )

    # Create individual step records
    for step in steps:
        step_id = str(uuid.uuid4())
        execute_insert(
            """INSERT INTO backlot_onboarding_steps
               (id, session_id, step_number, step_type, title, description,
                reference_id, reference_type, required, status, form_data,
                form_fields, created_at, updated_at)
               VALUES (:id, :session_id, :step_number, :step_type, :title, :description,
                       :reference_id, :reference_type, :required, :status, :form_data,
                       :form_fields, :created_at, :updated_at)
               RETURNING id""",
            {
                "id": step_id,
                "session_id": session_id,
                "step_number": step.get("step_number"),
                "step_type": step.get("step_type"),
                "title": step.get("title"),
                "description": step.get("description"),
                "reference_id": step.get("reference_id"),
                "reference_type": step.get("reference_type"),
                "required": step.get("required", True),
                "status": "pending",
                "form_data": None,
                "form_fields": str(step.get("form_fields")) if step.get("form_fields") else None,
                "created_at": now,
                "updated_at": now,
            }
        )

    logger.info(f"Created onboarding session {session_id} for user {user_id} on project {project_id} with {len(steps)} steps")

    return {
        "success": True,
        "session": serialize_row(session_data) if session_data else {
            "id": session_id,
            "project_id": project_id,
            "user_id": user_id,
            "created_by": admin_profile_id,
            "access_token": access_token,
            "status": "in_progress",
            "current_step": 1,
            "total_steps": len(steps),
            "package_id": body.package_id,
            "deal_memo_id": body.deal_memo_id,
        },
        "steps": steps,
        "access_url": f"/onboarding?token={access_token}",
    }


@router.get("/onboarding/sessions/{session_id}")
async def get_onboarding_session(
    session_id: str,
    authorization: str = Header(None),
):
    """
    Get full onboarding session with steps and progress.
    Accessible by session owner or project admin.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    # Get session
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE id::text = :sid LIMIT 1",
        {"sid": session_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")

    # Check access: must be the onboarding user or a project admin
    session_user_id = str(session.get("user_id", ""))
    project_id = str(session.get("project_id", ""))
    if session_user_id != profile_id and not check_project_admin(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied to this onboarding session")

    # Get all steps
    steps = execute_query(
        """SELECT * FROM backlot_onboarding_steps
           WHERE session_id::text = :sid
           ORDER BY step_number ASC""",
        {"sid": session_id}
    )

    # Calculate progress
    total = len(steps) if steps else 0
    completed = sum(1 for s in (steps or []) if s.get("status") == "completed")
    progress_pct = round((completed / total) * 100, 1) if total > 0 else 0

    return {
        "success": True,
        "session": serialize_row(dict(session)),
        "steps": [serialize_row(dict(s)) for s in (steps or [])],
        "progress": {
            "total": total,
            "completed": completed,
            "percentage": progress_pct,
        },
    }


@router.get("/onboarding/sessions/by-token/{token}")
async def get_onboarding_session_by_token(token: str):
    """
    Public endpoint: get onboarding session by access token.
    No auth required -- the token itself is the auth.
    """
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE access_token = :token LIMIT 1",
        {"token": token}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found or invalid token")

    session_id = str(session["id"])

    # Get all steps
    steps = execute_query(
        """SELECT * FROM backlot_onboarding_steps
           WHERE session_id::text = :sid
           ORDER BY step_number ASC""",
        {"sid": session_id}
    )

    total = len(steps) if steps else 0
    completed = sum(1 for s in (steps or []) if s.get("status") == "completed")
    progress_pct = round((completed / total) * 100, 1) if total > 0 else 0

    return {
        "success": True,
        "session": serialize_row(dict(session)),
        "steps": [serialize_row(dict(s)) for s in (steps or [])],
        "progress": {
            "total": total,
            "completed": completed,
            "percentage": progress_pct,
        },
    }


@router.get("/onboarding/sessions/{session_id}/step/{step_number}")
async def get_onboarding_step(
    session_id: str,
    step_number: int,
    authorization: str = Header(None),
):
    """
    Get a specific onboarding step with its data.
    Returns document URL if applicable, form fields, etc.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    # Verify session access
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE id::text = :sid LIMIT 1",
        {"sid": session_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")

    session_user_id = str(session.get("user_id", ""))
    project_id = str(session.get("project_id", ""))
    if session_user_id != profile_id and not check_project_admin(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get the step
    step = execute_single(
        """SELECT * FROM backlot_onboarding_steps
           WHERE session_id::text = :sid AND step_number = :sn LIMIT 1""",
        {"sid": session_id, "sn": step_number}
    )
    if not step:
        raise HTTPException(status_code=404, detail=f"Step {step_number} not found")

    step_data = serialize_row(dict(step))

    # If the step references a document, fetch a signed URL
    document_url = None
    if step.get("reference_type") == "clearance" and step.get("reference_id"):
        clearance = execute_single(
            "SELECT document_s3_uri, title FROM backlot_package_clearances WHERE id::text = :cid LIMIT 1",
            {"cid": step["reference_id"]}
        )
        if clearance and clearance.get("document_s3_uri"):
            s3_uri = clearance["document_s3_uri"]
            if s3_uri.startswith("s3://"):
                parts = s3_uri[5:].split("/", 1)
                if len(parts) == 2:
                    from app.core.storage import get_signed_url
                    document_url = get_signed_url(parts[0], parts[1], 3600)
            else:
                document_url = s3_uri

    if step.get("reference_type") == "deal_memo" and step.get("reference_id"):
        deal_memo = execute_single(
            "SELECT id, document_s3_uri FROM backlot_deal_memos WHERE id::text = :dmid LIMIT 1",
            {"dmid": step["reference_id"]}
        )
        if deal_memo and deal_memo.get("document_s3_uri"):
            s3_uri = deal_memo["document_s3_uri"]
            if s3_uri.startswith("s3://"):
                parts = s3_uri[5:].split("/", 1)
                if len(parts) == 2:
                    from app.core.storage import get_signed_url
                    document_url = get_signed_url(parts[0], parts[1], 3600)
            else:
                document_url = s3_uri

    step_data["document_url"] = document_url

    return {
        "success": True,
        "step": step_data,
    }


@router.post("/onboarding/sessions/{session_id}/step/{step_number}/complete")
async def complete_onboarding_step(
    session_id: str,
    step_number: int,
    body: CompleteStepRequest = Body(default=CompleteStepRequest()),
    authorization: str = Header(None),
):
    """
    Complete an onboarding step.
    Updates step status and advances session current_step.
    If last step, marks session as completed.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    # Verify session access
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE id::text = :sid LIMIT 1",
        {"sid": session_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")

    session_user_id = str(session.get("user_id", ""))
    project_id = str(session.get("project_id", ""))
    if session_user_id != profile_id and not check_project_admin(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied")

    if session.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Session is already completed")

    # Get the step
    step = execute_single(
        """SELECT * FROM backlot_onboarding_steps
           WHERE session_id::text = :sid AND step_number = :sn LIMIT 1""",
        {"sid": session_id, "sn": step_number}
    )
    if not step:
        raise HTTPException(status_code=404, detail=f"Step {step_number} not found")

    if step.get("status") == "completed":
        return {"success": True, "message": "Step already completed", "step_number": step_number}

    now = datetime.now(timezone.utc).isoformat()

    # Build update data for the step
    import json
    update_form_data = None
    if body.form_data:
        update_form_data = json.dumps(body.form_data)
    update_signature_data = None
    if body.signature_data:
        update_signature_data = json.dumps(body.signature_data)

    # Mark step as completed
    execute_insert(
        """UPDATE backlot_onboarding_steps
           SET status = 'completed',
               form_data = COALESCE(:form_data, form_data),
               signature_data = :signature_data,
               completed_at = :completed_at,
               updated_at = :updated_at
           WHERE session_id::text = :sid AND step_number = :sn""",
        {
            "sid": session_id,
            "sn": step_number,
            "form_data": update_form_data,
            "signature_data": update_signature_data,
            "completed_at": now,
            "updated_at": now,
        }
    )

    # Check if there's a next step
    total_steps = session.get("total_steps", 0)
    next_step = step_number + 1

    if next_step > total_steps:
        # All steps done, mark session completed
        execute_insert(
            """UPDATE backlot_onboarding_sessions
               SET status = 'completed', current_step = :total, completed_at = :now, updated_at = :now
               WHERE id::text = :sid""",
            {"sid": session_id, "total": total_steps, "now": now}
        )
        logger.info(f"Onboarding session {session_id} completed")
        return {
            "success": True,
            "message": "Step completed. Onboarding session is now complete!",
            "step_number": step_number,
            "session_completed": True,
        }
    else:
        # Advance current_step
        execute_insert(
            """UPDATE backlot_onboarding_sessions
               SET current_step = :next_step, updated_at = :now
               WHERE id::text = :sid""",
            {"sid": session_id, "next_step": next_step, "now": now}
        )
        return {
            "success": True,
            "message": f"Step {step_number} completed. Next step: {next_step}",
            "step_number": step_number,
            "next_step": next_step,
            "session_completed": False,
        }


@router.post("/onboarding/sessions/{session_id}/step/{step_number}/save-progress")
async def save_step_progress(
    session_id: str,
    step_number: int,
    body: SaveProgressRequest = Body(...),
    authorization: str = Header(None),
):
    """
    Auto-save partial form data for a step.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    # Verify session access
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE id::text = :sid LIMIT 1",
        {"sid": session_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")

    session_user_id = str(session.get("user_id", ""))
    project_id = str(session.get("project_id", ""))
    if session_user_id != profile_id and not check_project_admin(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify step exists
    step = execute_single(
        """SELECT id FROM backlot_onboarding_steps
           WHERE session_id::text = :sid AND step_number = :sn LIMIT 1""",
        {"sid": session_id, "sn": step_number}
    )
    if not step:
        raise HTTPException(status_code=404, detail=f"Step {step_number} not found")

    now = datetime.now(timezone.utc).isoformat()
    import json

    execute_insert(
        """UPDATE backlot_onboarding_steps
           SET form_data = :form_data, updated_at = :now
           WHERE session_id::text = :sid AND step_number = :sn""",
        {
            "sid": session_id,
            "sn": step_number,
            "form_data": json.dumps(body.form_data),
            "now": now,
        }
    )

    return {
        "success": True,
        "message": "Progress saved",
        "step_number": step_number,
    }


@router.post("/onboarding/sessions/{session_id}/complete")
async def complete_onboarding_session(
    session_id: str,
    authorization: str = Header(None),
):
    """
    Mark an onboarding session as completed.
    Validates that all required steps are done.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    # Get session
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE id::text = :sid LIMIT 1",
        {"sid": session_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")

    session_user_id = str(session.get("user_id", ""))
    project_id = str(session.get("project_id", ""))
    if session_user_id != profile_id and not check_project_admin(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Access denied")

    if session.get("status") == "completed":
        return {"success": True, "message": "Session is already completed"}

    # Check all required steps are completed
    incomplete_required = execute_query(
        """SELECT step_number, title FROM backlot_onboarding_steps
           WHERE session_id::text = :sid AND required = true AND status != 'completed'
           ORDER BY step_number ASC""",
        {"sid": session_id}
    )

    if incomplete_required:
        incomplete_titles = [
            f"Step {r['step_number']}: {r.get('title', 'Untitled')}"
            for r in incomplete_required
        ]
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete session. Required steps incomplete: {', '.join(incomplete_titles)}"
        )

    now = datetime.now(timezone.utc).isoformat()
    execute_insert(
        """UPDATE backlot_onboarding_sessions
           SET status = 'completed', completed_at = :now, updated_at = :now
           WHERE id::text = :sid""",
        {"sid": session_id, "now": now}
    )

    logger.info(f"Onboarding session {session_id} marked complete by user {profile_id}")

    return {
        "success": True,
        "message": "Onboarding session completed successfully",
        "session_id": session_id,
    }


@router.get("/projects/{project_id}/onboarding-summary")
async def get_project_onboarding_summary(
    project_id: str,
    authorization: str = Header(None),
):
    """
    Admin view: get all onboarding sessions for a project with completion percentages.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    if not check_project_admin(project_id, profile_id):
        raise HTTPException(status_code=403, detail="Admin access required for this project")

    # Get all sessions for this project
    sessions = execute_query(
        """SELECT s.*,
                  p.display_name as user_display_name,
                  p.email as user_email,
                  p.avatar_url as user_avatar_url
           FROM backlot_onboarding_sessions s
           LEFT JOIN profiles p ON p.id = s.user_id
           WHERE s.project_id::text = :pid
           ORDER BY s.created_at DESC""",
        {"pid": project_id}
    )

    result = []
    for session in (sessions or []):
        sid = str(session["id"])
        # Get step counts for this session
        step_counts = execute_single(
            """SELECT
                 COUNT(*) as total,
                 COUNT(*) FILTER (WHERE status = 'completed') as completed
               FROM backlot_onboarding_steps
               WHERE session_id::text = :sid""",
            {"sid": sid}
        )
        total = step_counts["total"] if step_counts else 0
        completed = step_counts["completed"] if step_counts else 0
        pct = round((completed / total) * 100, 1) if total > 0 else 0

        session_data = serialize_row(dict(session))
        session_data["progress"] = {
            "total": total,
            "completed": completed,
            "percentage": pct,
        }
        result.append(session_data)

    return {
        "success": True,
        "project_id": project_id,
        "sessions": result,
        "total_sessions": len(result),
    }


@router.post("/onboarding/sessions/{session_id}/step/{step_number}/save-to-profile")
async def save_step_to_profile(
    session_id: str,
    step_number: int,
    body: SaveToProfileRequest = Body(...),
    authorization: str = Header(None),
):
    """
    Save reusable fields (address, emergency contact, etc.) to the user's profile.
    These are stored as encrypted profile fields for future onboarding sessions.
    """
    user = await get_current_user_from_token(authorization)
    profile_id = user["id"]

    # Verify session access
    session = execute_single(
        "SELECT * FROM backlot_onboarding_sessions WHERE id::text = :sid LIMIT 1",
        {"sid": session_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")

    session_user_id = str(session.get("user_id", ""))
    if session_user_id != profile_id:
        raise HTTPException(status_code=403, detail="Only the onboarding user can save to their profile")

    # Verify step exists
    step = execute_single(
        """SELECT id FROM backlot_onboarding_steps
           WHERE session_id::text = :sid AND step_number = :sn LIMIT 1""",
        {"sid": session_id, "sn": step_number}
    )
    if not step:
        raise HTTPException(status_code=404, detail=f"Step {step_number} not found")

    now = datetime.now(timezone.utc).isoformat()
    import json
    saved_fields = []

    # Save recognized fields to profile
    allowed_fields = {
        "address": "address",
        "address_line1": "address_line1",
        "address_line2": "address_line2",
        "city": "city",
        "state": "state",
        "zip_code": "zip_code",
        "country": "country",
        "phone": "phone",
        "emergency_contact_name": "emergency_contact_name",
        "emergency_contact_phone": "emergency_contact_phone",
        "emergency_contact_relationship": "emergency_contact_relationship",
    }

    for field_key, db_column in allowed_fields.items():
        if field_key in body.fields:
            value = body.fields[field_key]
            if value is not None:
                # Store in profile_onboarding_data (JSON column on profiles)
                saved_fields.append(field_key)

    if saved_fields:
        # Get existing onboarding data
        existing = execute_single(
            "SELECT onboarding_data FROM profiles WHERE id::text = :pid LIMIT 1",
            {"pid": profile_id}
        )
        existing_data = {}
        if existing and existing.get("onboarding_data"):
            if isinstance(existing["onboarding_data"], str):
                try:
                    existing_data = json.loads(existing["onboarding_data"])
                except (json.JSONDecodeError, TypeError):
                    existing_data = {}
            elif isinstance(existing["onboarding_data"], dict):
                existing_data = existing["onboarding_data"]

        # Merge new fields
        for field_key in saved_fields:
            existing_data[field_key] = body.fields[field_key]

        existing_data["last_updated"] = now

        execute_insert(
            """UPDATE profiles
               SET onboarding_data = :data, updated_at = :now
               WHERE id::text = :pid""",
            {
                "pid": profile_id,
                "data": json.dumps(existing_data),
                "now": now,
            }
        )

        logger.info(f"Saved {len(saved_fields)} onboarding fields to profile {profile_id}")

    return {
        "success": True,
        "message": f"Saved {len(saved_fields)} fields to profile",
        "saved_fields": saved_fields,
    }
