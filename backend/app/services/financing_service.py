"""
Financing Service
Phase 6B: Financing agreements, recoupment, and multi-party splits.

Provides:
- Agreement creation and management
- Party management
- Waterfall term configuration
- Settlement calculation and distribution
- Recoupment tracking
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import json

from app.core.database import execute_query, execute_single, execute_insert


class AgreementStatus:
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    RECOUPED = "recouped"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class PartyType:
    CREATOR = "creator"
    ORGANIZATION = "organization"
    INVESTOR = "investor"
    ORDER_FUND = "order_fund"
    LODGE = "lodge"
    PLATFORM = "platform"
    DISTRIBUTOR = "distributor"


class ShareType:
    PERCENTAGE = "percentage"
    FIXED_RECOUP = "fixed_recoup"
    PERCENTAGE_AFTER_RECOUP = "percentage_after_recoup"
    BONUS_POOL = "bonus_pool"
    FIRST_DOLLAR = "first_dollar"
    LAST_MONEY_OUT = "last_money_out"


class FinancingService:
    """Service for managing financing agreements and settlements."""

    # ==========================================================================
    # Agreement Management
    # ==========================================================================

    @staticmethod
    async def create_agreement(
        name: str,
        created_by: str,
        world_id: Optional[str] = None,
        backlot_project_id: Optional[str] = None,
        description: Optional[str] = None,
        agreement_type: str = "production_financing",
        total_budget_cents: int = 0,
        revenue_sources: Optional[List[str]] = None,
        distribution_frequency: str = "monthly",
        minimum_distribution_cents: int = 10000
    ) -> Dict[str, Any]:
        """Create a new financing agreement."""
        if not world_id and not backlot_project_id:
            return {"success": False, "error": "Must specify world_id or backlot_project_id"}

        agreement = execute_insert("""
            INSERT INTO financing_agreements (
                name, description, agreement_type, world_id, backlot_project_id,
                total_budget_cents, revenue_sources, distribution_frequency,
                minimum_distribution_cents, created_by
            ) VALUES (
                :name, :description, :agreement_type, :world_id, :backlot_project_id,
                :total_budget_cents, :revenue_sources::jsonb, :distribution_frequency,
                :minimum_distribution_cents, :created_by
            )
            RETURNING *
        """, {
            "name": name,
            "description": description,
            "agreement_type": agreement_type,
            "world_id": world_id,
            "backlot_project_id": backlot_project_id,
            "total_budget_cents": total_budget_cents,
            "revenue_sources": json.dumps(revenue_sources or ["subscription_watch_share"]),
            "distribution_frequency": distribution_frequency,
            "minimum_distribution_cents": minimum_distribution_cents,
            "created_by": created_by
        })

        return {"success": True, "agreement": dict(agreement)}

    @staticmethod
    async def get_agreement(agreement_id: str) -> Optional[Dict[str, Any]]:
        """Get agreement details."""
        agreement = execute_single("""
            SELECT * FROM v_financing_agreement_summary WHERE id = :agreement_id
        """, {"agreement_id": agreement_id})

        if not agreement:
            return None

        result = dict(agreement)

        # Get parties
        parties = await FinancingService.get_parties(agreement_id)
        result["parties"] = parties

        # Get waterfall
        waterfall = await FinancingService.get_waterfall(agreement_id)
        result["waterfall"] = waterfall

        return result

    @staticmethod
    async def get_agreement_for_world(world_id: str) -> Optional[Dict[str, Any]]:
        """Get active financing agreement for a World."""
        agreement = execute_single("""
            SELECT * FROM financing_agreements
            WHERE world_id = :world_id AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        """, {"world_id": world_id})

        if not agreement:
            return None

        return await FinancingService.get_agreement(str(agreement["id"]))

    @staticmethod
    async def list_agreements(
        status: Optional[str] = None,
        world_id: Optional[str] = None,
        party_id: Optional[str] = None,
        party_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List financing agreements."""
        query = "SELECT * FROM v_financing_agreement_summary WHERE 1=1"
        params = {"limit": limit, "offset": offset}

        if status:
            query += " AND status = :status::financing_agreement_status"
            params["status"] = status

        if world_id:
            query += " AND world_id = :world_id"
            params["world_id"] = world_id

        if party_id and party_type:
            query += """ AND id IN (
                SELECT agreement_id FROM financing_parties
                WHERE party_id = :party_id AND party_type = :party_type::financing_party_type
            )"""
            params["party_id"] = party_id
            params["party_type"] = party_type

        query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"

        agreements = execute_query(query, params)
        return [dict(a) for a in agreements]

    @staticmethod
    async def update_agreement_status(
        agreement_id: str,
        status: str,
        effective_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Update agreement status."""
        valid_statuses = [AgreementStatus.DRAFT, AgreementStatus.PENDING_APPROVAL,
                         AgreementStatus.ACTIVE, AgreementStatus.RECOUPED,
                         AgreementStatus.CLOSED, AgreementStatus.CANCELLED]

        if status not in valid_statuses:
            return {"success": False, "error": f"Invalid status: {status}"}

        updates = {"status": status}
        if status == AgreementStatus.ACTIVE and effective_date:
            updates["effective_date"] = effective_date

        set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        updates["agreement_id"] = agreement_id

        execute_query(f"""
            UPDATE financing_agreements
            SET {set_clauses}, updated_at = NOW()
            WHERE id = :agreement_id
        """, updates)

        return {"success": True}

    # ==========================================================================
    # Party Management
    # ==========================================================================

    @staticmethod
    async def add_party(
        agreement_id: str,
        party_type: str,
        party_id: str,
        role: str = "contributor",
        party_name: Optional[str] = None,
        contribution_cents: int = 0,
        contribution_type: Optional[str] = None,
        contribution_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add a party to a financing agreement."""
        # Get party name if not provided
        if not party_name:
            if party_type == PartyType.CREATOR:
                profile = execute_single("SELECT display_name FROM profiles WHERE id = :id", {"id": party_id})
                party_name = profile["display_name"] if profile else "Unknown Creator"
            elif party_type == PartyType.ORGANIZATION:
                org = execute_single("SELECT name FROM organizations WHERE id = :id", {"id": party_id})
                party_name = org["name"] if org else "Unknown Organization"
            elif party_type == PartyType.ORDER_FUND:
                fund = execute_single("SELECT name FROM order_funds WHERE id = :id", {"id": party_id})
                party_name = fund["name"] if fund else "Unknown Fund"
            else:
                party_name = f"{party_type.title()} Party"

        party = execute_insert("""
            INSERT INTO financing_parties (
                agreement_id, party_type, party_id, party_name, role,
                contribution_cents, contribution_type, contribution_description
            ) VALUES (
                :agreement_id, :party_type::financing_party_type, :party_id, :party_name, :role,
                :contribution_cents, :contribution_type, :contribution_description
            )
            RETURNING *
        """, {
            "agreement_id": agreement_id,
            "party_type": party_type,
            "party_id": party_id,
            "party_name": party_name,
            "role": role,
            "contribution_cents": contribution_cents,
            "contribution_type": contribution_type,
            "contribution_description": contribution_description
        })

        # Update agreement total contribution
        execute_query("""
            UPDATE financing_agreements
            SET total_contributed_cents = total_contributed_cents + :contribution,
                updated_at = NOW()
            WHERE id = :agreement_id
        """, {"agreement_id": agreement_id, "contribution": contribution_cents})

        return {"success": True, "party": dict(party)}

    @staticmethod
    async def get_parties(agreement_id: str) -> List[Dict[str, Any]]:
        """Get all parties in an agreement."""
        parties = execute_query("""
            SELECT fp.*,
                   (SELECT COUNT(*) FROM financing_terms ft WHERE ft.party_id = fp.id) as term_count
            FROM financing_parties fp
            WHERE fp.agreement_id = :agreement_id
            ORDER BY fp.created_at
        """, {"agreement_id": agreement_id})

        return [dict(p) for p in parties]

    @staticmethod
    async def accept_party_invitation(
        party_id: str,
        accepted_by: str
    ) -> Dict[str, Any]:
        """Accept party invitation (for signing the agreement)."""
        execute_query("""
            UPDATE financing_parties
            SET accepted_at = NOW(), accepted_by = :accepted_by, updated_at = NOW()
            WHERE id = :party_id
        """, {"party_id": party_id, "accepted_by": accepted_by})

        return {"success": True}

    # ==========================================================================
    # Waterfall Terms
    # ==========================================================================

    @staticmethod
    async def add_term(
        agreement_id: str,
        party_id: str,
        recoupment_order: int,
        share_type: str,
        share_value: float,
        recoup_target_cents: Optional[int] = None,
        cap_cents: Optional[int] = None,
        cap_multiplier: Optional[float] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add a waterfall term to an agreement."""
        term = execute_insert("""
            INSERT INTO financing_terms (
                agreement_id, party_id, recoupment_order, share_type, share_value,
                recoup_target_cents, cap_cents, cap_multiplier, description
            ) VALUES (
                :agreement_id, :party_id, :recoupment_order, :share_type::share_type, :share_value,
                :recoup_target_cents, :cap_cents, :cap_multiplier, :description
            )
            RETURNING *
        """, {
            "agreement_id": agreement_id,
            "party_id": party_id,
            "recoupment_order": recoupment_order,
            "share_type": share_type,
            "share_value": share_value,
            "recoup_target_cents": recoup_target_cents,
            "cap_cents": cap_cents,
            "cap_multiplier": cap_multiplier,
            "description": description
        })

        return {"success": True, "term": dict(term)}

    @staticmethod
    async def get_waterfall(agreement_id: str) -> List[Dict[str, Any]]:
        """Get waterfall terms for an agreement."""
        terms = execute_query("""
            SELECT * FROM v_financing_waterfall
            WHERE agreement_id = :agreement_id
            ORDER BY recoupment_order
        """, {"agreement_id": agreement_id})

        return [dict(t) for t in terms]

    @staticmethod
    async def get_waterfall_summary(agreement_id: str) -> List[Dict[str, Any]]:
        """Get plain-English summary of waterfall."""
        summary = execute_query("""
            SELECT * FROM get_financing_summary(:agreement_id)
        """, {"agreement_id": agreement_id})

        return [dict(s) for s in summary]

    # ==========================================================================
    # Settlement Calculation
    # ==========================================================================

    @staticmethod
    async def create_settlement(
        agreement_id: str,
        period_start: date,
        period_end: date,
        gross_revenue_cents: int,
        world_earning_id: Optional[str] = None,
        platform_fees_cents: int = 0
    ) -> Dict[str, Any]:
        """Create a settlement record for a period."""
        net_distributable = gross_revenue_cents - platform_fees_cents

        settlement = execute_insert("""
            INSERT INTO financing_settlements (
                agreement_id, period_start, period_end, gross_revenue_cents,
                platform_fees_cents, net_distributable_cents, world_earning_id
            ) VALUES (
                :agreement_id, :period_start, :period_end, :gross_revenue_cents,
                :platform_fees_cents, :net_distributable_cents, :world_earning_id
            )
            RETURNING *
        """, {
            "agreement_id": agreement_id,
            "period_start": period_start,
            "period_end": period_end,
            "gross_revenue_cents": gross_revenue_cents,
            "platform_fees_cents": platform_fees_cents,
            "net_distributable_cents": net_distributable,
            "world_earning_id": world_earning_id
        })

        return {"success": True, "settlement": dict(settlement)}

    @staticmethod
    async def calculate_distribution(
        settlement_id: str
    ) -> Dict[str, Any]:
        """Calculate distribution for a settlement using the waterfall."""
        settlement = execute_single("""
            SELECT * FROM financing_settlements WHERE id = :id
        """, {"id": settlement_id})

        if not settlement:
            return {"success": False, "error": "Settlement not found"}

        # Use the database function to calculate distribution
        distributions = execute_query("""
            SELECT * FROM calculate_financing_distribution(
                :agreement_id,
                :revenue_cents,
                :period_start,
                :period_end
            )
        """, {
            "agreement_id": settlement["agreement_id"],
            "revenue_cents": settlement["net_distributable_cents"],
            "period_start": settlement["period_start"],
            "period_end": settlement["period_end"]
        })

        items = []
        calculation_details = {}

        for dist in distributions:
            # Get the term for this party
            term = execute_single("""
                SELECT * FROM financing_terms
                WHERE party_id = :party_id AND agreement_id = :agreement_id
                ORDER BY recoupment_order LIMIT 1
            """, {
                "party_id": dist["party_id"],
                "agreement_id": settlement["agreement_id"]
            })

            item = execute_insert("""
                INSERT INTO financing_settlement_items (
                    settlement_id, party_id, term_id, amount_cents,
                    share_type, share_value, recouped_in_period_cents,
                    calculation_notes
                ) VALUES (
                    :settlement_id, :party_id, :term_id, :amount_cents,
                    :share_type, :share_value, :recouped_cents,
                    :notes
                )
                RETURNING *
            """, {
                "settlement_id": settlement_id,
                "party_id": dist["party_id"],
                "term_id": term["id"] if term else None,
                "amount_cents": dist["amount_cents"],
                "share_type": dist["share_type"],
                "share_value": term["share_value"] if term else 0,
                "recouped_cents": dist["recouped_cents"],
                "notes": f"Calculated via {dist['share_type']} at position {term['recoupment_order']}" if term else None
            })

            items.append(dict(item))

        # Update settlement status
        execute_query("""
            UPDATE financing_settlements
            SET status = 'calculated',
                calculation_details = :details::jsonb,
                updated_at = NOW()
            WHERE id = :id
        """, {
            "id": settlement_id,
            "details": json.dumps({"items_count": len(items)})
        })

        return {"success": True, "items": items}

    @staticmethod
    async def approve_settlement(settlement_id: str) -> Dict[str, Any]:
        """Approve a settlement for distribution."""
        execute_query("""
            UPDATE financing_settlements
            SET status = 'approved', updated_at = NOW()
            WHERE id = :id AND status = 'calculated'
        """, {"id": settlement_id})

        return {"success": True}

    @staticmethod
    async def distribute_settlement(settlement_id: str) -> Dict[str, Any]:
        """Distribute funds for an approved settlement."""
        settlement = execute_single("""
            SELECT * FROM financing_settlements WHERE id = :id AND status = 'approved'
        """, {"id": settlement_id})

        if not settlement:
            return {"success": False, "error": "Settlement not found or not approved"}

        # Mark all items as paid (in production, this would trigger actual payments)
        execute_query("""
            UPDATE financing_settlement_items
            SET status = 'paid', paid_at = NOW()
            WHERE settlement_id = :id
        """, {"id": settlement_id})

        # Update recoupment
        execute_single("""
            SELECT update_financing_recoupment(:agreement_id, :settlement_id)
        """, {
            "agreement_id": settlement["agreement_id"],
            "settlement_id": settlement_id
        })

        # Update settlement status
        execute_query("""
            UPDATE financing_settlements
            SET status = 'distributed', distributed_at = NOW(), updated_at = NOW()
            WHERE id = :id
        """, {"id": settlement_id})

        return {"success": True}

    @staticmethod
    async def get_settlements(
        agreement_id: str,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get settlements for an agreement."""
        query = """
            SELECT fs.*,
                   (SELECT COALESCE(SUM(amount_cents), 0) FROM financing_settlement_items fsi
                    WHERE fsi.settlement_id = fs.id) as total_distributed_cents
            FROM financing_settlements fs
            WHERE fs.agreement_id = :agreement_id
        """
        params = {"agreement_id": agreement_id, "limit": limit, "offset": offset}

        if status:
            query += " AND fs.status = :status"
            params["status"] = status

        query += " ORDER BY fs.period_start DESC LIMIT :limit OFFSET :offset"

        settlements = execute_query(query, params)
        return [dict(s) for s in settlements]

    @staticmethod
    async def get_settlement_items(settlement_id: str) -> List[Dict[str, Any]]:
        """Get line items for a settlement."""
        items = execute_query("""
            SELECT fsi.*, fp.party_name, fp.party_type
            FROM financing_settlement_items fsi
            JOIN financing_parties fp ON fsi.party_id = fp.id
            WHERE fsi.settlement_id = :settlement_id
            ORDER BY fsi.amount_cents DESC
        """, {"settlement_id": settlement_id})

        return [dict(i) for i in items]

    # ==========================================================================
    # Recoupment Progress
    # ==========================================================================

    @staticmethod
    async def get_recoupment_progress(agreement_id: str) -> Dict[str, Any]:
        """Get recoupment progress for all parties."""
        progress = execute_query("""
            SELECT
                fp.id as party_id,
                fp.party_name,
                fp.party_type,
                fp.contribution_cents,
                fp.total_received_cents,
                ft.share_type,
                ft.recoup_target_cents,
                ft.recouped_cents,
                ft.recoupment_complete,
                ft.cap_cents,
                ft.cap_multiplier,
                CASE
                    WHEN ft.recoup_target_cents > 0 THEN
                        ROUND((ft.recouped_cents::NUMERIC / ft.recoup_target_cents) * 100, 2)
                    ELSE NULL
                END as recoupment_percentage
            FROM financing_parties fp
            LEFT JOIN financing_terms ft ON ft.party_id = fp.id
            WHERE fp.agreement_id = :agreement_id
            ORDER BY ft.recoupment_order
        """, {"agreement_id": agreement_id})

        total_recouped = sum(p.get("recouped_cents", 0) or 0 for p in progress)
        total_target = sum(p.get("recoup_target_cents", 0) or 0 for p in progress)

        return {
            "parties": [dict(p) for p in progress],
            "total_recouped_cents": total_recouped,
            "total_target_cents": total_target,
            "overall_percentage": round((total_recouped / total_target * 100), 2) if total_target > 0 else None,
            "all_recouped": all(p.get("recoupment_complete", True) for p in progress if p.get("share_type") == ShareType.FIXED_RECOUP)
        }

    # ==========================================================================
    # Party Earnings Summary
    # ==========================================================================

    @staticmethod
    async def get_party_earnings(
        party_type: str,
        party_id: str
    ) -> Dict[str, Any]:
        """Get total earnings for a party across all agreements."""
        earnings = execute_query("""
            SELECT
                fa.id as agreement_id,
                fa.name as agreement_name,
                fa.world_id,
                w.title as world_title,
                fp.contribution_cents,
                fp.total_received_cents,
                (
                    SELECT COUNT(*) FROM financing_settlements fs
                    WHERE fs.agreement_id = fa.id AND fs.status = 'distributed'
                ) as settlement_count
            FROM financing_parties fp
            JOIN financing_agreements fa ON fp.agreement_id = fa.id
            LEFT JOIN worlds w ON fa.world_id = w.id
            WHERE fp.party_type = :party_type::financing_party_type
              AND fp.party_id = :party_id
            ORDER BY fa.created_at DESC
        """, {"party_type": party_type, "party_id": party_id})

        total_contributed = sum(e.get("contribution_cents", 0) or 0 for e in earnings)
        total_received = sum(e.get("total_received_cents", 0) or 0 for e in earnings)

        return {
            "agreements": [dict(e) for e in earnings],
            "total_contributed_cents": total_contributed,
            "total_received_cents": total_received,
            "net_earnings_cents": total_received - total_contributed
        }

    # ==========================================================================
    # Templates
    # ==========================================================================

    @staticmethod
    async def list_templates() -> List[Dict[str, Any]]:
        """List available agreement templates."""
        templates = execute_query("""
            SELECT id, name, slug, description, agreement_type, is_recommended
            FROM financing_agreement_templates
            WHERE is_active = true
            ORDER BY is_recommended DESC, name
        """, {})

        return [dict(t) for t in templates]

    @staticmethod
    async def get_template(template_id: str) -> Optional[Dict[str, Any]]:
        """Get template details."""
        template = execute_single("""
            SELECT * FROM financing_agreement_templates WHERE id = :id
        """, {"id": template_id})

        return dict(template) if template else None

    @staticmethod
    async def create_from_template(
        template_id: str,
        world_id: str,
        name: str,
        created_by: str,
        party_mappings: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create an agreement from a template.

        party_mappings maps template placeholder roles to actual parties:
        {
            "investor": {"party_type": "investor", "party_id": "...", "contribution_cents": 100000},
            "creator": {"party_type": "creator", "party_id": "..."}
        }
        """
        template = await FinancingService.get_template(template_id)
        if not template:
            return {"success": False, "error": "Template not found"}

        structure = template["template_structure"]
        defaults = structure.get("defaults", {})

        # Create agreement
        result = await FinancingService.create_agreement(
            name=name,
            world_id=world_id,
            created_by=created_by,
            agreement_type=template["agreement_type"],
            distribution_frequency=defaults.get("distribution_frequency", "monthly")
        )

        if not result.get("success"):
            return result

        agreement_id = result["agreement"]["id"]
        party_id_map = {}

        # Add parties
        for party_def in structure.get("parties", []):
            role = party_def["role"]
            mapping = party_mappings.get(role, {})

            if not mapping:
                continue

            party_result = await FinancingService.add_party(
                agreement_id=agreement_id,
                party_type=mapping.get("party_type", party_def.get("party_type", "creator")),
                party_id=mapping["party_id"],
                role=role,
                contribution_cents=mapping.get("contribution_cents", 0)
            )

            if party_result.get("success"):
                party_id_map[role] = party_result["party"]["id"]

        # Add terms
        for term_def in structure.get("terms", []):
            party_role = term_def.get("party_role")
            if party_role not in party_id_map:
                continue

            await FinancingService.add_term(
                agreement_id=agreement_id,
                party_id=party_id_map[party_role],
                recoupment_order=term_def.get("order", 1),
                share_type=term_def["share_type"],
                share_value=term_def.get("value", 0),
                cap_multiplier=term_def.get("cap_multiplier")
            )

        return {"success": True, "agreement_id": agreement_id}

    # ==========================================================================
    # Integration with Earnings
    # ==========================================================================

    @staticmethod
    async def process_world_earning(
        world_id: str,
        earning_id: str,
        gross_amount_cents: int,
        period_start: date,
        period_end: date
    ) -> Dict[str, Any]:
        """
        Process a world earning through financing agreement.

        Called by RevenueCalculationService when earnings are calculated.
        Returns modified distribution if an agreement exists.
        """
        agreement = await FinancingService.get_agreement_for_world(world_id)

        if not agreement:
            # No financing agreement, use standard distribution
            return {
                "has_agreement": False,
                "standard_distribution": True
            }

        # Create settlement
        settlement_result = await FinancingService.create_settlement(
            agreement_id=agreement["id"],
            period_start=period_start,
            period_end=period_end,
            gross_revenue_cents=gross_amount_cents,
            world_earning_id=earning_id,
            platform_fees_cents=0  # Platform fees already deducted
        )

        if not settlement_result.get("success"):
            return {"success": False, "error": settlement_result.get("error")}

        # Calculate distribution
        calc_result = await FinancingService.calculate_distribution(
            settlement_result["settlement"]["id"]
        )

        return {
            "has_agreement": True,
            "agreement_id": agreement["id"],
            "settlement_id": settlement_result["settlement"]["id"],
            "distribution_items": calc_result.get("items", [])
        }
