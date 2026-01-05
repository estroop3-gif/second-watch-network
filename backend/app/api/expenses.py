"""
Expenses API - Mileage, Kit Rentals, Per Diem, and Reimbursement Management
Supports expense tracking, approval workflows, and project-level settings
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from app.core.database import get_client, execute_single

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> str:
    """
    Look up the profile ID from a Cognito user ID.
    Returns the profile ID or None if not found.
    """
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)
    # First try cognito_user_id (preferred, exact match)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    # Fallback: check if it's already a profile ID
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if not profile_row:
        return None
    return str(profile_row["id"])


# =============================================================================
# MODELS
# =============================================================================

# Mileage Models
class MileageEntry(BaseModel):
    id: str
    project_id: str
    user_id: str
    date: str
    description: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    miles: float
    rate_per_mile: float = 0.67
    total_amount: Optional[float] = None
    is_round_trip: bool = False
    purpose: Optional[str] = None
    receipt_id: Optional[str] = None
    status: str = "pending"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    reimbursed_at: Optional[str] = None
    reimbursed_via: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    # Budget linking
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    # Scene linking
    scene_id: Optional[str] = None
    # Computed
    user_name: Optional[str] = None


class CreateMileageRequest(BaseModel):
    date: str  # YYYY-MM-DD
    description: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    miles: float
    rate_per_mile: Optional[float] = 0.67
    is_round_trip: bool = False
    purpose: Optional[str] = None
    receipt_id: Optional[str] = None
    notes: Optional[str] = None
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    scene_id: Optional[str] = None


class UpdateMileageRequest(BaseModel):
    description: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    miles: Optional[float] = None
    rate_per_mile: Optional[float] = None
    is_round_trip: Optional[bool] = None
    purpose: Optional[str] = None
    receipt_id: Optional[str] = None
    notes: Optional[str] = None
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    scene_id: Optional[str] = None


# Kit Rental Models
class KitRental(BaseModel):
    id: str
    project_id: str
    user_id: str
    kit_name: str
    kit_description: Optional[str] = None
    daily_rate: float
    weekly_rate: Optional[float] = None
    start_date: str
    end_date: Optional[str] = None
    days_used: Optional[int] = None
    total_amount: Optional[float] = None
    rental_type: str = "daily"
    status: str = "pending"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    completed_at: Optional[str] = None
    reimbursed_at: Optional[str] = None
    reimbursed_via: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    # Budget linking
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    # Scene linking
    scene_id: Optional[str] = None
    # Computed
    user_name: Optional[str] = None


class CreateKitRentalRequest(BaseModel):
    kit_name: str
    kit_description: Optional[str] = None
    daily_rate: float
    weekly_rate: Optional[float] = None
    start_date: str  # YYYY-MM-DD
    end_date: Optional[str] = None
    rental_type: str = "daily"
    notes: Optional[str] = None
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    scene_id: Optional[str] = None


class UpdateKitRentalRequest(BaseModel):
    kit_name: Optional[str] = None
    kit_description: Optional[str] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    end_date: Optional[str] = None
    rental_type: Optional[str] = None
    notes: Optional[str] = None
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    scene_id: Optional[str] = None


# Per Diem Models
class PerDiemEntry(BaseModel):
    id: str
    project_id: str
    user_id: str
    date: str
    meal_type: str
    amount: float
    location: Optional[str] = None
    status: str = "pending"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    reimbursed_at: Optional[str] = None
    reimbursed_via: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    # Budget linking
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    # Scene linking
    scene_id: Optional[str] = None
    # Computed
    user_name: Optional[str] = None


class CreatePerDiemRequest(BaseModel):
    date: str  # YYYY-MM-DD
    meal_type: str  # breakfast, lunch, dinner, full_day
    amount: float
    location: Optional[str] = None
    notes: Optional[str] = None
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    scene_id: Optional[str] = None


class BulkPerDiemRequest(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    meal_type: str
    amount: float
    location: Optional[str] = None
    notes: Optional[str] = None
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    scene_id: Optional[str] = None


# Expense Settings Models
class ExpenseSettings(BaseModel):
    project_id: str
    mileage_rate: float = 0.67
    per_diem_breakfast: float = 15.00
    per_diem_lunch: float = 20.00
    per_diem_dinner: float = 30.00
    per_diem_full_day: float = 65.00
    require_receipts_over: float = 25.00
    auto_approve_under: Optional[float] = None
    allowed_categories: List[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UpdateExpenseSettingsRequest(BaseModel):
    mileage_rate: Optional[float] = None
    per_diem_breakfast: Optional[float] = None
    per_diem_lunch: Optional[float] = None
    per_diem_dinner: Optional[float] = None
    per_diem_full_day: Optional[float] = None
    require_receipts_over: Optional[float] = None
    auto_approve_under: Optional[float] = None
    allowed_categories: Optional[List[str]] = None


# Summary Models
class ExpenseSummary(BaseModel):
    pending_mileage: float = 0
    pending_kit_rentals: float = 0
    pending_per_diem: float = 0
    pending_receipts: float = 0
    total_pending: float = 0
    approved_mileage: float = 0
    approved_kit_rentals: float = 0
    approved_per_diem: float = 0
    approved_receipts: float = 0
    total_approved: float = 0
    reimbursed_total: float = 0
    pending_count: int = 0
    approved_count: int = 0
    # Company card expenses (separate from personal reimbursement flow)
    company_card_total: float = 0
    company_card_count: int = 0
    personal_card_total: float = 0
    personal_card_count: int = 0
    # Grand totals by expense type (pending + approved + reimbursed)
    total_mileage: float = 0
    total_kit_rentals: float = 0
    total_per_diem: float = 0
    total_receipts: float = 0


class ApproveRejectRequest(BaseModel):
    reason: Optional[str] = None


class MarkReimbursedRequest(BaseModel):
    via: Optional[str] = None  # check, direct_deposit, petty_cash


class ApprovalNotesRequest(BaseModel):
    notes: Optional[str] = None  # Optional notes when approving


class DenyExpenseRequest(BaseModel):
    reason: str  # Required - reason for denial (permanent rejection)


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token, returning profile ID"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        cognito_id = user.get("id")
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        return {"id": profile_id, "email": user.get("email"), "cognito_id": cognito_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_member(client, project_id: str, user_id: str) -> bool:
    """Verify user is a member of the project"""
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and str(project_resp.data[0]["owner_id"]) == str(user_id):
        return True

    member_resp = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    return bool(member_resp.data)


async def can_approve_expenses(client, project_id: str, user_id: str) -> bool:
    """Check if user can approve/reject expenses"""
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and str(project_resp.data[0]["owner_id"]) == str(user_id):
        return True

    role_resp = client.table("backlot_project_roles").select("backlot_role").eq("project_id", project_id).eq("user_id", user_id).execute()
    for role in (role_resp.data or []):
        if role.get("backlot_role") in ["showrunner", "producer"]:
            return True

    member_resp = client.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
    if member_resp.data and member_resp.data[0].get("role") == "admin":
        return True

    return False


def calculate_mileage_total(miles: float, rate_per_mile: float, is_round_trip: bool) -> float:
    """Calculate total mileage reimbursement"""
    effective_miles = miles * 2 if is_round_trip else miles
    return round(effective_miles * rate_per_mile, 2)


def calculate_kit_rental_total(
    daily_rate: float,
    weekly_rate: Optional[float],
    start_date: str,
    end_date: Optional[str],
    rental_type: str
) -> Optional[float]:
    """Calculate total kit rental amount"""
    if not end_date:
        return None  # Ongoing rental

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        days = (end - start).days + 1

        if rental_type == "flat":
            return daily_rate  # daily_rate used as flat rate
        elif rental_type == "weekly" and weekly_rate:
            weeks = days // 7
            remaining_days = days % 7
            return (weeks * weekly_rate) + (remaining_days * daily_rate)
        else:
            return days * daily_rate
    except:
        return None


def get_expense_settings(client, project_id: str) -> ExpenseSettings:
    """Get expense settings for a project, creating default if needed"""
    resp = client.table("backlot_project_expense_settings").select("*").eq("project_id", project_id).execute()
    if resp.data:
        data = resp.data[0]
        return ExpenseSettings(
            project_id=data["project_id"],
            mileage_rate=data.get("mileage_rate", 0.67),
            per_diem_breakfast=data.get("per_diem_breakfast", 15.00),
            per_diem_lunch=data.get("per_diem_lunch", 20.00),
            per_diem_dinner=data.get("per_diem_dinner", 30.00),
            per_diem_full_day=data.get("per_diem_full_day", 65.00),
            require_receipts_over=data.get("require_receipts_over", 25.00),
            auto_approve_under=data.get("auto_approve_under"),
            allowed_categories=data.get("allowed_categories", []),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    # Return defaults
    return ExpenseSettings(project_id=project_id)


# =============================================================================
# MILEAGE ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/mileage", response_model=List[MileageEntry])
async def list_mileage(
    project_id: str,
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List mileage entries for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    can_view_all = await can_approve_expenses(client, project_id, user["id"])

    query = client.table("backlot_mileage_entries").select(
        "*, profiles:user_id(full_name)"
    ).eq("project_id", project_id)

    # Non-managers can only see their own
    if not can_view_all:
        query = query.eq("user_id", user["id"])
    elif user_id:
        query = query.eq("user_id", user_id)

    if status:
        query = query.eq("status", status)
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    resp = query.order("date", desc=True).execute()

    result = []
    for entry in (resp.data or []):
        profile = entry.get("profiles") or {}
        total = calculate_mileage_total(
            entry["miles"],
            entry.get("rate_per_mile", 0.67),
            entry.get("is_round_trip", False)
        )
        result.append(MileageEntry(
            **{k: v for k, v in entry.items() if k != "profiles"},
            total_amount=total,
            user_name=profile.get("full_name"),
        ))

    return result


@router.post("/projects/{project_id}/mileage", response_model=MileageEntry)
async def create_mileage(
    project_id: str,
    request: CreateMileageRequest,
    authorization: str = Header(None)
):
    """Create a new mileage entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get project mileage rate
    settings = get_expense_settings(client, project_id)
    rate = request.rate_per_mile or settings.mileage_rate

    entry_data = {
        "project_id": project_id,
        "user_id": user["id"],
        "date": request.date,
        "description": request.description or None,
        "start_location": request.start_location or None,
        "end_location": request.end_location or None,
        "miles": request.miles,
        "rate_per_mile": rate,
        "is_round_trip": request.is_round_trip,
        "purpose": request.purpose or None,  # Must be NULL or valid enum value
        "receipt_id": request.receipt_id,
        "notes": request.notes or None,
        "status": "pending",
        "budget_category_id": request.budget_category_id,
        "budget_line_item_id": request.budget_line_item_id,
        "scene_id": request.scene_id,
    }

    resp = client.table("backlot_mileage_entries").insert(entry_data).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create mileage entry")

    entry = resp.data[0]
    total = calculate_mileage_total(entry["miles"], entry.get("rate_per_mile", 0.67), entry.get("is_round_trip", False))
    return MileageEntry(**entry, total_amount=total)


@router.put("/projects/{project_id}/mileage/{mileage_id}", response_model=MileageEntry)
async def update_mileage(
    project_id: str,
    mileage_id: str,
    request: UpdateMileageRequest,
    authorization: str = Header(None)
):
    """Update a mileage entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get entry
    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]

    # Only owner can edit pending entries, managers can edit any
    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] not in ["pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot edit this entry")

    # Build update data
    update_data = {}
    if request.description is not None:
        update_data["description"] = request.description
    if request.start_location is not None:
        update_data["start_location"] = request.start_location
    if request.end_location is not None:
        update_data["end_location"] = request.end_location
    if request.miles is not None:
        update_data["miles"] = request.miles
    if request.rate_per_mile is not None:
        update_data["rate_per_mile"] = request.rate_per_mile
    if request.is_round_trip is not None:
        update_data["is_round_trip"] = request.is_round_trip
    if request.purpose is not None:
        update_data["purpose"] = request.purpose
    if request.receipt_id is not None:
        update_data["receipt_id"] = request.receipt_id
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.budget_category_id is not None:
        update_data["budget_category_id"] = request.budget_category_id
    if request.budget_line_item_id is not None:
        update_data["budget_line_item_id"] = request.budget_line_item_id
    if request.scene_id is not None:
        update_data["scene_id"] = request.scene_id

    if not update_data:
        return MileageEntry(**entry, total_amount=calculate_mileage_total(entry["miles"], entry.get("rate_per_mile", 0.67), entry.get("is_round_trip", False)))

    resp = client.table("backlot_mileage_entries").update(update_data).eq("id", mileage_id).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to update mileage entry")

    updated = resp.data[0]
    total = calculate_mileage_total(updated["miles"], updated.get("rate_per_mile", 0.67), updated.get("is_round_trip", False))
    return MileageEntry(**updated, total_amount=total)


@router.delete("/projects/{project_id}/mileage/{mileage_id}")
async def delete_mileage(
    project_id: str,
    mileage_id: str,
    authorization: str = Header(None)
):
    """Delete a mileage entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get entry
    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]

    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] not in ["pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot delete this entry")

    client.table("backlot_mileage_entries").delete().eq("id", mileage_id).execute()
    return {"success": True}


@router.post("/projects/{project_id}/mileage/{mileage_id}/approve")
async def approve_mileage(
    project_id: str,
    mileage_id: str,
    request: ApprovalNotesRequest = None,
    authorization: str = Header(None)
):
    """Approve a mileage entry with optional notes"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to approve expenses")

    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]
    if entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending entries can be approved")

    update_data = {
        "status": "approved",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow().isoformat(),
    }
    if request and request.notes:
        update_data["approval_notes"] = request.notes

    client.table("backlot_mileage_entries").update(update_data).eq("id", mileage_id).execute()

    # Auto-add to user's draft invoice
    from app.services.invoice_auto_sync import auto_add_mileage_to_invoice
    auto_added, invoice_id = auto_add_mileage_to_invoice(
        project_id=project_id,
        user_id=entry["user_id"],
        mileage_entry=entry
    )

    return {"success": True, "status": "approved", "auto_added_to_invoice": auto_added, "invoice_id": invoice_id}


@router.post("/projects/{project_id}/mileage/{mileage_id}/reject")
async def reject_mileage(
    project_id: str,
    mileage_id: str,
    request: ApproveRejectRequest,
    authorization: str = Header(None)
):
    """Reject a mileage entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to reject expenses")

    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]
    if entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending entries can be rejected")

    client.table("backlot_mileage_entries").update({
        "status": "rejected",
        "rejected_by": user["id"],
        "rejected_at": datetime.utcnow().isoformat(),
        "rejection_reason": request.reason,
    }).eq("id", mileage_id).execute()

    return {"success": True, "status": "rejected"}


@router.post("/projects/{project_id}/mileage/{mileage_id}/deny")
async def deny_mileage(
    project_id: str,
    mileage_id: str,
    request: DenyExpenseRequest,
    authorization: str = Header(None)
):
    """Permanently deny a mileage entry. Cannot be resubmitted."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to deny expenses")

    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]
    if entry["status"] not in ["pending", "rejected"]:
        raise HTTPException(status_code=400, detail="Only pending or rejected entries can be denied")

    client.table("backlot_mileage_entries").update({
        "status": "denied",
        "denied_by": user["id"],
        "denied_at": datetime.utcnow().isoformat(),
        "denial_reason": request.reason,
    }).eq("id", mileage_id).execute()

    return {"success": True, "status": "denied"}


@router.post("/projects/{project_id}/mileage/{mileage_id}/resubmit")
async def resubmit_mileage(
    project_id: str,
    mileage_id: str,
    authorization: str = Header(None)
):
    """Resubmit a rejected or denied mileage entry for approval."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]

    # Only owner can resubmit
    if entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can resubmit this entry")

    if entry["status"] not in ["rejected", "denied"]:
        raise HTTPException(status_code=400, detail="Only rejected or denied entries can be resubmitted")

    # Clear rejection/denial fields and set back to pending
    update_data = {
        "status": "pending",
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
        "denied_by": None,
        "denied_at": None,
        "denial_reason": None,
        "updated_at": datetime.utcnow().isoformat(),
    }

    client.table("backlot_mileage_entries").update(update_data).eq("id", mileage_id).execute()

    return {"success": True, "status": "pending"}


@router.post("/projects/{project_id}/mileage/{mileage_id}/mark-reimbursed")
async def mark_mileage_reimbursed(
    project_id: str,
    mileage_id: str,
    request: MarkReimbursedRequest,
    authorization: str = Header(None)
):
    """Mark a mileage entry as reimbursed"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]
    if entry["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved entries can be marked as reimbursed")

    client.table("backlot_mileage_entries").update({
        "status": "reimbursed",
        "reimbursed_at": datetime.utcnow().isoformat(),
        "reimbursed_via": request.via,
    }).eq("id", mileage_id).execute()

    return {"success": True, "status": "reimbursed"}


# =============================================================================
# KIT RENTAL ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/kit-rentals", response_model=List[KitRental])
async def list_kit_rentals(
    project_id: str,
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List kit rentals for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    can_view_all = await can_approve_expenses(client, project_id, user["id"])

    query = client.table("backlot_kit_rentals").select(
        "*, profiles:user_id(full_name)"
    ).eq("project_id", project_id)

    if not can_view_all:
        query = query.eq("user_id", user["id"])
    elif user_id:
        query = query.eq("user_id", user_id)

    if status:
        query = query.eq("status", status)

    resp = query.order("start_date", desc=True).execute()

    result = []
    for entry in (resp.data or []):
        profile = entry.get("profiles") or {}
        total = calculate_kit_rental_total(
            entry["daily_rate"],
            entry.get("weekly_rate"),
            entry["start_date"],
            entry.get("end_date"),
            entry.get("rental_type", "daily")
        )
        days_used = None
        if entry.get("end_date"):
            try:
                start = datetime.strptime(entry["start_date"], "%Y-%m-%d").date()
                end = datetime.strptime(entry["end_date"], "%Y-%m-%d").date()
                days_used = (end - start).days + 1
            except:
                pass

        result.append(KitRental(
            **{k: v for k, v in entry.items() if k not in ("profiles", "total_amount", "days_used")},
            total_amount=total,
            days_used=days_used,
            user_name=profile.get("full_name"),
        ))

    return result


@router.post("/projects/{project_id}/kit-rentals", response_model=KitRental)
async def create_kit_rental(
    project_id: str,
    request: CreateKitRentalRequest,
    authorization: str = Header(None)
):
    """Create a new kit rental"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    total = calculate_kit_rental_total(
        request.daily_rate,
        request.weekly_rate,
        request.start_date,
        request.end_date,
        request.rental_type
    )

    entry_data = {
        "project_id": project_id,
        "user_id": user["id"],
        "kit_name": request.kit_name,
        "kit_description": request.kit_description,
        "daily_rate": request.daily_rate,
        "weekly_rate": request.weekly_rate,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "rental_type": request.rental_type,
        "total_amount": total,
        "notes": request.notes,
        "status": "pending",
        "budget_category_id": request.budget_category_id,
        "budget_line_item_id": request.budget_line_item_id,
        "scene_id": request.scene_id,
    }

    resp = client.table("backlot_kit_rentals").insert(entry_data).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create kit rental")

    return KitRental(**resp.data[0])


@router.put("/projects/{project_id}/kit-rentals/{rental_id}", response_model=KitRental)
async def update_kit_rental(
    project_id: str,
    rental_id: str,
    request: UpdateKitRentalRequest,
    authorization: str = Header(None)
):
    """Update a kit rental"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]

    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] not in ["pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot edit this rental")

    update_data = {}
    if request.kit_name is not None:
        update_data["kit_name"] = request.kit_name
    if request.kit_description is not None:
        update_data["kit_description"] = request.kit_description
    if request.daily_rate is not None:
        update_data["daily_rate"] = request.daily_rate
    if request.weekly_rate is not None:
        update_data["weekly_rate"] = request.weekly_rate
    if request.end_date is not None:
        update_data["end_date"] = request.end_date
    if request.rental_type is not None:
        update_data["rental_type"] = request.rental_type
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.budget_category_id is not None:
        update_data["budget_category_id"] = request.budget_category_id
    if request.budget_line_item_id is not None:
        update_data["budget_line_item_id"] = request.budget_line_item_id
    if request.scene_id is not None:
        update_data["scene_id"] = request.scene_id

    # Recalculate total
    daily_rate = update_data.get("daily_rate", entry["daily_rate"])
    weekly_rate = update_data.get("weekly_rate", entry.get("weekly_rate"))
    end_date = update_data.get("end_date", entry.get("end_date"))
    rental_type = update_data.get("rental_type", entry.get("rental_type", "daily"))
    total = calculate_kit_rental_total(daily_rate, weekly_rate, entry["start_date"], end_date, rental_type)
    if total is not None:
        update_data["total_amount"] = total

    if not update_data:
        return KitRental(**entry)

    resp = client.table("backlot_kit_rentals").update(update_data).eq("id", rental_id).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to update kit rental")

    return KitRental(**resp.data[0])


@router.delete("/projects/{project_id}/kit-rentals/{rental_id}")
async def delete_kit_rental(
    project_id: str,
    rental_id: str,
    authorization: str = Header(None)
):
    """Delete a kit rental"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]

    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] not in ["pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot delete this rental")

    client.table("backlot_kit_rentals").delete().eq("id", rental_id).execute()
    return {"success": True}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/approve")
async def approve_kit_rental(
    project_id: str,
    rental_id: str,
    request: ApprovalNotesRequest = None,
    authorization: str = Header(None)
):
    """Approve a kit rental (moves to active status) with optional notes"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]
    if entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending rentals can be approved")

    update_data = {
        "status": "active",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow().isoformat(),
    }
    if request and request.notes:
        update_data["approval_notes"] = request.notes

    client.table("backlot_kit_rentals").update(update_data).eq("id", rental_id).execute()

    # Auto-add to user's draft invoice(s) - may split across multiple invoices by date
    from app.services.invoice_auto_sync import auto_add_kit_rental_to_invoice
    results = auto_add_kit_rental_to_invoice(
        project_id=project_id,
        user_id=entry["user_id"],
        kit_rental=entry
    )
    # Extract results - may have multiple if split across invoices
    auto_added = any(r[0] for r in results)
    invoice_ids = [r[1] for r in results if r[1]]

    return {"success": True, "status": "active", "auto_added_to_invoice": auto_added, "invoice_ids": invoice_ids}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/reject")
async def reject_kit_rental(
    project_id: str,
    rental_id: str,
    request: ApproveRejectRequest,
    authorization: str = Header(None)
):
    """Reject a kit rental"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]
    if entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending rentals can be rejected")

    client.table("backlot_kit_rentals").update({
        "status": "rejected",
        "rejected_by": user["id"],
        "rejected_at": datetime.utcnow().isoformat(),
        "rejection_reason": request.reason,
    }).eq("id", rental_id).execute()

    return {"success": True, "status": "rejected"}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/deny")
async def deny_kit_rental(
    project_id: str,
    rental_id: str,
    request: DenyExpenseRequest,
    authorization: str = Header(None)
):
    """Permanently deny a kit rental. Cannot be resubmitted."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to deny expenses")

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]
    if entry["status"] not in ["pending", "rejected"]:
        raise HTTPException(status_code=400, detail="Only pending or rejected rentals can be denied")

    client.table("backlot_kit_rentals").update({
        "status": "denied",
        "denied_by": user["id"],
        "denied_at": datetime.utcnow().isoformat(),
        "denial_reason": request.reason,
    }).eq("id", rental_id).execute()

    return {"success": True, "status": "denied"}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/resubmit")
async def resubmit_kit_rental(
    project_id: str,
    rental_id: str,
    authorization: str = Header(None)
):
    """Resubmit a rejected or denied kit rental for approval."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]

    # Only owner can resubmit
    if entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can resubmit this rental")

    if entry["status"] not in ["rejected", "denied"]:
        raise HTTPException(status_code=400, detail="Only rejected or denied rentals can be resubmitted")

    # Clear rejection/denial fields and set back to pending
    update_data = {
        "status": "pending",
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
        "denied_by": None,
        "denied_at": None,
        "denial_reason": None,
        "updated_at": datetime.utcnow().isoformat(),
    }

    client.table("backlot_kit_rentals").update(update_data).eq("id", rental_id).execute()

    return {"success": True, "status": "pending"}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/complete")
async def complete_kit_rental(
    project_id: str,
    rental_id: str,
    authorization: str = Header(None)
):
    """Mark a kit rental as completed"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]

    # Owner or manager can complete
    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active rentals can be completed")

    # Set end date to today if not set
    end_date = entry.get("end_date") or datetime.utcnow().date().isoformat()
    total = calculate_kit_rental_total(
        entry["daily_rate"],
        entry.get("weekly_rate"),
        entry["start_date"],
        end_date,
        entry.get("rental_type", "daily")
    )

    client.table("backlot_kit_rentals").update({
        "status": "completed",
        "completed_at": datetime.utcnow().isoformat(),
        "end_date": end_date,
        "total_amount": total,
    }).eq("id", rental_id).execute()

    return {"success": True, "status": "completed"}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/mark-reimbursed")
async def mark_kit_rental_reimbursed(
    project_id: str,
    rental_id: str,
    request: MarkReimbursedRequest,
    authorization: str = Header(None)
):
    """Mark a kit rental as reimbursed"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]
    if entry["status"] not in ["approved", "completed"]:
        raise HTTPException(status_code=400, detail="Only approved or completed rentals can be reimbursed")

    client.table("backlot_kit_rentals").update({
        "status": "reimbursed",
        "reimbursed_at": datetime.utcnow().isoformat(),
        "reimbursed_via": request.via,
    }).eq("id", rental_id).execute()

    return {"success": True, "status": "reimbursed"}


# =============================================================================
# PER DIEM ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/per-diem", response_model=List[PerDiemEntry])
async def list_per_diem(
    project_id: str,
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """List per diem entries for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    can_view_all = await can_approve_expenses(client, project_id, user["id"])

    query = client.table("backlot_per_diem").select(
        "*, profiles:user_id(full_name)"
    ).eq("project_id", project_id)

    if not can_view_all:
        query = query.eq("user_id", user["id"])
    elif user_id:
        query = query.eq("user_id", user_id)

    if status:
        query = query.eq("status", status)
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    resp = query.order("date", desc=True).execute()

    result = []
    for entry in (resp.data or []):
        profile = entry.get("profiles") or {}
        result.append(PerDiemEntry(
            **{k: v for k, v in entry.items() if k != "profiles"},
            user_name=profile.get("full_name"),
        ))

    return result


@router.post("/projects/{project_id}/per-diem", response_model=PerDiemEntry)
async def create_per_diem(
    project_id: str,
    request: CreatePerDiemRequest,
    authorization: str = Header(None)
):
    """Create a per diem entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    if request.meal_type not in ["breakfast", "lunch", "dinner", "full_day"]:
        raise HTTPException(status_code=400, detail="Invalid meal type")

    # Check for existing entry
    existing = client.table("backlot_per_diem").select("id").eq("project_id", project_id).eq("user_id", user["id"]).eq("date", request.date).eq("meal_type", request.meal_type).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Per diem already claimed for this date and meal type")

    entry_data = {
        "project_id": project_id,
        "user_id": user["id"],
        "date": request.date,
        "meal_type": request.meal_type,
        "amount": request.amount,
        "location": request.location,
        "notes": request.notes,
        "status": "pending",
        "budget_category_id": request.budget_category_id,
        "budget_line_item_id": request.budget_line_item_id,
        "scene_id": request.scene_id,
    }

    resp = client.table("backlot_per_diem").insert(entry_data).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create per diem entry")

    return PerDiemEntry(**resp.data[0])


@router.post("/projects/{project_id}/per-diem/bulk")
async def create_bulk_per_diem(
    project_id: str,
    request: BulkPerDiemRequest,
    authorization: str = Header(None)
):
    """Create per diem entries for a date range"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    if request.meal_type not in ["breakfast", "lunch", "dinner", "full_day"]:
        raise HTTPException(status_code=400, detail="Invalid meal type")

    # Parse dates
    try:
        start = datetime.strptime(request.start_date, "%Y-%m-%d").date()
        end = datetime.strptime(request.end_date, "%Y-%m-%d").date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")

    if end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Get existing entries
    existing = client.table("backlot_per_diem").select("date").eq("project_id", project_id).eq("user_id", user["id"]).eq("meal_type", request.meal_type).gte("date", request.start_date).lte("date", request.end_date).execute()
    existing_dates = {e["date"] for e in (existing.data or [])}

    # Create entries for missing dates
    created_count = 0
    skipped_count = 0
    current = start

    while current <= end:
        date_str = current.isoformat()
        if date_str in existing_dates:
            skipped_count += 1
        else:
            entry_data = {
                "project_id": project_id,
                "user_id": user["id"],
                "date": date_str,
                "meal_type": request.meal_type,
                "amount": request.amount,
                "location": request.location,
                "notes": request.notes,
                "status": "pending",
                "budget_category_id": request.budget_category_id,
                "budget_line_item_id": request.budget_line_item_id,
                "scene_id": request.scene_id,
            }
            client.table("backlot_per_diem").insert(entry_data).execute()
            created_count += 1

        current += timedelta(days=1)

    return {"created_count": created_count, "skipped_count": skipped_count}


@router.delete("/projects/{project_id}/per-diem/{entry_id}")
async def delete_per_diem(
    project_id: str,
    entry_id: str,
    authorization: str = Header(None)
):
    """Delete a per diem entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]

    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] not in ["pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot delete this entry")

    client.table("backlot_per_diem").delete().eq("id", entry_id).execute()
    return {"success": True}


@router.post("/projects/{project_id}/per-diem/{entry_id}/approve")
async def approve_per_diem(
    project_id: str,
    entry_id: str,
    request: ApprovalNotesRequest = None,
    authorization: str = Header(None)
):
    """Approve a per diem entry with optional notes"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]
    if entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending entries can be approved")

    update_data = {
        "status": "approved",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow().isoformat(),
    }
    if request and request.notes:
        update_data["approval_notes"] = request.notes

    client.table("backlot_per_diem").update(update_data).eq("id", entry_id).execute()

    # Auto-add to user's draft invoice
    from app.services.invoice_auto_sync import auto_add_per_diem_to_invoice
    auto_added, invoice_id = auto_add_per_diem_to_invoice(
        project_id=project_id,
        user_id=entry["user_id"],
        per_diem=entry
    )

    return {"success": True, "status": "approved", "auto_added_to_invoice": auto_added, "invoice_id": invoice_id}


@router.post("/projects/{project_id}/per-diem/{entry_id}/reject")
async def reject_per_diem(
    project_id: str,
    entry_id: str,
    request: ApproveRejectRequest,
    authorization: str = Header(None)
):
    """Reject a per diem entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]
    if entry["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending entries can be rejected")

    client.table("backlot_per_diem").update({
        "status": "rejected",
        "rejected_by": user["id"],
        "rejected_at": datetime.utcnow().isoformat(),
        "rejection_reason": request.reason,
    }).eq("id", entry_id).execute()

    return {"success": True, "status": "rejected"}


@router.post("/projects/{project_id}/per-diem/{entry_id}/deny")
async def deny_per_diem(
    project_id: str,
    entry_id: str,
    request: DenyExpenseRequest,
    authorization: str = Header(None)
):
    """Permanently deny a per diem entry. Cannot be resubmitted."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to deny expenses")

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]
    if entry["status"] not in ["pending", "rejected"]:
        raise HTTPException(status_code=400, detail="Only pending or rejected entries can be denied")

    client.table("backlot_per_diem").update({
        "status": "denied",
        "denied_by": user["id"],
        "denied_at": datetime.utcnow().isoformat(),
        "denial_reason": request.reason,
    }).eq("id", entry_id).execute()

    return {"success": True, "status": "denied"}


@router.post("/projects/{project_id}/per-diem/{entry_id}/resubmit")
async def resubmit_per_diem(
    project_id: str,
    entry_id: str,
    authorization: str = Header(None)
):
    """Resubmit a rejected or denied per diem entry for approval."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]

    # Only owner can resubmit
    if entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can resubmit this entry")

    if entry["status"] not in ["rejected", "denied"]:
        raise HTTPException(status_code=400, detail="Only rejected or denied entries can be resubmitted")

    # Clear rejection/denial fields and set back to pending
    update_data = {
        "status": "pending",
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
        "denied_by": None,
        "denied_at": None,
        "denial_reason": None,
        "updated_at": datetime.utcnow().isoformat(),
    }

    client.table("backlot_per_diem").update(update_data).eq("id", entry_id).execute()

    return {"success": True, "status": "pending"}


@router.post("/projects/{project_id}/per-diem/{entry_id}/mark-reimbursed")
async def mark_per_diem_reimbursed(
    project_id: str,
    entry_id: str,
    request: MarkReimbursedRequest,
    authorization: str = Header(None)
):
    """Mark a per diem entry as reimbursed"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]
    if entry["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved entries can be reimbursed")

    client.table("backlot_per_diem").update({
        "status": "reimbursed",
        "reimbursed_at": datetime.utcnow().isoformat(),
        "reimbursed_via": request.via,
    }).eq("id", entry_id).execute()

    return {"success": True, "status": "reimbursed"}


# =============================================================================
# EXPENSE SETTINGS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/expense-settings", response_model=ExpenseSettings)
async def get_expense_settings_endpoint(
    project_id: str,
    authorization: str = Header(None)
):
    """Get expense settings for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    return get_expense_settings(client, project_id)


@router.put("/projects/{project_id}/expense-settings", response_model=ExpenseSettings)
async def update_expense_settings_endpoint(
    project_id: str,
    request: UpdateExpenseSettingsRequest,
    authorization: str = Header(None)
):
    """Update expense settings for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Only managers can update expense settings")

    # Check if settings exist
    existing = client.table("backlot_project_expense_settings").select("project_id").eq("project_id", project_id).execute()

    update_data = {}
    if request.mileage_rate is not None:
        update_data["mileage_rate"] = request.mileage_rate
    if request.per_diem_breakfast is not None:
        update_data["per_diem_breakfast"] = request.per_diem_breakfast
    if request.per_diem_lunch is not None:
        update_data["per_diem_lunch"] = request.per_diem_lunch
    if request.per_diem_dinner is not None:
        update_data["per_diem_dinner"] = request.per_diem_dinner
    if request.per_diem_full_day is not None:
        update_data["per_diem_full_day"] = request.per_diem_full_day
    if request.require_receipts_over is not None:
        update_data["require_receipts_over"] = request.require_receipts_over
    if request.auto_approve_under is not None:
        update_data["auto_approve_under"] = request.auto_approve_under
    if request.allowed_categories is not None:
        update_data["allowed_categories"] = request.allowed_categories

    if existing.data:
        client.table("backlot_project_expense_settings").update(update_data).eq("project_id", project_id).execute()
    else:
        update_data["project_id"] = project_id
        client.table("backlot_project_expense_settings").insert(update_data).execute()

    return get_expense_settings(client, project_id)


# =============================================================================
# EXPENSE SUMMARY ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/expenses/summary", response_model=ExpenseSummary)
async def get_expense_summary(
    project_id: str,
    user_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """Get expense summary for a project"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    is_manager = await can_approve_expenses(client, project_id, user["id"])
    target_user = user_id if (user_id and is_manager) else (None if is_manager else user["id"])

    def sum_amounts(table: str, status: str, amount_field: str = "amount") -> float:
        query = client.table(table).select(amount_field).eq("project_id", project_id).eq("status", status)
        if target_user:
            query = query.eq("user_id", target_user)
        resp = query.execute()
        return sum(float(e.get(amount_field) or 0) for e in (resp.data or []))

    def count_entries(table: str, status: str) -> int:
        query = client.table(table).select("id").eq("project_id", project_id).eq("status", status)
        if target_user:
            query = query.eq("user_id", target_user)
        resp = query.execute()
        return len(resp.data or [])

    # Mileage totals (need to calculate from miles and rate)
    def sum_mileage(status: str) -> float:
        query = client.table("backlot_mileage_entries").select("miles, rate_per_mile, is_round_trip").eq("project_id", project_id).eq("status", status)
        if target_user:
            query = query.eq("user_id", target_user)
        resp = query.execute()
        total = 0
        for e in (resp.data or []):
            total += calculate_mileage_total(e["miles"], e.get("rate_per_mile", 0.67), e.get("is_round_trip", False))
        return total

    # Pending
    pending_mileage = sum_mileage("pending")
    pending_kit_rentals = sum_amounts("backlot_kit_rentals", "pending", "total_amount")
    pending_per_diem = sum_amounts("backlot_per_diem", "pending")

    # Pending receipts
    query = client.table("backlot_receipts").select("amount").eq("project_id", project_id).eq("reimbursement_status", "pending")
    if target_user:
        query = query.eq("created_by_user_id", target_user)
    resp = query.execute()
    pending_receipts = sum(float(e.get("amount") or 0) for e in (resp.data or []))

    # Approved
    approved_mileage = sum_mileage("approved")
    approved_kit_rentals = sum_amounts("backlot_kit_rentals", "approved", "total_amount") + sum_amounts("backlot_kit_rentals", "completed", "total_amount")
    approved_per_diem = sum_amounts("backlot_per_diem", "approved")

    query = client.table("backlot_receipts").select("amount").eq("project_id", project_id).eq("reimbursement_status", "approved")
    if target_user:
        query = query.eq("created_by_user_id", target_user)
    resp = query.execute()
    approved_receipts = sum(float(e.get("amount") or 0) for e in (resp.data or []))

    # Reimbursed
    reimbursed_mileage = sum_mileage("reimbursed")
    reimbursed_kit_rentals = sum_amounts("backlot_kit_rentals", "reimbursed", "total_amount")
    reimbursed_per_diem = sum_amounts("backlot_per_diem", "reimbursed")

    query = client.table("backlot_receipts").select("amount").eq("project_id", project_id).eq("reimbursement_status", "reimbursed")
    if target_user:
        query = query.eq("created_by_user_id", target_user)
    resp = query.execute()
    reimbursed_receipts = sum(float(e.get("amount") or 0) for e in (resp.data or []))

    # Counts
    pending_count = (
        count_entries("backlot_mileage_entries", "pending") +
        count_entries("backlot_kit_rentals", "pending") +
        count_entries("backlot_per_diem", "pending")
    )
    approved_count = (
        count_entries("backlot_mileage_entries", "approved") +
        count_entries("backlot_kit_rentals", "approved") +
        count_entries("backlot_kit_rentals", "completed") +
        count_entries("backlot_per_diem", "approved")
    )

    total_pending = pending_mileage + pending_kit_rentals + pending_per_diem + pending_receipts
    total_approved = approved_mileage + approved_kit_rentals + approved_per_diem + approved_receipts
    reimbursed_total = reimbursed_mileage + reimbursed_kit_rentals + reimbursed_per_diem + reimbursed_receipts

    # Company card vs personal card breakdown (receipts only)
    company_card_query = client.table("backlot_receipts").select("id, amount").eq("project_id", project_id).eq("expense_type", "company_card")
    if target_user:
        company_card_query = company_card_query.eq("created_by_user_id", target_user)
    company_card_resp = company_card_query.execute()
    company_card_receipts = company_card_resp.data or []
    company_card_total = sum(float(r.get("amount") or 0) for r in company_card_receipts)
    company_card_count = len(company_card_receipts)

    personal_card_query = client.table("backlot_receipts").select("id, amount").eq("project_id", project_id).neq("expense_type", "company_card")
    if target_user:
        personal_card_query = personal_card_query.eq("created_by_user_id", target_user)
    personal_card_resp = personal_card_query.execute()
    personal_card_receipts = personal_card_resp.data or []
    personal_card_total = sum(float(r.get("amount") or 0) for r in personal_card_receipts)
    personal_card_count = len(personal_card_receipts)

    # Calculate grand totals by expense type
    grand_total_mileage = pending_mileage + approved_mileage + reimbursed_mileage
    grand_total_kit_rentals = pending_kit_rentals + approved_kit_rentals + reimbursed_kit_rentals
    grand_total_per_diem = pending_per_diem + approved_per_diem + reimbursed_per_diem
    grand_total_receipts = pending_receipts + approved_receipts + reimbursed_receipts

    return ExpenseSummary(
        pending_mileage=round(pending_mileage, 2),
        pending_kit_rentals=round(pending_kit_rentals, 2),
        pending_per_diem=round(pending_per_diem, 2),
        pending_receipts=round(pending_receipts, 2),
        total_pending=round(total_pending, 2),
        approved_mileage=round(approved_mileage, 2),
        approved_kit_rentals=round(approved_kit_rentals, 2),
        approved_per_diem=round(approved_per_diem, 2),
        approved_receipts=round(approved_receipts, 2),
        total_approved=round(total_approved, 2),
        reimbursed_total=round(reimbursed_total, 2),
        pending_count=pending_count,
        approved_count=approved_count,
        company_card_total=round(company_card_total, 2),
        company_card_count=company_card_count,
        personal_card_total=round(personal_card_total, 2),
        personal_card_count=personal_card_count,
        total_mileage=round(grand_total_mileage, 2),
        total_kit_rentals=round(grand_total_kit_rentals, 2),
        total_per_diem=round(grand_total_per_diem, 2),
        total_receipts=round(grand_total_receipts, 2),
    )


# ============================================================================
# RECEIPT REIMBURSEMENT ENDPOINTS
# ============================================================================

class ReceiptReimbursementRequest(BaseModel):
    reimbursement_to: Optional[str] = None
    notes: Optional[str] = None


@router.post("/projects/{project_id}/receipts/{receipt_id}/submit-reimbursement")
async def submit_receipt_for_reimbursement(
    project_id: str,
    receipt_id: str,
    request: ReceiptReimbursementRequest = ReceiptReimbursementRequest(),
    authorization: str = Header(None),
):
    """Submit a receipt for reimbursement"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    # Check if already submitted or processed
    current_status = receipt.get("reimbursement_status", "not_applicable")
    if current_status in ["pending", "approved", "reimbursed"]:
        raise HTTPException(status_code=400, detail=f"Receipt is already {current_status} for reimbursement")

    # Update to pending reimbursement
    update_data = {
        "reimbursement_status": "pending",
        "updated_at": datetime.utcnow().isoformat(),
    }
    if request.reimbursement_to:
        update_data["reimbursement_to"] = request.reimbursement_to
    if request.notes:
        update_data["notes"] = request.notes

    client.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

    return {"success": True, "status": "pending"}


@router.post("/projects/{project_id}/receipts/{receipt_id}/approve-reimbursement")
async def approve_receipt_reimbursement(
    project_id: str,
    receipt_id: str,
    request: ApprovalNotesRequest = None,
    authorization: str = Header(None),
):
    """Approve a receipt for reimbursement with optional notes"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if user can approve
    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to approve reimbursements")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    if receipt.get("reimbursement_status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending receipts can be approved")

    # Update status
    update_data = {
        "reimbursement_status": "approved",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    if request and request.notes:
        update_data["approval_notes"] = request.notes

    client.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

    # Auto-add to user's draft invoice (receipts use created_by_user_id)
    from app.services.invoice_auto_sync import auto_add_receipt_to_invoice
    auto_added, invoice_id = auto_add_receipt_to_invoice(
        project_id=project_id,
        user_id=receipt["created_by_user_id"],
        receipt=receipt
    )

    return {"success": True, "status": "approved", "auto_added_to_invoice": auto_added, "invoice_id": invoice_id}


@router.post("/projects/{project_id}/receipts/{receipt_id}/reject-reimbursement")
async def reject_receipt_reimbursement(
    project_id: str,
    receipt_id: str,
    request: ApproveRejectRequest,
    authorization: str = Header(None),
):
    """Reject a receipt reimbursement request"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if user can approve/reject
    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to reject reimbursements")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    if receipt.get("reimbursement_status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending receipts can be rejected")

    # Update status - reset to not_applicable so they can resubmit
    update_data = {
        "reimbursement_status": "not_applicable",
        "updated_at": datetime.utcnow().isoformat(),
    }
    if request.reason:
        update_data["notes"] = f"Reimbursement rejected: {request.reason}"

    client.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

    return {"success": True, "status": "rejected"}


@router.post("/projects/{project_id}/receipts/{receipt_id}/deny-reimbursement")
async def deny_receipt_reimbursement(
    project_id: str,
    receipt_id: str,
    request: DenyExpenseRequest,
    authorization: str = Header(None),
):
    """Permanently deny a receipt reimbursement. Cannot be resubmitted."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if user can deny
    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to deny reimbursements")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    # Can deny pending or not_applicable (after rejection)
    if receipt.get("reimbursement_status") not in ["pending", "not_applicable"]:
        raise HTTPException(status_code=400, detail="Only pending receipts can be denied")

    # Update status to denied
    client.table("backlot_receipts").update({
        "reimbursement_status": "denied",
        "denied_by": user["id"],
        "denied_at": datetime.utcnow().isoformat(),
        "denial_reason": request.reason,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", receipt_id).execute()

    return {"success": True, "status": "denied"}


@router.post("/projects/{project_id}/receipts/{receipt_id}/resubmit-reimbursement")
async def resubmit_receipt_reimbursement(
    project_id: str,
    receipt_id: str,
    authorization: str = Header(None),
):
    """Resubmit a rejected or denied receipt for reimbursement."""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    # Only owner can resubmit (receipts use created_by_user_id)
    if receipt.get("created_by_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can resubmit this receipt")

    # Can resubmit from not_applicable (after rejection) or denied
    if receipt.get("reimbursement_status") not in ["not_applicable", "denied"]:
        raise HTTPException(status_code=400, detail="Only rejected or denied receipts can be resubmitted")

    # Clear denial fields and set back to pending
    update_data = {
        "reimbursement_status": "pending",
        "denied_by": None,
        "denied_at": None,
        "denial_reason": None,
        "notes": None,  # Clear rejection notes
        "updated_at": datetime.utcnow().isoformat(),
    }

    client.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

    return {"success": True, "status": "pending"}


@router.post("/projects/{project_id}/receipts/{receipt_id}/mark-reimbursed")
async def mark_receipt_reimbursed(
    project_id: str,
    receipt_id: str,
    authorization: str = Header(None),
):
    """Mark an approved receipt as reimbursed (paid)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if user can approve
    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to mark receipts as reimbursed")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    if receipt.get("reimbursement_status") != "approved":
        raise HTTPException(status_code=400, detail="Only approved receipts can be marked as reimbursed")

    # Update status
    client.table("backlot_receipts").update({
        "reimbursement_status": "reimbursed",
        "reimbursed_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", receipt_id).execute()

    return {"success": True, "status": "reimbursed"}


# =============================================================================
# COMPANY CARD EXPENSES
# =============================================================================

class CompanyCardExpenseRequest(BaseModel):
    budget_category_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    expense_category: Optional[str] = None


@router.post("/projects/{project_id}/receipts/{receipt_id}/submit-company-card")
async def submit_company_card_expense(
    project_id: str,
    receipt_id: str,
    request: CompanyCardExpenseRequest = CompanyCardExpenseRequest(),
    authorization: str = Header(None),
):
    """
    Submit a receipt as a company card expense.
    Auto-recorded (no approval needed) and links to budget.
    Company card expenses don't flow to invoices.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get the receipt
    resp = client.table("backlot_receipts").select("*").eq("id", receipt_id).eq("project_id", project_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = resp.data

    # Check if already processed as company card
    if receipt.get("expense_type") == "company_card":
        raise HTTPException(status_code=400, detail="Receipt is already submitted as company card expense")

    # Update receipt to company card type
    update_data = {
        "expense_type": "company_card",
        "updated_at": datetime.utcnow().isoformat(),
    }
    if request.budget_category_id:
        update_data["budget_category_id"] = request.budget_category_id
    if request.budget_line_item_id:
        update_data["budget_line_item_id"] = request.budget_line_item_id
    if request.expense_category:
        update_data["expense_category"] = request.expense_category

    client.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

    # Create budget actual entry
    budget_actual_data = {
        "project_id": project_id,
        "budget_category_id": request.budget_category_id,
        "budget_line_item_id": request.budget_line_item_id,
        "source_type": "receipt",
        "source_id": receipt_id,
        "description": receipt.get("description") or receipt.get("vendor_name") or "Company Card Expense",
        "amount": float(receipt.get("amount") or 0),
        "expense_date": receipt.get("purchase_date"),
        "vendor_name": receipt.get("vendor_name"),
        "expense_category": request.expense_category or receipt.get("expense_category"),
        "created_by_user_id": user["id"],
    }

    client.table("backlot_budget_actuals").insert(budget_actual_data).execute()

    # If linked to a budget line item, update its actual_total
    if request.budget_line_item_id:
        # Get current actual_total
        line_resp = client.table("backlot_budget_line_items").select("actual_total").eq("id", request.budget_line_item_id).single().execute()
        if line_resp.data:
            current_actual = float(line_resp.data.get("actual_total") or 0)
            new_actual = current_actual + float(receipt.get("amount") or 0)
            client.table("backlot_budget_line_items").update({
                "actual_total": new_actual,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request.budget_line_item_id).execute()

    return {"success": True, "expense_type": "company_card"}


@router.get("/projects/{project_id}/budget-actuals")
async def get_budget_actuals(
    project_id: str,
    budget_category_id: Optional[str] = Query(None),
    budget_line_item_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    authorization: str = Header(None),
):
    """Get budget actuals for a project with optional filtering"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    query = client.table("backlot_budget_actuals").select(
        "*, created_by:profiles!created_by_user_id(full_name, avatar_url)"
    ).eq("project_id", project_id)

    if budget_category_id:
        query = query.eq("budget_category_id", budget_category_id)
    if budget_line_item_id:
        query = query.eq("budget_line_item_id", budget_line_item_id)
    if start_date:
        query = query.gte("expense_date", start_date)
    if end_date:
        query = query.lte("expense_date", end_date)

    result = query.order("expense_date", desc=True).execute()

    return {"actuals": result.data or []}


@router.get("/projects/{project_id}/budget-actuals/summary")
async def get_budget_actuals_summary(
    project_id: str,
    authorization: str = Header(None),
):
    """Get summary of budget actuals by category"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all actuals
    all_results = client.table("backlot_budget_actuals").select(
        "budget_category_id, expense_category, amount"
    ).eq("project_id", project_id).execute()

    # Aggregate in Python
    summary = {}
    total = 0
    for row in all_results.data or []:
        cat_id = row.get("budget_category_id") or "uncategorized"
        exp_cat = row.get("expense_category") or "Other"
        key = f"{cat_id}:{exp_cat}"
        if key not in summary:
            summary[key] = {
                "budget_category_id": row.get("budget_category_id"),
                "expense_category": exp_cat,
                "count": 0,
                "total_amount": 0
            }
        summary[key]["count"] += 1
        summary[key]["total_amount"] += float(row.get("amount") or 0)
        total += float(row.get("amount") or 0)

    return {
        "categories": list(summary.values()),
        "total": total
    }
