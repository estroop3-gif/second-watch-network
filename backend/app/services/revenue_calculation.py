"""
Revenue Calculation Service

Calculates creator earnings based on watch time share of creator pool.

Formula:
- creator_pool = net_subscription_revenue * 0.10  (10% to creators)
- world_share = world_watch_seconds / platform_watch_seconds
- world_earnings = creator_pool * world_share

Payout rules:
- Earnings >= $25: status = 'pending' (ready for payout)
- Earnings < $25: status = 'held' (rolls to next period)
- World with organization_id: payout to organization
- World with only creator_id: payout to creator
"""

from datetime import datetime, date
from typing import Optional, Dict, Any, List
from decimal import Decimal

from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger

logger = get_logger(__name__)

# Configuration constants
CREATOR_POOL_PERCENTAGE = Decimal("0.10")  # 10% of net revenue
MINIMUM_PAYOUT_CENTS = 2500  # $25 minimum payout threshold


class RevenueCalculationService:
    """
    Service for calculating and managing creator earnings and payouts.
    """

    @staticmethod
    async def record_subscription_revenue(
        period_start: datetime,
        period_end: datetime,
        period_type: str,
        gross_revenue_cents: int,
        refunds_cents: int = 0,
        chargebacks_cents: int = 0,
        stripe_fees_cents: int = 0,
        total_subscribers: int = 0,
        new_subscribers: int = 0,
        churned_subscribers: int = 0,
    ) -> Dict[str, Any]:
        """
        Record subscription revenue for a period.
        Usually called after syncing with Stripe.

        Args:
            period_start: Start of the period
            period_end: End of the period
            period_type: 'daily' or 'monthly'
            gross_revenue_cents: Total gross revenue in cents
            refunds_cents: Total refunds in cents
            chargebacks_cents: Total chargebacks in cents
            stripe_fees_cents: Stripe processing fees in cents
            total_subscribers: Total active subscribers
            new_subscribers: New subscribers this period
            churned_subscribers: Subscribers who cancelled

        Returns:
            The created/updated subscription_revenue record
        """
        query = """
            INSERT INTO subscription_revenue (
                period_type, period_start, period_end,
                gross_revenue_cents, refunds_cents, chargebacks_cents, stripe_fees_cents,
                total_subscribers, new_subscribers, churned_subscribers,
                stripe_sync_at
            ) VALUES (
                :period_type, :period_start, :period_end,
                :gross_revenue_cents, :refunds_cents, :chargebacks_cents, :stripe_fees_cents,
                :total_subscribers, :new_subscribers, :churned_subscribers,
                NOW()
            )
            ON CONFLICT (period_type, period_start)
            DO UPDATE SET
                gross_revenue_cents = EXCLUDED.gross_revenue_cents,
                refunds_cents = EXCLUDED.refunds_cents,
                chargebacks_cents = EXCLUDED.chargebacks_cents,
                stripe_fees_cents = EXCLUDED.stripe_fees_cents,
                total_subscribers = EXCLUDED.total_subscribers,
                new_subscribers = EXCLUDED.new_subscribers,
                churned_subscribers = EXCLUDED.churned_subscribers,
                stripe_sync_at = NOW(),
                updated_at = NOW()
            RETURNING *
        """

        result = execute_insert(query, {
            "period_type": period_type,
            "period_start": period_start,
            "period_end": period_end,
            "gross_revenue_cents": gross_revenue_cents,
            "refunds_cents": refunds_cents,
            "chargebacks_cents": chargebacks_cents,
            "stripe_fees_cents": stripe_fees_cents,
            "total_subscribers": total_subscribers,
            "new_subscribers": new_subscribers,
            "churned_subscribers": churned_subscribers,
        })

        logger.info(
            "subscription_revenue_recorded",
            period_type=period_type,
            period_start=period_start.isoformat(),
            gross_revenue_cents=gross_revenue_cents,
            net_revenue_cents=result.get("net_revenue_cents") if result else 0,
            creator_pool_cents=result.get("creator_pool_cents") if result else 0,
        )

        return result

    @staticmethod
    async def calculate_monthly_earnings(year: int, month: int) -> Dict[str, Any]:
        """
        Calculate earnings for all worlds for a month.

        Steps:
        1. Get platform watch totals for the month
        2. Get creator pool from subscription revenue
        3. For each world with watch time:
           - Calculate watch share
           - Calculate earnings
           - Determine payout recipient (org or creator)
           - Create/update world_earnings record

        Args:
            year: Year (e.g., 2024)
            month: Month (1-12)

        Returns:
            Dict with calculation stats
        """
        month_start = datetime(year, month, 1)
        if month == 12:
            month_end = datetime(year + 1, 1, 1)
        else:
            month_end = datetime(year, month + 1, 1)

        logger.info(
            "calculating_monthly_earnings",
            year=year,
            month=month
        )

        # Get platform watch totals
        platform_totals = execute_single("""
            SELECT total_watch_seconds, active_worlds_count
            FROM platform_watch_totals
            WHERE period_type = 'monthly' AND period_start = :month_start
        """, {"month_start": month_start})

        if not platform_totals or not platform_totals.get("total_watch_seconds"):
            logger.warning("no_platform_watch_data", year=year, month=month)
            return {
                "year": year,
                "month": month,
                "status": "no_watch_data",
                "worlds_processed": 0,
                "total_earnings_cents": 0
            }

        platform_watch_seconds = platform_totals["total_watch_seconds"]

        # Get subscription revenue and creator pool
        revenue = execute_single("""
            SELECT
                gross_revenue_cents,
                net_revenue_cents,
                creator_pool_cents
            FROM subscription_revenue
            WHERE period_type = 'monthly' AND period_start = :month_start
        """, {"month_start": month_start})

        if not revenue:
            logger.warning("no_revenue_data", year=year, month=month)
            return {
                "year": year,
                "month": month,
                "status": "no_revenue_data",
                "worlds_processed": 0,
                "total_earnings_cents": 0
            }

        creator_pool_cents = revenue["creator_pool_cents"]

        # Get world watch aggregates
        world_stats = execute_query("""
            SELECT
                wwa.world_id,
                wwa.total_watch_seconds,
                w.title as world_title,
                w.creator_id,
                w.organization_id
            FROM world_watch_aggregates wwa
            JOIN worlds w ON wwa.world_id = w.id
            WHERE wwa.period_type = 'monthly'
              AND wwa.period_start = :month_start
              AND wwa.total_watch_seconds > 0
        """, {"month_start": month_start})

        if not world_stats:
            logger.info("no_worlds_with_watch_time", year=year, month=month)
            return {
                "year": year,
                "month": month,
                "status": "no_worlds_with_watch_time",
                "worlds_processed": 0,
                "total_earnings_cents": 0
            }

        # Calculate and record earnings for each world
        worlds_processed = 0
        total_earnings_cents = 0

        for world in world_stats:
            world_watch_seconds = world["total_watch_seconds"]

            # Determine payout recipient
            if world["organization_id"]:
                payout_to_type = "organization"
                payout_to_id = world["organization_id"]
            else:
                payout_to_type = "creator"
                payout_to_id = world["creator_id"]

            # Upsert earnings record
            earnings_query = """
                INSERT INTO world_earnings (
                    world_id, period_type, period_start, period_end,
                    world_watch_seconds, platform_watch_seconds, creator_pool_cents,
                    payout_to_type, payout_to_id, status
                ) VALUES (
                    :world_id, 'monthly', :period_start, :period_end,
                    :world_watch_seconds, :platform_watch_seconds, :creator_pool_cents,
                    :payout_to_type, :payout_to_id, 'calculated'
                )
                ON CONFLICT (world_id, period_type, period_start)
                DO UPDATE SET
                    world_watch_seconds = EXCLUDED.world_watch_seconds,
                    platform_watch_seconds = EXCLUDED.platform_watch_seconds,
                    creator_pool_cents = EXCLUDED.creator_pool_cents,
                    payout_to_type = EXCLUDED.payout_to_type,
                    payout_to_id = EXCLUDED.payout_to_id,
                    status = 'calculated',
                    updated_at = NOW()
                RETURNING id, gross_earnings_cents, watch_share_percentage
            """

            result = execute_insert(earnings_query, {
                "world_id": world["world_id"],
                "period_start": month_start,
                "period_end": month_end,
                "world_watch_seconds": world_watch_seconds,
                "platform_watch_seconds": platform_watch_seconds,
                "creator_pool_cents": creator_pool_cents,
                "payout_to_type": payout_to_type,
                "payout_to_id": payout_to_id,
            })

            if result:
                worlds_processed += 1
                total_earnings_cents += result.get("gross_earnings_cents", 0) or 0

        logger.info(
            "monthly_earnings_calculated",
            year=year,
            month=month,
            worlds_processed=worlds_processed,
            total_earnings_cents=total_earnings_cents,
            creator_pool_cents=creator_pool_cents
        )

        return {
            "year": year,
            "month": month,
            "month_start": month_start.isoformat(),
            "month_end": month_end.isoformat(),
            "platform_watch_seconds": platform_watch_seconds,
            "creator_pool_cents": creator_pool_cents,
            "worlds_processed": worlds_processed,
            "total_earnings_cents": total_earnings_cents,
            "status": "calculated"
        }

    @staticmethod
    async def generate_monthly_payouts(year: int, month: int) -> Dict[str, Any]:
        """
        Generate payout records from calculated earnings.

        Steps:
        1. Get all 'calculated' earnings for the month
        2. Group by recipient (creator or org)
        3. Sum earnings per recipient
        4. Create payout record (held if < $25, pending if >= $25)
        5. Create line items linking earnings to payout

        Args:
            year: Year (e.g., 2024)
            month: Month (1-12)

        Returns:
            Dict with payout generation stats
        """
        month_start = datetime(year, month, 1)
        if month == 12:
            month_end = datetime(year + 1, 1, 1)
        else:
            month_end = datetime(year, month + 1, 1)

        logger.info(
            "generating_monthly_payouts",
            year=year,
            month=month
        )

        # Get earnings grouped by recipient
        earnings_by_recipient = execute_query("""
            SELECT
                payout_to_type,
                payout_to_id,
                SUM(gross_earnings_cents) as total_earnings_cents,
                COUNT(*) as worlds_count,
                ARRAY_AGG(id) as earning_ids
            FROM world_earnings
            WHERE period_type = 'monthly'
              AND period_start = :month_start
              AND status = 'calculated'
            GROUP BY payout_to_type, payout_to_id
        """, {"month_start": month_start})

        if not earnings_by_recipient:
            logger.info("no_earnings_to_payout", year=year, month=month)
            return {
                "year": year,
                "month": month,
                "status": "no_earnings",
                "payouts_created": 0,
                "held_count": 0,
                "pending_count": 0
            }

        payouts_created = 0
        held_count = 0
        pending_count = 0

        for recipient in earnings_by_recipient:
            total_cents = recipient["total_earnings_cents"] or 0

            # Determine payout status based on threshold
            payout_status = "pending" if total_cents >= MINIMUM_PAYOUT_CENTS else "held"

            # Create payout record
            payout_query = """
                INSERT INTO creator_payouts (
                    payout_to_type, payout_to_id,
                    period_type, period_start, period_end,
                    gross_amount_cents, status
                ) VALUES (
                    :payout_to_type, :payout_to_id,
                    'monthly', :period_start, :period_end,
                    :gross_amount_cents, :status
                )
                RETURNING id
            """

            payout = execute_insert(payout_query, {
                "payout_to_type": recipient["payout_to_type"],
                "payout_to_id": recipient["payout_to_id"],
                "period_start": month_start,
                "period_end": month_end,
                "gross_amount_cents": total_cents,
                "status": payout_status,
            })

            if not payout:
                continue

            payout_id = payout["id"]
            payouts_created += 1

            if payout_status == "held":
                held_count += 1
            else:
                pending_count += 1

            # Create line items and update earnings status
            earning_ids = recipient["earning_ids"]

            for earning_id in earning_ids:
                # Get earning details for line item
                earning = execute_single("""
                    SELECT we.*, w.title as world_title
                    FROM world_earnings we
                    JOIN worlds w ON we.world_id = w.id
                    WHERE we.id = :earning_id
                """, {"earning_id": earning_id})

                if earning:
                    # Create line item
                    execute_insert("""
                        INSERT INTO payout_line_items (
                            payout_id, world_earning_id, world_id,
                            world_title, amount_cents, watch_share_percentage
                        ) VALUES (
                            :payout_id, :world_earning_id, :world_id,
                            :world_title, :amount_cents, :watch_share_percentage
                        )
                        RETURNING id
                    """, {
                        "payout_id": payout_id,
                        "world_earning_id": earning_id,
                        "world_id": earning["world_id"],
                        "world_title": earning["world_title"],
                        "amount_cents": earning["gross_earnings_cents"],
                        "watch_share_percentage": earning["watch_share_percentage"],
                    })

                    # Update earning status and link to payout
                    execute_update("""
                        UPDATE world_earnings
                        SET status = :status, payout_id = :payout_id, updated_at = NOW()
                        WHERE id = :earning_id
                    """, {
                        "status": payout_status,
                        "payout_id": payout_id,
                        "earning_id": earning_id,
                    })

        logger.info(
            "monthly_payouts_generated",
            year=year,
            month=month,
            payouts_created=payouts_created,
            held_count=held_count,
            pending_count=pending_count
        )

        return {
            "year": year,
            "month": month,
            "status": "generated",
            "payouts_created": payouts_created,
            "held_count": held_count,
            "pending_count": pending_count
        }

    @staticmethod
    async def get_creator_earnings_summary(
        creator_id: str
    ) -> Dict[str, Any]:
        """
        Get earnings summary for a creator.

        Args:
            creator_id: Profile ID of the creator

        Returns:
            Dict with earnings summary
        """
        # Get earnings from worlds they own directly
        direct_earnings = execute_single("""
            SELECT
                COUNT(DISTINCT world_id) as worlds_count,
                SUM(CASE WHEN period_start >= DATE_TRUNC('year', NOW()) THEN gross_earnings_cents ELSE 0 END) as ytd_earnings_cents,
                SUM(gross_earnings_cents) as lifetime_earnings_cents
            FROM world_earnings
            WHERE payout_to_type = 'creator'
              AND payout_to_id = :creator_id
        """, {"creator_id": creator_id})

        # Get pending payouts
        pending_payouts = execute_single("""
            SELECT
                COUNT(*) as count,
                COALESCE(SUM(gross_amount_cents), 0) as total_cents
            FROM creator_payouts
            WHERE payout_to_type = 'creator'
              AND payout_to_id = :creator_id
              AND status IN ('pending', 'approved')
        """, {"creator_id": creator_id})

        # Get paid payouts
        paid_payouts = execute_single("""
            SELECT
                COUNT(*) as count,
                COALESCE(SUM(gross_amount_cents), 0) as total_cents
            FROM creator_payouts
            WHERE payout_to_type = 'creator'
              AND payout_to_id = :creator_id
              AND status = 'completed'
        """, {"creator_id": creator_id})

        # Get held amount (below threshold)
        held = execute_single("""
            SELECT COALESCE(SUM(gross_amount_cents), 0) as total_cents
            FROM creator_payouts
            WHERE payout_to_type = 'creator'
              AND payout_to_id = :creator_id
              AND status = 'held'
        """, {"creator_id": creator_id})

        return {
            "creator_id": creator_id,
            "worlds_with_earnings": direct_earnings.get("worlds_count", 0) if direct_earnings else 0,
            "ytd_earnings_cents": direct_earnings.get("ytd_earnings_cents", 0) if direct_earnings else 0,
            "lifetime_earnings_cents": direct_earnings.get("lifetime_earnings_cents", 0) if direct_earnings else 0,
            "pending_payout_cents": pending_payouts.get("total_cents", 0) if pending_payouts else 0,
            "paid_total_cents": paid_payouts.get("total_cents", 0) if paid_payouts else 0,
            "held_cents": held.get("total_cents", 0) if held else 0,
        }

    @staticmethod
    async def get_organization_earnings_summary(
        organization_id: str
    ) -> Dict[str, Any]:
        """
        Get earnings summary for an organization.

        Args:
            organization_id: Organization ID

        Returns:
            Dict with earnings summary
        """
        # Get earnings from worlds owned by this org
        org_earnings = execute_single("""
            SELECT
                COUNT(DISTINCT world_id) as worlds_count,
                SUM(CASE WHEN period_start >= DATE_TRUNC('year', NOW()) THEN gross_earnings_cents ELSE 0 END) as ytd_earnings_cents,
                SUM(gross_earnings_cents) as lifetime_earnings_cents
            FROM world_earnings
            WHERE payout_to_type = 'organization'
              AND payout_to_id = :organization_id
        """, {"organization_id": organization_id})

        # Get pending payouts
        pending_payouts = execute_single("""
            SELECT
                COUNT(*) as count,
                COALESCE(SUM(gross_amount_cents), 0) as total_cents
            FROM creator_payouts
            WHERE payout_to_type = 'organization'
              AND payout_to_id = :organization_id
              AND status IN ('pending', 'approved')
        """, {"organization_id": organization_id})

        # Get paid payouts
        paid_payouts = execute_single("""
            SELECT
                COUNT(*) as count,
                COALESCE(SUM(gross_amount_cents), 0) as total_cents
            FROM creator_payouts
            WHERE payout_to_type = 'organization'
              AND payout_to_id = :organization_id
              AND status = 'completed'
        """, {"organization_id": organization_id})

        return {
            "organization_id": organization_id,
            "worlds_with_earnings": org_earnings.get("worlds_count", 0) if org_earnings else 0,
            "ytd_earnings_cents": org_earnings.get("ytd_earnings_cents", 0) if org_earnings else 0,
            "lifetime_earnings_cents": org_earnings.get("lifetime_earnings_cents", 0) if org_earnings else 0,
            "pending_payout_cents": pending_payouts.get("total_cents", 0) if pending_payouts else 0,
            "paid_total_cents": paid_payouts.get("total_cents", 0) if paid_payouts else 0,
        }

    @staticmethod
    async def get_payout_details(payout_id: str) -> Dict[str, Any]:
        """
        Get detailed payout information including line items.

        Args:
            payout_id: Payout record ID

        Returns:
            Dict with payout details and line items
        """
        payout = execute_single("""
            SELECT * FROM creator_payouts WHERE id = :payout_id
        """, {"payout_id": payout_id})

        if not payout:
            return None

        # Get line items
        line_items = execute_query("""
            SELECT
                pli.*,
                w.status as world_status
            FROM payout_line_items pli
            JOIN worlds w ON pli.world_id = w.id
            WHERE pli.payout_id = :payout_id
            ORDER BY pli.amount_cents DESC
        """, {"payout_id": payout_id})

        payout["line_items"] = line_items
        return payout

    @staticmethod
    async def approve_payout(
        payout_id: str,
        approved_by: str
    ) -> Dict[str, Any]:
        """
        Approve a pending payout for processing.

        Args:
            payout_id: Payout record ID
            approved_by: Profile ID of approver

        Returns:
            Updated payout record
        """
        result = execute_query("""
            UPDATE creator_payouts
            SET status = 'approved',
                approved_by = :approved_by,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = :payout_id
              AND status = 'pending'
            RETURNING *
        """, {
            "payout_id": payout_id,
            "approved_by": approved_by
        })

        if result:
            logger.info("payout_approved", payout_id=payout_id, approved_by=approved_by)
            return result[0]

        return None


# Module-level convenience functions
async def record_revenue(
    period_start: datetime,
    period_end: datetime,
    period_type: str,
    gross_revenue_cents: int,
    **kwargs
) -> Dict[str, Any]:
    """Record subscription revenue."""
    return await RevenueCalculationService.record_subscription_revenue(
        period_start, period_end, period_type, gross_revenue_cents, **kwargs
    )


async def calculate_earnings(year: int, month: int) -> Dict[str, Any]:
    """Calculate monthly earnings."""
    return await RevenueCalculationService.calculate_monthly_earnings(year, month)


async def generate_payouts(year: int, month: int) -> Dict[str, Any]:
    """Generate monthly payouts."""
    return await RevenueCalculationService.generate_monthly_payouts(year, month)
