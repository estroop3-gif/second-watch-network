"""
Seed Monetization Test Data

Creates test data for verifying watch share and payout calculations:
- 3 Worlds with known watch times
- 2 Organizations
- Monthly watch aggregates for November 2024
- Subscription revenue for November 2024

Expected Results:
- World 1 (Creator A): 60% share = $567 earnings
- World 2 (Creator B): 30% share = $283.50 earnings
- World 3 (Org Alpha):  10% share = $94.50 earnings
- All 3 exceed $25 threshold -> status='pending'
"""

import asyncio
import sys
sys.path.insert(0, '/home/estro/second-watch-network/backend')

from datetime import datetime
from app.core.database import execute_query, execute_single, execute_insert, execute_update

# Test period: November 2024
TEST_YEAR = 2024
TEST_MONTH = 11
MONTH_START = datetime(2024, 11, 1)
MONTH_END = datetime(2024, 12, 1)

# Watch times (seconds)
WORLD_1_WATCH = 360000   # 100 hours -> 60% share
WORLD_2_WATCH = 180000   # 50 hours  -> 30% share
WORLD_3_WATCH = 60000    # 16.7 hrs  -> 10% share
TOTAL_WATCH = 600000

# Revenue (cents)
GROSS_REVENUE = 1000000   # $10,000
REFUNDS = 20000           # $200
CHARGEBACKS = 5000        # $50
STRIPE_FEES = 30000       # $300
NET_REVENUE = 945000      # $9,450
CREATOR_POOL = 94500      # $945 (10%)


def cleanup_test_data():
    """Remove any existing test data"""
    print("Cleaning up existing test data...")

    # Delete test data by looking for our test markers
    execute_update("""
        DELETE FROM payout_line_items WHERE world_title LIKE 'TEST%%'
    """, {})

    execute_update("""
        DELETE FROM creator_payouts WHERE period_start = :month_start
    """, {"month_start": MONTH_START})

    execute_update("""
        DELETE FROM world_earnings WHERE period_start = :month_start
    """, {"month_start": MONTH_START})

    execute_update("""
        DELETE FROM subscription_revenue WHERE period_start = :month_start
    """, {"month_start": MONTH_START})

    execute_update("""
        DELETE FROM world_watch_aggregates WHERE period_start = :month_start
    """, {"month_start": MONTH_START})

    execute_update("""
        DELETE FROM platform_watch_totals WHERE period_start = :month_start
    """, {"month_start": MONTH_START})

    # Delete test worlds
    execute_update("""
        DELETE FROM worlds WHERE title LIKE 'TEST%%'
    """, {})

    # Delete test organization members and orgs
    execute_update("""
        DELETE FROM organization_members WHERE organization_id IN (
            SELECT id FROM organizations WHERE name LIKE 'TEST%%'
        )
    """, {})

    execute_update("""
        DELETE FROM organizations WHERE name LIKE 'TEST%%'
    """, {})

    print("Cleanup complete.")


def seed_test_data():
    """Seed test data for monetization verification"""
    print("\n=== Seeding Test Data ===\n")

    # Get existing profiles to use as creators
    profiles = execute_query("""
        SELECT id, display_name FROM profiles
        WHERE display_name IS NOT NULL
        LIMIT 3
    """, {})

    if len(profiles) < 2:
        print("ERROR: Need at least 2 profiles in database. Creating test profiles...")
        # Use a fallback - just pick first profile and reuse
        profiles = execute_query("SELECT id, display_name FROM profiles LIMIT 1", {})
        if not profiles:
            print("ERROR: No profiles found. Please create some users first.")
            return None
        profiles = [profiles[0], profiles[0], profiles[0]]

    creator_a_id = profiles[0]['id']
    creator_b_id = profiles[1]['id'] if len(profiles) > 1 else profiles[0]['id']

    print(f"Using Creator A: {profiles[0]['display_name']} ({creator_a_id})")
    print(f"Using Creator B: {profiles[1]['display_name'] if len(profiles) > 1 else profiles[0]['display_name']} ({creator_b_id})")

    # Create test organizations
    print("\nCreating test organizations...")

    org_alpha = execute_insert("""
        INSERT INTO organizations (name, slug, status, created_by)
        VALUES ('TEST Org Alpha', 'test-org-alpha', 'active', :creator_id)
        RETURNING id, name
    """, {"creator_id": creator_a_id})
    print(f"  Created: {org_alpha['name']} ({org_alpha['id']})")

    org_beta = execute_insert("""
        INSERT INTO organizations (name, slug, status, created_by)
        VALUES ('TEST Org Beta', 'test-org-beta', 'active', :creator_id)
        RETURNING id, name
    """, {"creator_id": creator_b_id})
    print(f"  Created: {org_beta['name']} ({org_beta['id']})")

    # Add org members
    execute_insert("""
        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (:org_id, :user_id, 'owner', 'active')
        RETURNING id
    """, {"org_id": org_alpha['id'], "user_id": creator_a_id})

    execute_insert("""
        INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (:org_id, :user_id, 'owner', 'active')
        RETURNING id
    """, {"org_id": org_beta['id'], "user_id": creator_b_id})

    # Create test worlds
    print("\nCreating test worlds...")

    world_1 = execute_insert("""
        INSERT INTO worlds (title, slug, logline, creator_id, status, visibility, content_format)
        VALUES ('TEST World One', 'test-world-one', 'Test world for monetization', :creator_id, 'active', 'public', 'series')
        RETURNING id, title
    """, {"creator_id": creator_a_id})
    print(f"  Created: {world_1['title']} (creator-owned, 60% share)")

    world_2 = execute_insert("""
        INSERT INTO worlds (title, slug, logline, creator_id, status, visibility, content_format)
        VALUES ('TEST World Two', 'test-world-two', 'Test world for monetization', :creator_id, 'active', 'public', 'series')
        RETURNING id, title
    """, {"creator_id": creator_b_id})
    print(f"  Created: {world_2['title']} (creator-owned, 30% share)")

    world_3 = execute_insert("""
        INSERT INTO worlds (title, slug, logline, creator_id, organization_id, status, visibility, content_format)
        VALUES ('TEST World Three', 'test-world-three', 'Test world owned by org', :creator_id, :org_id, 'active', 'public', 'series')
        RETURNING id, title
    """, {"creator_id": creator_a_id, "org_id": org_alpha['id']})
    print(f"  Created: {world_3['title']} (ORG-owned, 10% share)")

    # Create monthly watch aggregates
    print("\nCreating watch aggregates for November 2024...")

    execute_insert("""
        INSERT INTO world_watch_aggregates
        (world_id, period_type, period_start, period_end, total_watch_seconds, unique_viewers, total_sessions, completed_episodes)
        VALUES (:world_id, 'monthly', :start, :end, :watch_seconds, 500, 1500, 200)
        RETURNING id
    """, {"world_id": world_1['id'], "start": MONTH_START, "end": MONTH_END, "watch_seconds": WORLD_1_WATCH})
    print(f"  World 1: {WORLD_1_WATCH:,} seconds ({WORLD_1_WATCH/3600:.1f} hours)")

    execute_insert("""
        INSERT INTO world_watch_aggregates
        (world_id, period_type, period_start, period_end, total_watch_seconds, unique_viewers, total_sessions, completed_episodes)
        VALUES (:world_id, 'monthly', :start, :end, :watch_seconds, 250, 750, 100)
        RETURNING id
    """, {"world_id": world_2['id'], "start": MONTH_START, "end": MONTH_END, "watch_seconds": WORLD_2_WATCH})
    print(f"  World 2: {WORLD_2_WATCH:,} seconds ({WORLD_2_WATCH/3600:.1f} hours)")

    execute_insert("""
        INSERT INTO world_watch_aggregates
        (world_id, period_type, period_start, period_end, total_watch_seconds, unique_viewers, total_sessions, completed_episodes)
        VALUES (:world_id, 'monthly', :start, :end, :watch_seconds, 100, 300, 40)
        RETURNING id
    """, {"world_id": world_3['id'], "start": MONTH_START, "end": MONTH_END, "watch_seconds": WORLD_3_WATCH})
    print(f"  World 3: {WORLD_3_WATCH:,} seconds ({WORLD_3_WATCH/3600:.1f} hours)")

    # Create platform totals
    execute_insert("""
        INSERT INTO platform_watch_totals
        (period_type, period_start, period_end, total_watch_seconds, active_worlds_count, total_unique_viewers, total_sessions)
        VALUES ('monthly', :start, :end, :total_watch, 3, 850, 2550)
        RETURNING id
    """, {"start": MONTH_START, "end": MONTH_END, "total_watch": TOTAL_WATCH})
    print(f"  Platform total: {TOTAL_WATCH:,} seconds")

    # Create subscription revenue
    print("\nCreating subscription revenue for November 2024...")

    revenue = execute_insert("""
        INSERT INTO subscription_revenue
        (period_type, period_start, period_end, gross_revenue_cents, refunds_cents, chargebacks_cents, stripe_fees_cents, total_subscribers)
        VALUES ('monthly', :start, :end, :gross, :refunds, :chargebacks, :fees, 500)
        RETURNING id, net_revenue_cents, creator_pool_cents
    """, {
        "start": MONTH_START,
        "end": MONTH_END,
        "gross": GROSS_REVENUE,
        "refunds": REFUNDS,
        "chargebacks": CHARGEBACKS,
        "fees": STRIPE_FEES
    })
    print(f"  Gross Revenue: ${GROSS_REVENUE/100:,.2f}")
    print(f"  Net Revenue:   ${revenue['net_revenue_cents']/100:,.2f}")
    print(f"  Creator Pool:  ${revenue['creator_pool_cents']/100:,.2f} (10%)")

    return {
        'world_1': world_1,
        'world_2': world_2,
        'world_3': world_3,
        'org_alpha': org_alpha,
        'org_beta': org_beta,
        'creator_a_id': creator_a_id,
        'creator_b_id': creator_b_id,
        'revenue': revenue
    }


async def run_calculations():
    """Run earnings calculation and payout generation"""
    from app.services.revenue_calculation import RevenueCalculationService

    print("\n=== Running Calculations ===\n")

    # Calculate monthly earnings
    print("Calculating monthly earnings...")
    earnings_result = await RevenueCalculationService.calculate_monthly_earnings(TEST_YEAR, TEST_MONTH)
    print(f"  Status: {earnings_result['status']}")
    print(f"  Worlds processed: {earnings_result['worlds_processed']}")
    print(f"  Total earnings: ${earnings_result['total_earnings_cents']/100:,.2f}")

    # Generate payouts
    print("\nGenerating payouts...")
    payout_result = await RevenueCalculationService.generate_monthly_payouts(TEST_YEAR, TEST_MONTH)
    print(f"  Status: {payout_result['status']}")
    print(f"  Payouts created: {payout_result['payouts_created']}")
    print(f"  Pending (>=$25): {payout_result['pending_count']}")
    print(f"  Held (<$25): {payout_result['held_count']}")

    return earnings_result, payout_result


def verify_results(test_data):
    """Verify the calculations match expected values"""
    print("\n=== Verification ===\n")

    # Get world earnings
    earnings = execute_query("""
        SELECT
            we.world_id,
            w.title,
            we.world_watch_seconds,
            we.platform_watch_seconds,
            we.watch_share_percentage,
            we.gross_earnings_cents,
            we.payout_to_type,
            we.payout_to_id,
            we.status
        FROM world_earnings we
        JOIN worlds w ON we.world_id = w.id
        WHERE we.period_start = :month_start
        ORDER BY we.gross_earnings_cents DESC
    """, {"month_start": MONTH_START})

    print("World Earnings:")
    print("-" * 90)
    print(f"{'World':<25} {'Watch %':>10} {'Earnings':>12} {'Payout To':>15} {'Status':>10}")
    print("-" * 90)

    total_earnings = 0
    all_correct = True

    for e in earnings:
        share = float(e['watch_share_percentage'])
        cents = e['gross_earnings_cents']
        total_earnings += cents

        # Expected values
        if 'One' in e['title']:
            expected_share = 60.0
            expected_cents_min, expected_cents_max = 56000, 57500
            expected_type = 'creator'
        elif 'Two' in e['title']:
            expected_share = 30.0
            expected_cents_min, expected_cents_max = 28000, 29000
            expected_type = 'creator'
        else:
            expected_share = 10.0
            expected_cents_min, expected_cents_max = 9000, 10000
            expected_type = 'organization'

        # Check correctness
        share_ok = abs(share - expected_share) < 1.0
        earnings_ok = expected_cents_min <= cents <= expected_cents_max
        type_ok = e['payout_to_type'] == expected_type

        status_icon = "✓" if (share_ok and earnings_ok and type_ok) else "✗"
        if not (share_ok and earnings_ok and type_ok):
            all_correct = False

        print(f"{e['title']:<25} {share:>9.2f}% ${cents/100:>10,.2f} {e['payout_to_type']:>15} {e['status']:>10} {status_icon}")

    print("-" * 90)
    print(f"{'TOTAL':<25} {'100.00%':>10} ${total_earnings/100:>10,.2f}")

    # Get payouts
    print("\n\nPayouts Generated:")
    print("-" * 80)

    payouts = execute_query("""
        SELECT
            cp.id,
            cp.payout_to_type,
            cp.gross_amount_cents,
            cp.status,
            CASE
                WHEN cp.payout_to_type = 'creator' THEN p.display_name
                WHEN cp.payout_to_type = 'organization' THEN o.name
            END as recipient_name,
            (SELECT COUNT(*) FROM payout_line_items WHERE payout_id = cp.id) as worlds_count
        FROM creator_payouts cp
        LEFT JOIN profiles p ON cp.payout_to_type = 'creator' AND cp.payout_to_id = p.id
        LEFT JOIN organizations o ON cp.payout_to_type = 'organization' AND cp.payout_to_id = o.id
        WHERE cp.period_start = :month_start
        ORDER BY cp.gross_amount_cents DESC
    """, {"month_start": MONTH_START})

    print(f"{'Recipient':<30} {'Type':>12} {'Amount':>12} {'Worlds':>8} {'Status':>10}")
    print("-" * 80)

    for p in payouts:
        status_icon = "✓" if p['status'] == 'pending' else "⏸"
        print(f"{p['recipient_name'] or 'Unknown':<30} {p['payout_to_type']:>12} ${p['gross_amount_cents']/100:>10,.2f} {p['worlds_count']:>8} {p['status']:>10} {status_icon}")

    # Summary
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)

    checks = [
        ("3 worlds with earnings", len(earnings) == 3),
        ("World 1 has ~60% share", any(59 < float(e['watch_share_percentage']) < 61 for e in earnings)),
        ("World 2 has ~30% share", any(29 < float(e['watch_share_percentage']) < 31 for e in earnings)),
        ("World 3 has ~10% share", any(9 < float(e['watch_share_percentage']) < 11 for e in earnings)),
        ("Org-owned world routes to organization", any(e['payout_to_type'] == 'organization' for e in earnings)),
        ("All payouts are 'pending' (>$25)", all(p['status'] == 'pending' for p in payouts)),
        ("Total earnings ≈ creator pool ($945)", 94000 <= total_earnings <= 95000),
    ]

    for check_name, passed in checks:
        icon = "✓" if passed else "✗"
        print(f"  {icon} {check_name}")

    all_passed = all(passed for _, passed in checks)
    print("\n" + ("✓ ALL CHECKS PASSED!" if all_passed else "✗ SOME CHECKS FAILED"))

    return all_passed


def main():
    print("=" * 80)
    print("MONETIZATION TEST DATA SEEDING & VERIFICATION")
    print("=" * 80)

    # Cleanup first
    cleanup_test_data()

    # Seed data
    test_data = seed_test_data()
    if not test_data:
        return False

    # Run calculations
    asyncio.run(run_calculations())

    # Verify results
    success = verify_results(test_data)

    print("\n" + "=" * 80)
    if success:
        print("TEST COMPLETE - All verifications passed!")
    else:
        print("TEST COMPLETE - Some verifications failed. Check output above.")
    print("=" * 80)

    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
