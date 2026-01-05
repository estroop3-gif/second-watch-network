"""
Worlds API Module - Consumer Streaming Platform

This module handles all consumer-facing content operations:
- Worlds (creator channels/shows)
- Seasons & Episodes
- Following & Watchlist
- Watch History & Progress
- Ratings & Reviews

Structure:
- router.py: Main APIRouter with all routes
- discovery.py: Public browsing/search endpoints
- episodes.py: Episode CRUD and playback
- engagement.py: Follows, ratings, watchlist
- creator.py: Creator management endpoints
"""
from app.api.worlds.router import router

__all__ = ["router"]
