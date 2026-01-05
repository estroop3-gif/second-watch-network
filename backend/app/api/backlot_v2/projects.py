"""
Backlot Projects API

Core project management endpoints.

Endpoints:
- GET /projects - List user's projects
- POST /projects - Create project
- GET /projects/{project_id} - Get project details
- PATCH /projects/{project_id} - Update project
- DELETE /projects/{project_id} - Archive project
- POST /projects/{project_id}/status - Update project status
- GET /projects/{project_id}/team - List team members
- POST /projects/{project_id}/team - Add team member
- DELETE /projects/{project_id}/team/{user_id} - Remove team member
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.core.permissions import Permission, require_permissions
from app.core.enums import ProjectStatus

router = APIRouter()

# TODO: Migrate from backlot.py:
# - get_projects()
# - create_project()
# - get_project()
# - update_project()
# - archive_project()
# - get_project_team()
# - add_team_member()
# - remove_team_member()
