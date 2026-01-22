"""
Set House Repairs API

Endpoints for managing repair tickets.
"""
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/repairs", tags=["Set House Repairs"])


# ============================================================================
# SCHEMAS
# ============================================================================

class RepairCreate(BaseModel):
    space_id: str
    title: str
    description: Optional[str] = None
    priority: str = "normal"
    incident_id: Optional[str] = None


class RepairUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    diagnosis: Optional[str] = None
    vendor_id: Optional[str] = None
    vendor_reference: Optional[str] = None
    quote_amount: Optional[float] = None
    parts_cost: Optional[float] = None
    labor_cost: Optional[float] = None
    total_cost: Optional[float] = None
    estimated_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    qc_passed: Optional[bool] = None
    qc_notes: Optional[str] = None
    notes: Optional[str] = None
    assigned_to_user_id: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# REPAIR ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_repairs(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    space_id: Optional[str] = Query(None, description="Filter by space"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List repair tickets for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_repairs(
        org_id,
        status=status,
        space_id=space_id,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_repair(
    org_id: str,
    data: RepairCreate,
    user=Depends(get_current_user)
):
    """Create a new repair ticket."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    repair = set_house_service.create_repair(
        org_id,
        data.space_id,
        data.title,
        profile_id,
        **data.model_dump(exclude={"space_id", "title"})
    )

    if not repair:
        raise HTTPException(status_code=500, detail="Failed to create repair ticket")

    return {"repair": repair}


@router.get("/{org_id}/{repair_id}")
async def get_repair(
    org_id: str,
    repair_id: str,
    user=Depends(get_current_user)
):
    """Get a single repair ticket."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single

    repair = execute_single(
        """
        SELECT r.*, s.name as space_name, s.internal_id as space_internal_id,
               v.name as vendor_name, cp.display_name as created_by_name,
               ap.display_name as assigned_to_name, dp.display_name as diagnosed_by_name,
               qp.display_name as qc_by_name
        FROM set_house_repairs r
        LEFT JOIN set_house_spaces s ON s.id = r.space_id
        LEFT JOIN set_house_vendors v ON v.id = r.vendor_id
        LEFT JOIN profiles cp ON cp.id = r.created_by_user_id
        LEFT JOIN profiles ap ON ap.id = r.assigned_to_user_id
        LEFT JOIN profiles dp ON dp.id = r.diagnosed_by_user_id
        LEFT JOIN profiles qp ON qp.id = r.qc_by_user_id
        WHERE r.id = :repair_id AND r.organization_id = :org_id
        """,
        {"repair_id": repair_id, "org_id": org_id}
    )

    if not repair:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    return {"repair": repair}


@router.put("/{org_id}/{repair_id}")
async def update_repair(
    org_id: str,
    repair_id: str,
    data: RepairUpdate,
    user=Depends(get_current_user)
):
    """Update a repair ticket."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Handle diagnosis
    if "diagnosis" in updates and updates["diagnosis"]:
        updates["diagnosed_at"] = datetime.now(timezone.utc)
        updates["diagnosed_by_user_id"] = profile_id

    # Handle QC
    if "qc_passed" in updates:
        updates["qc_at"] = datetime.now(timezone.utc)
        updates["qc_by_user_id"] = profile_id

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "repair_id": repair_id, "org_id": org_id}

    repair = execute_insert(
        f"""
        UPDATE set_house_repairs
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :repair_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not repair:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    return {"repair": repair}


@router.post("/{org_id}/{repair_id}/approve-quote")
async def approve_quote(
    org_id: str,
    repair_id: str,
    user=Depends(get_current_user)
):
    """Approve a repair quote."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    repair = execute_insert(
        """
        UPDATE set_house_repairs
        SET quote_approved_at = :now, quote_approved_by_user_id = :user_id,
            status = 'in_repair', updated_at = NOW()
        WHERE id = :repair_id AND organization_id = :org_id
        RETURNING *
        """,
        {
            "repair_id": repair_id,
            "org_id": org_id,
            "now": datetime.now(timezone.utc),
            "user_id": profile_id
        }
    )

    if not repair:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    return {"repair": repair}


@router.post("/{org_id}/{repair_id}/complete")
async def complete_repair(
    org_id: str,
    repair_id: str,
    qc_passed: bool = True,
    qc_notes: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Complete a repair ticket."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone, date

    repair = execute_insert(
        """
        UPDATE set_house_repairs
        SET status = 'closed', qc_passed = :qc_passed, qc_notes = :qc_notes,
            qc_at = :now, qc_by_user_id = :user_id, actual_completion_date = :today,
            updated_at = NOW()
        WHERE id = :repair_id AND organization_id = :org_id
        RETURNING *
        """,
        {
            "repair_id": repair_id,
            "org_id": org_id,
            "qc_passed": qc_passed,
            "qc_notes": qc_notes,
            "now": datetime.now(timezone.utc),
            "user_id": profile_id,
            "today": date.today()
        }
    )

    if not repair:
        raise HTTPException(status_code=404, detail="Repair ticket not found")

    return {"repair": repair}
