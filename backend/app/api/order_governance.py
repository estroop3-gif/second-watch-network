"""
Order Governance API
Phase 6A: Order funds, governance cycles, voting, and transparency.

Provides:
- Fund listing and transparency
- Governance cycle management
- Proposal creation and voting
- Allocation requests
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.core.permissions import Permission, require_permissions
from app.services.order_governance_service import (
    OrderGovernanceService, FundType, FundSourceType,
    AllocationTargetType, ProposalType
)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateFundRequest(BaseModel):
    """Request to create a fund."""
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=50)
    fund_type: str
    description: Optional[str] = None
    lodge_id: Optional[str] = None
    requires_vote_for_allocation: bool = False
    min_allocation_for_vote_cents: int = 50000


class RecordInflowRequest(BaseModel):
    """Request to record a fund inflow."""
    amount_cents: int = Field(..., gt=0)
    source_type: str
    source_reference_type: Optional[str] = None
    source_reference_id: Optional[str] = None
    description: Optional[str] = None


class RequestAllocationRequest(BaseModel):
    """Request to allocate funds."""
    fund_id: str
    target_type: str
    amount_cents: int = Field(..., gt=0)
    target_id: Optional[str] = None
    target_description: Optional[str] = Field(None, max_length=500)


class CreateCycleRequest(BaseModel):
    """Request to create a governance cycle."""
    name: str = Field(..., max_length=200)
    cycle_type: str
    voting_start: datetime
    voting_end: datetime
    description: Optional[str] = None
    lodge_id: Optional[str] = None
    craft_house_id: Optional[str] = None
    nominations_start: Optional[datetime] = None
    nominations_end: Optional[datetime] = None
    quorum_percentage: int = Field(25, ge=0, le=100)
    approval_threshold_percentage: int = Field(50, ge=0, le=100)
    allow_weighted_votes: bool = False
    weight_by: Optional[str] = None
    min_membership_days: int = 30


class CreateProposalRequest(BaseModel):
    """Request to create a proposal."""
    cycle_id: str
    proposal_type: str
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=5000)
    target_fund_id: Optional[str] = None
    requested_amount_cents: Optional[int] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    target_description: Optional[str] = Field(None, max_length=500)
    nominee_id: Optional[str] = None
    position_type: Optional[str] = None
    supporting_materials: Optional[List[str]] = None


class CastVoteRequest(BaseModel):
    """Request to cast a vote."""
    vote_value: str = Field(..., description="for, against, or abstain")
    comment: Optional[str] = Field(None, max_length=1000)
    comment_is_public: bool = False


class ReviewProposalRequest(BaseModel):
    """Request to review a proposal."""
    approved: bool
    review_notes: Optional[str] = Field(None, max_length=1000)


class ApproveAllocationRequest(BaseModel):
    """Request to approve an allocation."""
    decision_notes: Optional[str] = Field(None, max_length=1000)


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(user: dict) -> str:
    """Get profile ID from Cognito user."""
    from app.api.users import get_profile_id_from_cognito_id
    return await get_profile_id_from_cognito_id(user["sub"])


async def verify_order_member(profile_id: str) -> dict:
    """Verify user is an Order member."""
    member = execute_single("""
        SELECT * FROM order_member_profiles
        WHERE user_id = :profile_id AND status = 'active'
    """, {"profile_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Active Order membership required")

    return dict(member)


async def verify_order_officer(profile_id: str) -> bool:
    """Verify user is an Order officer."""
    officer = execute_single("""
        SELECT 1 FROM order_governance_positions
        WHERE holder_id = :profile_id
          AND status = 'active'
          AND (end_date IS NULL OR end_date > NOW())
    """, {"profile_id": profile_id})

    return officer is not None


# =============================================================================
# Fund Endpoints (Public Transparency)
# =============================================================================

@router.get("/order/funds")
async def list_funds(
    lodge_id: Optional[str] = None,
    fund_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List Order funds.

    Any authenticated user can see fund summaries for transparency.
    """
    funds = await OrderGovernanceService.list_funds(
        lodge_id=lodge_id,
        fund_type=fund_type,
        active_only=True
    )

    return {"funds": funds}


@router.get("/order/funds/{fund_id}")
async def get_fund(
    fund_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get fund details."""
    fund = await OrderGovernanceService.get_fund(fund_id)

    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    return fund


@router.get("/order/funds/{fund_id}/flows")
async def get_fund_flows(
    fund_id: str,
    direction: Optional[str] = Query(None, description="inflow or outflow"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get fund flows (inflows and outflows)."""
    flows = await OrderGovernanceService.get_fund_flows(
        fund_id=fund_id,
        direction=direction,
        limit=limit,
        offset=offset
    )

    return {"fund_id": fund_id, "flows": flows}


@router.get("/order/funds/activity/recent")
async def get_recent_fund_activity(
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get recent fund activity across all funds."""
    activity = await OrderGovernanceService.get_recent_activity(limit=limit)

    return {"activity": activity}


# =============================================================================
# Fund Management (Officers Only)
# =============================================================================

@router.post("/order/funds")
async def create_fund(
    request: CreateFundRequest,
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Create a new Order fund.

    Requires Order officer role.
    """
    profile_id = await get_profile_id(current_user)

    result = await OrderGovernanceService.create_fund(
        name=request.name,
        slug=request.slug,
        fund_type=request.fund_type,
        description=request.description,
        lodge_id=request.lodge_id,
        requires_vote_for_allocation=request.requires_vote_for_allocation,
        min_allocation_for_vote_cents=request.min_allocation_for_vote_cents,
        created_by=profile_id
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/order/funds/{fund_id}/inflows")
async def record_fund_inflow(
    fund_id: str,
    request: RecordInflowRequest,
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Record an inflow to a fund.

    Requires Order officer role.
    """
    profile_id = await get_profile_id(current_user)

    result = await OrderGovernanceService.record_inflow(
        fund_id=fund_id,
        amount_cents=request.amount_cents,
        source_type=request.source_type,
        source_reference_type=request.source_reference_type,
        source_reference_id=request.source_reference_id,
        description=request.description,
        recorded_by=profile_id
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Allocation Endpoints
# =============================================================================

@router.get("/order/allocations")
async def list_allocations(
    fund_id: Optional[str] = None,
    status: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List fund allocations."""
    allocations = await OrderGovernanceService.get_allocations(
        fund_id=fund_id,
        status=status,
        target_type=target_type,
        limit=limit,
        offset=offset
    )

    return {"allocations": allocations}


@router.post("/order/allocations/request")
async def request_allocation(
    request: RequestAllocationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Request a fund allocation.

    Order members can request allocations. Large allocations may require voting.
    """
    profile_id = await get_profile_id(current_user)
    await verify_order_member(profile_id)

    result = await OrderGovernanceService.request_allocation(
        fund_id=request.fund_id,
        target_type=request.target_type,
        amount_cents=request.amount_cents,
        requested_by=profile_id,
        target_id=request.target_id,
        target_description=request.target_description
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/order/allocations/{allocation_id}/approve")
async def approve_allocation(
    allocation_id: str,
    request: ApproveAllocationRequest,
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Approve a pending allocation.

    Requires Order officer role.
    """
    profile_id = await get_profile_id(current_user)

    result = await OrderGovernanceService.approve_allocation(
        allocation_id=allocation_id,
        approved_by=profile_id,
        decision_notes=request.decision_notes
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/order/allocations/{allocation_id}/disburse")
async def disburse_allocation(
    allocation_id: str,
    amount_cents: Optional[int] = Query(None, description="Partial disbursement amount"),
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Disburse funds for an approved allocation.

    Requires Order officer role.
    """
    profile_id = await get_profile_id(current_user)

    result = await OrderGovernanceService.disburse_allocation(
        allocation_id=allocation_id,
        disbursed_by=profile_id,
        amount_cents=amount_cents
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Governance Cycle Endpoints
# =============================================================================

@router.get("/order/governance/cycles")
async def list_governance_cycles(
    status: Optional[str] = None,
    cycle_type: Optional[str] = None,
    lodge_id: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List governance cycles."""
    cycles = await OrderGovernanceService.list_cycles(
        status=status,
        cycle_type=cycle_type,
        lodge_id=lodge_id,
        limit=limit,
        offset=offset
    )

    return {"cycles": cycles}


@router.get("/order/governance/cycles/{cycle_id}")
async def get_governance_cycle(
    cycle_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get governance cycle details."""
    cycle = await OrderGovernanceService.get_cycle(cycle_id)

    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    return cycle


@router.post("/order/governance/cycles")
async def create_governance_cycle(
    request: CreateCycleRequest,
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Create a governance cycle.

    Requires Order officer role.
    """
    profile_id = await get_profile_id(current_user)

    result = await OrderGovernanceService.create_governance_cycle(
        name=request.name,
        cycle_type=request.cycle_type,
        voting_start=request.voting_start,
        voting_end=request.voting_end,
        created_by=profile_id,
        description=request.description,
        lodge_id=request.lodge_id,
        craft_house_id=request.craft_house_id,
        nominations_start=request.nominations_start,
        nominations_end=request.nominations_end,
        quorum_percentage=request.quorum_percentage,
        approval_threshold_percentage=request.approval_threshold_percentage,
        allow_weighted_votes=request.allow_weighted_votes,
        weight_by=request.weight_by,
        min_membership_days=request.min_membership_days
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/order/governance/cycles/{cycle_id}/status")
async def update_cycle_status(
    cycle_id: str,
    status: str = Query(..., description="draft, nominations, voting, tallying, completed, cancelled"),
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Update governance cycle status.

    Requires Order officer role.
    """
    result = await OrderGovernanceService.update_cycle_status(cycle_id, status)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/order/governance/cycles/{cycle_id}/finalize")
async def finalize_governance_cycle(
    cycle_id: str,
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Finalize a governance cycle and determine outcomes.

    Requires Order officer role.
    """
    result = await OrderGovernanceService.finalize_cycle(cycle_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Proposal Endpoints
# =============================================================================

@router.get("/order/governance/proposals")
async def list_proposals(
    cycle_id: Optional[str] = None,
    status: Optional[str] = None,
    proposal_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List governance proposals."""
    proposals = await OrderGovernanceService.list_proposals(
        cycle_id=cycle_id,
        status=status,
        proposal_type=proposal_type,
        limit=limit,
        offset=offset
    )

    return {"proposals": proposals}


@router.get("/order/governance/proposals/my")
async def list_my_proposals(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List proposals I've submitted."""
    profile_id = await get_profile_id(current_user)

    proposals = await OrderGovernanceService.list_proposals(
        proposer_id=profile_id,
        limit=limit,
        offset=offset
    )

    return {"proposals": proposals}


@router.get("/order/governance/proposals/{proposal_id}")
async def get_proposal(
    proposal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get proposal details."""
    proposal = await OrderGovernanceService.get_proposal(proposal_id)

    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    return proposal


@router.post("/order/governance/proposals")
async def create_proposal(
    request: CreateProposalRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a governance proposal.

    Active Order members can submit proposals.
    """
    profile_id = await get_profile_id(current_user)
    await verify_order_member(profile_id)

    result = await OrderGovernanceService.create_proposal(
        cycle_id=request.cycle_id,
        proposer_id=profile_id,
        proposal_type=request.proposal_type,
        title=request.title,
        description=request.description,
        target_fund_id=request.target_fund_id,
        requested_amount_cents=request.requested_amount_cents,
        target_type=request.target_type,
        target_id=request.target_id,
        target_description=request.target_description,
        nominee_id=request.nominee_id,
        position_type=request.position_type,
        supporting_materials=request.supporting_materials
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/order/governance/proposals/{proposal_id}/review")
async def review_proposal(
    proposal_id: str,
    request: ReviewProposalRequest,
    current_user: dict = Depends(require_permissions(Permission.ORDER_OFFICER))
):
    """
    Review and approve/reject a proposal for voting.

    Requires Order officer role.
    """
    profile_id = await get_profile_id(current_user)

    result = await OrderGovernanceService.review_proposal(
        proposal_id=proposal_id,
        reviewed_by=profile_id,
        approved=request.approved,
        review_notes=request.review_notes
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Voting Endpoints
# =============================================================================

@router.post("/order/governance/proposals/{proposal_id}/vote")
async def cast_vote(
    proposal_id: str,
    request: CastVoteRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Cast a vote on a proposal.

    Eligible Order members can vote on approved proposals.
    """
    profile_id = await get_profile_id(current_user)
    await verify_order_member(profile_id)

    if request.vote_value not in ["for", "against", "abstain"]:
        raise HTTPException(status_code=400, detail="Invalid vote value")

    result = await OrderGovernanceService.cast_vote(
        proposal_id=proposal_id,
        member_id=profile_id,
        vote_value=request.vote_value,
        comment=request.comment,
        comment_is_public=request.comment_is_public
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/order/governance/proposals/{proposal_id}/my-vote")
async def get_my_vote(
    proposal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get my vote on a proposal."""
    profile_id = await get_profile_id(current_user)

    vote = await OrderGovernanceService.get_my_vote(proposal_id, profile_id)

    return {"vote": vote}


@router.get("/order/governance/proposals/{proposal_id}/votes")
async def get_proposal_votes(
    proposal_id: str,
    include_comments: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """Get vote summary for a proposal."""
    result = await OrderGovernanceService.get_proposal_votes(
        proposal_id=proposal_id,
        include_comments=include_comments
    )

    return result


# =============================================================================
# Transparency Dashboard
# =============================================================================

@router.get("/order/transparency")
async def get_transparency_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """
    Get Order transparency dashboard.

    Public view of funds, allocations, and governance outcomes.
    """
    dashboard = await OrderGovernanceService.get_transparency_dashboard()

    return dashboard


@router.get("/order/transparency/funds/{fund_slug}")
async def get_fund_transparency(
    fund_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed transparency view for a specific fund."""
    fund = await OrderGovernanceService.get_fund_by_slug(fund_slug)

    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    flows = await OrderGovernanceService.get_fund_flows(fund["id"], limit=100)
    allocations = await OrderGovernanceService.get_allocations(
        fund_id=fund["id"],
        status="disbursed",
        limit=50
    )

    return {
        "fund": fund,
        "recent_flows": flows,
        "recent_allocations": allocations
    }
