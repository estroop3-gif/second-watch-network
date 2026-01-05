"""
Backlot Scheduling API

Shoot day and call sheet management.

Endpoints:
- GET /projects/{project_id}/shoot-days - List shoot days
- POST /projects/{project_id}/shoot-days - Create shoot day
- PATCH /shoot-days/{day_id} - Update shoot day
- DELETE /shoot-days/{day_id} - Delete shoot day
- GET /projects/{project_id}/call-sheets - List call sheets
- POST /projects/{project_id}/call-sheets - Create call sheet
- PATCH /call-sheets/{sheet_id} - Update call sheet
- POST /call-sheets/{sheet_id}/send - Send call sheet
- GET /my/schedule-summary - Dashboard widget aggregation
"""
from fastapi import APIRouter

from app.core.enums import ShootDayStatus, CallSheetStatus

router = APIRouter()

# TODO: Migrate from backlot.py:
# - list_shoot_days()
# - create_shoot_day()
# - update_shoot_day()
# - list_call_sheets()
# - create_call_sheet()
# - send_call_sheet()
# - get_schedule_summary() (for dashboard widget)
