"""
iCal Sync Service for Set House External Platforms

Handles fetching, parsing, and syncing iCal calendar feeds from
external booking platforms (Peerspace, Giggster, etc.).
"""
import re
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional
import httpx
from icalendar import Calendar

from app.core.database import execute_query, execute_single, execute_insert, execute_update


# ============================================================================
# ICAL VALIDATION AND FETCHING
# ============================================================================

async def validate_ical_url(url: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that a URL points to a valid iCal feed.
    Returns (is_valid, error_message).
    """
    if not url:
        return False, "URL is required"

    # Basic URL validation
    if not url.startswith(('http://', 'https://', 'webcal://')):
        return False, "URL must start with http://, https://, or webcal://"

    # Convert webcal:// to https://
    fetch_url = url.replace('webcal://', 'https://')

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(fetch_url, headers={
                'User-Agent': 'SecondWatchNetwork/1.0 (Calendar Sync)',
                'Accept': 'text/calendar, application/calendar+json, */*'
            })

            if response.status_code != 200:
                return False, f"Failed to fetch URL (HTTP {response.status_code})"

            content_type = response.headers.get('content-type', '')
            content = response.text

            # Check content type or content for iCal markers
            if 'text/calendar' not in content_type and 'BEGIN:VCALENDAR' not in content[:100]:
                return False, "URL does not return valid iCal data"

            # Try to parse
            try:
                Calendar.from_ical(content)
            except Exception as e:
                return False, f"Invalid iCal format: {str(e)}"

            return True, None

    except httpx.TimeoutException:
        return False, "Request timed out"
    except httpx.RequestError as e:
        return False, f"Network error: {str(e)}"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


async def fetch_and_parse_ical(url: str) -> List[Dict[str, Any]]:
    """
    Fetch an iCal feed and parse it into a list of event dictionaries.
    """
    fetch_url = url.replace('webcal://', 'https://')

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(fetch_url, headers={
            'User-Agent': 'SecondWatchNetwork/1.0 (Calendar Sync)',
            'Accept': 'text/calendar, */*'
        })
        response.raise_for_status()
        content = response.text

    cal = Calendar.from_ical(content)
    events = []

    for component in cal.walk():
        if component.name == "VEVENT":
            event = parse_vevent(component)
            if event:
                events.append(event)

    # Sort by start date
    events.sort(key=lambda e: e.get('start') or datetime.min.replace(tzinfo=timezone.utc))

    return events


def parse_vevent(component) -> Optional[Dict[str, Any]]:
    """Parse a VEVENT component into a dictionary."""
    try:
        # Get UID (unique identifier)
        uid = str(component.get('uid', ''))
        if not uid:
            # Generate UID from summary + start if not provided
            summary = str(component.get('summary', ''))
            dtstart = component.get('dtstart')
            if dtstart:
                uid = hashlib.md5(f"{summary}:{dtstart}".encode()).hexdigest()

        # Get dates
        dtstart = component.get('dtstart')
        dtend = component.get('dtend')

        start = None
        end = None

        if dtstart:
            start = dtstart.dt
            if hasattr(start, 'tzinfo') and start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            elif not hasattr(start, 'hour'):
                # Date only, convert to datetime
                start = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)

        if dtend:
            end = dtend.dt
            if hasattr(end, 'tzinfo') and end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            elif not hasattr(end, 'hour'):
                end = datetime.combine(end, datetime.min.time(), tzinfo=timezone.utc)

        # Get other fields
        summary = str(component.get('summary', ''))
        description = str(component.get('description', ''))
        location = str(component.get('location', ''))
        status = str(component.get('status', '')).lower()

        # Get last modified for change detection
        last_modified = component.get('last-modified')
        if last_modified:
            last_modified = last_modified.dt

        # Get created date
        created = component.get('created')
        if created:
            created = created.dt

        return {
            'uid': uid,
            'summary': summary,
            'description': description,
            'location': location,
            'start': start,
            'end': end,
            'status': status,
            'last_modified': last_modified,
            'created': created,
            'raw_component': str(component.to_ical())
        }

    except Exception as e:
        print(f"Error parsing VEVENT: {e}")
        return None


# ============================================================================
# PLATFORM-SPECIFIC PARSERS
# ============================================================================

class ICalEventParser:
    """Base parser for iCal events."""

    def parse_client_info(self, event: Dict[str, Any]) -> Dict[str, str]:
        """Extract client information from event."""
        return {
            'client_name': '',
            'client_email': '',
            'client_phone': ''
        }

    def parse_booking_id(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract external booking ID from event."""
        return None

    def parse_booking_url(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract booking URL from event."""
        return None

    def parse_amount(self, event: Dict[str, Any]) -> Optional[float]:
        """Extract booking amount from event."""
        return None


class PeerspaceParser(ICalEventParser):
    """Parser for Peerspace calendar events."""

    def parse_client_info(self, event: Dict[str, Any]) -> Dict[str, str]:
        """Peerspace often includes guest name in summary."""
        summary = event.get('summary', '')
        description = event.get('description', '')

        client_name = ''
        client_email = ''

        # Try to extract name from summary (format: "Booking: John Doe")
        if 'Booking:' in summary:
            client_name = summary.split('Booking:')[-1].strip()

        # Try to extract from description
        if not client_name:
            # Look for "Guest: Name" pattern
            match = re.search(r'Guest:\s*([^\n]+)', description)
            if match:
                client_name = match.group(1).strip()

        # Extract email if present
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', description)
        if email_match:
            client_email = email_match.group(0)

        return {
            'client_name': client_name,
            'client_email': client_email,
            'client_phone': ''
        }

    def parse_booking_id(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract Peerspace booking ID."""
        description = event.get('description', '')
        # Look for booking/confirmation number
        match = re.search(r'(?:Booking|Confirmation|ID)[:\s#]*([A-Z0-9-]+)', description, re.IGNORECASE)
        if match:
            return f"PSP-{match.group(1)}"
        return None

    def parse_booking_url(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract Peerspace booking URL."""
        description = event.get('description', '')
        match = re.search(r'https?://(?:www\.)?peerspace\.com/[^\s]+', description)
        if match:
            return match.group(0)
        return None


class GiggsterParser(ICalEventParser):
    """Parser for Giggster calendar events."""

    def parse_client_info(self, event: Dict[str, Any]) -> Dict[str, str]:
        summary = event.get('summary', '')
        description = event.get('description', '')

        client_name = ''
        client_email = ''

        # Giggster format varies
        if ' - ' in summary:
            parts = summary.split(' - ')
            if len(parts) > 1:
                client_name = parts[-1].strip()

        # Look in description
        match = re.search(r'(?:Booked by|Client|Guest):\s*([^\n]+)', description, re.IGNORECASE)
        if match:
            client_name = match.group(1).strip()

        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', description)
        if email_match:
            client_email = email_match.group(0)

        return {
            'client_name': client_name,
            'client_email': client_email,
            'client_phone': ''
        }

    def parse_booking_id(self, event: Dict[str, Any]) -> Optional[str]:
        description = event.get('description', '')
        match = re.search(r'(?:Booking|Reservation|ID)[:\s#]*([A-Z0-9-]+)', description, re.IGNORECASE)
        if match:
            return f"GIG-{match.group(1)}"
        return None


class SplacerParser(ICalEventParser):
    """Parser for Splacer calendar events."""

    def parse_booking_id(self, event: Dict[str, Any]) -> Optional[str]:
        description = event.get('description', '')
        match = re.search(r'(?:Booking|Order)[:\s#]*([A-Z0-9-]+)', description, re.IGNORECASE)
        if match:
            return f"SPL-{match.group(1)}"
        return None


class SpacetocoParser(ICalEventParser):
    """Parser for Spacetoco calendar events."""

    def parse_booking_id(self, event: Dict[str, Any]) -> Optional[str]:
        description = event.get('description', '')
        match = re.search(r'(?:Booking|Reference)[:\s#]*([A-Z0-9-]+)', description, re.IGNORECASE)
        if match:
            return f"STC-{match.group(1)}"
        return None


class GenericParser(ICalEventParser):
    """Generic parser for unknown iCal sources."""

    def parse_client_info(self, event: Dict[str, Any]) -> Dict[str, str]:
        summary = event.get('summary', '')
        description = event.get('description', '')

        client_name = ''
        client_email = ''

        # Try common patterns
        for pattern in [
            r'(?:Guest|Client|Booked by|Customer):\s*([^\n]+)',
            r'(?:Name):\s*([^\n]+)',
        ]:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                client_name = match.group(1).strip()
                break

        # Extract email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', description)
        if email_match:
            client_email = email_match.group(0)

        return {
            'client_name': client_name,
            'client_email': client_email,
            'client_phone': ''
        }


# Parser registry
PLATFORM_PARSERS = {
    'peerspace': PeerspaceParser(),
    'giggster': GiggsterParser(),
    'splacer': SplacerParser(),
    'spacetoco': SpacetocoParser(),
    'ical': GenericParser(),
    'manual': GenericParser(),
}


def get_parser(platform_type: str) -> ICalEventParser:
    """Get the appropriate parser for a platform type."""
    return PLATFORM_PARSERS.get(platform_type, GenericParser())


# ============================================================================
# SYNC OPERATIONS
# ============================================================================

async def sync_ical_bookings(
    platform_id: str,
    org_id: str,
    user_id: str,
    sync_type: str = 'manual'
) -> Dict[str, Any]:
    """
    Sync bookings from an iCal feed.

    Args:
        platform_id: UUID of the external platform
        org_id: Organization UUID
        user_id: User triggering the sync
        sync_type: 'auto' or 'manual'

    Returns:
        Dict with sync results
    """
    import json

    # Get platform config
    platform = execute_single(
        "SELECT * FROM set_house_external_platforms WHERE id = :id",
        {"id": platform_id}
    )

    if not platform:
        raise ValueError("Platform not found")

    if not platform.get('ical_url'):
        raise ValueError("No iCal URL configured")

    # Create sync log entry
    sync_log = execute_insert(
        """
        INSERT INTO set_house_external_sync_log (
            platform_id, organization_id, sync_type, status, triggered_by
        ) VALUES (
            :platform_id, :org_id, :sync_type, 'started', :triggered_by
        )
        RETURNING *
        """,
        {
            "platform_id": platform_id,
            "org_id": org_id,
            "sync_type": sync_type,
            "triggered_by": user_id
        }
    )

    # Update platform status
    execute_update(
        """
        UPDATE set_house_external_platforms
        SET last_sync_status = 'syncing', last_sync_at = NOW()
        WHERE id = :id
        """,
        {"id": platform_id}
    )

    try:
        # Fetch and parse events
        events = await fetch_and_parse_ical(platform['ical_url'])

        # Get parser for this platform
        parser = get_parser(platform['platform_type'])

        # Process results
        results = {
            'bookings_found': len(events),
            'bookings_created': 0,
            'bookings_updated': 0,
            'bookings_skipped': 0,
            'bookings_errors': 0,
            'sync_details': []
        }

        # Get existing bookings by UID for this platform
        existing_bookings = {}
        if events:
            uids = [e.get('uid') for e in events if e.get('uid')]
            if uids:
                existing = execute_query(
                    """
                    SELECT id, external_event_uid, external_booking_id, scheduled_start, scheduled_end
                    FROM set_house_transactions
                    WHERE organization_id = :org_id
                    AND (external_event_uid = ANY(:uids) OR external_platform_id = :platform_id)
                    """,
                    {"org_id": org_id, "uids": uids, "platform_id": platform_id}
                )
                existing_bookings = {r['external_event_uid']: r for r in existing if r.get('external_event_uid')}

        # Get space mapping
        space_name_mapping = platform.get('space_name_mapping') or {}
        if isinstance(space_name_mapping, str):
            space_name_mapping = json.loads(space_name_mapping)
        default_space_id = platform.get('default_space_id')

        # Process each event
        for event in events:
            try:
                uid = event.get('uid')
                if not uid:
                    results['bookings_skipped'] += 1
                    continue

                # Check if already exists
                existing = existing_bookings.get(uid)

                # Determine space
                space_id = default_space_id
                location = event.get('location', '')
                if location and space_name_mapping:
                    # Try to match location to a space
                    for name, sid in space_name_mapping.items():
                        if name.lower() in location.lower():
                            space_id = sid
                            break

                # Parse client info
                client_info = parser.parse_client_info(event)
                booking_id = parser.parse_booking_id(event) or uid[:50]
                booking_url = parser.parse_booking_url(event)

                # Build metadata
                metadata = {
                    'source_uid': uid,
                    'source_location': location,
                    'source_description': event.get('description', '')[:500],
                    'last_synced': datetime.now(timezone.utc).isoformat()
                }

                if existing:
                    # Check if event changed (compare dates)
                    start_changed = event.get('start') and str(event['start']) != str(existing.get('scheduled_start'))
                    end_changed = event.get('end') and str(event['end']) != str(existing.get('scheduled_end'))

                    if start_changed or end_changed:
                        # Update existing
                        execute_update(
                            """
                            UPDATE set_house_transactions
                            SET scheduled_start = :start,
                                scheduled_end = :end,
                                notes = :notes,
                                external_metadata = :metadata,
                                updated_at = NOW()
                            WHERE id = :id
                            """,
                            {
                                "id": existing['id'],
                                "start": event.get('start'),
                                "end": event.get('end'),
                                "notes": f"{event.get('summary', '')}\n\n{event.get('description', '')}".strip(),
                                "metadata": json.dumps(metadata)
                            }
                        )
                        results['bookings_updated'] += 1
                        results['sync_details'].append({
                            'external_id': booking_id,
                            'action': 'updated',
                            'transaction_id': existing['id']
                        })
                    else:
                        results['bookings_skipped'] += 1
                        results['sync_details'].append({
                            'external_id': booking_id,
                            'action': 'skipped',
                            'reason': 'no_changes'
                        })
                else:
                    # Create new transaction if auto_create is enabled
                    if platform.get('auto_create_transactions', True):
                        # Create transaction
                        transaction = execute_insert(
                            """
                            INSERT INTO set_house_transactions (
                                organization_id,
                                transaction_type,
                                initiated_by_user_id,
                                scheduled_start,
                                scheduled_end,
                                notes,
                                status,
                                external_platform_id,
                                external_booking_id,
                                external_booking_url,
                                external_event_uid,
                                external_metadata,
                                is_external_booking,
                                client_name,
                                client_email
                            ) VALUES (
                                :org_id,
                                'booking_confirmed',
                                :user_id,
                                :start,
                                :end,
                                :notes,
                                'confirmed',
                                :platform_id,
                                :booking_id,
                                :booking_url,
                                :uid,
                                :metadata,
                                TRUE,
                                :client_name,
                                :client_email
                            )
                            RETURNING *
                            """,
                            {
                                "org_id": org_id,
                                "user_id": user_id,
                                "start": event.get('start'),
                                "end": event.get('end'),
                                "notes": f"{event.get('summary', '')}\n\n{event.get('description', '')}".strip(),
                                "platform_id": platform_id,
                                "booking_id": booking_id,
                                "booking_url": booking_url,
                                "uid": uid,
                                "metadata": json.dumps(metadata),
                                "client_name": client_info.get('client_name', ''),
                                "client_email": client_info.get('client_email', '')
                            }
                        )

                        # Add space to transaction if we have one
                        if space_id and transaction:
                            execute_insert(
                                """
                                INSERT INTO set_house_transaction_items (
                                    transaction_id, space_id
                                ) VALUES (:transaction_id, :space_id)
                                RETURNING *
                                """,
                                {"transaction_id": transaction['id'], "space_id": space_id}
                            )

                        results['bookings_created'] += 1
                        results['sync_details'].append({
                            'external_id': booking_id,
                            'action': 'created',
                            'transaction_id': transaction['id'] if transaction else None
                        })
                    else:
                        results['bookings_skipped'] += 1
                        results['sync_details'].append({
                            'external_id': booking_id,
                            'action': 'skipped',
                            'reason': 'auto_create_disabled'
                        })

            except Exception as e:
                results['bookings_errors'] += 1
                results['sync_details'].append({
                    'external_id': event.get('uid', 'unknown'),
                    'action': 'error',
                    'error': str(e)
                })

        # Update sync log
        execute_update(
            """
            UPDATE set_house_external_sync_log
            SET status = 'completed',
                completed_at = NOW(),
                bookings_found = :found,
                bookings_created = :created,
                bookings_updated = :updated,
                bookings_skipped = :skipped,
                bookings_errors = :errors,
                sync_details = :details
            WHERE id = :id
            """,
            {
                "id": sync_log['id'],
                "found": results['bookings_found'],
                "created": results['bookings_created'],
                "updated": results['bookings_updated'],
                "skipped": results['bookings_skipped'],
                "errors": results['bookings_errors'],
                "details": json.dumps(results['sync_details'])
            }
        )

        # Update platform status
        next_sync = datetime.now(timezone.utc) + timedelta(minutes=platform.get('sync_frequency_minutes', 60))
        execute_update(
            """
            UPDATE set_house_external_platforms
            SET last_sync_status = 'success',
                last_sync_error = NULL,
                last_sync_bookings_found = :found,
                last_sync_bookings_created = :created,
                last_sync_bookings_updated = :updated,
                next_sync_at = :next_sync
            WHERE id = :id
            """,
            {
                "id": platform_id,
                "found": results['bookings_found'],
                "created": results['bookings_created'],
                "updated": results['bookings_updated'],
                "next_sync": next_sync
            }
        )

        return {
            "success": True,
            "sync_log_id": sync_log['id'],
            **results
        }

    except Exception as e:
        # Update sync log with error
        execute_update(
            """
            UPDATE set_house_external_sync_log
            SET status = 'failed',
                completed_at = NOW(),
                error_message = :error
            WHERE id = :id
            """,
            {"id": sync_log['id'], "error": str(e)}
        )

        # Update platform status
        execute_update(
            """
            UPDATE set_house_external_platforms
            SET last_sync_status = 'error',
                last_sync_error = :error
            WHERE id = :id
            """,
            {"id": platform_id, "error": str(e)}
        )

        return {
            "success": False,
            "sync_log_id": sync_log['id'],
            "error": str(e)
        }
