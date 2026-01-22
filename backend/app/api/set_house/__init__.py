"""
Set House API Router

Main router aggregating all Set House endpoints.
This is the entry point for /api/v1/set-house/ routes.
"""
from fastapi import APIRouter

from .organizations import router as organizations_router
from .spaces import router as spaces_router
from .packages import router as packages_router
from .transactions import router as transactions_router
from .incidents import router as incidents_router
from .repairs import router as repairs_router
from .strikes import router as strikes_router
from .marketplace import router as marketplace_router
from .work_orders import router as work_orders_router
from .cart import router as cart_router
from .verification import router as verification_router
from .external_platforms import router as external_platforms_router

router = APIRouter(tags=["Set House"])

# Include all sub-routers
router.include_router(organizations_router)
router.include_router(spaces_router)
router.include_router(packages_router)
router.include_router(transactions_router)
router.include_router(incidents_router)
router.include_router(repairs_router)
router.include_router(strikes_router)
router.include_router(marketplace_router)
router.include_router(work_orders_router)
router.include_router(cart_router)
router.include_router(verification_router)
router.include_router(external_platforms_router)
