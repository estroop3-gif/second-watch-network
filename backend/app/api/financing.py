"""
Financing API
Phase 6B: Financing agreements, recoupment, and multi-party splits.

Provides:
- Agreement management
- Party and waterfall configuration
- Settlement tracking
- Recoupment visibility
"""

from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.services.financing_service import FinancingService, AgreementStatus, PartyType, ShareType

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateAgreementRequest(BaseModel):
    """Request to create a financing agreement."""
    name: str = Field(..., max_length=200)
    world_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=2000)
    agreement_type: str = "production_financing"
    total_budget_cents: int = Field(0, ge=0)
    revenue_sources: Optional[List[str]] = None
    distribution_frequency: str = "monthly"
    minimum_distribution_cents: int = 10000


class AddPartyRequest(BaseModel):
    """Request to add a party to an agreement."""
    party_type: str
    party_id: str
    role: str = "contributor"
    party_name: Optional[str] = None
    contribution_cents: int = Field(0, ge=0)
    contribution_type: Optional[str] = None
    contribution_description: Optional[str] = Field(None, max_length=500)


class AddTermRequest(BaseModel):
    """Request to add a waterfall term."""
    party_id: str
    recoupment_order: int = Field(..., ge=1)
    share_type: str
    share_value: float = Field(..., ge=0)
    recoup_target_cents: Optional[int] = Field(None, ge=0)
    cap_cents: Optional[int] = Field(None, ge=0)
    cap_multiplier: Optional[float] = Field(None, ge=0)
    description: Optional[str] = Field(None, max_length=500)


class CreateFromTemplateRequest(BaseModel):
    """Request to create agreement from template."""
    template_id: str
    world_id: str
    name: str = Field(..., max_length=200)
    party_mappings: dict  # {"role": {"party_type": "...", "party_id": "...", "contribution_cents": ...}}


class CreateSettlementRequest(BaseModel):
    """Request to create a settlement."""
    period_start: date
    period_end: date
    gross_revenue_cents: int = Field(..., gt=0)
    platform_fees_cents: int = Field(0, ge=0)
    world_earning_id: Optional[str] = None


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(user: dict) -> str:
    """Get profile ID from Cognito user."""
    from app.api.users import get_profile_id_from_cognito_id
    return await get_profile_id_from_cognito_id(user["sub"])


async def verify_agreement_access(
    agreement_id: str,
    profile_id: str,
    require_owner: bool = False
) -> dict:
    """Verify user has access to the agreement."""
    agreement = execute_single("""
        SELECT fa.*,
               w.creator_id as world_creator_id,
               w.organization_id as world_org_id
        FROM financing_agreements fa
        LEFT JOIN worlds w ON fa.world_id = w.id
        WHERE fa.id = :agreement_id
    """, {"agreement_id": agreement_id})

    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    # Check if user is world creator
    is_creator = str(agreement.get("world_creator_id")) == profile_id

    # Check if user is org member
    is_org_member = False
    if agreement.get("world_org_id"):
        org_member = execute_single("""
            SELECT 1 FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
        """, {"org_id": agreement["world_org_id"], "user_id": profile_id})
        is_org_member = org_member is not None

    # Check if user is a party to the agreement
    is_party = execute_single("""
        SELECT 1 FROM financing_parties
        WHERE agreement_id = :agreement_id AND party_id = :profile_id
    """, {"agreement_id": agreement_id, "profile_id": profile_id}) is not None

    if require_owner and not (is_creator or is_org_member):
        raise HTTPException(status_code=403, detail="Not authorized to manage this agreement")

    if not (is_creator or is_org_member or is_party):
        raise HTTPException(status_code=403, detail="Not authorized to view this agreement")

    return dict(agreement)


# =============================================================================
# Agreement Endpoints
# =============================================================================

@router.get("/financing/agreements")
async def list_agreements(
    status: Optional[str] = None,
    world_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List financing agreements the user is party to."""
    profile_id = await get_profile_id(current_user)

    agreements = await FinancingService.list_agreements(
        status=status,
        world_id=world_id,
        party_id=profile_id,
        party_type=PartyType.CREATOR,
        limit=limit,
        offset=offset
    )

    # Also include agreements for user's organizations
    org_ids = execute_query("""
        SELECT organization_id FROM organization_members
        WHERE user_id = :user_id AND status = 'active'
    """, {"user_id": profile_id})

    for org in org_ids:
        org_agreements = await FinancingService.list_agreements(
            party_id=str(org["organization_id"]),
            party_type=PartyType.ORGANIZATION,
            limit=limit
        )
        # Merge without duplicates
        existing_ids = {a["id"] for a in agreements}
        for a in org_agreements:
            if a["id"] not in existing_ids:
                agreements.append(a)

    return {"agreements": agreements}


@router.get("/financing/agreements/{agreement_id}")
async def get_agreement(
    agreement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get agreement details."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id)

    agreement = await FinancingService.get_agreement(agreement_id)

    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    # Get plain-English summary
    summary = await FinancingService.get_waterfall_summary(agreement_id)
    agreement["summary"] = summary

    return agreement


@router.post("/financing/agreements")
async def create_agreement(
    request: CreateAgreementRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new financing agreement."""
    profile_id = await get_profile_id(current_user)

    # Verify user owns the world or is in the org
    if request.world_id:
        world = execute_single("""
            SELECT creator_id, organization_id FROM worlds WHERE id = :id
        """, {"id": request.world_id})

        if not world:
            raise HTTPException(status_code=404, detail="World not found")

        is_creator = str(world["creator_id"]) == profile_id
        is_org_member = False

        if world["organization_id"]:
            org_member = execute_single("""
                SELECT 1 FROM organization_members
                WHERE organization_id = :org_id AND user_id = :user_id
                  AND role IN ('owner', 'admin', 'finance')
            """, {"org_id": world["organization_id"], "user_id": profile_id})
            is_org_member = org_member is not None

        if not (is_creator or is_org_member):
            raise HTTPException(status_code=403, detail="Not authorized")

    result = await FinancingService.create_agreement(
        name=request.name,
        created_by=profile_id,
        world_id=request.world_id,
        backlot_project_id=request.backlot_project_id,
        description=request.description,
        agreement_type=request.agreement_type,
        total_budget_cents=request.total_budget_cents,
        revenue_sources=request.revenue_sources,
        distribution_frequency=request.distribution_frequency,
        minimum_distribution_cents=request.minimum_distribution_cents
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/financing/agreements/{agreement_id}/activate")
async def activate_agreement(
    agreement_id: str,
    effective_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """Activate a financing agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id, require_owner=True)

    result = await FinancingService.update_agreement_status(
        agreement_id,
        AgreementStatus.ACTIVE,
        effective_date
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/financing/agreements/{agreement_id}/close")
async def close_agreement(
    agreement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Close a financing agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id, require_owner=True)

    result = await FinancingService.update_agreement_status(
        agreement_id,
        AgreementStatus.CLOSED
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Party Endpoints
# =============================================================================

@router.get("/financing/agreements/{agreement_id}/parties")
async def get_parties(
    agreement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get parties in an agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id)

    parties = await FinancingService.get_parties(agreement_id)

    return {"parties": parties}


@router.post("/financing/agreements/{agreement_id}/parties")
async def add_party(
    agreement_id: str,
    request: AddPartyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a party to an agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id, require_owner=True)

    result = await FinancingService.add_party(
        agreement_id=agreement_id,
        party_type=request.party_type,
        party_id=request.party_id,
        role=request.role,
        party_name=request.party_name,
        contribution_cents=request.contribution_cents,
        contribution_type=request.contribution_type,
        contribution_description=request.contribution_description
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/financing/parties/{party_id}/accept")
async def accept_party_invitation(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept party invitation (sign agreement)."""
    profile_id = await get_profile_id(current_user)

    # Verify user is the party being invited
    party = execute_single("""
        SELECT * FROM financing_parties WHERE id = :id
    """, {"id": party_id})

    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    if str(party["party_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Not your invitation")

    result = await FinancingService.accept_party_invitation(party_id, profile_id)

    return result


# =============================================================================
# Waterfall Endpoints
# =============================================================================

@router.get("/financing/agreements/{agreement_id}/waterfall")
async def get_waterfall(
    agreement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get waterfall terms for an agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id)

    waterfall = await FinancingService.get_waterfall(agreement_id)
    summary = await FinancingService.get_waterfall_summary(agreement_id)

    return {"waterfall": waterfall, "summary": summary}


@router.post("/financing/agreements/{agreement_id}/terms")
async def add_term(
    agreement_id: str,
    request: AddTermRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a waterfall term."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id, require_owner=True)

    # Validate share type
    valid_types = [ShareType.PERCENTAGE, ShareType.FIXED_RECOUP,
                   ShareType.PERCENTAGE_AFTER_RECOUP, ShareType.BONUS_POOL,
                   ShareType.FIRST_DOLLAR, ShareType.LAST_MONEY_OUT]
    if request.share_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid share type: {request.share_type}")

    result = await FinancingService.add_term(
        agreement_id=agreement_id,
        party_id=request.party_id,
        recoupment_order=request.recoupment_order,
        share_type=request.share_type,
        share_value=request.share_value,
        recoup_target_cents=request.recoup_target_cents,
        cap_cents=request.cap_cents,
        cap_multiplier=request.cap_multiplier,
        description=request.description
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Recoupment Endpoints
# =============================================================================

@router.get("/financing/agreements/{agreement_id}/recoupment")
async def get_recoupment_progress(
    agreement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get recoupment progress for an agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id)

    progress = await FinancingService.get_recoupment_progress(agreement_id)

    return progress


# =============================================================================
# Settlement Endpoints
# =============================================================================

@router.get("/financing/agreements/{agreement_id}/settlements")
async def get_settlements(
    agreement_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get settlements for an agreement."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id)

    settlements = await FinancingService.get_settlements(
        agreement_id=agreement_id,
        status=status,
        limit=limit,
        offset=offset
    )

    return {"settlements": settlements}


@router.get("/financing/settlements/{settlement_id}/items")
async def get_settlement_items(
    settlement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get line items for a settlement."""
    profile_id = await get_profile_id(current_user)

    # Get agreement ID from settlement
    settlement = execute_single("""
        SELECT agreement_id FROM financing_settlements WHERE id = :id
    """, {"id": settlement_id})

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    await verify_agreement_access(str(settlement["agreement_id"]), profile_id)

    items = await FinancingService.get_settlement_items(settlement_id)

    return {"items": items}


@router.post("/financing/agreements/{agreement_id}/settlements")
async def create_settlement(
    agreement_id: str,
    request: CreateSettlementRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new settlement (for manual settlements)."""
    profile_id = await get_profile_id(current_user)
    await verify_agreement_access(agreement_id, profile_id, require_owner=True)

    result = await FinancingService.create_settlement(
        agreement_id=agreement_id,
        period_start=request.period_start,
        period_end=request.period_end,
        gross_revenue_cents=request.gross_revenue_cents,
        world_earning_id=request.world_earning_id,
        platform_fees_cents=request.platform_fees_cents
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    # Auto-calculate distribution
    calc_result = await FinancingService.calculate_distribution(
        result["settlement"]["id"]
    )

    return {"settlement": result["settlement"], "distribution": calc_result.get("items", [])}


@router.post("/financing/settlements/{settlement_id}/approve")
async def approve_settlement(
    settlement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve a settlement for distribution."""
    profile_id = await get_profile_id(current_user)

    # Verify access
    settlement = execute_single("""
        SELECT agreement_id FROM financing_settlements WHERE id = :id
    """, {"id": settlement_id})

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    await verify_agreement_access(str(settlement["agreement_id"]), profile_id, require_owner=True)

    result = await FinancingService.approve_settlement(settlement_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/financing/settlements/{settlement_id}/distribute")
async def distribute_settlement(
    settlement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Distribute funds for an approved settlement."""
    profile_id = await get_profile_id(current_user)

    # Verify access
    settlement = execute_single("""
        SELECT agreement_id FROM financing_settlements WHERE id = :id
    """, {"id": settlement_id})

    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    await verify_agreement_access(str(settlement["agreement_id"]), profile_id, require_owner=True)

    result = await FinancingService.distribute_settlement(settlement_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Party Earnings
# =============================================================================

@router.get("/financing/my-earnings")
async def get_my_earnings(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's earnings across all financing agreements."""
    profile_id = await get_profile_id(current_user)

    earnings = await FinancingService.get_party_earnings(
        party_type=PartyType.CREATOR,
        party_id=profile_id
    )

    return earnings


@router.get("/organizations/{org_id}/financing/earnings")
async def get_organization_earnings(
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get organization's earnings across all financing agreements."""
    profile_id = await get_profile_id(current_user)

    # Verify org membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    earnings = await FinancingService.get_party_earnings(
        party_type=PartyType.ORGANIZATION,
        party_id=org_id
    )

    return earnings


# =============================================================================
# Templates
# =============================================================================

@router.get("/financing/templates")
async def list_templates(
    current_user: dict = Depends(get_current_user)
):
    """List available agreement templates."""
    templates = await FinancingService.list_templates()

    return {"templates": templates}


@router.get("/financing/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get template details."""
    template = await FinancingService.get_template(template_id)

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/financing/agreements/from-template")
async def create_from_template(
    request: CreateFromTemplateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create an agreement from a template."""
    profile_id = await get_profile_id(current_user)

    result = await FinancingService.create_from_template(
        template_id=request.template_id,
        world_id=request.world_id,
        name=request.name,
        created_by=profile_id,
        party_mappings=request.party_mappings
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# World Integration
# =============================================================================

@router.get("/worlds/{world_id}/financing")
async def get_world_financing(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get financing agreement for a World."""
    profile_id = await get_profile_id(current_user)

    agreement = await FinancingService.get_agreement_for_world(world_id)

    if not agreement:
        return {"has_agreement": False}

    # Check access
    try:
        await verify_agreement_access(agreement["id"], profile_id)
    except HTTPException:
        return {"has_agreement": True, "limited_access": True}

    summary = await FinancingService.get_waterfall_summary(agreement["id"])
    progress = await FinancingService.get_recoupment_progress(agreement["id"])

    return {
        "has_agreement": True,
        "agreement": agreement,
        "summary": summary,
        "recoupment": progress
    }


# Helper for execute_query not imported at module level
from app.core.database import execute_query
