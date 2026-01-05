"""
Green Room API Routes - Project Development & Voting Arena
Uses Supabase for database operations.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.database import get_client
from app.core.auth import get_current_user, get_current_user_optional
from app.core.deps import (
    get_user_profile,
    get_user_profile_optional,
    require_admin,
    require_staff,
)
from app.core.roles import (
    is_staff,
    is_admin_or_higher,
)
from app.models.greenroom import (
    CycleStatus, ProjectStatus, PaymentStatus
)
from app.schemas.greenroom import (
    CycleCreate, CycleUpdate, CycleResponse, CycleStats,
    ProjectSubmit, ProjectUpdate, ProjectResponse, ProjectApproval,
    TicketPurchaseRequest, TicketPurchaseResponse, VotingTicketResponse,
    VoteCast, VoteResponse, CycleResults, ProjectResult, UserGreenRoomStats
)

router = APIRouter()


# ============ Helper Functions ============

def get_user_id(user) -> str:
    """Extract user ID from user object"""
    if isinstance(user, dict):
        return user.get("id", user.get("sub"))
    return getattr(user, "id", getattr(user, "sub", None))


def check_user_role(user, allowed_roles: List[str]) -> bool:
    """Check if user has required role"""
    if isinstance(user, dict):
        user_role = user.get("user_metadata", {}).get("role", "free")
    else:
        user_role = getattr(user, "user_metadata", {}).get("role", "free")
    return user_role in allowed_roles


def can_vote(user) -> bool:
    """Check if user can vote"""
    return check_user_role(user, ["premium", "filmmaker", "partner", "admin"])


def is_filmmaker(user) -> bool:
    """Check if user is filmmaker"""
    return check_user_role(user, ["filmmaker", "admin"])


def is_admin(user) -> bool:
    """Check if user is admin"""
    if isinstance(user, dict):
        user_metadata = user.get("user_metadata", {})
    else:
        user_metadata = getattr(user, "user_metadata", {})
    return user_metadata.get("role") == "admin" or user_metadata.get("is_moderator", False)


# ============ Public Endpoints (View Only) ============

@router.get("/cycles", response_model=List[CycleResponse])
async def list_cycles(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List all cycles (public)"""
    client = get_client()

    query = client.table("greenroom_cycles").select("*")

    if status:
        query = query.eq("status", status)

    query = query.order("start_date", desc=True).range(skip, skip + limit - 1)

    result = query.execute()

    if not result.data:
        return []

    # Add project counts for each cycle
    cycles = []
    for cycle_data in result.data:
        # Get project count
        project_result = client.table("greenroom_projects").select("id, vote_count", count="exact").eq("cycle_id", cycle_data["id"]).execute()

        cycle_data["project_count"] = project_result.count or 0
        cycle_data["total_votes"] = sum(p.get("vote_count", 0) for p in (project_result.data or []))

        cycles.append(CycleResponse(**cycle_data))

    return cycles


@router.get("/cycles/{cycle_id}", response_model=CycleResponse)
async def get_cycle(cycle_id: int):
    """Get cycle details (public)"""
    client = get_client()

    result = client.table("greenroom_cycles").select("*").eq("id", cycle_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    cycle_data = result.data

    # Get project count
    project_result = client.table("greenroom_projects").select("id, vote_count", count="exact").eq("cycle_id", cycle_id).execute()

    cycle_data["project_count"] = project_result.count or 0
    cycle_data["total_votes"] = sum(p.get("vote_count", 0) for p in (project_result.data or []))

    return CycleResponse(**cycle_data)


@router.get("/cycles/{cycle_id}/projects", response_model=List[ProjectResponse])
async def list_cycle_projects(
    cycle_id: int,
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sort_by: str = Query("votes", regex="^(votes|recent|title)$"),
    user = Depends(get_current_user_optional)
):
    """List projects in a cycle"""
    client = get_client()

    # Verify cycle exists
    cycle_result = client.table("greenroom_cycles").select("*").eq("id", cycle_id).single().execute()
    if not cycle_result.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Build query
    query = client.table("greenroom_projects").select("*").eq("cycle_id", cycle_id)

    # Only show approved projects to non-admins
    if not (user and is_admin(user)):
        query = query.eq("status", "approved")
    elif status:
        query = query.eq("status", status)

    # Sorting
    if sort_by == "votes":
        query = query.order("vote_count", desc=True)
    elif sort_by == "recent":
        query = query.order("created_at", desc=True)
    elif sort_by == "title":
        query = query.order("title")

    query = query.range(skip, skip + limit - 1)

    result = query.execute()

    if not result.data:
        return []

    # Get user's votes if authenticated
    user_votes = {}
    if user:
        user_id = get_user_id(user)
        votes_result = client.table("greenroom_votes").select("project_id, tickets_allocated").eq("user_id", user_id).eq("cycle_id", cycle_id).execute()
        user_votes = {v["project_id"]: v["tickets_allocated"] for v in (votes_result.data or [])}

    # Build response
    projects = []
    for project_data in result.data:
        project_data["user_vote_count"] = user_votes.get(project_data["id"], 0)
        projects.append(ProjectResponse(**project_data))

    return projects


# Note: This must come BEFORE /projects/{project_id} to avoid route conflicts
@router.get("/projects/my-projects", response_model=List[ProjectResponse])
async def get_my_projects(
    user = Depends(get_current_user)
):
    """Get filmmaker's submitted projects"""
    client = get_client()
    user_id = get_user_id(user)

    result = client.table("greenroom_projects").select("*").eq("filmmaker_id", user_id).order("created_at", desc=True).execute()

    return [ProjectResponse(**p) for p in (result.data or [])]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    user = Depends(get_current_user_optional)
):
    """Get project details"""
    client = get_client()

    result = client.table("greenroom_projects").select("*").eq("id", project_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project_data = result.data

    # Check permissions
    if project_data.get("status") != "approved":
        if not user:
            raise HTTPException(status_code=404, detail="Project not found")
        user_id = get_user_id(user)
        if project_data.get("filmmaker_id") != user_id and not is_admin(user):
            raise HTTPException(status_code=404, detail="Project not found")

    # Get user's vote if authenticated
    if user:
        user_id = get_user_id(user)
        vote_result = client.table("greenroom_votes").select("tickets_allocated").eq("user_id", user_id).eq("project_id", project_id).single().execute()
        project_data["user_vote_count"] = vote_result.data.get("tickets_allocated", 0) if vote_result.data else 0
    else:
        project_data["user_vote_count"] = 0

    return ProjectResponse(**project_data)


# ============ Authenticated User Endpoints ============

@router.get("/tickets/my-tickets")
async def get_my_tickets(
    user = Depends(get_current_user)
):
    """Get user's voting tickets by cycle"""
    client = get_client()
    user_id = get_user_id(user)

    result = client.table("greenroom_voting_tickets").select("*").eq("user_id", user_id).eq("payment_status", "completed").execute()

    if not result.data:
        return []

    # Return array of tickets with tickets_available calculated
    tickets = []
    for t in result.data:
        tickets.append({
            "id": t.get("id"),
            "user_id": t.get("user_id"),
            "cycle_id": t.get("cycle_id"),
            "tickets_purchased": t.get("tickets_purchased", 0),
            "tickets_used": t.get("tickets_used", 0),
            "tickets_available": t.get("tickets_purchased", 0) - t.get("tickets_used", 0),
            "payment_status": t.get("payment_status"),
            "created_at": t.get("created_at")
        })

    return tickets


@router.post("/tickets/purchase", response_model=TicketPurchaseResponse)
async def purchase_tickets(
    request: TicketPurchaseRequest,
    user = Depends(get_current_user)
):
    """Purchase voting tickets via Stripe"""
    client = get_client()
    user_id = get_user_id(user)

    # Verify cycle exists and is active
    cycle_result = client.table("greenroom_cycles").select("*").eq("id", request.cycle_id).single().execute()
    if not cycle_result.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    cycle = cycle_result.data
    if cycle.get("status") != "active":
        raise HTTPException(status_code=400, detail="Cycle is not active")

    # Check ticket limit
    existing_result = client.table("greenroom_voting_tickets").select("tickets_purchased").eq("user_id", user_id).eq("cycle_id", request.cycle_id).eq("payment_status", "completed").execute()

    total_purchased = sum(t.get("tickets_purchased", 0) for t in (existing_result.data or []))
    max_tickets = cycle.get("max_tickets_per_user", 100)

    if total_purchased + request.ticket_count > max_tickets:
        raise HTTPException(
            status_code=400,
            detail=f"Exceeds maximum {max_tickets} tickets per user"
        )

    # Calculate amount
    ticket_price = cycle.get("ticket_price", 1.0)
    amount = request.ticket_count * ticket_price

    # TODO: Create Stripe checkout session
    # For now, return placeholder

    # Create pending ticket record
    ticket_data = {
        "user_id": user_id,
        "cycle_id": request.cycle_id,
        "tickets_purchased": request.ticket_count,
        "tickets_used": 0,
        "payment_status": "pending",
        "amount_paid": amount,
    }

    client.table("greenroom_voting_tickets").insert(ticket_data).execute()

    return TicketPurchaseResponse(
        checkout_session_id="cs_test_placeholder",
        checkout_url="https://checkout.stripe.com/placeholder",
        amount=amount,
        ticket_count=request.ticket_count
    )


@router.post("/votes/cast", response_model=VoteResponse)
async def cast_vote(
    vote: VoteCast,
    user = Depends(get_current_user)
):
    """Cast vote on a project (final, cannot be changed)"""
    client = get_client()
    user_id = get_user_id(user)

    # Check if user can vote
    if not can_vote(user):
        raise HTTPException(
            status_code=403,
            detail="Only premium, filmmaker, and partner members can vote"
        )

    # Get project and verify it exists and is approved
    project_result = client.table("greenroom_projects").select("*").eq("id", vote.project_id).single().execute()
    if not project_result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_result.data
    if project.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Project is not approved for voting")

    cycle_id = project.get("cycle_id")

    # Get cycle and verify it's active
    cycle_result = client.table("greenroom_cycles").select("status").eq("id", cycle_id).single().execute()
    if not cycle_result.data or cycle_result.data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Voting cycle is not active")

    # Check if user already voted for this project
    existing_vote = client.table("greenroom_votes").select("id").eq("user_id", user_id).eq("project_id", vote.project_id).execute()

    if existing_vote.data:
        raise HTTPException(status_code=400, detail="You have already voted for this project. Votes are final.")

    # Check if user has enough tickets
    tickets_result = client.table("greenroom_voting_tickets").select("*").eq("user_id", user_id).eq("cycle_id", cycle_id).eq("payment_status", "completed").execute()

    total_available = sum(
        t.get("tickets_purchased", 0) - t.get("tickets_used", 0)
        for t in (tickets_result.data or [])
    )

    if total_available < vote.tickets_allocated:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient tickets. You have {total_available} available."
        )

    # Create vote
    vote_data = {
        "user_id": user_id,
        "project_id": vote.project_id,
        "cycle_id": cycle_id,
        "tickets_allocated": vote.tickets_allocated
    }

    vote_result = client.table("greenroom_votes").insert(vote_data).execute()

    # Update project vote count
    new_vote_count = project.get("vote_count", 0) + vote.tickets_allocated
    client.table("greenroom_projects").update({"vote_count": new_vote_count}).eq("id", vote.project_id).execute()

    # Update ticket usage
    remaining = vote.tickets_allocated
    for ticket in sorted(tickets_result.data or [], key=lambda t: t.get("created_at", "")):
        if remaining <= 0:
            break
        available = ticket.get("tickets_purchased", 0) - ticket.get("tickets_used", 0)
        to_use = min(available, remaining)
        new_used = ticket.get("tickets_used", 0) + to_use
        client.table("greenroom_voting_tickets").update({"tickets_used": new_used}).eq("id", ticket["id"]).execute()
        remaining -= to_use

    new_vote = vote_result.data[0] if vote_result.data else vote_data
    new_vote["project_title"] = project.get("title")

    return VoteResponse(**new_vote)


@router.get("/votes/my-votes", response_model=List[VoteResponse])
async def get_my_votes(
    cycle_id: Optional[int] = None,
    user = Depends(get_current_user)
):
    """Get user's votes"""
    client = get_client()
    user_id = get_user_id(user)

    query = client.table("greenroom_votes").select("*").eq("user_id", user_id)

    if cycle_id:
        query = query.eq("cycle_id", cycle_id)

    result = query.order("created_at", desc=True).execute()

    if not result.data:
        return []

    # Get project titles
    votes = []
    for vote_data in result.data:
        project_result = client.table("greenroom_projects").select("title").eq("id", vote_data["project_id"]).single().execute()
        vote_data["project_title"] = project_result.data.get("title") if project_result.data else None
        votes.append(VoteResponse(**vote_data))

    return votes


@router.get("/stats/my-stats", response_model=UserGreenRoomStats)
async def get_my_stats(
    user = Depends(get_current_user)
):
    """Get user's Green Room statistics"""
    client = get_client()
    user_id = get_user_id(user)

    # Get ticket stats
    tickets_result = client.table("greenroom_voting_tickets").select("tickets_purchased, tickets_used").eq("user_id", user_id).eq("payment_status", "completed").execute()

    total_purchased = sum(t.get("tickets_purchased", 0) for t in (tickets_result.data or []))
    total_used = sum(t.get("tickets_used", 0) for t in (tickets_result.data or []))

    # Get vote count
    votes_result = client.table("greenroom_votes").select("id", count="exact").eq("user_id", user_id).execute()
    vote_count = votes_result.count or 0

    # Get project stats
    projects_result = client.table("greenroom_projects").select("status").eq("filmmaker_id", user_id).execute()

    projects_submitted = len(projects_result.data or [])
    projects_approved = sum(1 for p in (projects_result.data or []) if p.get("status") == "approved")

    return UserGreenRoomStats(
        total_tickets_purchased=total_purchased,
        total_tickets_used=total_used,
        total_votes_cast=vote_count,
        projects_submitted=projects_submitted,
        projects_approved=projects_approved
    )


# ============ Filmmaker Endpoints ============

@router.post("/projects/submit", response_model=ProjectResponse)
async def submit_project(
    project: ProjectSubmit,
    user = Depends(get_current_user)
):
    """Submit a project to Green Room"""
    client = get_client()
    user_id = get_user_id(user)

    # Check if user is filmmaker
    if not is_filmmaker(user):
        raise HTTPException(status_code=403, detail="Only filmmakers can submit projects")

    # Verify cycle exists
    cycle_result = client.table("greenroom_cycles").select("status").eq("id", project.cycle_id).single().execute()
    if not cycle_result.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Check if cycle is active or upcoming
    if cycle_result.data.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Cannot submit to closed cycle")

    # Create project
    project_data = {
        "cycle_id": project.cycle_id,
        "filmmaker_id": user_id,
        "title": project.title,
        "description": project.description,
        "category": project.category,
        "video_url": str(project.video_url) if project.video_url else None,
        "image_url": str(project.image_url) if project.image_url else None,
        "status": "pending",
        "vote_count": 0
    }

    result = client.table("greenroom_projects").insert(project_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create project")

    return ProjectResponse(**result.data[0])


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    update: ProjectUpdate,
    user = Depends(get_current_user)
):
    """Update project (only if pending)"""
    client = get_client()
    user_id = get_user_id(user)

    # Get project
    result = client.table("greenroom_projects").select("*").eq("id", project_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = result.data

    # Check ownership
    if project.get("filmmaker_id") != user_id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Can only update pending projects
    if project.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Can only update pending projects")

    # Update fields
    update_data = update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    update_result = client.table("greenroom_projects").update(update_data).eq("id", project_id).execute()

    return ProjectResponse(**update_result.data[0])


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    user = Depends(get_current_user)
):
    """Delete project (only if pending)"""
    client = get_client()
    user_id = get_user_id(user)

    # Get project
    result = client.table("greenroom_projects").select("*").eq("id", project_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = result.data

    # Check ownership
    if project.get("filmmaker_id") != user_id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Can only delete pending projects
    if project.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Can only delete pending projects")

    client.table("greenroom_projects").delete().eq("id", project_id).execute()

    return {"message": "Project deleted successfully"}


# ============ Admin/Moderator Endpoints ============

@router.post("/cycles", response_model=CycleResponse)
async def create_cycle(
    cycle: CycleCreate,
    user = Depends(get_current_user)
):
    """Create new cycle (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    # Determine initial status
    status = "draft"

    cycle_data = {
        "name": cycle.name,
        "description": cycle.description,
        "status": status,
        "current_phase": "submission",
        "max_submissions_per_user": cycle.max_submissions_per_user,
        "tickets_per_user": cycle.tickets_per_user,
    }

    # Add optional date fields
    if cycle.submission_start:
        cycle_data["submission_start"] = cycle.submission_start.isoformat()
    if cycle.submission_end:
        cycle_data["submission_end"] = cycle.submission_end.isoformat()
    if cycle.voting_start:
        cycle_data["voting_start"] = cycle.voting_start.isoformat()
    if cycle.voting_end:
        cycle_data["voting_end"] = cycle.voting_end.isoformat()

    result = client.table("greenroom_cycles").insert(cycle_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create cycle")

    new_cycle = result.data[0]
    new_cycle["project_count"] = 0
    new_cycle["total_votes"] = 0

    return CycleResponse(**new_cycle)


@router.put("/cycles/{cycle_id}", response_model=CycleResponse)
async def update_cycle(
    cycle_id: int,
    update: CycleUpdate,
    user = Depends(get_current_user)
):
    """Update cycle (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    # Verify cycle exists
    existing = client.table("greenroom_cycles").select("*").eq("id", cycle_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Update fields
    update_data = update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    # Convert datetime fields to ISO format
    if "submission_start" in update_data and update_data["submission_start"]:
        update_data["submission_start"] = update_data["submission_start"].isoformat()
    if "submission_end" in update_data and update_data["submission_end"]:
        update_data["submission_end"] = update_data["submission_end"].isoformat()
    if "voting_start" in update_data and update_data["voting_start"]:
        update_data["voting_start"] = update_data["voting_start"].isoformat()
    if "voting_end" in update_data and update_data["voting_end"]:
        update_data["voting_end"] = update_data["voting_end"].isoformat()

    result = client.table("greenroom_cycles").update(update_data).eq("id", cycle_id).execute()

    cycle_data = result.data[0]

    # Get project count
    project_result = client.table("greenroom_projects").select("id, vote_count", count="exact").eq("cycle_id", cycle_id).execute()
    cycle_data["project_count"] = project_result.count or 0
    cycle_data["total_votes"] = sum(p.get("vote_count", 0) for p in (project_result.data or []))

    return CycleResponse(**cycle_data)


@router.delete("/cycles/{cycle_id}")
async def delete_cycle(
    cycle_id: int,
    user = Depends(get_current_user)
):
    """Delete cycle (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    # Verify cycle exists
    existing = client.table("greenroom_cycles").select("*").eq("id", cycle_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Check if cycle has votes
    votes_result = client.table("greenroom_votes").select("id", count="exact").eq("cycle_id", cycle_id).execute()
    if votes_result.count and votes_result.count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete cycle with existing votes")

    client.table("greenroom_cycles").delete().eq("id", cycle_id).execute()

    return {"message": "Cycle deleted successfully"}


@router.put("/projects/{project_id}/approve", response_model=ProjectResponse)
async def approve_project(
    project_id: int,
    approval: ProjectApproval,
    user = Depends(get_current_user)
):
    """Approve or reject project (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()
    user_id = get_user_id(user)

    # Verify project exists
    existing = client.table("greenroom_projects").select("*").eq("id", project_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if approval.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    update_data = {
        "status": approval.status,
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": user_id,
        "updated_at": datetime.utcnow().isoformat()
    }

    result = client.table("greenroom_projects").update(update_data).eq("id", project_id).execute()

    return ProjectResponse(**result.data[0])


@router.get("/cycles/{cycle_id}/results", response_model=CycleResults)
async def get_cycle_results(
    cycle_id: int
):
    """Get cycle voting results (public after cycle ends)"""
    client = get_client()

    # Verify cycle exists
    cycle_result = client.table("greenroom_cycles").select("*").eq("id", cycle_id).single().execute()
    if not cycle_result.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    cycle = cycle_result.data

    # Get all approved projects with votes, ordered by vote count
    projects_result = client.table("greenroom_projects").select("*").eq("cycle_id", cycle_id).eq("status", "approved").order("vote_count", desc=True).execute()

    # Get unique voters count
    votes_result = client.table("greenroom_votes").select("user_id").eq("cycle_id", cycle_id).execute()
    unique_voters = len(set(v.get("user_id") for v in (votes_result.data or [])))

    # Build project results
    project_results = []
    for rank, project in enumerate((projects_result.data or []), 1):
        project_results.append(ProjectResult(
            project_id=project["id"],
            title=project["title"],
            filmmaker_id=project["filmmaker_id"],
            vote_count=project.get("vote_count", 0),
            rank=rank
        ))

    total_votes = sum(p.get("vote_count", 0) for p in (projects_result.data or []))

    return CycleResults(
        cycle_id=cycle["id"],
        cycle_name=cycle["name"],
        status=cycle["status"],
        total_projects=len(projects_result.data or []),
        total_votes=total_votes,
        total_voters=unique_voters,
        projects=project_results
    )


@router.get("/cycles/{cycle_id}/stats", response_model=CycleStats)
async def get_cycle_stats(
    cycle_id: int,
    user = Depends(get_current_user)
):
    """Get cycle statistics (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    # Verify cycle exists
    cycle_result = client.table("greenroom_cycles").select("*").eq("id", cycle_id).single().execute()
    if not cycle_result.data:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Get project counts by status
    projects_result = client.table("greenroom_projects").select("status").eq("cycle_id", cycle_id).execute()
    projects = projects_result.data or []

    approved = sum(1 for p in projects if p.get("status") == "approved")
    pending = sum(1 for p in projects if p.get("status") == "pending")
    rejected = sum(1 for p in projects if p.get("status") == "rejected")

    # Get ticket and vote stats
    tickets_result = client.table("greenroom_voting_tickets").select("tickets_purchased, amount_paid").eq("cycle_id", cycle_id).eq("payment_status", "completed").execute()
    tickets = tickets_result.data or []

    total_tickets_sold = sum(t.get("tickets_purchased", 0) for t in tickets)
    revenue = sum(t.get("amount_paid", 0) for t in tickets)

    # Get vote stats
    votes_result = client.table("greenroom_votes").select("user_id").eq("cycle_id", cycle_id).execute()
    votes = votes_result.data or []
    unique_voters = len(set(v.get("user_id") for v in votes))

    return CycleStats(
        cycle_id=cycle_id,
        total_projects=len(projects),
        approved_projects=approved,
        pending_projects=pending,
        rejected_projects=rejected,
        total_tickets_sold=total_tickets_sold,
        total_votes_cast=len(votes),
        unique_voters=unique_voters,
        revenue=revenue
    )


# ============ Additional Admin Endpoints ============

@router.put("/admin/projects/{project_id}/status")
async def admin_update_project_status(
    project_id: int,
    status: str = Query(..., regex="^(pending|approved|shortlisted|rejected|flagged)$"),
    user = Depends(get_current_user)
):
    """Update project status (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()
    user_id = get_user_id(user)

    # Verify project exists
    existing = client.table("greenroom_projects").select("id").eq("id", project_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = {
        "status": status,
        "updated_at": datetime.utcnow().isoformat()
    }

    if status == "approved":
        update_data["approved_at"] = datetime.utcnow().isoformat()
        update_data["approved_by"] = user_id

    client.table("greenroom_projects").update(update_data).eq("id", project_id).execute()

    return {"message": f"Project status updated to {status}"}


@router.put("/admin/projects/{project_id}/featured")
async def admin_toggle_featured(
    project_id: int,
    is_featured: bool = Query(False),
    is_staff_pick: bool = Query(False),
    user = Depends(get_current_user)
):
    """Toggle project featured status (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    update_data = {
        "is_featured": is_featured,
        "is_staff_pick": is_staff_pick,
        "updated_at": datetime.utcnow().isoformat()
    }

    client.table("greenroom_projects").update(update_data).eq("id", project_id).execute()

    return {"message": "Featured status updated"}


@router.put("/admin/projects/{project_id}/suspend")
async def admin_suspend_project(
    project_id: int,
    suspended: bool = Query(True),
    reason: Optional[str] = Query(None),
    user = Depends(get_current_user)
):
    """Suspend or unsuspend a project (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    update_data = {
        "is_suspended": suspended,
        "updated_at": datetime.utcnow().isoformat()
    }

    if reason:
        update_data["admin_notes"] = reason

    if not suspended:
        update_data["status"] = "approved"

    client.table("greenroom_projects").update(update_data).eq("id", project_id).execute()

    return {"message": f"Project {'suspended' if suspended else 'restored'}"}


@router.put("/admin/projects/{project_id}/notes")
async def admin_update_notes(
    project_id: int,
    notes: str = Query(""),
    user = Depends(get_current_user)
):
    """Update admin notes on a project (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    update_data = {
        "admin_notes": notes,
        "updated_at": datetime.utcnow().isoformat()
    }

    client.table("greenroom_projects").update(update_data).eq("id", project_id).execute()

    return {"message": "Notes updated"}


@router.post("/admin/tickets/adjust")
async def admin_adjust_tickets(
    user_id: str,
    cycle_id: int,
    tickets_to_add: int,
    reason: Optional[str] = None,
    admin = Depends(get_current_user)
):
    """Adjust user tickets (admin only)"""
    if not is_admin(admin):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    # Check if user already has tickets for this cycle
    existing = client.table("greenroom_voting_tickets").select("*").eq("user_id", user_id).eq("cycle_id", cycle_id).single().execute()

    if existing.data:
        # Update existing
        current_remaining = existing.data.get("tickets_remaining", 0)
        new_remaining = max(0, current_remaining + tickets_to_add)

        client.table("greenroom_voting_tickets").update({
            "tickets_remaining": new_remaining,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", existing.data["id"]).execute()

        return {"message": f"Tickets adjusted. New balance: {new_remaining}"}
    else:
        # Create new ticket record
        if tickets_to_add <= 0:
            raise HTTPException(status_code=400, detail="Cannot create negative ticket balance")

        client.table("greenroom_voting_tickets").insert({
            "user_id": user_id,
            "cycle_id": cycle_id,
            "tickets_remaining": tickets_to_add,
            "tickets_used": 0,
            "payment_status": "completed",
            "amount_paid": 0,  # Admin-granted tickets are free
        }).execute()

        return {"message": f"Created {tickets_to_add} tickets for user"}


@router.put("/admin/cycles/{cycle_id}/phase")
async def admin_update_cycle_phase(
    cycle_id: int,
    phase: str = Query(..., regex="^(submission|shortlisting|voting|winner|development)$"),
    user = Depends(get_current_user)
):
    """Update cycle phase (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    # Also update status based on phase
    status = "active"
    if phase == "voting":
        status = "voting"
    elif phase in ["winner", "development"]:
        status = "completed"

    update_data = {
        "current_phase": phase,
        "status": status,
        "updated_at": datetime.utcnow().isoformat()
    }

    client.table("greenroom_cycles").update(update_data).eq("id", cycle_id).execute()

    return {"message": f"Cycle phase updated to {phase}"}


@router.get("/admin/export/{data_type}")
async def admin_export_data(
    data_type: str,
    cycle_id: Optional[int] = None,
    user = Depends(get_current_user)
):
    """Export Green Room data (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_client()

    if data_type == "cycles":
        result = client.table("greenroom_cycles").select("*").order("created_at", desc=True).execute()
    elif data_type == "projects":
        query = client.table("greenroom_projects").select("*")
        if cycle_id:
            query = query.eq("cycle_id", cycle_id)
        result = query.order("created_at", desc=True).execute()
    elif data_type == "votes":
        query = client.table("greenroom_votes").select("*")
        if cycle_id:
            query = query.eq("cycle_id", cycle_id)
        result = query.order("created_at", desc=True).execute()
    elif data_type == "tickets":
        query = client.table("greenroom_voting_tickets").select("*")
        if cycle_id:
            query = query.eq("cycle_id", cycle_id)
        result = query.order("created_at", desc=True).execute()
    else:
        raise HTTPException(status_code=400, detail="Invalid data type. Use: cycles, projects, votes, or tickets")

    return {"data": result.data or [], "count": len(result.data or [])}
