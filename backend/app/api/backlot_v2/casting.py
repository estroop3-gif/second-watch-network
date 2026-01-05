"""
Backlot Casting API

Casting, auditions, and crew management.

Endpoints:
- GET /projects/{project_id}/roles - List casting roles
- POST /projects/{project_id}/roles - Create role
- GET /projects/{project_id}/applications - List applications
- POST /roles/{role_id}/apply - Apply for role
- PATCH /applications/{app_id}/status - Update application status
- GET /projects/{project_id}/crew - List crew assignments
- POST /projects/{project_id}/crew - Add crew member
- GET /my/casting-summary - Dashboard widget aggregation
"""
from fastapi import APIRouter

from app.core.enums import CastingStatus

router = APIRouter()

# TODO: Migrate from backlot.py:
# - list_roles()
# - create_role()
# - list_applications()
# - apply_for_role()
# - update_application()
# - list_crew()
# - add_crew()
# - get_casting_summary() (for dashboard widget)
