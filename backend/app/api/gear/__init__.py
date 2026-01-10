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
from .rentals import router as rentals_router
from .verification import router as verification_router
from .checkin import router as checkin_router
from .marketplace import router as marketplace_router
from .quotes import router as quotes_router
from .payments import router as payments_router
from .reputation import router as reputation_router
from .shipping import router as shipping_router
from .sales import router as sales_router
from .personal import router as personal_router
from .work_orders import router as work_orders_router
from .purchase_requests import router as purchase_requests_router

router = APIRouter(tags=["Gear House"])

# Include all sub-routers
router.include_router(organizations_router)
router.include_router(assets_router)
router.include_router(kits_router)
router.include_router(transactions_router)
router.include_router(incidents_router)
router.include_router(repairs_router)
router.include_router(strikes_router)
router.include_router(labels_router)
router.include_router(rentals_router)
router.include_router(verification_router)
router.include_router(checkin_router)
router.include_router(marketplace_router)
router.include_router(quotes_router)
router.include_router(payments_router)
router.include_router(reputation_router)
router.include_router(shipping_router)
router.include_router(sales_router)
router.include_router(personal_router)
router.include_router(work_orders_router)
router.include_router(purchase_requests_router)
