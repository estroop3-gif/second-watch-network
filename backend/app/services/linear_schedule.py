"""
Linear Schedule Service
Phase 2A: Service for computing linear channel playback state and schedules.

This service handles:
- Computing the currently playing block and item for a channel at any given time
- Generating daily schedules from scheduled blocks
- Validating block durations against schedule needs
- Managing 24/7 looping channels

ARCHITECTURE NOTE (Future SSAI/Live Integration):
Currently, this service computes playback positions for client-side seeking into VOD assets.
The client uses the "now playing" endpoint to know which HLS asset to play and at what offset.

For future server-side channel assembly (continuous HLS playlist generation):
1. A separate "HLS Assembly Service" would consume this service's output
2. It would stitch together HLS segments from video_assets into a continuous playlist
3. The stream_url on linear_channels would point to this assembled stream
4. Ad insertion would happen server-side via SCTE-35 markers or manifest manipulation

The LinearScheduleService provides the "what plays when" logic that any playback
method (client-side VOD or server-side assembly) would need.
"""

import logging
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional, Tuple
from zoneinfo import ZoneInfo

from app.core.database import execute_query, execute_single

logger = logging.getLogger(__name__)


class LinearScheduleService:
    """Service for linear channel schedule computation and management."""

    # Default block duration if none specified (1 hour)
    DEFAULT_BLOCK_DURATION = 3600

    # How far ahead to generate schedules (days)
    SCHEDULE_LOOKAHEAD_DAYS = 7

    @staticmethod
    async def get_channel_by_slug(slug: str) -> Optional[Dict[str, Any]]:
        """Fetch a linear channel by its slug."""
        channel = execute_single("""
            SELECT
                lc.*,
                b.name as default_block_name,
                b.computed_duration_seconds as default_block_duration
            FROM linear_channels lc
            LEFT JOIN blocks b ON lc.default_block_id = b.id
            WHERE lc.slug = :slug
              AND lc.archived_at IS NULL
        """, {"slug": slug})

        return dict(channel) if channel else None

    @staticmethod
    async def get_channel_by_id(channel_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a linear channel by ID."""
        channel = execute_single("""
            SELECT
                lc.*,
                b.name as default_block_name,
                b.computed_duration_seconds as default_block_duration
            FROM linear_channels lc
            LEFT JOIN blocks b ON lc.default_block_id = b.id
            WHERE lc.id = :channel_id
              AND lc.archived_at IS NULL
        """, {"channel_id": channel_id})

        return dict(channel) if channel else None

    @staticmethod
    async def list_visible_channels(
        viewer_role: Optional[str] = None,
        include_internal: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List channels visible to the current viewer.

        Args:
            viewer_role: The viewer's role (e.g., 'order_member', 'premium', None for anonymous)
            include_internal: Whether to include internal/experimental channels

        Returns:
            List of channel metadata dictionaries
        """
        visibility_filter = ["'public'"]

        if viewer_role in ('order_member', 'admin', 'superadmin'):
            visibility_filter.append("'order_only'")

        if viewer_role in ('premium', 'order_member', 'admin', 'superadmin'):
            visibility_filter.append("'premium'")

        if include_internal and viewer_role in ('admin', 'superadmin'):
            visibility_filter.append("'internal'")

        visibility_clause = f"visibility IN ({', '.join(visibility_filter)})"

        channels = execute_query(f"""
            SELECT
                lc.id,
                lc.slug,
                lc.name,
                lc.description,
                lc.tagline,
                lc.category,
                lc.visibility,
                lc.is_24_7,
                lc.logo_url,
                lc.accent_color,
                lc.status,
                lc.current_viewers,
                lc.stream_type
            FROM linear_channels lc
            WHERE lc.status IN ('live', 'scheduled')
              AND lc.archived_at IS NULL
              AND {visibility_clause}
            ORDER BY
                CASE lc.category
                    WHEN 'main' THEN 1
                    WHEN 'genre' THEN 2
                    WHEN 'lodge' THEN 3
                    WHEN 'creator' THEN 4
                    WHEN 'event' THEN 5
                    ELSE 6
                END,
                lc.current_viewers DESC
        """, {})

        return [dict(c) for c in channels]

    @staticmethod
    async def get_schedule_for_day(
        channel_id: str,
        target_date: date,
        channel_timezone: str = 'America/Los_Angeles'
    ) -> List[Dict[str, Any]]:
        """
        Generate the schedule for a specific day on a channel.

        For 24/7 channels with a default block, this creates a looping schedule.
        For scheduled channels, it queries channel_schedule_entries.

        Args:
            channel_id: The channel UUID
            target_date: The date to generate schedule for
            channel_timezone: Timezone for interpreting the day

        Returns:
            List of schedule entries with block details and times
        """
        tz = ZoneInfo(channel_timezone)
        day_start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=tz)
        day_end = day_start + timedelta(days=1)

        # Convert to UTC for database queries
        day_start_utc = day_start.astimezone(ZoneInfo('UTC'))
        day_end_utc = day_end.astimezone(ZoneInfo('UTC'))

        channel = await LinearScheduleService.get_channel_by_id(channel_id)
        if not channel:
            return []

        # Get scheduled entries for this day
        entries = execute_query("""
            SELECT
                cse.id as entry_id,
                cse.block_id,
                cse.start_time_utc,
                cse.end_time_utc,
                cse.recurrence_type,
                cse.priority,
                cse.override_reason,
                b.slug as block_slug,
                b.name as block_name,
                b.description as block_description,
                b.theme as block_theme,
                b.computed_duration_seconds as block_duration,
                b.thumbnail_url as block_thumbnail
            FROM channel_schedule_entries cse
            JOIN blocks b ON cse.block_id = b.id
            WHERE cse.channel_id = :channel_id
              AND cse.status IN ('scheduled', 'active')
              AND (
                  -- One-time entries within the day
                  (cse.recurrence_type = 'none'
                   AND cse.start_time_utc >= :day_start
                   AND cse.start_time_utc < :day_end)
                  -- Or recurring entries (need post-processing)
                  OR cse.recurrence_type != 'none'
              )
            ORDER BY cse.start_time_utc, cse.priority DESC
        """, {
            "channel_id": channel_id,
            "day_start": day_start_utc,
            "day_end": day_end_utc
        })

        schedule = []
        for entry in entries:
            entry_dict = dict(entry)

            # Handle recurrence expansion
            if entry_dict['recurrence_type'] != 'none':
                # Check if this recurring entry applies to target_date
                if not LinearScheduleService._recurrence_applies(
                    entry_dict['recurrence_type'],
                    entry_dict['start_time_utc'],
                    target_date,
                    tz
                ):
                    continue

                # Adjust start_time to target_date
                original_time = entry_dict['start_time_utc'].astimezone(tz).time()
                entry_dict['start_time_utc'] = datetime.combine(
                    target_date, original_time
                ).replace(tzinfo=tz).astimezone(ZoneInfo('UTC'))

            # Compute end time if not set
            if not entry_dict.get('end_time_utc'):
                duration = entry_dict.get('block_duration') or LinearScheduleService.DEFAULT_BLOCK_DURATION
                entry_dict['end_time_utc'] = entry_dict['start_time_utc'] + timedelta(seconds=duration)

            schedule.append(entry_dict)

        # For 24/7 channels with no explicit schedule, fill with default block
        if channel.get('is_24_7') and channel.get('default_block_id') and not schedule:
            schedule = await LinearScheduleService._generate_24_7_schedule(
                channel, target_date, tz
            )

        # Sort by start time
        schedule.sort(key=lambda x: x['start_time_utc'])

        return schedule

    @staticmethod
    def _recurrence_applies(
        recurrence_type: str,
        original_start: datetime,
        target_date: date,
        tz: ZoneInfo
    ) -> bool:
        """Check if a recurring schedule entry applies to the target date."""
        target_weekday = target_date.weekday()  # 0=Monday, 6=Sunday
        original_weekday = original_start.astimezone(tz).weekday()

        if recurrence_type == 'daily':
            return True
        elif recurrence_type == 'weekly':
            return target_weekday == original_weekday
        elif recurrence_type == 'weekday':
            return target_weekday < 5  # Mon-Fri
        elif recurrence_type == 'weekend':
            return target_weekday >= 5  # Sat-Sun
        return False

    @staticmethod
    async def _generate_24_7_schedule(
        channel: Dict[str, Any],
        target_date: date,
        tz: ZoneInfo
    ) -> List[Dict[str, Any]]:
        """Generate a looping schedule for 24/7 channels using the default block."""
        default_block_id = channel.get('default_block_id')
        if not default_block_id:
            return []

        block = execute_single("""
            SELECT id, slug, name, description, theme, computed_duration_seconds, thumbnail_url
            FROM blocks
            WHERE id = :block_id AND status = 'active'
        """, {"block_id": default_block_id})

        if not block:
            return []

        block = dict(block)
        duration = block.get('computed_duration_seconds') or LinearScheduleService.DEFAULT_BLOCK_DURATION

        schedule = []
        day_start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=tz)
        current_time = day_start.astimezone(ZoneInfo('UTC'))
        day_end = (day_start + timedelta(days=1)).astimezone(ZoneInfo('UTC'))

        loop_count = 0
        while current_time < day_end:
            schedule.append({
                'entry_id': None,  # Generated, not from DB
                'block_id': block['id'],
                'block_slug': block['slug'],
                'block_name': block['name'],
                'block_description': block['description'],
                'block_theme': block['theme'],
                'block_duration': duration,
                'block_thumbnail': block['thumbnail_url'],
                'start_time_utc': current_time,
                'end_time_utc': current_time + timedelta(seconds=duration),
                'recurrence_type': 'loop',
                'priority': 0,
                'override_reason': None,
                'loop_iteration': loop_count
            })
            current_time += timedelta(seconds=duration)
            loop_count += 1

        return schedule

    @staticmethod
    async def get_now_playing(
        channel_id: str,
        at_time: Optional[datetime] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Compute what's currently playing on a channel.

        This is the core method for linear playback. It determines:
        1. Which block is currently scheduled
        2. Which item within that block is playing
        3. The exact playback position within that item

        Args:
            channel_id: The channel UUID
            at_time: Point in time to compute for (defaults to now)

        Returns:
            Dictionary with:
            - channel: Channel metadata
            - block: Current block info
            - item: Current item info (episode/companion/slate)
            - position_seconds: How far into the item we are
            - remaining_seconds: Time left in current item
            - next_item: Preview of what's coming next
            - playback_asset: For client-side playback, the HLS asset URL and seek position
        """
        if at_time is None:
            at_time = datetime.now(ZoneInfo('UTC'))

        channel = await LinearScheduleService.get_channel_by_id(channel_id)
        if not channel:
            logger.warning("channel_not_found", channel_id=channel_id)
            return None

        if channel.get('status') != 'live':
            logger.info("channel_not_live", channel_id=channel_id, status=channel.get('status'))
            return {
                'channel': channel,
                'status': 'offline',
                'offline_slate_url': channel.get('offline_slate_url'),
                'message': 'Channel is not currently live'
            }

        # Get today's schedule
        channel_tz = ZoneInfo(channel.get('timezone', 'America/Los_Angeles'))
        target_date = at_time.astimezone(channel_tz).date()
        schedule = await LinearScheduleService.get_schedule_for_day(
            channel_id, target_date, channel.get('timezone', 'America/Los_Angeles')
        )

        if not schedule:
            # No schedule, use default block if 24/7
            if channel.get('is_24_7') and channel.get('default_block_id'):
                # This shouldn't happen if _generate_24_7_schedule works correctly
                logger.warning("empty_schedule_for_24_7_channel", channel_id=channel_id)

            return {
                'channel': channel,
                'status': 'no_schedule',
                'offline_slate_url': channel.get('offline_slate_url'),
                'message': 'No programming scheduled'
            }

        # Find current block in schedule
        current_block_entry = None
        for entry in schedule:
            if entry['start_time_utc'] <= at_time < entry['end_time_utc']:
                current_block_entry = entry
                break

        if not current_block_entry:
            # We're in a gap between scheduled blocks
            # Find next upcoming block
            upcoming = [e for e in schedule if e['start_time_utc'] > at_time]
            next_block = upcoming[0] if upcoming else None

            return {
                'channel': channel,
                'status': 'gap',
                'offline_slate_url': channel.get('offline_slate_url'),
                'next_block': next_block,
                'message': 'Between scheduled programming'
            }

        # Compute position within the block
        block_elapsed = (at_time - current_block_entry['start_time_utc']).total_seconds()

        # Get items in this block
        items = await LinearScheduleService.get_block_items(current_block_entry['block_id'])

        if not items:
            return {
                'channel': channel,
                'status': 'empty_block',
                'block': current_block_entry,
                'message': 'Block has no content'
            }

        # Find current item within the block
        current_item, item_position, item_index = LinearScheduleService._find_item_at_position(
            items, block_elapsed
        )

        if not current_item:
            # Shouldn't happen, but fallback to first item
            current_item = items[0]
            item_position = 0
            item_index = 0

        # Get next item preview
        next_item = items[item_index + 1] if item_index + 1 < len(items) else None

        # Build playback asset info
        playback_asset = await LinearScheduleService._resolve_playback_asset(
            current_item, item_position
        )

        return {
            'channel': {
                'id': channel['id'],
                'slug': channel['slug'],
                'name': channel['name'],
                'logo_url': channel.get('logo_url')
            },
            'status': 'playing',
            'block': {
                'id': current_block_entry['block_id'],
                'slug': current_block_entry.get('block_slug'),
                'name': current_block_entry['block_name'],
                'theme': current_block_entry.get('block_theme'),
                'started_at': current_block_entry['start_time_utc'].isoformat(),
                'ends_at': current_block_entry['end_time_utc'].isoformat()
            },
            'item': {
                'id': current_item['id'],
                'type': current_item['item_type'],
                'title': current_item.get('resolved_title'),
                'world_id': current_item.get('world_id'),
                'world_title': current_item.get('world_title'),
                'thumbnail_url': current_item.get('thumbnail_url'),
                'duration_seconds': current_item['effective_duration_seconds']
            },
            'position_seconds': int(item_position),
            'remaining_seconds': int(current_item['effective_duration_seconds'] - item_position),
            'next_item': {
                'type': next_item['item_type'],
                'title': next_item.get('resolved_title'),
                'world_title': next_item.get('world_title'),
                'starts_in_seconds': int(current_item['effective_duration_seconds'] - item_position)
            } if next_item else None,
            'playback_asset': playback_asset
        }

    @staticmethod
    async def get_block_items(block_id: str) -> List[Dict[str, Any]]:
        """Get all items in a block with resolved content details."""
        items = execute_query("""
            SELECT
                bi.id,
                bi.block_id,
                bi.item_type,
                bi.item_id,
                bi.sort_order,
                bi.effective_duration_seconds,
                bi.start_offset_seconds,
                bi.transition_type,
                bi.slate_asset_url,
                bi.slate_metadata,
                -- Episode details
                e.title as episode_title,
                e.world_id as episode_world_id,
                e.video_asset_id as episode_video_asset_id,
                e.thumbnail_url as episode_thumbnail,
                ew.title as episode_world_title,
                -- Companion details
                wc.title as companion_title,
                wc.world_id as companion_world_id,
                wc.video_asset_id as companion_video_asset_id,
                wc.thumbnail_url as companion_thumbnail,
                cw.title as companion_world_title
            FROM block_items bi
            LEFT JOIN episodes e ON bi.item_type = 'world_episode' AND bi.item_id = e.id
            LEFT JOIN worlds ew ON e.world_id = ew.id
            LEFT JOIN world_content wc ON bi.item_type = 'world_companion' AND bi.item_id = wc.id
            LEFT JOIN worlds cw ON wc.world_id = cw.id
            WHERE bi.block_id = :block_id
            ORDER BY bi.sort_order
        """, {"block_id": block_id})

        result = []
        for item in items:
            item_dict = dict(item)

            # Resolve title and details based on type
            if item_dict['item_type'] == 'world_episode':
                item_dict['resolved_title'] = item_dict.get('episode_title')
                item_dict['world_id'] = item_dict.get('episode_world_id')
                item_dict['world_title'] = item_dict.get('episode_world_title')
                item_dict['video_asset_id'] = item_dict.get('episode_video_asset_id')
                item_dict['thumbnail_url'] = item_dict.get('episode_thumbnail')
            elif item_dict['item_type'] == 'world_companion':
                item_dict['resolved_title'] = item_dict.get('companion_title')
                item_dict['world_id'] = item_dict.get('companion_world_id')
                item_dict['world_title'] = item_dict.get('companion_world_title')
                item_dict['video_asset_id'] = item_dict.get('companion_video_asset_id')
                item_dict['thumbnail_url'] = item_dict.get('companion_thumbnail')
            elif item_dict['item_type'] == 'custom_slate':
                item_dict['resolved_title'] = 'Station Break'
                item_dict['thumbnail_url'] = item_dict.get('slate_asset_url')
            elif item_dict['item_type'] == 'ad_placeholder':
                item_dict['resolved_title'] = 'Ad Break'
            elif item_dict['item_type'] == 'promo':
                item_dict['resolved_title'] = 'Promo'

            result.append(item_dict)

        return result

    @staticmethod
    def _find_item_at_position(
        items: List[Dict[str, Any]],
        position_seconds: float
    ) -> Tuple[Optional[Dict[str, Any]], float, int]:
        """
        Find which item in a block is playing at a given position.

        Args:
            items: List of block items in order
            position_seconds: Seconds into the block

        Returns:
            Tuple of (current_item, position_within_item, item_index)
        """
        elapsed = 0
        for i, item in enumerate(items):
            item_duration = item['effective_duration_seconds']
            if elapsed + item_duration > position_seconds:
                # This is the current item
                item_position = position_seconds - elapsed
                return item, item_position, i
            elapsed += item_duration

        # Position is past all items (shouldn't happen normally)
        # Return last item at its end
        if items:
            last_item = items[-1]
            return last_item, last_item['effective_duration_seconds'], len(items) - 1

        return None, 0, 0

    @staticmethod
    async def _resolve_playback_asset(
        item: Dict[str, Any],
        position_seconds: float
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve the actual playback asset and seek position for an item.

        For client-side VOD playback, this returns the HLS manifest URL
        and the seek position to simulate linear playback.

        FUTURE INTEGRATION POINT:
        For server-side assembly, this method would instead return
        segment information for the HLS assembly service to use.
        """
        if item['item_type'] == 'custom_slate':
            # Slates are typically static images or short loops
            return {
                'type': 'slate',
                'url': item.get('slate_asset_url'),
                'is_looping': True,
                'seek_seconds': 0
            }

        if item['item_type'] == 'ad_placeholder':
            # Ad placeholders signal the client to fetch ads
            return {
                'type': 'ad_break',
                'duration_seconds': item['effective_duration_seconds'],
                'placement_type': 'linear_midroll'
            }

        video_asset_id = item.get('video_asset_id')
        if not video_asset_id:
            logger.warning("no_video_asset_for_item", item_id=item['id'], item_type=item['item_type'])
            return None

        # Fetch the HLS manifest for this video asset
        manifest = execute_single("""
            SELECT
                hm.id,
                hm.manifest_url,
                hm.duration_seconds,
                va.cloudfront_url
            FROM hls_manifests hm
            JOIN video_assets va ON hm.video_asset_id = va.id
            WHERE hm.video_asset_id = :video_asset_id
              AND hm.status = 'ready'
            ORDER BY hm.created_at DESC
            LIMIT 1
        """, {"video_asset_id": video_asset_id})

        if not manifest:
            logger.warning("no_hls_manifest_for_asset", video_asset_id=video_asset_id)
            return None

        manifest = dict(manifest)

        # Calculate actual seek position (accounting for item's start_offset)
        start_offset = item.get('start_offset_seconds', 0) or 0
        seek_position = start_offset + position_seconds

        return {
            'type': 'hls',
            'manifest_url': manifest.get('manifest_url'),
            'cloudfront_url': manifest.get('cloudfront_url'),
            'seek_seconds': seek_position,
            'duration_seconds': manifest.get('duration_seconds'),
            'video_asset_id': video_asset_id
        }

    @staticmethod
    async def validate_block_duration(
        block_id: str,
        target_duration: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Validate that a block's actual duration aligns with its target.

        Args:
            block_id: The block to validate
            target_duration: Optional target to compare against (uses block's target if not provided)

        Returns:
            Validation result with computed vs target duration and any warnings
        """
        block = execute_single("""
            SELECT id, name, target_duration_seconds, computed_duration_seconds, status
            FROM blocks
            WHERE id = :block_id
        """, {"block_id": block_id})

        if not block:
            return {'valid': False, 'error': 'Block not found'}

        block = dict(block)
        target = target_duration or block.get('target_duration_seconds', 3600)
        computed = block.get('computed_duration_seconds', 0)

        # Allow 5% variance
        variance = abs(computed - target) / target if target > 0 else 0
        is_valid = variance <= 0.05

        warnings = []
        if computed == 0:
            warnings.append('Block has no content')
        elif computed < target * 0.9:
            warnings.append(f'Block is {int((1 - computed/target) * 100)}% shorter than target')
        elif computed > target * 1.1:
            warnings.append(f'Block is {int((computed/target - 1) * 100)}% longer than target')

        return {
            'valid': is_valid,
            'block_id': block_id,
            'block_name': block['name'],
            'target_duration_seconds': target,
            'computed_duration_seconds': computed,
            'variance_percent': round(variance * 100, 2),
            'warnings': warnings
        }

    @staticmethod
    async def update_viewer_count(
        channel_id: str,
        delta: int = 1
    ) -> int:
        """
        Increment or decrement the viewer count for a channel.

        Args:
            channel_id: The channel UUID
            delta: Amount to change (positive = join, negative = leave)

        Returns:
            New viewer count
        """
        result = execute_single("""
            UPDATE linear_channels
            SET
                current_viewers = GREATEST(0, current_viewers + :delta),
                peak_viewers_today = CASE
                    WHEN current_viewers + :delta > peak_viewers_today
                    THEN current_viewers + :delta
                    ELSE peak_viewers_today
                END,
                updated_at = NOW()
            WHERE id = :channel_id
            RETURNING current_viewers
        """, {"channel_id": channel_id, "delta": delta})

        return result['current_viewers'] if result else 0

    @staticmethod
    async def start_viewer_session(
        channel_id: str,
        viewer_id: Optional[str] = None,
        device_type: Optional[str] = None,
        device_id: Optional[str] = None
    ) -> str:
        """Start a new viewer session and increment viewer count."""
        from app.core.database import execute_insert

        session = execute_insert("""
            INSERT INTO channel_viewer_sessions
                (channel_id, viewer_id, device_type, device_id)
            VALUES
                (:channel_id, :viewer_id, :device_type, :device_id)
            RETURNING id
        """, {
            "channel_id": channel_id,
            "viewer_id": viewer_id,
            "device_type": device_type,
            "device_id": device_id
        })

        # Increment viewer count
        await LinearScheduleService.update_viewer_count(channel_id, 1)

        return str(session['id'])

    @staticmethod
    async def end_viewer_session(
        session_id: str,
        total_watch_seconds: int = 0
    ) -> None:
        """End a viewer session and decrement viewer count."""
        from app.core.database import execute_update

        result = execute_single("""
            UPDATE channel_viewer_sessions
            SET
                ended_at = NOW(),
                total_watch_seconds = :total_watch_seconds
            WHERE id = :session_id
            RETURNING channel_id
        """, {
            "session_id": session_id,
            "total_watch_seconds": total_watch_seconds
        })

        if result:
            await LinearScheduleService.update_viewer_count(result['channel_id'], -1)

    @staticmethod
    async def heartbeat_viewer_session(
        session_id: str,
        current_block_id: Optional[str] = None
    ) -> None:
        """Update heartbeat for an active viewer session."""
        from app.core.database import execute_update

        execute_update("""
            UPDATE channel_viewer_sessions
            SET
                last_heartbeat_at = NOW(),
                blocks_viewed = CASE
                    WHEN :block_id IS NOT NULL AND NOT (:block_id = ANY(blocks_viewed))
                    THEN array_append(blocks_viewed, :block_id::uuid)
                    ELSE blocks_viewed
                END
            WHERE id = :session_id
        """, {
            "session_id": session_id,
            "block_id": current_block_id
        })
