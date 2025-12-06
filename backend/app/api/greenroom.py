"""
Green Room API Routes - Project Development & Voting Arena
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlmodel import Session, select, func, and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.supabase import get_supabase_client
from app.core.auth import get_current_user, get_current_user_optional
from app.core.deps import (
    get_user_profile,
    get_user_profile_optional,
    require_admin,
    require_staff,
    require_filmmaker,
    require_greenroom_voter,
)
from app.core.roles import (
    is_staff,
    is_admin_or_higher,
    can_submit_to_greenroom,
    can_vote_in_greenroom,
)
from app.models.greenroom import (
    Cycle, Project, VotingTicket, Vote,
    CycleStatus, ProjectStatus, PaymentStatus
)
from app.schemas.greenroom import (
    CycleCreate, CycleUpdate, CycleResponse, CycleStats,
    ProjectSubmit, ProjectUpdate, ProjectResponse, ProjectApproval,
    TicketPurchaseRequest, TicketPurchaseResponse, VotingTicketResponse,
    VoteCast, VoteResponse, CycleResults, ProjectResult, UserGreenRoomStats
)

router = APIRouter()

# TODO: Add database session dependency
# For now, using placeholder - replace with actual DB session
def get_session():
    """Get database session - PLACEHOLDER"""
    # This should be replaced with actual database session
    raise HTTPException(status_code=501, detail="Database session not configured")


# ============ Legacy Helper Functions (for backwards compatibility) ============
# These are deprecated - use the new role system from app.core.roles instead

def check_user_role(user, allowed_roles: List[str]) -> bool:
    """DEPRECATED: Check if user has required role. Use app.core.roles instead."""
    user_role = user.get("user_metadata", {}).get("role", "free")
    return user_role in allowed_roles


def can_vote(user) -> bool:
    """DEPRECATED: Check if user can vote. Use can_vote_in_greenroom() instead."""
    return check_user_role(user, ["premium", "filmmaker", "partner", "admin"])


def is_filmmaker(user) -> bool:
    """DEPRECATED: Check if user is filmmaker. Use can_submit_to_greenroom() instead."""
    return check_user_role(user, ["filmmaker", "admin"])


def is_admin(user) -> bool:
    """DEPRECATED: Check if user is admin. Use is_admin_or_higher() or is_staff() instead."""
    user_metadata = user.get("user_metadata", {})
    return user_metadata.get("role") == "admin" or user_metadata.get("is_moderator", False)


# ============ Public Endpoints (View Only) ============

@router.get("/cycles", response_model=List[CycleResponse])
async def list_cycles(
    status: Optional[CycleStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session)
):
    """List all cycles (public)"""
    query = select(Cycle).offset(skip).limit(limit).order_by(Cycle.start_date.desc())

    if status:
        query = query.where(Cycle.status == status)

    cycles = session.exec(query).all()

    # Add project counts
    result = []
    for cycle in cycles:
        cycle_dict = cycle.dict()
        cycle_dict["project_count"] = len(cycle.projects)
        cycle_dict["total_votes"] = sum(p.vote_count for p in cycle.projects)
        result.append(CycleResponse(**cycle_dict))

    return result


@router.get("/cycles/{cycle_id}", response_model=CycleResponse)
async def get_cycle(cycle_id: int, session: Session = Depends(get_session)):
    """Get cycle details (public)"""
    cycle = session.get(Cycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    cycle_dict = cycle.dict()
    cycle_dict["project_count"] = len(cycle.projects)
    cycle_dict["total_votes"] = sum(p.vote_count for p in cycle.projects)

    return CycleResponse(**cycle_dict)


@router.get("/cycles/{cycle_id}/projects", response_model=List[ProjectResponse])
async def list_cycle_projects(
    cycle_id: int,
    status: Optional[ProjectStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sort_by: str = Query("votes", regex="^(votes|recent|title)$"),
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """List projects in a cycle"""
    # Verify cycle exists
    cycle = session.get(Cycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Build query
    query = select(Project).where(Project.cycle_id == cycle_id)

    # Only show approved projects to non-admins
    if not (user and is_admin(user)):
        query = query.where(Project.status == ProjectStatus.APPROVED)
    elif status:
        query = query.where(Project.status == status)

    # Sorting
    if sort_by == "votes":
        query = query.order_by(Project.vote_count.desc())
    elif sort_by == "recent":
        query = query.order_by(Project.created_at.desc())
    elif sort_by == "title":
        query = query.order_by(Project.title)

    query = query.offset(skip).limit(limit)

    projects = session.exec(query).all()

    # Get user's votes if authenticated
    user_votes = {}
    if user:
        user_id = user.get("id")
        votes_query = select(Vote).where(
            and_(Vote.user_id == user_id, Vote.cycle_id == cycle_id)
        )
        votes = session.exec(votes_query).all()
        user_votes = {v.project_id: v.tickets_allocated for v in votes}

    # Build response
    result = []
    for project in projects:
        project_dict = project.dict()
        project_dict["user_vote_count"] = user_votes.get(project.id, 0)
        # TODO: Add filmmaker name from User table
        result.append(ProjectResponse(**project_dict))

    return result


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get project details"""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check permissions
    if project.status != ProjectStatus.APPROVED:
        if not user:
            raise HTTPException(status_code=404, detail="Project not found")
        user_id = user.get("id")
        if project.filmmaker_id != user_id and not is_admin(user):
            raise HTTPException(status_code=404, detail="Project not found")

    project_dict = project.dict()

    # Get user's vote if authenticated
    if user:
        user_id = user.get("id")
        vote = session.exec(
            select(Vote).where(
                and_(Vote.user_id == user_id, Vote.project_id == project_id)
            )
        ).first()
        project_dict["user_vote_count"] = vote.tickets_allocated if vote else 0

    return ProjectResponse(**project_dict)


# ============ Authenticated User Endpoints ============

@router.get("/tickets/my-tickets", response_model=List[VotingTicketResponse])
async def get_my_tickets(
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get user's voting tickets for all cycles"""
    user_id = user.get("id")

    tickets = session.exec(
        select(VotingTicket).where(VotingTicket.user_id == user_id).order_by(VotingTicket.created_at.desc())
    ).all()

    return [VotingTicketResponse(**t.dict(), tickets_available=t.tickets_available) for t in tickets]


@router.post("/tickets/purchase", response_model=TicketPurchaseResponse)
async def purchase_tickets(
    request: TicketPurchaseRequest,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Purchase voting tickets via Stripe"""
    user_id = user.get("id")

    # Verify cycle exists and is active
    cycle = session.get(Cycle, request.cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    if cycle.status != CycleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Cycle is not active")

    # Check ticket limit
    existing_tickets = session.exec(
        select(VotingTicket).where(
            and_(
                VotingTicket.user_id == user_id,
                VotingTicket.cycle_id == request.cycle_id,
                VotingTicket.payment_status == PaymentStatus.COMPLETED
            )
        )
    ).all()

    total_purchased = sum(t.tickets_purchased for t in existing_tickets)
    if total_purchased + request.ticket_count > cycle.max_tickets_per_user:
        raise HTTPException(
            status_code=400,
            detail=f"Exceeds maximum {cycle.max_tickets_per_user} tickets per user"
        )

    # Calculate amount
    amount = request.ticket_count * cycle.ticket_price

    # TODO: Create Stripe checkout session
    # For now, return placeholder
    # In production, this would create a Stripe session and return the session ID and URL

    # Create pending ticket record
    ticket = VotingTicket(
        user_id=user_id,
        cycle_id=request.cycle_id,
        tickets_purchased=request.ticket_count,
        tickets_used=0,
        payment_status=PaymentStatus.PENDING,
        amount_paid=amount,
        # stripe_session_id=stripe_session.id  # From Stripe
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)

    # Return Stripe checkout URL (placeholder for now)
    return TicketPurchaseResponse(
        checkout_session_id="cs_test_placeholder",
        checkout_url="https://checkout.stripe.com/placeholder",  # Real Stripe URL in production
        amount=amount,
        ticket_count=request.ticket_count
    )


@router.post("/votes/cast", response_model=VoteResponse)
async def cast_vote(
    vote: VoteCast,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Cast vote on a project (final, cannot be changed)"""
    user_id = user.get("id")

    # Check if user can vote
    if not can_vote(user):
        raise HTTPException(
            status_code=403,
            detail="Only premium, filmmaker, and partner members can vote"
        )

    # Get project and verify it exists and is approved
    project = session.get(Project, vote.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != ProjectStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Project is not approved for voting")

    # Get cycle and verify it's active
    cycle = session.get(Cycle, project.cycle_id)
    if cycle.status != CycleStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Voting cycle is not active")

    # Check if user already voted for this project
    existing_vote = session.exec(
        select(Vote).where(
            and_(
                Vote.user_id == user_id,
                Vote.project_id == vote.project_id,
                Vote.cycle_id == project.cycle_id
            )
        )
    ).first()

    if existing_vote:
        raise HTTPException(status_code=400, detail="You have already voted for this project. Votes are final.")

    # Check if user has enough tickets
    tickets = session.exec(
        select(VotingTicket).where(
            and_(
                VotingTicket.user_id == user_id,
                VotingTicket.cycle_id == project.cycle_id,
                VotingTicket.payment_status == PaymentStatus.COMPLETED
            )
        )
    ).all()

    total_available = sum(t.tickets_available for t in tickets)
    if total_available < vote.tickets_allocated:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient tickets. You have {total_available} available."
        )

    # Create vote
    new_vote = Vote(
        user_id=user_id,
        project_id=vote.project_id,
        cycle_id=project.cycle_id,
        tickets_allocated=vote.tickets_allocated
    )
    session.add(new_vote)

    # Update project vote count (denormalized for efficiency)
    project.vote_count += vote.tickets_allocated

    # Update ticket usage
    remaining = vote.tickets_allocated
    for ticket in sorted(tickets, key=lambda t: t.created_at):
        if remaining <= 0:
            break
        available = ticket.tickets_available
        to_use = min(available, remaining)
        ticket.tickets_used += to_use
        remaining -= to_use

    session.commit()
    session.refresh(new_vote)

    return VoteResponse(**new_vote.dict(), project_title=project.title)


@router.get("/votes/my-votes", response_model=List[VoteResponse])
async def get_my_votes(
    cycle_id: Optional[int] = None,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get user's votes"""
    user_id = user.get("id")

    query = select(Vote).where(Vote.user_id == user_id)
    if cycle_id:
        query = query.where(Vote.cycle_id == cycle_id)

    votes = session.exec(query.order_by(Vote.created_at.desc())).all()

    # Get project titles
    result = []
    for vote in votes:
        project = session.get(Project, vote.project_id)
        vote_dict = vote.dict()
        vote_dict["project_title"] = project.title if project else None
        result.append(VoteResponse(**vote_dict))

    return result


@router.get("/stats/my-stats", response_model=UserGreenRoomStats)
async def get_my_stats(
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get user's Green Room statistics"""
    user_id = user.get("id")

    # Get ticket stats
    tickets = session.exec(
        select(VotingTicket).where(
            and_(
                VotingTicket.user_id == user_id,
                VotingTicket.payment_status == PaymentStatus.COMPLETED
            )
        )
    ).all()

    total_purchased = sum(t.tickets_purchased for t in tickets)
    total_used = sum(t.tickets_used for t in tickets)

    # Get vote count
    vote_count = session.exec(
        select(func.count(Vote.id)).where(Vote.user_id == user_id)
    ).one()

    # Get project stats
    projects = session.exec(
        select(Project).where(Project.filmmaker_id == user_id)
    ).all()

    projects_submitted = len(projects)
    projects_approved = sum(1 for p in projects if p.status == ProjectStatus.APPROVED)

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
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Submit a project to Green Room"""
    user_id = user.get("id")

    # Check if user is filmmaker
    if not is_filmmaker(user):
        raise HTTPException(status_code=403, detail="Only filmmakers can submit projects")

    # Verify cycle exists
    cycle = session.get(Cycle, project.cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Check if cycle is active or upcoming
    if cycle.status == CycleStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot submit to closed cycle")

    # Create project
    new_project = Project(
        cycle_id=project.cycle_id,
        filmmaker_id=user_id,
        title=project.title,
        description=project.description,
        category=project.category,
        video_url=str(project.video_url) if project.video_url else None,
        image_url=str(project.image_url) if project.image_url else None,
        status=ProjectStatus.PENDING
    )

    session.add(new_project)
    session.commit()
    session.refresh(new_project)

    return ProjectResponse(**new_project.dict())


@router.get("/projects/my-projects", response_model=List[ProjectResponse])
async def get_my_projects(
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get filmmaker's submitted projects"""
    user_id = user.get("id")

    projects = session.exec(
        select(Project).where(Project.filmmaker_id == user_id).order_by(Project.created_at.desc())
    ).all()

    return [ProjectResponse(**p.dict()) for p in projects]


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    update: ProjectUpdate,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Update project (only if pending)"""
    user_id = user.get("id")

    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check ownership
    if project.filmmaker_id != user_id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Can only update pending projects
    if project.status != ProjectStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only update pending projects")

    # Update fields
    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    project.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(project)

    return ProjectResponse(**project.dict())


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Delete project (only if pending)"""
    user_id = user.get("id")

    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check ownership
    if project.filmmaker_id != user_id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Can only delete pending projects
    if project.status != ProjectStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only delete pending projects")

    session.delete(project)
    session.commit()

    return {"message": "Project deleted successfully"}


# ============ Admin/Moderator Endpoints ============

@router.post("/cycles", response_model=CycleResponse)
async def create_cycle(
    cycle: CycleCreate,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Create new cycle (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate dates
    if cycle.end_date <= cycle.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Determine status based on dates
    now = datetime.utcnow()
    if cycle.start_date > now:
        status = CycleStatus.UPCOMING
    elif cycle.end_date < now:
        status = CycleStatus.CLOSED
    else:
        status = CycleStatus.ACTIVE

    new_cycle = Cycle(
        **cycle.dict(),
        status=status
    )

    session.add(new_cycle)
    session.commit()
    session.refresh(new_cycle)

    return CycleResponse(**new_cycle.dict(), project_count=0, total_votes=0)


@router.put("/cycles/{cycle_id}", response_model=CycleResponse)
async def update_cycle(
    cycle_id: int,
    update: CycleUpdate,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Update cycle (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    cycle = session.get(Cycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Update fields
    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cycle, field, value)

    cycle.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(cycle)

    cycle_dict = cycle.dict()
    cycle_dict["project_count"] = len(cycle.projects)
    cycle_dict["total_votes"] = sum(p.vote_count for p in cycle.projects)

    return CycleResponse(**cycle_dict)


@router.delete("/cycles/{cycle_id}")
async def delete_cycle(
    cycle_id: int,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Delete cycle (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    cycle = session.get(Cycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Check if cycle has votes
    if cycle.votes:
        raise HTTPException(status_code=400, detail="Cannot delete cycle with existing votes")

    session.delete(cycle)
    session.commit()

    return {"message": "Cycle deleted successfully"}


@router.put("/projects/{project_id}/approve", response_model=ProjectResponse)
async def approve_project(
    project_id: int,
    approval: ProjectApproval,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Approve or reject project (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if approval.status not in [ProjectStatus.APPROVED, ProjectStatus.REJECTED]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    project.status = approval.status
    project.approved_at = datetime.utcnow()
    project.approved_by = user.get("id")
    project.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(project)

    return ProjectResponse(**project.dict())


@router.get("/cycles/{cycle_id}/results", response_model=CycleResults)
async def get_cycle_results(
    cycle_id: int,
    session: Session = Depends(get_session)
):
    """Get cycle voting results (public after cycle ends)"""
    cycle = session.get(Cycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Get all approved projects with votes
    projects = session.exec(
        select(Project).where(
            and_(
                Project.cycle_id == cycle_id,
                Project.status == ProjectStatus.APPROVED
            )
        ).order_by(Project.vote_count.desc())
    ).all()

    # Get total voters
    unique_voters = session.exec(
        select(func.count(func.distinct(Vote.user_id))).where(Vote.cycle_id == cycle_id)
    ).one()

    # Build project results
    project_results = []
    for rank, project in enumerate(projects, 1):
        project_results.append(ProjectResult(
            project_id=project.id,
            title=project.title,
            filmmaker_id=project.filmmaker_id,
            vote_count=project.vote_count,
            rank=rank
        ))

    total_votes = sum(p.vote_count for p in projects)

    return CycleResults(
        cycle_id=cycle.id,
        cycle_name=cycle.name,
        status=cycle.status,
        total_projects=len(projects),
        total_votes=total_votes,
        total_voters=unique_voters,
        projects=project_results
    )


@router.get("/cycles/{cycle_id}/stats", response_model=CycleStats)
async def get_cycle_stats(
    cycle_id: int,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Get cycle statistics (admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    cycle = session.get(Cycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    # Get project counts
    projects = cycle.projects
    approved = sum(1 for p in projects if p.status == ProjectStatus.APPROVED)
    pending = sum(1 for p in projects if p.status == ProjectStatus.PENDING)
    rejected = sum(1 for p in projects if p.status == ProjectStatus.REJECTED)

    # Get ticket and vote stats
    tickets = session.exec(
        select(VotingTicket).where(
            and_(
                VotingTicket.cycle_id == cycle_id,
                VotingTicket.payment_status == PaymentStatus.COMPLETED
            )
        )
    ).all()

    total_tickets_sold = sum(t.tickets_purchased for t in tickets)
    revenue = sum(t.amount_paid for t in tickets)

    votes = session.exec(select(Vote).where(Vote.cycle_id == cycle_id)).all()
    unique_voters = len(set(v.user_id for v in votes))

    return CycleStats(
        cycle_id=cycle.id,
        total_projects=len(projects),
        approved_projects=approved,
        pending_projects=pending,
        rejected_projects=rejected,
        total_tickets_sold=total_tickets_sold,
        total_votes_cast=len(votes),
        unique_voters=unique_voters,
        revenue=revenue
    )
