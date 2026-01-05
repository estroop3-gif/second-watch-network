"""
Moderation API
Phase 4B: Content review, flags, and user moderation endpoints.

Provides:
- Content review queue and task management
- Flag creation and resolution
- User moderation actions (warn, mute, suspend)
- Moderation history and audit trail
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import execute_single
from app.core.auth import get_current_user
from app.core.deps import require_admin, require_moderator
from app.services.content_review_service import ContentReviewService
from app.core.policies import (
    calculate_review_priority,
    should_auto_hold_content,
    get_mute_duration_hours
)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateReviewTaskRequest(BaseModel):
    content_type: str = Field(..., pattern="^(world|episode|companion_item|short|live_event)$")
    content_id: str
    world_id: str
    submission_notes: Optional[str] = None
    priority: int = Field(default=5, ge=1, le=10)
    due_by: Optional[datetime] = None


class AssignTaskRequest(BaseModel):
    assignee_id: str


class CompleteReviewRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected|needs_changes)$")
    review_notes: Optional[str] = None
    required_changes: Optional[str] = None


class CreateFlagRequest(BaseModel):
    content_type: str = Field(..., pattern="^(world|episode|companion_item|short|live_event|thread|reply)$")
    content_id: str
    world_id: Optional[str] = None
    category: str = Field(..., pattern="^(technical|content_policy|rights_concern|metadata|safety|spam|other)$")
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    reason: str = Field(..., min_length=10, max_length=1000)
    details: Optional[str] = None


class ResolveFlagRequest(BaseModel):
    resolution_action: str = Field(..., pattern="^(no_action|content_removed|user_warned|violation_confirmed|dismissed)$")
    resolution_notes: Optional[str] = None


class WarnUserRequest(BaseModel):
    warning_type: str = Field(..., pattern="^(content_policy|community_guidelines|spam|harassment|rights|other)$")
    reason: str = Field(..., min_length=10, max_length=1000)
    details: Optional[str] = None
    related_content_type: Optional[str] = None
    related_content_id: Optional[str] = None


class MuteUserRequest(BaseModel):
    reason: str = Field(..., min_length=10, max_length=1000)
    duration_hours: Optional[int] = Field(default=None, ge=1, le=8760)  # Max 1 year


class HideContentRequest(BaseModel):
    content_type: str = Field(..., pattern="^(thread|reply)$")
    content_id: str
    reason: str = Field(..., min_length=5, max_length=500)


# =============================================================================
# Content Review Endpoints
# =============================================================================

@router.post("/review/tasks")
async def create_review_task(
    request: CreateReviewTaskRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a content review task (submit content for review)."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Calculate priority based on policies
    priority = calculate_review_priority(
        content_type=request.content_type,
        is_resubmission=False
    )

    task = await ContentReviewService.create_review_task(
        content_type=request.content_type,
        content_id=request.content_id,
        world_id=request.world_id,
        submitted_by=str(profile["id"]),
        submission_notes=request.submission_notes,
        priority=min(priority, request.priority),  # Use lower (higher priority)
        due_by=request.due_by
    )

    return {"task": task}


@router.get("/review/queue")
async def get_review_queue(
    status: Optional[str] = Query(None),
    content_type: Optional[str] = Query(None),
    assigned_to_me: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_moderator)
):
    """Get the content review queue (moderators/admins only)."""
    assigned_to = None
    if assigned_to_me:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_sub = :sub",
            {"sub": current_user.get("sub")}
        )
        if profile:
            assigned_to = str(profile["id"])

    result = await ContentReviewService.get_review_queue(
        status=status,
        content_type=content_type,
        assigned_to=assigned_to,
        limit=limit,
        offset=offset
    )

    return result


@router.get("/review/tasks/{task_id}")
async def get_review_task(
    task_id: str,
    current_user: dict = Depends(require_moderator)
):
    """Get details of a review task."""
    task = execute_single("""
        SELECT
            crt.*,
            w.title as world_title,
            w.slug as world_slug,
            p_sub.display_name as submitter_name,
            p_assign.display_name as assignee_name,
            p_reviewer.display_name as reviewer_name
        FROM content_review_tasks crt
        LEFT JOIN worlds w ON crt.world_id = w.id
        LEFT JOIN profiles p_sub ON crt.submitted_by = p_sub.id
        LEFT JOIN profiles p_assign ON crt.assigned_to = p_assign.id
        LEFT JOIN profiles p_reviewer ON crt.reviewed_by = p_reviewer.id
        WHERE crt.id = :task_id
    """, {"task_id": task_id})

    if not task:
        raise HTTPException(404, "Review task not found")

    # Get history
    history = await ContentReviewService.get_task_history(task_id)

    return {
        "task": dict(task),
        "history": history
    }


@router.post("/review/tasks/{task_id}/assign")
async def assign_review_task(
    task_id: str,
    request: AssignTaskRequest,
    current_user: dict = Depends(require_moderator)
):
    """Assign a review task to a moderator."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    task = await ContentReviewService.assign_review_task(
        task_id=task_id,
        assignee_id=request.assignee_id,
        assigned_by=str(profile["id"])
    )

    if not task:
        raise HTTPException(400, "Could not assign task - check task status")

    return {"task": task}


@router.post("/review/tasks/{task_id}/claim")
async def claim_review_task(
    task_id: str,
    current_user: dict = Depends(require_moderator)
):
    """Claim a review task for yourself."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    user_id = str(profile["id"])

    task = await ContentReviewService.assign_review_task(
        task_id=task_id,
        assignee_id=user_id,
        assigned_by=user_id
    )

    if not task:
        raise HTTPException(400, "Could not claim task - may already be assigned")

    return {"task": task}


@router.post("/review/tasks/{task_id}/complete")
async def complete_review_task(
    task_id: str,
    request: CompleteReviewRequest,
    current_user: dict = Depends(require_moderator)
):
    """Complete a review with a decision."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    try:
        task = await ContentReviewService.complete_review(
            task_id=task_id,
            reviewer_id=str(profile["id"]),
            decision=request.decision,
            review_notes=request.review_notes,
            required_changes=request.required_changes
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not task:
        raise HTTPException(404, "Review task not found")

    return {"task": task}


@router.post("/review/tasks/{task_id}/resubmit")
async def resubmit_for_review(
    task_id: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Resubmit content after making required changes."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    task = await ContentReviewService.resubmit_for_review(
        task_id=task_id,
        submitted_by=str(profile["id"]),
        notes=notes
    )

    if not task:
        raise HTTPException(400, "Cannot resubmit - check task status")

    return {"task": task}


# =============================================================================
# Content Flag Endpoints
# =============================================================================

@router.post("/flags")
async def create_flag(
    request: CreateFlagRequest,
    current_user: dict = Depends(get_current_user)
):
    """Report/flag content for review."""
    profile = execute_single(
        "SELECT id, is_admin, is_moderator FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    is_moderator = profile.get("is_admin") or profile.get("is_moderator")

    flag = await ContentReviewService.create_flag(
        content_type=request.content_type,
        content_id=request.content_id,
        world_id=request.world_id,
        category=request.category,
        severity=request.severity,
        reason=request.reason,
        details=request.details,
        reported_by=str(profile["id"]),
        is_moderator_flag=is_moderator
    )

    return {"flag": flag, "message": "Thank you for your report. Our team will review it."}


@router.get("/flags")
async def get_flags(
    status: Optional[str] = Query("open"),
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    content_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_moderator)
):
    """Get content flags (moderators only)."""
    result = await ContentReviewService.get_open_flags(
        severity=severity,
        category=category,
        content_type=content_type,
        limit=limit,
        offset=offset
    )

    return result


@router.get("/flags/{flag_id}")
async def get_flag(
    flag_id: str,
    current_user: dict = Depends(require_moderator)
):
    """Get flag details."""
    flag = execute_single("""
        SELECT
            cf.*,
            w.title as world_title,
            p_reporter.display_name as reporter_name,
            p_resolver.display_name as resolver_name
        FROM content_flags cf
        LEFT JOIN worlds w ON cf.world_id = w.id
        LEFT JOIN profiles p_reporter ON cf.reported_by = p_reporter.id
        LEFT JOIN profiles p_resolver ON cf.resolved_by = p_resolver.id
        WHERE cf.id = :flag_id
    """, {"flag_id": flag_id})

    if not flag:
        raise HTTPException(404, "Flag not found")

    return {"flag": dict(flag)}


@router.post("/flags/{flag_id}/resolve")
async def resolve_flag(
    flag_id: str,
    request: ResolveFlagRequest,
    current_user: dict = Depends(require_moderator)
):
    """Resolve a content flag."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    flag = await ContentReviewService.resolve_flag(
        flag_id=flag_id,
        resolved_by=str(profile["id"]),
        resolution_action=request.resolution_action,
        resolution_notes=request.resolution_notes
    )

    if not flag:
        raise HTTPException(404, "Flag not found or already resolved")

    return {"flag": flag}


# =============================================================================
# User Moderation Endpoints
# =============================================================================

@router.post("/users/{user_id}/warn")
async def warn_user(
    user_id: str,
    request: WarnUserRequest,
    current_user: dict = Depends(require_moderator)
):
    """Issue a warning to a user."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Verify target user exists
    target = execute_single(
        "SELECT id FROM profiles WHERE id = :id",
        {"id": user_id}
    )
    if not target:
        raise HTTPException(404, "Target user not found")

    warning = await ContentReviewService.warn_user(
        user_id=user_id,
        warning_type=request.warning_type,
        reason=request.reason,
        issued_by=str(profile["id"]),
        details=request.details,
        related_content_type=request.related_content_type,
        related_content_id=request.related_content_id
    )

    return {"warning": warning}


@router.post("/users/{user_id}/mute")
async def mute_user(
    user_id: str,
    request: MuteUserRequest,
    current_user: dict = Depends(require_moderator)
):
    """Mute a user (prevent posting)."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Get previous mute count for duration calculation
    safety = await ContentReviewService.get_user_safety_profile(user_id)
    previous_mutes = safety.get("mute_count", 0) if safety else 0

    # Calculate duration if not specified
    duration = request.duration_hours
    if duration is None:
        duration = get_mute_duration_hours(previous_mutes)

    result = await ContentReviewService.mute_user(
        user_id=user_id,
        moderator_id=str(profile["id"]),
        reason=request.reason,
        duration_hours=duration
    )

    return {
        "success": True,
        "duration_hours": duration,
        "safety_profile": result
    }


@router.post("/users/{user_id}/unmute")
async def unmute_user(
    user_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(require_moderator)
):
    """Unmute a user."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    success = await ContentReviewService.unmute_user(
        user_id=user_id,
        moderator_id=str(profile["id"]),
        reason=reason
    )

    return {"success": success}


@router.get("/users/{user_id}/moderation-history")
async def get_user_moderation_history(
    user_id: str,
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_moderator)
):
    """Get moderation history for a user."""
    history = await ContentReviewService.get_user_moderation_history(
        user_id=user_id,
        limit=limit
    )

    safety = await ContentReviewService.get_user_safety_profile(user_id)

    return {
        "user_id": user_id,
        "safety_profile": safety,
        "events": history
    }


@router.get("/users/{user_id}/safety-profile")
async def get_user_safety_profile(
    user_id: str,
    current_user: dict = Depends(require_moderator)
):
    """Get a user's safety profile and trust score."""
    profile = await ContentReviewService.get_user_safety_profile(user_id)

    return {"safety_profile": profile}


# =============================================================================
# Content Moderation (Hide/Restore)
# =============================================================================

@router.post("/content/hide")
async def hide_content(
    request: HideContentRequest,
    current_user: dict = Depends(require_moderator)
):
    """Hide a thread or reply from public view."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    success = await ContentReviewService.hide_content(
        content_type=request.content_type,
        content_id=request.content_id,
        moderator_id=str(profile["id"]),
        reason=request.reason
    )

    if not success:
        raise HTTPException(400, "Could not hide content")

    return {"success": True, "message": "Content hidden"}


@router.post("/content/{content_type}/{content_id}/restore")
async def restore_content(
    content_type: str,
    content_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(require_moderator)
):
    """Restore hidden content."""
    if content_type not in ['thread', 'reply']:
        raise HTTPException(400, "Invalid content type")

    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    success = await ContentReviewService.restore_content(
        content_type=content_type,
        content_id=content_id,
        moderator_id=str(profile["id"]),
        reason=reason
    )

    if not success:
        raise HTTPException(400, "Could not restore content")

    return {"success": True, "message": "Content restored"}


# =============================================================================
# Dashboard/Stats
# =============================================================================

@router.get("/stats")
async def get_moderation_stats(
    current_user: dict = Depends(require_moderator)
):
    """Get moderation dashboard statistics."""
    from app.core.database import execute_query

    # Pending reviews by status
    review_stats = execute_query("""
        SELECT status, COUNT(*) as count
        FROM content_review_tasks
        WHERE status IN ('pending', 'under_review', 'needs_changes', 'resubmitted')
        GROUP BY status
    """, {})

    # Open flags by severity
    flag_stats = execute_query("""
        SELECT severity, COUNT(*) as count
        FROM content_flags
        WHERE status = 'open'
        GROUP BY severity
    """, {})

    # Recent moderation actions (last 7 days)
    recent_actions = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE action = 'content_hidden') as hidden_count,
            COUNT(*) FILTER (WHERE action = 'user_warned') as warnings_count,
            COUNT(*) FILTER (WHERE action = 'user_muted') as mutes_count,
            COUNT(*) FILTER (WHERE action = 'flag_resolved') as flags_resolved
        FROM moderation_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
    """, {})

    return {
        "review_queue": {s["status"]: s["count"] for s in review_stats},
        "open_flags": {s["severity"]: s["count"] for s in flag_stats},
        "recent_actions": dict(recent_actions) if recent_actions else {},
        "generated_at": datetime.utcnow().isoformat()
    }
