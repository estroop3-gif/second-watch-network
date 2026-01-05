"""
Backlot Budget API

Financial management - budgets, expenses, invoices.

Endpoints:
- GET /projects/{project_id}/budget - Get budget overview
- PATCH /projects/{project_id}/budget - Update budget
- GET /projects/{project_id}/line-items - List budget line items
- POST /projects/{project_id}/line-items - Create line item
- GET /projects/{project_id}/expenses - List expenses
- POST /projects/{project_id}/expenses - Submit expense
- PATCH /expenses/{expense_id}/status - Approve/reject expense
- GET /projects/{project_id}/invoices - List invoices
- POST /projects/{project_id}/invoices - Create invoice
- POST /invoices/{invoice_id}/send - Send invoice
- GET /my/budget-summary - Dashboard widget aggregation
"""
from fastapi import APIRouter

from app.core.enums import InvoiceStatus, ExpenseStatus

router = APIRouter()

# TODO: Migrate from backlot.py + invoices.py + expenses.py:
# - get_budget()
# - update_budget()
# - list_expenses()
# - submit_expense()
# - approve_expense()
# - list_invoices()
# - create_invoice()
# - send_invoice()
# - get_budget_summary() (for dashboard widget)
