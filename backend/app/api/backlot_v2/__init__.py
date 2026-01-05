"""
Backlot API Module v2 - Production Management System

This module handles all production management operations:
- Projects: CRUD, access control, status management
- Scheduling: Shoot days, call sheets, availability
- Casting: Roles, auditions, crew assignments
- Budget: Line items, expenses, invoices
- Dailies: Media upload, review, circle takes
- Clearances: Rights, releases, contracts
- Assets: Props, wardrobe, locations, vehicles

Module Structure:
- router.py: Main aggregating router
- projects.py: Project CRUD and access
- scheduling.py: Shoot days, call sheets
- casting.py: Casting and crew
- budget.py: Financial management
- dailies.py: Media and dailies
- clearances.py: Rights and releases
- assets.py: Production assets

Note: This is the v2 modular structure. The monolithic backlot.py
will be gradually migrated here.
"""
# Router will be exposed once migration begins
# from app.api.backlot_v2.router import router

__all__ = []
