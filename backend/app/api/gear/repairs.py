"""
Gear House Repairs API

Endpoints for managing repair tickets.
"""
from typing import Optional, List
from datetime import date
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from app.core.auth import get_current_user_from_token
from app.api.users import get_profile_id_from_cognito_id
from app.services import gear_service

router = APIRouter(prefix="/repairs", tags=["Gear Repairs"])


# ============================================================================
# SCHEMAS
# ============================================================================

class RepairTicketCreate(BaseModel):
    asset_id: str
    title: str
    description: Optional[str] = None
    priority: str = "normal"  # low, normal, high, urgent
    vendor_id: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    incident_id: Optional[str] = None


class RepairTicketStatusUpdate(BaseModel):
    status: str  # open, diagnosing, awaiting_approval, in_repair, ready_for_qc, closed, cancelled
    notes: Optional[str] = None
    diagnosis: Optional[str] = None
    quote_amount: Optional[float] = None
    quote_approved: Optional[bool] = None
    parts_cost: Optional[float] = None
    labor_cost: Optional[float] = None
    total_cost: Optional[float] = None
    qc_passed: Optional[bool] = None
    qc_notes: Optional[str] = None


class RepairTicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    vendor_id: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    estimated_completion_date: Optional[date] = None
    vendor_reference: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_profile_id(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    user = await get_current_user_from_token(authorization)
    profile_id = get_profile_id_from_cognito_id(user["sub"])
    return profile_id or user["sub"]


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# REPAIR TICKET ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_repair_tickets(
    org_id: str,
    status: Optional[str] = Query(None),
    asset_id: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    authorization: str = Header(None)
):
    """List repair tickets for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    result = gear_service.list_repair_tickets(
        org_id,
        status=status,
        asset_id=asset_id,
        assigned_to=assigned_to,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_repair_ticket(
    org_id: str,
    data: RepairTicketCreate,
    authorization: str = Header(None)
):
    """Create a new repair ticket."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Validate priority
    valid_priorities = ["low", "normal", "high", "urgent"]
    if data.priority not in valid_priorities:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {valid_priorities}")

    ticket = gear_service.create_repair_ticket(
        org_id,
        data.asset_id,
        data.title,
        profile_id,
        **data.dict(exclude={"asset_id", "title"})
    )

    if not ticket:
        raise HTTPException(status_code=500, detail="Failed to create repair ticket")

    return {"ticket": ticket}


@router.get("/item/{ticket_id}")
async def get_repair_ticket(
    ticket_id: str,
    authorization: str = Header(None)
):
    """Get repair ticket details."""
    profile_id = await get_current_profile_id(authorization)

    ticket = gear_service.get_repair_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    require_org_access(ticket["organization_id"], profile_id)

    return {"ticket": ticket}


@router.put("/item/{ticket_id}")
async def update_repair_ticket(
    ticket_id: str,
    data: RepairTicketUpdate,
    authorization: str = Header(None)
):
    """Update repair ticket details."""
    profile_id = await get_current_profile_id(authorization)

    ticket = gear_service.get_repair_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    require_org_access(ticket["organization_id"], profile_id, ["owner", "admin", "manager"])

    # Build update
    updates = []
    params = {"ticket_id": ticket_id}

    for field in ["title", "description", "priority", "vendor_id",
                  "assigned_to_user_id", "estimated_completion_date", "vendor_reference"]:
        value = getattr(data, field)
        if value is not None:
            updates.append(f"{field} = :{field}")
            params[field] = value

    if updates:
        from app.core.database import execute_insert
        ticket = execute_insert(
            f"""
            UPDATE gear_repair_tickets
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = :ticket_id
            RETURNING *
            """,
            params
        )

    return {"ticket": ticket}


@router.patch("/item/{ticket_id}/status")
async def update_repair_ticket_status(
    ticket_id: str,
    data: RepairTicketStatusUpdate,
    authorization: str = Header(None)
):
    """Update repair ticket status."""
    profile_id = await get_current_profile_id(authorization)

    ticket = gear_service.get_repair_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    require_org_access(ticket["organization_id"], profile_id, ["owner", "admin", "manager"])

    # Validate status
    valid_statuses = ["open", "diagnosing", "awaiting_approval", "in_repair",
                      "ready_for_qc", "closed", "cancelled"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    # Validate status transitions
    current_status = ticket["status"]
    valid_transitions = {
        "open": ["diagnosing", "cancelled"],
        "diagnosing": ["awaiting_approval", "in_repair", "cancelled"],
        "awaiting_approval": ["in_repair", "diagnosing", "cancelled"],
        "in_repair": ["ready_for_qc", "diagnosing", "cancelled"],
        "ready_for_qc": ["closed", "in_repair"],
        "closed": [],
        "cancelled": []
    }

    if data.status not in valid_transitions.get(current_status, []) and data.status != current_status:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {current_status} to {data.status}"
        )

    updated = gear_service.update_repair_ticket_status(
        ticket_id,
        data.status,
        profile_id,
        notes=data.notes,
        **data.dict(exclude={"status", "notes"})
    )

    return {"ticket": updated}


@router.get("/{org_id}/stats")
async def get_repair_stats(
    org_id: str,
    authorization: str = Header(None)
):
    """Get repair ticket statistics."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query, execute_single

    # By status
    by_status = execute_query(
        """
        SELECT status, COUNT(*) as count
        FROM gear_repair_tickets
        WHERE organization_id = :org_id
        GROUP BY status
        """,
        {"org_id": org_id}
    )

    # By priority
    by_priority = execute_query(
        """
        SELECT priority, COUNT(*) as count
        FROM gear_repair_tickets
        WHERE organization_id = :org_id AND status NOT IN ('closed', 'cancelled')
        GROUP BY priority
        """,
        {"org_id": org_id}
    )

    # Cost summary
    cost_stats = execute_single(
        """
        SELECT
            COUNT(*) as total_closed,
            COALESCE(SUM(total_cost), 0) as total_cost,
            COALESCE(AVG(total_cost), 0) as avg_cost,
            COALESCE(AVG(downtime_days), 0) as avg_downtime
        FROM gear_repair_tickets
        WHERE organization_id = :org_id AND status = 'closed'
        """,
        {"org_id": org_id}
    )

    # Average time to close (last 90 days)
    time_stats = execute_single(
        """
        SELECT AVG(
            EXTRACT(EPOCH FROM (actual_completion_date - created_at::date)) / 86400
        ) as avg_days_to_close
        FROM gear_repair_tickets
        WHERE organization_id = :org_id
          AND status = 'closed'
          AND created_at > NOW() - INTERVAL '90 days'
        """,
        {"org_id": org_id}
    )

    return {
        "by_status": {s["status"]: s["count"] for s in by_status},
        "open_by_priority": {p["priority"]: p["count"] for p in by_priority},
        "costs": cost_stats,
        "avg_days_to_close": time_stats.get("avg_days_to_close") if time_stats else None
    }


# ============================================================================
# VENDOR ENDPOINTS
# ============================================================================

@router.get("/{org_id}/vendors")
async def list_vendors(
    org_id: str,
    authorization: str = Header(None)
):
    """List repair vendors for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query
    vendors = execute_query(
        """
        SELECT * FROM gear_vendors
        WHERE organization_id = :org_id AND is_active = TRUE
        ORDER BY is_preferred DESC, name
        """,
        {"org_id": org_id}
    )

    return {"vendors": vendors}


@router.post("/{org_id}/vendors")
async def create_vendor(
    org_id: str,
    name: str,
    vendor_type: str = "repair",
    email: Optional[str] = None,
    phone: Optional[str] = None,
    website: Optional[str] = None,
    is_preferred: bool = False,
    authorization: str = Header(None)
):
    """Create a new vendor."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    vendor = execute_insert(
        """
        INSERT INTO gear_vendors (organization_id, name, vendor_type, email, phone, website, is_preferred)
        VALUES (:org_id, :name, :type, :email, :phone, :website, :preferred)
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "type": vendor_type,
            "email": email,
            "phone": phone,
            "website": website,
            "preferred": is_preferred
        }
    )

    return {"vendor": vendor}
