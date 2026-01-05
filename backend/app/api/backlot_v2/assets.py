"""
Backlot Assets API

Production asset management - props, wardrobe, locations, vehicles.

Endpoints:
- GET /projects/{project_id}/locations - List locations
- POST /projects/{project_id}/locations - Add location
- GET /projects/{project_id}/props - List props
- POST /projects/{project_id}/props - Add prop
- GET /projects/{project_id}/wardrobe - List wardrobe items
- POST /projects/{project_id}/wardrobe - Add wardrobe item
- GET /projects/{project_id}/vehicles - List vehicles
- POST /projects/{project_id}/vehicles - Add vehicle
- GET /projects/{project_id}/gear - List gear/equipment
- POST /projects/{project_id}/gear - Add gear
"""
from fastapi import APIRouter

router = APIRouter()

# TODO: Migrate from backlot.py:
# - list_locations()
# - create_location()
# - list_props()
# - create_prop()
# - list_wardrobe()
# - create_wardrobe_item()
# - list_vehicles()
# - create_vehicle()
# - list_gear()
# - create_gear()
