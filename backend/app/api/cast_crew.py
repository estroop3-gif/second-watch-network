"""
Cast & Crew API - Job Postings, Document Signing, and Crew Communication
"""
from fastapi import APIRouter, HTTPException, Header, Query, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import uuid
import secrets

from app.core.database import get_client
from app.core.backlot_permissions import can_manage_access

router = APIRouter()


# =============================================================================
# AUTH HELPER
# =============================================================================

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


# =============================================================================
# JOB POSTING MODELS
# =============================================================================

class JobPostingCreate(BaseModel):
    title: str
    department: Optional[str] = None
    role_type: Optional[str] = None  # 'cast', 'crew', 'extra'
    description: Optional[str] = None
    requirements: Optional[str] = None
    compensation_type: Optional[str] = None  # 'paid', 'deferred', 'volunteer', 'negotiable'
    compensation_details: Optional[str] = None
    location: Optional[str] = None
    shoot_dates_start: Optional[date] = None
    shoot_dates_end: Optional[date] = None
    application_deadline: Optional[date] = None
    accepts_tapes: bool = False
    tape_instructions: Optional[str] = None


class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    role_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    compensation_type: Optional[str] = None
    compensation_details: Optional[str] = None
    location: Optional[str] = None
    shoot_dates_start: Optional[date] = None
    shoot_dates_end: Optional[date] = None
    application_deadline: Optional[date] = None
    accepts_tapes: Optional[bool] = None
    tape_instructions: Optional[str] = None
    status: Optional[str] = None


class JobPostingResponse(BaseModel):
    id: str
    project_id: str
    created_by: str
    title: str
    department: Optional[str] = None
    role_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    compensation_type: Optional[str] = None
    compensation_details: Optional[str] = None
    location: Optional[str] = None
    shoot_dates_start: Optional[str] = None
    shoot_dates_end: Optional[str] = None
    application_deadline: Optional[str] = None
    accepts_tapes: bool = False
    tape_instructions: Optional[str] = None
    status: str = "draft"
    published_at: Optional[str] = None
    created_at: str
    updated_at: str
    application_count: int = 0
    project_title: Optional[str] = None
    creator_name: Optional[str] = None


class JobApplicationCreate(BaseModel):
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None
    tape_url: Optional[str] = None
    tape_platform: Optional[str] = None  # 'youtube', 'vimeo', 'dropbox', 'other'


class JobApplicationResponse(BaseModel):
    id: str
    job_posting_id: str
    applicant_id: str
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None
    tape_url: Optional[str] = None
    tape_platform: Optional[str] = None
    status: str = "pending"
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str
    updated_at: str
    applicant_name: Optional[str] = None
    applicant_avatar: Optional[str] = None
    applicant_email: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: str  # 'pending', 'reviewed', 'shortlisted', 'accepted', 'rejected'
    notes: Optional[str] = None


# =============================================================================
# JOB POSTING ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/job-postings", response_model=JobPostingResponse)
async def create_job_posting(
    project_id: str,
    request: JobPostingCreate,
    authorization: str = Header(None)
):
    """Create a new job posting for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify project exists and user has access
    project_resp = client.table("backlot_projects").select("id, title").eq("id", project_id).execute()
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to create job postings")

    posting_data = {
        "project_id": project_id,
        "created_by": user["id"],
        "title": request.title,
        "department": request.department,
        "role_type": request.role_type,
        "description": request.description,
        "requirements": request.requirements,
        "compensation_type": request.compensation_type,
        "compensation_details": request.compensation_details,
        "location": request.location,
        "shoot_dates_start": request.shoot_dates_start.isoformat() if request.shoot_dates_start else None,
        "shoot_dates_end": request.shoot_dates_end.isoformat() if request.shoot_dates_end else None,
        "application_deadline": request.application_deadline.isoformat() if request.application_deadline else None,
        "accepts_tapes": request.accepts_tapes,
        "tape_instructions": request.tape_instructions,
        "status": "draft",
    }

    result = client.table("backlot_job_postings").insert(posting_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job posting")

    posting = result.data[0]
    return _format_job_posting(posting, project_resp.data[0])


@router.get("/projects/{project_id}/job-postings", response_model=List[JobPostingResponse])
async def list_job_postings(
    project_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """List all job postings for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify project access
    project_resp = client.table("backlot_projects").select("id, title").eq("id", project_id).execute()
    if not project_resp.data:
        raise HTTPException(status_code=404, detail="Project not found")

    query = client.table("backlot_job_postings").select("*").eq("project_id", project_id)
    if status:
        query = query.eq("status", status)
    query = query.order("created_at", desc=True)

    result = query.execute()
    postings = result.data or []

    # Get application counts
    posting_ids = [str(p["id"]) for p in postings]
    if posting_ids:
        apps_resp = client.table("backlot_job_applications").select("job_posting_id").in_("job_posting_id", posting_ids).execute()
        app_counts = {}
        for app in (apps_resp.data or []):
            pid = str(app["job_posting_id"])
            app_counts[pid] = app_counts.get(pid, 0) + 1
        for posting in postings:
            posting["application_count"] = app_counts.get(str(posting["id"]), 0)

    return [_format_job_posting(p, project_resp.data[0]) for p in postings]


@router.get("/job-postings/{posting_id}", response_model=JobPostingResponse)
async def get_job_posting(
    posting_id: str,
    authorization: str = Header(None)
):
    """Get a specific job posting"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    result = client.table("backlot_job_postings").select("*").eq("id", posting_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job posting not found")

    posting = result.data[0]

    # Get project info
    project_resp = client.table("backlot_projects").select("id, title").eq("id", posting["project_id"]).execute()

    # Get application count
    apps_resp = client.table("backlot_job_applications").select("id", count="exact").eq("job_posting_id", posting_id).execute()
    posting["application_count"] = apps_resp.count if hasattr(apps_resp, 'count') else len(apps_resp.data or [])

    return _format_job_posting(posting, project_resp.data[0] if project_resp.data else None)


@router.put("/job-postings/{posting_id}", response_model=JobPostingResponse)
async def update_job_posting(
    posting_id: str,
    request: JobPostingUpdate,
    authorization: str = Header(None)
):
    """Update a job posting"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get existing posting
    existing = client.table("backlot_job_postings").select("project_id").eq("id", posting_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job posting not found")

    project_id = str(existing.data[0]["project_id"])

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to update this posting")

    update_data = {}
    for field, value in request.dict(exclude_unset=True).items():
        if value is not None:
            if field in ["shoot_dates_start", "shoot_dates_end", "application_deadline"]:
                update_data[field] = value.isoformat() if value else None
            else:
                update_data[field] = value

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = client.table("backlot_job_postings").update(update_data).eq("id", posting_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update job posting")

    # Get project info
    project_resp = client.table("backlot_projects").select("id, title").eq("id", project_id).execute()

    return _format_job_posting(result.data[0], project_resp.data[0] if project_resp.data else None)


@router.post("/job-postings/{posting_id}/publish")
async def publish_job_posting(
    posting_id: str,
    authorization: str = Header(None)
):
    """Publish a job posting to the community board"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get existing posting
    existing = client.table("backlot_job_postings").select("project_id, status").eq("id", posting_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job posting not found")

    project_id = str(existing.data[0]["project_id"])

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to publish this posting")

    result = client.table("backlot_job_postings").update({
        "status": "published",
        "published_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", posting_id).execute()

    return {"success": True, "status": "published"}


@router.delete("/job-postings/{posting_id}")
async def delete_job_posting(
    posting_id: str,
    authorization: str = Header(None)
):
    """Delete a job posting"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get existing posting
    existing = client.table("backlot_job_postings").select("project_id").eq("id", posting_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job posting not found")

    project_id = str(existing.data[0]["project_id"])

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to delete this posting")

    client.table("backlot_job_postings").delete().eq("id", posting_id).execute()

    return {"success": True}


# =============================================================================
# JOB APPLICATION ENDPOINTS
# =============================================================================

@router.post("/job-postings/{posting_id}/applications", response_model=JobApplicationResponse)
async def submit_application(
    posting_id: str,
    request: JobApplicationCreate,
    authorization: str = Header(None)
):
    """Submit an application for a job posting"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify posting exists and is published
    posting = client.table("backlot_job_postings").select("id, status, accepts_tapes").eq("id", posting_id).execute()
    if not posting.data:
        raise HTTPException(status_code=404, detail="Job posting not found")
    if posting.data[0]["status"] != "published":
        raise HTTPException(status_code=400, detail="This job posting is not accepting applications")

    # Check if user already applied
    existing = client.table("backlot_job_applications").select("id").eq(
        "job_posting_id", posting_id
    ).eq("applicant_id", user["id"]).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already applied for this position")

    app_data = {
        "job_posting_id": posting_id,
        "applicant_id": user["id"],
        "cover_letter": request.cover_letter,
        "resume_url": request.resume_url,
        "tape_url": request.tape_url,
        "tape_platform": request.tape_platform,
        "status": "pending",
    }

    result = client.table("backlot_job_applications").insert(app_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to submit application")

    # Get applicant info
    profile = client.table("profiles").select("full_name, avatar_url").eq("id", user["id"]).execute()

    return _format_application(result.data[0], profile.data[0] if profile.data else None)


@router.get("/job-postings/{posting_id}/applications", response_model=List[JobApplicationResponse])
async def list_applications(
    posting_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """List all applications for a job posting (project owner/admin only)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get posting and verify access
    posting = client.table("backlot_job_postings").select("project_id").eq("id", posting_id).execute()
    if not posting.data:
        raise HTTPException(status_code=404, detail="Job posting not found")

    project_id = str(posting.data[0]["project_id"])

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to view applications")

    query = client.table("backlot_job_applications").select("*").eq("job_posting_id", posting_id)
    if status:
        query = query.eq("status", status)
    query = query.order("created_at", desc=True)

    result = query.execute()
    applications = result.data or []

    # Get applicant profiles
    applicant_ids = [str(a["applicant_id"]) for a in applications]
    profiles_by_id = {}
    if applicant_ids:
        profiles_resp = client.table("profiles").select("id, full_name, avatar_url").in_("id", applicant_ids).execute()
        for p in (profiles_resp.data or []):
            profiles_by_id[str(p["id"])] = p

    return [_format_application(a, profiles_by_id.get(str(a["applicant_id"]))) for a in applications]


@router.put("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    request: ApplicationStatusUpdate,
    authorization: str = Header(None)
):
    """Update an application's status"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get application and verify access
    app_resp = client.table("backlot_job_applications").select("job_posting_id").eq("id", application_id).execute()
    if not app_resp.data:
        raise HTTPException(status_code=404, detail="Application not found")

    posting = client.table("backlot_job_postings").select("project_id").eq("id", app_resp.data[0]["job_posting_id"]).execute()
    if not posting.data:
        raise HTTPException(status_code=404, detail="Job posting not found")

    project_id = str(posting.data[0]["project_id"])

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to update applications")

    update_data = {
        "status": request.status,
        "reviewed_by": user["id"],
        "reviewed_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if request.notes is not None:
        update_data["notes"] = request.notes

    result = client.table("backlot_job_applications").update(update_data).eq("id", application_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update application")

    return {"success": True, "status": request.status}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _format_job_posting(posting: dict, project: dict = None) -> JobPostingResponse:
    """Format a job posting for response"""
    return JobPostingResponse(
        id=str(posting["id"]),
        project_id=str(posting["project_id"]),
        created_by=str(posting["created_by"]),
        title=posting["title"],
        department=posting.get("department"),
        role_type=posting.get("role_type"),
        description=posting.get("description"),
        requirements=posting.get("requirements"),
        compensation_type=posting.get("compensation_type"),
        compensation_details=posting.get("compensation_details"),
        location=posting.get("location"),
        shoot_dates_start=str(posting["shoot_dates_start"]) if posting.get("shoot_dates_start") else None,
        shoot_dates_end=str(posting["shoot_dates_end"]) if posting.get("shoot_dates_end") else None,
        application_deadline=str(posting["application_deadline"]) if posting.get("application_deadline") else None,
        accepts_tapes=posting.get("accepts_tapes", False),
        tape_instructions=posting.get("tape_instructions"),
        status=posting.get("status", "draft"),
        published_at=str(posting["published_at"]) if posting.get("published_at") else None,
        created_at=str(posting.get("created_at", "")),
        updated_at=str(posting.get("updated_at", "")),
        application_count=posting.get("application_count", 0),
        project_title=project.get("title") if project else None,
    )


def _format_application(app: dict, profile: dict = None) -> JobApplicationResponse:
    """Format an application for response"""
    return JobApplicationResponse(
        id=str(app["id"]),
        job_posting_id=str(app["job_posting_id"]),
        applicant_id=str(app["applicant_id"]),
        cover_letter=app.get("cover_letter"),
        resume_url=app.get("resume_url"),
        tape_url=app.get("tape_url"),
        tape_platform=app.get("tape_platform"),
        status=app.get("status", "pending"),
        notes=app.get("notes"),
        reviewed_by=str(app["reviewed_by"]) if app.get("reviewed_by") else None,
        reviewed_at=str(app["reviewed_at"]) if app.get("reviewed_at") else None,
        created_at=str(app.get("created_at", "")),
        updated_at=str(app.get("updated_at", "")),
        applicant_name=profile.get("full_name") if profile else None,
        applicant_avatar=profile.get("avatar_url") if profile else None,
    )


# =============================================================================
# PROJECT INVITATIONS (Email-based)
# =============================================================================

class InvitationCreate(BaseModel):
    email: str
    role: Optional[str] = None
    department: Optional[str] = None
    permission_level: str = "member"  # 'admin', 'member', 'viewer'


class InvitationResponse(BaseModel):
    id: str
    project_id: str
    email: str
    role: Optional[str] = None
    department: Optional[str] = None
    permission_level: str
    token: str
    invited_by: str
    expires_at: Optional[str] = None
    accepted_at: Optional[str] = None
    created_at: str


@router.post("/projects/{project_id}/invitations", response_model=InvitationResponse)
async def create_invitation(
    project_id: str,
    request: InvitationCreate,
    authorization: str = Header(None)
):
    """Create an email invitation to join a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to invite members")

    # Generate a unique token
    token = secrets.token_urlsafe(32)

    # Set expiration to 7 days from now
    expires_at = datetime.utcnow().replace(hour=23, minute=59, second=59)
    from datetime import timedelta
    expires_at = expires_at + timedelta(days=7)

    invitation_data = {
        "project_id": project_id,
        "email": request.email.lower(),
        "role": request.role,
        "department": request.department,
        "permission_level": request.permission_level,
        "token": token,
        "invited_by": user["id"],
        "expires_at": expires_at.isoformat(),
    }

    result = client.table("backlot_project_invitations").insert(invitation_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    inv = result.data[0]
    return InvitationResponse(
        id=str(inv["id"]),
        project_id=str(inv["project_id"]),
        email=inv["email"],
        role=inv.get("role"),
        department=inv.get("department"),
        permission_level=inv["permission_level"],
        token=inv["token"],
        invited_by=str(inv["invited_by"]),
        expires_at=str(inv["expires_at"]) if inv.get("expires_at") else None,
        accepted_at=str(inv["accepted_at"]) if inv.get("accepted_at") else None,
        created_at=str(inv.get("created_at", "")),
    )


@router.get("/projects/{project_id}/invitations", response_model=List[InvitationResponse])
async def list_invitations(
    project_id: str,
    authorization: str = Header(None)
):
    """List pending invitations for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to view invitations")

    result = client.table("backlot_project_invitations").select("*").eq(
        "project_id", project_id
    ).is_("accepted_at", None).order("created_at", desc=True).execute()

    invitations = result.data or []
    return [
        InvitationResponse(
            id=str(inv["id"]),
            project_id=str(inv["project_id"]),
            email=inv["email"],
            role=inv.get("role"),
            department=inv.get("department"),
            permission_level=inv["permission_level"],
            token=inv["token"],
            invited_by=str(inv["invited_by"]),
            expires_at=str(inv["expires_at"]) if inv.get("expires_at") else None,
            accepted_at=str(inv["accepted_at"]) if inv.get("accepted_at") else None,
            created_at=str(inv.get("created_at", "")),
        )
        for inv in invitations
    ]


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    authorization: str = Header(None)
):
    """Accept a project invitation"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Find the invitation
    inv_resp = client.table("backlot_project_invitations").select("*").eq("token", token).execute()
    if not inv_resp.data:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")

    invitation = inv_resp.data[0]

    # Check if already accepted
    if invitation.get("accepted_at"):
        raise HTTPException(status_code=400, detail="Invitation has already been accepted")

    # Check if expired
    if invitation.get("expires_at"):
        expires = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if datetime.utcnow() > expires.replace(tzinfo=None):
            raise HTTPException(status_code=400, detail="Invitation has expired")

    project_id = str(invitation["project_id"])

    # Check if user is already a member
    existing = client.table("backlot_project_members").select("id").eq(
        "project_id", project_id
    ).eq("user_id", user["id"]).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="You are already a member of this project")

    # Add user as member
    member_data = {
        "project_id": project_id,
        "user_id": user["id"],
        "role": invitation.get("permission_level", "member"),
        "production_role": invitation.get("role"),
        "department": invitation.get("department"),
        "invited_by": invitation["invited_by"],
    }

    client.table("backlot_project_members").insert(member_data).execute()

    # Mark invitation as accepted
    client.table("backlot_project_invitations").update({
        "accepted_at": datetime.utcnow().isoformat()
    }).eq("id", invitation["id"]).execute()

    return {"success": True, "project_id": project_id}


@router.delete("/invitations/{invitation_id}")
async def revoke_invitation(
    invitation_id: str,
    authorization: str = Header(None)
):
    """Revoke a pending invitation"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get invitation
    inv_resp = client.table("backlot_project_invitations").select("project_id").eq("id", invitation_id).execute()
    if not inv_resp.data:
        raise HTTPException(status_code=404, detail="Invitation not found")

    project_id = str(inv_resp.data[0]["project_id"])

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to revoke invitations")

    client.table("backlot_project_invitations").delete().eq("id", invitation_id).execute()

    return {"success": True}


# =============================================================================
# DOCUMENT SIGNING MODELS
# =============================================================================

class DocumentTemplateResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    name: str
    document_type: str
    content: Dict[str, Any]
    is_system_template: bool = False
    requires_encryption: bool = False
    created_at: str


class SignatureRequestCreate(BaseModel):
    template_id: str
    recipient_id: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    document_title: str
    prefilled_data: Dict[str, Any] = {}
    message: Optional[str] = None
    due_date: Optional[date] = None


class SignatureRequestResponse(BaseModel):
    id: str
    project_id: str
    template_id: str
    recipient_id: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    document_title: str
    prefilled_data: Dict[str, Any] = {}
    message: Optional[str] = None
    due_date: Optional[str] = None
    status: str
    sent_by: str
    sent_at: str
    viewed_at: Optional[str] = None
    signed_at: Optional[str] = None
    created_at: str
    template_name: Optional[str] = None
    sender_name: Optional[str] = None


class SignDocumentRequest(BaseModel):
    form_data: Dict[str, Any]
    signature_data: str  # Base64 signature image


class SignedDocumentResponse(BaseModel):
    id: str
    request_id: str
    project_id: str
    signer_id: str
    document_type: str
    form_data: Dict[str, Any]
    pdf_url: Optional[str] = None
    signed_at: str
    created_at: str


class BulkSignatureRequest(BaseModel):
    template_ids: List[str]
    recipient_ids: List[str]
    message: Optional[str] = None
    due_date: Optional[date] = None


# =============================================================================
# DOCUMENT TEMPLATE ENDPOINTS
# =============================================================================

@router.get("/document-templates", response_model=List[DocumentTemplateResponse])
async def list_document_templates(
    project_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """List available document templates (system + project-specific)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get system templates
    system_resp = client.table("backlot_document_templates").select("*").eq("is_system_template", True).execute()
    templates = system_resp.data or []

    # Get project-specific templates if project_id provided
    if project_id:
        project_resp = client.table("backlot_document_templates").select("*").eq(
            "project_id", project_id
        ).eq("is_system_template", False).execute()
        templates.extend(project_resp.data or [])

    return [
        DocumentTemplateResponse(
            id=str(t["id"]),
            project_id=str(t["project_id"]) if t.get("project_id") else None,
            name=t["name"],
            document_type=t["document_type"],
            content=t.get("content", {}),
            is_system_template=t.get("is_system_template", False),
            requires_encryption=t.get("requires_encryption", False),
            created_at=str(t.get("created_at", "")),
        )
        for t in templates
    ]


@router.post("/projects/{project_id}/document-templates", response_model=DocumentTemplateResponse)
async def create_document_template(
    project_id: str,
    name: str,
    document_type: str,
    content: Dict[str, Any],
    requires_encryption: bool = False,
    authorization: str = Header(None)
):
    """Create a custom document template for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to create templates")

    template_data = {
        "project_id": project_id,
        "name": name,
        "document_type": document_type,
        "content": content,
        "is_system_template": False,
        "requires_encryption": requires_encryption,
        "created_by": user["id"],
    }

    result = client.table("backlot_document_templates").insert(template_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create template")

    t = result.data[0]
    return DocumentTemplateResponse(
        id=str(t["id"]),
        project_id=str(t["project_id"]) if t.get("project_id") else None,
        name=t["name"],
        document_type=t["document_type"],
        content=t.get("content", {}),
        is_system_template=False,
        requires_encryption=t.get("requires_encryption", False),
        created_at=str(t.get("created_at", "")),
    )


# =============================================================================
# SIGNATURE REQUEST ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/signature-requests", response_model=SignatureRequestResponse)
async def create_signature_request(
    project_id: str,
    request: SignatureRequestCreate,
    authorization: str = Header(None)
):
    """Send a document for signature"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to send documents")

    # Verify template exists
    template = client.table("backlot_document_templates").select("id, name").eq("id", request.template_id).execute()
    if not template.data:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get recipient name if recipient_id provided
    recipient_name = request.recipient_name
    recipient_email = request.recipient_email
    if request.recipient_id:
        profile = client.table("profiles").select("full_name, email").eq("id", request.recipient_id).execute()
        if profile.data:
            recipient_name = recipient_name or profile.data[0].get("full_name")
            recipient_email = recipient_email or profile.data[0].get("email")

    req_data = {
        "project_id": project_id,
        "template_id": request.template_id,
        "recipient_id": request.recipient_id,
        "recipient_email": recipient_email,
        "recipient_name": recipient_name,
        "document_title": request.document_title,
        "prefilled_data": request.prefilled_data,
        "message": request.message,
        "due_date": request.due_date.isoformat() if request.due_date else None,
        "status": "pending",
        "sent_by": user["id"],
        "sent_at": datetime.utcnow().isoformat(),
    }

    result = client.table("backlot_signature_requests").insert(req_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create signature request")

    return _format_signature_request(result.data[0], template.data[0])


@router.post("/projects/{project_id}/signature-requests/bulk")
async def create_bulk_signature_requests(
    project_id: str,
    request: BulkSignatureRequest,
    authorization: str = Header(None)
):
    """Send multiple documents to multiple recipients (onboarding packet)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to send documents")

    # Get templates
    templates = client.table("backlot_document_templates").select("id, name").in_("id", request.template_ids).execute()
    if not templates.data or len(templates.data) != len(request.template_ids):
        raise HTTPException(status_code=404, detail="One or more templates not found")

    templates_by_id = {str(t["id"]): t for t in templates.data}

    # Get recipient profiles
    profiles = client.table("profiles").select("id, full_name, email").in_("id", request.recipient_ids).execute()
    profiles_by_id = {str(p["id"]): p for p in (profiles.data or [])}

    created_requests = []
    for recipient_id in request.recipient_ids:
        profile = profiles_by_id.get(recipient_id, {})
        for template_id in request.template_ids:
            template = templates_by_id.get(template_id, {})

            req_data = {
                "project_id": project_id,
                "template_id": template_id,
                "recipient_id": recipient_id,
                "recipient_email": profile.get("email"),
                "recipient_name": profile.get("full_name"),
                "document_title": template.get("name", "Document"),
                "prefilled_data": {},
                "message": request.message,
                "due_date": request.due_date.isoformat() if request.due_date else None,
                "status": "pending",
                "sent_by": user["id"],
                "sent_at": datetime.utcnow().isoformat(),
            }

            result = client.table("backlot_signature_requests").insert(req_data).execute()
            if result.data:
                created_requests.append(result.data[0])

    return {
        "success": True,
        "created_count": len(created_requests),
        "recipient_count": len(request.recipient_ids),
        "template_count": len(request.template_ids),
    }


@router.get("/projects/{project_id}/signature-requests", response_model=List[SignatureRequestResponse])
async def list_signature_requests(
    project_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """List signature requests for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to view signature requests")

    query = client.table("backlot_signature_requests").select("*").eq("project_id", project_id)
    if status:
        query = query.eq("status", status)
    query = query.order("created_at", desc=True)

    result = query.execute()
    requests = result.data or []

    # Get template info
    template_ids = list(set(str(r["template_id"]) for r in requests if r.get("template_id")))
    templates_by_id = {}
    if template_ids:
        templates = client.table("backlot_document_templates").select("id, name").in_("id", template_ids).execute()
        templates_by_id = {str(t["id"]): t for t in (templates.data or [])}

    return [_format_signature_request(r, templates_by_id.get(str(r["template_id"]))) for r in requests]


@router.get("/my-signature-requests", response_model=List[SignatureRequestResponse])
async def list_my_signature_requests(
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """List signature requests sent to the current user"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    query = client.table("backlot_signature_requests").select("*").eq("recipient_id", user["id"])
    if status:
        query = query.eq("status", status)
    query = query.order("created_at", desc=True)

    result = query.execute()
    requests = result.data or []

    # Get template info
    template_ids = list(set(str(r["template_id"]) for r in requests if r.get("template_id")))
    templates_by_id = {}
    if template_ids:
        templates = client.table("backlot_document_templates").select("id, name").in_("id", template_ids).execute()
        templates_by_id = {str(t["id"]): t for t in (templates.data or [])}

    return [_format_signature_request(r, templates_by_id.get(str(r["template_id"]))) for r in requests]


@router.get("/signature-requests/{request_id}", response_model=SignatureRequestResponse)
async def get_signature_request(
    request_id: str,
    authorization: str = Header(None)
):
    """Get a specific signature request"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    result = client.table("backlot_signature_requests").select("*").eq("id", request_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Signature request not found")

    sig_req = result.data[0]

    # Verify access - must be sender, recipient, or project admin
    is_recipient = str(sig_req.get("recipient_id")) == user["id"]
    is_sender = str(sig_req.get("sent_by")) == user["id"]
    is_admin = await can_manage_access(str(sig_req["project_id"]), user["id"])

    if not (is_recipient or is_sender or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    # Mark as viewed if recipient
    if is_recipient and sig_req["status"] == "pending":
        client.table("backlot_signature_requests").update({
            "status": "viewed",
            "viewed_at": datetime.utcnow().isoformat(),
        }).eq("id", request_id).execute()
        sig_req["status"] = "viewed"

    # Get template
    template = client.table("backlot_document_templates").select("id, name, content").eq(
        "id", sig_req["template_id"]
    ).execute()

    return _format_signature_request(sig_req, template.data[0] if template.data else None)


@router.post("/signature-requests/{request_id}/sign", response_model=SignedDocumentResponse)
async def sign_document(
    request_id: str,
    request: SignDocumentRequest,
    http_request: Request,
    authorization: str = Header(None)
):
    """Sign a document"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get signature request
    sig_req = client.table("backlot_signature_requests").select("*").eq("id", request_id).execute()
    if not sig_req.data:
        raise HTTPException(status_code=404, detail="Signature request not found")

    sig_req = sig_req.data[0]

    # Verify this user is the recipient
    if str(sig_req.get("recipient_id")) != user["id"]:
        raise HTTPException(status_code=403, detail="You are not the recipient of this document")

    if sig_req["status"] == "signed":
        raise HTTPException(status_code=400, detail="Document has already been signed")

    # Get template for document type
    template = client.table("backlot_document_templates").select("document_type").eq(
        "id", sig_req["template_id"]
    ).execute()
    doc_type = template.data[0]["document_type"] if template.data else "custom"

    # Create signed document record
    signed_doc_data = {
        "request_id": request_id,
        "project_id": sig_req["project_id"],
        "signer_id": user["id"],
        "document_type": doc_type,
        "form_data": request.form_data,
        "signature_data": request.signature_data,
        "signature_ip": http_request.client.host if http_request.client else None,
        "signature_user_agent": http_request.headers.get("user-agent"),
        "signed_at": datetime.utcnow().isoformat(),
    }

    result = client.table("backlot_signed_documents").insert(signed_doc_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save signed document")

    # Update request status
    client.table("backlot_signature_requests").update({
        "status": "signed",
        "signed_at": datetime.utcnow().isoformat(),
    }).eq("id", request_id).execute()

    doc = result.data[0]
    return SignedDocumentResponse(
        id=str(doc["id"]),
        request_id=str(doc["request_id"]),
        project_id=str(doc["project_id"]),
        signer_id=str(doc["signer_id"]),
        document_type=doc["document_type"],
        form_data=doc.get("form_data", {}),
        pdf_url=doc.get("pdf_url"),
        signed_at=str(doc.get("signed_at", "")),
        created_at=str(doc.get("created_at", "")),
    )


@router.get("/projects/{project_id}/signed-documents", response_model=List[SignedDocumentResponse])
async def list_signed_documents(
    project_id: str,
    authorization: str = Header(None)
):
    """List all signed documents for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to view signed documents")

    result = client.table("backlot_signed_documents").select("*").eq(
        "project_id", project_id
    ).order("signed_at", desc=True).execute()

    return [
        SignedDocumentResponse(
            id=str(doc["id"]),
            request_id=str(doc["request_id"]),
            project_id=str(doc["project_id"]),
            signer_id=str(doc["signer_id"]),
            document_type=doc["document_type"],
            form_data=doc.get("form_data", {}),
            pdf_url=doc.get("pdf_url"),
            signed_at=str(doc.get("signed_at", "")),
            created_at=str(doc.get("created_at", "")),
        )
        for doc in (result.data or [])
    ]


# =============================================================================
# USER SIGNATURES
# =============================================================================

class UserSignatureResponse(BaseModel):
    id: str
    user_id: str
    signature_data: str
    is_default: bool
    created_at: str


@router.post("/users/signatures", response_model=UserSignatureResponse)
async def save_user_signature(
    signature_data: str,
    is_default: bool = True,
    authorization: str = Header(None)
):
    """Save a user's signature for reuse"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # If setting as default, clear other defaults
    if is_default:
        client.table("backlot_user_signatures").update({
            "is_default": False
        }).eq("user_id", user["id"]).execute()

    sig_data = {
        "user_id": user["id"],
        "signature_data": signature_data,
        "is_default": is_default,
    }

    result = client.table("backlot_user_signatures").insert(sig_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save signature")

    sig = result.data[0]
    return UserSignatureResponse(
        id=str(sig["id"]),
        user_id=str(sig["user_id"]),
        signature_data=sig["signature_data"],
        is_default=sig.get("is_default", False),
        created_at=str(sig.get("created_at", "")),
    )


@router.get("/users/signatures", response_model=List[UserSignatureResponse])
async def get_user_signatures(
    authorization: str = Header(None)
):
    """Get the current user's saved signatures"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    result = client.table("backlot_user_signatures").select("*").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).execute()

    return [
        UserSignatureResponse(
            id=str(sig["id"]),
            user_id=str(sig["user_id"]),
            signature_data=sig["signature_data"],
            is_default=sig.get("is_default", False),
            created_at=str(sig.get("created_at", "")),
        )
        for sig in (result.data or [])
    ]


def _format_signature_request(req: dict, template: dict = None) -> SignatureRequestResponse:
    """Format a signature request for response"""
    return SignatureRequestResponse(
        id=str(req["id"]),
        project_id=str(req["project_id"]),
        template_id=str(req["template_id"]),
        recipient_id=str(req["recipient_id"]) if req.get("recipient_id") else None,
        recipient_email=req.get("recipient_email"),
        recipient_name=req.get("recipient_name"),
        document_title=req["document_title"],
        prefilled_data=req.get("prefilled_data", {}),
        message=req.get("message"),
        due_date=str(req["due_date"]) if req.get("due_date") else None,
        status=req.get("status", "pending"),
        sent_by=str(req["sent_by"]),
        sent_at=str(req.get("sent_at", "")),
        viewed_at=str(req["viewed_at"]) if req.get("viewed_at") else None,
        signed_at=str(req["signed_at"]) if req.get("signed_at") else None,
        created_at=str(req.get("created_at", "")),
        template_name=template.get("name") if template else None,
    )


# =============================================================================
# CREW COMMUNICATION MODELS
# =============================================================================

class ChannelCreate(BaseModel):
    name: str
    channel_type: str = "general"  # 'general', 'department', 'announcement'
    department: Optional[str] = None
    description: Optional[str] = None


class ChannelResponse(BaseModel):
    id: str
    project_id: str
    name: str
    channel_type: str
    department: Optional[str] = None
    description: Optional[str] = None
    is_default: bool = False
    created_by: Optional[str] = None
    created_at: str
    unread_count: int = 0


class MessageCreate(BaseModel):
    content: str
    attachments: List[Dict[str, Any]] = []


class MessageResponse(BaseModel):
    id: str
    channel_id: str
    sender_id: str
    content: str
    message_type: str = "message"
    is_pinned: bool = False
    attachments: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None


class DirectMessageCreate(BaseModel):
    content: str
    attachments: List[Dict[str, Any]] = []


class DirectMessageResponse(BaseModel):
    id: str
    project_id: str
    sender_id: str
    recipient_id: str
    content: str
    read_at: Optional[str] = None
    attachments: List[Dict[str, Any]] = []
    created_at: str
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str = "normal"  # 'low', 'normal', 'high', 'urgent'
    requires_acknowledgment: bool = False
    target_departments: List[str] = []
    target_roles: List[str] = []
    expires_at: Optional[datetime] = None


class AnnouncementResponse(BaseModel):
    id: str
    project_id: str
    channel_id: Optional[str] = None
    sender_id: str
    title: str
    content: str
    priority: str
    requires_acknowledgment: bool = False
    target_departments: List[str] = []
    target_roles: List[str] = []
    published_at: str
    expires_at: Optional[str] = None
    created_at: str
    sender_name: Optional[str] = None
    acknowledgment_count: int = 0
    is_acknowledged: bool = False


# =============================================================================
# CHANNEL ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/channels", response_model=ChannelResponse)
async def create_channel(
    project_id: str,
    request: ChannelCreate,
    authorization: str = Header(None)
):
    """Create a new channel for crew communication"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to create channels")

    channel_data = {
        "project_id": project_id,
        "name": request.name,
        "channel_type": request.channel_type,
        "department": request.department,
        "description": request.description,
        "is_default": False,
        "created_by": user["id"],
    }

    result = client.table("backlot_channels").insert(channel_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create channel")

    ch = result.data[0]
    return ChannelResponse(
        id=str(ch["id"]),
        project_id=str(ch["project_id"]),
        name=ch["name"],
        channel_type=ch["channel_type"],
        department=ch.get("department"),
        description=ch.get("description"),
        is_default=ch.get("is_default", False),
        created_by=str(ch["created_by"]) if ch.get("created_by") else None,
        created_at=str(ch.get("created_at", "")),
    )


@router.get("/projects/{project_id}/channels", response_model=List[ChannelResponse])
async def list_channels(
    project_id: str,
    authorization: str = Header(None)
):
    """List all channels for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    result = client.table("backlot_channels").select("*").eq(
        "project_id", project_id
    ).order("name").execute()

    return [
        ChannelResponse(
            id=str(ch["id"]),
            project_id=str(ch["project_id"]),
            name=ch["name"],
            channel_type=ch["channel_type"],
            department=ch.get("department"),
            description=ch.get("description"),
            is_default=ch.get("is_default", False),
            created_by=str(ch["created_by"]) if ch.get("created_by") else None,
            created_at=str(ch.get("created_at", "")),
        )
        for ch in (result.data or [])
    ]


@router.get("/channels/{channel_id}/messages", response_model=List[MessageResponse])
async def get_channel_messages(
    channel_id: str,
    limit: int = 50,
    offset: int = 0,
    authorization: str = Header(None)
):
    """Get messages from a channel"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    result = client.table("backlot_channel_messages").select("*").eq(
        "channel_id", channel_id
    ).order("created_at", desc=True).limit(limit).offset(offset).execute()

    messages = result.data or []

    # Get sender profiles
    sender_ids = list(set(str(m["sender_id"]) for m in messages))
    profiles_by_id = {}
    if sender_ids:
        profiles = client.table("profiles").select("id, full_name, avatar_url").in_("id", sender_ids).execute()
        profiles_by_id = {str(p["id"]): p for p in (profiles.data or [])}

    return [
        MessageResponse(
            id=str(m["id"]),
            channel_id=str(m["channel_id"]),
            sender_id=str(m["sender_id"]),
            content=m["content"],
            message_type=m.get("message_type", "message"),
            is_pinned=m.get("is_pinned", False),
            attachments=m.get("attachments", []),
            created_at=str(m.get("created_at", "")),
            updated_at=str(m.get("updated_at", "")),
            sender_name=profiles_by_id.get(str(m["sender_id"]), {}).get("full_name"),
            sender_avatar=profiles_by_id.get(str(m["sender_id"]), {}).get("avatar_url"),
        )
        for m in reversed(messages)  # Reverse to show oldest first
    ]


@router.post("/channels/{channel_id}/messages", response_model=MessageResponse)
async def send_channel_message(
    channel_id: str,
    request: MessageCreate,
    authorization: str = Header(None)
):
    """Send a message to a channel"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify channel exists
    channel = client.table("backlot_channels").select("project_id").eq("id", channel_id).execute()
    if not channel.data:
        raise HTTPException(status_code=404, detail="Channel not found")

    msg_data = {
        "channel_id": channel_id,
        "sender_id": user["id"],
        "content": request.content,
        "message_type": "message",
        "attachments": request.attachments,
    }

    result = client.table("backlot_channel_messages").insert(msg_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to send message")

    # Get sender profile
    profile = client.table("profiles").select("full_name, avatar_url").eq("id", user["id"]).execute()

    m = result.data[0]
    return MessageResponse(
        id=str(m["id"]),
        channel_id=str(m["channel_id"]),
        sender_id=str(m["sender_id"]),
        content=m["content"],
        message_type=m.get("message_type", "message"),
        is_pinned=m.get("is_pinned", False),
        attachments=m.get("attachments", []),
        created_at=str(m.get("created_at", "")),
        updated_at=str(m.get("updated_at", "")),
        sender_name=profile.data[0].get("full_name") if profile.data else None,
        sender_avatar=profile.data[0].get("avatar_url") if profile.data else None,
    )


# =============================================================================
# DIRECT MESSAGE ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/dm/{recipient_id}", response_model=List[DirectMessageResponse])
async def get_dm_thread(
    project_id: str,
    recipient_id: str,
    limit: int = 50,
    authorization: str = Header(None)
):
    """Get direct message thread with a user"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get messages in both directions
    from sqlalchemy import text
    from app.core.database import execute_query

    query = """
        SELECT * FROM backlot_direct_messages
        WHERE project_id = :project_id
        AND (
            (sender_id = :user_id AND recipient_id = :recipient_id)
            OR (sender_id = :recipient_id AND recipient_id = :user_id)
        )
        ORDER BY created_at DESC
        LIMIT :limit
    """
    messages = execute_query(query, {
        "project_id": project_id,
        "user_id": user["id"],
        "recipient_id": recipient_id,
        "limit": limit,
    })

    # Get profiles
    profile_ids = list(set([user["id"], recipient_id]))
    profiles = client.table("profiles").select("id, full_name, avatar_url").in_("id", profile_ids).execute()
    profiles_by_id = {str(p["id"]): p for p in (profiles.data or [])}

    return [
        DirectMessageResponse(
            id=str(m["id"]),
            project_id=str(m["project_id"]),
            sender_id=str(m["sender_id"]),
            recipient_id=str(m["recipient_id"]),
            content=m["content"],
            read_at=str(m["read_at"]) if m.get("read_at") else None,
            attachments=m.get("attachments", []),
            created_at=str(m.get("created_at", "")),
            sender_name=profiles_by_id.get(str(m["sender_id"]), {}).get("full_name"),
            sender_avatar=profiles_by_id.get(str(m["sender_id"]), {}).get("avatar_url"),
        )
        for m in reversed(messages)
    ]


@router.post("/projects/{project_id}/dm/{recipient_id}", response_model=DirectMessageResponse)
async def send_dm(
    project_id: str,
    recipient_id: str,
    request: DirectMessageCreate,
    authorization: str = Header(None)
):
    """Send a direct message to a user"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    dm_data = {
        "project_id": project_id,
        "sender_id": user["id"],
        "recipient_id": recipient_id,
        "content": request.content,
        "attachments": request.attachments,
    }

    result = client.table("backlot_direct_messages").insert(dm_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to send message")

    # Get sender profile
    profile = client.table("profiles").select("full_name, avatar_url").eq("id", user["id"]).execute()

    m = result.data[0]
    return DirectMessageResponse(
        id=str(m["id"]),
        project_id=str(m["project_id"]),
        sender_id=str(m["sender_id"]),
        recipient_id=str(m["recipient_id"]),
        content=m["content"],
        read_at=str(m["read_at"]) if m.get("read_at") else None,
        attachments=m.get("attachments", []),
        created_at=str(m.get("created_at", "")),
        sender_name=profile.data[0].get("full_name") if profile.data else None,
        sender_avatar=profile.data[0].get("avatar_url") if profile.data else None,
    )


# =============================================================================
# ANNOUNCEMENT ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/announcements", response_model=AnnouncementResponse)
async def create_announcement(
    project_id: str,
    request: AnnouncementCreate,
    authorization: str = Header(None)
):
    """Post an announcement to the project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_manage_access(project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to post announcements")

    ann_data = {
        "project_id": project_id,
        "sender_id": user["id"],
        "title": request.title,
        "content": request.content,
        "priority": request.priority,
        "requires_acknowledgment": request.requires_acknowledgment,
        "target_departments": request.target_departments,
        "target_roles": request.target_roles,
        "expires_at": request.expires_at.isoformat() if request.expires_at else None,
        "published_at": datetime.utcnow().isoformat(),
    }

    result = client.table("backlot_announcements").insert(ann_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create announcement")

    # Get sender profile
    profile = client.table("profiles").select("full_name").eq("id", user["id"]).execute()

    ann = result.data[0]
    return AnnouncementResponse(
        id=str(ann["id"]),
        project_id=str(ann["project_id"]),
        channel_id=str(ann["channel_id"]) if ann.get("channel_id") else None,
        sender_id=str(ann["sender_id"]),
        title=ann["title"],
        content=ann["content"],
        priority=ann.get("priority", "normal"),
        requires_acknowledgment=ann.get("requires_acknowledgment", False),
        target_departments=ann.get("target_departments", []),
        target_roles=ann.get("target_roles", []),
        published_at=str(ann.get("published_at", "")),
        expires_at=str(ann["expires_at"]) if ann.get("expires_at") else None,
        created_at=str(ann.get("created_at", "")),
        sender_name=profile.data[0].get("full_name") if profile.data else None,
    )


@router.get("/projects/{project_id}/announcements", response_model=List[AnnouncementResponse])
async def list_announcements(
    project_id: str,
    authorization: str = Header(None)
):
    """List announcements for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    result = client.table("backlot_announcements").select("*").eq(
        "project_id", project_id
    ).order("published_at", desc=True).execute()

    announcements = result.data or []

    # Get sender profiles
    sender_ids = list(set(str(a["sender_id"]) for a in announcements))
    profiles_by_id = {}
    if sender_ids:
        profiles = client.table("profiles").select("id, full_name").in_("id", sender_ids).execute()
        profiles_by_id = {str(p["id"]): p for p in (profiles.data or [])}

    # Get acknowledgment counts and user's acknowledgment status
    ann_ids = [str(a["id"]) for a in announcements]
    ack_counts = {}
    user_acks = set()
    if ann_ids:
        acks = client.table("backlot_announcement_acknowledgments").select("announcement_id, user_id").in_(
            "announcement_id", ann_ids
        ).execute()
        for ack in (acks.data or []):
            aid = str(ack["announcement_id"])
            ack_counts[aid] = ack_counts.get(aid, 0) + 1
            if str(ack["user_id"]) == user["id"]:
                user_acks.add(aid)

    return [
        AnnouncementResponse(
            id=str(ann["id"]),
            project_id=str(ann["project_id"]),
            channel_id=str(ann["channel_id"]) if ann.get("channel_id") else None,
            sender_id=str(ann["sender_id"]),
            title=ann["title"],
            content=ann["content"],
            priority=ann.get("priority", "normal"),
            requires_acknowledgment=ann.get("requires_acknowledgment", False),
            target_departments=ann.get("target_departments", []),
            target_roles=ann.get("target_roles", []),
            published_at=str(ann.get("published_at", "")),
            expires_at=str(ann["expires_at"]) if ann.get("expires_at") else None,
            created_at=str(ann.get("created_at", "")),
            sender_name=profiles_by_id.get(str(ann["sender_id"]), {}).get("full_name"),
            acknowledgment_count=ack_counts.get(str(ann["id"]), 0),
            is_acknowledged=str(ann["id"]) in user_acks,
        )
        for ann in announcements
    ]


@router.post("/announcements/{announcement_id}/acknowledge")
async def acknowledge_announcement(
    announcement_id: str,
    authorization: str = Header(None)
):
    """Acknowledge an announcement"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Check if already acknowledged
    existing = client.table("backlot_announcement_acknowledgments").select("id").eq(
        "announcement_id", announcement_id
    ).eq("user_id", user["id"]).execute()

    if existing.data:
        return {"success": True, "already_acknowledged": True}

    client.table("backlot_announcement_acknowledgments").insert({
        "announcement_id": announcement_id,
        "user_id": user["id"],
    }).execute()

    return {"success": True, "already_acknowledged": False}
