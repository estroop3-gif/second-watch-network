"""
Worlds Episodes API

Endpoints for episode/content playback and management.

Endpoints:
- GET /worlds/{world_slug}/seasons - List seasons
- GET /worlds/{world_slug}/episodes - List episodes
- GET /worlds/{world_slug}/episodes/{episode_id} - Get episode
- GET /worlds/{world_slug}/episodes/{episode_id}/playback - Get playback data
- POST /worlds/{world_slug}/seasons (creator) - Create season
- POST /worlds/{world_slug}/episodes (creator) - Create episode
"""
from fastapi import APIRouter

router = APIRouter()

# TODO: Migrate episode endpoints from worlds_legacy.py
# - list_seasons()
# - get_season()
# - list_episodes()
# - get_episode()
# - get_episode_playback()
