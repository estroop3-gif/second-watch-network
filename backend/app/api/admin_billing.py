"""
Admin Billing API — Dashboard stats, subscription listing, transaction history.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.deps import require_admin
from app.core.database import execute_query, execute_single
from app.core.config import settings

router = APIRouter()


@router.get("/billing/stats")
async def get_billing_stats(admin=Depends(require_admin)):
    """Get billing dashboard summary stats."""
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    stats = {
        "total_subscribers": 0,
        "mrr_cents": 0,
        "past_due_count": 0,
        "active_trials": 0,
        "total_revenue_cents": 0,
    }

    # Count active Backlot org subscriptions
    backlot_subs = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'active') AS active_count,
            COUNT(*) FILTER (WHERE status = 'past_due') AS past_due_count,
            COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_amount_cents ELSE 0 END), 0) AS mrr_cents
        FROM backlot_subscription_configs
        WHERE status IN ('active', 'past_due', 'trialing')
    """)

    if backlot_subs:
        stats["total_subscribers"] += backlot_subs.get("active_count", 0) or 0
        stats["past_due_count"] += backlot_subs.get("past_due_count", 0) or 0
        stats["mrr_cents"] += backlot_subs.get("mrr_cents", 0) or 0

    # Count premium individual subscriptions
    premium_subs = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE subscription_status = 'active') AS active_count,
            COUNT(*) FILTER (WHERE subscription_status = 'past_due') AS past_due_count
        FROM profiles
        WHERE subscription_status IN ('active', 'past_due', 'trialing')
    """)

    if premium_subs:
        stats["total_subscribers"] += premium_subs.get("active_count", 0) or 0
        stats["past_due_count"] += premium_subs.get("past_due_count", 0) or 0

    # Count Order dues subscriptions
    order_subs = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE dues_status = 'active') AS active_count
        FROM order_member_profiles
        WHERE dues_status IS NOT NULL
    """)

    if order_subs:
        stats["total_subscribers"] += order_subs.get("active_count", 0) or 0

    # Count active trials
    trials = execute_single("""
        SELECT COUNT(*) AS count FROM backlot_trial_requests WHERE status = 'active'
    """)
    if trials:
        stats["active_trials"] = trials.get("count", 0) or 0

    return stats


@router.get("/billing/subscriptions")
async def list_subscriptions(
    status: Optional[str] = Query(None),
    product: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin=Depends(require_admin),
):
    """List all subscriptions across products."""
    results = []

    # Backlot org subscriptions
    if not product or product == "backlot_org":
        where_clause = "WHERE 1=1"
        params = {"skip": skip, "limit": limit}
        if status:
            where_clause += " AND sc.status = :status"
            params["status"] = status

        rows = execute_query(f"""
            SELECT
                sc.id,
                sc.organization_id,
                o.name AS org_name,
                sc.tier_id,
                ot.name AS tier_name,
                sc.status,
                sc.stripe_subscription_id,
                sc.monthly_amount_cents,
                sc.billing_interval,
                sc.past_due_since,
                sc.created_at,
                sc.updated_at
            FROM backlot_subscription_configs sc
            JOIN organizations o ON o.id = sc.organization_id
            LEFT JOIN organization_tiers ot ON ot.id = sc.tier_id
            {where_clause}
            ORDER BY sc.created_at DESC
            OFFSET :skip LIMIT :limit
        """, params)

        for row in rows:
            results.append({
                "id": str(row["id"]),
                "product": "backlot_org",
                "name": row.get("org_name", ""),
                "tier": row.get("tier_name", ""),
                "status": row.get("status", ""),
                "stripe_subscription_id": row.get("stripe_subscription_id"),
                "amount_cents": row.get("monthly_amount_cents", 0),
                "interval": row.get("billing_interval", "month"),
                "past_due_since": str(row["past_due_since"]) if row.get("past_due_since") else None,
                "created_at": str(row["created_at"]) if row.get("created_at") else None,
            })

    # Premium individual subscriptions
    if not product or product == "premium":
        where_clause = "WHERE subscription_status IS NOT NULL AND subscription_status != ''"
        params = {"skip": skip, "limit": limit}
        if status:
            where_clause += " AND subscription_status = :status"
            params["status"] = status

        rows = execute_query(f"""
            SELECT
                id, display_name, email,
                subscription_status, subscription_tier,
                subscription_period_end,
                stripe_customer_id,
                created_at
            FROM profiles
            {where_clause}
            ORDER BY created_at DESC
            OFFSET :skip LIMIT :limit
        """, params)

        for row in rows:
            results.append({
                "id": str(row["id"]),
                "product": "premium",
                "name": row.get("display_name", row.get("email", "")),
                "tier": row.get("subscription_tier", "premium"),
                "status": row.get("subscription_status", ""),
                "stripe_subscription_id": None,
                "amount_cents": None,
                "interval": "month",
                "past_due_since": None,
                "created_at": str(row["created_at"]) if row.get("created_at") else None,
            })

    # Order dues
    if not product or product == "order_dues":
        where_clause = "WHERE omp.dues_status IS NOT NULL AND omp.dues_status != ''"
        params = {"skip": skip, "limit": limit}
        if status:
            where_clause += " AND omp.dues_status = :status"
            params["status"] = status

        rows = execute_query(f"""
            SELECT
                omp.user_id,
                p.display_name,
                p.email,
                omp.dues_status,
                omp.membership_tier,
                omp.created_at
            FROM order_member_profiles omp
            JOIN profiles p ON p.id = omp.user_id
            {where_clause}
            ORDER BY omp.created_at DESC
            OFFSET :skip LIMIT :limit
        """, params)

        for row in rows:
            tier_prices = {"base": 5000, "steward": 10000, "patron": 25000}
            results.append({
                "id": str(row["user_id"]),
                "product": "order_dues",
                "name": row.get("display_name", row.get("email", "")),
                "tier": row.get("membership_tier", "base"),
                "status": row.get("dues_status", ""),
                "stripe_subscription_id": None,
                "amount_cents": tier_prices.get(row.get("membership_tier", "base"), 5000),
                "interval": "month",
                "past_due_since": None,
                "created_at": str(row["created_at"]) if row.get("created_at") else None,
            })

    return {"subscriptions": results, "total": len(results)}


@router.get("/billing/transactions")
async def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin=Depends(require_admin),
):
    """List recent billing transactions from billing events and dues payments."""
    transactions = []

    # Backlot billing events
    events = execute_query("""
        SELECT
            be.id,
            be.organization_id,
            o.name AS org_name,
            be.event_type,
            be.old_status,
            be.new_status,
            be.created_at
        FROM backlot_billing_events be
        LEFT JOIN organizations o ON o.id = be.organization_id
        ORDER BY be.created_at DESC
        OFFSET :skip LIMIT :limit
    """, {"skip": skip, "limit": limit})

    for e in events:
        transactions.append({
            "id": str(e["id"]),
            "type": "billing_event",
            "description": f"{e.get('event_type', '')} — {e.get('org_name', 'Unknown org')}",
            "status": e.get("new_status", ""),
            "amount_cents": None,
            "created_at": str(e["created_at"]) if e.get("created_at") else None,
        })

    # Order dues payments
    dues = execute_query("""
        SELECT
            odp.id,
            p.display_name,
            odp.amount_cents,
            odp.tier,
            odp.status,
            odp.created_at
        FROM order_dues_payments odp
        LEFT JOIN profiles p ON p.id = odp.user_id
        ORDER BY odp.created_at DESC
        OFFSET :skip LIMIT :limit
    """, {"skip": skip, "limit": limit})

    for d in dues:
        transactions.append({
            "id": str(d["id"]),
            "type": "order_dues",
            "description": f"Order dues ({d.get('tier', 'base')}) — {d.get('display_name', 'Unknown')}",
            "status": d.get("status", ""),
            "amount_cents": d.get("amount_cents", 0),
            "created_at": str(d["created_at"]) if d.get("created_at") else None,
        })

    # Donations
    try:
        donations = execute_query("""
            SELECT
                pd.id,
                pd.amount_cents,
                pd.status,
                pd.donor_name,
                pd.is_anonymous,
                bp.title AS project_title,
                pd.created_at
            FROM project_donations pd
            LEFT JOIN backlot_projects bp ON bp.id = pd.project_id
            ORDER BY pd.created_at DESC
            OFFSET :skip LIMIT :limit
        """, {"skip": skip, "limit": limit})

        for d in donations:
            donor = "Anonymous" if d.get("is_anonymous") else (d.get("donor_name") or "Unknown")
            transactions.append({
                "id": str(d["id"]),
                "type": "donation",
                "description": f"Donation to {d.get('project_title', 'project')} by {donor}",
                "status": d.get("status", ""),
                "amount_cents": d.get("amount_cents", 0),
                "created_at": str(d["created_at"]) if d.get("created_at") else None,
            })
    except Exception:
        pass  # project_donations table may not exist

    # Sort all by date descending
    transactions.sort(key=lambda t: t.get("created_at") or "", reverse=True)
    return {"transactions": transactions[:limit], "total": len(transactions)}
