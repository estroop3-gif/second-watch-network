"""
Worlds API Router

Main router that aggregates all world-related endpoints.
Currently a thin wrapper - routes will be migrated from legacy worlds.py incrementally.
"""
from fastapi import APIRouter

# Create the main router
router = APIRouter()

# Import sub-routers as they are created
# from app.api.worlds.discovery import router as discovery_router
# from app.api.worlds.episodes import router as episodes_router
# from app.api.worlds.engagement import router as engagement_router
# from app.api.worlds.creator import router as creator_router

# Include sub-routers
# router.include_router(discovery_router, tags=["Worlds - Discovery"])
# router.include_router(episodes_router, tags=["Worlds - Episodes"])
# router.include_router(engagement_router, tags=["Worlds - Engagement"])
# router.include_router(creator_router, tags=["Worlds - Creator"])

# NOTE: For now, import routes from legacy module
# These will be migrated to submodules incrementally
from app.api.worlds_legacy import router as legacy_router

# Copy all routes from legacy router
for route in legacy_router.routes:
    router.routes.append(route)
