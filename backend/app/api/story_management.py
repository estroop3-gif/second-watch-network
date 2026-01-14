"""
Story Management API Endpoints
Handles stories, story beats, characters, and character arcs
Narrative structure tools for screenwriting and story development
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import csv
import io

from app.core.database import get_client, execute_query, execute_single

router = APIRouter()


# =====================================================
# Pydantic Models
# =====================================================

# Story Models
class StoryCreate(BaseModel):
    title: str = Field(..., min_length=1)
    logline: Optional[str] = None
    genre: Optional[str] = None
    tone: Optional[str] = None
    themes: Optional[List[str]] = None
    structure_type: Optional[str] = Field(default='three-act')


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    logline: Optional[str] = None
    genre: Optional[str] = None
    tone: Optional[str] = None
    themes: Optional[List[str]] = None
    structure_type: Optional[str] = None


# Beat Models
class BeatCreate(BaseModel):
    act_marker: Optional[str] = None
    title: str = Field(..., min_length=1)
    content: Optional[str] = None
    notes: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    emotional_tone: Optional[str] = None
    primary_character_id: Optional[str] = None


class BeatUpdate(BaseModel):
    act_marker: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    notes: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    emotional_tone: Optional[str] = None
    primary_character_id: Optional[str] = None


class BeatReorder(BaseModel):
    beat_id: str
    direction: str = Field(..., pattern='^(UP|DOWN)$')


# Character Models
class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1)
    role: Optional[str] = None  # protagonist, antagonist, supporting, minor
    arc_summary: Optional[str] = None
    notes: Optional[str] = None
    contact_id: Optional[str] = None  # Link to project contact


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    arc_summary: Optional[str] = None
    notes: Optional[str] = None
    contact_id: Optional[str] = None  # Link to project contact


class CharacterFromContact(BaseModel):
    contact_id: str = Field(..., min_length=1)
    role: Optional[str] = None
    arc_summary: Optional[str] = None
    notes: Optional[str] = None


# Character Arc Models
class CharacterArcCreate(BaseModel):
    beat_id: str
    description: str = Field(..., min_length=1)


class CharacterArcUpdate(BaseModel):
    description: Optional[str] = None


# =====================================================
# Helper Functions
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
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


async def verify_story_access(story_id: str, project_id: str) -> Dict[str, Any]:
    """Verify story exists and belongs to project."""
    client = get_client()

    story = client.table("backlot_stories").select("*").eq("id", story_id).eq("project_id", project_id).execute()
    if not story.data:
        raise HTTPException(status_code=404, detail="Story not found")

    return story.data[0]


def get_next_beat_sort_order(story_id: str) -> int:
    """Get next available sort order for a beat."""
    client = get_client()
    result = client.table("backlot_story_beats").select("sort_order").eq("story_id", story_id).order("sort_order", desc=True).limit(1).execute()
    if result.data:
        return result.data[0]["sort_order"] + 1
    return 1


def recompact_beat_sort_orders(story_id: str):
    """Recompact sort orders for beats after delete."""
    client = get_client()
    beats = client.table("backlot_story_beats").select("id").eq("story_id", story_id).order("sort_order").execute()

    for idx, beat in enumerate(beats.data or [], start=1):
        client.table("backlot_story_beats").update({"sort_order": idx}).eq("id", beat["id"]).execute()


# =====================================================
# Story Endpoints
# =====================================================

@router.get("/projects/{project_id}/stories")
async def list_stories(
    project_id: str,
    authorization: str = Header(None)
):
    """List all stories for a project."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()
    result = client.table("backlot_stories").select(
        "id, title, logline, genre, tone, themes, structure_type, created_at, updated_at"
    ).eq("project_id", project_id).order("created_at", desc=True).execute()

    # Get beat and character counts for each story
    stories = []
    for story in (result.data or []):
        beats = client.table("backlot_story_beats").select("id", count="exact").eq("story_id", story["id"]).execute()
        characters = client.table("backlot_story_characters").select("id", count="exact").eq("story_id", story["id"]).execute()
        story["beat_count"] = beats.count or 0
        story["character_count"] = characters.count or 0
        stories.append(story)

    return {"stories": stories}


@router.post("/projects/{project_id}/stories")
async def create_story(
    project_id: str,
    request: StoryCreate,
    authorization: str = Header(None)
):
    """Create a new story."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    story_data = {
        "project_id": project_id,
        "title": request.title,
        "logline": request.logline,
        "genre": request.genre,
        "tone": request.tone,
        "themes": request.themes or [],
        "structure_type": request.structure_type or 'three-act',
        "created_by_user_id": user["id"],
    }

    result = client.table("backlot_stories").insert(story_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create story")

    return result.data[0]


@router.get("/projects/{project_id}/stories/{story_id}")
async def get_story(
    project_id: str,
    story_id: str,
    authorization: str = Header(None)
):
    """Get story with beats and characters."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get story
    story = client.table("backlot_stories").select("*").eq("id", story_id).eq("project_id", project_id).execute()
    if not story.data:
        raise HTTPException(status_code=404, detail="Story not found")

    # Get beats ordered
    beats = client.table("backlot_story_beats").select("*").eq("story_id", story_id).order("sort_order").execute()

    # Get characters with contact info
    characters = client.table("backlot_story_characters").select("*").eq("story_id", story_id).order("name").execute()

    # Fetch contact info for characters with contact_id
    contact_ids = [c["contact_id"] for c in (characters.data or []) if c.get("contact_id")]
    contacts_map = {}
    if contact_ids:
        contacts_result = client.table("backlot_project_contacts").select("id, name, email, phone").in_("id", contact_ids).execute()
        for contact in (contacts_result.data or []):
            contacts_map[contact["id"]] = contact

    # Attach contact info to characters
    for character in (characters.data or []):
        if character.get("contact_id") and character["contact_id"] in contacts_map:
            character["contact"] = contacts_map[character["contact_id"]]
        else:
            character["contact"] = None

    # Get all character arcs for this story's beats
    beat_ids = [b["id"] for b in (beats.data or [])]
    arcs_by_beat: Dict[str, List[Dict]] = {bid: [] for bid in beat_ids}
    arcs_by_character: Dict[str, List[Dict]] = {}

    if beat_ids:
        arcs = client.table("backlot_character_arcs").select("*").in_("beat_id", beat_ids).execute()
        for arc in (arcs.data or []):
            if arc["beat_id"] in arcs_by_beat:
                arcs_by_beat[arc["beat_id"]].append(arc)
            if arc["character_id"] not in arcs_by_character:
                arcs_by_character[arc["character_id"]] = []
            arcs_by_character[arc["character_id"]].append(arc)

    # Attach arcs to beats
    for beat in (beats.data or []):
        beat["character_arcs"] = arcs_by_beat.get(beat["id"], [])

    # Attach arcs to characters
    for character in (characters.data or []):
        character["arcs"] = arcs_by_character.get(character["id"], [])

    # Build response
    result = story.data[0]
    result["beats"] = beats.data or []
    result["characters"] = characters.data or []

    return result


@router.put("/projects/{project_id}/stories/{story_id}")
async def update_story(
    project_id: str,
    story_id: str,
    request: StoryUpdate,
    authorization: str = Header(None)
):
    """Update a story."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title
    if request.logline is not None:
        update_data["logline"] = request.logline
    if request.genre is not None:
        update_data["genre"] = request.genre
    if request.tone is not None:
        update_data["tone"] = request.tone
    if request.themes is not None:
        update_data["themes"] = request.themes
    if request.structure_type is not None:
        update_data["structure_type"] = request.structure_type

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_stories").update(update_data).eq("id", story_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update story")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}")
async def delete_story(
    project_id: str,
    story_id: str,
    authorization: str = Header(None)
):
    """Delete a story and all its beats/characters/arcs."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()
    client.table("backlot_stories").delete().eq("id", story_id).execute()

    return {"success": True}


# =====================================================
# Beat Endpoints
# =====================================================

@router.post("/projects/{project_id}/stories/{story_id}/beats")
async def create_beat(
    project_id: str,
    story_id: str,
    request: BeatCreate,
    authorization: str = Header(None)
):
    """Create a new beat in a story."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    sort_order = get_next_beat_sort_order(story_id)

    beat_data = {
        "story_id": story_id,
        "sort_order": sort_order,
        "act_marker": request.act_marker,
        "title": request.title,
        "content": request.content,
        "notes": request.notes,
        "page_start": request.page_start,
        "page_end": request.page_end,
        "emotional_tone": request.emotional_tone,
        "primary_character_id": request.primary_character_id,
    }

    result = client.table("backlot_story_beats").insert(beat_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create beat")

    return result.data[0]


@router.put("/projects/{project_id}/stories/{story_id}/beats/{beat_id}")
async def update_beat(
    project_id: str,
    story_id: str,
    beat_id: str,
    request: BeatUpdate,
    authorization: str = Header(None)
):
    """Update a beat."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify beat exists
    beat = client.table("backlot_story_beats").select("id").eq("id", beat_id).eq("story_id", story_id).execute()
    if not beat.data:
        raise HTTPException(status_code=404, detail="Beat not found")

    update_data = {}
    if request.act_marker is not None:
        update_data["act_marker"] = request.act_marker
    if request.title is not None:
        update_data["title"] = request.title
    if request.content is not None:
        update_data["content"] = request.content
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.page_start is not None:
        update_data["page_start"] = request.page_start
    if request.page_end is not None:
        update_data["page_end"] = request.page_end
    if request.emotional_tone is not None:
        update_data["emotional_tone"] = request.emotional_tone
    if request.primary_character_id is not None:
        update_data["primary_character_id"] = request.primary_character_id if request.primary_character_id else None

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_story_beats").update(update_data).eq("id", beat_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update beat")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}/beats/{beat_id}")
async def delete_beat(
    project_id: str,
    story_id: str,
    beat_id: str,
    authorization: str = Header(None)
):
    """Delete a beat. Character arcs linked to it are also deleted (cascade)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify beat exists
    beat = client.table("backlot_story_beats").select("id").eq("id", beat_id).eq("story_id", story_id).execute()
    if not beat.data:
        raise HTTPException(status_code=404, detail="Beat not found")

    # Delete beat
    client.table("backlot_story_beats").delete().eq("id", beat_id).execute()

    # Recompact sort orders
    recompact_beat_sort_orders(story_id)

    return {"success": True}


@router.post("/projects/{project_id}/stories/{story_id}/beats/reorder")
async def reorder_beat(
    project_id: str,
    story_id: str,
    request: BeatReorder,
    authorization: str = Header(None)
):
    """Reorder a beat (swap with adjacent)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Get current beat
    current = client.table("backlot_story_beats").select("id, sort_order").eq("id", request.beat_id).eq("story_id", story_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Beat not found")

    current_order = current.data[0]["sort_order"]

    # Find adjacent beat
    if request.direction == "UP":
        adjacent = client.table("backlot_story_beats").select("id, sort_order").eq("story_id", story_id).lt("sort_order", current_order).order("sort_order", desc=True).limit(1).execute()
    else:
        adjacent = client.table("backlot_story_beats").select("id, sort_order").eq("story_id", story_id).gt("sort_order", current_order).order("sort_order").limit(1).execute()

    if not adjacent.data:
        raise HTTPException(status_code=400, detail=f"Cannot move beat {request.direction.lower()}")

    adjacent_order = adjacent.data[0]["sort_order"]
    adjacent_id = adjacent.data[0]["id"]

    # Swap sort orders (use temp value to avoid unique constraint)
    temp_order = 999999
    client.table("backlot_story_beats").update({"sort_order": temp_order}).eq("id", request.beat_id).execute()
    client.table("backlot_story_beats").update({"sort_order": current_order}).eq("id", adjacent_id).execute()
    client.table("backlot_story_beats").update({"sort_order": adjacent_order}).eq("id", request.beat_id).execute()

    return {"success": True}


# =====================================================
# Character Endpoints
# =====================================================

@router.get("/projects/{project_id}/stories/{story_id}/characters")
async def list_characters(
    project_id: str,
    story_id: str,
    authorization: str = Header(None)
):
    """List all characters for a story."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()
    result = client.table("backlot_story_characters").select("*").eq("story_id", story_id).order("name").execute()

    return {"characters": result.data or []}


@router.post("/projects/{project_id}/stories/{story_id}/characters")
async def create_character(
    project_id: str,
    story_id: str,
    request: CharacterCreate,
    authorization: str = Header(None)
):
    """Create a new character."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    character_data = {
        "story_id": story_id,
        "name": request.name,
        "role": request.role,
        "arc_summary": request.arc_summary,
        "notes": request.notes,
    }

    # Add contact_id if provided
    if request.contact_id:
        character_data["contact_id"] = request.contact_id

    result = client.table("backlot_story_characters").insert(character_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create character")

    return result.data[0]


@router.post("/projects/{project_id}/stories/{story_id}/characters/from-contact")
async def create_character_from_contact(
    project_id: str,
    story_id: str,
    request: CharacterFromContact,
    authorization: str = Header(None)
):
    """Create a character from an existing project contact."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Get contact info
    contact = client.table("backlot_project_contacts").select("id, name, email").eq("id", request.contact_id).eq("project_id", project_id).execute()
    if not contact.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact_data = contact.data[0]

    character_data = {
        "story_id": story_id,
        "name": contact_data["name"],
        "role": request.role,
        "arc_summary": request.arc_summary,
        "notes": request.notes,
        "contact_id": request.contact_id,
    }

    result = client.table("backlot_story_characters").insert(character_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create character")

    # Return character with contact info
    char = result.data[0]
    char["contact"] = contact_data
    return char


@router.put("/projects/{project_id}/stories/{story_id}/characters/{character_id}")
async def update_character(
    project_id: str,
    story_id: str,
    character_id: str,
    request: CharacterUpdate,
    authorization: str = Header(None)
):
    """Update a character."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify character exists
    character = client.table("backlot_story_characters").select("id").eq("id", character_id).eq("story_id", story_id).execute()
    if not character.data:
        raise HTTPException(status_code=404, detail="Character not found")

    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.role is not None:
        update_data["role"] = request.role
    if request.arc_summary is not None:
        update_data["arc_summary"] = request.arc_summary
    if request.notes is not None:
        update_data["notes"] = request.notes
    if request.contact_id is not None:
        update_data["contact_id"] = request.contact_id if request.contact_id else None

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_story_characters").update(update_data).eq("id", character_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update character")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}/characters/{character_id}")
async def delete_character(
    project_id: str,
    story_id: str,
    character_id: str,
    authorization: str = Header(None)
):
    """Delete a character and all their arc entries."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify character exists
    character = client.table("backlot_story_characters").select("id").eq("id", character_id).eq("story_id", story_id).execute()
    if not character.data:
        raise HTTPException(status_code=404, detail="Character not found")

    # Delete character (arcs cascade)
    client.table("backlot_story_characters").delete().eq("id", character_id).execute()

    return {"success": True}


# =====================================================
# Character Arc Endpoints
# =====================================================

@router.post("/projects/{project_id}/stories/{story_id}/characters/{character_id}/arcs")
async def create_character_arc(
    project_id: str,
    story_id: str,
    character_id: str,
    request: CharacterArcCreate,
    authorization: str = Header(None)
):
    """Create a character arc entry linking a character to a beat."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify character exists
    character = client.table("backlot_story_characters").select("id").eq("id", character_id).eq("story_id", story_id).execute()
    if not character.data:
        raise HTTPException(status_code=404, detail="Character not found")

    # Verify beat exists and belongs to same story
    beat = client.table("backlot_story_beats").select("id").eq("id", request.beat_id).eq("story_id", story_id).execute()
    if not beat.data:
        raise HTTPException(status_code=404, detail="Beat not found")

    # Check if arc already exists for this character+beat
    existing = client.table("backlot_character_arcs").select("id").eq("character_id", character_id).eq("beat_id", request.beat_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Arc already exists for this character and beat")

    arc_data = {
        "character_id": character_id,
        "beat_id": request.beat_id,
        "description": request.description,
    }

    result = client.table("backlot_character_arcs").insert(arc_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create character arc")

    return result.data[0]


@router.put("/projects/{project_id}/stories/{story_id}/characters/{character_id}/arcs/{arc_id}")
async def update_character_arc(
    project_id: str,
    story_id: str,
    character_id: str,
    arc_id: str,
    request: CharacterArcUpdate,
    authorization: str = Header(None)
):
    """Update a character arc."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify arc exists
    arc = client.table("backlot_character_arcs").select("id").eq("id", arc_id).eq("character_id", character_id).execute()
    if not arc.data:
        raise HTTPException(status_code=404, detail="Character arc not found")

    update_data = {}
    if request.description is not None:
        update_data["description"] = request.description

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_character_arcs").update(update_data).eq("id", arc_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update character arc")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}/characters/{character_id}/arcs/{arc_id}")
async def delete_character_arc(
    project_id: str,
    story_id: str,
    character_id: str,
    arc_id: str,
    authorization: str = Header(None)
):
    """Delete a character arc."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify arc exists
    arc = client.table("backlot_character_arcs").select("id").eq("id", arc_id).eq("character_id", character_id).execute()
    if not arc.data:
        raise HTTPException(status_code=404, detail="Character arc not found")

    client.table("backlot_character_arcs").delete().eq("id", arc_id).execute()

    return {"success": True}


# =====================================================
# Export Endpoint
# =====================================================

@router.get("/projects/{project_id}/stories/{story_id}/export.csv")
async def export_story_csv(
    project_id: str,
    story_id: str,
    authorization: str = Header(None),
    token: str = Query(None)  # Allow token as query param for new window opening
):
    """Export story to CSV."""
    auth_token = authorization or (f"Bearer {token}" if token else None)
    user = await get_current_user_from_token(auth_token)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get story
    story = client.table("backlot_stories").select("*").eq("id", story_id).eq("project_id", project_id).execute()
    if not story.data:
        raise HTTPException(status_code=404, detail="Story not found")

    story_data = story.data[0]

    # Get beats
    beats = client.table("backlot_story_beats").select("*").eq("story_id", story_id).order("sort_order").execute()

    # Get characters
    characters = client.table("backlot_story_characters").select("*").eq("story_id", story_id).order("name").execute()

    # Get character arcs
    beat_ids = [b["id"] for b in (beats.data or [])]
    arcs = []
    if beat_ids:
        arcs_result = client.table("backlot_character_arcs").select("*").in_("beat_id", beat_ids).execute()
        arcs = arcs_result.data or []

    # Build character map for arc lookup
    character_map = {c["id"]: c["name"] for c in (characters.data or [])}
    beat_map = {b["id"]: b["title"] for b in (beats.data or [])}

    # Build CSV with multiple sections
    output = io.StringIO()
    writer = csv.writer(output)

    # Story info section
    writer.writerow(["=== STORY INFO ==="])
    writer.writerow(["Title", "Logline", "Genre", "Tone", "Themes", "Structure"])
    writer.writerow([
        story_data["title"],
        story_data.get("logline") or "",
        story_data.get("genre") or "",
        story_data.get("tone") or "",
        ";".join(story_data.get("themes") or []),
        story_data.get("structure_type") or "",
    ])
    writer.writerow([])

    # Beats section
    writer.writerow(["=== BEATS ==="])
    writer.writerow(["Order", "Act Marker", "Title", "Content", "Notes"])
    for beat in (beats.data or []):
        writer.writerow([
            beat["sort_order"],
            beat.get("act_marker") or "",
            beat["title"],
            beat.get("content") or "",
            beat.get("notes") or "",
        ])
    writer.writerow([])

    # Characters section
    writer.writerow(["=== CHARACTERS ==="])
    writer.writerow(["Name", "Role", "Arc Summary", "Notes"])
    for character in (characters.data or []):
        writer.writerow([
            character["name"],
            character.get("role") or "",
            character.get("arc_summary") or "",
            character.get("notes") or "",
        ])
    writer.writerow([])

    # Character arcs section
    writer.writerow(["=== CHARACTER ARCS ==="])
    writer.writerow(["Character", "Beat", "Description"])
    for arc in arcs:
        writer.writerow([
            character_map.get(arc["character_id"], "Unknown"),
            beat_map.get(arc["beat_id"], "Unknown"),
            arc["description"],
        ])

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="story_{story_id}.csv"'
        }
    )


# =====================================================
# Print Data Endpoint
# =====================================================

@router.get("/projects/{project_id}/stories/{story_id}/print")
async def get_story_print_data(
    project_id: str,
    story_id: str,
    authorization: str = Header(None)
):
    """Get story data formatted for print view."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project name
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Unknown Project"

    # Get story
    story = client.table("backlot_stories").select("*").eq("id", story_id).eq("project_id", project_id).execute()
    if not story.data:
        raise HTTPException(status_code=404, detail="Story not found")

    # Get beats
    beats = client.table("backlot_story_beats").select("*").eq("story_id", story_id).order("sort_order").execute()

    # Get characters
    characters = client.table("backlot_story_characters").select("*").eq("story_id", story_id).order("name").execute()

    # Get character arcs
    beat_ids = [b["id"] for b in (beats.data or [])]
    arcs_by_beat: Dict[str, List[Dict]] = {bid: [] for bid in beat_ids}

    if beat_ids:
        arcs = client.table("backlot_character_arcs").select("*").in_("beat_id", beat_ids).execute()
        character_map = {c["id"]: c["name"] for c in (characters.data or [])}
        for arc in (arcs.data or []):
            arc["character_name"] = character_map.get(arc["character_id"], "Unknown")
            if arc["beat_id"] in arcs_by_beat:
                arcs_by_beat[arc["beat_id"]].append(arc)

    # Attach arcs to beats
    for beat in (beats.data or []):
        beat["character_arcs"] = arcs_by_beat.get(beat["id"], [])

    return {
        "project_title": project_title,
        "story": story.data[0],
        "beats": beats.data or [],
        "characters": characters.data or [],
        "generated_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# Story Connection Models
# =====================================================

class BeatSceneLinkCreate(BaseModel):
    scene_id: str
    relationship: Optional[str] = Field(default='features')
    notes: Optional[str] = None


class StoryEpisodeLinkCreate(BaseModel):
    episode_id: str
    relationship: Optional[str] = Field(default='primary')
    notes: Optional[str] = None


class CharacterCastLinkCreate(BaseModel):
    role_id: str
    notes: Optional[str] = None


# =====================================================
# Beat-Scene Connection Endpoints
# =====================================================

@router.get("/projects/{project_id}/stories/{story_id}/beats/{beat_id}/scenes")
async def list_beat_scene_links(
    project_id: str,
    story_id: str,
    beat_id: str,
    authorization: str = Header(None)
):
    """List all scenes linked to a beat."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify beat exists
    beat = client.table("backlot_story_beats").select("id").eq("id", beat_id).eq("story_id", story_id).execute()
    if not beat.data:
        raise HTTPException(status_code=404, detail="Beat not found")

    # Get links with scene data
    links = client.table("backlot_story_beat_scenes").select("*").eq("beat_id", beat_id).execute()

    # Enrich with scene data
    result = []
    for link in (links.data or []):
        scene = client.table("backlot_scenes").select("id, scene_number, int_ext, location, time_of_day, synopsis").eq("id", link["scene_id"]).execute()
        if scene.data:
            link["scene"] = scene.data[0]
            result.append(link)

    return {"links": result}


@router.post("/projects/{project_id}/stories/{story_id}/beats/{beat_id}/scenes")
async def link_beat_to_scene(
    project_id: str,
    story_id: str,
    beat_id: str,
    request: BeatSceneLinkCreate,
    authorization: str = Header(None)
):
    """Link a beat to a scene."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify beat exists
    beat = client.table("backlot_story_beats").select("id").eq("id", beat_id).eq("story_id", story_id).execute()
    if not beat.data:
        raise HTTPException(status_code=404, detail="Beat not found")

    # Verify scene exists and belongs to project
    scene = client.table("backlot_scenes").select("id").eq("id", request.scene_id).eq("project_id", project_id).execute()
    if not scene.data:
        raise HTTPException(status_code=404, detail="Scene not found")

    # Check if link already exists
    existing = client.table("backlot_story_beat_scenes").select("id").eq("beat_id", beat_id).eq("scene_id", request.scene_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Beat is already linked to this scene")

    link_data = {
        "beat_id": beat_id,
        "scene_id": request.scene_id,
        "relationship": request.relationship or 'features',
        "notes": request.notes,
    }

    result = client.table("backlot_story_beat_scenes").insert(link_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}/beats/{beat_id}/scenes/{link_id}")
async def unlink_beat_from_scene(
    project_id: str,
    story_id: str,
    beat_id: str,
    link_id: str,
    authorization: str = Header(None)
):
    """Remove a beat-scene link."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify link exists
    link = client.table("backlot_story_beat_scenes").select("id").eq("id", link_id).eq("beat_id", beat_id).execute()
    if not link.data:
        raise HTTPException(status_code=404, detail="Link not found")

    client.table("backlot_story_beat_scenes").delete().eq("id", link_id).execute()

    return {"success": True}


# =====================================================
# Story-Episode Connection Endpoints
# =====================================================

@router.get("/projects/{project_id}/stories/{story_id}/episodes")
async def list_story_episode_links(
    project_id: str,
    story_id: str,
    authorization: str = Header(None)
):
    """List all episodes linked to a story."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Get links with episode data
    links = client.table("backlot_story_episodes").select("*").eq("story_id", story_id).execute()

    # Enrich with episode data
    result = []
    for link in (links.data or []):
        episode = client.table("episodes").select("id, episode_number, episode_code, title, logline").eq("id", link["episode_id"]).execute()
        if episode.data:
            link["episode"] = episode.data[0]
            result.append(link)

    return {"links": result}


@router.post("/projects/{project_id}/stories/{story_id}/episodes")
async def link_story_to_episode(
    project_id: str,
    story_id: str,
    request: StoryEpisodeLinkCreate,
    authorization: str = Header(None)
):
    """Link a story to an episode."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify episode exists and belongs to project
    episode = client.table("episodes").select("id").eq("id", request.episode_id).eq("project_id", project_id).execute()
    if not episode.data:
        raise HTTPException(status_code=404, detail="Episode not found")

    # Check if link already exists
    existing = client.table("backlot_story_episodes").select("id").eq("story_id", story_id).eq("episode_id", request.episode_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Story is already linked to this episode")

    link_data = {
        "story_id": story_id,
        "episode_id": request.episode_id,
        "relationship": request.relationship or 'primary',
        "notes": request.notes,
    }

    result = client.table("backlot_story_episodes").insert(link_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}/episodes/{link_id}")
async def unlink_story_from_episode(
    project_id: str,
    story_id: str,
    link_id: str,
    authorization: str = Header(None)
):
    """Remove a story-episode link."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify link exists
    link = client.table("backlot_story_episodes").select("id").eq("id", link_id).eq("story_id", story_id).execute()
    if not link.data:
        raise HTTPException(status_code=404, detail="Link not found")

    client.table("backlot_story_episodes").delete().eq("id", link_id).execute()

    return {"success": True}


# =====================================================
# Character-Cast Connection Endpoints
# =====================================================

@router.get("/projects/{project_id}/stories/{story_id}/characters/{character_id}/cast")
async def list_character_cast_links(
    project_id: str,
    story_id: str,
    character_id: str,
    authorization: str = Header(None)
):
    """List all cast members linked to a story character."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify character exists
    character = client.table("backlot_story_characters").select("id").eq("id", character_id).eq("story_id", story_id).execute()
    if not character.data:
        raise HTTPException(status_code=404, detail="Character not found")

    # Get links with role data
    links = client.table("backlot_story_character_cast").select("*").eq("character_id", character_id).execute()

    # Enrich with role/cast data
    result = []
    for link in (links.data or []):
        role = client.table("backlot_project_roles").select("id, name, description, cast_member_id").eq("id", link["role_id"]).execute()
        if role.data:
            link["role"] = role.data[0]
            # Get cast member info if assigned
            if role.data[0].get("cast_member_id"):
                cast = client.table("backlot_cast_members").select("id, user_id, role").eq("id", role.data[0]["cast_member_id"]).execute()
                if cast.data:
                    link["cast_member"] = cast.data[0]
            result.append(link)

    return {"links": result}


@router.post("/projects/{project_id}/stories/{story_id}/characters/{character_id}/cast")
async def link_character_to_cast(
    project_id: str,
    story_id: str,
    character_id: str,
    request: CharacterCastLinkCreate,
    authorization: str = Header(None)
):
    """Link a story character to a project role (cast member)."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify character exists
    character = client.table("backlot_story_characters").select("id").eq("id", character_id).eq("story_id", story_id).execute()
    if not character.data:
        raise HTTPException(status_code=404, detail="Character not found")

    # Verify role exists and belongs to project
    role = client.table("backlot_project_roles").select("id").eq("id", request.role_id).eq("project_id", project_id).execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Check if link already exists
    existing = client.table("backlot_story_character_cast").select("id").eq("character_id", character_id).eq("role_id", request.role_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Character is already linked to this role")

    link_data = {
        "character_id": character_id,
        "role_id": request.role_id,
        "notes": request.notes,
    }

    result = client.table("backlot_story_character_cast").insert(link_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create link")

    return result.data[0]


@router.delete("/projects/{project_id}/stories/{story_id}/characters/{character_id}/cast/{link_id}")
async def unlink_character_from_cast(
    project_id: str,
    story_id: str,
    character_id: str,
    link_id: str,
    authorization: str = Header(None)
):
    """Remove a character-cast link."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    client = get_client()

    # Verify link exists
    link = client.table("backlot_story_character_cast").select("id").eq("id", link_id).eq("character_id", character_id).execute()
    if not link.data:
        raise HTTPException(status_code=404, detail="Link not found")

    client.table("backlot_story_character_cast").delete().eq("id", link_id).execute()

    return {"success": True}


# =====================================================
# Beat Sheet Templates
# =====================================================

SAVE_THE_CAT_TEMPLATE = [
    {"title": "Opening Image", "act_marker": "ACT 1", "page_start": 1, "page_end": 1, "emotional_tone": "establishing"},
    {"title": "Theme Stated", "act_marker": "ACT 1", "page_start": 5, "page_end": 5, "emotional_tone": "contemplative"},
    {"title": "Set-Up", "act_marker": "ACT 1", "page_start": 1, "page_end": 10, "emotional_tone": "introducing"},
    {"title": "Catalyst", "act_marker": "ACT 1", "page_start": 12, "page_end": 12, "emotional_tone": "surprising"},
    {"title": "Debate", "act_marker": "ACT 1", "page_start": 12, "page_end": 25, "emotional_tone": "uncertain"},
    {"title": "Break into Two", "act_marker": "ACT 1", "page_start": 25, "page_end": 25, "emotional_tone": "determined"},
    {"title": "B Story", "act_marker": "ACT 2", "page_start": 30, "page_end": 30, "emotional_tone": "warm"},
    {"title": "Fun and Games", "act_marker": "ACT 2", "page_start": 30, "page_end": 55, "emotional_tone": "exciting"},
    {"title": "Midpoint", "act_marker": "ACT 2", "page_start": 55, "page_end": 55, "emotional_tone": "pivotal"},
    {"title": "Bad Guys Close In", "act_marker": "ACT 2", "page_start": 55, "page_end": 75, "emotional_tone": "tense"},
    {"title": "All Is Lost", "act_marker": "ACT 2", "page_start": 75, "page_end": 75, "emotional_tone": "devastating"},
    {"title": "Dark Night of the Soul", "act_marker": "ACT 2", "page_start": 75, "page_end": 85, "emotional_tone": "despairing"},
    {"title": "Break into Three", "act_marker": "ACT 3", "page_start": 85, "page_end": 85, "emotional_tone": "hopeful"},
    {"title": "Finale", "act_marker": "ACT 3", "page_start": 85, "page_end": 110, "emotional_tone": "triumphant"},
    {"title": "Final Image", "act_marker": "ACT 3", "page_start": 110, "page_end": 110, "emotional_tone": "resolved"},
]

THREE_ACT_TEMPLATE = [
    {"title": "Setup", "act_marker": "ACT 1", "page_start": 1, "page_end": 10, "emotional_tone": "establishing"},
    {"title": "Inciting Incident", "act_marker": "ACT 1", "page_start": 10, "page_end": 15, "emotional_tone": "surprising"},
    {"title": "First Act Turn", "act_marker": "ACT 1", "page_start": 25, "page_end": 30, "emotional_tone": "determined"},
    {"title": "Rising Action", "act_marker": "ACT 2", "page_start": 30, "page_end": 55, "emotional_tone": "exciting"},
    {"title": "Midpoint", "act_marker": "ACT 2", "page_start": 55, "page_end": 60, "emotional_tone": "pivotal"},
    {"title": "Complications", "act_marker": "ACT 2", "page_start": 60, "page_end": 85, "emotional_tone": "tense"},
    {"title": "Climax", "act_marker": "ACT 3", "page_start": 85, "page_end": 100, "emotional_tone": "triumphant"},
    {"title": "Resolution", "act_marker": "ACT 3", "page_start": 100, "page_end": 110, "emotional_tone": "resolved"},
]

HEROS_JOURNEY_TEMPLATE = [
    {"title": "Ordinary World", "act_marker": "ACT 1", "page_start": 1, "page_end": 10, "emotional_tone": "establishing"},
    {"title": "Call to Adventure", "act_marker": "ACT 1", "page_start": 10, "page_end": 15, "emotional_tone": "surprising"},
    {"title": "Refusal of the Call", "act_marker": "ACT 1", "page_start": 15, "page_end": 20, "emotional_tone": "uncertain"},
    {"title": "Meeting the Mentor", "act_marker": "ACT 1", "page_start": 20, "page_end": 25, "emotional_tone": "warm"},
    {"title": "Crossing the Threshold", "act_marker": "ACT 1", "page_start": 25, "page_end": 30, "emotional_tone": "determined"},
    {"title": "Tests, Allies, Enemies", "act_marker": "ACT 2", "page_start": 30, "page_end": 55, "emotional_tone": "exciting"},
    {"title": "Approach to Inmost Cave", "act_marker": "ACT 2", "page_start": 55, "page_end": 60, "emotional_tone": "tense"},
    {"title": "Ordeal", "act_marker": "ACT 2", "page_start": 60, "page_end": 75, "emotional_tone": "devastating"},
    {"title": "Reward", "act_marker": "ACT 2", "page_start": 75, "page_end": 85, "emotional_tone": "hopeful"},
    {"title": "The Road Back", "act_marker": "ACT 3", "page_start": 85, "page_end": 95, "emotional_tone": "tense"},
    {"title": "Resurrection", "act_marker": "ACT 3", "page_start": 95, "page_end": 105, "emotional_tone": "triumphant"},
    {"title": "Return with Elixir", "act_marker": "ACT 3", "page_start": 105, "page_end": 110, "emotional_tone": "resolved"},
]

TEMPLATES = {
    "save-the-cat": SAVE_THE_CAT_TEMPLATE,
    "three-act": THREE_ACT_TEMPLATE,
    "heros-journey": HEROS_JOURNEY_TEMPLATE,
}


class ApplyTemplateRequest(BaseModel):
    template: str = Field(..., pattern='^(save-the-cat|three-act|heros-journey)$')


@router.post("/projects/{project_id}/stories/{story_id}/apply-template")
async def apply_template(
    project_id: str,
    story_id: str,
    request: ApplyTemplateRequest,
    authorization: str = Header(None)
):
    """Apply a beat sheet template to a story. Adds template beats to existing beats."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])
    await verify_story_access(story_id, project_id)

    template = TEMPLATES.get(request.template)
    if not template:
        raise HTTPException(status_code=400, detail="Invalid template")

    client = get_client()

    # Get current max sort order
    current_sort = get_next_beat_sort_order(story_id)

    # Insert all template beats
    created_beats = []
    for idx, beat_data in enumerate(template):
        new_beat = {
            "story_id": story_id,
            "sort_order": current_sort + idx,
            "title": beat_data["title"],
            "act_marker": beat_data["act_marker"],
            "page_start": beat_data.get("page_start"),
            "page_end": beat_data.get("page_end"),
            "emotional_tone": beat_data.get("emotional_tone"),
        }
        result = client.table("backlot_story_beats").insert(new_beat).execute()
        if result.data:
            created_beats.append(result.data[0])

    return {
        "success": True,
        "beats_created": len(created_beats),
        "template": request.template,
        "beats": created_beats,
    }


@router.get("/projects/{project_id}/stories/{story_id}/templates")
async def list_templates(
    project_id: str,
    story_id: str,
    authorization: str = Header(None)
):
    """Get available beat sheet templates."""
    user = await get_current_user_from_token(authorization)
    await verify_project_access(project_id, user["id"])

    return {
        "templates": [
            {"id": "save-the-cat", "name": "Save the Cat", "beat_count": 15, "description": "Blake Snyder's 15-beat structure"},
            {"id": "three-act", "name": "Three-Act Structure", "beat_count": 8, "description": "Classic three-act screenplay structure"},
            {"id": "heros-journey", "name": "Hero's Journey", "beat_count": 12, "description": "Joseph Campbell's monomyth structure"},
        ]
    }


@router.get("/projects/{project_id}/stories/{story_id}/export.pdf")
async def export_beat_sheet_pdf(
    project_id: str,
    story_id: str,
    authorization: str = Header(None),
    token: str = Query(None)  # Allow token as query param for new window opening
):
    """Export beat sheet as PDF with full page per beat."""
    auth_token = authorization or (f"Bearer {token}" if token else None)
    user = await get_current_user_from_token(auth_token)
    await verify_project_access(project_id, user["id"])

    client = get_client()

    # Get project info
    project = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project.data[0]["title"] if project.data else "Project"

    # Get story with beats and characters
    story = client.table("backlot_stories").select("*").eq("id", story_id).eq("project_id", project_id).execute()
    if not story.data:
        raise HTTPException(status_code=404, detail="Beat sheet not found")

    beat_sheet = story.data[0]

    # Get beats ordered
    beats = client.table("backlot_story_beats").select("*").eq("story_id", story_id).order("sort_order").execute()

    # Get characters
    characters = client.table("backlot_story_characters").select("*").eq("story_id", story_id).order("name").execute()

    # Get all character arcs for beats
    beat_ids = [b["id"] for b in (beats.data or [])]
    character_arcs_by_beat: Dict[str, List[Dict]] = {bid: [] for bid in beat_ids}

    if beat_ids:
        arcs = client.table("backlot_character_arcs").select("*").in_("beat_id", beat_ids).execute()
        for arc in (arcs.data or []):
            if arc["beat_id"] in character_arcs_by_beat:
                character_arcs_by_beat[arc["beat_id"]].append(arc)

    # Get scene links for beats
    scene_links_by_beat: Dict[str, List[Dict]] = {bid: [] for bid in beat_ids}

    if beat_ids:
        links = client.table("backlot_story_beat_scenes").select("*, scene:backlot_scenes(*)").in_("beat_id", beat_ids).execute()
        for link in (links.data or []):
            if link["beat_id"] in scene_links_by_beat:
                scene_links_by_beat[link["beat_id"]].append(link)

    # Generate HTML
    from app.services.beat_sheet_pdf_service import generate_beat_sheet_pdf_html

    html = generate_beat_sheet_pdf_html(
        project_title=project_title,
        beat_sheet_title=beat_sheet.get("title", "Beat Sheet"),
        beat_sheet=beat_sheet,
        beats=beats.data or [],
        characters=characters.data or [],
        character_arcs_by_beat=character_arcs_by_beat,
        scene_links_by_beat=scene_links_by_beat,
    )

    # Generate PDF
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    # Return PDF response
    filename = f"{beat_sheet.get('title', 'beat_sheet').replace(' ', '_')}_beat_sheet.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
