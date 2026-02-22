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
    # Gear House linking
    gear_source_type: Optional[str] = None  # 'asset', 'kit', 'lite', or None for independent
    gear_organization_id: Optional[str] = None
    gear_asset_id: Optional[str] = None
    gear_kit_instance_id: Optional[str] = None
    # Computed from gear joins
    gear_asset_name: Optional[str] = None
    gear_asset_internal_id: Optional[str] = None
    gear_kit_name: Optional[str] = None
    gear_organization_name: Optional[str] = None
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
    # Gear House linking (optional)
    gear_source_type: Optional[str] = None  # 'asset', 'kit', 'lite', or None for independent
    gear_organization_id: Optional[str] = None
    gear_asset_id: Optional[str] = None
    gear_kit_instance_id: Optional[str] = None


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
    # Gear House linking (can be updated)
    gear_source_type: Optional[str] = None
    gear_organization_id: Optional[str] = None
    gear_asset_id: Optional[str] = None
    gear_kit_instance_id: Optional[str] = None


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


class UpdatePerDiemRequest(BaseModel):
    meal_type: Optional[str] = None
    amount: Optional[float] = None
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
    require_mileage_locations: bool = False
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
    require_mileage_locations: Optional[bool] = None
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


class BulkApprovePerDiemRequest(BaseModel):
    entry_ids: List[str]  # List of per diem entry IDs to approve
    notes: Optional[str] = None  # Optional notes to apply to all


class BulkRejectPerDiemRequest(BaseModel):
    entry_ids: List[str]  # List of per diem entry IDs to reject
    reason: Optional[str] = None  # Rejection reason to apply to all


class BulkSubmitReceiptsRequest(BaseModel):
    receipt_ids: List[str]  # List of receipt IDs to submit for approval


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
            require_mileage_locations=data.get("require_mileage_locations", False),
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
    from app.services.feature_gates import enforce_project_feature
    enforce_project_feature(project_id, "EXPENSES")

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
        "status": "draft",
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


# Static path routes must be defined BEFORE dynamic {mileage_id} routes
class PlaceSuggestion(BaseModel):
    place_id: str
    label: str
    lat: float
    lon: float
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None


@router.get("/projects/{project_id}/mileage/search-places", response_model=List[PlaceSuggestion])
async def search_places_for_mileage(
    project_id: str,
    q: str = Query(..., min_length=3, description="Search query for address"),
    authorization: str = Header(None)
):
    """
    Search for places/addresses for mileage entry autocomplete.
    Uses AWS Location Service.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        from app.services.geocoding import search_places
        results = search_places(q, max_results=5)
        return results
    except Exception as e:
        print(f"[Mileage] Place search error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search places: {str(e)}")


class RouteCalculationResponse(BaseModel):
    start: Dict[str, Any]
    end: Dict[str, Any]
    distance_miles: Optional[float]
    is_round_trip: bool = False


@router.get("/projects/{project_id}/mileage/calculate-route", response_model=RouteCalculationResponse)
async def calculate_mileage_route(
    project_id: str,
    start_address: str = Query(..., description="Starting address"),
    end_address: str = Query(..., description="Ending address"),
    authorization: str = Header(None)
):
    """
    Calculate driving distance between two addresses for mileage entry.
    Uses AWS Location Service for geocoding and routing.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        from app.services.geocoding import calculate_mileage_between_addresses

        result = calculate_mileage_between_addresses(start_address, end_address)
        if not result:
            raise HTTPException(status_code=400, detail="Could not calculate route. Please verify both addresses are valid.")

        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Mileage] Route calculation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate route: {str(e)}")


@router.get("/projects/{project_id}/mileage/{mileage_id}", response_model=MileageEntry)
async def get_mileage_entry(
    project_id: str,
    mileage_id: str,
    authorization: str = Header(None)
):
    """Get a single mileage entry by ID"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

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

    if entry["status"] not in ["draft", "pending", "rejected", "denied"] and not is_manager:
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

    # If editing a rejected/denied entry, reset to draft so user can resubmit
    if entry["status"] in ["rejected", "denied"]:
        update_data["status"] = "draft"
        update_data["rejection_reason"] = None
        update_data["rejected_by"] = None
        update_data["rejected_at"] = None

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

    # Record to budget actuals
    from app.services.budget_actuals import record_mileage_actual
    record_mileage_actual(entry, user["id"])

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


@router.post("/projects/{project_id}/mileage/{mileage_id}/submit-for-approval")
async def submit_mileage_for_approval(
    project_id: str,
    mileage_id: str,
    authorization: str = Header(None)
):
    """Submit a draft mileage entry for approval (changes status from draft to pending)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", mileage_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Mileage entry not found")

    entry = entry_resp.data[0]

    # Only the owner can submit for approval
    if entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can submit for approval")

    if entry["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft entries can be submitted for approval")

    update_data = {
        "status": "pending",
    }

    try:
        resp = client.table("backlot_mileage_entries").update(update_data).eq("id", mileage_id).execute()
        if not resp.data:
            raise HTTPException(status_code=500, detail="Failed to submit for approval")
        entry = resp.data[0]
        total = calculate_mileage_total(entry["miles"], entry.get("rate_per_mile", 0.67), entry.get("is_round_trip", False))
        return MileageEntry(**entry, total_amount=total)
    except Exception as e:
        print(f"[Mileage] Submit for approval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit: {str(e)}")


class BulkSubmitMileageRequest(BaseModel):
    entry_ids: List[str]


@router.post("/projects/{project_id}/mileage/bulk-submit-for-approval")
async def bulk_submit_mileage_for_approval(
    project_id: str,
    request: BulkSubmitMileageRequest,
    authorization: str = Header(None)
):
    """Bulk submit draft mileage entries for approval"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    submitted_count = 0
    failed_count = 0
    failed_ids = []

    for entry_id in request.entry_ids:
        try:
            entry_resp = client.table("backlot_mileage_entries").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
            if not entry_resp.data:
                failed_count += 1
                failed_ids.append(entry_id)
                continue

            entry = entry_resp.data[0]

            # Only owner can submit, and only draft entries
            if entry["user_id"] != user["id"] or entry["status"] != "draft":
                failed_count += 1
                failed_ids.append(entry_id)
                continue

            update_data = {
                "status": "pending",
            }
            client.table("backlot_mileage_entries").update(update_data).eq("id", entry_id).execute()
            submitted_count += 1
        except Exception as e:
            failed_count += 1
            failed_ids.append(entry_id)

    return {
        "submitted_count": submitted_count,
        "failed_count": failed_count,
        "failed_ids": failed_ids
    }




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

    # Collect gear IDs for batch lookup
    gear_asset_ids = set()
    gear_kit_ids = set()
    gear_org_ids = set()
    for entry in (resp.data or []):
        if entry.get("gear_asset_id"):
            gear_asset_ids.add(entry["gear_asset_id"])
        if entry.get("gear_kit_instance_id"):
            gear_kit_ids.add(entry["gear_kit_instance_id"])
        if entry.get("gear_organization_id"):
            gear_org_ids.add(entry["gear_organization_id"])

    # Fetch gear assets info
    gear_assets_map = {}
    if gear_asset_ids:
        try:
            assets_resp = client.table("gear_assets").select("id, name, internal_id").in_("id", list(gear_asset_ids)).execute()
            for a in (assets_resp.data or []):
                gear_assets_map[a["id"]] = a
        except Exception as e:
            print(f"Error fetching gear assets: {e}")

    # Fetch gear kit instances info
    gear_kits_map = {}
    if gear_kit_ids:
        try:
            kits_resp = client.table("gear_kit_instances").select("id, name, internal_id").in_("id", list(gear_kit_ids)).execute()
            for k in (kits_resp.data or []):
                gear_kits_map[k["id"]] = k
        except Exception as e:
            print(f"Error fetching gear kits: {e}")

    # Fetch organizations info
    gear_orgs_map = {}
    if gear_org_ids:
        try:
            orgs_resp = client.table("organizations").select("id, name").in_("id", list(gear_org_ids)).execute()
            for o in (orgs_resp.data or []):
                gear_orgs_map[o["id"]] = o
        except Exception as e:
            print(f"Error fetching gear orgs: {e}")

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

        # Get gear info
        gear_asset = gear_assets_map.get(entry.get("gear_asset_id")) or {}
        gear_kit = gear_kits_map.get(entry.get("gear_kit_instance_id")) or {}
        gear_org = gear_orgs_map.get(entry.get("gear_organization_id")) or {}

        result.append(KitRental(
            **{k: v for k, v in entry.items() if k not in ("profiles", "total_amount", "days_used")},
            total_amount=total,
            days_used=days_used,
            user_name=profile.get("full_name"),
            gear_asset_name=gear_asset.get("name"),
            gear_asset_internal_id=gear_asset.get("internal_id"),
            gear_kit_name=gear_kit.get("name"),
            gear_organization_name=gear_org.get("name"),
        ))

    return result


# Gear Options Response Models
class GearAssetOption(BaseModel):
    id: str
    name: str
    internal_id: Optional[str] = None
    category_name: Optional[str] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    description: Optional[str] = None
    is_available_for_dates: bool = True


class GearKitOption(BaseModel):
    id: str
    name: str
    internal_id: Optional[str] = None
    is_available_for_dates: bool = True


class GearOrganizationOption(BaseModel):
    id: str
    name: str
    assets: List[GearAssetOption] = []
    kits: List[GearKitOption] = []


class GearOptionsResponse(BaseModel):
    organizations: List[GearOrganizationOption] = []
    personal_gear: List[GearAssetOption] = []


@router.get("/projects/{project_id}/kit-rentals/gear-options", response_model=GearOptionsResponse)
async def get_kit_rental_gear_options(
    project_id: str,
    start_date: Optional[str] = Query(None, description="Start date for availability check (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for availability check (YYYY-MM-DD)"),
    org_id: Optional[str] = Query(None, description="Filter to specific organization"),
    show_all: bool = Query(False, description="Show all assets regardless of availability"),
    authorization: str = Header(None)
):
    """
    Get available gear assets and kits for kit rental linking.
    Returns user's gear organizations with assets, filtered by date availability.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    result = GearOptionsResponse()

    # Get user's profile ID from cognito ID
    from app.api.users import get_profile_id_from_cognito_id
    import sys
    profile_id = get_profile_id_from_cognito_id(user["id"])
    print(f"[gear-options] User cognito id: {user.get('id')}, profile_id: {profile_id}", flush=True)

    # Get user's gear organization memberships using raw SQL
    from app.core.database import execute_query
    try:
        # Get memberships with org details in one query
        orgs_query = execute_query("""
            SELECT o.id, o.name, o.is_personal_gear_org
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            WHERE om.user_id = :user_id AND om.status = 'active'
        """, {"user_id": profile_id})

        print(f"[gear-options] Organizations query result: {orgs_query}", flush=True)

        org_ids = []
        orgs_map = {}
        personal_org_id = None

        for org in (orgs_query or []):
            org_dict = dict(org)
            org_ids.append(org_dict["id"])
            orgs_map[org_dict["id"]] = org_dict
            print(f"[gear-options] Found org: {org_dict.get('name')} ({org_dict.get('id')}), is_personal: {org_dict.get('is_personal_gear_org')}", flush=True)
            # Check if this is their personal org (for Gear House Lite)
            if org_dict.get("is_personal_gear_org"):
                personal_org_id = org_dict["id"]

        print(f"[gear-options] Total orgs found: {len(org_ids)}, personal_org_id: {personal_org_id}", flush=True)

        if org_id and org_id in org_ids:
            org_ids = [org_id]

        # Function to check if asset is available for date range
        def check_availability(asset_id: str, transactions_map: dict) -> bool:
            if not start_date or not end_date:
                return True
            if show_all:
                return True  # Will return all but mark availability

            # Check for overlapping transactions
            asset_txns = transactions_map.get(asset_id, [])
            try:
                req_start = datetime.strptime(start_date, "%Y-%m-%d").date()
                req_end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except:
                return True

            for txn in asset_txns:
                if txn.get("status") not in ("completed", "cancelled"):
                    try:
                        txn_start = datetime.strptime(txn.get("expected_return_date", txn.get("checkout_date", "")), "%Y-%m-%d").date() if txn.get("expected_return_date") or txn.get("checkout_date") else None
                        txn_end = datetime.strptime(txn.get("expected_return_date", ""), "%Y-%m-%d").date() if txn.get("expected_return_date") else None
                        # Check for overlap
                        if txn_start and txn_end:
                            if not (req_end < txn_start or req_start > txn_end):
                                return False
                    except:
                        pass
            return True

        # Fetch assets for each org
        for org_id in org_ids:
            org_info = orgs_map.get(org_id, {})
            org_option = GearOrganizationOption(
                id=org_id,
                name=org_info.get("name", "Unknown"),
                assets=[],
                kits=[]
            )

            # Get assets using raw SQL - include status for availability filtering
            assets_data = execute_query("""
                SELECT ga.id, ga.name, ga.internal_id, ga.daily_rate, ga.weekly_rate,
                       ga.description, ga.category_id, ga.status, gc.name as category_name
                FROM gear_assets ga
                LEFT JOIN gear_categories gc ON gc.id = ga.category_id
                WHERE ga.organization_id = :org_id AND ga.is_active = true
            """, {"org_id": org_id})

            # Get transactions for availability check using raw SQL
            transactions_map = {}
            if start_date and end_date:
                try:
                    txn_data = execute_query("""
                        SELECT gt.id, gt.status, gt.checkout_date, gt.expected_return_date,
                               gti.asset_id
                        FROM gear_transactions gt
                        JOIN gear_transaction_items gti ON gti.transaction_id = gt.id
                        WHERE gt.organization_id = :org_id
                          AND gt.status IN ('pending', 'in_progress', 'reserved')
                    """, {"org_id": org_id})

                    for row in (txn_data or []):
                        row_dict = dict(row)
                        asset_id = row_dict.get("asset_id")
                        if asset_id:
                            if asset_id not in transactions_map:
                                transactions_map[asset_id] = []
                            transactions_map[asset_id].append(row_dict)
                except Exception as e:
                    print(f"Error fetching transactions: {e}")

            for row in (assets_data or []):
                asset = dict(row)
                asset_status = asset.get("status", "available")

                # Check if asset is available based on status
                # Only 'available' and 'reserved' assets can be rented
                status_available = asset_status in ("available", "reserved", None)

                # Check if asset is available for the requested date range (no conflicting transactions)
                date_available = check_availability(str(asset["id"]), transactions_map)

                # Asset is fully available only if both status is good AND no date conflicts
                is_available = status_available and date_available

                # Skip unavailable assets unless show_all is True
                if not show_all and not is_available:
                    continue

                org_option.assets.append(GearAssetOption(
                    id=str(asset["id"]),
                    name=asset["name"],
                    internal_id=asset.get("internal_id"),
                    category_name=asset.get("category_name"),
                    daily_rate=float(asset["daily_rate"]) if asset.get("daily_rate") else None,
                    weekly_rate=float(asset["weekly_rate"]) if asset.get("weekly_rate") else None,
                    description=asset.get("description"),
                    is_available_for_dates=is_available
                ))

            # Get kit instances using raw SQL
            kits_data = execute_query("""
                SELECT id, name, internal_id
                FROM gear_kit_instances
                WHERE organization_id = :org_id AND is_active = true
            """, {"org_id": org_id})

            # Get all kit items with their asset statuses for availability check
            kit_items_data = execute_query("""
                SELECT gkii.kit_instance_id, ga.id as asset_id, ga.status
                FROM gear_kit_instance_items gkii
                JOIN gear_assets ga ON ga.id = gkii.asset_id
                WHERE gkii.kit_instance_id IN (
                    SELECT id FROM gear_kit_instances
                    WHERE organization_id = :org_id AND is_active = true
                )
            """, {"org_id": org_id})

            # Build map of kit_instance_id -> list of asset statuses
            kit_assets_map = {}
            for item in (kit_items_data or []):
                item_dict = dict(item)
                kit_id = str(item_dict["kit_instance_id"])
                if kit_id not in kit_assets_map:
                    kit_assets_map[kit_id] = []
                kit_assets_map[kit_id].append({
                    "asset_id": str(item_dict["asset_id"]),
                    "status": item_dict.get("status", "available")
                })

            for row in (kits_data or []):
                kit = dict(row)
                kit_id = str(kit["id"])

                # Check if ALL assets in the kit are available
                kit_assets = kit_assets_map.get(kit_id, [])
                kit_available = True

                for kit_asset in kit_assets:
                    asset_status = kit_asset.get("status", "available")
                    status_ok = asset_status in ("available", "reserved", None)
                    date_ok = check_availability(kit_asset["asset_id"], transactions_map)
                    if not status_ok or not date_ok:
                        kit_available = False
                        break

                # Skip unavailable kits unless show_all is True
                if not show_all and not kit_available:
                    continue

                org_option.kits.append(GearKitOption(
                    id=kit_id,
                    name=kit["name"],
                    internal_id=kit.get("internal_id"),
                    is_available_for_dates=kit_available
                ))

            # Don't add personal org to organizations list (it goes to personal_gear)
            if org_id != personal_org_id:
                result.organizations.append(org_option)
            else:
                # Personal gear goes to separate list
                result.personal_gear = org_option.assets

    except Exception as e:
        print(f"[gear-options] Error fetching gear options: {e}")
        import traceback
        traceback.print_exc()
        # Return empty response on error

    print(f"[gear-options] Returning {len(result.organizations)} organizations, {len(result.personal_gear)} personal gear items", flush=True)
    return result


@router.get("/projects/{project_id}/kit-rentals/{rental_id}", response_model=KitRental)
async def get_kit_rental(
    project_id: str,
    rental_id: str,
    authorization: str = Header(None)
):
    """Get a single kit rental by ID"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    return KitRental(**resp.data[0])


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
        "kit_description": request.kit_description or None,
        "daily_rate": request.daily_rate,
        "weekly_rate": request.weekly_rate,
        "start_date": request.start_date,
        "end_date": request.end_date if request.end_date else None,  # Convert empty string to None
        "rental_type": request.rental_type,
        "total_amount": total,
        "notes": request.notes or None,
        "status": "draft",
        "budget_category_id": request.budget_category_id or None,
        "budget_line_item_id": request.budget_line_item_id or None,
        "scene_id": request.scene_id or None,
        # Gear House linking
        "gear_source_type": request.gear_source_type or None,
        "gear_organization_id": request.gear_organization_id or None,
        "gear_asset_id": request.gear_asset_id or None,
        "gear_kit_instance_id": request.gear_kit_instance_id or None,
    }

    try:
        resp = client.table("backlot_kit_rentals").insert(entry_data).execute()
        if not resp.data:
            raise HTTPException(status_code=500, detail="Failed to create kit rental")
        return KitRental(**resp.data[0])
    except Exception as e:
        import traceback
        print(f"[KitRental] Create failed: {e}")
        print(f"[KitRental] Entry data: {entry_data}")
        print(f"[KitRental] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create kit rental: {str(e)}")


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

    if entry["status"] not in ["draft", "pending", "rejected", "denied"] and not is_manager:
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
    # Gear House linking
    if request.gear_source_type is not None:
        update_data["gear_source_type"] = request.gear_source_type
    if request.gear_organization_id is not None:
        update_data["gear_organization_id"] = request.gear_organization_id
    if request.gear_asset_id is not None:
        update_data["gear_asset_id"] = request.gear_asset_id
    if request.gear_kit_instance_id is not None:
        update_data["gear_kit_instance_id"] = request.gear_kit_instance_id

    # Recalculate total
    daily_rate = update_data.get("daily_rate", entry["daily_rate"])
    weekly_rate = update_data.get("weekly_rate", entry.get("weekly_rate"))
    end_date = update_data.get("end_date", entry.get("end_date"))
    rental_type = update_data.get("rental_type", entry.get("rental_type", "daily"))
    total = calculate_kit_rental_total(daily_rate, weekly_rate, entry["start_date"], end_date, rental_type)
    if total is not None:
        update_data["total_amount"] = total

    # If editing a rejected/denied rental, reset to draft so user can resubmit
    if entry["status"] in ["rejected", "denied"]:
        update_data["status"] = "draft"
        update_data["rejection_reason"] = None
        update_data["rejected_by"] = None
        update_data["rejected_at"] = None

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

    if entry["status"] not in ["draft", "pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot delete this rental")

    client.table("backlot_kit_rentals").delete().eq("id", rental_id).execute()
    return {"success": True}


@router.post("/projects/{project_id}/kit-rentals/{rental_id}/submit-for-approval")
async def submit_kit_rental_for_approval(
    project_id: str,
    rental_id: str,
    authorization: str = Header(None)
):
    """Submit a draft kit rental for approval (changes status from draft to pending)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    entry = entry_resp.data[0]

    # Only the owner can submit for approval
    if entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can submit for approval")

    if entry["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft rentals can be submitted for approval")

    update_data = {
        "status": "pending",
    }

    try:
        resp = client.table("backlot_kit_rentals").update(update_data).eq("id", rental_id).execute()
        if not resp.data:
            raise HTTPException(status_code=500, detail="Failed to submit for approval")
        return KitRental(**resp.data[0])
    except Exception as e:
        print(f"[KitRental] Submit for approval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit: {str(e)}")


class BulkSubmitKitRentalsRequest(BaseModel):
    rental_ids: List[str]


@router.post("/projects/{project_id}/kit-rentals/bulk-submit-for-approval")
async def bulk_submit_kit_rentals_for_approval(
    project_id: str,
    request: BulkSubmitKitRentalsRequest,
    authorization: str = Header(None)
):
    """Bulk submit draft kit rentals for approval"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    submitted_count = 0
    failed_count = 0
    failed_ids = []

    for rental_id in request.rental_ids:
        try:
            entry_resp = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).eq("project_id", project_id).execute()
            if not entry_resp.data:
                failed_count += 1
                failed_ids.append(rental_id)
                continue

            entry = entry_resp.data[0]

            # Only owner can submit, and only draft rentals
            if entry["user_id"] != user["id"] or entry["status"] != "draft":
                failed_count += 1
                failed_ids.append(rental_id)
                continue

            update_data = {
                "status": "pending",
            }
            client.table("backlot_kit_rentals").update(update_data).eq("id", rental_id).execute()
            submitted_count += 1
        except Exception as e:
            failed_count += 1
            failed_ids.append(rental_id)

    return {
        "submitted_count": submitted_count,
        "failed_count": failed_count,
        "failed_ids": failed_ids
    }


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

    # If linked to Gear House, create checkout FIRST (may fail if assets unavailable)
    gear_transaction_id = None
    if entry.get("gear_asset_id") or entry.get("gear_kit_instance_id"):
        from app.services.gear_checkout import create_checkout_from_kit_rental
        checkout_result = create_checkout_from_kit_rental(entry, user["id"])
        if checkout_result:
            gear_transaction_id = checkout_result.get("id")

    update_data = {
        "status": "active",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow().isoformat(),
    }
    if request and request.notes:
        update_data["approval_notes"] = request.notes
    if gear_transaction_id:
        update_data["gear_transaction_id"] = gear_transaction_id

    client.table("backlot_kit_rentals").update(update_data).eq("id", rental_id).execute()

    # Record to budget actuals
    from app.services.budget_actuals import record_kit_rental_actual
    record_kit_rental_actual(entry, user["id"])

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

    # Check for existing active entry (exclude rejected/denied - those can be replaced)
    existing = client.table("backlot_per_diem").select("id, status").eq("project_id", project_id).eq("user_id", user["id"]).eq("date", request.date).eq("meal_type", request.meal_type).execute()
    if existing.data:
        # Allow creating new entry if previous one was rejected or denied
        active_entries = [e for e in existing.data if e.get("status") not in ["rejected", "denied"]]
        if active_entries:
            raise HTTPException(status_code=400, detail="Per diem already claimed for this date and meal type")
        # Delete the rejected/denied entry so we can create a new one
        for entry in existing.data:
            if entry.get("status") in ["rejected", "denied"]:
                client.table("backlot_per_diem").delete().eq("id", entry["id"]).execute()

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

    # Get existing entries with status
    existing = client.table("backlot_per_diem").select("id, date, status").eq("project_id", project_id).eq("user_id", user["id"]).eq("meal_type", request.meal_type).gte("date", request.start_date).lte("date", request.end_date).execute()

    # Separate active entries from rejected/denied ones
    active_dates = set()
    rejected_entries_by_date = {}
    for e in (existing.data or []):
        if e.get("status") in ["rejected", "denied"]:
            rejected_entries_by_date[e["date"]] = e["id"]
        else:
            active_dates.add(e["date"])

    # Create entries for missing dates
    created_count = 0
    skipped_count = 0
    replaced_count = 0
    current = start

    while current <= end:
        date_str = current.isoformat()
        if date_str in active_dates:
            skipped_count += 1
        else:
            # Delete any rejected/denied entry for this date first
            if date_str in rejected_entries_by_date:
                client.table("backlot_per_diem").delete().eq("id", rejected_entries_by_date[date_str]).execute()
                replaced_count += 1

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

    return {"created_count": created_count, "skipped_count": skipped_count, "replaced_count": replaced_count}


@router.put("/projects/{project_id}/per-diem/{entry_id}", response_model=PerDiemEntry)
async def update_per_diem(
    project_id: str,
    entry_id: str,
    request: UpdatePerDiemRequest,
    authorization: str = Header(None)
):
    """Update a per diem entry"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]

    is_manager = await can_approve_expenses(client, project_id, user["id"])
    if entry["user_id"] != user["id"] and not is_manager:
        raise HTTPException(status_code=403, detail="Access denied")

    if entry["status"] not in ["draft", "pending", "rejected", "denied"] and not is_manager:
        raise HTTPException(status_code=400, detail="Cannot edit this entry")

    # Build update data
    update_data = {}
    if request.meal_type is not None:
        if request.meal_type not in ["breakfast", "lunch", "dinner", "full_day"]:
            raise HTTPException(status_code=400, detail="Invalid meal type")
        update_data["meal_type"] = request.meal_type
    if request.amount is not None:
        update_data["amount"] = request.amount
    if request.location is not None:
        update_data["location"] = request.location
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.budget_category_id is not None:
        update_data["budget_category_id"] = request.budget_category_id
    if request.budget_line_item_id is not None:
        update_data["budget_line_item_id"] = request.budget_line_item_id
    if request.scene_id is not None:
        update_data["scene_id"] = request.scene_id

    # If editing a rejected/denied entry, reset to draft so user can resubmit
    if entry["status"] in ["rejected", "denied"]:
        update_data["status"] = "draft"
        update_data["rejection_reason"] = None
        update_data["rejected_by"] = None
        update_data["rejected_at"] = None

    if not update_data:
        return PerDiemEntry(**entry)

    resp = client.table("backlot_per_diem").update(update_data).eq("id", entry_id).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to update per diem entry")

    return PerDiemEntry(**resp.data[0])


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

    # Record to budget actuals
    from app.services.budget_actuals import record_per_diem_actual
    record_per_diem_actual(entry, user["id"])

    # Auto-add to user's draft invoice (non-blocking - don't fail approval if this fails)
    auto_added = False
    invoice_id = None
    try:
        from app.services.invoice_auto_sync import auto_add_per_diem_to_invoice
        auto_added, invoice_id = auto_add_per_diem_to_invoice(
            project_id=project_id,
            user_id=entry["user_id"],
            per_diem=entry
        )
    except Exception as e:
        print(f"[PerDiem] Failed to auto-add to invoice: {e}")
        # Don't fail the approval - just log the error

    return {"success": True, "status": "approved", "auto_added_to_invoice": auto_added, "invoice_id": invoice_id}


@router.post("/projects/{project_id}/per-diem/bulk-approve")
async def bulk_approve_per_diem(
    project_id: str,
    request: BulkApprovePerDiemRequest,
    authorization: str = Header(None)
):
    """Bulk approve multiple per diem entries"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    if not request.entry_ids:
        raise HTTPException(status_code=400, detail="No entries specified")

    approved_count = 0
    failed_ids = []

    for entry_id in request.entry_ids:
        try:
            entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
            if not entry_resp.data:
                failed_ids.append(entry_id)
                continue

            entry = entry_resp.data[0]
            if entry["status"] != "pending":
                failed_ids.append(entry_id)
                continue

            update_data = {
                "status": "approved",
                "approved_by": user["id"],
                "approved_at": datetime.utcnow().isoformat(),
            }
            if request.notes:
                update_data["approval_notes"] = request.notes

            client.table("backlot_per_diem").update(update_data).eq("id", entry_id).execute()
            approved_count += 1

            # Auto-add to user's draft invoice (non-blocking)
            try:
                from app.services.invoice_auto_sync import auto_add_per_diem_to_invoice
                auto_add_per_diem_to_invoice(
                    project_id=project_id,
                    user_id=entry["user_id"],
                    per_diem=entry
                )
            except Exception as e:
                print(f"[PerDiem] Failed to auto-add to invoice: {e}")
        except Exception as e:
            print(f"[BulkApprove] Error approving entry {entry_id}: {e}")
            failed_ids.append(entry_id)

    return {
        "success": True,
        "approved_count": approved_count,
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids
    }


@router.post("/projects/{project_id}/per-diem/bulk-reject")
async def bulk_reject_per_diem(
    project_id: str,
    request: BulkRejectPerDiemRequest,
    authorization: str = Header(None)
):
    """Bulk reject multiple per diem entries"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_expenses(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    if not request.entry_ids:
        raise HTTPException(status_code=400, detail="No entries specified")

    rejected_count = 0
    failed_ids = []

    for entry_id in request.entry_ids:
        try:
            entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
            if not entry_resp.data:
                failed_ids.append(entry_id)
                continue

            entry = entry_resp.data[0]
            if entry["status"] != "pending":
                failed_ids.append(entry_id)
                continue

            client.table("backlot_per_diem").update({
                "status": "rejected",
                "rejected_by": user["id"],
                "rejected_at": datetime.utcnow().isoformat(),
                "rejection_reason": request.reason,
            }).eq("id", entry_id).execute()
            rejected_count += 1
        except Exception as e:
            print(f"[BulkReject] Error rejecting entry {entry_id}: {e}")
            failed_ids.append(entry_id)

    return {
        "success": True,
        "rejected_count": rejected_count,
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids
    }


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


@router.post("/projects/{project_id}/per-diem/{entry_id}/submit-for-approval")
async def submit_per_diem_for_approval(
    project_id: str,
    entry_id: str,
    authorization: str = Header(None)
):
    """Submit a draft per diem entry for approval (changes status from draft to pending)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=404, detail="Per diem entry not found")

    entry = entry_resp.data[0]

    # Only the owner can submit for approval
    if entry["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can submit for approval")

    if entry["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft entries can be submitted for approval")

    update_data = {
        "status": "pending",
        "updated_at": datetime.utcnow().isoformat(),
    }

    try:
        resp = client.table("backlot_per_diem").update(update_data).eq("id", entry_id).execute()
        if not resp.data:
            raise HTTPException(status_code=500, detail="Failed to submit for approval")
        return PerDiemEntry(**resp.data[0])
    except Exception as e:
        print(f"[PerDiem] Submit for approval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit: {str(e)}")


class BulkSubmitPerDiemRequest(BaseModel):
    entry_ids: List[str]


@router.post("/projects/{project_id}/per-diem/bulk-submit-for-approval")
async def bulk_submit_per_diem_for_approval(
    project_id: str,
    request: BulkSubmitPerDiemRequest,
    authorization: str = Header(None)
):
    """Bulk submit draft per diem entries for approval"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    submitted_count = 0
    failed_count = 0
    failed_ids = []

    for entry_id in request.entry_ids:
        try:
            entry_resp = client.table("backlot_per_diem").select("*").eq("id", entry_id).eq("project_id", project_id).execute()
            if not entry_resp.data:
                failed_ids.append(entry_id)
                failed_count += 1
                continue

            entry = entry_resp.data[0]

            # Only owner's draft entries can be submitted
            if entry["user_id"] != user["id"] or entry["status"] != "draft":
                failed_ids.append(entry_id)
                failed_count += 1
                continue

            client.table("backlot_per_diem").update({
                "status": "pending",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", entry_id).execute()
            submitted_count += 1

        except Exception as e:
            print(f"[PerDiem] Bulk submit failed for {entry_id}: {e}")
            failed_ids.append(entry_id)
            failed_count += 1

    return {
        "submitted_count": submitted_count,
        "failed_count": failed_count,
        "failed_ids": failed_ids
    }


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
    if request.require_mileage_locations is not None:
        update_data["require_mileage_locations"] = request.require_mileage_locations
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
    from app.services.feature_gates import enforce_project_feature
    enforce_project_feature(project_id, "EXPENSES")

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


@router.post("/projects/{project_id}/receipts/bulk-submit-reimbursement")
async def bulk_submit_receipts_for_reimbursement(
    project_id: str,
    request: BulkSubmitReceiptsRequest,
    authorization: str = Header(None),
):
    """Submit multiple receipts for reimbursement approval"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    success_count = 0
    failed_ids = []

    for receipt_id in request.receipt_ids:
        try:
            # Get the receipt
            resp = client.table("backlot_receipts").select("reimbursement_status").eq("id", receipt_id).eq("project_id", project_id).single().execute()
            if not resp.data:
                failed_ids.append(receipt_id)
                continue

            # Skip if already submitted or processed
            current_status = resp.data.get("reimbursement_status", "not_applicable")
            if current_status in ["pending", "approved", "reimbursed"]:
                failed_ids.append(receipt_id)
                continue

            # Update to pending
            client.table("backlot_receipts").update({
                "reimbursement_status": "pending",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", receipt_id).execute()

            success_count += 1
        except Exception:
            failed_ids.append(receipt_id)

    return {
        "success": True,
        "submitted_count": success_count,
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids
    }


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

    # Record to budget actuals
    from app.services.budget_actuals import record_receipt_actual
    record_receipt_actual(receipt, user["id"])

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

    # Update status to changes_requested so user knows to fix and resubmit
    update_data = {
        "reimbursement_status": "changes_requested",
        "rejection_reason": request.reason or None,
        "updated_at": datetime.utcnow().isoformat(),
    }

    client.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

    return {"success": True, "status": "changes_requested"}


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

    # Can resubmit from changes_requested, not_applicable (legacy), denied, or draft
    if receipt.get("reimbursement_status") not in ["changes_requested", "not_applicable", "denied", "draft"]:
        raise HTTPException(status_code=400, detail="Only receipts with requested changes, denied, or draft can be resubmitted")

    # Clear rejection/denial fields and set back to pending
    update_data = {
        "reimbursement_status": "pending",
        "rejection_reason": None,
        "denied_by": None,
        "denied_at": None,
        "denial_reason": None,
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
    include_source_details: bool = Query(False),
    authorization: str = Header(None),
):
    """Get budget actuals for a project with optional filtering and source details"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    query = client.table("backlot_budget_actuals").select(
        "*, created_by:profiles!created_by_user_id(full_name, avatar_url), category:backlot_budget_categories!budget_category_id(id, name), submitter:profiles!submitter_user_id(full_name, avatar_url)"
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
    actuals = result.data or []

    # If source details requested, fetch the source records
    if include_source_details and actuals:
        # Group actuals by source type
        source_ids_by_type = {}
        for actual in actuals:
            source_type = actual.get("source_type")
            source_id = actual.get("source_id")
            if source_type and source_id:
                if source_type not in source_ids_by_type:
                    source_ids_by_type[source_type] = []
                source_ids_by_type[source_type].append(source_id)

        # Fetch source details for each type
        source_details = {}

        # Mileage entries
        if "mileage" in source_ids_by_type:
            mileage_result = client.table("backlot_mileage_entries").select(
                "id, date, start_location, end_location, miles, rate_per_mile, is_round_trip, purpose, description, status, user:profiles!user_id(full_name)"
            ).in_("id", source_ids_by_type["mileage"]).execute()
            for row in mileage_result.data or []:
                # Map column names for frontend compatibility
                row["origin"] = row.get("start_location")
                row["destination"] = row.get("end_location")
                source_details[f"mileage:{row['id']}"] = row

        # Kit rentals
        if "kit_rental" in source_ids_by_type:
            kit_result = client.table("backlot_kit_rentals").select(
                "id, kit_name, kit_description, start_date, end_date, daily_rate, weekly_rate, rental_type, total_amount, status, user:profiles!user_id(full_name), gear_source_type, gear_asset_id, gear_kit_instance_id"
            ).in_("id", source_ids_by_type["kit_rental"]).execute()
            for row in kit_result.data or []:
                # Calculate rental_days from start_date and end_date
                if row.get("start_date") and row.get("end_date"):
                    try:
                        start = datetime.fromisoformat(row["start_date"].replace("Z", "+00:00")).date() if "T" in row["start_date"] else datetime.strptime(row["start_date"], "%Y-%m-%d").date()
                        end = datetime.fromisoformat(row["end_date"].replace("Z", "+00:00")).date() if "T" in row["end_date"] else datetime.strptime(row["end_date"], "%Y-%m-%d").date()
                        row["rental_days"] = (end - start).days + 1
                    except:
                        row["rental_days"] = None
                source_details[f"kit_rental:{row['id']}"] = row

        # Per diem
        if "per_diem" in source_ids_by_type:
            perdiem_result = client.table("backlot_per_diem_entries").select(
                "id, date, meal_type, amount, notes, status, user:profiles!user_id(full_name)"
            ).in_("id", source_ids_by_type["per_diem"]).execute()
            for row in perdiem_result.data or []:
                source_details[f"per_diem:{row['id']}"] = row

        # Receipts
        if "receipt" in source_ids_by_type:
            receipt_result = client.table("backlot_receipts").select(
                "id, vendor_name, purchase_date, amount, description, expense_category, reimbursement_status, file_url, user:profiles!user_id(full_name)"
            ).in_("id", source_ids_by_type["receipt"]).execute()
            for row in receipt_result.data or []:
                source_details[f"receipt:{row['id']}"] = row

        # Purchase orders
        if "purchase_order" in source_ids_by_type:
            po_result = client.table("backlot_purchase_orders").select(
                "id, po_number, vendor_name, description, department, estimated_amount, actual_amount, status, requester:profiles!requester_id(full_name)"
            ).in_("id", source_ids_by_type["purchase_order"]).execute()
            for row in po_result.data or []:
                source_details[f"purchase_order:{row['id']}"] = row

        # Invoice line items
        if "invoice_line_item" in source_ids_by_type:
            li_result = client.table("backlot_invoice_line_items").select(
                "id, description, rate_type, rate, quantity, line_total, service_date_start, service_date_end, invoice_id, invoice:backlot_invoices!invoice_id(id, invoice_number, user:profiles!user_id(full_name))"
            ).in_("id", source_ids_by_type["invoice_line_item"]).execute()
            for row in li_result.data or []:
                source_details[f"invoice_line_item:{row['id']}"] = row

        # Attach source details to actuals
        for actual in actuals:
            source_type = actual.get("source_type")
            source_id = actual.get("source_id")
            key = f"{source_type}:{source_id}"
            if key in source_details:
                actual["source_details"] = source_details[key]

    # Flatten category name and submitter for frontend convenience and calculate total
    total_amount = 0
    for actual in actuals:
        # Flatten category name
        category_data = actual.pop("category", None)
        if category_data:
            actual["category_name"] = category_data.get("name", "Uncategorized")
        else:
            actual["category_name"] = actual.get("expense_category") or "Uncategorized"

        # Flatten submitter info
        submitter_data = actual.pop("submitter", None)
        if submitter_data:
            actual["submitter_full_name"] = submitter_data.get("full_name")
            actual["submitter_avatar_url"] = submitter_data.get("avatar_url")
        elif actual.get("submitter_name"):
            actual["submitter_full_name"] = actual.get("submitter_name")
            actual["submitter_avatar_url"] = None
        else:
            actual["submitter_full_name"] = None
            actual["submitter_avatar_url"] = None

        # Sum up total
        total_amount += float(actual.get("amount") or 0)

    return {"actuals": actuals, "total_amount": total_amount}


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


@router.post("/projects/{project_id}/budget/sync-actuals")
async def sync_budget_actuals(
    project_id: str,
    authorization: str = Header(None),
):
    """
    Sync budget actuals from all approved expenses and invoices.
    Use this to populate actuals from historical data or fix discrepancies.
    Requires admin/owner access.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify admin access (owner or high-level role)
    member_result = client.table("backlot_project_members").select(
        "role"
    ).eq("project_id", project_id).eq("user_id", user["id"]).execute()

    is_owner = member_result.data and member_result.data[0].get("role") == "owner"

    role_result = client.table("backlot_project_roles").select(
        "backlot_role"
    ).eq("project_id", project_id).eq("user_id", user["id"]).execute()

    admin_roles = ["showrunner", "producer", "line_producer", "upm"]
    user_roles = [r["backlot_role"] for r in (role_result.data or [])]
    is_admin = any(role in admin_roles for role in user_roles)

    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required to sync budget actuals")

    from app.services.budget_actuals import (
        record_mileage_actual,
        record_kit_rental_actual,
        record_per_diem_actual,
        record_receipt_actual,
        record_purchase_order_actual,
        record_invoice_line_items,
        record_gear_rental_order_actual,
        record_gear_item_actual,
    )

    stats = {
        "mileage": 0,
        "kit_rentals": 0,
        "per_diem": 0,
        "receipts": 0,
        "purchase_orders": 0,
        "invoice_line_items": 0,
        "gear_rental_orders": 0,
        "gear_items": 0,
        "skipped": 0,
    }

    # Sync approved mileage
    mileage = client.table("backlot_mileage_entries").select("*").eq(
        "project_id", project_id
    ).eq("status", "approved").execute()
    for entry in mileage.data or []:
        result = record_mileage_actual(entry, user["id"])
        if result:
            stats["mileage"] += 1
        else:
            stats["skipped"] += 1

    # Sync approved/active/completed kit rentals
    kits = client.table("backlot_kit_rentals").select("*").eq(
        "project_id", project_id
    ).in_("status", ["approved", "active", "completed"]).execute()
    for kit in kits.data or []:
        result = record_kit_rental_actual(kit, user["id"])
        if result:
            stats["kit_rentals"] += 1
        else:
            stats["skipped"] += 1

    # Sync approved per diem
    per_diem = client.table("backlot_per_diem").select("*").eq(
        "project_id", project_id
    ).eq("status", "approved").execute()
    for pd in per_diem.data or []:
        result = record_per_diem_actual(pd, user["id"])
        if result:
            stats["per_diem"] += 1
        else:
            stats["skipped"] += 1

    # Sync approved receipts (reimbursement_status = approved)
    receipts = client.table("backlot_receipts").select("*").eq(
        "project_id", project_id
    ).eq("reimbursement_status", "approved").execute()
    for r in receipts.data or []:
        result = record_receipt_actual(r, user["id"])
        if result:
            stats["receipts"] += 1
        else:
            stats["skipped"] += 1

    # Sync approved purchase orders
    pos = client.table("backlot_purchase_orders").select("*").eq(
        "project_id", project_id
    ).eq("status", "approved").execute()
    for po in pos.data or []:
        result = record_purchase_order_actual(po, user["id"])
        if result:
            stats["purchase_orders"] += 1
        else:
            stats["skipped"] += 1

    # Sync approved invoices - only their line items
    invoices = client.table("backlot_invoices").select("*").eq(
        "project_id", project_id
    ).in_("status", ["approved", "sent", "paid"]).execute()
    for inv in invoices.data or []:
        line_items = client.table("backlot_invoice_line_items").select("*").eq(
            "invoice_id", inv["id"]
        ).execute()
        recorded = record_invoice_line_items(inv, line_items.data or [], user["id"])
        stats["invoice_line_items"] += len(recorded)

    # Sync gear rental orders (marketplace rentals)
    from app.core.database import execute_query
    orders = execute_query("""
        SELECT ro.*, org.name as rental_house_name
        FROM gear_rental_orders ro
        LEFT JOIN organizations org ON org.id = ro.rental_house_org_id
        WHERE ro.backlot_project_id = :project_id
        AND ro.status IN ('confirmed', 'building', 'ready_for_pickup', 'picked_up', 'in_use', 'returned', 'closed')
        AND (ro.total_amount > 0 OR ro.final_amount > 0)
    """, {"project_id": project_id})

    for order in orders:
        result = record_gear_rental_order_actual(order, user["id"])
        if result:
            stats["gear_rental_orders"] += 1
        else:
            stats["skipped"] += 1

    # Sync manual gear items (not owned, not linked to rental orders)
    items = execute_query("""
        SELECT * FROM backlot_gear_items
        WHERE project_id = :project_id
        AND is_owned = FALSE
        AND gear_rental_order_item_id IS NULL
        AND rental_cost_per_day > 0
        AND pickup_date IS NOT NULL
        AND return_date IS NOT NULL
    """, {"project_id": project_id})

    for item in items:
        result = record_gear_item_actual(item, user["id"])
        if result:
            stats["gear_items"] += 1
        else:
            stats["skipped"] += 1

    return {
        "success": True,
        "synced": stats,
        "total_recorded": sum(v for k, v in stats.items() if k != "skipped")
    }


# =============================================================================
# BUDGET ACTUAL DETAIL & MANAGEMENT ENDPOINTS
# =============================================================================

class BudgetActualUpdateRequest(BaseModel):
    """Request body for updating a budget actual"""
    notes: Optional[str] = None
    sync_notes_to_source: Optional[bool] = False
    is_reimbursed: Optional[bool] = None


@router.get("/budget-actuals/{actual_id}")
async def get_budget_actual_detail(
    actual_id: str,
    authorization: str = Header(None),
):
    """
    Get detailed info for a single budget actual with full source details
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Fetch the budget actual
    actual = client.table("backlot_budget_actuals").select(
        "*, category:backlot_budget_categories!budget_category_id(id, name), submitter:profiles!submitter_user_id(full_name, avatar_url), reimbursed_by_user:profiles!reimbursed_by(full_name)"
    ).eq("id", actual_id).single().execute()

    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    # Verify project access
    project_id = actual.data.get("project_id")
    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    result = actual.data

    # Flatten joined data
    category_data = result.pop("category", None)
    if category_data:
        result["category_name"] = category_data.get("name", "Uncategorized")
    else:
        result["category_name"] = result.get("expense_category") or "Uncategorized"

    submitter_data = result.pop("submitter", None)
    if submitter_data:
        result["submitter_full_name"] = submitter_data.get("full_name")
        result["submitter_avatar_url"] = submitter_data.get("avatar_url")

    reimbursed_by_data = result.pop("reimbursed_by_user", None)
    if reimbursed_by_data:
        result["reimbursed_by_name"] = reimbursed_by_data.get("full_name")

    # Fetch source details
    source_type = result.get("source_type")
    source_id = result.get("source_id")

    if source_type and source_id:
        source_details = await _fetch_source_details(client, source_type, source_id)
        if source_details:
            result["source_details"] = source_details

    # Generate deep link to original
    from app.services.deep_links import generate_expense_deep_link
    result["source_deep_link"] = generate_expense_deep_link(project_id, source_type, source_id) if source_type and source_id else None

    return result


async def _fetch_source_details(client, source_type: str, source_id: str) -> Optional[dict]:
    """Helper to fetch full details for a source item"""
    try:
        if source_type == "mileage":
            result = client.table("backlot_mileage_entries").select(
                "*, user:profiles!user_id(full_name, avatar_url)"
            ).eq("id", source_id).single().execute()
            if result.data:
                data = result.data
                data["origin"] = data.get("start_location")
                data["destination"] = data.get("end_location")
                return data

        elif source_type == "kit_rental":
            result = client.table("backlot_kit_rentals").select(
                "*, user:profiles!user_id(full_name, avatar_url)"
            ).eq("id", source_id).single().execute()
            if result.data:
                data = result.data
                # Calculate rental_days
                if data.get("start_date") and data.get("end_date"):
                    try:
                        start = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00")).date() if "T" in data["start_date"] else datetime.strptime(data["start_date"], "%Y-%m-%d").date()
                        end = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00")).date() if "T" in data["end_date"] else datetime.strptime(data["end_date"], "%Y-%m-%d").date()
                        data["rental_days"] = (end - start).days + 1
                    except:
                        data["rental_days"] = None
                return data

        elif source_type == "per_diem":
            result = client.table("backlot_per_diem_entries").select(
                "*, user:profiles!user_id(full_name, avatar_url)"
            ).eq("id", source_id).single().execute()
            return result.data if result.data else None

        elif source_type == "receipt":
            result = client.table("backlot_receipts").select(
                "*, user:profiles!user_id(full_name, avatar_url)"
            ).eq("id", source_id).single().execute()
            return result.data if result.data else None

        elif source_type == "purchase_order":
            result = client.table("backlot_purchase_orders").select(
                "*, requester:profiles!requester_id(full_name, avatar_url)"
            ).eq("id", source_id).single().execute()
            return result.data if result.data else None

        elif source_type == "invoice_line_item":
            result = client.table("backlot_invoice_line_items").select(
                "*, invoice:backlot_invoices!invoice_id(id, invoice_number, vendor_name)"
            ).eq("id", source_id).single().execute()
            return result.data if result.data else None

    except Exception as e:
        logger.error(f"Error fetching source details for {source_type}:{source_id}: {e}")

    return None


@router.patch("/budget-actuals/{actual_id}")
async def update_budget_actual(
    actual_id: str,
    request: BudgetActualUpdateRequest,
    authorization: str = Header(None),
):
    """
    Update a budget actual (notes, reimbursed status)
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Fetch actual to verify access
    actual = client.table("backlot_budget_actuals").select("*").eq("id", actual_id).single().execute()

    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    project_id = actual.data.get("project_id")
    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Prepare update
    update_data = {}
    previous_values = {}

    if request.notes is not None:
        previous_values["notes"] = actual.data.get("notes")
        update_data["notes"] = request.notes
        update_data["notes_updated_at"] = datetime.utcnow().isoformat()

        # Optionally sync to source
        if request.sync_notes_to_source and actual.data.get("source_id"):
            await _sync_notes_to_source(
                client,
                actual.data["source_type"],
                actual.data["source_id"],
                request.notes
            )
            update_data["notes_synced_to_source"] = True

    if request.is_reimbursed is not None:
        previous_values["is_reimbursed"] = actual.data.get("is_reimbursed")
        update_data["is_reimbursed"] = request.is_reimbursed
        if request.is_reimbursed:
            update_data["reimbursed_at"] = datetime.utcnow().isoformat()
            update_data["reimbursed_by"] = user["id"]
        else:
            update_data["reimbursed_at"] = None
            update_data["reimbursed_by"] = None

    if not update_data:
        return actual.data

    update_data["updated_at"] = datetime.utcnow().isoformat()

    # Update
    result = client.table("backlot_budget_actuals").update(update_data).eq("id", actual_id).execute()

    # Log audit
    from app.services.expense_audit import log_expense_action
    log_expense_action(
        project_id=project_id,
        user_id=user["id"],
        action="updated" if request.notes is not None else ("reimbursed" if request.is_reimbursed else "unreimbursed"),
        target_type="budget_actual",
        target_id=actual_id,
        previous_values=previous_values,
        new_values=update_data
    )

    return result.data[0] if result.data else {"id": actual_id, **update_data}


async def _sync_notes_to_source(client, source_type: str, source_id: str, notes: str):
    """Sync notes to the original source expense"""
    try:
        table_map = {
            "mileage": "backlot_mileage_entries",
            "kit_rental": "backlot_kit_rentals",
            "per_diem": "backlot_per_diem_entries",
            "receipt": "backlot_receipts",
            "purchase_order": "backlot_purchase_orders",
        }
        table = table_map.get(source_type)
        if table:
            client.table(table).update({"notes": notes}).eq("id", source_id).execute()
    except Exception as e:
        logger.error(f"Error syncing notes to source {source_type}:{source_id}: {e}")


@router.get("/budget-actuals/{actual_id}/audit-log")
async def get_budget_actual_audit_log(
    actual_id: str,
    authorization: str = Header(None),
):
    """Get audit log for a specific budget actual"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify access via actual's project
    actual = client.table("backlot_budget_actuals").select("project_id").eq("id", actual_id).single().execute()

    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    project_id = actual.data["project_id"]
    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    from app.services.expense_audit import get_audit_log_for_target
    entries = await get_audit_log_for_target("budget_actual", actual_id)

    return {"entries": entries}


@router.get("/kit-rentals/{rental_id}/gear-details")
async def get_kit_rental_gear_details(
    rental_id: str,
    authorization: str = Header(None),
):
    """
    Get full Gear House asset details for a kit rental
    Returns asset photos, serial number, condition, rental rates, etc.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get the kit rental with gear link
    rental = client.table("backlot_kit_rentals").select("*").eq("id", rental_id).single().execute()

    if not rental.data:
        raise HTTPException(status_code=404, detail="Kit rental not found")

    # Verify project access
    project_id = rental.data.get("project_id")
    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    gear_details = None
    deep_link = None

    if rental.data.get("gear_asset_id"):
        # Fetch from gear_assets
        asset = client.table("gear_assets").select(
            "*, category:gear_categories!category_id(name), organization:gear_organizations!organization_id(id, name)"
        ).eq("id", rental.data["gear_asset_id"]).single().execute()

        if asset.data:
            org_id = asset.data.get("organization", {}).get("id") or rental.data.get("gear_organization_id")
            gear_details = {
                "type": "asset",
                "asset": asset.data,
                "organization_name": asset.data.get("organization", {}).get("name"),
                "category_name": asset.data.get("category", {}).get("name"),
            }
            if org_id:
                from app.services.deep_links import generate_gear_asset_deep_link
                deep_link = generate_gear_asset_deep_link(org_id, rental.data["gear_asset_id"])

    elif rental.data.get("gear_kit_instance_id"):
        # Fetch kit instance with items
        kit = client.table("gear_kit_instances").select(
            "*, template:gear_kit_templates!template_id(name, description)"
        ).eq("id", rental.data["gear_kit_instance_id"]).single().execute()

        if kit.data:
            # Get items in the kit
            items = client.table("gear_kit_instance_items").select(
                "*, asset:gear_assets!asset_id(id, name, internal_id, serial_number)"
            ).eq("kit_instance_id", rental.data["gear_kit_instance_id"]).execute()

            org_id = rental.data.get("gear_organization_id")
            gear_details = {
                "type": "kit",
                "kit": kit.data,
                "template_name": kit.data.get("template", {}).get("name"),
                "items": items.data or [],
            }
            if org_id:
                from app.services.deep_links import generate_gear_kit_deep_link
                deep_link = generate_gear_kit_deep_link(org_id, rental.data["gear_kit_instance_id"])

    return {
        "rental": rental.data,
        "gear_details": gear_details,
        "deep_link": deep_link,
        "can_link_to_gear_house": not gear_details and rental.data.get("gear_source_type") in (None, "lite")
    }


# =============================================================================
# BUDGET ACTUAL RECEIPT ATTACHMENT ENDPOINTS
# =============================================================================

@router.get("/budget-actuals/{actual_id}/receipts")
async def get_actual_receipts(
    actual_id: str,
    authorization: str = Header(None),
):
    """List receipts attached to a budget actual"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify access
    actual = client.table("backlot_budget_actuals").select("project_id, source_type, source_id").eq("id", actual_id).single().execute()
    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    if not await verify_project_member(client, actual.data["project_id"], user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # If the source is a receipt, return that receipt
    if actual.data.get("source_type") == "receipt" and actual.data.get("source_id"):
        receipt = client.table("backlot_receipts").select("*").eq("id", actual.data["source_id"]).single().execute()
        return [receipt.data] if receipt.data else []

    # Check for attached receipts via junction table (if exists)
    try:
        attachments = client.table("backlot_budget_actual_receipts").select(
            "*, receipt:backlot_receipts!receipt_id(*)"
        ).eq("budget_actual_id", actual_id).order("position").execute()
        return [a.get("receipt") for a in (attachments.data or []) if a.get("receipt")]
    except:
        # Junction table doesn't exist yet, return empty
        return []


@router.post("/budget-actuals/{actual_id}/receipts/{receipt_id}")
async def attach_receipt_to_actual(
    actual_id: str,
    receipt_id: str,
    authorization: str = Header(None),
):
    """Attach a receipt to a budget actual"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify access
    actual = client.table("backlot_budget_actuals").select("project_id").eq("id", actual_id).single().execute()
    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    project_id = actual.data["project_id"]
    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify receipt exists in same project
    receipt = client.table("backlot_receipts").select("id, project_id").eq("id", receipt_id).single().execute()
    if not receipt.data or receipt.data.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Receipt not found in this project")

    # Get next position
    try:
        existing = client.table("backlot_budget_actual_receipts").select("position").eq("budget_actual_id", actual_id).order("position", desc=True).limit(1).execute()
        next_position = (existing.data[0]["position"] + 1) if existing.data else 0
    except:
        next_position = 0

    # Create attachment
    try:
        result = client.table("backlot_budget_actual_receipts").insert({
            "budget_actual_id": actual_id,
            "receipt_id": receipt_id,
            "position": next_position,
            "attached_by": user["id"],
            "attached_at": datetime.utcnow().isoformat()
        }).execute()

        # Log audit
        from app.services.expense_audit import log_receipt_attached
        log_receipt_attached(project_id, user["id"], actual_id, receipt_id)

        return {"success": True, "attachment": result.data[0] if result.data else None}
    except Exception as e:
        logger.error(f"Error attaching receipt: {e}")
        raise HTTPException(status_code=500, detail="Failed to attach receipt")


@router.delete("/budget-actuals/{actual_id}/receipts/{receipt_id}")
async def detach_receipt_from_actual(
    actual_id: str,
    receipt_id: str,
    authorization: str = Header(None),
):
    """Detach a receipt from a budget actual"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify access
    actual = client.table("backlot_budget_actuals").select("project_id").eq("id", actual_id).single().execute()
    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    project_id = actual.data["project_id"]
    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete attachment
    try:
        client.table("backlot_budget_actual_receipts").delete().eq("budget_actual_id", actual_id).eq("receipt_id", receipt_id).execute()

        # Log audit
        from app.services.expense_audit import log_receipt_removed
        log_receipt_removed(project_id, user["id"], actual_id, receipt_id)

        return {"success": True}
    except Exception as e:
        logger.error(f"Error detaching receipt: {e}")
        raise HTTPException(status_code=500, detail="Failed to detach receipt")


class ReceiptReorderRequest(BaseModel):
    receipt_ids: List[str]


@router.put("/budget-actuals/{actual_id}/receipts/reorder")
async def reorder_actual_receipts(
    actual_id: str,
    request: ReceiptReorderRequest,
    authorization: str = Header(None),
):
    """Reorder receipts attached to a budget actual"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify access
    actual = client.table("backlot_budget_actuals").select("project_id").eq("id", actual_id).single().execute()
    if not actual.data:
        raise HTTPException(status_code=404, detail="Budget actual not found")

    if not await verify_project_member(client, actual.data["project_id"], user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Update positions
    try:
        for position, receipt_id in enumerate(request.receipt_ids):
            client.table("backlot_budget_actual_receipts").update({
                "position": position
            }).eq("budget_actual_id", actual_id).eq("receipt_id", receipt_id).execute()

        return {"success": True}
    except Exception as e:
        logger.error(f"Error reordering receipts: {e}")
        raise HTTPException(status_code=500, detail="Failed to reorder receipts")
