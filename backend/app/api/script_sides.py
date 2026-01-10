"""
Script Sides API Endpoints
Handles script documents, scene parsing, and sides packet generation
Script Sides Auto Generator for printable production day packets
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import csv
import io
import re
import json

from app.core.database import get_client, execute_query, execute_single

router = APIRouter()


# =====================================================
# Pydantic Models
# =====================================================

class ScriptDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1)
    format: str = Field(default='FOUNTAIN')  # FOUNTAIN or PLAIN
    raw_text: str = Field(..., min_length=1)


class ScriptDocumentUpdate(BaseModel):
    title: Optional[str] = None
    raw_text: Optional[str] = None


class SidesPacketCreate(BaseModel):
    production_day_id: str
    title: str = Field(..., min_length=1)
    episode_id: Optional[str] = None
    notes: Optional[str] = None
    mode: str = Field(default='MANUAL')  # AUTO or MANUAL


class SidesPacketUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # DRAFT or PUBLISHED


class PacketSceneCreate(BaseModel):
    script_scene_id: str


class PacketSceneUpdate(BaseModel):
    scene_notes: Optional[str] = None


class PacketSceneReorder(BaseModel):
    packet_scene_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


class ScheduleDaySceneCreate(BaseModel):
    script_scene_id: str


# =====================================================
# Fountain Parser
# =====================================================

def parse_fountain_script(raw_text: str) -> List[Dict[str, Any]]:
    """
    Parse Fountain-formatted script text into scenes.
    Scene headings start with INT. or EXT. or INT/EXT. (case insensitive)
    Collects character names from dialogue lines (ALL CAPS lines).
    """
    scenes = []
    lines = raw_text.split('\n')

    # Pattern for scene headings
    scene_heading_pattern = re.compile(
        r'^(INT\.|EXT\.|INT/EXT\.|I/E\.|INT |EXT )',
        re.IGNORECASE
    )

    # Pattern for character names (ALL CAPS, may have parentheticals)
    character_pattern = re.compile(r'^([A-Z][A-Z0-9\s\-\'\.]+)(?:\s*\([^)]*\))?$')

    current_scene = None
    current_scene_lines = []
    scene_number = 0

    def finalize_scene():
        nonlocal current_scene, current_scene_lines, scenes
        if current_scene:
            raw_scene_text = '\n'.join(current_scene_lines).strip()
            current_scene['raw_scene_text'] = raw_scene_text

            # Extract characters from dialogue
            characters = set()
            for i, line in enumerate(current_scene_lines):
                line = line.strip()
                if not line:
                    continue
                # Check if this looks like a character name (ALL CAPS, followed by dialogue)
                match = character_pattern.match(line)
                if match:
                    name = match.group(1).strip()
                    # Filter out common non-character headings
                    if name not in ['INT', 'EXT', 'FADE IN', 'FADE OUT', 'CUT TO',
                                    'DISSOLVE TO', 'SMASH CUT TO', 'MATCH CUT TO',
                                    'CONTINUED', 'MORE', 'CONT\'D', 'CONTD', 'THE END',
                                    'TITLE CARD', 'SUPER', 'CHYRON', 'V.O.', 'O.S.', 'O.C.']:
                        # Check if next non-empty line exists and isn't a heading
                        for j in range(i + 1, len(current_scene_lines)):
                            next_line = current_scene_lines[j].strip()
                            if next_line:
                                # If next line doesn't look like a scene heading, it's probably dialogue
                                if not scene_heading_pattern.match(next_line):
                                    characters.add(name)
                                break

            current_scene['characters'] = sorted(list(characters))
            scenes.append(current_scene)

    for line in lines:
        stripped = line.strip()

        # Check for scene heading
        if scene_heading_pattern.match(stripped):
            # Finalize previous scene
            finalize_scene()

            # Start new scene
            scene_number += 1
            slugline = stripped

            # Parse location and time of day from slugline
            # Common format: INT. LOCATION - DAY/NIGHT
            location = None
            time_of_day = None

            # Remove INT./EXT./etc prefix
            loc_match = re.match(r'^(?:INT\.|EXT\.|INT/EXT\.|I/E\.?)\s*(.+)$', slugline, re.IGNORECASE)
            if loc_match:
                remainder = loc_match.group(1)
                # Split by - to get time of day
                parts = remainder.rsplit(' - ', 1)
                location = parts[0].strip()
                if len(parts) > 1:
                    time_of_day = parts[1].strip()

            current_scene = {
                'scene_number': scene_number,
                'slugline': slugline,
                'location': location,
                'time_of_day': time_of_day,
            }
            current_scene_lines = [line]
        else:
            # Add to current scene
            if current_scene:
                current_scene_lines.append(line)

    # Finalize last scene
    finalize_scene()

    return scenes


def parse_plain_script(raw_text: str) -> List[Dict[str, Any]]:
    """
    For PLAIN format, treat whole text as one scene.
    """
    return [{
        'scene_number': 1,
        'slugline': 'SCENE 1',
        'location': None,
        'time_of_day': None,
        'raw_scene_text': raw_text,
        'characters': [],
    }]


def parse_script(raw_text: str, format: str) -> List[Dict[str, Any]]:
    """Parse script based on format."""
    if format == 'FOUNTAIN':
        return parse_fountain_script(raw_text)
    else:
        return parse_plain_script(raw_text)


# =====================================================
# Helper Functions
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        print(f"[SCRIPT_SIDES_AUTH] Missing auth header: {authorization[:50] if authorization else 'None'}...")
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            print(f"[SCRIPT_SIDES_AUTH] Token verification returned None for token starting with: {token[:20]}...")
            raise HTTPException(status_code=401, detail="Invalid token")

        cognito_id = user.get("user_id") or user.get("sub") or user.get("id")
        if not cognito_id:
            raise HTTPException(status_code=401, detail="No user ID in token")

        from app.api.backlot import get_profile_id_from_cognito_id
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        return {"id": profile_id, "user_id": profile_id, "cognito_id": cognito_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_access(project_id: str, user_id: str) -> bool:
    """Verify user has access to the project."""
    client = get_client()

    project = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.data[0]["owner_id"] == user_id:
        return True

    member = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    if member.data:
        return True

    raise HTTPException(status_code=403, detail="Access denied to this project")


def get_next_sort_order(table: str, filter_col: str, filter_val: str) -> int:
    """Get next sort order for a table."""
    client = get_client()
    result = client.table(table).select("sort_order").eq(filter_col, filter_val).order("sort_order", desc=True).limit(1).execute()
    if result.data:
        return result.data[0]["sort_order"] + 1
    return 1


def recompact_sort_orders(table: str, filter_col: str, filter_val: str):
    """Recompact sort orders after deletion."""
    client = get_client()
    items = client.table(table).select("id").eq(filter_col, filter_val).order("sort_order").execute()
    for idx, item in enumerate(items.data or [], start=1):
        client.table(table).update({"sort_order": idx}).eq("id", item["id"]).execute()


# =====================================================
# Script Document Endpoints
# =====================================================

@router.get("/projects/{project_id}/script")
async def get_active_script(
    project_id: str,
    authorization: str = Header(None)
):
    """Get active script document for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get active script
    script = client.table("backlot_script_documents").select("*").eq("project_id", project_id).eq("is_active", True).execute()

    if not script.data:
        return {"script": None, "scenes_count": 0}

    script_doc = script.data[0]

    # Count scenes
    scenes = client.table("backlot_script_scenes").select("id", count="exact").eq("script_document_id", script_doc["id"]).execute()

    return {
        "script": script_doc,
        "scenes_count": scenes.count or 0
    }


@router.post("/projects/{project_id}/script")
async def create_script(
    project_id: str,
    request: ScriptDocumentCreate,
    authorization: str = Header(None)
):
    """Create new script document, parse scenes, deactivate previous."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Deactivate any existing active script
    client.table("backlot_script_documents").update({"is_active": False}).eq("project_id", project_id).eq("is_active", True).execute()

    # Create new script document
    script_data = {
        "project_id": project_id,
        "title": request.title,
        "format": request.format,
        "raw_text": request.raw_text,
        "is_active": True,
        "created_by_user_id": user["id"],
    }

    result = client.table("backlot_script_documents").insert(script_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create script document")

    script_doc = result.data[0]

    # Parse scenes
    parsed_scenes = parse_script(request.raw_text, request.format)

    # Insert scenes
    for scene in parsed_scenes:
        scene_data = {
            "script_document_id": script_doc["id"],
            "project_id": project_id,
            "scene_number": scene["scene_number"],
            "slugline": scene["slugline"],
            "location": scene.get("location"),
            "time_of_day": scene.get("time_of_day"),
            "raw_scene_text": scene["raw_scene_text"],
            "characters": scene.get("characters", []),
        }
        client.table("backlot_script_scenes").insert(scene_data).execute()

    return {
        "script": script_doc,
        "scenes_count": len(parsed_scenes)
    }


@router.put("/projects/{project_id}/script/{script_id}")
async def update_script(
    project_id: str,
    script_id: str,
    request: ScriptDocumentUpdate,
    authorization: str = Header(None)
):
    """Update script document. If rawText changes, reparse scenes."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify script exists
    script = client.table("backlot_script_documents").select("*").eq("id", script_id).eq("project_id", project_id).execute()
    if not script.data:
        raise HTTPException(status_code=404, detail="Script not found")

    script_doc = script.data[0]
    update_data = {}

    if request.title is not None:
        update_data["title"] = request.title

    reparse_needed = False
    if request.raw_text is not None and request.raw_text != script_doc["raw_text"]:
        update_data["raw_text"] = request.raw_text
        reparse_needed = True

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_script_documents").update(update_data).eq("id", script_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update script")

    updated_script = result.data[0]

    if reparse_needed:
        # Delete old scenes
        client.table("backlot_script_scenes").delete().eq("script_document_id", script_id).execute()

        # Parse new scenes
        parsed_scenes = parse_script(request.raw_text, updated_script["format"])

        # Insert new scenes
        for scene in parsed_scenes:
            scene_data = {
                "script_document_id": script_id,
                "project_id": project_id,
                "scene_number": scene["scene_number"],
                "slugline": scene["slugline"],
                "location": scene.get("location"),
                "time_of_day": scene.get("time_of_day"),
                "raw_scene_text": scene["raw_scene_text"],
                "characters": scene.get("characters", []),
            }
            client.table("backlot_script_scenes").insert(scene_data).execute()

    # Count scenes
    scenes = client.table("backlot_script_scenes").select("id", count="exact").eq("script_document_id", script_id).execute()

    return {
        "script": updated_script,
        "scenes_count": scenes.count or 0
    }


@router.get("/projects/{project_id}/script/scenes")
async def list_script_scenes(
    project_id: str,
    search: Optional[str] = None,
    authorization: str = Header(None)
):
    """List scenes from active script."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get active script
    script = client.table("backlot_script_documents").select("id").eq("project_id", project_id).eq("is_active", True).execute()
    if not script.data:
        return {"scenes": []}

    script_id = script.data[0]["id"]

    # Get scenes
    query = client.table("backlot_script_scenes").select(
        "id, scene_number, slugline, location, time_of_day, characters"
    ).eq("script_document_id", script_id).order("scene_number")

    if search:
        query = query.ilike("slugline", f"%{search}%")

    result = query.execute()

    return {"scenes": result.data or []}


# =====================================================
# Sides Packet Endpoints
# =====================================================

@router.get("/projects/{project_id}/sides")
async def list_sides_packets(
    project_id: str,
    authorization: str = Header(None)
):
    """List all sides packets for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get packets with production day info
    packets = client.table("backlot_sides_packets").select(
        "id, title, notes, status, created_at, updated_at, production_day_id"
    ).eq("project_id", project_id).order("created_at", desc=True).execute()

    result = []
    for packet in (packets.data or []):
        # Get production day info
        day = client.table("backlot_production_days").select("shoot_date, day_type, notes").eq("id", packet["production_day_id"]).execute()
        day_info = day.data[0] if day.data else {}

        # Count scenes
        scenes = client.table("backlot_sides_packet_scenes").select("id", count="exact").eq("sides_packet_id", packet["id"]).execute()

        result.append({
            **packet,
            "production_day": day_info,
            "scenes_count": scenes.count or 0
        })

    return {"packets": result}


@router.post("/projects/{project_id}/sides")
async def create_sides_packet(
    project_id: str,
    request: SidesPacketCreate,
    authorization: str = Header(None)
):
    """Create a new sides packet."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify production day exists
    day = client.table("backlot_production_days").select("id").eq("id", request.production_day_id).eq("project_id", project_id).execute()
    if not day.data:
        raise HTTPException(status_code=404, detail="Production day not found")

    # Create packet
    packet_data = {
        "project_id": project_id,
        "production_day_id": request.production_day_id,
        "episode_id": request.episode_id,
        "title": request.title,
        "notes": request.notes,
        "status": "DRAFT",
        "created_by_user_id": user["id"],
    }

    result = client.table("backlot_sides_packets").insert(packet_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create sides packet")

    packet = result.data[0]

    # If AUTO mode, try to pull scenes from schedule
    if request.mode == "AUTO":
        schedule_scenes = client.table("backlot_schedule_day_scenes").select(
            "script_scene_id, sort_order"
        ).eq("production_day_id", request.production_day_id).order("sort_order").execute()

        if schedule_scenes.data:
            for scene in schedule_scenes.data:
                scene_data = {
                    "sides_packet_id": packet["id"],
                    "script_scene_id": scene["script_scene_id"],
                    "sort_order": scene["sort_order"],
                }
                client.table("backlot_sides_packet_scenes").insert(scene_data).execute()

            return {
                "packet": packet,
                "auto_scenes_added": len(schedule_scenes.data),
                "message": f"Added {len(schedule_scenes.data)} scenes from schedule"
            }
        else:
            return {
                "packet": packet,
                "auto_scenes_added": 0,
                "message": "No scheduled scenes found. Please add scenes manually."
            }

    return {"packet": packet, "auto_scenes_added": 0}


@router.get("/projects/{project_id}/sides/{packet_id}")
async def get_sides_packet(
    project_id: str,
    packet_id: str,
    authorization: str = Header(None)
):
    """Get sides packet with full details."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get packet
    packet = client.table("backlot_sides_packets").select("*").eq("id", packet_id).eq("project_id", project_id).execute()
    if not packet.data:
        raise HTTPException(status_code=404, detail="Sides packet not found")

    packet_data = packet.data[0]

    # Get production day
    day = client.table("backlot_production_days").select(
        "id, shoot_date, day_type, notes"
    ).eq("id", packet_data["production_day_id"]).execute()
    day_info = day.data[0] if day.data else None

    # Get packet scenes with script scene details
    packet_scenes = client.table("backlot_sides_packet_scenes").select(
        "id, script_scene_id, sort_order, scene_notes"
    ).eq("sides_packet_id", packet_id).order("sort_order").execute()

    scenes_with_details = []
    for ps in (packet_scenes.data or []):
        script_scene = client.table("backlot_script_scenes").select("*").eq("id", ps["script_scene_id"]).execute()
        if script_scene.data:
            scenes_with_details.append({
                **ps,
                "script_scene": script_scene.data[0]
            })

    # Derive cast working from DOOD (subjects with 'W' assignment for this day)
    cast_working = []
    if day_info:
        dood_assignments = client.table("dood_assignments").select(
            "subject_id"
        ).eq("project_id", project_id).eq("day_id", day_info["id"]).eq("code", "W").execute()

        if dood_assignments.data:
            subject_ids = [a["subject_id"] for a in dood_assignments.data]
            subjects = client.table("dood_subjects").select(
                "id, display_name, subject_type"
            ).in_("id", subject_ids).eq("subject_type", "CAST").order("sort_order").execute()
            cast_working = subjects.data or []

    # Derive characters from selected scenes
    characters_from_scenes = set()
    for scene in scenes_with_details:
        chars = scene["script_scene"].get("characters") or []
        characters_from_scenes.update(chars)

    return {
        "packet": packet_data,
        "production_day": day_info,
        "scenes": scenes_with_details,
        "cast_working": cast_working,
        "characters_from_scenes": sorted(list(characters_from_scenes)),
    }


@router.put("/projects/{project_id}/sides/{packet_id}")
async def update_sides_packet(
    project_id: str,
    packet_id: str,
    request: SidesPacketUpdate,
    authorization: str = Header(None)
):
    """Update sides packet."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify packet exists
    packet = client.table("backlot_sides_packets").select("id").eq("id", packet_id).eq("project_id", project_id).execute()
    if not packet.data:
        raise HTTPException(status_code=404, detail="Sides packet not found")

    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.status is not None:
        if request.status not in ["DRAFT", "PUBLISHED"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        update_data["status"] = request.status

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_sides_packets").update(update_data).eq("id", packet_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update packet")

    return result.data[0]


@router.delete("/projects/{project_id}/sides/{packet_id}")
async def delete_sides_packet(
    project_id: str,
    packet_id: str,
    authorization: str = Header(None)
):
    """Delete a sides packet."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify packet exists
    packet = client.table("backlot_sides_packets").select("id").eq("id", packet_id).eq("project_id", project_id).execute()
    if not packet.data:
        raise HTTPException(status_code=404, detail="Sides packet not found")

    client.table("backlot_sides_packets").delete().eq("id", packet_id).execute()

    return {"success": True}


# =====================================================
# Packet Scenes Management
# =====================================================

@router.post("/projects/{project_id}/sides/{packet_id}/scenes")
async def add_scene_to_packet(
    project_id: str,
    packet_id: str,
    request: PacketSceneCreate,
    authorization: str = Header(None)
):
    """Add a scene to the packet."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify packet exists
    packet = client.table("backlot_sides_packets").select("id").eq("id", packet_id).eq("project_id", project_id).execute()
    if not packet.data:
        raise HTTPException(status_code=404, detail="Sides packet not found")

    # Verify scene exists
    scene = client.table("backlot_script_scenes").select("id").eq("id", request.script_scene_id).eq("project_id", project_id).execute()
    if not scene.data:
        raise HTTPException(status_code=404, detail="Script scene not found")

    # Check if scene already in packet
    existing = client.table("backlot_sides_packet_scenes").select("id").eq("sides_packet_id", packet_id).eq("script_scene_id", request.script_scene_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Scene already in packet")

    # Get next sort order
    sort_order = get_next_sort_order("backlot_sides_packet_scenes", "sides_packet_id", packet_id)

    scene_data = {
        "sides_packet_id": packet_id,
        "script_scene_id": request.script_scene_id,
        "sort_order": sort_order,
    }

    result = client.table("backlot_sides_packet_scenes").insert(scene_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add scene to packet")

    return result.data[0]


@router.put("/projects/{project_id}/sides/{packet_id}/scenes/{packet_scene_id}")
async def update_packet_scene(
    project_id: str,
    packet_id: str,
    packet_scene_id: str,
    request: PacketSceneUpdate,
    authorization: str = Header(None)
):
    """Update scene notes in packet."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify packet scene exists
    ps = client.table("backlot_sides_packet_scenes").select("id, sides_packet_id").eq("id", packet_scene_id).execute()
    if not ps.data or ps.data[0]["sides_packet_id"] != packet_id:
        raise HTTPException(status_code=404, detail="Packet scene not found")

    update_data = {}
    if request.scene_notes is not None:
        update_data["scene_notes"] = request.scene_notes

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_sides_packet_scenes").update(update_data).eq("id", packet_scene_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update packet scene")

    return result.data[0]


@router.delete("/projects/{project_id}/sides/{packet_id}/scenes/{packet_scene_id}")
async def remove_scene_from_packet(
    project_id: str,
    packet_id: str,
    packet_scene_id: str,
    authorization: str = Header(None)
):
    """Remove scene from packet."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify packet scene exists
    ps = client.table("backlot_sides_packet_scenes").select("id, sides_packet_id").eq("id", packet_scene_id).execute()
    if not ps.data or ps.data[0]["sides_packet_id"] != packet_id:
        raise HTTPException(status_code=404, detail="Packet scene not found")

    client.table("backlot_sides_packet_scenes").delete().eq("id", packet_scene_id).execute()

    # Recompact sort orders
    recompact_sort_orders("backlot_sides_packet_scenes", "sides_packet_id", packet_id)

    return {"success": True}


@router.post("/projects/{project_id}/sides/{packet_id}/scenes/reorder")
async def reorder_packet_scene(
    project_id: str,
    packet_id: str,
    request: PacketSceneReorder,
    authorization: str = Header(None)
):
    """Reorder a scene in the packet (swap with adjacent)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get current scene
    current = client.table("backlot_sides_packet_scenes").select("id, sort_order").eq("id", request.packet_scene_id).eq("sides_packet_id", packet_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Packet scene not found")

    current_order = current.data[0]["sort_order"]

    # Find adjacent
    if request.direction == "UP":
        adjacent = client.table("backlot_sides_packet_scenes").select("id, sort_order").eq("sides_packet_id", packet_id).lt("sort_order", current_order).order("sort_order", desc=True).limit(1).execute()
    else:
        adjacent = client.table("backlot_sides_packet_scenes").select("id, sort_order").eq("sides_packet_id", packet_id).gt("sort_order", current_order).order("sort_order").limit(1).execute()

    if not adjacent.data:
        raise HTTPException(status_code=400, detail=f"Cannot move scene {request.direction.lower()}")

    adjacent_order = adjacent.data[0]["sort_order"]
    adjacent_id = adjacent.data[0]["id"]

    # Swap sort orders
    temp_order = 999999
    client.table("backlot_sides_packet_scenes").update({"sort_order": temp_order}).eq("id", request.packet_scene_id).execute()
    client.table("backlot_sides_packet_scenes").update({"sort_order": current_order}).eq("id", adjacent_id).execute()
    client.table("backlot_sides_packet_scenes").update({"sort_order": adjacent_order}).eq("id", request.packet_scene_id).execute()

    return {"success": True}


@router.post("/projects/{project_id}/sides/{packet_id}/sync-from-schedule")
async def sync_packet_from_schedule(
    project_id: str,
    packet_id: str,
    authorization: str = Header(None)
):
    """Rebuild packet scenes from schedule day scenes."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get packet
    packet = client.table("backlot_sides_packets").select("production_day_id").eq("id", packet_id).eq("project_id", project_id).execute()
    if not packet.data:
        raise HTTPException(status_code=404, detail="Sides packet not found")

    production_day_id = packet.data[0]["production_day_id"]

    # Get schedule scenes
    schedule_scenes = client.table("backlot_schedule_day_scenes").select(
        "script_scene_id, sort_order"
    ).eq("production_day_id", production_day_id).order("sort_order").execute()

    if not schedule_scenes.data:
        raise HTTPException(status_code=400, detail="No scheduled scenes found for this day")

    # Delete existing packet scenes
    client.table("backlot_sides_packet_scenes").delete().eq("sides_packet_id", packet_id).execute()

    # Add scenes from schedule
    for scene in schedule_scenes.data:
        scene_data = {
            "sides_packet_id": packet_id,
            "script_scene_id": scene["script_scene_id"],
            "sort_order": scene["sort_order"],
        }
        client.table("backlot_sides_packet_scenes").insert(scene_data).execute()

    return {
        "success": True,
        "scenes_synced": len(schedule_scenes.data)
    }


# =====================================================
# Schedule Day Scenes (for linking scenes to days)
# =====================================================

@router.get("/projects/{project_id}/schedule/{day_id}/scenes")
async def list_schedule_day_scenes(
    project_id: str,
    day_id: str,
    authorization: str = Header(None)
):
    """List scenes scheduled for a production day."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get schedule scenes
    schedule_scenes = client.table("backlot_schedule_day_scenes").select(
        "id, script_scene_id, sort_order"
    ).eq("production_day_id", day_id).order("sort_order").execute()

    scenes_with_details = []
    for ss in (schedule_scenes.data or []):
        script_scene = client.table("backlot_script_scenes").select(
            "id, scene_number, slugline, location, time_of_day, characters"
        ).eq("id", ss["script_scene_id"]).execute()
        if script_scene.data:
            scenes_with_details.append({
                **ss,
                "script_scene": script_scene.data[0]
            })

    return {"scenes": scenes_with_details}


@router.post("/projects/{project_id}/schedule/{day_id}/scenes")
async def add_scene_to_schedule(
    project_id: str,
    day_id: str,
    request: ScheduleDaySceneCreate,
    authorization: str = Header(None)
):
    """Add a scene to a production day's schedule."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify day exists
    day = client.table("backlot_production_days").select("id").eq("id", day_id).eq("project_id", project_id).execute()
    if not day.data:
        raise HTTPException(status_code=404, detail="Production day not found")

    # Verify scene exists
    scene = client.table("backlot_script_scenes").select("id").eq("id", request.script_scene_id).eq("project_id", project_id).execute()
    if not scene.data:
        raise HTTPException(status_code=404, detail="Script scene not found")

    # Check if already scheduled
    existing = client.table("backlot_schedule_day_scenes").select("id").eq("production_day_id", day_id).eq("script_scene_id", request.script_scene_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Scene already scheduled for this day")

    # Get next sort order
    sort_order = get_next_sort_order("backlot_schedule_day_scenes", "production_day_id", day_id)

    scene_data = {
        "project_id": project_id,
        "production_day_id": day_id,
        "script_scene_id": request.script_scene_id,
        "sort_order": sort_order,
    }

    result = client.table("backlot_schedule_day_scenes").insert(scene_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add scene to schedule")

    return result.data[0]


@router.delete("/projects/{project_id}/schedule/{day_id}/scenes/{schedule_scene_id}")
async def remove_scene_from_schedule(
    project_id: str,
    day_id: str,
    schedule_scene_id: str,
    authorization: str = Header(None)
):
    """Remove a scene from production day schedule."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Verify exists
    ss = client.table("backlot_schedule_day_scenes").select("id").eq("id", schedule_scene_id).eq("production_day_id", day_id).execute()
    if not ss.data:
        raise HTTPException(status_code=404, detail="Schedule scene not found")

    client.table("backlot_schedule_day_scenes").delete().eq("id", schedule_scene_id).execute()

    # Recompact sort orders
    recompact_sort_orders("backlot_schedule_day_scenes", "production_day_id", day_id)

    return {"success": True}


# =====================================================
# Print Data Endpoint
# =====================================================

@router.get("/projects/{project_id}/sides/{packet_id}/print")
async def get_sides_print_data(
    project_id: str,
    packet_id: str,
    authorization: str = Header(None)
):
    """Get sides packet data formatted for printing."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Unknown Project"

    # Get packet
    packet = client.table("backlot_sides_packets").select("*").eq("id", packet_id).eq("project_id", project_id).execute()
    if not packet.data:
        raise HTTPException(status_code=404, detail="Sides packet not found")

    packet_data = packet.data[0]

    # Get production day
    day = client.table("backlot_production_days").select(
        "id, shoot_date, day_type, notes"
    ).eq("id", packet_data["production_day_id"]).execute()
    day_info = day.data[0] if day.data else None

    # Get packet scenes with full script scene details
    packet_scenes = client.table("backlot_sides_packet_scenes").select(
        "id, script_scene_id, sort_order, scene_notes"
    ).eq("sides_packet_id", packet_id).order("sort_order").execute()

    scenes_for_print = []
    for ps in (packet_scenes.data or []):
        script_scene = client.table("backlot_script_scenes").select("*").eq("id", ps["script_scene_id"]).execute()
        if script_scene.data:
            scenes_for_print.append({
                "sort_order": ps["sort_order"],
                "scene_notes": ps.get("scene_notes"),
                "script_scene": script_scene.data[0]
            })

    # Derive cast from DOOD
    cast_working = []
    if day_info:
        dood_assignments = client.table("dood_assignments").select(
            "subject_id"
        ).eq("project_id", project_id).eq("day_id", day_info["id"]).eq("code", "W").execute()

        if dood_assignments.data:
            subject_ids = [a["subject_id"] for a in dood_assignments.data]
            subjects = client.table("dood_subjects").select(
                "display_name"
            ).in_("id", subject_ids).eq("subject_type", "CAST").order("sort_order").execute()
            cast_working = [s["display_name"] for s in (subjects.data or [])]

    # Derive characters from scenes
    characters_from_scenes = set()
    for scene in scenes_for_print:
        chars = scene["script_scene"].get("characters") or []
        characters_from_scenes.update(chars)

    return {
        "project_title": project_title,
        "packet": packet_data,
        "production_day": day_info,
        "scenes": scenes_for_print,
        "cast_working": cast_working,
        "characters_from_scenes": sorted(list(characters_from_scenes)),
        "generated_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# Production Days List (for packet creation)
# =====================================================

@router.get("/projects/{project_id}/production-days")
async def list_production_days(
    project_id: str,
    authorization: str = Header(None)
):
    """List production days for a project (for sides packet creation)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    days = client.table("backlot_production_days").select(
        "id, shoot_date, day_type, notes"
    ).eq("project_id", project_id).order("shoot_date").execute()

    return {"days": days.data or []}
