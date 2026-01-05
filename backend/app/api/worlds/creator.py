"""
Worlds Creator API

Endpoints for creators to manage their Worlds.
All endpoints require authentication and appropriate permissions.

Endpoints:
- POST /worlds/ - Create new world
- PATCH /worlds/{world_slug} - Update world
- DELETE /worlds/{world_slug} - Delete world
- POST /worlds/{world_slug}/publish - Publish world
- GET /worlds/my/worlds - Creator's worlds
- GET /worlds/{world_slug}/analytics - World analytics
"""
from fastapi import APIRouter

router = APIRouter()

# TODO: Migrate creator endpoints from worlds_legacy.py
# - create_world()
# - update_world()
# - delete_world()
# - publish_world()
# - get_my_worlds()
# - get_world_analytics()
