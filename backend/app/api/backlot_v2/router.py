"""
Backlot API Router v2

Main router aggregating all backlot submodules.
This will eventually replace the monolithic backlot.py.
"""
from fastapi import APIRouter

router = APIRouter()

# Sub-routers - uncomment as they are implemented
# from app.api.backlot_v2.projects import router as projects_router
# from app.api.backlot_v2.scheduling import router as scheduling_router
# from app.api.backlot_v2.casting import router as casting_router
# from app.api.backlot_v2.budget import router as budget_router
# from app.api.backlot_v2.dailies import router as dailies_router
# from app.api.backlot_v2.clearances import router as clearances_router
# from app.api.backlot_v2.assets import router as assets_router

# Include sub-routers with prefixes
# router.include_router(projects_router, prefix="/projects", tags=["Backlot - Projects"])
# router.include_router(scheduling_router, prefix="/scheduling", tags=["Backlot - Scheduling"])
# router.include_router(casting_router, prefix="/casting", tags=["Backlot - Casting"])
# router.include_router(budget_router, prefix="/budget", tags=["Backlot - Budget"])
# router.include_router(dailies_router, prefix="/dailies", tags=["Backlot - Dailies"])
# router.include_router(clearances_router, prefix="/clearances", tags=["Backlot - Clearances"])
# router.include_router(assets_router, prefix="/assets", tags=["Backlot - Assets"])
