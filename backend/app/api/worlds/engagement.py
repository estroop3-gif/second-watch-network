"""
Worlds Engagement API

Endpoints for user engagement with Worlds - follows, ratings, watchlist.
All endpoints require authentication.

Endpoints:
- POST /worlds/{world_slug}/follow - Follow world
- DELETE /worlds/{world_slug}/follow - Unfollow world
- GET /worlds/my/following - List followed worlds
- POST /worlds/{world_slug}/rate - Rate world
- GET /worlds/{world_slug}/watchlist - Check watchlist status
- POST /worlds/{world_slug}/watchlist - Add to watchlist
- DELETE /worlds/{world_slug}/watchlist - Remove from watchlist
- GET /worlds/my/watchlist - User's watchlist
- POST /episodes/{episode_id}/progress - Update watch progress
- GET /my/continue-watching - Continue watching list
"""
from fastapi import APIRouter

router = APIRouter()

# TODO: Migrate engagement endpoints from worlds_legacy.py
# - follow_world()
# - unfollow_world()
# - list_following()
# - rate_world()
# - add_to_watchlist()
# - remove_from_watchlist()
# - update_watch_progress()
# - get_continue_watching()
