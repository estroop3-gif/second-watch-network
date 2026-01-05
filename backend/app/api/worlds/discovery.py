"""
Worlds Discovery API

Public endpoints for browsing, searching, and discovering Worlds.
These endpoints are mostly unauthenticated or optionally authenticated.

Endpoints:
- GET /worlds/ - List/search public worlds
- GET /worlds/{slug} - Get world details
- GET /worlds/featured - Featured worlds
- GET /worlds/trending - Trending worlds
- GET /worlds/genres - List genres
"""
from fastapi import APIRouter

router = APIRouter()

# TODO: Migrate discovery endpoints from worlds_legacy.py
# - list_worlds()
# - get_world()
# - list_genres()
# - get_featured_worlds()
# - get_trending_worlds()
