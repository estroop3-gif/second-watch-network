"""
Ad Decision Service
Phase 2B: Service for selecting and serving ads based on targeting rules.

This service handles:
- Filtering eligible ad line items based on context
- Selecting ads for ad breaks (preroll, midroll, etc.)
- Tracking impressions and managing budgets
- Simple round-robin/priority-based selection

INTEGRATION POINTS:
- Linear channels: Call select_ads_for_break() at block boundaries
- VOD playback: Call for preroll before episode starts
- Client responsibility: Report impressions via /ads/impressions endpoint

FUTURE ENHANCEMENTS:
- Frequency capping per viewer
- Geographic targeting via IP lookup
- Machine learning for optimization
- Real-time bidding integration
- VAST/VPAID response generation
"""

import logging
import random
from datetime import datetime, time
from typing import Dict, Any, List, Optional
from zoneinfo import ZoneInfo

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


class AdDecisionService:
    """Service for ad selection and delivery."""

    # Default ad durations by type
    DEFAULT_DURATIONS = {
        'video_preroll': 30,
        'video_midroll': 30,
        'video_slate': 15,
        'audio_sponsor': 15,
        'lower_third': 10,
        'banner_overlay': 0,
        'companion_banner': 0,
        'sponsored_card': 10,
    }

    @staticmethod
    async def select_ads_for_break(
        break_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Select ads for an ad break based on context.

        Args:
            break_context: Dictionary containing:
                - placement_type: 'linear_preroll', 'linear_midroll', 'vod_preroll', etc.
                - channel_id: Optional linear channel ID
                - world_id: Optional World ID
                - block_id: Optional block ID
                - episode_id: Optional episode ID
                - max_ads: Maximum number of ads to return (default 2)
                - max_duration_seconds: Maximum total duration (default 60)
                - viewer_id: Optional viewer profile ID (for frequency capping)
                - viewer_role: 'free', 'premium', 'order_member' (premium users may see fewer ads)
                - region: Optional region code
                - timestamp: Current time (for dayparting)

        Returns:
            List of selected ads with creative details and expected durations
        """
        placement_type = break_context.get('placement_type', 'linear_preroll')
        channel_id = break_context.get('channel_id')
        world_id = break_context.get('world_id')
        block_id = break_context.get('block_id')
        max_ads = break_context.get('max_ads', 2)
        max_duration = break_context.get('max_duration_seconds', 60)
        viewer_role = break_context.get('viewer_role', 'free')
        timestamp = break_context.get('timestamp', datetime.now(ZoneInfo('UTC')))

        # Premium/Order members get fewer or no ads
        if viewer_role in ('premium', 'order_member'):
            max_ads = min(max_ads, 1)  # At most 1 sponsor message

        # Get eligible line items
        eligible_items = await AdDecisionService._get_eligible_line_items(
            placement_type=placement_type,
            channel_id=channel_id,
            world_id=world_id,
            block_id=block_id,
            timestamp=timestamp
        )

        if not eligible_items:
            logger.info(
                "no_eligible_ads",
                placement_type=placement_type,
                channel_id=channel_id,
                world_id=world_id
            )
            return []

        # Select ads using priority-weighted selection
        selected_ads = await AdDecisionService._select_from_eligible(
            eligible_items=eligible_items,
            max_ads=max_ads,
            max_duration=max_duration
        )

        logger.info(
            "ads_selected_for_break",
            placement_type=placement_type,
            eligible_count=len(eligible_items),
            selected_count=len(selected_ads),
            total_duration=sum(ad.get('duration_seconds', 0) for ad in selected_ads)
        )

        return selected_ads

    @staticmethod
    async def _get_eligible_line_items(
        placement_type: str,
        channel_id: Optional[str] = None,
        world_id: Optional[str] = None,
        block_id: Optional[str] = None,
        timestamp: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all line items eligible to serve for this context.

        Filters by:
        - Placement type match
        - Active status (line item, campaign, advertiser)
        - Date range
        - Budget/impression caps
        - Targeting rules
        """
        # Base query for active line items
        line_items = execute_query("""
            SELECT
                li.id as line_item_id,
                li.name as line_item_name,
                li.campaign_id,
                li.placement_type,
                li.creative_ids,
                li.targeting,
                li.pricing_model,
                li.cpm_cents,
                li.flat_fee_cents,
                li.priority,
                li.max_impressions,
                li.total_impressions,
                li.daily_impression_cap,
                li.impressions_today,
                li.budget_cents as line_item_budget,
                li.spent_cents as line_item_spent,
                c.id as campaign_id,
                c.name as campaign_name,
                c.objective,
                c.budget_cents as campaign_budget,
                c.spent_cents as campaign_spent,
                a.id as advertiser_id,
                a.name as advertiser_name
            FROM ad_line_items li
            JOIN ad_campaigns c ON li.campaign_id = c.id
            JOIN advertisers a ON c.advertiser_id = a.id
            WHERE li.status = 'active'
              AND c.status = 'active'
              AND a.status IN ('approved', 'active')
              AND li.placement_type = :placement_type
              AND (li.start_date IS NULL OR CURRENT_DATE >= li.start_date)
              AND (li.end_date IS NULL OR CURRENT_DATE <= li.end_date)
              AND CURRENT_DATE >= c.start_date
              AND (c.end_date IS NULL OR CURRENT_DATE <= c.end_date)
              AND (li.max_impressions IS NULL OR li.total_impressions < li.max_impressions)
              AND (li.daily_impression_cap IS NULL OR li.impressions_today < li.daily_impression_cap)
              AND (li.budget_cents IS NULL OR li.spent_cents < li.budget_cents)
              AND c.spent_cents < c.budget_cents
            ORDER BY li.priority DESC, RANDOM()
        """, {"placement_type": placement_type})

        eligible = []
        for item in line_items:
            item_dict = dict(item)
            targeting = item_dict.get('targeting', {}) or {}

            # Apply targeting filters
            if not AdDecisionService._matches_targeting(
                targeting=targeting,
                channel_id=channel_id,
                world_id=world_id,
                block_id=block_id,
                timestamp=timestamp
            ):
                continue

            eligible.append(item_dict)

        return eligible

    @staticmethod
    def _matches_targeting(
        targeting: Dict[str, Any],
        channel_id: Optional[str] = None,
        world_id: Optional[str] = None,
        block_id: Optional[str] = None,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Check if targeting rules match the current context.

        Returns True if all specified targeting criteria are met.
        Empty targeting = matches everything.
        """
        # Channel targeting
        target_channels = targeting.get('channel_ids', [])
        if target_channels and channel_id and channel_id not in target_channels:
            return False

        # World targeting
        target_worlds = targeting.get('world_ids', [])
        if target_worlds and world_id and world_id not in target_worlds:
            return False

        # Block targeting
        target_blocks = targeting.get('block_ids', [])
        if target_blocks and block_id and block_id not in target_blocks:
            return False

        # Time of day targeting (dayparting)
        time_targeting = targeting.get('time_of_day')
        if time_targeting and timestamp:
            start_str = time_targeting.get('start', '00:00')
            end_str = time_targeting.get('end', '23:59')
            start_time = time.fromisoformat(start_str)
            end_time = time.fromisoformat(end_str)
            current_time = timestamp.time()

            if start_time <= end_time:
                # Normal range (e.g., 06:00 to 22:00)
                if not (start_time <= current_time <= end_time):
                    return False
            else:
                # Overnight range (e.g., 22:00 to 06:00)
                if not (current_time >= start_time or current_time <= end_time):
                    return False

        # Day of week targeting
        target_days = targeting.get('days_of_week')
        if target_days and timestamp:
            current_day = timestamp.weekday()  # 0=Monday
            if current_day not in target_days:
                return False

        return True

    @staticmethod
    async def _select_from_eligible(
        eligible_items: List[Dict[str, Any]],
        max_ads: int,
        max_duration: int
    ) -> List[Dict[str, Any]]:
        """
        Select specific ads from eligible line items.

        Strategy:
        1. Sort by priority (higher first)
        2. Select top items up to max_ads and max_duration
        3. For each line item, pick a random creative from creative_ids
        """
        selected = []
        total_duration = 0

        # Sort by priority descending
        sorted_items = sorted(eligible_items, key=lambda x: x.get('priority', 0), reverse=True)

        for item in sorted_items:
            if len(selected) >= max_ads:
                break

            # Get a creative for this line item
            creative = await AdDecisionService._get_creative_for_line_item(item)
            if not creative:
                continue

            creative_duration = creative.get('duration_seconds', 30)

            if total_duration + creative_duration > max_duration:
                # Try to fit a shorter creative if available
                continue

            selected.append({
                'line_item_id': item['line_item_id'],
                'line_item_name': item['line_item_name'],
                'campaign_id': item['campaign_id'],
                'campaign_name': item['campaign_name'],
                'advertiser_id': item['advertiser_id'],
                'advertiser_name': item['advertiser_name'],
                'creative_id': creative['id'],
                'creative_type': creative['creative_type'],
                'asset_url': creative.get('asset_url'),
                'thumbnail_url': creative.get('thumbnail_url'),
                'duration_seconds': creative_duration,
                'headline': creative.get('headline'),
                'call_to_action': creative.get('call_to_action'),
                'destination_url': creative.get('destination_url'),
                'tracking_pixel_url': creative.get('tracking_pixel_url'),
                'pricing_model': item.get('pricing_model'),
                'cost_cents': AdDecisionService._calculate_ad_cost(item, creative)
            })

            total_duration += creative_duration

        return selected

    @staticmethod
    async def _get_creative_for_line_item(
        line_item: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Get an approved creative for a line item.

        If multiple creatives are assigned, picks randomly for rotation.
        """
        creative_ids = line_item.get('creative_ids', [])

        if not creative_ids:
            return None

        # Pick a random creative from the assigned list
        creative_id = random.choice(creative_ids)

        creative = execute_single("""
            SELECT *
            FROM ad_creatives
            WHERE id = :creative_id
              AND status = 'approved'
        """, {"creative_id": creative_id})

        if creative:
            return dict(creative)

        # If selected creative isn't approved, try others
        for cid in creative_ids:
            if cid == creative_id:
                continue
            creative = execute_single("""
                SELECT *
                FROM ad_creatives
                WHERE id = :creative_id
                  AND status = 'approved'
            """, {"creative_id": cid})
            if creative:
                return dict(creative)

        return None

    @staticmethod
    def _calculate_ad_cost(
        line_item: Dict[str, Any],
        creative: Dict[str, Any]
    ) -> int:
        """Calculate the cost in cents for serving this ad."""
        pricing_model = line_item.get('pricing_model', 'cpm')

        if pricing_model == 'cpm':
            # Cost per 1000 impressions -> cost per 1 impression
            cpm = line_item.get('cpm_cents', 0) or 0
            return cpm // 1000
        elif pricing_model == 'flat_fee':
            # Flat fee is for the whole campaign, not per impression
            return 0
        elif pricing_model == 'cpc':
            # CPC is charged on click, not impression
            return 0
        elif pricing_model == 'cpv':
            # CPV is charged on completion
            cpv = line_item.get('cpv_cents', 0) or 0
            return cpv

        return 0

    @staticmethod
    async def record_impression(
        impression_data: Dict[str, Any]
    ) -> str:
        """
        Record an ad impression event.

        Args:
            impression_data: Dictionary containing:
                - line_item_id: Required
                - creative_id: Required
                - campaign_id: Required
                - advertiser_id: Required
                - placement_type: Required
                - channel_id: Optional
                - world_id: Optional
                - block_id: Optional
                - episode_id: Optional
                - viewer_id: Optional
                - session_id: Optional
                - device_type: Optional
                - device_id_hash: Optional
                - region: Optional
                - position_in_break: Optional
                - duration_watched_seconds: Optional
                - completed: Optional
                - clicked: Optional
                - cost_cents: Optional

        Returns:
            Impression ID
        """
        impression = execute_insert("""
            INSERT INTO ad_impressions (
                line_item_id, creative_id, campaign_id, advertiser_id,
                placement_type, channel_id, world_id, block_id, episode_id,
                viewer_id, session_id, device_type, device_id_hash, region,
                position_in_break, duration_watched_seconds, completed,
                clicked, cost_cents
            ) VALUES (
                :line_item_id, :creative_id, :campaign_id, :advertiser_id,
                :placement_type, :channel_id, :world_id, :block_id, :episode_id,
                :viewer_id, :session_id, :device_type, :device_id_hash, :region,
                :position_in_break, :duration_watched_seconds, :completed,
                :clicked, :cost_cents
            )
            RETURNING id
        """, {
            "line_item_id": impression_data['line_item_id'],
            "creative_id": impression_data['creative_id'],
            "campaign_id": impression_data['campaign_id'],
            "advertiser_id": impression_data['advertiser_id'],
            "placement_type": impression_data['placement_type'],
            "channel_id": impression_data.get('channel_id'),
            "world_id": impression_data.get('world_id'),
            "block_id": impression_data.get('block_id'),
            "episode_id": impression_data.get('episode_id'),
            "viewer_id": impression_data.get('viewer_id'),
            "session_id": impression_data.get('session_id'),
            "device_type": impression_data.get('device_type'),
            "device_id_hash": impression_data.get('device_id_hash'),
            "region": impression_data.get('region'),
            "position_in_break": impression_data.get('position_in_break'),
            "duration_watched_seconds": impression_data.get('duration_watched_seconds'),
            "completed": impression_data.get('completed', False),
            "clicked": impression_data.get('clicked', False),
            "cost_cents": impression_data.get('cost_cents', 0)
        })

        logger.info(
            "ad_impression_recorded",
            impression_id=impression['id'],
            line_item_id=impression_data['line_item_id'],
            creative_id=impression_data['creative_id']
        )

        return str(impression['id'])

    @staticmethod
    async def record_click(
        impression_id: str,
        click_url: Optional[str] = None
    ) -> bool:
        """Record a click on an ad impression."""
        result = execute_single("""
            UPDATE ad_impressions
            SET clicked = true, clicked_at = NOW(), click_url = :click_url
            WHERE id = :impression_id
            RETURNING id, line_item_id, creative_id
        """, {"impression_id": impression_id, "click_url": click_url})

        if result:
            # Update line item click counter
            execute_update("""
                UPDATE ad_line_items
                SET total_clicks = total_clicks + 1,
                    spent_cents = spent_cents + COALESCE(
                        (SELECT cpc_cents FROM ad_line_items WHERE id = :li_id AND pricing_model = 'cpc'),
                        0
                    )
                WHERE id = :li_id
            """, {"li_id": result['line_item_id']})

            logger.info("ad_click_recorded", impression_id=impression_id)
            return True

        return False

    @staticmethod
    async def record_completion(
        impression_id: str,
        duration_watched_seconds: int
    ) -> bool:
        """Record that an ad was watched to completion."""
        result = execute_single("""
            UPDATE ad_impressions
            SET completed = true, duration_watched_seconds = :duration
            WHERE id = :impression_id
            RETURNING id, line_item_id, creative_id
        """, {"impression_id": impression_id, "duration": duration_watched_seconds})

        if result:
            # Update line item completion counter
            execute_update("""
                UPDATE ad_line_items
                SET total_completions = total_completions + 1
                WHERE id = :li_id
            """, {"li_id": result['line_item_id']})

            logger.info("ad_completion_recorded", impression_id=impression_id)
            return True

        return False

    @staticmethod
    async def get_advertiser_stats(
        advertiser_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get aggregated stats for an advertiser."""
        date_filter = ""
        params = {"advertiser_id": advertiser_id}

        if start_date:
            date_filter += " AND impression_date >= :start_date"
            params["start_date"] = start_date
        if end_date:
            date_filter += " AND impression_date <= :end_date"
            params["end_date"] = end_date

        stats = execute_single(f"""
            SELECT
                COUNT(*) as total_impressions,
                COUNT(*) FILTER (WHERE clicked) as total_clicks,
                COUNT(*) FILTER (WHERE completed) as total_completions,
                COALESCE(SUM(cost_cents), 0) as total_spend_cents
            FROM ad_impressions
            WHERE advertiser_id = :advertiser_id
            {date_filter}
        """, params)

        campaigns = execute_query("""
            SELECT
                c.id,
                c.name,
                c.status,
                c.budget_cents,
                c.spent_cents,
                c.total_impressions,
                c.total_clicks
            FROM ad_campaigns c
            WHERE c.advertiser_id = :advertiser_id
            ORDER BY c.created_at DESC
            LIMIT 10
        """, {"advertiser_id": advertiser_id})

        return {
            "summary": dict(stats) if stats else {},
            "recent_campaigns": [dict(c) for c in campaigns]
        }

    @staticmethod
    async def get_campaign_stats(
        campaign_id: str
    ) -> Dict[str, Any]:
        """Get detailed stats for a campaign."""
        campaign = execute_single("""
            SELECT
                c.*,
                a.name as advertiser_name
            FROM ad_campaigns c
            JOIN advertisers a ON c.advertiser_id = a.id
            WHERE c.id = :campaign_id
        """, {"campaign_id": campaign_id})

        if not campaign:
            return {"error": "Campaign not found"}

        line_items = execute_query("""
            SELECT *
            FROM ad_line_items
            WHERE campaign_id = :campaign_id
            ORDER BY priority DESC, created_at DESC
        """, {"campaign_id": campaign_id})

        daily_stats = execute_query("""
            SELECT
                impression_date,
                COUNT(*) as impressions,
                COUNT(*) FILTER (WHERE clicked) as clicks,
                COUNT(*) FILTER (WHERE completed) as completions,
                COALESCE(SUM(cost_cents), 0) as spend_cents
            FROM ad_impressions
            WHERE campaign_id = :campaign_id
            GROUP BY impression_date
            ORDER BY impression_date DESC
            LIMIT 30
        """, {"campaign_id": campaign_id})

        return {
            "campaign": dict(campaign),
            "line_items": [dict(li) for li in line_items],
            "daily_stats": [dict(d) for d in daily_stats]
        }
