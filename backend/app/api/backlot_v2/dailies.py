"""
Backlot Dailies API

Media upload, review, and dailies management.

Endpoints:
- GET /projects/{project_id}/dailies - List dailies
- POST /projects/{project_id}/dailies - Upload daily
- GET /dailies/{daily_id} - Get daily details
- POST /dailies/{daily_id}/review - Add review/notes
- POST /dailies/{daily_id}/circle - Mark as circle take
- GET /projects/{project_id}/circle-takes - List circle takes
- GET /my/dailies-summary - Dashboard widget aggregation
"""
from fastapi import APIRouter

from app.core.enums import MediaStatus

router = APIRouter()

# TODO: Migrate from backlot.py:
# - list_dailies()
# - upload_daily()
# - get_daily()
# - add_review()
# - mark_circle_take()
# - list_circle_takes()
# - get_dailies_summary() (for dashboard widget)
