"""
Set House External Platforms API

Endpoints for managing external booking platform integrations
(Peerspace, Giggster, Splacer, Spacetoco, iCal feeds, CSV imports).
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl
import io
import csv

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.services import set_house_service

router = APIRouter(prefix="/external-platforms", tags=["Set House External Platforms"])


# ============================================================================
# SCHEMAS
# ============================================================================

class ExternalPlatformCreate(BaseModel):
    platform_type: str  # 'peerspace', 'giggster', 'splacer', 'spacetoco', 'ical', 'manual'
    platform_name: str
    ical_url: Optional[str] = None
    default_space_id: Optional[str] = None
    space_name_mapping: Optional[Dict[str, str]] = None
    sync_frequency_minutes: Optional[int] = 60
    auto_create_transactions: Optional[bool] = True
    notes: Optional[str] = None


class ExternalPlatformUpdate(BaseModel):
    platform_name: Optional[str] = None
    ical_url: Optional[str] = None
    default_space_id: Optional[str] = None
    space_name_mapping: Optional[Dict[str, str]] = None
    sync_frequency_minutes: Optional[int] = None
    auto_create_transactions: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ICalValidateRequest(BaseModel):
    url: str


class CSVColumnMapping(BaseModel):
    external_booking_id: Optional[str] = None
    platform: Optional[str] = None
    space_name: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_amount: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CSVImportRequest(BaseModel):
    column_mapping: CSVColumnMapping
    rows: List[Dict[str, Any]]
    default_space_id: Optional[str] = None
    skip_duplicates: bool = True


class CSVTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    column_mappings: Dict[str, str]
    date_format: Optional[str] = 'YYYY-MM-DD'
    time_format: Optional[str] = 'HH:mm'
    timezone: Optional[str] = 'UTC'
    delimiter: Optional[str] = ','
    has_header_row: Optional[bool] = True
    skip_rows: Optional[int] = 0
    is_default: Optional[bool] = False


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


VALID_PLATFORM_TYPES = ['peerspace', 'giggster', 'splacer', 'spacetoco', 'ical', 'csv', 'manual']


# ============================================================================
# PLATFORM MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_external_platforms(
    org_id: str,
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    platform_type: Optional[str] = Query(None, description="Filter by platform type"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List connected external platforms for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    conditions = ["organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if is_active is not None:
        conditions.append("is_active = :is_active")
        params["is_active"] = is_active

    if platform_type:
        conditions.append("platform_type = :platform_type")
        params["platform_type"] = platform_type

    where_clause = " AND ".join(conditions)

    # Get total count
    count_result = execute_single(
        f"SELECT COUNT(*) as count FROM set_house_external_platforms WHERE {where_clause}",
        params
    )
    total = count_result["count"] if count_result else 0

    # Get platforms with space info
    platforms = execute_query(
        f"""
        SELECT
            ep.*,
            s.name as default_space_name,
            s.internal_id as default_space_internal_id
        FROM set_house_external_platforms ep
        LEFT JOIN set_house_spaces s ON s.id = ep.default_space_id
        WHERE {where_clause}
        ORDER BY ep.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {
        "platforms": platforms,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/{org_id}")
async def create_external_platform(
    org_id: str,
    data: ExternalPlatformCreate,
    user=Depends(get_current_user)
):
    """Add a new external platform connection."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    if data.platform_type not in VALID_PLATFORM_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform type. Must be one of: {', '.join(VALID_PLATFORM_TYPES)}"
        )

    # Validate iCal URL if provided
    if data.ical_url:
        from app.services.ical_sync_service import validate_ical_url
        is_valid, error = await validate_ical_url(data.ical_url)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid iCal URL: {error}")

    import json
    platform = execute_insert(
        """
        INSERT INTO set_house_external_platforms (
            organization_id,
            platform_type,
            platform_name,
            ical_url,
            default_space_id,
            space_name_mapping,
            sync_frequency_minutes,
            auto_create_transactions,
            notes,
            created_by,
            next_sync_at
        ) VALUES (
            :org_id,
            :platform_type,
            :platform_name,
            :ical_url,
            :default_space_id,
            :space_name_mapping,
            :sync_frequency_minutes,
            :auto_create_transactions,
            :notes,
            :created_by,
            NOW() + INTERVAL '1 minute'
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "platform_type": data.platform_type,
            "platform_name": data.platform_name,
            "ical_url": data.ical_url,
            "default_space_id": data.default_space_id,
            "space_name_mapping": json.dumps(data.space_name_mapping or {}),
            "sync_frequency_minutes": data.sync_frequency_minutes or 60,
            "auto_create_transactions": data.auto_create_transactions if data.auto_create_transactions is not None else True,
            "notes": data.notes,
            "created_by": profile_id
        }
    )

    if not platform:
        raise HTTPException(status_code=500, detail="Failed to create platform connection")

    return {"platform": platform}


@router.get("/{org_id}/{platform_id}")
async def get_external_platform(
    org_id: str,
    platform_id: str,
    user=Depends(get_current_user)
):
    """Get details of a specific external platform connection."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    platform = execute_single(
        """
        SELECT
            ep.*,
            s.name as default_space_name,
            s.internal_id as default_space_internal_id
        FROM set_house_external_platforms ep
        LEFT JOIN set_house_spaces s ON s.id = ep.default_space_id
        WHERE ep.id = :platform_id AND ep.organization_id = :org_id
        """,
        {"platform_id": platform_id, "org_id": org_id}
    )

    if not platform:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    # Get recent sync count
    sync_stats = execute_single(
        """
        SELECT
            COUNT(*) as total_syncs,
            COUNT(*) FILTER (WHERE status = 'completed') as successful_syncs,
            SUM(bookings_created) as total_created,
            SUM(bookings_updated) as total_updated
        FROM set_house_external_sync_log
        WHERE platform_id = :platform_id
        AND started_at > NOW() - INTERVAL '30 days'
        """,
        {"platform_id": platform_id}
    )

    return {
        "platform": platform,
        "sync_stats": sync_stats
    }


@router.patch("/{org_id}/{platform_id}")
async def update_external_platform(
    org_id: str,
    platform_id: str,
    data: ExternalPlatformUpdate,
    user=Depends(get_current_user)
):
    """Update an external platform connection."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Verify platform exists
    existing = execute_single(
        "SELECT id FROM set_house_external_platforms WHERE id = :platform_id AND organization_id = :org_id",
        {"platform_id": platform_id, "org_id": org_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    # Build update query dynamically
    updates = []
    params = {"platform_id": platform_id, "org_id": org_id}

    if data.platform_name is not None:
        updates.append("platform_name = :platform_name")
        params["platform_name"] = data.platform_name

    if data.ical_url is not None:
        # Validate new URL
        if data.ical_url:
            from app.services.ical_sync_service import validate_ical_url
            is_valid, error = await validate_ical_url(data.ical_url)
            if not is_valid:
                raise HTTPException(status_code=400, detail=f"Invalid iCal URL: {error}")
        updates.append("ical_url = :ical_url")
        params["ical_url"] = data.ical_url

    if data.default_space_id is not None:
        updates.append("default_space_id = :default_space_id")
        params["default_space_id"] = data.default_space_id if data.default_space_id else None

    if data.space_name_mapping is not None:
        import json
        updates.append("space_name_mapping = :space_name_mapping")
        params["space_name_mapping"] = json.dumps(data.space_name_mapping)

    if data.sync_frequency_minutes is not None:
        updates.append("sync_frequency_minutes = :sync_frequency_minutes")
        params["sync_frequency_minutes"] = data.sync_frequency_minutes

    if data.auto_create_transactions is not None:
        updates.append("auto_create_transactions = :auto_create_transactions")
        params["auto_create_transactions"] = data.auto_create_transactions

    if data.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = data.is_active

    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_clause = ", ".join(updates)
    platform = execute_single(
        f"""
        UPDATE set_house_external_platforms
        SET {update_clause}
        WHERE id = :platform_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    return {"platform": platform}


@router.delete("/{org_id}/{platform_id}")
async def delete_external_platform(
    org_id: str,
    platform_id: str,
    user=Depends(get_current_user)
):
    """Remove an external platform connection."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    # Verify and delete
    result = execute_single(
        """
        DELETE FROM set_house_external_platforms
        WHERE id = :platform_id AND organization_id = :org_id
        RETURNING id
        """,
        {"platform_id": platform_id, "org_id": org_id}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    return {"success": True, "deleted_id": platform_id}


# ============================================================================
# SYNC OPERATIONS
# ============================================================================

@router.post("/{org_id}/{platform_id}/sync")
async def trigger_sync(
    org_id: str,
    platform_id: str,
    user=Depends(get_current_user)
):
    """Trigger a manual sync for an external platform."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get platform
    platform = execute_single(
        """
        SELECT * FROM set_house_external_platforms
        WHERE id = :platform_id AND organization_id = :org_id
        """,
        {"platform_id": platform_id, "org_id": org_id}
    )

    if not platform:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    if not platform.get("is_active"):
        raise HTTPException(status_code=400, detail="Platform connection is not active")

    if not platform.get("ical_url"):
        raise HTTPException(status_code=400, detail="No iCal URL configured for this platform")

    # Perform sync
    from app.services.ical_sync_service import sync_ical_bookings
    result = await sync_ical_bookings(platform_id, org_id, profile_id, sync_type="manual")

    return result


@router.get("/{org_id}/{platform_id}/logs")
async def get_sync_logs(
    org_id: str,
    platform_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """Get sync history for an external platform."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Verify platform exists
    platform = execute_single(
        "SELECT id FROM set_house_external_platforms WHERE id = :platform_id AND organization_id = :org_id",
        {"platform_id": platform_id, "org_id": org_id}
    )
    if not platform:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    logs = execute_query(
        """
        SELECT
            sl.*,
            p.display_name as triggered_by_name
        FROM set_house_external_sync_log sl
        LEFT JOIN profiles p ON p.id = sl.triggered_by
        WHERE sl.platform_id = :platform_id AND sl.organization_id = :org_id
        ORDER BY sl.started_at DESC
        LIMIT :limit OFFSET :offset
        """,
        {"platform_id": platform_id, "org_id": org_id, "limit": limit, "offset": offset}
    )

    total = execute_single(
        "SELECT COUNT(*) as count FROM set_house_external_sync_log WHERE platform_id = :platform_id",
        {"platform_id": platform_id}
    )

    return {
        "logs": logs,
        "total": total["count"] if total else 0,
        "limit": limit,
        "offset": offset
    }


# ============================================================================
# ICAL OPERATIONS
# ============================================================================

@router.post("/{org_id}/validate-ical")
async def validate_ical(
    org_id: str,
    data: ICalValidateRequest,
    user=Depends(get_current_user)
):
    """Test and validate an iCal URL."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.services.ical_sync_service import validate_ical_url, fetch_and_parse_ical

    is_valid, error = await validate_ical_url(data.url)
    if not is_valid:
        return {
            "valid": False,
            "error": error,
            "events_count": 0,
            "preview_events": []
        }

    # Try to fetch and parse
    try:
        events = await fetch_and_parse_ical(data.url)
        preview_events = events[:5] if events else []  # First 5 events for preview

        return {
            "valid": True,
            "events_count": len(events),
            "preview_events": [
                {
                    "uid": e.get("uid"),
                    "summary": e.get("summary"),
                    "start": e.get("start").isoformat() if e.get("start") else None,
                    "end": e.get("end").isoformat() if e.get("end") else None,
                    "location": e.get("location"),
                    "description": e.get("description", "")[:200]  # Truncate long descriptions
                }
                for e in preview_events
            ]
        }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "events_count": 0,
            "preview_events": []
        }


@router.get("/{org_id}/{platform_id}/preview-ical")
async def preview_ical_events(
    org_id: str,
    platform_id: str,
    limit: int = Query(20, le=100),
    user=Depends(get_current_user)
):
    """Preview events from an iCal feed without importing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    platform = execute_single(
        "SELECT * FROM set_house_external_platforms WHERE id = :platform_id AND organization_id = :org_id",
        {"platform_id": platform_id, "org_id": org_id}
    )

    if not platform:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    if not platform.get("ical_url"):
        raise HTTPException(status_code=400, detail="No iCal URL configured")

    from app.services.ical_sync_service import fetch_and_parse_ical

    try:
        events = await fetch_and_parse_ical(platform["ical_url"])

        # Check which events already exist
        existing_uids = set()
        if events:
            uids = [e.get("uid") for e in events if e.get("uid")]
            if uids:
                existing = execute_query(
                    """
                    SELECT external_event_uid FROM set_house_transactions
                    WHERE organization_id = :org_id AND external_event_uid = ANY(:uids)
                    """,
                    {"org_id": org_id, "uids": uids}
                )
                existing_uids = {r["external_event_uid"] for r in existing}

        preview_events = []
        for e in events[:limit]:
            preview_events.append({
                "uid": e.get("uid"),
                "summary": e.get("summary"),
                "start": e.get("start").isoformat() if e.get("start") else None,
                "end": e.get("end").isoformat() if e.get("end") else None,
                "location": e.get("location"),
                "description": e.get("description", "")[:200],
                "already_imported": e.get("uid") in existing_uids
            })

        return {
            "total_events": len(events),
            "preview_events": preview_events,
            "already_imported_count": sum(1 for e in preview_events if e["already_imported"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch iCal feed: {str(e)}")


# ============================================================================
# CSV IMPORT OPERATIONS
# ============================================================================

@router.get("/{org_id}/csv-template")
async def download_csv_template(
    org_id: str,
    user=Depends(get_current_user)
):
    """Download a CSV template for importing bookings."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Create CSV template
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    headers = [
        "external_booking_id",
        "platform",
        "space_name",
        "client_name",
        "client_email",
        "client_phone",
        "start_date",
        "end_date",
        "start_time",
        "end_time",
        "total_amount",
        "status",
        "notes"
    ]
    writer.writerow(headers)

    # Example row
    writer.writerow([
        "PSP-12345",
        "peerspace",
        "Studio A",
        "John Doe",
        "john@example.com",
        "555-1234",
        "2024-02-15",
        "2024-02-15",
        "09:00",
        "17:00",
        "500.00",
        "confirmed",
        "Photo shoot - requires lighting equipment"
    ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=booking_import_template.csv"}
    )


@router.post("/{org_id}/import-csv")
async def import_csv_bookings(
    org_id: str,
    data: CSVImportRequest,
    user=Depends(get_current_user)
):
    """Import bookings from CSV data."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.services.csv_import_service import process_csv_import

    result = await process_csv_import(
        org_id=org_id,
        rows=data.rows,
        column_mapping=data.column_mapping.dict(),
        default_space_id=data.default_space_id,
        skip_duplicates=data.skip_duplicates,
        user_id=profile_id
    )

    return result


@router.post("/{org_id}/upload-csv")
async def upload_csv_file(
    org_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Upload a CSV file and return parsed rows for preview."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    contents = await file.read()
    try:
        decoded = contents.decode('utf-8')
    except UnicodeDecodeError:
        try:
            decoded = contents.decode('latin-1')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to decode file. Please use UTF-8 encoding.")

    # Parse CSV
    reader = csv.DictReader(io.StringIO(decoded))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    # Get columns
    columns = list(rows[0].keys()) if rows else []

    # Auto-detect column mappings
    auto_mapping = {}
    column_lower = {c.lower().replace(' ', '_').replace('-', '_'): c for c in columns}

    mapping_hints = {
        'external_booking_id': ['booking_id', 'id', 'external_id', 'reservation_id', 'confirmation'],
        'platform': ['platform', 'source', 'channel'],
        'space_name': ['space', 'space_name', 'location', 'venue', 'room'],
        'client_name': ['client', 'client_name', 'customer', 'customer_name', 'name', 'guest'],
        'client_email': ['email', 'client_email', 'customer_email'],
        'client_phone': ['phone', 'client_phone', 'customer_phone', 'mobile'],
        'start_date': ['start_date', 'check_in', 'checkin', 'arrival', 'date'],
        'end_date': ['end_date', 'check_out', 'checkout', 'departure'],
        'start_time': ['start_time', 'check_in_time', 'arrival_time', 'time'],
        'end_time': ['end_time', 'check_out_time', 'departure_time'],
        'total_amount': ['total', 'amount', 'price', 'total_amount', 'revenue', 'rate'],
        'status': ['status', 'booking_status', 'state'],
        'notes': ['notes', 'comments', 'description', 'special_requests']
    }

    for field, hints in mapping_hints.items():
        for hint in hints:
            if hint in column_lower:
                auto_mapping[field] = column_lower[hint]
                break

    return {
        "columns": columns,
        "row_count": len(rows),
        "preview_rows": rows[:10],  # First 10 rows for preview
        "auto_mapping": auto_mapping
    }


# ============================================================================
# CSV TEMPLATES
# ============================================================================

@router.get("/{org_id}/csv-templates")
async def list_csv_templates(
    org_id: str,
    user=Depends(get_current_user)
):
    """List saved CSV import templates."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    templates = execute_query(
        """
        SELECT * FROM set_house_csv_templates
        WHERE organization_id = :org_id
        ORDER BY is_default DESC, created_at DESC
        """,
        {"org_id": org_id}
    )

    return {"templates": templates}


@router.post("/{org_id}/csv-templates")
async def create_csv_template(
    org_id: str,
    data: CSVTemplateCreate,
    user=Depends(get_current_user)
):
    """Save a CSV import template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    import json

    # If setting as default, unset other defaults
    if data.is_default:
        execute_update(
            "UPDATE set_house_csv_templates SET is_default = FALSE WHERE organization_id = :org_id",
            {"org_id": org_id}
        )

    template = execute_insert(
        """
        INSERT INTO set_house_csv_templates (
            organization_id, name, description, column_mappings,
            date_format, time_format, timezone, delimiter,
            has_header_row, skip_rows, is_default, created_by
        ) VALUES (
            :org_id, :name, :description, :column_mappings,
            :date_format, :time_format, :timezone, :delimiter,
            :has_header_row, :skip_rows, :is_default, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": data.name,
            "description": data.description,
            "column_mappings": json.dumps(data.column_mappings),
            "date_format": data.date_format or 'YYYY-MM-DD',
            "time_format": data.time_format or 'HH:mm',
            "timezone": data.timezone or 'UTC',
            "delimiter": data.delimiter or ',',
            "has_header_row": data.has_header_row if data.has_header_row is not None else True,
            "skip_rows": data.skip_rows or 0,
            "is_default": data.is_default or False,
            "created_by": profile_id
        }
    )

    return {"template": template}


@router.delete("/{org_id}/csv-templates/{template_id}")
async def delete_csv_template(
    org_id: str,
    template_id: str,
    user=Depends(get_current_user)
):
    """Delete a CSV import template."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    result = execute_single(
        """
        DELETE FROM set_house_csv_templates
        WHERE id = :template_id AND organization_id = :org_id
        RETURNING id
        """,
        {"template_id": template_id, "org_id": org_id}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"success": True, "deleted_id": template_id}


# ============================================================================
# EXTERNAL BOOKINGS LIST
# ============================================================================

@router.get("/{org_id}/bookings")
async def list_external_bookings(
    org_id: str,
    platform_id: Optional[str] = Query(None, description="Filter by platform"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List all external bookings (transactions from external platforms)."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    conditions = ["t.organization_id = :org_id", "t.is_external_booking = TRUE"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if platform_id:
        conditions.append("t.external_platform_id = :platform_id")
        params["platform_id"] = platform_id

    where_clause = " AND ".join(conditions)

    bookings = execute_query(
        f"""
        SELECT
            t.*,
            ep.platform_type,
            ep.platform_name,
            s.name as space_name,
            s.internal_id as space_internal_id
        FROM set_house_transactions t
        LEFT JOIN set_house_external_platforms ep ON ep.id = t.external_platform_id
        LEFT JOIN set_house_transaction_items ti ON ti.transaction_id = t.id
        LEFT JOIN set_house_spaces s ON s.id = ti.space_id
        WHERE {where_clause}
        ORDER BY t.scheduled_start DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    total = execute_single(
        f"SELECT COUNT(*) as count FROM set_house_transactions t WHERE {where_clause}",
        params
    )

    return {
        "bookings": bookings,
        "total": total["count"] if total else 0,
        "limit": limit,
        "offset": offset
    }
