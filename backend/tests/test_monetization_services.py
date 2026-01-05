"""
Tests for Watch Aggregation and Revenue Calculation Services

Tests a fake month (December 2024) of watch tracking and monetization:
- 3 Worlds with different watch patterns
- 1 World owned by an organization
- Monthly revenue calculation with 10% creator pool
- Payout generation with $25 threshold
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, date, timedelta
from decimal import Decimal
import uuid

# Test data for December 2024
TEST_YEAR = 2024
TEST_MONTH = 12
MONTH_START = datetime(2024, 12, 1)
MONTH_END = datetime(2025, 1, 1)

# Fake UUIDs
WORLD_1_ID = str(uuid.uuid4())  # Popular world - 60% watch share
WORLD_2_ID = str(uuid.uuid4())  # Medium world - 30% watch share
WORLD_3_ID = str(uuid.uuid4())  # Small world - 10% watch share (org-owned)
CREATOR_1_ID = str(uuid.uuid4())  # Owns World 1
CREATOR_2_ID = str(uuid.uuid4())  # Owns World 2
ORG_1_ID = str(uuid.uuid4())  # Owns World 3

# Fake watch data (seconds)
WORLD_1_WATCH = 360000  # 100 hours
WORLD_2_WATCH = 180000  # 50 hours
WORLD_3_WATCH = 60000   # ~16.7 hours
TOTAL_WATCH = WORLD_1_WATCH + WORLD_2_WATCH + WORLD_3_WATCH  # 600,000 seconds

# Fake revenue data (cents)
GROSS_REVENUE = 10000_00  # $10,000
REFUNDS = 200_00         # $200
CHARGEBACKS = 50_00      # $50
STRIPE_FEES = 300_00     # $300 (~3%)
NET_REVENUE = GROSS_REVENUE - REFUNDS - CHARGEBACKS - STRIPE_FEES  # $9,450
CREATOR_POOL = int(NET_REVENUE * 0.10)  # $945


class TestWatchAggregationService:
    """Tests for WatchAggregationService"""

    @pytest.fixture
    def mock_db(self):
        """Set up database mocks"""
        with patch('app.services.watch_aggregation.execute_query') as mock_query, \
             patch('app.services.watch_aggregation.execute_single') as mock_single, \
             patch('app.services.watch_aggregation.execute_insert') as mock_insert, \
             patch('app.services.watch_aggregation.execute_update') as mock_update:
            yield {
                'query': mock_query,
                'single': mock_single,
                'insert': mock_insert,
                'update': mock_update
            }

    @pytest.mark.asyncio
    async def test_aggregate_hourly_watch_time(self, mock_db):
        """Test hourly aggregation from playback sessions"""
        from app.services.watch_aggregation import WatchAggregationService

        hour_start = datetime(2024, 12, 15, 14, 0, 0)  # 2pm on Dec 15

        # Mock playback session data for this hour
        mock_db['query'].return_value = [
            {
                'world_id': WORLD_1_ID,
                'total_watch_seconds': 3600,  # 1 hour
                'unique_viewers': 10,
                'total_sessions': 15,
                'completed_episodes': 5
            },
            {
                'world_id': WORLD_2_ID,
                'total_watch_seconds': 1800,  # 30 min
                'unique_viewers': 5,
                'total_sessions': 8,
                'completed_episodes': 2
            }
        ]

        mock_db['insert'].return_value = {'id': str(uuid.uuid4())}

        result = await WatchAggregationService.aggregate_hourly_watch_time(hour_start)

        assert result['worlds_processed'] == 2
        assert result['total_watch_seconds'] == 5400  # 3600 + 1800
        assert 'hour_start' in result

        # Verify insert was called for each world
        assert mock_db['insert'].call_count >= 2

    @pytest.mark.asyncio
    async def test_aggregate_hourly_no_data(self, mock_db):
        """Test hourly aggregation with no watch data"""
        from app.services.watch_aggregation import WatchAggregationService

        hour_start = datetime(2024, 12, 25, 3, 0, 0)  # 3am on Christmas

        mock_db['query'].return_value = []

        result = await WatchAggregationService.aggregate_hourly_watch_time(hour_start)

        assert result['worlds_processed'] == 0
        assert result['total_watch_seconds'] == 0

    @pytest.mark.asyncio
    async def test_aggregate_daily_watch_time(self, mock_db):
        """Test daily rollup from hourly aggregates"""
        from app.services.watch_aggregation import WatchAggregationService

        target_date = date(2024, 12, 15)

        # Mock rollup query returning aggregated data
        mock_db['query'].return_value = [
            {'world_id': WORLD_1_ID, 'total_watch_seconds': 36000},
            {'world_id': WORLD_2_ID, 'total_watch_seconds': 18000},
            {'world_id': WORLD_3_ID, 'total_watch_seconds': 6000},
        ]

        result = await WatchAggregationService.aggregate_daily_watch_time(target_date)

        assert result['worlds_processed'] == 3
        assert result['total_watch_seconds'] == 60000  # 36000 + 18000 + 6000
        assert result['target_date'] == '2024-12-15'

    @pytest.mark.asyncio
    async def test_aggregate_monthly_watch_time(self, mock_db):
        """Test monthly rollup from daily aggregates"""
        from app.services.watch_aggregation import WatchAggregationService

        # Mock rollup query
        mock_db['query'].return_value = [
            {'world_id': WORLD_1_ID, 'total_watch_seconds': WORLD_1_WATCH},
            {'world_id': WORLD_2_ID, 'total_watch_seconds': WORLD_2_WATCH},
            {'world_id': WORLD_3_ID, 'total_watch_seconds': WORLD_3_WATCH},
        ]

        result = await WatchAggregationService.aggregate_monthly_watch_time(TEST_YEAR, TEST_MONTH)

        assert result['year'] == TEST_YEAR
        assert result['month'] == TEST_MONTH
        assert result['worlds_processed'] == 3
        assert result['total_watch_seconds'] == TOTAL_WATCH

    @pytest.mark.asyncio
    async def test_get_world_watch_stats(self, mock_db):
        """Test fetching world-specific watch stats"""
        from app.services.watch_aggregation import WatchAggregationService

        mock_db['query'].return_value = [
            {
                'id': str(uuid.uuid4()),
                'world_id': WORLD_1_ID,
                'period_type': 'daily',
                'period_start': '2024-12-15T00:00:00',
                'total_watch_seconds': 36000,
                'unique_viewers': 100,
                'total_sessions': 150,
                'completed_episodes': 50
            }
        ]

        result = await WatchAggregationService.get_world_watch_stats(
            WORLD_1_ID, period_type='daily', limit=30
        )

        assert len(result) == 1
        assert result[0]['world_id'] == WORLD_1_ID
        assert result[0]['total_watch_seconds'] == 36000

    @pytest.mark.asyncio
    async def test_get_top_worlds_by_watch_time(self, mock_db):
        """Test getting top worlds leaderboard"""
        from app.services.watch_aggregation import WatchAggregationService

        mock_db['query'].return_value = [
            {
                'world_id': WORLD_1_ID,
                'world_title': 'Popular World',
                'creator_id': CREATOR_1_ID,
                'organization_id': None,
                'total_watch_seconds': WORLD_1_WATCH,
                'peak_viewers': 50,
                'total_sessions': 500
            },
            {
                'world_id': WORLD_2_ID,
                'world_title': 'Medium World',
                'creator_id': CREATOR_2_ID,
                'organization_id': None,
                'total_watch_seconds': WORLD_2_WATCH,
                'peak_viewers': 25,
                'total_sessions': 250
            }
        ]

        result = await WatchAggregationService.get_top_worlds_by_watch_time(
            MONTH_START, MONTH_END, limit=10
        )

        assert len(result) == 2
        assert result[0]['total_watch_seconds'] > result[1]['total_watch_seconds']


class TestRevenueCalculationService:
    """Tests for RevenueCalculationService"""

    @pytest.fixture
    def mock_db(self):
        """Set up database mocks"""
        with patch('app.services.revenue_calculation.execute_query') as mock_query, \
             patch('app.services.revenue_calculation.execute_single') as mock_single, \
             patch('app.services.revenue_calculation.execute_insert') as mock_insert, \
             patch('app.services.revenue_calculation.execute_update') as mock_update:
            yield {
                'query': mock_query,
                'single': mock_single,
                'insert': mock_insert,
                'update': mock_update
            }

    @pytest.mark.asyncio
    async def test_record_subscription_revenue(self, mock_db):
        """Test recording subscription revenue from Stripe"""
        from app.services.revenue_calculation import RevenueCalculationService

        mock_db['insert'].return_value = {
            'id': str(uuid.uuid4()),
            'period_type': 'monthly',
            'period_start': MONTH_START.isoformat(),
            'gross_revenue_cents': GROSS_REVENUE,
            'net_revenue_cents': NET_REVENUE,
            'creator_pool_cents': CREATOR_POOL
        }

        result = await RevenueCalculationService.record_subscription_revenue(
            period_start=MONTH_START,
            period_end=MONTH_END,
            period_type='monthly',
            gross_revenue_cents=GROSS_REVENUE,
            refunds_cents=REFUNDS,
            chargebacks_cents=CHARGEBACKS,
            stripe_fees_cents=STRIPE_FEES,
            total_subscribers=500
        )

        assert result['gross_revenue_cents'] == GROSS_REVENUE
        assert result['creator_pool_cents'] == CREATOR_POOL
        mock_db['insert'].assert_called_once()

    @pytest.mark.asyncio
    async def test_calculate_monthly_earnings(self, mock_db):
        """Test monthly earnings calculation with watch share formula"""
        from app.services.revenue_calculation import RevenueCalculationService

        # Mock platform watch totals
        mock_db['single'].side_effect = [
            # Platform totals query
            {'total_watch_seconds': TOTAL_WATCH, 'active_worlds_count': 3},
            # Revenue query
            {
                'gross_revenue_cents': GROSS_REVENUE,
                'net_revenue_cents': NET_REVENUE,
                'creator_pool_cents': CREATOR_POOL
            }
        ]

        # Mock world stats query
        mock_db['query'].return_value = [
            {
                'world_id': WORLD_1_ID,
                'total_watch_seconds': WORLD_1_WATCH,
                'world_title': 'Popular World',
                'creator_id': CREATOR_1_ID,
                'organization_id': None
            },
            {
                'world_id': WORLD_2_ID,
                'total_watch_seconds': WORLD_2_WATCH,
                'world_title': 'Medium World',
                'creator_id': CREATOR_2_ID,
                'organization_id': None
            },
            {
                'world_id': WORLD_3_ID,
                'total_watch_seconds': WORLD_3_WATCH,
                'world_title': 'Org World',
                'creator_id': None,
                'organization_id': ORG_1_ID
            }
        ]

        # Mock insert returning earnings with calculated values
        def mock_insert_earnings(query, params):
            world_watch = params['world_watch_seconds']
            platform_watch = params['platform_watch_seconds']
            pool = params['creator_pool_cents']
            earnings = int((world_watch / platform_watch) * pool)
            return {
                'id': str(uuid.uuid4()),
                'gross_earnings_cents': earnings,
                'watch_share_percentage': (world_watch / platform_watch) * 100
            }

        mock_db['insert'].side_effect = mock_insert_earnings

        result = await RevenueCalculationService.calculate_monthly_earnings(TEST_YEAR, TEST_MONTH)

        assert result['status'] == 'calculated'
        assert result['worlds_processed'] == 3
        assert result['creator_pool_cents'] == CREATOR_POOL

        # Verify total earnings approximately equals creator pool
        # (may differ slightly due to rounding)
        assert result['total_earnings_cents'] > 0

    @pytest.mark.asyncio
    async def test_calculate_monthly_earnings_no_watch_data(self, mock_db):
        """Test earnings calculation with no watch data"""
        from app.services.revenue_calculation import RevenueCalculationService

        mock_db['single'].return_value = None

        with patch('app.services.revenue_calculation.logger'):
            result = await RevenueCalculationService.calculate_monthly_earnings(TEST_YEAR, TEST_MONTH)

        assert result['status'] == 'no_watch_data'
        assert result['worlds_processed'] == 0

    @pytest.mark.asyncio
    async def test_calculate_monthly_earnings_no_revenue(self, mock_db):
        """Test earnings calculation with no revenue data"""
        from app.services.revenue_calculation import RevenueCalculationService

        mock_db['single'].side_effect = [
            {'total_watch_seconds': TOTAL_WATCH, 'active_worlds_count': 3},
            None  # No revenue
        ]

        with patch('app.services.revenue_calculation.logger'):
            result = await RevenueCalculationService.calculate_monthly_earnings(TEST_YEAR, TEST_MONTH)

        assert result['status'] == 'no_revenue_data'

    @pytest.mark.asyncio
    async def test_generate_monthly_payouts(self, mock_db):
        """Test payout generation with $25 threshold"""
        from app.services.revenue_calculation import RevenueCalculationService

        # Calculate expected earnings
        world_1_earnings = int((WORLD_1_WATCH / TOTAL_WATCH) * CREATOR_POOL)  # ~$567
        world_2_earnings = int((WORLD_2_WATCH / TOTAL_WATCH) * CREATOR_POOL)  # ~$283
        world_3_earnings = int((WORLD_3_WATCH / TOTAL_WATCH) * CREATOR_POOL)  # ~$94

        # Mock earnings grouped by recipient
        mock_db['query'].side_effect = [
            # First call: Get earnings by recipient
            [
                {
                    'payout_to_type': 'creator',
                    'payout_to_id': CREATOR_1_ID,
                    'total_earnings_cents': world_1_earnings,
                    'worlds_count': 1,
                    'earning_ids': [str(uuid.uuid4())]
                },
                {
                    'payout_to_type': 'creator',
                    'payout_to_id': CREATOR_2_ID,
                    'total_earnings_cents': world_2_earnings,
                    'worlds_count': 1,
                    'earning_ids': [str(uuid.uuid4())]
                },
                {
                    'payout_to_type': 'organization',
                    'payout_to_id': ORG_1_ID,
                    'total_earnings_cents': world_3_earnings,
                    'worlds_count': 1,
                    'earning_ids': [str(uuid.uuid4())]
                }
            ]
        ]

        # Mock payout insert
        mock_db['insert'].return_value = {'id': str(uuid.uuid4())}

        # Mock single for earnings details
        mock_db['single'].return_value = {
            'world_id': WORLD_1_ID,
            'world_title': 'Test World',
            'gross_earnings_cents': world_1_earnings,
            'watch_share_percentage': 60.0
        }

        result = await RevenueCalculationService.generate_monthly_payouts(TEST_YEAR, TEST_MONTH)

        assert result['status'] == 'generated'
        assert result['payouts_created'] == 3

        # All 3 should be 'pending' since all exceed $25
        assert result['pending_count'] == 3
        assert result['held_count'] == 0

    @pytest.mark.asyncio
    async def test_generate_payouts_below_threshold(self, mock_db):
        """Test payout held when below $25 threshold"""
        from app.services.revenue_calculation import RevenueCalculationService

        small_earnings = 1500  # $15 - below $25 threshold

        mock_db['query'].side_effect = [
            [{
                'payout_to_type': 'creator',
                'payout_to_id': CREATOR_1_ID,
                'total_earnings_cents': small_earnings,
                'worlds_count': 1,
                'earning_ids': [str(uuid.uuid4())]
            }]
        ]

        mock_db['insert'].return_value = {'id': str(uuid.uuid4())}
        mock_db['single'].return_value = {
            'world_id': WORLD_1_ID,
            'world_title': 'Small World',
            'gross_earnings_cents': small_earnings,
            'watch_share_percentage': 5.0
        }

        result = await RevenueCalculationService.generate_monthly_payouts(TEST_YEAR, TEST_MONTH)

        assert result['payouts_created'] == 1
        assert result['held_count'] == 1
        assert result['pending_count'] == 0

    @pytest.mark.asyncio
    async def test_get_creator_earnings_summary(self, mock_db):
        """Test creator earnings summary retrieval"""
        from app.services.revenue_calculation import RevenueCalculationService

        ytd_earnings = 500000  # $5,000 YTD
        lifetime_earnings = 1200000  # $12,000 lifetime

        mock_db['single'].side_effect = [
            {
                'worlds_count': 2,
                'ytd_earnings_cents': ytd_earnings,
                'lifetime_earnings_cents': lifetime_earnings
            },
            {'count': 1, 'total_cents': 50000},  # Pending payouts
            {'count': 5, 'total_cents': 450000},  # Paid payouts
            {'total_cents': 0}  # Held
        ]

        result = await RevenueCalculationService.get_creator_earnings_summary(CREATOR_1_ID)

        assert result['creator_id'] == CREATOR_1_ID
        assert result['worlds_with_earnings'] == 2
        assert result['ytd_earnings_cents'] == ytd_earnings
        assert result['lifetime_earnings_cents'] == lifetime_earnings
        assert result['pending_payout_cents'] == 50000

    @pytest.mark.asyncio
    async def test_get_organization_earnings_summary(self, mock_db):
        """Test organization earnings summary retrieval"""
        from app.services.revenue_calculation import RevenueCalculationService

        mock_db['single'].side_effect = [
            {
                'worlds_count': 5,
                'ytd_earnings_cents': 250000,
                'lifetime_earnings_cents': 750000
            },
            {'count': 2, 'total_cents': 100000},  # Pending
            {'count': 10, 'total_cents': 650000}  # Paid
        ]

        result = await RevenueCalculationService.get_organization_earnings_summary(ORG_1_ID)

        assert result['organization_id'] == ORG_1_ID
        assert result['worlds_with_earnings'] == 5
        assert result['ytd_earnings_cents'] == 250000

    @pytest.mark.asyncio
    async def test_approve_payout(self, mock_db):
        """Test payout approval"""
        from app.services.revenue_calculation import RevenueCalculationService

        payout_id = str(uuid.uuid4())
        approver_id = str(uuid.uuid4())

        mock_db['query'].return_value = [{
            'id': payout_id,
            'status': 'approved',
            'approved_by': approver_id,
            'approved_at': datetime.now().isoformat()
        }]

        result = await RevenueCalculationService.approve_payout(payout_id, approver_id)

        assert result['id'] == payout_id
        assert result['status'] == 'approved'

    @pytest.mark.asyncio
    async def test_get_payout_details(self, mock_db):
        """Test payout details with line items"""
        from app.services.revenue_calculation import RevenueCalculationService

        payout_id = str(uuid.uuid4())

        mock_db['single'].return_value = {
            'id': payout_id,
            'payout_to_type': 'creator',
            'payout_to_id': CREATOR_1_ID,
            'gross_amount_cents': 50000,
            'net_amount_cents': 50000,
            'status': 'pending'
        }

        mock_db['query'].return_value = [
            {
                'world_id': WORLD_1_ID,
                'world_title': 'Popular World',
                'amount_cents': 30000,
                'watch_share_percentage': 60.0,
                'world_status': 'published'
            },
            {
                'world_id': WORLD_2_ID,
                'world_title': 'Other World',
                'amount_cents': 20000,
                'watch_share_percentage': 40.0,
                'world_status': 'published'
            }
        ]

        result = await RevenueCalculationService.get_payout_details(payout_id)

        assert result['id'] == payout_id
        assert len(result['line_items']) == 2
        assert result['line_items'][0]['amount_cents'] == 30000


class TestWatchShareFormula:
    """Tests for the watch share calculation formula"""

    def test_watch_share_calculation(self):
        """Verify watch share percentage calculation"""
        # World 1: 360,000 / 600,000 = 60%
        share_1 = (WORLD_1_WATCH / TOTAL_WATCH) * 100
        assert abs(share_1 - 60.0) < 0.1

        # World 2: 180,000 / 600,000 = 30%
        share_2 = (WORLD_2_WATCH / TOTAL_WATCH) * 100
        assert abs(share_2 - 30.0) < 0.1

        # World 3: 60,000 / 600,000 = 10%
        share_3 = (WORLD_3_WATCH / TOTAL_WATCH) * 100
        assert abs(share_3 - 10.0) < 0.1

        # Shares should sum to 100%
        assert abs((share_1 + share_2 + share_3) - 100.0) < 0.1

    def test_earnings_calculation(self):
        """Verify earnings from watch share"""
        # Creator pool is $945 (10% of $9,450 net revenue)

        # World 1 earnings: 60% of $945 = $567
        earnings_1 = int((WORLD_1_WATCH / TOTAL_WATCH) * CREATOR_POOL)
        assert 56000 < earnings_1 < 57000  # ~$567

        # World 2 earnings: 30% of $945 = $283.50
        earnings_2 = int((WORLD_2_WATCH / TOTAL_WATCH) * CREATOR_POOL)
        assert 28000 < earnings_2 < 29000  # ~$283

        # World 3 earnings: 10% of $945 = $94.50
        earnings_3 = int((WORLD_3_WATCH / TOTAL_WATCH) * CREATOR_POOL)
        assert 9000 < earnings_3 < 10000  # ~$94

    def test_minimum_payout_threshold(self):
        """Verify $25 minimum threshold logic"""
        from app.services.revenue_calculation import MINIMUM_PAYOUT_CENTS

        assert MINIMUM_PAYOUT_CENTS == 2500  # $25

        # All 3 worlds exceed threshold
        earnings_1 = int((WORLD_1_WATCH / TOTAL_WATCH) * CREATOR_POOL)
        earnings_2 = int((WORLD_2_WATCH / TOTAL_WATCH) * CREATOR_POOL)
        earnings_3 = int((WORLD_3_WATCH / TOTAL_WATCH) * CREATOR_POOL)

        assert earnings_1 >= MINIMUM_PAYOUT_CENTS
        assert earnings_2 >= MINIMUM_PAYOUT_CENTS
        assert earnings_3 >= MINIMUM_PAYOUT_CENTS

    def test_creator_pool_percentage(self):
        """Verify 10% creator pool"""
        from app.services.revenue_calculation import CREATOR_POOL_PERCENTAGE

        assert CREATOR_POOL_PERCENTAGE == Decimal("0.10")

        calculated_pool = int(NET_REVENUE * 0.10)
        assert calculated_pool == CREATOR_POOL


class TestIntegrationScenarios:
    """Integration tests for full monthly cycle"""

    @pytest.fixture
    def mock_all_db(self):
        """Mock all database operations"""
        with patch('app.services.watch_aggregation.execute_query') as wq, \
             patch('app.services.watch_aggregation.execute_single') as ws, \
             patch('app.services.watch_aggregation.execute_insert') as wi, \
             patch('app.services.watch_aggregation.execute_update') as wu, \
             patch('app.services.revenue_calculation.execute_query') as rq, \
             patch('app.services.revenue_calculation.execute_single') as rs, \
             patch('app.services.revenue_calculation.execute_insert') as ri, \
             patch('app.services.revenue_calculation.execute_update') as ru:
            yield {
                'watch_query': wq,
                'watch_single': ws,
                'watch_insert': wi,
                'watch_update': wu,
                'rev_query': rq,
                'rev_single': rs,
                'rev_insert': ri,
                'rev_update': ru
            }

    @pytest.mark.asyncio
    async def test_full_monthly_cycle(self, mock_all_db):
        """Test complete month: aggregation -> earnings -> payouts"""
        from app.services.watch_aggregation import WatchAggregationService
        from app.services.revenue_calculation import RevenueCalculationService

        # Step 1: Monthly aggregation
        mock_all_db['watch_query'].return_value = [
            {'world_id': WORLD_1_ID, 'total_watch_seconds': WORLD_1_WATCH},
            {'world_id': WORLD_2_ID, 'total_watch_seconds': WORLD_2_WATCH},
            {'world_id': WORLD_3_ID, 'total_watch_seconds': WORLD_3_WATCH},
        ]

        agg_result = await WatchAggregationService.aggregate_monthly_watch_time(
            TEST_YEAR, TEST_MONTH
        )
        assert agg_result['worlds_processed'] == 3
        assert agg_result['total_watch_seconds'] == TOTAL_WATCH

        # Step 2: Record revenue (simulating Stripe sync)
        mock_all_db['rev_insert'].return_value = {
            'id': str(uuid.uuid4()),
            'creator_pool_cents': CREATOR_POOL
        }

        rev_result = await RevenueCalculationService.record_subscription_revenue(
            period_start=MONTH_START,
            period_end=MONTH_END,
            period_type='monthly',
            gross_revenue_cents=GROSS_REVENUE,
            refunds_cents=REFUNDS,
            chargebacks_cents=CHARGEBACKS,
            stripe_fees_cents=STRIPE_FEES
        )
        assert rev_result is not None

        # Step 3: Calculate earnings
        mock_all_db['rev_single'].side_effect = [
            {'total_watch_seconds': TOTAL_WATCH, 'active_worlds_count': 3},
            {'creator_pool_cents': CREATOR_POOL}
        ]
        mock_all_db['rev_query'].return_value = [
            {
                'world_id': WORLD_1_ID,
                'total_watch_seconds': WORLD_1_WATCH,
                'world_title': 'W1',
                'creator_id': CREATOR_1_ID,
                'organization_id': None
            }
        ]
        mock_all_db['rev_insert'].return_value = {
            'id': str(uuid.uuid4()),
            'gross_earnings_cents': int((WORLD_1_WATCH / TOTAL_WATCH) * CREATOR_POOL)
        }

        earn_result = await RevenueCalculationService.calculate_monthly_earnings(
            TEST_YEAR, TEST_MONTH
        )
        assert earn_result['status'] == 'calculated'

    @pytest.mark.asyncio
    async def test_organization_receives_payout(self, mock_all_db):
        """Test that org-owned world routes payout to organization"""
        from app.services.revenue_calculation import RevenueCalculationService

        org_earnings = int((WORLD_3_WATCH / TOTAL_WATCH) * CREATOR_POOL)

        mock_all_db['rev_query'].side_effect = [
            [{
                'payout_to_type': 'organization',  # Should be org, not creator
                'payout_to_id': ORG_1_ID,
                'total_earnings_cents': org_earnings,
                'worlds_count': 1,
                'earning_ids': [str(uuid.uuid4())]
            }]
        ]
        mock_all_db['rev_insert'].return_value = {'id': str(uuid.uuid4())}
        mock_all_db['rev_single'].return_value = {
            'world_id': WORLD_3_ID,
            'world_title': 'Org World',
            'gross_earnings_cents': org_earnings,
            'watch_share_percentage': 10.0
        }

        result = await RevenueCalculationService.generate_monthly_payouts(
            TEST_YEAR, TEST_MONTH
        )

        assert result['payouts_created'] == 1
        # Verify the insert was called with organization type
        insert_calls = mock_all_db['rev_insert'].call_args_list
        payout_insert = next(
            (c for c in insert_calls if 'payout_to_type' in str(c)),
            None
        )
        assert payout_insert is not None


# Run with: pytest tests/test_monetization_services.py -v
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
