"""
Gear House API Router

Main router aggregating all Gear House endpoints.
This is the entry point for /api/v1/gear/ routes.
"""
from fastapi import APIRouter

from .organizations import router as organizations_router
from .assets import router as assets_router
from .kits import router as kits_router
from .transactions import router as transactions_router
from .incidents import router as incidents_router
from .repairs import router as repairs_router
from .strikes import router as strikes_router
from .labels import router as labels_router

router = APIRouter(prefix="/gear", tags=["Gear House"])

# Include all sub-routers
router.include_router(organizations_router)
router.include_router(assets_router)
router.include_router(kits_router)
router.include_router(transactions_router)
router.include_router(incidents_router)
router.include_router(repairs_router)
router.include_router(strikes_router)
router.include_router(labels_router)
