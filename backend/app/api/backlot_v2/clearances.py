"""
Backlot Clearances API

Rights, releases, and legal clearances.

Endpoints:
- GET /projects/{project_id}/clearances - List clearances
- POST /projects/{project_id}/clearances - Create clearance
- PATCH /clearances/{clearance_id} - Update clearance
- POST /clearances/{clearance_id}/request - Send clearance request
- POST /clearances/{clearance_id}/upload - Upload signed document
- GET /projects/{project_id}/releases - List talent releases
- POST /projects/{project_id}/releases - Create release
"""
from fastapi import APIRouter

from app.core.enums import ClearanceStatus

router = APIRouter()

# TODO: Migrate from backlot.py:
# - list_clearances()
# - create_clearance()
# - update_clearance()
# - send_clearance_request()
# - upload_clearance_doc()
# - list_releases()
# - create_release()
