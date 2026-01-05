"""
Order Governance Service
Phase 6A: Order funds, governance cycles, and transparency.

Provides:
- Fund management (inflows, outflows, balances)
- Governance cycles (proposals, voting)
- Transparency APIs (fund summaries, activity)
- Dues allocation to funds
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.database import execute_query, execute_single, execute_insert


class FundType:
    MICRO_FUND = "micro_fund"
    GEAR_FUND = "gear_fund"
    LODGE_OPERATIONS = "lodge_operations"
    EMERGENCY_SUPPORT = "emergency_support"
    EDUCATION = "education"
    PLATFORM_ALLOCATION = "platform_allocation"
    GENERAL = "general"


class FundSourceType:
    MEMBERSHIP_DUES = "membership_dues"
    PLATFORM_ALLOCATION = "platform_allocation"
    DONATION = "donation"
    GRANT = "grant"
    SPONSORSHIP = "sponsorship"
    EVENT_REVENUE = "event_revenue"
    INTEREST = "interest"
    TRANSFER_IN = "transfer_in"
    REFUND = "refund"


class AllocationTargetType:
    WORLD = "world"
    PROJECT = "project"
    LODGE = "lodge"
    MEMBER_SUPPORT = "member_support"
    EVENT = "event"
    EQUIPMENT = "equipment"
    EDUCATION = "education"
    TRANSFER_OUT = "transfer_out"
    EXPENSE = "expense"


class ProposalType:
    FUND_REQUEST = "fund_request"
    INITIATIVE = "initiative"
    POLICY_SUGGESTION = "policy_suggestion"
    OFFICER_NOMINATION = "officer_nomination"
    BUDGET_ITEM = "budget_item"
    LODGE_INITIATIVE = "lodge_initiative"
    RULE_CHANGE = "rule_change"


class OrderGovernanceService:
    """Service for Order governance, funds, and transparency."""

    # ==========================================================================
    # Fund Management
    # ==========================================================================

    @staticmethod
    async def create_fund(
        name: str,
        slug: str,
        fund_type: str,
        description: Optional[str] = None,
        lodge_id: Optional[str] = None,
        requires_vote_for_allocation: bool = False,
        min_allocation_for_vote_cents: int = 50000,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new Order fund."""
        fund = execute_insert("""
            INSERT INTO order_funds (
                name, slug, description, fund_type, lodge_id,
                requires_vote_for_allocation, min_allocation_for_vote_cents,
                created_by
            ) VALUES (
                :name, :slug, :description, :fund_type::order_fund_type, :lodge_id,
                :requires_vote_for_allocation, :min_allocation_for_vote_cents,
                :created_by
            )
            RETURNING *
        """, {
            "name": name,
            "slug": slug,
            "description": description,
            "fund_type": fund_type,
            "lodge_id": lodge_id,
            "requires_vote_for_allocation": requires_vote_for_allocation,
            "min_allocation_for_vote_cents": min_allocation_for_vote_cents,
            "created_by": created_by
        })

        return {"success": True, "fund": dict(fund)}

    @staticmethod
    async def get_fund(fund_id: str) -> Optional[Dict[str, Any]]:
        """Get fund details."""
        fund = execute_single("""
            SELECT f.*, l.name as lodge_name
            FROM order_funds f
            LEFT JOIN order_lodges l ON f.lodge_id = l.id
            WHERE f.id = :fund_id
        """, {"fund_id": fund_id})

        return dict(fund) if fund else None

    @staticmethod
    async def get_fund_by_slug(slug: str) -> Optional[Dict[str, Any]]:
        """Get fund by slug."""
        fund = execute_single("""
            SELECT * FROM order_funds WHERE slug = :slug
        """, {"slug": slug})

        return dict(fund) if fund else None

    @staticmethod
    async def list_funds(
        lodge_id: Optional[str] = None,
        fund_type: Optional[str] = None,
        active_only: bool = True,
        include_balances: bool = True
    ) -> List[Dict[str, Any]]:
        """List Order funds."""
        query = "SELECT * FROM v_order_fund_summaries WHERE 1=1"
        params = {}

        if active_only:
            query += " AND is_active = true"

        if lodge_id:
            query += " AND (lodge_id = :lodge_id OR lodge_id IS NULL)"
            params["lodge_id"] = lodge_id

        if fund_type:
            query += " AND fund_type = :fund_type::order_fund_type"
            params["fund_type"] = fund_type

        query += " ORDER BY name"

        funds = execute_query(query, params)
        return [dict(f) for f in funds]

    @staticmethod
    async def record_inflow(
        fund_id: str,
        amount_cents: int,
        source_type: str,
        source_reference_type: Optional[str] = None,
        source_reference_id: Optional[str] = None,
        description: Optional[str] = None,
        recorded_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record an inflow to a fund."""
        result = execute_single("""
            SELECT record_fund_inflow(
                :fund_id,
                :amount_cents,
                :source_type::fund_source_type,
                :source_reference_type,
                :source_reference_id,
                :description,
                :recorded_by
            ) as flow_id
        """, {
            "fund_id": fund_id,
            "amount_cents": amount_cents,
            "source_type": source_type,
            "source_reference_type": source_reference_type,
            "source_reference_id": source_reference_id,
            "description": description,
            "recorded_by": recorded_by
        })

        return {"success": True, "flow_id": str(result["flow_id"])}

    @staticmethod
    async def get_fund_flows(
        fund_id: str,
        direction: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get fund flows (inflows/outflows)."""
        query = """
            SELECT ff.*, f.name as fund_name
            FROM order_fund_flows ff
            JOIN order_funds f ON ff.fund_id = f.id
            WHERE ff.fund_id = :fund_id
        """
        params = {"fund_id": fund_id, "limit": limit, "offset": offset}

        if direction:
            query += " AND ff.flow_direction = :direction"
            params["direction"] = direction

        query += " ORDER BY ff.occurred_at DESC LIMIT :limit OFFSET :offset"

        flows = execute_query(query, params)
        return [dict(f) for f in flows]

    @staticmethod
    async def get_recent_activity(limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent fund activity across all funds."""
        activity = execute_query("""
            SELECT * FROM v_order_fund_recent_activity
            LIMIT :limit
        """, {"limit": limit})

        return [dict(a) for a in activity]

    # ==========================================================================
    # Fund Allocations
    # ==========================================================================

    @staticmethod
    async def request_allocation(
        fund_id: str,
        target_type: str,
        amount_cents: int,
        requested_by: str,
        target_id: Optional[str] = None,
        target_description: Optional[str] = None,
        decision_method: str = "leader",
        proposal_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Request a fund allocation."""
        # Get fund to check if vote is required
        fund = await OrderGovernanceService.get_fund(fund_id)
        if not fund:
            return {"success": False, "error": "Fund not found"}

        if fund["current_balance_cents"] < amount_cents:
            return {"success": False, "error": "Insufficient fund balance"}

        # Check if vote is required
        if fund["requires_vote_for_allocation"] and amount_cents >= fund["min_allocation_for_vote_cents"]:
            decision_method = "vote"

        allocation = execute_insert("""
            INSERT INTO order_fund_allocations (
                fund_id, target_type, target_id, target_description,
                amount_cents, decision_method, proposal_id, requested_by
            ) VALUES (
                :fund_id, :target_type::fund_allocation_target_type, :target_id, :target_description,
                :amount_cents, :decision_method::allocation_decision_method, :proposal_id, :requested_by
            )
            RETURNING *
        """, {
            "fund_id": fund_id,
            "target_type": target_type,
            "target_id": target_id,
            "target_description": target_description,
            "amount_cents": amount_cents,
            "decision_method": decision_method,
            "proposal_id": proposal_id,
            "requested_by": requested_by
        })

        return {"success": True, "allocation": dict(allocation), "requires_vote": decision_method == "vote"}

    @staticmethod
    async def approve_allocation(
        allocation_id: str,
        approved_by: str,
        decision_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Approve a pending allocation."""
        allocation = execute_single("""
            SELECT * FROM order_fund_allocations WHERE id = :id AND status = 'pending'
        """, {"id": allocation_id})

        if not allocation:
            return {"success": False, "error": "Allocation not found or not pending"}

        execute_query("""
            UPDATE order_fund_allocations SET
                status = 'approved',
                decided_by = :approved_by,
                decision_notes = :decision_notes,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = :id
        """, {
            "id": allocation_id,
            "approved_by": approved_by,
            "decision_notes": decision_notes
        })

        return {"success": True}

    @staticmethod
    async def disburse_allocation(
        allocation_id: str,
        disbursed_by: str,
        amount_cents: Optional[int] = None  # Partial disbursement
    ) -> Dict[str, Any]:
        """Disburse funds for an approved allocation."""
        allocation = execute_single("""
            SELECT * FROM order_fund_allocations WHERE id = :id
        """, {"id": allocation_id})

        if not allocation:
            return {"success": False, "error": "Allocation not found"}

        if allocation["status"] not in ["approved", "partially_disbursed"]:
            return {"success": False, "error": "Allocation not approved"}

        disburse_amount = amount_cents or (allocation["amount_cents"] - allocation["disbursed_cents"])

        # Record outflow
        execute_single("""
            SELECT record_fund_outflow(
                :fund_id,
                :allocation_id,
                :amount_cents,
                :description,
                :recorded_by
            )
        """, {
            "fund_id": allocation["fund_id"],
            "allocation_id": allocation_id,
            "amount_cents": disburse_amount,
            "description": f"Disbursement for {allocation['target_type']}: {allocation.get('target_description', '')}",
            "recorded_by": disbursed_by
        })

        # Update allocation
        new_disbursed = allocation["disbursed_cents"] + disburse_amount
        new_status = "disbursed" if new_disbursed >= allocation["amount_cents"] else "partially_disbursed"

        execute_query("""
            UPDATE order_fund_allocations SET
                disbursed_cents = :disbursed_cents,
                status = :status,
                disbursed_at = NOW(),
                updated_at = NOW()
            WHERE id = :id
        """, {
            "id": allocation_id,
            "disbursed_cents": new_disbursed,
            "status": new_status
        })

        return {"success": True, "disbursed_cents": disburse_amount, "status": new_status}

    @staticmethod
    async def get_allocations(
        fund_id: Optional[str] = None,
        status: Optional[str] = None,
        target_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get fund allocations."""
        query = """
            SELECT a.*, f.name as fund_name
            FROM order_fund_allocations a
            JOIN order_funds f ON a.fund_id = f.id
            WHERE 1=1
        """
        params = {"limit": limit, "offset": offset}

        if fund_id:
            query += " AND a.fund_id = :fund_id"
            params["fund_id"] = fund_id

        if status:
            query += " AND a.status = :status"
            params["status"] = status

        if target_type:
            query += " AND a.target_type = :target_type::fund_allocation_target_type"
            params["target_type"] = target_type

        query += " ORDER BY a.requested_at DESC LIMIT :limit OFFSET :offset"

        allocations = execute_query(query, params)
        return [dict(a) for a in allocations]

    # ==========================================================================
    # Governance Cycles
    # ==========================================================================

    @staticmethod
    async def create_governance_cycle(
        name: str,
        cycle_type: str,
        voting_start: datetime,
        voting_end: datetime,
        created_by: str,
        description: Optional[str] = None,
        lodge_id: Optional[str] = None,
        craft_house_id: Optional[str] = None,
        nominations_start: Optional[datetime] = None,
        nominations_end: Optional[datetime] = None,
        quorum_percentage: int = 25,
        approval_threshold_percentage: int = 50,
        allow_weighted_votes: bool = False,
        weight_by: Optional[str] = None,
        min_membership_days: int = 30
    ) -> Dict[str, Any]:
        """Create a new governance cycle."""
        cycle = execute_insert("""
            INSERT INTO order_governance_cycles (
                name, description, cycle_type, lodge_id, craft_house_id,
                nominations_start, nominations_end, voting_start, voting_end,
                quorum_percentage, approval_threshold_percentage,
                allow_weighted_votes, weight_by, min_membership_days,
                created_by
            ) VALUES (
                :name, :description, :cycle_type::governance_cycle_type, :lodge_id, :craft_house_id,
                :nominations_start, :nominations_end, :voting_start, :voting_end,
                :quorum_percentage, :approval_threshold_percentage,
                :allow_weighted_votes, :weight_by, :min_membership_days,
                :created_by
            )
            RETURNING *
        """, {
            "name": name,
            "description": description,
            "cycle_type": cycle_type,
            "lodge_id": lodge_id,
            "craft_house_id": craft_house_id,
            "nominations_start": nominations_start,
            "nominations_end": nominations_end,
            "voting_start": voting_start,
            "voting_end": voting_end,
            "quorum_percentage": quorum_percentage,
            "approval_threshold_percentage": approval_threshold_percentage,
            "allow_weighted_votes": allow_weighted_votes,
            "weight_by": weight_by,
            "min_membership_days": min_membership_days,
            "created_by": created_by
        })

        return {"success": True, "cycle": dict(cycle)}

    @staticmethod
    async def get_cycle(cycle_id: str) -> Optional[Dict[str, Any]]:
        """Get governance cycle details."""
        cycle = execute_single("""
            SELECT * FROM v_governance_cycle_summary WHERE id = :cycle_id
        """, {"cycle_id": cycle_id})

        return dict(cycle) if cycle else None

    @staticmethod
    async def list_cycles(
        status: Optional[str] = None,
        cycle_type: Optional[str] = None,
        lodge_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List governance cycles."""
        query = "SELECT * FROM v_governance_cycle_summary WHERE 1=1"
        params = {"limit": limit, "offset": offset}

        if status:
            query += " AND status = :status"
            params["status"] = status

        if cycle_type:
            query += " AND cycle_type = :cycle_type::governance_cycle_type"
            params["cycle_type"] = cycle_type

        if lodge_id:
            query += " AND (lodge_id = :lodge_id OR lodge_id IS NULL)"
            params["lodge_id"] = lodge_id

        query += " ORDER BY voting_start DESC LIMIT :limit OFFSET :offset"

        cycles = execute_query(query, params)
        return [dict(c) for c in cycles]

    @staticmethod
    async def update_cycle_status(
        cycle_id: str,
        status: str
    ) -> Dict[str, Any]:
        """Update cycle status."""
        valid_statuses = ["draft", "nominations", "voting", "tallying", "completed", "cancelled"]
        if status not in valid_statuses:
            return {"success": False, "error": f"Invalid status: {status}"}

        execute_query("""
            UPDATE order_governance_cycles SET status = :status, updated_at = NOW()
            WHERE id = :cycle_id
        """, {"cycle_id": cycle_id, "status": status})

        # If completing, count eligible voters
        if status == "voting":
            # TODO: Count eligible voters based on cycle rules
            pass

        return {"success": True}

    # ==========================================================================
    # Proposals
    # ==========================================================================

    @staticmethod
    async def create_proposal(
        cycle_id: str,
        proposer_id: str,
        proposal_type: str,
        title: str,
        description: str,
        target_fund_id: Optional[str] = None,
        requested_amount_cents: Optional[int] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        target_description: Optional[str] = None,
        nominee_id: Optional[str] = None,
        position_type: Optional[str] = None,
        supporting_materials: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a governance proposal."""
        # Verify cycle exists and is accepting proposals
        cycle = await OrderGovernanceService.get_cycle(cycle_id)
        if not cycle:
            return {"success": False, "error": "Cycle not found"}

        if cycle["status"] not in ["draft", "nominations"]:
            return {"success": False, "error": "Cycle is not accepting proposals"}

        proposal = execute_insert("""
            INSERT INTO order_governance_proposals (
                cycle_id, proposer_id, proposal_type, title, description,
                target_fund_id, requested_amount_cents, target_type, target_id, target_description,
                nominee_id, position_type, supporting_materials
            ) VALUES (
                :cycle_id, :proposer_id, :proposal_type::governance_proposal_type, :title, :description,
                :target_fund_id, :requested_amount_cents, :target_type::fund_allocation_target_type,
                :target_id, :target_description,
                :nominee_id, :position_type, :supporting_materials::jsonb
            )
            RETURNING *
        """, {
            "cycle_id": cycle_id,
            "proposer_id": proposer_id,
            "proposal_type": proposal_type,
            "title": title,
            "description": description,
            "target_fund_id": target_fund_id,
            "requested_amount_cents": requested_amount_cents,
            "target_type": target_type,
            "target_id": target_id,
            "target_description": target_description,
            "nominee_id": nominee_id,
            "position_type": position_type,
            "supporting_materials": supporting_materials or []
        })

        return {"success": True, "proposal": dict(proposal)}

    @staticmethod
    async def get_proposal(proposal_id: str) -> Optional[Dict[str, Any]]:
        """Get proposal details."""
        proposal = execute_single("""
            SELECT p.*,
                   c.name as cycle_name,
                   c.status as cycle_status,
                   f.name as fund_name,
                   pr.display_name as proposer_name
            FROM order_governance_proposals p
            JOIN order_governance_cycles c ON p.cycle_id = c.id
            LEFT JOIN order_funds f ON p.target_fund_id = f.id
            LEFT JOIN profiles pr ON p.proposer_id = pr.id
            WHERE p.id = :proposal_id
        """, {"proposal_id": proposal_id})

        return dict(proposal) if proposal else None

    @staticmethod
    async def list_proposals(
        cycle_id: Optional[str] = None,
        status: Optional[str] = None,
        proposal_type: Optional[str] = None,
        proposer_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List proposals."""
        query = """
            SELECT p.*, c.name as cycle_name, f.name as fund_name,
                   pr.display_name as proposer_name
            FROM order_governance_proposals p
            JOIN order_governance_cycles c ON p.cycle_id = c.id
            LEFT JOIN order_funds f ON p.target_fund_id = f.id
            LEFT JOIN profiles pr ON p.proposer_id = pr.id
            WHERE 1=1
        """
        params = {"limit": limit, "offset": offset}

        if cycle_id:
            query += " AND p.cycle_id = :cycle_id"
            params["cycle_id"] = cycle_id

        if status:
            query += " AND p.status = :status"
            params["status"] = status

        if proposal_type:
            query += " AND p.proposal_type = :proposal_type::governance_proposal_type"
            params["proposal_type"] = proposal_type

        if proposer_id:
            query += " AND p.proposer_id = :proposer_id"
            params["proposer_id"] = proposer_id

        query += " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset"

        proposals = execute_query(query, params)
        return [dict(p) for p in proposals]

    @staticmethod
    async def review_proposal(
        proposal_id: str,
        reviewed_by: str,
        approved: bool,
        review_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Review and approve/reject a proposal for voting."""
        new_status = "approved_for_voting" if approved else "rejected_from_voting"

        execute_query("""
            UPDATE order_governance_proposals SET
                status = :status,
                reviewed_by = :reviewed_by,
                reviewed_at = NOW(),
                review_notes = :review_notes,
                updated_at = NOW()
            WHERE id = :proposal_id
        """, {
            "proposal_id": proposal_id,
            "status": new_status,
            "reviewed_by": reviewed_by,
            "review_notes": review_notes
        })

        return {"success": True, "status": new_status}

    # ==========================================================================
    # Voting
    # ==========================================================================

    @staticmethod
    async def cast_vote(
        proposal_id: str,
        member_id: str,
        vote_value: str,
        comment: Optional[str] = None,
        comment_is_public: bool = False
    ) -> Dict[str, Any]:
        """Cast a vote on a proposal."""
        # Get proposal and cycle
        proposal = await OrderGovernanceService.get_proposal(proposal_id)
        if not proposal:
            return {"success": False, "error": "Proposal not found"}

        if proposal["status"] not in ["approved_for_voting", "voting"]:
            return {"success": False, "error": "Proposal is not open for voting"}

        if proposal["cycle_status"] != "voting":
            return {"success": False, "error": "Voting is not open for this cycle"}

        # Check eligibility
        eligible = execute_single("""
            SELECT is_eligible_to_vote(:cycle_id, :member_id) as eligible
        """, {"cycle_id": proposal["cycle_id"], "member_id": member_id})

        if not eligible or not eligible["eligible"]:
            return {"success": False, "error": "Not eligible to vote in this cycle"}

        # Get vote weight
        weight_result = execute_single("""
            SELECT calculate_vote_weight(:cycle_id, :member_id) as weight
        """, {"cycle_id": proposal["cycle_id"], "member_id": member_id})
        vote_weight = float(weight_result["weight"]) if weight_result else 1.0

        # Cast or update vote
        execute_query("""
            INSERT INTO order_governance_votes (
                proposal_id, member_id, vote_value, vote_weight,
                comment, comment_is_public
            ) VALUES (
                :proposal_id, :member_id, :vote_value::governance_vote_value, :vote_weight,
                :comment, :comment_is_public
            )
            ON CONFLICT (proposal_id, member_id)
            DO UPDATE SET
                vote_value = :vote_value::governance_vote_value,
                vote_weight = :vote_weight,
                comment = :comment,
                comment_is_public = :comment_is_public,
                voted_at = NOW()
        """, {
            "proposal_id": proposal_id,
            "member_id": member_id,
            "vote_value": vote_value,
            "vote_weight": vote_weight,
            "comment": comment,
            "comment_is_public": comment_is_public
        })

        # Update vote tallies
        execute_single("""
            SELECT tally_proposal_votes(:proposal_id)
        """, {"proposal_id": proposal_id})

        return {"success": True, "vote_weight": vote_weight}

    @staticmethod
    async def get_my_vote(proposal_id: str, member_id: str) -> Optional[Dict[str, Any]]:
        """Get member's vote on a proposal."""
        vote = execute_single("""
            SELECT * FROM order_governance_votes
            WHERE proposal_id = :proposal_id AND member_id = :member_id
        """, {"proposal_id": proposal_id, "member_id": member_id})

        return dict(vote) if vote else None

    @staticmethod
    async def get_proposal_votes(
        proposal_id: str,
        include_comments: bool = False
    ) -> Dict[str, Any]:
        """Get vote summary for a proposal."""
        proposal = await OrderGovernanceService.get_proposal(proposal_id)
        if not proposal:
            return {"success": False, "error": "Proposal not found"}

        result = {
            "votes_for": proposal["votes_for"],
            "votes_against": proposal["votes_against"],
            "votes_abstain": proposal["votes_abstain"],
            "weighted_votes_for": float(proposal["weighted_votes_for"]) if proposal["weighted_votes_for"] else 0,
            "weighted_votes_against": float(proposal["weighted_votes_against"]) if proposal["weighted_votes_against"] else 0,
            "final_percentage": float(proposal["final_percentage"]) if proposal["final_percentage"] else None
        }

        if include_comments:
            comments = execute_query("""
                SELECT v.comment, v.vote_value, v.voted_at,
                       p.display_name as voter_name
                FROM order_governance_votes v
                JOIN profiles p ON v.member_id = p.id
                WHERE v.proposal_id = :proposal_id
                  AND v.comment IS NOT NULL
                  AND v.comment_is_public = true
                ORDER BY v.voted_at DESC
            """, {"proposal_id": proposal_id})
            result["public_comments"] = [dict(c) for c in comments]

        return result

    # ==========================================================================
    # Finalization
    # ==========================================================================

    @staticmethod
    async def finalize_cycle(cycle_id: str) -> Dict[str, Any]:
        """Finalize a governance cycle and determine outcomes."""
        cycle = await OrderGovernanceService.get_cycle(cycle_id)
        if not cycle:
            return {"success": False, "error": "Cycle not found"}

        if cycle["status"] != "voting":
            return {"success": False, "error": "Cycle is not in voting status"}

        # Get all proposals for this cycle
        proposals = await OrderGovernanceService.list_proposals(cycle_id=cycle_id, status="approved_for_voting")

        results = []
        for proposal in proposals:
            # Tally final votes
            execute_single("""SELECT tally_proposal_votes(:id)""", {"id": proposal["id"]})

            # Get updated proposal
            updated = await OrderGovernanceService.get_proposal(proposal["id"])

            # Check if passed
            total_votes = updated["votes_for"] + updated["votes_against"]
            percentage = float(updated["final_percentage"]) if updated["final_percentage"] else 0

            passed = (
                total_votes > 0 and
                percentage >= cycle["approval_threshold_percentage"]
            )

            new_status = "passed" if passed else "failed"

            execute_query("""
                UPDATE order_governance_proposals SET status = :status, updated_at = NOW()
                WHERE id = :id
            """, {"id": proposal["id"], "status": new_status})

            # If passed and is a fund request, create allocation
            if passed and proposal["proposal_type"] == "fund_request" and proposal["requested_amount_cents"]:
                allocation_result = await OrderGovernanceService.request_allocation(
                    fund_id=proposal["target_fund_id"],
                    target_type=proposal["target_type"] or "world",
                    amount_cents=proposal["requested_amount_cents"],
                    requested_by=proposal["proposer_id"],
                    target_id=proposal["target_id"],
                    target_description=proposal["target_description"],
                    decision_method="vote",
                    proposal_id=proposal["id"]
                )

                if allocation_result.get("success"):
                    execute_query("""
                        UPDATE order_governance_proposals SET allocation_id = :allocation_id
                        WHERE id = :id
                    """, {"id": proposal["id"], "allocation_id": allocation_result["allocation"]["id"]})

            results.append({
                "proposal_id": proposal["id"],
                "title": proposal["title"],
                "passed": passed,
                "percentage": percentage
            })

        # Update cycle status
        await OrderGovernanceService.update_cycle_status(cycle_id, "completed")

        return {"success": True, "results": results}

    # ==========================================================================
    # Transparency
    # ==========================================================================

    @staticmethod
    async def get_transparency_dashboard() -> Dict[str, Any]:
        """Get transparency dashboard data."""
        # Total funds and balances
        funds_summary = execute_single("""
            SELECT
                COUNT(*) as total_funds,
                COALESCE(SUM(current_balance_cents), 0) as total_balance_cents,
                COALESCE(SUM(total_inflows_cents), 0) as total_inflows_cents,
                COALESCE(SUM(total_outflows_cents), 0) as total_outflows_cents
            FROM order_funds WHERE is_active = true
        """, {})

        # Active cycles
        active_cycles = execute_single("""
            SELECT COUNT(*) as count
            FROM order_governance_cycles
            WHERE status IN ('nominations', 'voting')
        """, {})

        # Recent allocations
        recent_allocations = execute_query("""
            SELECT a.id, a.target_type, a.target_description, a.amount_cents,
                   a.status, a.approved_at, f.name as fund_name
            FROM order_fund_allocations a
            JOIN order_funds f ON a.fund_id = f.id
            WHERE a.status IN ('approved', 'disbursed')
            ORDER BY a.approved_at DESC
            LIMIT 10
        """, {})

        # Recent proposals
        recent_proposals = execute_query("""
            SELECT p.id, p.title, p.proposal_type, p.status,
                   p.votes_for, p.votes_against, p.final_percentage,
                   c.name as cycle_name
            FROM order_governance_proposals p
            JOIN order_governance_cycles c ON p.cycle_id = c.id
            WHERE p.status IN ('passed', 'failed')
            ORDER BY p.updated_at DESC
            LIMIT 10
        """, {})

        return {
            "funds": dict(funds_summary) if funds_summary else {},
            "active_cycles_count": active_cycles["count"] if active_cycles else 0,
            "recent_allocations": [dict(a) for a in recent_allocations],
            "recent_proposals": [dict(p) for p in recent_proposals]
        }

    # ==========================================================================
    # Dues Allocation
    # ==========================================================================

    @staticmethod
    async def allocate_dues_to_funds(
        dues_payment_id: str,
        dues_amount_cents: int,
        membership_tier: str,
        recorded_by: str
    ) -> Dict[str, Any]:
        """Allocate a portion of dues payment to configured funds."""
        # Get applicable rules
        rules = execute_query("""
            SELECT r.*, f.name as fund_name
            FROM order_dues_fund_rules r
            JOIN order_funds f ON r.fund_id = f.id
            WHERE r.is_active = true
              AND (r.membership_tier = :tier OR r.membership_tier IS NULL)
            ORDER BY r.priority, r.allocation_type
        """, {"tier": membership_tier})

        allocated = []
        remaining = dues_amount_cents

        for rule in rules:
            if rule["allocation_type"] == "percentage":
                amount = int(dues_amount_cents * (float(rule["allocation_value"]) / 100))
            else:  # fixed_cents
                amount = int(rule["allocation_value"])

            if amount > remaining:
                amount = remaining

            if amount > 0:
                result = await OrderGovernanceService.record_inflow(
                    fund_id=rule["fund_id"],
                    amount_cents=amount,
                    source_type=FundSourceType.MEMBERSHIP_DUES,
                    source_reference_type="dues_payment",
                    source_reference_id=dues_payment_id,
                    description=f"Dues allocation ({membership_tier})",
                    recorded_by=recorded_by
                )

                allocated.append({
                    "fund_id": str(rule["fund_id"]),
                    "fund_name": rule["fund_name"],
                    "amount_cents": amount
                })

                remaining -= amount

        return {
            "success": True,
            "allocated": allocated,
            "total_allocated_cents": dues_amount_cents - remaining
        }
