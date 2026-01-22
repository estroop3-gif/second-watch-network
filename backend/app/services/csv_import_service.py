"""
CSV Import Service for Set House External Platforms

Handles importing bookings from CSV files with flexible column mapping.
"""
import json
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from dateutil import parser as date_parser

from app.core.database import execute_query, execute_single, execute_insert, execute_update


# ============================================================================
# DATE/TIME PARSING
# ============================================================================

def parse_date(value: str, date_format: str = None) -> Optional[datetime]:
    """Parse a date string into a datetime object."""
    if not value or not value.strip():
        return None

    value = value.strip()

    # Try common formats first
    formats = [
        '%Y-%m-%d',
        '%m/%d/%Y',
        '%d/%m/%Y',
        '%m-%d-%Y',
        '%d-%m-%Y',
        '%Y/%m/%d',
        '%m/%d/%y',
        '%d/%m/%y',
    ]

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    # Fall back to dateutil parser
    try:
        return date_parser.parse(value, fuzzy=True)
    except (ValueError, TypeError):
        return None


def parse_time(value: str) -> Optional[timedelta]:
    """Parse a time string into a timedelta for combining with date."""
    if not value or not value.strip():
        return None

    value = value.strip().upper()

    # Try common time formats
    formats = [
        '%H:%M',
        '%H:%M:%S',
        '%I:%M %p',
        '%I:%M%p',
        '%I %p',
    ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(value, fmt)
            return timedelta(hours=parsed.hour, minutes=parsed.minute, seconds=parsed.second)
        except ValueError:
            continue

    # Try regex for HH:MM pattern
    match = re.match(r'(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?', value, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        second = int(match.group(3)) if match.group(3) else 0
        ampm = match.group(4)

        if ampm:
            if ampm.upper() == 'PM' and hour < 12:
                hour += 12
            elif ampm.upper() == 'AM' and hour == 12:
                hour = 0

        return timedelta(hours=hour, minutes=minute, seconds=second)

    return None


def parse_amount(value: str) -> Optional[float]:
    """Parse a currency/amount string into a float."""
    if not value or not value.strip():
        return None

    value = value.strip()

    # Remove currency symbols and formatting
    cleaned = re.sub(r'[^\d.\-,]', '', value)

    # Handle comma as decimal separator (European format)
    if ',' in cleaned and '.' not in cleaned:
        cleaned = cleaned.replace(',', '.')
    elif ',' in cleaned and '.' in cleaned:
        # Remove thousand separators
        cleaned = cleaned.replace(',', '')

    try:
        return float(cleaned)
    except ValueError:
        return None


# ============================================================================
# CSV IMPORT
# ============================================================================

async def process_csv_import(
    org_id: str,
    rows: List[Dict[str, Any]],
    column_mapping: Dict[str, str],
    default_space_id: Optional[str],
    skip_duplicates: bool,
    user_id: str
) -> Dict[str, Any]:
    """
    Process CSV import and create transactions.

    Args:
        org_id: Organization UUID
        rows: List of row dictionaries from CSV
        column_mapping: Maps our fields to CSV column names
        default_space_id: Default space for bookings
        skip_duplicates: Skip rows with existing external_booking_id
        user_id: User performing the import

    Returns:
        Dict with import results
    """
    results = {
        'total_rows': len(rows),
        'imported': 0,
        'skipped': 0,
        'errors': 0,
        'error_details': [],
        'created_transactions': []
    }

    if not rows:
        return results

    # Create or get a 'csv' platform entry for tracking
    csv_platform = execute_single(
        """
        SELECT id FROM set_house_external_platforms
        WHERE organization_id = :org_id AND platform_type = 'csv'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        {"org_id": org_id}
    )

    if not csv_platform:
        csv_platform = execute_insert(
            """
            INSERT INTO set_house_external_platforms (
                organization_id, platform_type, platform_name, created_by
            ) VALUES (
                :org_id, 'csv', 'CSV Import', :user_id
            )
            RETURNING *
            """,
            {"org_id": org_id, "user_id": user_id}
        )

    platform_id = csv_platform['id']

    # Create sync log
    sync_log = execute_insert(
        """
        INSERT INTO set_house_external_sync_log (
            platform_id, organization_id, sync_type, status, triggered_by, bookings_found
        ) VALUES (
            :platform_id, :org_id, 'csv', 'started', :user_id, :count
        )
        RETURNING *
        """,
        {
            "platform_id": platform_id,
            "org_id": org_id,
            "user_id": user_id,
            "count": len(rows)
        }
    )

    # Get existing external booking IDs for duplicate detection
    existing_ids = set()
    if skip_duplicates:
        existing = execute_query(
            """
            SELECT external_booking_id FROM set_house_transactions
            WHERE organization_id = :org_id
            AND external_booking_id IS NOT NULL
            """,
            {"org_id": org_id}
        )
        existing_ids = {r['external_booking_id'] for r in existing}

    # Get space name mapping for auto-matching
    spaces = execute_query(
        "SELECT id, name, internal_id FROM set_house_spaces WHERE organization_id = :org_id",
        {"org_id": org_id}
    )
    space_map = {}
    for space in spaces:
        space_map[space['name'].lower()] = space['id']
        if space.get('internal_id'):
            space_map[space['internal_id'].lower()] = space['id']

    # Process each row
    for i, row in enumerate(rows, start=1):
        try:
            # Extract values using column mapping
            def get_value(field: str) -> str:
                col_name = column_mapping.get(field)
                if not col_name:
                    return ''
                return str(row.get(col_name, '')).strip()

            # Get external booking ID
            external_id = get_value('external_booking_id')

            # Check for duplicate
            if skip_duplicates and external_id and external_id in existing_ids:
                results['skipped'] += 1
                continue

            # Parse dates and times
            start_date = parse_date(get_value('start_date'))
            end_date = parse_date(get_value('end_date'))
            start_time = parse_time(get_value('start_time'))
            end_time = parse_time(get_value('end_time'))

            # Combine date and time
            scheduled_start = None
            scheduled_end = None

            if start_date:
                scheduled_start = start_date.replace(tzinfo=timezone.utc)
                if start_time:
                    scheduled_start = scheduled_start + start_time

            if end_date:
                scheduled_end = end_date.replace(tzinfo=timezone.utc)
                if end_time:
                    scheduled_end = scheduled_end + end_time

            # If only start provided, default end to same day
            if scheduled_start and not scheduled_end:
                scheduled_end = scheduled_start + timedelta(hours=8)  # Default 8-hour booking

            # Determine space
            space_id = default_space_id
            space_name = get_value('space_name')
            if space_name:
                # Try to match space by name
                space_name_lower = space_name.lower()
                if space_name_lower in space_map:
                    space_id = space_map[space_name_lower]

            # Parse amount
            total_amount = parse_amount(get_value('total_amount'))

            # Get platform type from row or default to 'csv'
            platform_type = get_value('platform')
            if not platform_type:
                platform_type = 'csv'

            # Build notes
            notes_parts = []
            if get_value('notes'):
                notes_parts.append(get_value('notes'))
            if space_name and not space_id:
                notes_parts.append(f"Original space name: {space_name}")
            if total_amount:
                notes_parts.append(f"Amount: ${total_amount:.2f}")

            notes = '\n'.join(notes_parts) if notes_parts else None

            # Build metadata
            metadata = {
                'import_row': i,
                'import_date': datetime.now(timezone.utc).isoformat(),
                'original_data': {k: str(v)[:100] for k, v in row.items()},
                'source_platform': platform_type
            }
            if total_amount:
                metadata['amount'] = total_amount

            # Determine status
            status_value = get_value('status').lower()
            status = 'confirmed'
            if status_value in ['cancelled', 'canceled']:
                status = 'cancelled'
            elif status_value in ['completed', 'done', 'finished']:
                status = 'completed'
            elif status_value in ['pending', 'tentative']:
                status = 'pending'

            # Generate external ID if not provided
            if not external_id:
                external_id = f"CSV-{org_id[:8]}-{i}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

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
                    external_metadata,
                    is_external_booking,
                    client_name,
                    client_email,
                    client_phone
                ) VALUES (
                    :org_id,
                    'booking_confirmed',
                    :user_id,
                    :start,
                    :end,
                    :notes,
                    :status,
                    :platform_id,
                    :external_id,
                    :metadata,
                    TRUE,
                    :client_name,
                    :client_email,
                    :client_phone
                )
                RETURNING *
                """,
                {
                    "org_id": org_id,
                    "user_id": user_id,
                    "start": scheduled_start,
                    "end": scheduled_end,
                    "notes": notes,
                    "status": status,
                    "platform_id": platform_id,
                    "external_id": external_id,
                    "metadata": json.dumps(metadata),
                    "client_name": get_value('client_name'),
                    "client_email": get_value('client_email'),
                    "client_phone": get_value('client_phone')
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

            results['imported'] += 1
            results['created_transactions'].append({
                'id': transaction['id'],
                'external_id': external_id,
                'row': i
            })

            # Track for duplicate detection
            if external_id:
                existing_ids.add(external_id)

        except Exception as e:
            results['errors'] += 1
            results['error_details'].append({
                'row': i,
                'error': str(e),
                'data': {k: str(v)[:50] for k, v in row.items()}
            })

    # Update sync log
    execute_update(
        """
        UPDATE set_house_external_sync_log
        SET status = :status,
            completed_at = NOW(),
            bookings_created = :created,
            bookings_skipped = :skipped,
            bookings_errors = :errors,
            sync_details = :details
        WHERE id = :id
        """,
        {
            "id": sync_log['id'],
            "status": 'completed' if results['errors'] == 0 else 'completed_with_errors',
            "created": results['imported'],
            "skipped": results['skipped'],
            "errors": results['errors'],
            "details": json.dumps({
                'error_details': results['error_details'][:50],  # Limit stored errors
                'created_ids': [t['id'] for t in results['created_transactions'][:100]]
            })
        }
    )

    return results


async def validate_csv_row(
    row: Dict[str, Any],
    column_mapping: Dict[str, str],
    row_number: int
) -> Dict[str, Any]:
    """
    Validate a single CSV row and return parsed/validated data.
    Used for preview before import.
    """
    def get_value(field: str) -> str:
        col_name = column_mapping.get(field)
        if not col_name:
            return ''
        return str(row.get(col_name, '')).strip()

    validation = {
        'row': row_number,
        'valid': True,
        'warnings': [],
        'errors': [],
        'parsed': {}
    }

    # Parse and validate dates
    start_date = parse_date(get_value('start_date'))
    end_date = parse_date(get_value('end_date'))

    if get_value('start_date') and not start_date:
        validation['errors'].append(f"Invalid start date: {get_value('start_date')}")
        validation['valid'] = False

    if get_value('end_date') and not end_date:
        validation['errors'].append(f"Invalid end date: {get_value('end_date')}")
        validation['valid'] = False

    if start_date and end_date and start_date > end_date:
        validation['errors'].append("Start date is after end date")
        validation['valid'] = False

    validation['parsed']['start_date'] = start_date.isoformat() if start_date else None
    validation['parsed']['end_date'] = end_date.isoformat() if end_date else None

    # Validate required fields
    if not get_value('start_date'):
        validation['warnings'].append("No start date provided")

    # Validate email format
    email = get_value('client_email')
    if email and not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
        validation['warnings'].append(f"Invalid email format: {email}")

    # Parse amount
    amount = parse_amount(get_value('total_amount'))
    validation['parsed']['amount'] = amount

    # Store other parsed values
    validation['parsed']['client_name'] = get_value('client_name')
    validation['parsed']['client_email'] = email
    validation['parsed']['space_name'] = get_value('space_name')
    validation['parsed']['external_id'] = get_value('external_booking_id')

    return validation
