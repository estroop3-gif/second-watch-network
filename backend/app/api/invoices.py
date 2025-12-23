"""
Invoices API - Crew billing system for Backlot projects
Supports invoice creation, line items, status workflow, and data imports from timecards/expenses
Last updated: 2025-12-22 14:00 - Fixed profile column queries
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from app.core.database import get_client, execute_single
import logging
import traceback

router = APIRouter()
logger = logging.getLogger(__name__)


def handle_invoice_error(e: Exception, operation: str) -> JSONResponse:
    """Handle errors with proper logging and response"""
    error_msg = str(e)
    trace = traceback.format_exc()
    logger.error(f"[Invoices] {operation} failed: {error_msg}\n{trace}")

    if isinstance(e, HTTPException):
        raise e

    return JSONResponse(
        status_code=500,
        content={"detail": f"Invoice operation failed: {error_msg}"}
    )


async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("[Invoices] Missing or invalid authorization header")
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            logger.warning("[Invoices] Invalid token - verify_token returned None")
            raise HTTPException(status_code=401, detail="Invalid token")
        logger.info(f"[Invoices] Authenticated user: {user.get('id')}")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Invoices] Authentication failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def get_profile_id_from_cognito_id(cognito_user_id: str) -> str:
    """Look up the profile ID from a Cognito user ID."""
    uid_str = str(cognito_user_id)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid OR id::text = :uid LIMIT 1",
        {"cuid": uid_str, "uid": uid_str}
    )
    if not profile_row:
        return None
    return profile_row["id"]


def get_user_profile(user_id: str) -> dict:
    """Get user profile data for pre-filling invoice."""
    profile = execute_single(
        """SELECT id, display_name, email
           FROM profiles WHERE id = :user_id""",
        {"user_id": user_id}
    )
    return profile


def check_project_access(project_id: str, user_id: str) -> bool:
    """Check if user has access to project."""
    result = execute_single(
        """SELECT 1 FROM backlot_project_members
           WHERE project_id = :project_id AND user_id = :user_id""",
        {"project_id": project_id, "user_id": user_id}
    )
    return result is not None


def check_project_admin(project_id: str, user_id: str) -> bool:
    """Check if user is admin/showrunner on project."""
    result = execute_single(
        """SELECT 1 FROM backlot_project_members
           WHERE project_id = :project_id AND user_id = :user_id
           AND role IN ('showrunner', 'producer', 'line_producer', 'upm', 'accountant')""",
        {"project_id": project_id, "user_id": user_id}
    )
    if result:
        return True
    # Also check if they own the project
    result = execute_single(
        """SELECT 1 FROM backlot_projects
           WHERE id = :project_id AND owner_id = :user_id""",
        {"project_id": project_id, "user_id": user_id}
    )
    return result is not None


# =============================================================================
# MODELS
# =============================================================================

class InvoiceLineItem(BaseModel):
    id: str
    invoice_id: str
    description: str
    rate_type: str = "flat"
    rate_amount: float
    quantity: float = 1
    units: Optional[str] = None
    line_total: float
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    service_date_start: Optional[str] = None
    service_date_end: Optional[str] = None
    sort_order: int = 0
    created_at: str
    updated_at: str


class Invoice(BaseModel):
    id: str
    project_id: str
    user_id: str
    invoice_number: str
    invoice_date: str
    due_date: Optional[str] = None
    invoicer_name: str
    invoicer_email: Optional[str] = None
    invoicer_phone: Optional[str] = None
    invoicer_address: Optional[str] = None
    bill_to_name: str
    bill_to_company: Optional[str] = None
    bill_to_address: Optional[str] = None
    bill_to_email: Optional[str] = None
    position_role: Optional[str] = None
    production_title: Optional[str] = None
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    po_number: Optional[str] = None
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    total_amount: float = 0
    currency: str = "USD"
    payment_terms: Optional[str] = "net_30"
    payment_terms_custom: Optional[str] = None
    payment_method: Optional[str] = None
    payment_details: Optional[str] = None
    status: str = "draft"
    sent_at: Optional[str] = None
    paid_at: Optional[str] = None
    paid_amount: Optional[float] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    # Approval workflow fields
    submitted_for_approval_at: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    changes_requested_at: Optional[str] = None
    changes_requested_by: Optional[str] = None
    change_request_reason: Optional[str] = None
    created_at: str
    updated_at: str


class InvoiceWithLineItems(Invoice):
    line_items: List[InvoiceLineItem] = []
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None


class InvoiceListItem(BaseModel):
    id: str
    invoice_number: str
    invoice_date: str
    due_date: Optional[str] = None
    bill_to_name: str
    bill_to_company: Optional[str] = None
    total_amount: float
    status: str
    user_id: str
    user_name: Optional[str] = None
    line_item_count: int = 0


class CreateInvoiceRequest(BaseModel):
    invoice_number: Optional[str] = None  # Auto-generate if not provided
    invoice_date: str  # YYYY-MM-DD
    due_date: Optional[str] = None
    invoicer_name: str
    invoicer_email: Optional[str] = None
    invoicer_phone: Optional[str] = None
    invoicer_address: Optional[str] = None
    bill_to_name: str
    bill_to_company: Optional[str] = None
    bill_to_address: Optional[str] = None
    bill_to_email: Optional[str] = None
    position_role: Optional[str] = None
    production_title: Optional[str] = None
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    po_number: Optional[str] = None
    payment_terms: Optional[str] = "net_30"
    payment_terms_custom: Optional[str] = None
    payment_method: Optional[str] = None
    payment_details: Optional[str] = None
    tax_rate: Optional[float] = 0
    discount_amount: Optional[float] = 0
    notes: Optional[str] = None


class UpdateInvoiceRequest(BaseModel):
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    invoicer_name: Optional[str] = None
    invoicer_email: Optional[str] = None
    invoicer_phone: Optional[str] = None
    invoicer_address: Optional[str] = None
    bill_to_name: Optional[str] = None
    bill_to_company: Optional[str] = None
    bill_to_address: Optional[str] = None
    bill_to_email: Optional[str] = None
    position_role: Optional[str] = None
    production_title: Optional[str] = None
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    po_number: Optional[str] = None
    payment_terms: Optional[str] = None
    payment_terms_custom: Optional[str] = None
    payment_method: Optional[str] = None
    payment_details: Optional[str] = None
    tax_rate: Optional[float] = None
    discount_amount: Optional[float] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None


class CreateLineItemRequest(BaseModel):
    description: str
    rate_type: Optional[str] = "flat"
    rate_amount: float
    quantity: Optional[float] = 1
    units: Optional[str] = None
    service_date_start: Optional[str] = None
    service_date_end: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None


class UpdateLineItemRequest(BaseModel):
    description: Optional[str] = None
    rate_type: Optional[str] = None
    rate_amount: Optional[float] = None
    quantity: Optional[float] = None
    units: Optional[str] = None
    service_date_start: Optional[str] = None
    service_date_end: Optional[str] = None


class InvoiceSummary(BaseModel):
    total_invoices: int = 0
    draft_count: int = 0
    pending_approval_count: int = 0
    approved_count: int = 0
    changes_requested_count: int = 0
    sent_count: int = 0
    paid_count: int = 0
    overdue_count: int = 0
    cancelled_count: int = 0
    total_outstanding: float = 0
    total_paid: float = 0


class ImportableData(BaseModel):
    approved_timecards: List[Dict[str, Any]] = []
    approved_kit_rentals: List[Dict[str, Any]] = []
    approved_mileage: List[Dict[str, Any]] = []
    approved_per_diem: List[Dict[str, Any]] = []
    approved_receipts: List[Dict[str, Any]] = []


class ImportTimecardsRequest(BaseModel):
    timecard_ids: List[str]


class ImportExpensesRequest(BaseModel):
    kit_rental_ids: Optional[List[str]] = []
    mileage_ids: Optional[List[str]] = []
    per_diem_ids: Optional[List[str]] = []
    receipt_ids: Optional[List[str]] = []


class MarkPaidRequest(BaseModel):
    paid_amount: Optional[float] = None


class RequestChangesRequest(BaseModel):
    reason: str  # Required - feedback for crew


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_invoice_number(project_id: str) -> str:
    """Generate next invoice number for project."""
    result = execute_single(
        """SELECT COUNT(*) + 1 as next_num FROM backlot_invoices
           WHERE project_id = :project_id""",
        {"project_id": project_id}
    )
    num = result["next_num"] if result else 1
    return f"INV-{str(num).zfill(5)}"


def calculate_due_date(invoice_date: str, payment_terms: str) -> Optional[str]:
    """Calculate due date based on payment terms."""
    if not payment_terms or payment_terms == "custom":
        return None

    base_date = datetime.strptime(invoice_date, "%Y-%m-%d")

    days_map = {
        "due_on_receipt": 0,
        "net_15": 15,
        "net_30": 30,
        "net_45": 45,
        "net_60": 60,
    }

    days = days_map.get(payment_terms, 30)
    due_date = base_date + timedelta(days=days)
    return due_date.strftime("%Y-%m-%d")


def recalculate_invoice_totals(invoice_id: str):
    """Recalculate invoice totals from line items."""
    client = get_client()

    # Get line items sum
    result = execute_single(
        """SELECT COALESCE(SUM(line_total), 0) as subtotal
           FROM backlot_invoice_line_items WHERE invoice_id = :invoice_id""",
        {"invoice_id": invoice_id}
    )
    subtotal = float(result["subtotal"]) if result else 0

    # Get invoice tax rate and discount
    invoice = execute_single(
        """SELECT tax_rate, discount_amount FROM backlot_invoices WHERE id = :invoice_id""",
        {"invoice_id": invoice_id}
    )
    tax_rate = float(invoice["tax_rate"]) if invoice and invoice["tax_rate"] else 0
    discount = float(invoice["discount_amount"]) if invoice and invoice["discount_amount"] else 0

    # Calculate totals
    tax_amount = round(subtotal * (tax_rate / 100), 2)
    total_amount = subtotal + tax_amount - discount

    # Update invoice
    client.table("backlot_invoices").update({
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()


from datetime import timedelta


# =============================================================================
# INVOICE ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/invoices/me", response_model=List[InvoiceListItem])
async def get_my_invoices(
    project_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get current user's invoices for a project."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    if not check_project_access(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    client = get_client()

    query = client.table("backlot_invoices").select(
        "id, invoice_number, invoice_date, due_date, bill_to_name, bill_to_company, total_amount, status, user_id"
    ).eq("project_id", project_id).eq("user_id", user_id)

    if status:
        query = query.eq("status", status)

    result = query.order("invoice_date", desc=True).execute()
    invoices = result.data if result.data else []

    # Get line item counts
    for inv in invoices:
        count_result = execute_single(
            "SELECT COUNT(*) as cnt FROM backlot_invoice_line_items WHERE invoice_id = :id",
            {"id": inv["id"]}
        )
        inv["line_item_count"] = count_result["cnt"] if count_result else 0

    return invoices


@router.get("/projects/{project_id}/invoices/review", response_model=List[InvoiceListItem])
async def get_invoices_for_review(
    project_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all invoices for project (managers only)."""
    try:
        logger.info(f"[Invoices] get_invoices_for_review called for project {project_id}")
        current_user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(current_user["id"])
        if not user_id:
            logger.warning(f"[Invoices] User profile not found for cognito_id: {current_user['id']}")
            raise HTTPException(status_code=401, detail="User profile not found")

        if not check_project_admin(project_id, user_id):
            logger.warning(f"[Invoices] User {user_id} not authorized to review invoices for project {project_id}")
            raise HTTPException(status_code=403, detail="Not authorized to review invoices")

        client = get_client()

        query = client.table("backlot_invoices").select(
            "id, invoice_number, invoice_date, due_date, bill_to_name, bill_to_company, total_amount, status, user_id"
        ).eq("project_id", project_id)

        if status:
            query = query.eq("status", status)

        result = query.order("invoice_date", desc=True).execute()
        invoices = result.data if result.data else []

        # Get user names and line item counts
        for inv in invoices:
            profile = execute_single(
                "SELECT display_name FROM profiles WHERE id = :id",
                {"id": inv["user_id"]}
            )
            inv["user_name"] = profile["display_name"] if profile else None

            count_result = execute_single(
                "SELECT COUNT(*) as cnt FROM backlot_invoice_line_items WHERE invoice_id = :id",
                {"id": inv["id"]}
            )
            inv["line_item_count"] = count_result["cnt"] if count_result else 0

        logger.info(f"[Invoices] Returning {len(invoices)} invoices for review")
        return invoices
    except HTTPException:
        raise
    except Exception as e:
        return handle_invoice_error(e, "get_invoices_for_review")


@router.get("/projects/{project_id}/invoices/summary", response_model=InvoiceSummary)
async def get_invoice_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """Get invoice statistics for current user."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    result = execute_single(
        """SELECT
            COUNT(*) as total_invoices,
            COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
            COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval_count,
            COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
            COUNT(*) FILTER (WHERE status = 'changes_requested') as changes_requested_count,
            COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
            COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
            COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
            COALESCE(SUM(total_amount) FILTER (WHERE status IN ('sent', 'overdue')), 0) as total_outstanding,
            COALESCE(SUM(COALESCE(paid_amount, total_amount)) FILTER (WHERE status = 'paid'), 0) as total_paid
        FROM backlot_invoices
        WHERE project_id = :project_id AND user_id = :user_id""",
        {"project_id": project_id, "user_id": user_id}
    )

    return InvoiceSummary(
        total_invoices=result["total_invoices"] or 0,
        draft_count=result["draft_count"] or 0,
        pending_approval_count=result["pending_approval_count"] or 0,
        approved_count=result["approved_count"] or 0,
        changes_requested_count=result["changes_requested_count"] or 0,
        sent_count=result["sent_count"] or 0,
        paid_count=result["paid_count"] or 0,
        overdue_count=result["overdue_count"] or 0,
        cancelled_count=result["cancelled_count"] or 0,
        total_outstanding=float(result["total_outstanding"] or 0),
        total_paid=float(result["total_paid"] or 0)
    )


@router.get("/projects/{project_id}/invoices/next-number")
async def get_next_invoice_number(
    project_id: str,
    authorization: str = Header(None)
):
    """Get next auto-generated invoice number."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    if not check_project_access(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    invoice_number = generate_invoice_number(project_id)
    return {"invoice_number": invoice_number}


@router.get("/projects/{project_id}/invoices/prefill-data")
async def get_prefill_data(
    project_id: str,
    authorization: str = Header(None)
):
    """Get data to prefill a new invoice (user profile, project info)."""
    try:
        logger.info(f"[Invoices] get_prefill_data called for project {project_id}")
        current_user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(current_user["id"])
        if not user_id:
            logger.warning(f"[Invoices] User profile not found for cognito_id: {current_user['id']}")
            raise HTTPException(status_code=401, detail="User profile not found")

        if not check_project_access(project_id, user_id):
            logger.warning(f"[Invoices] User {user_id} not a member of project {project_id}")
            raise HTTPException(status_code=403, detail="Not a project member")

        # Get user profile
        profile = execute_single(
            """SELECT display_name, email FROM profiles WHERE id = :id""",
            {"id": user_id}
        )

        # Get project info
        project = execute_single(
            """SELECT title FROM backlot_projects WHERE id = :id""",
            {"id": project_id}
        )

        # Get user's role on project
        member = execute_single(
            """SELECT role, department FROM backlot_project_members WHERE project_id = :project_id AND user_id = :user_id""",
            {"project_id": project_id, "user_id": user_id}
        )

        logger.info(f"[Invoices] Returning prefill data for user {user_id}")
        return {
            "invoicer_name": profile["display_name"] if profile else None,
            "invoicer_email": profile["email"] if profile else None,
            "invoicer_phone": None,
            "invoicer_address": None,
            "bill_to_name": project["title"] if project else None,  # Use project title as bill_to default
            "production_title": project["title"] if project else None,
            "position_role": member["role"] if member else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_invoice_error(e, "get_prefill_data")


@router.get("/projects/{project_id}/invoices/importable-data", response_model=ImportableData)
async def get_importable_data(
    project_id: str,
    authorization: str = Header(None)
):
    """Get data available to import into invoices (approved timecards, expenses, etc.)."""
    try:
        logger.info(f"[Invoices] get_importable_data called for project {project_id}")
        current_user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(current_user["id"])
        if not user_id:
            logger.warning(f"[Invoices] User profile not found for cognito_id: {current_user['id']}")
            raise HTTPException(status_code=401, detail="User profile not found")

        if not check_project_access(project_id, user_id):
            logger.warning(f"[Invoices] User {user_id} not a member of project {project_id}")
            raise HTTPException(status_code=403, detail="Not a project member")

        client = get_client()

        # Get approved timecards not yet imported
        timecards_result = client.table("backlot_timecards").select(
            "id, week_start_date, notes"
        ).eq("project_id", project_id).eq("user_id", user_id).eq("status", "approved").execute()

        timecards = []
        for tc in (timecards_result.data or []):
            # Check if already imported
            imported = execute_single(
                "SELECT 1 FROM backlot_invoice_line_items WHERE source_type = 'timecard' AND source_id = :id",
                {"id": tc["id"]}
            )
            if not imported:
                # Get totals from entries
                totals = execute_single(
                    """SELECT
                        COALESCE(SUM(hours_worked), 0) as total_hours,
                        COALESCE(SUM(overtime_hours), 0) as total_overtime,
                        MAX(rate_amount) as rate_amount,
                        MAX(rate_type) as rate_type
                    FROM backlot_timecard_entries WHERE timecard_id = :id""",
                    {"id": tc["id"]}
                )
                timecards.append({
                    "id": tc["id"],
                    "week_start_date": tc["week_start_date"],
                    "total_hours": float(totals["total_hours"] or 0),
                    "total_overtime": float(totals["total_overtime"] or 0),
                    "rate_amount": float(totals["rate_amount"]) if totals["rate_amount"] else None,
                    "rate_type": totals["rate_type"],
                })

        # Get approved kit rentals
        kit_rentals_result = client.table("backlot_kit_rentals").select(
            "id, kit_name, start_date, end_date, daily_rate, weekly_rate, status"
        ).eq("project_id", project_id).eq("user_id", user_id).eq("status", "approved").execute()

        kit_rentals = []
        for kr in (kit_rentals_result.data or []):
            imported = execute_single(
                "SELECT 1 FROM backlot_invoice_line_items WHERE source_type = 'kit_rental' AND source_id = :id",
                {"id": kr["id"]}
            )
            if not imported:
                # Calculate total
                start = datetime.strptime(kr["start_date"], "%Y-%m-%d") if kr["start_date"] else None
                end = datetime.strptime(kr["end_date"], "%Y-%m-%d") if kr["end_date"] else datetime.now()
                days = (end - start).days + 1 if start else 1
                daily_rate = float(kr["daily_rate"]) if kr["daily_rate"] else 0
                kit_rentals.append({
                    "id": kr["id"],
                    "kit_name": kr["kit_name"],
                    "start_date": kr["start_date"],
                    "end_date": kr["end_date"],
                    "daily_rate": daily_rate,
                    "total_amount": daily_rate * days,
                })

        # Get approved mileage
        mileage_result = client.table("backlot_mileage_entries").select(
            "id, date, description, miles, rate_per_mile, is_round_trip, status"
        ).eq("project_id", project_id).eq("user_id", user_id).eq("status", "approved").execute()

        mileage = []
        for m in (mileage_result.data or []):
            imported = execute_single(
                "SELECT 1 FROM backlot_invoice_line_items WHERE source_type = 'mileage' AND source_id = :id",
                {"id": m["id"]}
            )
            if not imported:
                # Calculate total from miles and rate
                miles = float(m.get("miles") or 0)
                rate = float(m.get("rate_per_mile") or 0.67)
                is_round_trip = m.get("is_round_trip", False)
                total = miles * rate * (2 if is_round_trip else 1)
                mileage.append({
                    "id": m["id"],
                    "date": m["date"],
                    "description": m["description"],
                    "total_amount": round(total, 2),
                })

        # Get approved per diem
        per_diem_result = client.table("backlot_per_diem").select(
            "id, date, meal_type, amount, status"
        ).eq("project_id", project_id).eq("user_id", user_id).eq("status", "approved").execute()

        per_diem = []
        for pd in (per_diem_result.data or []):
            imported = execute_single(
                "SELECT 1 FROM backlot_invoice_line_items WHERE source_type = 'per_diem' AND source_id = :id",
                {"id": pd["id"]}
            )
            if not imported:
                per_diem.append({
                    "id": pd["id"],
                    "date": pd["date"],
                    "meal_type": pd["meal_type"],
                    "amount": float(pd["amount"] or 0),
                })

        # Get approved receipts for reimbursement (receipts use created_by_user_id, not user_id)
        receipts_result = client.table("backlot_receipts").select(
            "id, description, amount, purchase_date, reimbursement_status"
        ).eq("project_id", project_id).eq("created_by_user_id", user_id).eq("reimbursement_status", "approved").execute()

        receipts = []
        for r in (receipts_result.data or []):
            imported = execute_single(
                "SELECT 1 FROM backlot_invoice_line_items WHERE source_type = 'receipt' AND source_id = :id",
                {"id": r["id"]}
            )
            if not imported:
                receipts.append({
                    "id": r["id"],
                    "description": r["description"],
                    "amount": float(r["amount"] or 0),
                    "purchase_date": r["purchase_date"],
                })

        logger.info(f"[Invoices] Returning importable data: {len(timecards)} timecards, {len(kit_rentals)} kit_rentals, {len(mileage)} mileage, {len(per_diem)} per_diem, {len(receipts)} receipts")
        return ImportableData(
            approved_timecards=timecards,
            approved_kit_rentals=kit_rentals,
            approved_mileage=mileage,
            approved_per_diem=per_diem,
            approved_receipts=receipts,
        )
    except HTTPException:
        raise
    except Exception as e:
        return handle_invoice_error(e, "get_importable_data")


# =============================================================================
# PENDING IMPORT COUNT ENDPOINT
# =============================================================================

@router.get("/projects/{project_id}/invoices/pending-import-count")
async def get_pending_import_count_endpoint(
    project_id: str,
    authorization: str = Header(None)
):
    """Get count of approved items not yet added to any invoice."""
    try:
        logger.info(f"[Invoices] get_pending_import_count called for project {project_id}")
        current_user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(current_user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        if not check_project_access(project_id, user_id):
            raise HTTPException(status_code=403, detail="Not a project member")

        from app.services.invoice_auto_sync import get_pending_import_count
        counts = get_pending_import_count(project_id, user_id)

        logger.info(f"[Invoices] Pending import count: {counts}")
        return counts
    except HTTPException:
        raise
    except Exception as e:
        return handle_invoice_error(e, "get_pending_import_count")


@router.get("/projects/{project_id}/invoices/{invoice_id}", response_model=InvoiceWithLineItems)
async def get_invoice(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Get single invoice with line items."""
    try:
        logger.info(f"[Invoices] get_invoice called for invoice {invoice_id}")
        current_user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(current_user["id"])
        if not user_id:
            logger.warning(f"[Invoices] User profile not found for cognito_id: {current_user['id']}")
            raise HTTPException(status_code=401, detail="User profile not found")

        client = get_client()

        # Get invoice
        result = client.table("backlot_invoices").select("*").eq("id", invoice_id).eq("project_id", project_id).execute()

        if not result.data:
            logger.warning(f"[Invoices] Invoice {invoice_id} not found in project {project_id}")
            raise HTTPException(status_code=404, detail="Invoice not found")

        invoice = result.data[0]

        # Check access - user owns invoice OR is admin
        if invoice["user_id"] != user_id and not check_project_admin(project_id, user_id):
            logger.warning(f"[Invoices] User {user_id} not authorized to view invoice {invoice_id}")
            raise HTTPException(status_code=403, detail="Not authorized to view this invoice")

        # Get line items
        items_result = client.table("backlot_invoice_line_items").select("*").eq("invoice_id", invoice_id).order("sort_order").execute()
        invoice["line_items"] = items_result.data if items_result.data else []

        # Get user info
        profile = get_user_profile(invoice["user_id"])
        if profile:
            invoice["user_name"] = profile["display_name"]

        logger.info(f"[Invoices] Returning invoice {invoice_id} with {len(invoice['line_items'])} line items")
        return invoice
    except HTTPException:
        raise
    except Exception as e:
        return handle_invoice_error(e, "get_invoice")


@router.post("/projects/{project_id}/invoices", response_model=Invoice)
async def create_invoice(
    project_id: str,
    request: CreateInvoiceRequest,
    authorization: str = Header(None)
):
    """Create a new invoice."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    if not check_project_access(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    client = get_client()

    # Generate invoice number if not provided
    invoice_number = request.invoice_number or generate_invoice_number(project_id)

    # Calculate due date if not provided
    due_date = request.due_date
    if not due_date and request.payment_terms:
        due_date = calculate_due_date(request.invoice_date, request.payment_terms)

    invoice_data = {
        "project_id": project_id,
        "user_id": user_id,
        "invoice_number": invoice_number,
        "invoice_date": request.invoice_date,
        "due_date": due_date,
        "invoicer_name": request.invoicer_name,
        "invoicer_email": request.invoicer_email,
        "invoicer_phone": request.invoicer_phone,
        "invoicer_address": request.invoicer_address,
        "bill_to_name": request.bill_to_name,
        "bill_to_company": request.bill_to_company,
        "bill_to_address": request.bill_to_address,
        "bill_to_email": request.bill_to_email,
        "position_role": request.position_role,
        "production_title": request.production_title,
        "date_range_start": request.date_range_start,
        "date_range_end": request.date_range_end,
        "po_number": request.po_number,
        "payment_terms": request.payment_terms,
        "payment_terms_custom": request.payment_terms_custom,
        "payment_method": request.payment_method,
        "payment_details": request.payment_details,
        "tax_rate": request.tax_rate or 0,
        "discount_amount": request.discount_amount or 0,
        "notes": request.notes,
        "status": "draft",
    }

    result = client.table("backlot_invoices").insert(invoice_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invoice")

    return result.data[0]


@router.put("/projects/{project_id}/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(
    project_id: str,
    invoice_id: str,
    request: UpdateInvoiceRequest,
    authorization: str = Header(None)
):
    """Update an invoice (only drafts can be fully edited)."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Get existing invoice
    existing = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Check ownership
    if existing["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this invoice")

    # Only draft, changes_requested, and sent can be edited
    if existing["status"] not in ["draft", "changes_requested", "sent"]:
        raise HTTPException(status_code=400, detail=f"Cannot edit invoice with status '{existing['status']}'")

    # Build update data
    update_data = {"updated_at": datetime.utcnow().isoformat()}

    for field in [
        "invoice_date", "due_date", "invoicer_name", "invoicer_email", "invoicer_phone",
        "invoicer_address", "bill_to_name", "bill_to_company", "bill_to_address",
        "bill_to_email", "position_role", "production_title", "date_range_start",
        "date_range_end", "po_number", "payment_terms", "payment_terms_custom",
        "payment_method", "payment_details", "tax_rate", "discount_amount", "notes", "internal_notes"
    ]:
        value = getattr(request, field)
        if value is not None:
            update_data[field] = value

    result = client.table("backlot_invoices").update(update_data).eq("id", invoice_id).execute()

    # Recalculate totals if tax or discount changed
    if request.tax_rate is not None or request.discount_amount is not None:
        recalculate_invoice_totals(invoice_id)
        # Refetch
        result = client.table("backlot_invoices").select("*").eq("id", invoice_id).execute()

    return result.data[0]


@router.delete("/projects/{project_id}/invoices/{invoice_id}")
async def delete_invoice(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Delete a draft invoice."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Get existing invoice
    existing = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Check ownership
    if existing["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this invoice")

    # Only drafts can be deleted
    if existing["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be deleted")

    client.table("backlot_invoices").delete().eq("id", invoice_id).execute()

    return {"success": True}


# =============================================================================
# LINE ITEM ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/invoices/{invoice_id}/line-items", response_model=InvoiceLineItem)
async def add_line_item(
    project_id: str,
    invoice_id: str,
    request: CreateLineItemRequest,
    authorization: str = Header(None)
):
    """Add a line item to an invoice."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Verify invoice exists and user owns it
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this invoice")

    if invoice["status"] not in ["draft", "changes_requested", "sent"]:
        raise HTTPException(status_code=400, detail="Cannot add items to this invoice")

    # Get next sort order
    max_order = execute_single(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM backlot_invoice_line_items WHERE invoice_id = :id",
        {"id": invoice_id}
    )

    # Calculate line total
    quantity = request.quantity or 1
    line_total = round(request.rate_amount * quantity, 2)

    item_data = {
        "invoice_id": invoice_id,
        "description": request.description,
        "rate_type": request.rate_type or "flat",
        "rate_amount": request.rate_amount,
        "quantity": quantity,
        "units": request.units,
        "line_total": line_total,
        "source_type": request.source_type,
        "source_id": request.source_id,
        "service_date_start": request.service_date_start,
        "service_date_end": request.service_date_end,
        "sort_order": max_order["next_order"] if max_order else 0,
    }

    result = client.table("backlot_invoice_line_items").insert(item_data).execute()

    # Recalculate invoice totals
    recalculate_invoice_totals(invoice_id)

    return result.data[0]


@router.put("/projects/{project_id}/invoices/{invoice_id}/line-items/{item_id}", response_model=InvoiceLineItem)
async def update_line_item(
    project_id: str,
    invoice_id: str,
    item_id: str,
    request: UpdateLineItemRequest,
    authorization: str = Header(None)
):
    """Update a line item."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Verify invoice ownership
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this invoice")

    # Get existing item
    existing = execute_single(
        "SELECT * FROM backlot_invoice_line_items WHERE id = :id AND invoice_id = :invoice_id",
        {"id": item_id, "invoice_id": invoice_id}
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Line item not found")

    # Build update
    update_data = {"updated_at": datetime.utcnow().isoformat()}

    for field in ["description", "rate_type", "rate_amount", "quantity", "units", "service_date_start", "service_date_end"]:
        value = getattr(request, field)
        if value is not None:
            update_data[field] = value

    # Recalculate line total if rate or quantity changed
    rate = update_data.get("rate_amount", existing["rate_amount"])
    qty = update_data.get("quantity", existing["quantity"])
    update_data["line_total"] = round(float(rate) * float(qty), 2)

    result = client.table("backlot_invoice_line_items").update(update_data).eq("id", item_id).execute()

    # Recalculate invoice totals
    recalculate_invoice_totals(invoice_id)

    return result.data[0]


@router.delete("/projects/{project_id}/invoices/{invoice_id}/line-items/{item_id}")
async def delete_line_item(
    project_id: str,
    invoice_id: str,
    item_id: str,
    authorization: str = Header(None)
):
    """Delete a line item."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Verify invoice ownership
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this invoice")

    client.table("backlot_invoice_line_items").delete().eq("id", item_id).execute()

    # Recalculate invoice totals
    recalculate_invoice_totals(invoice_id)

    return {"success": True}


# =============================================================================
# STATUS ACTIONS
# =============================================================================

@router.post("/projects/{project_id}/invoices/{invoice_id}/send")
async def send_invoice(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Mark invoice as sent."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if invoice["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be sent")

    # Check has at least one line item
    count = execute_single(
        "SELECT COUNT(*) as cnt FROM backlot_invoice_line_items WHERE invoice_id = :id",
        {"id": invoice_id}
    )

    if not count or count["cnt"] == 0:
        raise HTTPException(status_code=400, detail="Invoice must have at least one line item")

    client.table("backlot_invoices").update({
        "status": "sent",
        "sent_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "sent"}


@router.post("/projects/{project_id}/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    project_id: str,
    invoice_id: str,
    request: MarkPaidRequest,
    authorization: str = Header(None)
):
    """Mark invoice as paid (managers only)."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    if not check_project_admin(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to mark invoices as paid")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["status"] not in ["approved", "sent", "overdue"]:
        raise HTTPException(status_code=400, detail="Only approved, sent, or overdue invoices can be marked as paid")

    paid_amount = request.paid_amount if request.paid_amount else invoice["total_amount"]

    client.table("backlot_invoices").update({
        "status": "paid",
        "paid_at": datetime.utcnow().isoformat(),
        "paid_amount": paid_amount,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "paid"}


@router.post("/projects/{project_id}/invoices/{invoice_id}/cancel")
async def cancel_invoice(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Cancel an invoice."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Owner can cancel their own, admin can cancel any
    if invoice["user_id"] != user_id and not check_project_admin(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if invoice["status"] == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a paid invoice")

    client.table("backlot_invoices").update({
        "status": "cancelled",
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "cancelled"}


# =============================================================================
# APPROVAL WORKFLOW ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/invoices/{invoice_id}/submit-for-approval")
async def submit_for_approval(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Submit invoice to project managers for approval."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Can submit from draft or changes_requested
    if invoice["status"] not in ["draft", "changes_requested"]:
        raise HTTPException(status_code=400, detail=f"Cannot submit invoice with status '{invoice['status']}'")

    # Check has at least one line item
    count = execute_single(
        "SELECT COUNT(*) as cnt FROM backlot_invoice_line_items WHERE invoice_id = :id",
        {"id": invoice_id}
    )

    if not count or count["cnt"] == 0:
        raise HTTPException(status_code=400, detail="Invoice must have at least one line item")

    client.table("backlot_invoices").update({
        "status": "pending_approval",
        "submitted_for_approval_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "pending_approval"}


@router.post("/projects/{project_id}/invoices/{invoice_id}/approve")
async def approve_invoice(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Approve an invoice (managers only)."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    if not check_project_admin(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to approve invoices")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Only pending approval invoices can be approved")

    client.table("backlot_invoices").update({
        "status": "approved",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": user_id,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "approved"}


@router.post("/projects/{project_id}/invoices/{invoice_id}/request-changes")
async def request_changes(
    project_id: str,
    invoice_id: str,
    request: RequestChangesRequest,
    authorization: str = Header(None)
):
    """Request changes to an invoice (managers only)."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    if not check_project_admin(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to request changes")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail="Can only request changes for pending approval invoices")

    client.table("backlot_invoices").update({
        "status": "changes_requested",
        "changes_requested_at": datetime.utcnow().isoformat(),
        "changes_requested_by": user_id,
        "change_request_reason": request.reason,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "changes_requested"}


@router.post("/projects/{project_id}/invoices/{invoice_id}/mark-sent")
async def mark_invoice_sent(
    project_id: str,
    invoice_id: str,
    authorization: str = Header(None)
):
    """Mark invoice as sent externally (after approval)."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    # Get invoice
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if invoice["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved invoices can be marked as sent")

    client.table("backlot_invoices").update({
        "status": "sent",
        "sent_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()

    return {"success": True, "status": "sent"}


# =============================================================================
# DATA IMPORT ENDPOINTS
# =============================================================================

@router.post("/projects/{project_id}/invoices/{invoice_id}/import-timecards")
async def import_timecards(
    project_id: str,
    invoice_id: str,
    request: ImportTimecardsRequest,
    authorization: str = Header(None)
):
    """Import approved timecards as line items."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    # Verify invoice ownership
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    client = get_client()
    imported_count = 0

    for tc_id in request.timecard_ids:
        # Get timecard
        tc = execute_single(
            "SELECT * FROM backlot_timecards WHERE id = :id AND project_id = :project_id AND user_id = :user_id AND status = 'approved'",
            {"id": tc_id, "project_id": project_id, "user_id": user_id}
        )

        if not tc:
            continue

        # Get totals
        totals = execute_single(
            """SELECT
                COALESCE(SUM(hours_worked), 0) as total_hours,
                MAX(rate_amount) as rate_amount,
                MAX(rate_type) as rate_type,
                MIN(shoot_date) as start_date,
                MAX(shoot_date) as end_date
            FROM backlot_timecard_entries WHERE timecard_id = :id""",
            {"id": tc_id}
        )

        if not totals or not totals["total_hours"]:
            continue

        # Create line item
        rate = float(totals["rate_amount"]) if totals["rate_amount"] else 0
        hours = float(totals["total_hours"])

        item_data = {
            "invoice_id": invoice_id,
            "description": f"Labor - Week of {tc['week_start_date']}",
            "rate_type": totals["rate_type"] or "hourly",
            "rate_amount": rate,
            "quantity": hours,
            "units": "hours",
            "line_total": round(rate * hours, 2),
            "source_type": "timecard",
            "source_id": tc_id,
            "service_date_start": totals["start_date"],
            "service_date_end": totals["end_date"],
            "sort_order": imported_count,
        }

        client.table("backlot_invoice_line_items").insert(item_data).execute()
        imported_count += 1

    # Recalculate totals
    recalculate_invoice_totals(invoice_id)

    return {"success": True, "imported_count": imported_count}


@router.post("/projects/{project_id}/invoices/{invoice_id}/import-expenses")
async def import_expenses(
    project_id: str,
    invoice_id: str,
    request: ImportExpensesRequest,
    authorization: str = Header(None)
):
    """Import approved expenses as line items."""
    current_user = await get_current_user_from_token(authorization)
    user_id = get_profile_id_from_cognito_id(current_user["id"])
    if not user_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    # Verify invoice ownership
    invoice = execute_single(
        "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
        {"id": invoice_id, "project_id": project_id}
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    client = get_client()
    imported_count = 0

    # Import kit rentals
    for kr_id in (request.kit_rental_ids or []):
        kr = execute_single(
            "SELECT * FROM backlot_kit_rentals WHERE id = :id AND project_id = :project_id AND user_id = :user_id AND status = 'approved'",
            {"id": kr_id, "project_id": project_id, "user_id": user_id}
        )

        if kr:
            start = datetime.strptime(kr["start_date"], "%Y-%m-%d") if kr["start_date"] else None
            end = datetime.strptime(kr["end_date"], "%Y-%m-%d") if kr["end_date"] else datetime.now()
            days = (end - start).days + 1 if start else 1
            daily_rate = float(kr["daily_rate"]) if kr["daily_rate"] else 0

            item_data = {
                "invoice_id": invoice_id,
                "description": f"Kit Rental - {kr['kit_name']}",
                "rate_type": "daily",
                "rate_amount": daily_rate,
                "quantity": days,
                "units": "days",
                "line_total": round(daily_rate * days, 2),
                "source_type": "kit_rental",
                "source_id": kr_id,
                "service_date_start": kr["start_date"],
                "service_date_end": kr["end_date"],
            }

            client.table("backlot_invoice_line_items").insert(item_data).execute()
            imported_count += 1

    # Import mileage
    for m_id in (request.mileage_ids or []):
        m = execute_single(
            "SELECT * FROM backlot_mileage_entries WHERE id = :id AND project_id = :project_id AND user_id = :user_id AND status = 'approved'",
            {"id": m_id, "project_id": project_id, "user_id": user_id}
        )

        if m:
            # Calculate total from miles and rate
            miles = float(m.get("miles") or 0)
            rate = float(m.get("rate_per_mile") or 0.67)
            is_round_trip = m.get("is_round_trip", False)
            amount = round(miles * rate * (2 if is_round_trip else 1), 2)

            item_data = {
                "invoice_id": invoice_id,
                "description": f"Mileage - {m.get('description') or m['date']}",
                "rate_type": "flat",
                "rate_amount": amount,
                "quantity": 1,
                "line_total": amount,
                "source_type": "mileage",
                "source_id": m_id,
                "service_date_start": m["date"],
            }

            client.table("backlot_invoice_line_items").insert(item_data).execute()
            imported_count += 1

    # Import per diem
    for pd_id in (request.per_diem_ids or []):
        pd = execute_single(
            "SELECT * FROM backlot_per_diem WHERE id = :id AND project_id = :project_id AND user_id = :user_id AND status = 'approved'",
            {"id": pd_id, "project_id": project_id, "user_id": user_id}
        )

        if pd:
            amount = float(pd["amount"]) if pd["amount"] else 0

            item_data = {
                "invoice_id": invoice_id,
                "description": f"Per Diem - {pd['meal_type']} ({pd['date']})",
                "rate_type": "flat",
                "rate_amount": amount,
                "quantity": 1,
                "line_total": amount,
                "source_type": "per_diem",
                "source_id": pd_id,
                "service_date_start": pd["date"],
            }

            client.table("backlot_invoice_line_items").insert(item_data).execute()
            imported_count += 1

    # Import receipts (receipts use created_by_user_id, not user_id)
    for r_id in (request.receipt_ids or []):
        r = execute_single(
            "SELECT * FROM backlot_receipts WHERE id = :id AND project_id = :project_id AND created_by_user_id = :user_id AND reimbursement_status = 'approved'",
            {"id": r_id, "project_id": project_id, "user_id": user_id}
        )

        if r:
            amount = float(r["amount"]) if r["amount"] else 0

            item_data = {
                "invoice_id": invoice_id,
                "description": f"Reimbursement - {r['description'] or 'Receipt'}",
                "rate_type": "flat",
                "rate_amount": amount,
                "quantity": 1,
                "line_total": amount,
                "source_type": "receipt",
                "source_id": r_id,
                "service_date_start": r["purchase_date"],
            }

            client.table("backlot_invoice_line_items").insert(item_data).execute()
            imported_count += 1

    # Recalculate totals
    recalculate_invoice_totals(invoice_id)

    return {"success": True, "imported_count": imported_count}


# =============================================================================
# UNLINK LINE ITEM ENDPOINT
# =============================================================================

@router.delete("/projects/{project_id}/invoices/{invoice_id}/line-items/{item_id}/unlink")
async def unlink_line_item(
    project_id: str,
    invoice_id: str,
    item_id: str,
    authorization: str = Header(None)
):
    """
    Remove a line item from an invoice and make the source item
    available for re-import to a different invoice.
    """
    try:
        logger.info(f"[Invoices] unlink_line_item called for item {item_id} on invoice {invoice_id}")
        current_user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(current_user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        client = get_client()

        # Verify invoice ownership
        invoice = execute_single(
            "SELECT * FROM backlot_invoices WHERE id = :id AND project_id = :project_id",
            {"id": invoice_id, "project_id": project_id}
        )

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        if invoice["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this invoice")

        # Only editable statuses
        if invoice["status"] not in ["draft", "changes_requested"]:
            raise HTTPException(status_code=400, detail="Cannot modify this invoice")

        # Get the line item
        item = execute_single(
            "SELECT * FROM backlot_invoice_line_items WHERE id = :id AND invoice_id = :invoice_id",
            {"id": item_id, "invoice_id": invoice_id}
        )

        if not item:
            raise HTTPException(status_code=404, detail="Line item not found")

        source_type = item.get("source_type")
        source_id = item.get("source_id")

        # Delete the line item
        client.table("backlot_invoice_line_items").delete().eq("id", item_id).execute()

        # Recalculate invoice totals
        recalculate_invoice_totals(invoice_id)

        logger.info(f"[Invoices] Unlinked item {item_id} from invoice {invoice_id}, source: {source_type}/{source_id}")

        return {
            "success": True,
            "source_type": source_type,
            "source_id": source_id,
            "message": "Item removed and available for re-import"
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_invoice_error(e, "unlink_line_item")
