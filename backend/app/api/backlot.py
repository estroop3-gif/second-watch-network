"""
Backlot API Endpoints
Handles AI co-pilot chat, call sheet distribution, and other Backlot-specific functionality
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from app.services.ai_service import get_ai_response
from app.services.email_service import (
    EmailService,
    generate_call_sheet_email_html,
    generate_call_sheet_text
)
from app.services.pdf_service import generate_call_sheet_pdf
from fastapi.responses import Response
import uuid
from app.core.supabase import get_supabase_client, get_supabase_admin_client
from app.core.config import settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class CopilotRequest(BaseModel):
    messages: List[ChatMessage]
    project_context: Optional[Dict[str, Any]] = None


class CopilotResponse(BaseModel):
    response: str
    success: bool = True


@router.post("/copilot/chat", response_model=CopilotResponse)
async def copilot_chat(request: CopilotRequest):
    """
    Send a message to the Backlot AI co-pilot

    Args:
        request: Chat messages and optional project context

    Returns:
        AI response
    """
    try:
        # Convert messages to the format expected by AI service
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        # Get AI response
        response = await get_ai_response(
            messages=messages,
            project_context=request.project_context
        )

        return CopilotResponse(response=response, success=True)

    except Exception as e:
        print(f"Copilot error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get AI response. Please try again."
        )


@router.get("/copilot/health")
async def copilot_health():
    """Check if the AI copilot is available"""
    from app.core.config import settings

    has_anthropic = bool(settings.ANTHROPIC_API_KEY)
    has_openai = bool(settings.OPENAI_API_KEY)

    return {
        "available": has_anthropic or has_openai,
        "providers": {
            "anthropic": has_anthropic,
            "openai": has_openai
        },
        "fallback_mode": not (has_anthropic or has_openai)
    }


# =====================================================
# Call Sheet Send Models
# =====================================================

class CallSheetSendRequest(BaseModel):
    """Request to send a call sheet"""
    channel: Literal["email", "notification", "email_and_notification"] = "email_and_notification"
    recipient_mode: Literal["all_project_members", "call_sheet_people", "custom"] = "all_project_members"
    recipient_user_ids: Optional[List[str]] = None
    extra_emails: Optional[List[str]] = None
    message: Optional[str] = None


class CallSheetSendResponse(BaseModel):
    """Response from sending a call sheet"""
    success: bool
    send_id: Optional[str] = None
    emails_sent: int = 0
    notifications_sent: int = 0
    total_recipients: int = 0
    message: str = ""


class CallSheetSendHistory(BaseModel):
    """Record of a call sheet send"""
    id: str
    sent_at: datetime
    sent_by_name: Optional[str] = None
    channel: str
    recipient_count: int
    emails_sent: int
    notifications_sent: int
    message: Optional[str] = None


# =====================================================
# Helper Functions
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    supabase = get_supabase_admin_client()

    try:
        # Verify the token with Supabase
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user_response.user.id, "email": user_response.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_access(
    supabase,
    project_id: str,
    user_id: str,
    require_edit: bool = False
) -> Dict[str, Any]:
    """Verify user has access to project and return project data"""
    # Get project
    project_response = supabase.table("backlot_projects").select("*").eq("id", project_id).execute()

    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_response.data[0]

    # Check if owner
    if project["owner_id"] == user_id:
        return project

    # Check membership
    member_response = supabase.table("backlot_project_members").select("*").eq("project_id", project_id).eq("user_id", user_id).execute()

    if not member_response.data:
        raise HTTPException(status_code=403, detail="You don't have access to this project")

    member = member_response.data[0]

    if require_edit and member["role"] not in ["owner", "admin", "editor"]:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this project")

    return project


# =====================================================
# Call Sheet Send Endpoints
# =====================================================

@router.post("/call-sheets/{call_sheet_id}/send", response_model=CallSheetSendResponse)
async def send_call_sheet(
    call_sheet_id: str,
    request: CallSheetSendRequest,
    authorization: str = Header(None)
):
    """
    Send a call sheet to selected recipients via email and/or notification

    Args:
        call_sheet_id: ID of the call sheet to send
        request: Send configuration (channel, recipients, message)

    Returns:
        Send result with counts
    """
    # Authenticate user
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()  # Use admin client for full access

    # Get call sheet
    sheet_response = supabase.table("backlot_call_sheets").select("*").eq("id", call_sheet_id).execute()

    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    call_sheet = sheet_response.data[0]
    project_id = call_sheet["project_id"]

    # Verify access
    project = await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Get call sheet people
    people_response = supabase.table("backlot_call_sheet_people").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    call_sheet_people = people_response.data or []

    # Determine recipients based on mode
    recipients = []

    if request.recipient_mode == "all_project_members":
        # Get all project members
        members_response = supabase.table("backlot_project_members").select("*, profiles(id, email, full_name, display_name)").eq("project_id", project_id).execute()

        for member in members_response.data or []:
            profile = member.get("profiles")
            if profile:
                email = member.get("email") or profile.get("email")
                if email:
                    recipients.append({
                        "user_id": member["user_id"],
                        "email": email,
                        "name": profile.get("display_name") or profile.get("full_name") or email
                    })

        # Also add the project owner
        owner_response = supabase.table("profiles").select("id, email, full_name, display_name").eq("id", project["owner_id"]).execute()
        if owner_response.data:
            owner = owner_response.data[0]
            owner_email = owner.get("email")
            if owner_email and not any(r["email"] == owner_email for r in recipients):
                recipients.append({
                    "user_id": project["owner_id"],
                    "email": owner_email,
                    "name": owner.get("display_name") or owner.get("full_name") or owner_email
                })

    elif request.recipient_mode == "call_sheet_people":
        # Get people from call sheet with emails
        for person in call_sheet_people:
            email = person.get("email")
            if email:
                recipients.append({
                    "user_id": person.get("member_id"),  # May be null for external people
                    "email": email,
                    "name": person.get("name", email)
                })

    elif request.recipient_mode == "custom":
        # Use provided user IDs
        if request.recipient_user_ids:
            for uid in request.recipient_user_ids:
                # Get user profile
                profile_response = supabase.table("profiles").select("id, email, full_name, display_name").eq("id", uid).execute()
                if profile_response.data:
                    profile = profile_response.data[0]
                    if profile.get("email"):
                        recipients.append({
                            "user_id": uid,
                            "email": profile["email"],
                            "name": profile.get("display_name") or profile.get("full_name") or profile["email"]
                        })

    # Add extra emails (external guests)
    if request.extra_emails:
        for email in request.extra_emails:
            email = email.strip()
            if email and not any(r["email"] == email for r in recipients):
                recipients.append({
                    "user_id": None,
                    "email": email,
                    "name": email
                })

    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients found for this send configuration")

    # Get sender info
    sender_response = supabase.table("profiles").select("full_name, display_name").eq("id", user_id).execute()
    sender_name = ""
    if sender_response.data:
        sender = sender_response.data[0]
        sender_name = sender.get("display_name") or sender.get("full_name") or "Production Team"

    # Format call sheet data for email
    from datetime import datetime as dt
    call_date_str = call_sheet.get("date", "")
    try:
        call_date = dt.strptime(call_date_str, "%Y-%m-%d")
        call_date_formatted = call_date.strftime("%A, %B %d, %Y")
    except:
        call_date_formatted = call_date_str

    # Generate view URL
    view_url = f"{settings.FRONTEND_URL}/backlot/projects/{project_id}?view=call-sheets&sheet={call_sheet_id}"

    # Generate email HTML
    email_html = generate_call_sheet_email_html(
        project_title=project.get("title", ""),
        call_sheet_title=call_sheet.get("title", "Call Sheet"),
        call_date=call_date_formatted,
        call_time=call_sheet.get("general_call_time", ""),
        location_name=call_sheet.get("location_name", ""),
        location_address=call_sheet.get("location_address", ""),
        schedule_blocks=call_sheet.get("schedule_blocks", []),
        people=call_sheet_people,
        special_instructions=call_sheet.get("special_instructions"),
        weather_info=call_sheet.get("weather_info"),
        safety_notes=call_sheet.get("safety_notes"),
        hospital_name=call_sheet.get("hospital_name"),
        hospital_address=call_sheet.get("hospital_address"),
        hospital_phone=call_sheet.get("hospital_phone"),
        sender_name=sender_name,
        sender_message=request.message,
        view_url=view_url
    )

    # Generate text version
    email_text = generate_call_sheet_text(
        project_title=project.get("title", ""),
        call_sheet_title=call_sheet.get("title", "Call Sheet"),
        call_date=call_date_formatted,
        call_time=call_sheet.get("general_call_time", ""),
        location_name=call_sheet.get("location_name", ""),
        location_address=call_sheet.get("location_address", ""),
        schedule_blocks=call_sheet.get("schedule_blocks", []),
        people=call_sheet_people,
        special_instructions=call_sheet.get("special_instructions"),
        sender_message=request.message
    )

    emails_sent = 0
    notifications_sent = 0

    # Send emails if requested
    if request.channel in ["email", "email_and_notification"]:
        email_addresses = [r["email"] for r in recipients if r.get("email")]
        if email_addresses:
            subject = f"Call Sheet: {call_sheet.get('title', 'Production Update')} - {project.get('title', '')}"
            result = await EmailService.send_email(
                to_emails=email_addresses,
                subject=subject,
                html_content=email_html,
                text_content=email_text
            )
            if result.get("success"):
                emails_sent = len(email_addresses)

    # Send notifications if requested
    if request.channel in ["notification", "email_and_notification"]:
        for recipient in recipients:
            if recipient.get("user_id"):
                try:
                    notification_data = {
                        "user_id": recipient["user_id"],
                        "title": f"Call Sheet: {call_sheet.get('title', '')}",
                        "body": f"{project.get('title', '')} - {call_date_formatted}",
                        "type": "call_sheet",
                        "related_id": call_sheet_id,
                        "payload": {
                            "project_id": project_id,
                            "call_sheet_id": call_sheet_id,
                            "call_date": call_sheet.get("date"),
                            "message": request.message
                        },
                        "status": "unread"
                    }
                    supabase.table("notifications").insert(notification_data).execute()
                    notifications_sent += 1
                except Exception as e:
                    print(f"Failed to create notification for {recipient['user_id']}: {e}")

    # Log the send
    send_log = {
        "call_sheet_id": call_sheet_id,
        "project_id": project_id,
        "sent_by_user_id": user_id,
        "recipients": recipients,
        "channel": request.channel,
        "message": request.message,
        "recipient_count": len(recipients),
        "emails_sent": emails_sent,
        "notifications_sent": notifications_sent
    }

    log_response = supabase.table("backlot_call_sheet_sends").insert(send_log).execute()
    send_id = log_response.data[0]["id"] if log_response.data else None

    # Auto-publish if not already published
    if not call_sheet.get("is_published"):
        supabase.table("backlot_call_sheets").update({
            "is_published": True,
            "published_at": datetime.utcnow().isoformat()
        }).eq("id", call_sheet_id).execute()

    return CallSheetSendResponse(
        success=True,
        send_id=send_id,
        emails_sent=emails_sent,
        notifications_sent=notifications_sent,
        total_recipients=len(recipients),
        message=f"Call sheet sent to {len(recipients)} recipient(s)"
    )


@router.get("/call-sheets/{call_sheet_id}/send-history", response_model=List[CallSheetSendHistory])
async def get_call_sheet_send_history(
    call_sheet_id: str,
    authorization: str = Header(None)
):
    """Get send history for a call sheet"""
    # Authenticate user
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()

    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]

    # Verify access
    await verify_project_access(supabase, project_id, user_id)

    # Get send history
    history_response = supabase.table("backlot_call_sheet_sends").select("*, profiles:sent_by_user_id(full_name, display_name)").eq("call_sheet_id", call_sheet_id).order("sent_at", desc=True).execute()

    result = []
    for record in history_response.data or []:
        profile = record.get("profiles")
        sent_by_name = None
        if profile:
            sent_by_name = profile.get("display_name") or profile.get("full_name")

        result.append(CallSheetSendHistory(
            id=record["id"],
            sent_at=record["sent_at"],
            sent_by_name=sent_by_name,
            channel=record["channel"],
            recipient_count=record.get("recipient_count", 0),
            emails_sent=record.get("emails_sent", 0),
            notifications_sent=record.get("notifications_sent", 0),
            message=record.get("message")
        ))

    return result


@router.get("/projects/{project_id}/members-for-send")
async def get_project_members_for_send(
    project_id: str,
    authorization: str = Header(None)
):
    """Get project members for recipient selection in send modal"""
    # Authenticate user
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Verify access
    project = await verify_project_access(supabase, project_id, user_id)

    # Get all project members with profiles
    members_response = supabase.table("backlot_project_members").select("*, profiles:user_id(id, email, full_name, display_name, avatar_url)").eq("project_id", project_id).execute()

    result = []

    # Add owner
    owner_response = supabase.table("profiles").select("id, email, full_name, display_name, avatar_url").eq("id", project["owner_id"]).execute()
    if owner_response.data:
        owner = owner_response.data[0]
        result.append({
            "user_id": owner["id"],
            "name": owner.get("display_name") or owner.get("full_name") or owner.get("email"),
            "email": owner.get("email"),
            "avatar_url": owner.get("avatar_url"),
            "role": "owner",
            "production_role": "Owner"
        })

    # Add members
    for member in members_response.data or []:
        profile = member.get("profiles")
        if profile and profile["id"] != project["owner_id"]:
            result.append({
                "user_id": profile["id"],
                "name": profile.get("display_name") or profile.get("full_name") or profile.get("email"),
                "email": member.get("email") or profile.get("email"),
                "avatar_url": profile.get("avatar_url"),
                "role": member.get("role"),
                "production_role": member.get("production_role")
            })

    return result


# =====================================================
# Call Sheet Scene Models
# =====================================================

class CallSheetSceneInput(BaseModel):
    """Input for creating/updating a call sheet scene"""
    scene_number: Optional[str] = None
    segment_label: Optional[str] = None
    page_count: Optional[str] = None
    set_name: str
    int_ext: Optional[str] = None
    time_of_day: Optional[str] = None
    description: Optional[str] = None
    cast_ids: Optional[str] = None
    cast_names: Optional[str] = None
    location_id: Optional[str] = None
    sort_order: Optional[int] = 0


class CallSheetScene(BaseModel):
    """Call sheet scene/segment"""
    id: str
    call_sheet_id: str
    scene_number: Optional[str] = None
    segment_label: Optional[str] = None
    page_count: Optional[str] = None
    set_name: str
    int_ext: Optional[str] = None
    time_of_day: Optional[str] = None
    description: Optional[str] = None
    cast_ids: Optional[str] = None
    cast_names: Optional[str] = None
    location_id: Optional[str] = None
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime


# =====================================================
# Call Sheet Location Models (Multiple Locations Support)
# =====================================================

class CallSheetLocationInput(BaseModel):
    """Input for a call sheet location entry"""
    location_number: int = 1
    location_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    parking_instructions: Optional[str] = None
    basecamp_location: Optional[str] = None
    call_time: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = 0


class CallSheetLocation(BaseModel):
    """A call sheet location entry"""
    id: str
    call_sheet_id: str
    location_number: int = 1
    location_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    parking_instructions: Optional[str] = None
    basecamp_location: Optional[str] = None
    call_time: Optional[str] = None
    notes: Optional[str] = None
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime


# =====================================================
# Call Sheet Scene Endpoints
# =====================================================

@router.get("/call-sheets/{call_sheet_id}/scenes", response_model=List[CallSheetScene])
async def get_call_sheet_scenes(
    call_sheet_id: str,
    authorization: str = Header(None)
):
    """Get all scenes for a call sheet"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id)

    # Get scenes
    scenes_response = supabase.table("backlot_call_sheet_scenes").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()

    return scenes_response.data or []


@router.post("/call-sheets/{call_sheet_id}/scenes", response_model=CallSheetScene)
async def create_call_sheet_scene(
    call_sheet_id: str,
    scene: CallSheetSceneInput,
    authorization: str = Header(None)
):
    """Create a new scene for a call sheet"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Get next sort order
    max_order_response = supabase.table("backlot_call_sheet_scenes").select("sort_order").eq("call_sheet_id", call_sheet_id).order("sort_order", desc=True).limit(1).execute()
    next_order = (max_order_response.data[0]["sort_order"] + 1) if max_order_response.data else 0

    # Create scene
    scene_data = scene.model_dump()
    scene_data["call_sheet_id"] = call_sheet_id
    if scene_data.get("sort_order") is None:
        scene_data["sort_order"] = next_order

    result = supabase.table("backlot_call_sheet_scenes").insert(scene_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create scene")

    return result.data[0]


@router.put("/call-sheets/{call_sheet_id}/scenes/{scene_id}", response_model=CallSheetScene)
async def update_call_sheet_scene(
    call_sheet_id: str,
    scene_id: str,
    scene: CallSheetSceneInput,
    authorization: str = Header(None)
):
    """Update a call sheet scene"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Update scene
    scene_data = scene.model_dump(exclude_unset=True)
    scene_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_call_sheet_scenes").update(scene_data).eq("id", scene_id).eq("call_sheet_id", call_sheet_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Scene not found")

    return result.data[0]


@router.delete("/call-sheets/{call_sheet_id}/scenes/{scene_id}")
async def delete_call_sheet_scene(
    call_sheet_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """Delete a call sheet scene"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Delete scene
    supabase.table("backlot_call_sheet_scenes").delete().eq("id", scene_id).eq("call_sheet_id", call_sheet_id).execute()

    return {"success": True, "message": "Scene deleted"}


@router.post("/call-sheets/{call_sheet_id}/scenes/reorder")
async def reorder_call_sheet_scenes(
    call_sheet_id: str,
    scene_ids: List[str],
    authorization: str = Header(None)
):
    """Reorder scenes in a call sheet"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Update sort orders
    for index, scene_id in enumerate(scene_ids):
        supabase.table("backlot_call_sheet_scenes").update({"sort_order": index}).eq("id", scene_id).eq("call_sheet_id", call_sheet_id).execute()

    return {"success": True, "message": "Scenes reordered"}


# =====================================================
# Call Sheet Locations Endpoints (Multiple Locations)
# =====================================================

@router.get("/call-sheets/{call_sheet_id}/locations", response_model=List[CallSheetLocation])
async def get_call_sheet_locations(
    call_sheet_id: str,
    authorization: str = Header(None)
):
    """Get all locations for a call sheet"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id)

    # Get locations
    locations_response = supabase.table("backlot_call_sheet_locations").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()

    return locations_response.data or []


@router.post("/call-sheets/{call_sheet_id}/locations", response_model=CallSheetLocation)
async def create_call_sheet_location(
    call_sheet_id: str,
    location: CallSheetLocationInput,
    authorization: str = Header(None)
):
    """Add a new location to a call sheet"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Get next location number and sort order
    max_response = supabase.table("backlot_call_sheet_locations").select("location_number, sort_order").eq("call_sheet_id", call_sheet_id).order("location_number", desc=True).limit(1).execute()
    next_number = (max_response.data[0]["location_number"] + 1) if max_response.data else 1
    next_order = (max_response.data[0]["sort_order"] + 1) if max_response.data else 0

    # Create location
    location_data = location.model_dump()
    location_data["call_sheet_id"] = call_sheet_id
    if location_data.get("location_number") is None or location_data.get("location_number") == 1:
        location_data["location_number"] = next_number
    if location_data.get("sort_order") is None:
        location_data["sort_order"] = next_order

    result = supabase.table("backlot_call_sheet_locations").insert(location_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create location")

    return result.data[0]


@router.put("/call-sheets/{call_sheet_id}/locations/{location_entry_id}", response_model=CallSheetLocation)
async def update_call_sheet_location(
    call_sheet_id: str,
    location_entry_id: str,
    location: CallSheetLocationInput,
    authorization: str = Header(None)
):
    """Update a call sheet location"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Update location
    location_data = location.model_dump(exclude_unset=True)
    location_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_call_sheet_locations").update(location_data).eq("id", location_entry_id).eq("call_sheet_id", call_sheet_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Location not found")

    return result.data[0]


@router.delete("/call-sheets/{call_sheet_id}/locations/{location_entry_id}")
async def delete_call_sheet_location(
    call_sheet_id: str,
    location_entry_id: str,
    authorization: str = Header(None)
):
    """Delete a call sheet location"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet to verify access
    sheet_response = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    project_id = sheet_response.data[0]["project_id"]
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Delete location
    supabase.table("backlot_call_sheet_locations").delete().eq("id", location_entry_id).eq("call_sheet_id", call_sheet_id).execute()

    return {"success": True, "message": "Location deleted"}


# =====================================================
# PDF Generation Models & Endpoints
# =====================================================

class PdfGenerateRequest(BaseModel):
    """Request to generate a PDF"""
    regenerate: bool = False
    include_logo: bool = True


class PdfGenerateResponse(BaseModel):
    """Response from PDF generation"""
    success: bool
    pdf_url: str = ""
    generated_at: str = ""
    message: str = ""


@router.post("/call-sheets/{call_sheet_id}/generate-pdf", response_model=PdfGenerateResponse)
async def generate_call_sheet_pdf(
    call_sheet_id: str,
    request: PdfGenerateRequest = PdfGenerateRequest(),
    authorization: str = Header(None)
):
    """
    Generate a PDF for a call sheet

    This endpoint generates a professional PDF from the call sheet data
    and stores it for download.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet with all related data
    sheet_response = supabase.table("backlot_call_sheets").select("*").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    call_sheet = sheet_response.data[0]
    project_id = call_sheet["project_id"]

    # Verify access
    project = await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Check if PDF already exists and regenerate not requested
    if call_sheet.get("pdf_url") and not request.regenerate:
        return PdfGenerateResponse(
            success=True,
            pdf_url=call_sheet["pdf_url"],
            generated_at=call_sheet.get("pdf_generated_at", ""),
            message="PDF already exists. Use regenerate=true to create a new one."
        )

    # Get scenes
    scenes_response = supabase.table("backlot_call_sheet_scenes").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    scenes = scenes_response.data or []

    # Get people
    people_response = supabase.table("backlot_call_sheet_people").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    people = people_response.data or []

    # Get locations
    locations_response = supabase.table("backlot_call_sheet_locations").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    locations = locations_response.data or []

    # Get logo if requested
    logo_url = None
    if request.include_logo:
        logo_url = call_sheet.get("header_logo_url") or project.get("header_logo_url")

    try:
        # Generate PDF using WeasyPrint
        pdf_bytes = await generate_call_sheet_pdf(
            call_sheet=call_sheet,
            project=project,
            scenes=scenes,
            people=people,
            locations=locations,
            logo_url=logo_url,
        )

        # Generate a unique filename
        call_date = call_sheet.get("date", "").replace("-", "")
        safe_title = "".join(c if c.isalnum() else "_" for c in call_sheet.get("title", "callsheet"))
        filename = f"{safe_title}_{call_date}_{uuid.uuid4().hex[:8]}.pdf"

        # Upload to Supabase Storage
        storage_path = f"call-sheets/{project_id}/{filename}"

        # Upload the PDF to storage
        storage_response = supabase.storage.from_("backlot-files").upload(
            path=storage_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )

        # Get the public URL
        pdf_url = supabase.storage.from_("backlot-files").get_public_url(storage_path)

        generated_at = datetime.utcnow().isoformat()

        # Update the call sheet with the PDF URL
        supabase.table("backlot_call_sheets").update({
            "pdf_url": pdf_url,
            "pdf_generated_at": generated_at
        }).eq("id", call_sheet_id).execute()

        return PdfGenerateResponse(
            success=True,
            pdf_url=pdf_url,
            generated_at=generated_at,
            message="PDF generated successfully"
        )

    except ImportError as e:
        return PdfGenerateResponse(
            success=False,
            pdf_url="",
            generated_at=datetime.utcnow().isoformat(),
            message=f"PDF generation requires WeasyPrint. Error: {str(e)}"
        )
    except Exception as e:
        return PdfGenerateResponse(
            success=False,
            pdf_url="",
            generated_at=datetime.utcnow().isoformat(),
            message=f"PDF generation failed: {str(e)}"
        )


@router.get("/call-sheets/{call_sheet_id}/download-pdf")
async def download_call_sheet_pdf(
    call_sheet_id: str,
    authorization: str = Header(None)
):
    """
    Download a PDF for a call sheet (direct bytes response)

    This endpoint generates and returns a PDF immediately without storing it.
    Use this for quick downloads; use generate-pdf for persisted storage.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet
    sheet_response = supabase.table("backlot_call_sheets").select("*").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    call_sheet = sheet_response.data[0]
    project_id = call_sheet["project_id"]

    # Verify access (only need view access for download)
    project = await verify_project_access(supabase, project_id, user_id, require_edit=False)

    # Get related data
    scenes_response = supabase.table("backlot_call_sheet_scenes").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    scenes = scenes_response.data or []

    people_response = supabase.table("backlot_call_sheet_people").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    people = people_response.data or []

    locations_response = supabase.table("backlot_call_sheet_locations").select("*").eq("call_sheet_id", call_sheet_id).order("sort_order").execute()
    locations = locations_response.data or []

    # Get logo
    logo_url = call_sheet.get("header_logo_url") or project.get("header_logo_url")

    try:
        # Generate PDF
        pdf_bytes = await generate_call_sheet_pdf(
            call_sheet=call_sheet,
            project=project,
            scenes=scenes,
            people=people,
            locations=locations,
            logo_url=logo_url,
        )

        # Create filename
        call_date = call_sheet.get("date", "").replace("-", "")
        safe_title = "".join(c if c.isalnum() else "_" for c in call_sheet.get("title", "callsheet"))
        filename = f"{safe_title}_{call_date}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


# =====================================================
# Logo Upload Models & Endpoints
# =====================================================

class LogoUploadResponse(BaseModel):
    """Response from logo upload"""
    success: bool
    logo_url: str = ""
    message: str = ""


@router.post("/projects/{project_id}/upload-logo", response_model=LogoUploadResponse)
async def upload_project_logo(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Upload a logo for project call sheets

    Note: This endpoint expects the file to be uploaded via multipart form data.
    For the current implementation, the frontend will upload directly to Supabase Storage
    and then call this endpoint to update the project with the logo URL.
    """
    # This is a placeholder - actual file upload would need FastAPI's File/UploadFile
    # In the current architecture, we handle file uploads on the frontend via Supabase Storage
    # and just update the database record here

    raise HTTPException(
        status_code=501,
        detail="Logo upload is handled directly via Supabase Storage on the frontend. "
               "Use the /projects/{project_id}/set-logo endpoint to set the logo URL after uploading."
    )


class SetLogoRequest(BaseModel):
    """Request to set logo URL"""
    logo_url: str


@router.post("/projects/{project_id}/set-logo", response_model=LogoUploadResponse)
async def set_project_logo(
    project_id: str,
    request: SetLogoRequest,
    authorization: str = Header(None)
):
    """Set the logo URL for a project (after uploading to storage)"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Verify access
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    # Update project with logo URL
    result = supabase.table("backlot_projects").update({
        "header_logo_url": request.logo_url
    }).eq("id", project_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update project logo")

    return LogoUploadResponse(
        success=True,
        logo_url=request.logo_url,
        message="Project logo updated successfully"
    )


# =====================================================
# Sync Models & Endpoints
# =====================================================

class SyncRequest(BaseModel):
    """Request to sync call sheet data to other Backlot tools"""
    sync_production_day: bool = True
    sync_locations: bool = True
    sync_tasks: bool = True


class SyncResponse(BaseModel):
    """Response from sync operation"""
    success: bool
    production_day_synced: bool = False
    locations_created: int = 0
    tasks_created: int = 0
    message: str = ""


@router.post("/call-sheets/{call_sheet_id}/sync", response_model=SyncResponse)
async def sync_call_sheet_data(
    call_sheet_id: str,
    request: SyncRequest,
    authorization: str = Header(None)
):
    """
    Sync call sheet data to other Backlot tools

    This will:
    - Create/update a production day from the call sheet
    - Create locations from unique location entries
    - Create tasks for department prep items
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get call sheet with all data
    sheet_response = supabase.table("backlot_call_sheets").select("*").eq("id", call_sheet_id).execute()
    if not sheet_response.data:
        raise HTTPException(status_code=404, detail="Call sheet not found")

    call_sheet = sheet_response.data[0]
    project_id = call_sheet["project_id"]

    # Verify access
    await verify_project_access(supabase, project_id, user_id, require_edit=True)

    production_day_synced = False
    locations_created = 0
    tasks_created = 0

    # Sync Production Day
    if request.sync_production_day:
        production_day_id = call_sheet.get("production_day_id")

        # Get primary location from call sheet locations table
        primary_location = supabase.table("backlot_call_sheet_locations").select("*").eq("call_sheet_id", call_sheet_id).eq("location_number", 1).execute()
        primary_loc = primary_location.data[0] if primary_location.data else None

        day_data = {
            "project_id": project_id,
            "date": call_sheet["date"],
            "title": call_sheet.get("title"),
            "general_call_time": call_sheet.get("general_call_time") or call_sheet.get("crew_call_time"),
            "wrap_time": call_sheet.get("estimated_wrap_time"),
            "location_name": primary_loc.get("name") if primary_loc else call_sheet.get("location_name"),
            "location_address": primary_loc.get("address") if primary_loc else call_sheet.get("location_address"),
            "weather_notes": call_sheet.get("weather_forecast") or call_sheet.get("weather_info"),
            "notes": call_sheet.get("general_notes"),
        }

        # Add day number if available
        if call_sheet.get("shoot_day_number"):
            day_data["day_number"] = call_sheet["shoot_day_number"]

        if production_day_id:
            # Update existing production day
            supabase.table("backlot_production_days").update(day_data).eq("id", production_day_id).execute()
            production_day_synced = True
        else:
            # Check if a production day exists for this date
            existing_day = supabase.table("backlot_production_days").select("id").eq("project_id", project_id).eq("date", call_sheet["date"]).execute()

            if existing_day.data:
                # Link and update existing day
                production_day_id = existing_day.data[0]["id"]
                supabase.table("backlot_production_days").update(day_data).eq("id", production_day_id).execute()
                supabase.table("backlot_call_sheets").update({"production_day_id": production_day_id}).eq("id", call_sheet_id).execute()
            else:
                # Get next day number
                if not day_data.get("day_number"):
                    max_day = supabase.table("backlot_production_days").select("day_number").eq("project_id", project_id).order("day_number", desc=True).limit(1).execute()
                    day_data["day_number"] = (max_day.data[0]["day_number"] + 1) if max_day.data else 1

                # Create new production day
                result = supabase.table("backlot_production_days").insert(day_data).execute()
                if result.data:
                    production_day_id = result.data[0]["id"]
                    supabase.table("backlot_call_sheets").update({"production_day_id": production_day_id}).eq("id", call_sheet_id).execute()

            production_day_synced = True

    # Sync Locations from call sheet locations and scenes
    if request.sync_locations:
        # Sync from call sheet locations table
        cs_locations = supabase.table("backlot_call_sheet_locations").select("*").eq("call_sheet_id", call_sheet_id).is_("location_id", "null").execute()

        for cs_loc in cs_locations.data or []:
            loc_name = cs_loc.get("name")
            if loc_name:
                # Check if location already exists
                existing = supabase.table("backlot_locations").select("id").eq("project_id", project_id).eq("name", loc_name).execute()

                if not existing.data:
                    # Create new location
                    location_data = {
                        "project_id": project_id,
                        "name": loc_name,
                        "address": cs_loc.get("address"),
                        "parking_notes": cs_loc.get("parking_instructions"),
                    }
                    result = supabase.table("backlot_locations").insert(location_data).execute()

                    if result.data:
                        # Link call sheet location to master location
                        supabase.table("backlot_call_sheet_locations").update({"location_id": result.data[0]["id"]}).eq("id", cs_loc["id"]).execute()
                        locations_created += 1
                else:
                    # Link to existing location
                    supabase.table("backlot_call_sheet_locations").update({"location_id": existing.data[0]["id"]}).eq("id", cs_loc["id"]).execute()

        # Sync from scenes
        scenes_response = supabase.table("backlot_call_sheet_scenes").select("*").eq("call_sheet_id", call_sheet_id).is_("location_id", "null").execute()

        for scene in scenes_response.data or []:
            set_name = scene.get("set_name")
            if set_name:
                # Check if location already exists
                existing = supabase.table("backlot_locations").select("id").eq("project_id", project_id).eq("name", set_name).execute()

                if not existing.data:
                    # Create new location
                    location_data = {
                        "project_id": project_id,
                        "name": set_name,
                        "scene_description": scene.get("description"),
                    }
                    result = supabase.table("backlot_locations").insert(location_data).execute()

                    if result.data:
                        # Link scene to location
                        supabase.table("backlot_call_sheet_scenes").update({"location_id": result.data[0]["id"]}).eq("id", scene["id"]).execute()
                        locations_created += 1
                else:
                    # Link scene to existing location
                    supabase.table("backlot_call_sheet_scenes").update({"location_id": existing.data[0]["id"]}).eq("id", scene["id"]).execute()

    # Sync Tasks from department notes
    if request.sync_tasks:
        department_notes = [
            ("camera_notes", "Camera Department"),
            ("sound_notes", "Sound Department"),
            ("grip_electric_notes", "Grip & Electric"),
            ("art_notes", "Art Department"),
            ("wardrobe_notes", "Wardrobe"),
            ("makeup_hair_notes", "Makeup & Hair"),
            ("stunts_notes", "Stunts"),
            ("vfx_notes", "VFX"),
            ("transport_notes", "Transportation"),
            ("catering_notes", "Catering"),
        ]

        production_day_id = call_sheet.get("production_day_id")

        for note_field, department in department_notes:
            note_content = call_sheet.get(note_field)
            if note_content and note_content.strip():
                # Check if task already exists from this call sheet for this department
                existing_task = supabase.table("backlot_tasks").select("id").eq("source_call_sheet_id", call_sheet_id).eq("department", department).execute()

                if not existing_task.data:
                    task_data = {
                        "project_id": project_id,
                        "title": f"{department} - {call_sheet.get('title', 'Call Sheet')}",
                        "description": note_content,
                        "department": department,
                        "due_date": call_sheet["date"],
                        "status": "todo",
                        "priority": "medium",
                        "production_day_id": production_day_id,
                        "source_type": "call_sheet",
                        "source_call_sheet_id": call_sheet_id,
                        "created_by": user_id,
                    }
                    result = supabase.table("backlot_tasks").insert(task_data).execute()
                    if result.data:
                        tasks_created += 1

    return SyncResponse(
        success=True,
        production_day_synced=production_day_synced,
        locations_created=locations_created,
        tasks_created=tasks_created,
        message=f"Synced call sheet data: {'production day updated, ' if production_day_synced else ''}{locations_created} locations, {tasks_created} tasks"
    )


# =====================================================
# BUDGET SYSTEM - Models
# =====================================================

class BudgetInput(BaseModel):
    """Input for creating/updating a budget"""
    name: Optional[str] = "Main Budget"
    description: Optional[str] = None
    currency: Optional[str] = "USD"
    status: Optional[str] = "draft"
    contingency_percent: Optional[float] = 10.0
    notes: Optional[str] = None
    # Professional budget fields
    project_type_template: Optional[str] = "feature"
    shoot_days: Optional[int] = None
    prep_days: Optional[int] = None
    wrap_days: Optional[int] = None
    post_days: Optional[int] = None
    episode_count: Optional[int] = None
    union_type: Optional[str] = "non_union"


class BudgetCategoryInput(BaseModel):
    """Input for creating/updating a budget category"""
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0
    color: Optional[str] = None
    icon: Optional[str] = None
    # Professional budget fields
    category_type: Optional[str] = "production"
    account_code_prefix: Optional[str] = None
    phase: Optional[str] = None
    is_above_the_line: Optional[bool] = False


class BudgetLineItemInput(BaseModel):
    """Input for creating/updating a budget line item"""
    category_id: Optional[str] = None
    account_code: Optional[str] = None
    description: str
    rate_type: Optional[str] = "flat"
    rate_amount: Optional[float] = 0
    quantity: Optional[float] = 1
    units: Optional[str] = None
    actual_total: Optional[float] = None
    vendor_name: Optional[str] = None
    po_number: Optional[str] = None
    invoice_reference: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    is_locked: Optional[bool] = False
    sort_order: Optional[int] = 0
    # Professional budget fields
    calc_mode: Optional[str] = "flat"
    days: Optional[float] = None
    weeks: Optional[float] = None
    episodes: Optional[int] = None
    union_code: Optional[str] = None
    is_fringe: Optional[bool] = False
    fringe_base_item_id: Optional[str] = None
    fringe_percent: Optional[float] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    sub_account_code: Optional[str] = None
    phase: Optional[str] = None
    department: Optional[str] = None
    manual_total_override: Optional[float] = None
    use_manual_total: Optional[bool] = False


# Professional Budget Input Models
class CreateBudgetFromTemplateInput(BaseModel):
    """Input for creating a budget from a project type template"""
    project_type: str = "feature"
    name: Optional[str] = "Main Budget"
    shoot_days: Optional[int] = 0
    prep_days: Optional[int] = 0
    wrap_days: Optional[int] = 0
    post_days: Optional[int] = 0
    episode_count: Optional[int] = 1
    union_type: Optional[str] = "non_union"
    include_common_only: Optional[bool] = True


class Budget(BaseModel):
    """Budget response model"""
    id: str
    project_id: str
    name: str
    description: Optional[str]
    currency: str
    status: str
    approved_by: Optional[str]
    approved_at: Optional[str]
    locked_at: Optional[str]
    estimated_total: float
    actual_total: float
    variance: float
    contingency_percent: float
    contingency_amount: float
    notes: Optional[str]
    version: int
    created_by: Optional[str]
    created_at: str
    updated_at: str
    # Professional budget fields
    project_type_template: Optional[str] = "feature"
    has_top_sheet: Optional[bool] = False
    pdf_url: Optional[str] = None
    last_pdf_generated_at: Optional[str] = None
    fringes_total: Optional[float] = 0
    grand_total: Optional[float] = 0
    shoot_days: Optional[int] = 0
    prep_days: Optional[int] = 0
    wrap_days: Optional[int] = 0
    post_days: Optional[int] = 0
    episode_count: Optional[int] = 1
    union_type: Optional[str] = "non_union"


class BudgetCategory(BaseModel):
    """Budget category response model"""
    id: str
    budget_id: str
    name: str
    code: Optional[str]
    description: Optional[str]
    estimated_subtotal: float
    actual_subtotal: float
    sort_order: int
    color: Optional[str]
    icon: Optional[str]
    created_at: str
    updated_at: str
    # Professional budget fields
    category_type: Optional[str] = "production"
    account_code_prefix: Optional[str] = None
    phase: Optional[str] = None
    is_above_the_line: Optional[bool] = False


class BudgetLineItem(BaseModel):
    """Budget line item response model"""
    id: str
    budget_id: str
    category_id: Optional[str]
    account_code: Optional[str]
    description: str
    rate_type: str
    rate_amount: float
    quantity: float
    units: Optional[str]
    estimated_total: float
    actual_total: float
    variance: float
    vendor_name: Optional[str]
    po_number: Optional[str]
    invoice_reference: Optional[str]
    notes: Optional[str]
    internal_notes: Optional[str]
    is_allocated_to_days: bool
    total_allocated: float
    is_locked: bool
    sort_order: int
    created_at: str
    updated_at: str
    # Professional budget fields
    calc_mode: Optional[str] = "flat"
    days: Optional[float] = None
    weeks: Optional[float] = None
    episodes: Optional[int] = None
    union_code: Optional[str] = None
    is_fringe: Optional[bool] = False
    fringe_base_item_id: Optional[str] = None
    fringe_percent: Optional[float] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    sub_account_code: Optional[str] = None
    phase: Optional[str] = None
    department: Optional[str] = None
    manual_total_override: Optional[float] = None
    use_manual_total: Optional[bool] = False


# Professional Budget Response Models
class TopSheetCategoryRow(BaseModel):
    """A single category row in a TopSheet section"""
    code: Optional[str]
    name: str
    estimated: float
    actual: float
    variance: float


class TopSheetSection(BaseModel):
    """A section of the TopSheet (e.g., Above the Line, Production, etc.)"""
    label: str
    total: float
    categories: List[TopSheetCategoryRow]


class TopSheetData(BaseModel):
    """Top Sheet summary data - structured for frontend display"""
    budget_id: str
    project_title: str
    project_type: str
    prepared_date: str
    # Category type breakdowns
    above_the_line: TopSheetSection
    production: TopSheetSection
    post: TopSheetSection
    other: TopSheetSection
    # Totals
    subtotal: float
    contingency_percent: float
    contingency_amount: float
    fringes_total: float
    grand_total: float
    # Metadata
    is_stale: bool
    last_computed: str


class BudgetAccountTemplate(BaseModel):
    """Budget account template from registry"""
    id: str
    project_type: str
    account_code: str
    sub_code: Optional[str]
    name: str
    description: Optional[str]
    category_type: str
    category_name: str
    department: Optional[str]
    phase: Optional[str]
    default_calc_mode: str
    default_units: Optional[str]
    sort_order: int
    is_common: bool
    aicp_code: Optional[str] = None
    dga_code: Optional[str] = None


class BudgetTemplatePreview(BaseModel):
    """Preview of what template will create"""
    project_type: str
    category_count: int
    line_item_count: int
    categories: List[dict]


# =============================================================================
# BUDGET BUNDLE MODELS (for intentional budget creation)
# =============================================================================

class BundleLineItemResponse(BaseModel):
    """A line item within a bundle category"""
    account_code: str
    description: str
    calc_mode: str = "flat"
    default_units: str = ""
    department: Optional[str] = None
    phase: Optional[str] = None
    is_essential: bool = False


class BundleCategoryResponse(BaseModel):
    """A category within a bundle"""
    name: str
    code: str
    account_code_prefix: str
    category_type: str  # above_the_line, production, post, other
    sort_order: int
    color: str = "#6b7280"
    line_items: List[BundleLineItemResponse] = []


class DepartmentBundleResponse(BaseModel):
    """A department bundle - a small set of common line items"""
    id: str
    name: str
    description: str
    category_type: str
    icon: str = ""
    categories: List[BundleCategoryResponse]
    total_line_items: int = 0
    is_recommended: bool = False


class BundleListResponse(BaseModel):
    """Response containing all available bundles"""
    bundles: List[DepartmentBundleResponse]
    project_types: List[str]
    category_types: List[str]


class RecommendedBundlesResponse(BaseModel):
    """Response with recommended bundles for a project type"""
    project_type: str
    recommended: List[DepartmentBundleResponse]
    core_essentials: List[DepartmentBundleResponse]
    all_available: List[DepartmentBundleResponse]


class CreateBudgetFromBundlesInput(BaseModel):
    """Input for creating a budget from selected bundles"""
    name: str = "Main Budget"
    project_type: str = "feature"
    currency: str = "USD"
    contingency_percent: float = 10.0
    shoot_days: int = 0
    prep_days: int = 0
    wrap_days: int = 0
    post_days: int = 0
    episode_count: int = 1
    union_type: str = "non_union"
    # Seeding options
    seed_mode: str = "bundles"  # "blank" | "categories_only" | "bundles" | "essentials"
    selected_bundle_ids: List[str] = []  # Bundle IDs to include
    # High-level category toggles (for "categories_only" mode)
    include_above_the_line: bool = True
    include_production: bool = True
    include_post: bool = True
    include_other: bool = True


class BudgetCreationResult(BaseModel):
    """Result of creating a budget from bundles"""
    budget: Budget
    categories_created: int
    line_items_created: int
    bundles_used: List[str]
    seed_mode: str


class BudgetSummary(BaseModel):
    """Budget summary response"""
    budget: Budget
    categories: List[BudgetCategory]
    total_line_items: int
    total_receipts: int
    unmapped_receipts: int
    daily_budgets_count: int


class BudgetStats(BaseModel):
    """Budget statistics"""
    estimated_total: float
    actual_total: float
    variance: float
    variance_percent: float
    receipt_total: float
    unmapped_receipt_total: float
    categories_over_budget: int
    categories_under_budget: int
    days_over_budget: int


# Helper function to verify budget access
async def verify_budget_access(supabase, project_id: str, user_id: str, require_edit: bool = False):
    """Verify user has access to project budgets (producers/admins only)"""
    # Check if project owner
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_response.data[0]
    if project["owner_id"] == user_id:
        return True

    # Check membership with producer/PM role
    member_response = supabase.table("backlot_project_members").select(
        "role, production_role"
    ).eq("project_id", project_id).eq("user_id", user_id).execute()

    if not member_response.data:
        raise HTTPException(status_code=403, detail="Access denied - not a project member")

    member = member_response.data[0]
    role = member.get("role", "")
    production_role = (member.get("production_role") or "").lower()

    # Admins and owners can access
    if role in ["owner", "admin"]:
        return True

    # Producers and production managers can access
    if any(r in production_role for r in ["producer", "production manager", "pm", "upm", "line producer"]):
        return True

    raise HTTPException(status_code=403, detail="Access denied - budget access requires producer/admin role")


# =====================================================
# BUDGET CRUD ENDPOINTS
# =====================================================

@router.get("/projects/{project_id}/budget", response_model=Budget)
async def get_project_budget(
    project_id: str,
    authorization: str = Header(None)
):
    """Get the main budget for a project"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="No budget found for this project")

    return response.data[0]


@router.get("/projects/{project_id}/budget/summary", response_model=BudgetSummary)
async def get_budget_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """Get budget with categories and stats"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="No budget found for this project")

    budget = budget_response.data[0]
    budget_id = budget["id"]

    # Get categories
    categories_response = supabase.table("backlot_budget_categories").select("*").eq("budget_id", budget_id).order("sort_order").execute()

    # Get line item count
    line_items_response = supabase.table("backlot_budget_line_items").select("id", count="exact").eq("budget_id", budget_id).execute()

    # Get receipt counts
    receipts_response = supabase.table("backlot_receipts").select("id, is_mapped", count="exact").eq("budget_id", budget_id).execute()
    total_receipts = receipts_response.count if hasattr(receipts_response, 'count') else len(receipts_response.data or [])
    unmapped_receipts = len([r for r in (receipts_response.data or []) if not r.get("is_mapped")])

    # Get daily budgets count
    daily_response = supabase.table("backlot_daily_budgets").select("id", count="exact").eq("budget_id", budget_id).execute()
    daily_count = daily_response.count if hasattr(daily_response, 'count') else len(daily_response.data or [])

    return BudgetSummary(
        budget=Budget(**budget),
        categories=[BudgetCategory(**c) for c in (categories_response.data or [])],
        total_line_items=line_items_response.count if hasattr(line_items_response, 'count') else len(line_items_response.data or []),
        total_receipts=total_receipts,
        unmapped_receipts=unmapped_receipts,
        daily_budgets_count=daily_count
    )


@router.post("/projects/{project_id}/budget", response_model=Budget)
async def create_budget(
    project_id: str,
    budget_input: BudgetInput = BudgetInput(),
    authorization: str = Header(None)
):
    """Create a budget for a project"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Check if budget already exists
    existing = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).eq("name", budget_input.name or "Main Budget").execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A budget with this name already exists for this project")

    # Create budget
    budget_data = budget_input.model_dump(exclude_unset=True)
    budget_data["project_id"] = project_id
    budget_data["created_by"] = user_id

    result = supabase.table("backlot_budgets").insert(budget_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create budget")

    budget = result.data[0]

    # Create default categories
    default_categories = [
        {"name": "Pre-Production", "code": "A", "sort_order": 0, "icon": "clipboard"},
        {"name": "Cast", "code": "B", "sort_order": 1, "icon": "users"},
        {"name": "Crew", "code": "C", "sort_order": 2, "icon": "hard-hat"},
        {"name": "Equipment", "code": "D", "sort_order": 3, "icon": "camera"},
        {"name": "Locations", "code": "E", "sort_order": 4, "icon": "map-pin"},
        {"name": "Production", "code": "F", "sort_order": 5, "icon": "film"},
        {"name": "Post-Production", "code": "G", "sort_order": 6, "icon": "edit"},
        {"name": "Other", "code": "H", "sort_order": 7, "icon": "more-horizontal"},
    ]

    for cat in default_categories:
        cat["budget_id"] = budget["id"]
        supabase.table("backlot_budget_categories").insert(cat).execute()

    return budget


@router.put("/projects/{project_id}/budget", response_model=Budget)
async def update_budget(
    project_id: str,
    budget_input: BudgetInput,
    authorization: str = Header(None)
):
    """Update the project budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get existing budget
    existing = supabase.table("backlot_budgets").select("id, status").eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = existing.data[0]

    # Check if budget is locked
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    # Update budget
    update_data = budget_input.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_budgets").update(update_data).eq("id", budget["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update budget")

    return result.data[0]


@router.post("/projects/{project_id}/budget/lock")
async def lock_budget(
    project_id: str,
    authorization: str = Header(None)
):
    """Lock the budget to prevent further modifications"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    existing = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    # Lock budget
    result = supabase.table("backlot_budgets").update({
        "status": "locked",
        "locked_at": datetime.utcnow().isoformat()
    }).eq("id", existing.data[0]["id"]).execute()

    return {"success": True, "message": "Budget locked successfully"}


@router.get("/projects/{project_id}/budgets", response_model=List[Budget])
async def get_project_budgets(
    project_id: str,
    authorization: str = Header(None)
):
    """Get ALL budgets for a project (supports multiple budgets per project)"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get all budgets for project
    response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).order("created_at", desc=True).execute()

    return response.data or []


@router.delete("/budgets/{budget_id}")
async def delete_budget(
    budget_id: str,
    authorization: str = Header(None)
):
    """Delete a budget and ALL associated data (categories, line items, daily budgets, receipts).
    This is a destructive operation that cannot be undone.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("id, project_id, name, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]

    # Verify user has access to the project
    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Don't allow deletion of locked budgets
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot delete a locked budget. Unlock it first.")

    # Delete in correct order to respect foreign key constraints:
    # 1. Daily budget items
    daily_budgets = supabase.table("backlot_daily_budgets").select("id").eq("budget_id", budget_id).execute()
    for db in (daily_budgets.data or []):
        supabase.table("backlot_daily_budget_items").delete().eq("daily_budget_id", db["id"]).execute()

    # 2. Daily budgets
    supabase.table("backlot_daily_budgets").delete().eq("budget_id", budget_id).execute()

    # 3. Receipts
    supabase.table("backlot_receipts").delete().eq("budget_id", budget_id).execute()

    # 4. Line items
    supabase.table("backlot_budget_line_items").delete().eq("budget_id", budget_id).execute()

    # 5. Categories
    supabase.table("backlot_budget_categories").delete().eq("budget_id", budget_id).execute()

    # 6. Finally, the budget itself
    supabase.table("backlot_budgets").delete().eq("id", budget_id).execute()

    return {"success": True, "message": f"Budget '{budget['name']}' and all associated data has been permanently deleted"}


@router.get("/projects/{project_id}/budget/stats", response_model=BudgetStats)
async def get_budget_stats(
    project_id: str,
    authorization: str = Header(None)
):
    """Get budget statistics"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    budget_id = budget["id"]

    # Get categories for over/under budget counts
    categories = supabase.table("backlot_budget_categories").select("estimated_subtotal, actual_subtotal").eq("budget_id", budget_id).execute()
    categories_over = sum(1 for c in (categories.data or []) if c["actual_subtotal"] > c["estimated_subtotal"])
    categories_under = sum(1 for c in (categories.data or []) if c["actual_subtotal"] < c["estimated_subtotal"])

    # Get receipt totals
    receipts = supabase.table("backlot_receipts").select("amount, is_mapped").eq("budget_id", budget_id).execute()
    receipt_total = sum(r.get("amount", 0) or 0 for r in (receipts.data or []))
    unmapped_total = sum(r.get("amount", 0) or 0 for r in (receipts.data or []) if not r.get("is_mapped"))

    # Get daily budgets over budget
    daily = supabase.table("backlot_daily_budgets").select("estimated_total, actual_total").eq("budget_id", budget_id).execute()
    days_over = sum(1 for d in (daily.data or []) if d["actual_total"] > d["estimated_total"])

    estimated = budget["estimated_total"]
    actual = budget["actual_total"]
    variance = actual - estimated
    variance_percent = (variance / estimated * 100) if estimated > 0 else 0

    return BudgetStats(
        estimated_total=estimated,
        actual_total=actual,
        variance=variance,
        variance_percent=variance_percent,
        receipt_total=receipt_total,
        unmapped_receipt_total=unmapped_total,
        categories_over_budget=categories_over,
        categories_under_budget=categories_under,
        days_over_budget=days_over
    )


# =====================================================
# BUDGET CATEGORIES ENDPOINTS
# =====================================================

@router.get("/budgets/{budget_id}/categories", response_model=List[BudgetCategory])
async def get_budget_categories(
    budget_id: str,
    authorization: str = Header(None)
):
    """Get all categories for a budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    await verify_budget_access(supabase, budget_response.data[0]["project_id"], user_id)

    # Get categories
    response = supabase.table("backlot_budget_categories").select("*").eq("budget_id", budget_id).order("sort_order").execute()
    return response.data or []


@router.post("/budgets/{budget_id}/categories", response_model=BudgetCategory)
async def create_budget_category(
    budget_id: str,
    category: BudgetCategoryInput,
    authorization: str = Header(None)
):
    """Create a new budget category"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Create category
    category_data = category.model_dump()
    category_data["budget_id"] = budget_id

    result = supabase.table("backlot_budget_categories").insert(category_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create category")

    return result.data[0]


@router.put("/budgets/{budget_id}/categories/{category_id}", response_model=BudgetCategory)
async def update_budget_category(
    budget_id: str,
    category_id: str,
    category: BudgetCategoryInput,
    authorization: str = Header(None)
):
    """Update a budget category"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Update category
    category_data = category.model_dump(exclude_unset=True)
    category_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_budget_categories").update(category_data).eq("id", category_id).eq("budget_id", budget_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")

    return result.data[0]


@router.delete("/budgets/{budget_id}/categories/{category_id}")
async def delete_budget_category(
    budget_id: str,
    category_id: str,
    authorization: str = Header(None)
):
    """Delete a budget category (moves line items to uncategorized)"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Unlink line items from this category
    supabase.table("backlot_budget_line_items").update({"category_id": None}).eq("category_id", category_id).execute()

    # Delete category
    supabase.table("backlot_budget_categories").delete().eq("id", category_id).eq("budget_id", budget_id).execute()

    return {"success": True, "message": "Category deleted"}


# =====================================================
# BUDGET LINE ITEMS ENDPOINTS
# =====================================================

@router.get("/budgets/{budget_id}/line-items", response_model=List[BudgetLineItem])
async def get_budget_line_items(
    budget_id: str,
    category_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all line items for a budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    await verify_budget_access(supabase, budget_response.data[0]["project_id"], user_id)

    # Build query
    query = supabase.table("backlot_budget_line_items").select("*").eq("budget_id", budget_id)
    if category_id:
        query = query.eq("category_id", category_id)

    response = query.order("category_id").order("sort_order").execute()
    return response.data or []


@router.post("/budgets/{budget_id}/line-items", response_model=BudgetLineItem)
async def create_budget_line_item(
    budget_id: str,
    line_item: BudgetLineItemInput,
    authorization: str = Header(None)
):
    """Create a new budget line item"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Create line item
    item_data = line_item.model_dump(exclude_unset=True)
    item_data["budget_id"] = budget_id

    result = supabase.table("backlot_budget_line_items").insert(item_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create line item")

    return result.data[0]


@router.put("/budgets/{budget_id}/line-items/{line_item_id}", response_model=BudgetLineItem)
async def update_budget_line_item(
    budget_id: str,
    line_item_id: str,
    line_item: BudgetLineItemInput,
    authorization: str = Header(None)
):
    """Update a budget line item"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Check if line item is locked
    existing = supabase.table("backlot_budget_line_items").select("is_locked").eq("id", line_item_id).execute()
    if existing.data and existing.data[0].get("is_locked"):
        raise HTTPException(status_code=400, detail="Cannot modify a locked line item")

    # Update line item
    item_data = line_item.model_dump(exclude_unset=True)
    item_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_budget_line_items").update(item_data).eq("id", line_item_id).eq("budget_id", budget_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Line item not found")

    return result.data[0]


@router.delete("/budgets/{budget_id}/line-items/{line_item_id}")
async def delete_budget_line_item(
    budget_id: str,
    line_item_id: str,
    authorization: str = Header(None)
):
    """Delete a budget line item"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget to verify access
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Check if line item is locked
    existing = supabase.table("backlot_budget_line_items").select("is_locked").eq("id", line_item_id).execute()
    if existing.data and existing.data[0].get("is_locked"):
        raise HTTPException(status_code=400, detail="Cannot delete a locked line item")

    # Delete line item (cascades to day links)
    supabase.table("backlot_budget_line_items").delete().eq("id", line_item_id).eq("budget_id", budget_id).execute()

    return {"success": True, "message": "Line item deleted"}


# =====================================================
# DAILY BUDGET SYSTEM - Models
# =====================================================

class DailyBudgetInput(BaseModel):
    """Input for creating/updating a daily budget"""
    date: Optional[str] = None
    notes: Optional[str] = None


class DailyBudgetItemInput(BaseModel):
    """Input for creating/updating a daily budget item"""
    budget_line_item_id: Optional[str] = None
    label: str
    category_name: Optional[str] = None
    estimated_amount: Optional[float] = 0
    actual_amount: Optional[float] = 0
    vendor_name: Optional[str] = None
    notes: Optional[str] = None
    is_ad_hoc: Optional[bool] = False
    sort_order: Optional[int] = 0


class DailyBudget(BaseModel):
    """Daily budget response model"""
    id: str
    project_id: str
    budget_id: str
    production_day_id: str
    date: str
    estimated_total: float
    actual_total: float
    variance: float
    variance_percent: float
    notes: Optional[str]
    created_at: str
    updated_at: str


class DailyBudgetItem(BaseModel):
    """Daily budget item response model"""
    id: str
    daily_budget_id: str
    budget_line_item_id: Optional[str]
    label: str
    category_name: Optional[str]
    estimated_amount: float
    actual_amount: float
    vendor_name: Optional[str]
    notes: Optional[str]
    is_ad_hoc: bool
    sort_order: int
    created_at: str
    updated_at: str


class DailyBudgetSummary(BaseModel):
    """Daily budget summary for list views"""
    id: str
    date: str
    production_day_number: int
    production_day_title: Optional[str]
    estimated_total: float
    actual_total: float
    variance: float
    variance_percent: float
    item_count: int
    receipt_count: int
    has_call_sheet: bool


class BudgetDayLinkInput(BaseModel):
    """Input for linking budget line items to production days"""
    budget_line_item_id: str
    production_day_id: str
    call_sheet_id: Optional[str] = None
    estimated_share: Optional[float] = 0
    actual_share: Optional[float] = 0
    notes: Optional[str] = None


class SuggestedLineItemForDay(BaseModel):
    """Suggested line item for a production day"""
    line_item_id: str
    line_item_description: str
    category_name: Optional[str]
    match_reason: str
    suggested_share: float


# =====================================================
# DAILY BUDGET ENDPOINTS
# =====================================================

@router.get("/projects/{project_id}/daily-budgets", response_model=List[DailyBudgetSummary])
async def get_project_daily_budgets(
    project_id: str,
    authorization: str = Header(None)
):
    """Get all daily budgets for a project"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).execute()
    if not budget_response.data:
        return []  # No budget yet, no daily budgets

    budget_id = budget_response.data[0]["id"]

    # Get daily budgets with production day info
    daily_response = supabase.table("backlot_daily_budgets").select("*").eq("budget_id", budget_id).order("date").execute()

    summaries = []
    for db in daily_response.data or []:
        # Get production day info
        prod_day = supabase.table("backlot_production_days").select("day_number, title").eq("id", db["production_day_id"]).execute()
        prod_day_data = prod_day.data[0] if prod_day.data else {}

        # Count items
        items_count = supabase.table("backlot_daily_budget_items").select("id", count="exact").eq("daily_budget_id", db["id"]).execute()

        # Count receipts
        receipts_count = supabase.table("backlot_receipts").select("id", count="exact").eq("daily_budget_id", db["id"]).execute()

        # Check for call sheet
        call_sheet = supabase.table("backlot_call_sheets").select("id").eq("production_day_id", db["production_day_id"]).limit(1).execute()

        summaries.append(DailyBudgetSummary(
            id=db["id"],
            date=db["date"],
            production_day_number=prod_day_data.get("day_number", 0),
            production_day_title=prod_day_data.get("title"),
            estimated_total=db["estimated_total"],
            actual_total=db["actual_total"],
            variance=db["variance"],
            variance_percent=db["variance_percent"],
            item_count=items_count.count if hasattr(items_count, 'count') else len(items_count.data or []),
            receipt_count=receipts_count.count if hasattr(receipts_count, 'count') else len(receipts_count.data or []),
            has_call_sheet=bool(call_sheet.data)
        ))

    return summaries


@router.get("/daily-budgets/{daily_budget_id}", response_model=DailyBudget)
async def get_daily_budget(
    daily_budget_id: str,
    authorization: str = Header(None)
):
    """Get a daily budget by ID"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget
    response = supabase.table("backlot_daily_budgets").select("*").eq("id", daily_budget_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    db = response.data[0]
    await verify_budget_access(supabase, db["project_id"], user_id)

    return db


@router.get("/production-days/{production_day_id}/daily-budget", response_model=DailyBudget)
async def get_daily_budget_for_day(
    production_day_id: str,
    authorization: str = Header(None)
):
    """Get or create daily budget for a production day"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get production day
    day_response = supabase.table("backlot_production_days").select("*").eq("id", production_day_id).execute()
    if not day_response.data:
        raise HTTPException(status_code=404, detail="Production day not found")

    prod_day = day_response.data[0]
    project_id = prod_day["project_id"]

    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="No budget found for this project")

    budget_id = budget_response.data[0]["id"]

    # Check if daily budget exists
    existing = supabase.table("backlot_daily_budgets").select("*").eq("production_day_id", production_day_id).execute()
    if existing.data:
        return existing.data[0]

    # Create daily budget
    daily_data = {
        "project_id": project_id,
        "budget_id": budget_id,
        "production_day_id": production_day_id,
        "date": prod_day["date"],
    }

    result = supabase.table("backlot_daily_budgets").insert(daily_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create daily budget")

    return result.data[0]


@router.put("/daily-budgets/{daily_budget_id}", response_model=DailyBudget)
async def update_daily_budget(
    daily_budget_id: str,
    daily_input: DailyBudgetInput,
    authorization: str = Header(None)
):
    """Update a daily budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget to verify access
    existing = supabase.table("backlot_daily_budgets").select("project_id").eq("id", daily_budget_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    await verify_budget_access(supabase, existing.data[0]["project_id"], user_id)

    # Update
    update_data = daily_input.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_daily_budgets").update(update_data).eq("id", daily_budget_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update daily budget")

    return result.data[0]


# =====================================================
# DAILY BUDGET ITEMS ENDPOINTS
# =====================================================

@router.get("/daily-budgets/{daily_budget_id}/items", response_model=List[DailyBudgetItem])
async def get_daily_budget_items(
    daily_budget_id: str,
    authorization: str = Header(None)
):
    """Get all items for a daily budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget to verify access
    db_response = supabase.table("backlot_daily_budgets").select("project_id").eq("id", daily_budget_id).execute()
    if not db_response.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    await verify_budget_access(supabase, db_response.data[0]["project_id"], user_id)

    # Get items
    response = supabase.table("backlot_daily_budget_items").select("*").eq("daily_budget_id", daily_budget_id).order("sort_order").execute()
    return response.data or []


@router.post("/daily-budgets/{daily_budget_id}/items", response_model=DailyBudgetItem)
async def create_daily_budget_item(
    daily_budget_id: str,
    item: DailyBudgetItemInput,
    authorization: str = Header(None)
):
    """Create a new daily budget item"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget to verify access
    db_response = supabase.table("backlot_daily_budgets").select("project_id, budget_id").eq("id", daily_budget_id).execute()
    if not db_response.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    await verify_budget_access(supabase, db_response.data[0]["project_id"], user_id)

    # If linked to a line item, get category name
    item_data = item.model_dump(exclude_unset=True)
    if item_data.get("budget_line_item_id") and not item_data.get("category_name"):
        line_item = supabase.table("backlot_budget_line_items").select("category_id").eq("id", item_data["budget_line_item_id"]).execute()
        if line_item.data and line_item.data[0].get("category_id"):
            category = supabase.table("backlot_budget_categories").select("name").eq("id", line_item.data[0]["category_id"]).execute()
            if category.data:
                item_data["category_name"] = category.data[0]["name"]

    item_data["daily_budget_id"] = daily_budget_id

    result = supabase.table("backlot_daily_budget_items").insert(item_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create daily budget item")

    return result.data[0]


@router.put("/daily-budgets/{daily_budget_id}/items/{item_id}", response_model=DailyBudgetItem)
async def update_daily_budget_item(
    daily_budget_id: str,
    item_id: str,
    item: DailyBudgetItemInput,
    authorization: str = Header(None)
):
    """Update a daily budget item"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget to verify access
    db_response = supabase.table("backlot_daily_budgets").select("project_id").eq("id", daily_budget_id).execute()
    if not db_response.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    await verify_budget_access(supabase, db_response.data[0]["project_id"], user_id)

    # Update
    item_data = item.model_dump(exclude_unset=True)
    item_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_daily_budget_items").update(item_data).eq("id", item_id).eq("daily_budget_id", daily_budget_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")

    return result.data[0]


@router.delete("/daily-budgets/{daily_budget_id}/items/{item_id}")
async def delete_daily_budget_item(
    daily_budget_id: str,
    item_id: str,
    authorization: str = Header(None)
):
    """Delete a daily budget item"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget to verify access
    db_response = supabase.table("backlot_daily_budgets").select("project_id").eq("id", daily_budget_id).execute()
    if not db_response.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    await verify_budget_access(supabase, db_response.data[0]["project_id"], user_id)

    # Delete
    supabase.table("backlot_daily_budget_items").delete().eq("id", item_id).eq("daily_budget_id", daily_budget_id).execute()

    return {"success": True, "message": "Item deleted"}


# =====================================================
# BUDGET-DAY LINKING ENDPOINTS
# =====================================================

@router.get("/production-days/{production_day_id}/suggested-line-items", response_model=List[SuggestedLineItemForDay])
async def get_suggested_line_items_for_day(
    production_day_id: str,
    authorization: str = Header(None)
):
    """Get suggested budget line items for a production day based on call sheet data"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get production day
    day_response = supabase.table("backlot_production_days").select("*").eq("id", production_day_id).execute()
    if not day_response.data:
        raise HTTPException(status_code=404, detail="Production day not found")

    prod_day = day_response.data[0]
    project_id = prod_day["project_id"]

    await verify_budget_access(supabase, project_id, user_id)

    # Get budget and line items
    budget_response = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).execute()
    if not budget_response.data:
        return []

    budget_id = budget_response.data[0]["id"]

    line_items = supabase.table("backlot_budget_line_items").select("*").eq("budget_id", budget_id).execute()
    if not line_items.data:
        return []

    # Get call sheet for this day
    call_sheet = supabase.table("backlot_call_sheets").select("*").eq("production_day_id", production_day_id).limit(1).execute()

    # Get call sheet people (crew)
    people = []
    if call_sheet.data:
        people_response = supabase.table("backlot_call_sheet_people").select("*").eq("call_sheet_id", call_sheet.data[0]["id"]).execute()
        people = people_response.data or []

    suggestions = []

    for item in line_items.data:
        desc_lower = (item["description"] or "").lower()
        match_reason = None
        suggested_share = 0

        # Check if this is a daily rate item
        is_daily = item["rate_type"] == "daily"

        # Match by role in call sheet people
        for person in people:
            role_lower = (person.get("role") or "").lower()
            if role_lower and role_lower in desc_lower:
                match_reason = f"Role '{person.get('role')}' on call sheet"
                break
            # Also check department
            dept_lower = (person.get("department") or "").lower()
            if dept_lower and dept_lower in desc_lower:
                match_reason = f"Department '{person.get('department')}' on call sheet"
                break

        # Match by location if applicable
        location_name = prod_day.get("location_name", "").lower()
        if location_name and location_name in desc_lower:
            match_reason = f"Location match: {prod_day.get('location_name')}"

        # Match common production items
        common_daily_items = ["catering", "craft services", "crafty", "meals", "transport", "van", "fuel", "parking"]
        for common in common_daily_items:
            if common in desc_lower:
                match_reason = f"Common daily expense: {common}"
                break

        if match_reason:
            # Calculate suggested share
            if is_daily:
                suggested_share = item["rate_amount"]  # One day's rate
            else:
                # Divide total by number of production days
                days_count = supabase.table("backlot_production_days").select("id", count="exact").eq("project_id", project_id).execute()
                num_days = days_count.count if hasattr(days_count, 'count') else len(days_count.data or [])
                num_days = max(num_days, 1)
                suggested_share = item["estimated_total"] / num_days

            # Get category name
            cat_name = None
            if item.get("category_id"):
                cat_response = supabase.table("backlot_budget_categories").select("name").eq("id", item["category_id"]).execute()
                if cat_response.data:
                    cat_name = cat_response.data[0]["name"]

            suggestions.append(SuggestedLineItemForDay(
                line_item_id=item["id"],
                line_item_description=item["description"],
                category_name=cat_name,
                match_reason=match_reason,
                suggested_share=round(suggested_share, 2)
            ))

    return suggestions


@router.post("/daily-budgets/{daily_budget_id}/auto-populate")
async def auto_populate_daily_budget(
    daily_budget_id: str,
    authorization: str = Header(None)
):
    """Auto-populate daily budget items from suggested line items"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get daily budget
    db_response = supabase.table("backlot_daily_budgets").select("*").eq("id", daily_budget_id).execute()
    if not db_response.data:
        raise HTTPException(status_code=404, detail="Daily budget not found")

    daily_budget = db_response.data[0]
    await verify_budget_access(supabase, daily_budget["project_id"], user_id)

    # Get suggestions
    # We need to call our own endpoint logic here
    production_day_id = daily_budget["production_day_id"]

    # Get production day
    day_response = supabase.table("backlot_production_days").select("*").eq("id", production_day_id).execute()
    prod_day = day_response.data[0] if day_response.data else {}

    # Get budget and line items
    budget_id = daily_budget["budget_id"]
    line_items = supabase.table("backlot_budget_line_items").select("*").eq("budget_id", budget_id).execute()

    # Get call sheet
    call_sheet = supabase.table("backlot_call_sheets").select("*").eq("production_day_id", production_day_id).limit(1).execute()

    # Get people
    people = []
    if call_sheet.data:
        people_response = supabase.table("backlot_call_sheet_people").select("*").eq("call_sheet_id", call_sheet.data[0]["id"]).execute()
        people = people_response.data or []

    items_created = 0

    for item in line_items.data or []:
        desc_lower = (item["description"] or "").lower()
        match_reason = None

        # Check for matches
        for person in people:
            role_lower = (person.get("role") or "").lower()
            if role_lower and role_lower in desc_lower:
                match_reason = f"Role: {person.get('role')}"
                break
            dept_lower = (person.get("department") or "").lower()
            if dept_lower and dept_lower in desc_lower:
                match_reason = f"Department: {person.get('department')}"
                break

        location_name = prod_day.get("location_name", "").lower()
        if location_name and location_name in desc_lower:
            match_reason = f"Location: {prod_day.get('location_name')}"

        common_daily_items = ["catering", "craft services", "crafty", "meals", "transport", "van", "fuel", "parking"]
        for common in common_daily_items:
            if common in desc_lower:
                match_reason = f"Daily expense: {common}"
                break

        if match_reason:
            # Calculate share
            is_daily = item["rate_type"] == "daily"
            if is_daily:
                estimated = item["rate_amount"]
            else:
                days_count = supabase.table("backlot_production_days").select("id", count="exact").eq("project_id", daily_budget["project_id"]).execute()
                num_days = max(days_count.count if hasattr(days_count, 'count') else len(days_count.data or []), 1)
                estimated = item["estimated_total"] / num_days

            # Get category name
            cat_name = None
            if item.get("category_id"):
                cat_response = supabase.table("backlot_budget_categories").select("name").eq("id", item["category_id"]).execute()
                if cat_response.data:
                    cat_name = cat_response.data[0]["name"]

            # Check if already exists
            existing = supabase.table("backlot_daily_budget_items").select("id").eq("daily_budget_id", daily_budget_id).eq("budget_line_item_id", item["id"]).execute()
            if not existing.data:
                # Create item
                new_item = {
                    "daily_budget_id": daily_budget_id,
                    "budget_line_item_id": item["id"],
                    "label": item["description"],
                    "category_name": cat_name,
                    "estimated_amount": round(estimated, 2),
                    "actual_amount": 0,
                    "is_ad_hoc": False,
                    "sort_order": items_created
                }
                supabase.table("backlot_daily_budget_items").insert(new_item).execute()
                items_created += 1

    return {"success": True, "items_created": items_created, "message": f"Created {items_created} daily budget items"}


# =====================================================
# RECEIPTS SYSTEM - Models
# =====================================================

class ReceiptInput(BaseModel):
    """Input for creating/updating a receipt"""
    budget_id: Optional[str] = None
    daily_budget_id: Optional[str] = None
    budget_line_item_id: Optional[str] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    purchase_date: Optional[str] = None
    amount: Optional[float] = None
    tax_amount: Optional[float] = None
    currency: Optional[str] = "USD"
    payment_method: Optional[str] = None
    reimbursement_status: Optional[str] = "not_applicable"
    reimbursement_to: Optional[str] = None
    notes: Optional[str] = None


class ReceiptMappingInput(BaseModel):
    """Input for mapping a receipt to budget items"""
    budget_line_item_id: Optional[str] = None
    daily_budget_id: Optional[str] = None
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    purchase_date: Optional[str] = None
    is_verified: Optional[bool] = False


class Receipt(BaseModel):
    """Receipt response model"""
    id: str
    project_id: str
    budget_id: Optional[str]
    daily_budget_id: Optional[str]
    budget_line_item_id: Optional[str]
    file_url: str
    original_filename: Optional[str]
    file_type: Optional[str]
    file_size_bytes: Optional[int]
    vendor_name: Optional[str]
    description: Optional[str]
    purchase_date: Optional[str]
    amount: Optional[float]
    tax_amount: Optional[float]
    currency: str
    ocr_status: str
    ocr_confidence: Optional[float]
    raw_ocr_json: Optional[Dict[str, Any]]
    extracted_text: Optional[str]
    is_mapped: bool
    is_verified: bool
    payment_method: Optional[str]
    reimbursement_status: str
    reimbursement_to: Optional[str]
    notes: Optional[str]
    created_by_user_id: str
    created_at: str
    updated_at: str


class ReceiptOcrResponse(BaseModel):
    """Response from OCR processing"""
    success: bool
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    tax_amount: Optional[float] = None
    purchase_date: Optional[str] = None
    line_items: Optional[List[Dict[str, Any]]] = None
    confidence: float = 0
    raw_text: str = ""
    error: Optional[str] = None


class ReceiptCreateResponse(BaseModel):
    """Response from receipt creation"""
    receipt: Receipt
    ocr_result: Optional[ReceiptOcrResponse] = None


# =====================================================
# RECEIPTS ENDPOINTS
# =====================================================

@router.get("/projects/{project_id}/receipts", response_model=List[Receipt])
async def get_project_receipts(
    project_id: str,
    is_mapped: Optional[bool] = None,
    is_verified: Optional[bool] = None,
    daily_budget_id: Optional[str] = None,
    budget_line_item_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all receipts for a project with optional filters"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Build query
    query = supabase.table("backlot_receipts").select("*").eq("project_id", project_id)

    if is_mapped is not None:
        query = query.eq("is_mapped", is_mapped)
    if is_verified is not None:
        query = query.eq("is_verified", is_verified)
    if daily_budget_id:
        query = query.eq("daily_budget_id", daily_budget_id)
    if budget_line_item_id:
        query = query.eq("budget_line_item_id", budget_line_item_id)
    if date_from:
        query = query.gte("purchase_date", date_from)
    if date_to:
        query = query.lte("purchase_date", date_to)

    response = query.order("created_at", desc=True).execute()
    return response.data or []


@router.get("/receipts/{receipt_id}", response_model=Receipt)
async def get_receipt(
    receipt_id: str,
    authorization: str = Header(None)
):
    """Get a receipt by ID"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    response = supabase.table("backlot_receipts").select("*").eq("id", receipt_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = response.data[0]
    await verify_budget_access(supabase, receipt["project_id"], user_id)

    return receipt


@router.post("/projects/{project_id}/receipts/register", response_model=ReceiptCreateResponse)
async def register_receipt(
    project_id: str,
    file_url: str,
    original_filename: Optional[str] = None,
    file_type: Optional[str] = "image/jpeg",
    file_size_bytes: Optional[int] = None,
    run_ocr: bool = True,
    daily_budget_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """
    Register an uploaded receipt file and optionally run OCR.

    The file should already be uploaded to Supabase Storage.
    This endpoint registers it in the database and processes it.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget for the project
    budget_response = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).execute()
    budget_id = budget_response.data[0]["id"] if budget_response.data else None

    # Create receipt record
    receipt_data = {
        "project_id": project_id,
        "budget_id": budget_id,
        "daily_budget_id": daily_budget_id,
        "file_url": file_url,
        "original_filename": original_filename,
        "file_type": file_type,
        "file_size_bytes": file_size_bytes,
        "created_by_user_id": user_id,
        "ocr_status": "pending" if run_ocr else "succeeded",
    }

    result = supabase.table("backlot_receipts").insert(receipt_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create receipt record")

    receipt = result.data[0]
    ocr_result = None

    # Run OCR if requested
    if run_ocr:
        from app.services.ocr_service import process_receipt

        # Update status to processing
        supabase.table("backlot_receipts").update({
            "ocr_status": "processing"
        }).eq("id", receipt["id"]).execute()

        try:
            ocr_data = await process_receipt(file_url, file_type or "image/jpeg")

            # Update receipt with OCR results
            update_data = {
                "ocr_status": "succeeded" if ocr_data.success else "failed",
                "ocr_confidence": ocr_data.confidence,
                "extracted_text": ocr_data.raw_text,
                "raw_ocr_json": ocr_data.to_dict(),
            }

            # If OCR extracted data, populate fields
            if ocr_data.success:
                if ocr_data.vendor_name:
                    update_data["vendor_name"] = ocr_data.vendor_name
                if ocr_data.amount:
                    update_data["amount"] = ocr_data.amount
                if ocr_data.tax_amount:
                    update_data["tax_amount"] = ocr_data.tax_amount
                if ocr_data.purchase_date:
                    update_data["purchase_date"] = ocr_data.purchase_date

            updated = supabase.table("backlot_receipts").update(update_data).eq("id", receipt["id"]).execute()
            receipt = updated.data[0] if updated.data else receipt

            ocr_result = ReceiptOcrResponse(
                success=ocr_data.success,
                vendor_name=ocr_data.vendor_name,
                amount=ocr_data.amount,
                tax_amount=ocr_data.tax_amount,
                purchase_date=ocr_data.purchase_date,
                line_items=ocr_data.line_items,
                confidence=ocr_data.confidence,
                raw_text=ocr_data.raw_text,
                error=ocr_data.error
            )

        except Exception as e:
            supabase.table("backlot_receipts").update({
                "ocr_status": "failed",
                "raw_ocr_json": {"error": str(e)}
            }).eq("id", receipt["id"]).execute()

            ocr_result = ReceiptOcrResponse(
                success=False,
                error=str(e)
            )

    return ReceiptCreateResponse(
        receipt=Receipt(**receipt),
        ocr_result=ocr_result
    )


@router.post("/receipts/{receipt_id}/reprocess-ocr", response_model=ReceiptOcrResponse)
async def reprocess_receipt_ocr(
    receipt_id: str,
    authorization: str = Header(None)
):
    """Re-run OCR on a receipt"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get receipt
    response = supabase.table("backlot_receipts").select("*").eq("id", receipt_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = response.data[0]
    await verify_budget_access(supabase, receipt["project_id"], user_id)

    # Update status to processing
    supabase.table("backlot_receipts").update({
        "ocr_status": "processing"
    }).eq("id", receipt_id).execute()

    try:
        from app.services.ocr_service import process_receipt

        ocr_data = await process_receipt(
            receipt["file_url"],
            receipt.get("file_type") or "image/jpeg"
        )

        # Update receipt with OCR results
        update_data = {
            "ocr_status": "succeeded" if ocr_data.success else "failed",
            "ocr_confidence": ocr_data.confidence,
            "extracted_text": ocr_data.raw_text,
            "raw_ocr_json": ocr_data.to_dict(),
        }

        if ocr_data.success:
            if ocr_data.vendor_name:
                update_data["vendor_name"] = ocr_data.vendor_name
            if ocr_data.amount:
                update_data["amount"] = ocr_data.amount
            if ocr_data.tax_amount:
                update_data["tax_amount"] = ocr_data.tax_amount
            if ocr_data.purchase_date:
                update_data["purchase_date"] = ocr_data.purchase_date

        supabase.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()

        return ReceiptOcrResponse(
            success=ocr_data.success,
            vendor_name=ocr_data.vendor_name,
            amount=ocr_data.amount,
            tax_amount=ocr_data.tax_amount,
            purchase_date=ocr_data.purchase_date,
            line_items=ocr_data.line_items,
            confidence=ocr_data.confidence,
            raw_text=ocr_data.raw_text,
            error=ocr_data.error
        )

    except Exception as e:
        supabase.table("backlot_receipts").update({
            "ocr_status": "failed",
            "raw_ocr_json": {"error": str(e)}
        }).eq("id", receipt_id).execute()

        return ReceiptOcrResponse(
            success=False,
            error=str(e)
        )


@router.put("/receipts/{receipt_id}", response_model=Receipt)
async def update_receipt(
    receipt_id: str,
    receipt_input: ReceiptInput,
    authorization: str = Header(None)
):
    """Update a receipt"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get receipt to verify access
    existing = supabase.table("backlot_receipts").select("project_id").eq("id", receipt_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    await verify_budget_access(supabase, existing.data[0]["project_id"], user_id)

    # Update
    update_data = receipt_input.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update receipt")

    return result.data[0]


@router.put("/receipts/{receipt_id}/map", response_model=Receipt)
async def map_receipt(
    receipt_id: str,
    mapping: ReceiptMappingInput,
    authorization: str = Header(None)
):
    """Map a receipt to a budget line item and/or daily budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get receipt to verify access
    existing = supabase.table("backlot_receipts").select("*").eq("id", receipt_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    receipt = existing.data[0]
    await verify_budget_access(supabase, receipt["project_id"], user_id)

    # Build update data
    update_data = {
        "updated_at": datetime.utcnow().isoformat(),
        "is_mapped": True,
    }

    if mapping.budget_line_item_id is not None:
        update_data["budget_line_item_id"] = mapping.budget_line_item_id
    if mapping.daily_budget_id is not None:
        update_data["daily_budget_id"] = mapping.daily_budget_id
    if mapping.vendor_name is not None:
        update_data["vendor_name"] = mapping.vendor_name
    if mapping.amount is not None:
        update_data["amount"] = mapping.amount
    if mapping.purchase_date is not None:
        update_data["purchase_date"] = mapping.purchase_date
    if mapping.is_verified is not None:
        update_data["is_verified"] = mapping.is_verified

    result = supabase.table("backlot_receipts").update(update_data).eq("id", receipt_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to map receipt")

    return result.data[0]


@router.put("/receipts/{receipt_id}/verify", response_model=Receipt)
async def verify_receipt(
    receipt_id: str,
    authorization: str = Header(None)
):
    """Mark a receipt as verified (user confirmed the extracted data)"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get receipt to verify access
    existing = supabase.table("backlot_receipts").select("project_id").eq("id", receipt_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    await verify_budget_access(supabase, existing.data[0]["project_id"], user_id)

    result = supabase.table("backlot_receipts").update({
        "is_verified": True,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", receipt_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to verify receipt")

    return result.data[0]


@router.delete("/receipts/{receipt_id}")
async def delete_receipt(
    receipt_id: str,
    authorization: str = Header(None)
):
    """Delete a receipt"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get receipt to verify access
    existing = supabase.table("backlot_receipts").select("project_id, file_url").eq("id", receipt_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Receipt not found")

    await verify_budget_access(supabase, existing.data[0]["project_id"], user_id)

    # Delete from database (file cleanup can be done separately)
    supabase.table("backlot_receipts").delete().eq("id", receipt_id).execute()

    return {"success": True, "message": "Receipt deleted"}


@router.get("/projects/{project_id}/receipts/export")
async def export_receipts_csv(
    project_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: str = Header(None)
):
    """Export receipts as CSV for tax/accounting purposes"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Build query
    query = supabase.table("backlot_receipts").select("*").eq("project_id", project_id)

    if date_from:
        query = query.gte("purchase_date", date_from)
    if date_to:
        query = query.lte("purchase_date", date_to)

    response = query.order("purchase_date").execute()
    receipts = response.data or []

    # Build CSV
    import csv
    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Date", "Vendor", "Description", "Amount", "Tax Amount",
        "Category", "Line Item", "Production Day", "Payment Method",
        "Reimbursement Status", "File URL"
    ])

    for r in receipts:
        # Get category and line item names
        category_name = ""
        line_item_name = ""
        if r.get("budget_line_item_id"):
            li = supabase.table("backlot_budget_line_items").select("description, category_id").eq("id", r["budget_line_item_id"]).execute()
            if li.data:
                line_item_name = li.data[0].get("description", "")
                if li.data[0].get("category_id"):
                    cat = supabase.table("backlot_budget_categories").select("name").eq("id", li.data[0]["category_id"]).execute()
                    if cat.data:
                        category_name = cat.data[0].get("name", "")

        # Get production day
        prod_day = ""
        if r.get("daily_budget_id"):
            db = supabase.table("backlot_daily_budgets").select("date, production_day_id").eq("id", r["daily_budget_id"]).execute()
            if db.data:
                prod_day = db.data[0].get("date", "")

        writer.writerow([
            r.get("purchase_date", ""),
            r.get("vendor_name", ""),
            r.get("description", ""),
            r.get("amount", ""),
            r.get("tax_amount", ""),
            category_name,
            line_item_name,
            prod_day,
            r.get("payment_method", ""),
            r.get("reimbursement_status", ""),
            r.get("file_url", "")
        ])

    csv_content = output.getvalue()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="receipts_{project_id}_{datetime.utcnow().strftime("%Y%m%d")}.csv"'
        }
    )


# =====================================================
# PROFESSIONAL BUDGET SYSTEM - Templates & Top Sheet
# =====================================================

@router.get("/budget-templates", response_model=List[str])
async def get_available_budget_templates(
    authorization: str = Header(None)
):
    """Get list of available budget project types"""
    await get_current_user_from_token(authorization)
    return ["feature", "episodic", "documentary", "music_video", "commercial", "short", "custom"]


@router.get("/budget-templates/{project_type}", response_model=List[BudgetAccountTemplate])
async def get_budget_template_accounts(
    project_type: str,
    include_all: bool = False,
    authorization: str = Header(None)
):
    """Get account templates for a specific project type"""
    await get_current_user_from_token(authorization)

    supabase = get_supabase_admin_client()

    # Get template accounts
    query = supabase.table("backlot_budget_accounts").select("*").eq("project_type", project_type)
    if not include_all:
        query = query.eq("is_common", True)

    response = query.order("sort_order").execute()
    return response.data or []


@router.get("/budget-templates/{project_type}/preview", response_model=BudgetTemplatePreview)
async def preview_budget_template(
    project_type: str,
    include_common_only: bool = True,
    authorization: str = Header(None)
):
    """Preview what a budget template will create"""
    await get_current_user_from_token(authorization)

    supabase = get_supabase_admin_client()

    # Get template accounts
    query = supabase.table("backlot_budget_accounts").select("*").eq("project_type", project_type)
    if include_common_only:
        query = query.eq("is_common", True)

    response = query.order("sort_order").execute()
    accounts = response.data or []

    # Group by category
    categories_dict = {}
    for account in accounts:
        cat_name = account["category_name"]
        if cat_name not in categories_dict:
            categories_dict[cat_name] = {
                "name": cat_name,
                "category_type": account["category_type"],
                "line_items": []
            }
        categories_dict[cat_name]["line_items"].append({
            "account_code": account["account_code"],
            "name": account["name"],
            "calc_mode": account["default_calc_mode"]
        })

    return BudgetTemplatePreview(
        project_type=project_type,
        category_count=len(categories_dict),
        line_item_count=len(accounts),
        categories=list(categories_dict.values())
    )


@router.post("/projects/{project_id}/budget/from-template", response_model=Budget)
async def create_budget_from_template(
    project_id: str,
    template_input: CreateBudgetFromTemplateInput,
    authorization: str = Header(None)
):
    """Create a budget from a project type template"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Check if budget already exists
    existing = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).eq("name", template_input.name or "Main Budget").execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A budget with this name already exists for this project")

    # Get template accounts
    query = supabase.table("backlot_budget_accounts").select("*").eq("project_type", template_input.project_type)
    if template_input.include_common_only:
        query = query.eq("is_common", True)

    accounts_response = query.order("sort_order").execute()
    accounts = accounts_response.data or []

    if not accounts:
        raise HTTPException(status_code=404, detail=f"No template accounts found for project type: {template_input.project_type}")

    # Create the budget
    budget_data = {
        "project_id": project_id,
        "name": template_input.name or "Main Budget",
        "project_type_template": template_input.project_type,
        "shoot_days": template_input.shoot_days or 0,
        "prep_days": template_input.prep_days or 0,
        "wrap_days": template_input.wrap_days or 0,
        "post_days": template_input.post_days or 0,
        "episode_count": template_input.episode_count or 1,
        "union_type": template_input.union_type or "non_union",
        "created_by": user_id,
        "status": "draft"
    }

    budget_result = supabase.table("backlot_budgets").insert(budget_data).execute()
    if not budget_result.data:
        raise HTTPException(status_code=500, detail="Failed to create budget")

    budget = budget_result.data[0]
    budget_id = budget["id"]

    # Group accounts by category and create categories + line items
    categories_dict = {}
    for account in accounts:
        cat_name = account["category_name"]
        if cat_name not in categories_dict:
            categories_dict[cat_name] = {
                "accounts": [],
                "category_type": account["category_type"],
                "sort_order": account["sort_order"] // 100  # Use first digit as category order
            }
        categories_dict[cat_name]["accounts"].append(account)

    # Create categories
    category_map = {}  # Maps category_name to category_id
    for cat_name, cat_info in categories_dict.items():
        cat_data = {
            "budget_id": budget_id,
            "name": cat_name,
            "code": str(cat_info["sort_order"] + 1),
            "category_type": cat_info["category_type"],
            "is_above_the_line": cat_info["category_type"] == "above_the_line",
            "sort_order": cat_info["sort_order"]
        }
        cat_result = supabase.table("backlot_budget_categories").insert(cat_data).execute()
        if cat_result.data:
            category_map[cat_name] = cat_result.data[0]["id"]

    # Create line items from accounts
    line_item_order = 0
    for cat_name, cat_info in categories_dict.items():
        category_id = category_map.get(cat_name)
        for account in cat_info["accounts"]:
            line_item_data = {
                "budget_id": budget_id,
                "category_id": category_id,
                "account_code": account["account_code"],
                "description": account["name"],
                "rate_type": "flat",
                "calc_mode": account["default_calc_mode"],
                "units": account.get("default_units"),
                "department": account.get("department"),
                "phase": account.get("phase"),
                "source_type": "template",
                "source_id": account["id"],
                "sort_order": line_item_order
            }
            supabase.table("backlot_budget_line_items").insert(line_item_data).execute()
            line_item_order += 1

    # Return the created budget
    return budget


@router.get("/projects/{project_id}/budget/top-sheet", response_model=TopSheetData)
async def get_budget_top_sheet(
    project_id: str,
    force_refresh: bool = False,
    authorization: str = Header(None)
):
    """Get the Top Sheet summary for a project budget"""
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    budget_id = budget["id"]

    # Get project for title
    project_response = supabase.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_title = project_response.data[0]["title"] if project_response.data else "Untitled"

    # Get categories with their line item totals
    categories_response = supabase.table("backlot_budget_categories").select("*").eq("budget_id", budget_id).order("sort_order").execute()
    categories = categories_response.data or []

    # Get all line items
    line_items_response = supabase.table("backlot_budget_line_items").select("*").eq("budget_id", budget_id).execute()
    line_items = line_items_response.data or []

    # Build sections by category type
    sections = {
        "above_the_line": {"categories": [], "total": 0},
        "production": {"categories": [], "total": 0},
        "post": {"categories": [], "total": 0},
        "other": {"categories": [], "total": 0}
    }
    fringes_total = 0

    for cat in categories:
        cat_id = cat["id"]
        cat_items = [li for li in line_items if li.get("category_id") == cat_id]
        cat_estimated = sum(li.get("estimated_total", 0) or 0 for li in cat_items)
        cat_actual = sum(li.get("actual_total", 0) or 0 for li in cat_items)
        cat_variance = cat_actual - cat_estimated

        # Add fringe amounts
        cat_fringes = sum(li.get("estimated_total", 0) or 0 for li in cat_items if li.get("is_fringe"))
        fringes_total += cat_fringes

        cat_type = cat.get("category_type", "production")
        if cat_type not in sections:
            cat_type = "other"

        category_row = TopSheetCategoryRow(
            code=cat.get("code"),
            name=cat.get("name", ""),
            estimated=cat_estimated,
            actual=cat_actual,
            variance=cat_variance
        )
        sections[cat_type]["categories"].append(category_row)
        sections[cat_type]["total"] += cat_estimated

    # Build section objects
    above_the_line = TopSheetSection(
        label="Above the Line",
        total=sections["above_the_line"]["total"],
        categories=sections["above_the_line"]["categories"]
    )
    production = TopSheetSection(
        label="Production",
        total=sections["production"]["total"],
        categories=sections["production"]["categories"]
    )
    post = TopSheetSection(
        label="Post-Production",
        total=sections["post"]["total"],
        categories=sections["post"]["categories"]
    )
    other = TopSheetSection(
        label="Other / Indirect",
        total=sections["other"]["total"],
        categories=sections["other"]["categories"]
    )

    subtotal = above_the_line.total + production.total + post.total + other.total
    contingency_pct = budget.get("contingency_percent", 10) or 10
    contingency_amount = subtotal * contingency_pct / 100
    grand_total = subtotal + contingency_amount

    # Update budget grand total
    supabase.table("backlot_budgets").update({
        "grand_total": grand_total,
        "fringes_total": fringes_total,
        "has_top_sheet": True
    }).eq("id", budget_id).execute()

    return TopSheetData(
        budget_id=budget_id,
        project_title=project_title,
        project_type=budget.get("project_type_template", "feature_film"),
        prepared_date=budget.get("created_at", datetime.utcnow().isoformat())[:10],
        above_the_line=above_the_line,
        production=production,
        post=post,
        other=other,
        subtotal=subtotal,
        contingency_percent=contingency_pct,
        contingency_amount=contingency_amount,
        fringes_total=fringes_total,
        grand_total=grand_total,
        is_stale=False,
        last_computed=datetime.utcnow().isoformat()
    )


@router.post("/projects/{project_id}/budget/compute-top-sheet")
async def compute_top_sheet(
    project_id: str,
    authorization: str = Header(None)
):
    """Force recomputation of the Top Sheet"""
    return await get_budget_top_sheet(project_id, force_refresh=True, authorization=authorization)


# =====================================================
# BUDGET-TO-DAILY BUDGET SYNC
# =====================================================

class BudgetToDailySyncInput(BaseModel):
    """Input for syncing budget to daily budgets"""
    sync_mode: str = "full"  # 'full' or 'incremental'
    include_phases: Optional[List[str]] = None  # e.g., ['production', 'prep']
    include_departments: Optional[List[str]] = None
    split_method: str = "equal"  # 'equal', 'weighted', 'manual'
    production_day_ids: Optional[List[str]] = None  # Specific days to sync, or None for all


class DailyBudgetSyncResult(BaseModel):
    """Result of syncing budget to daily budgets"""
    daily_budget_id: str
    production_day_id: str
    date: str
    items_created: int
    items_updated: int
    items_removed: int
    total_estimated: float
    warnings: List[str]


class BudgetSyncSummary(BaseModel):
    """Summary of budget-to-daily sync operation"""
    total_days_synced: int
    total_items_created: int
    total_items_updated: int
    total_items_removed: int
    daily_results: List[DailyBudgetSyncResult]
    warnings: List[str]


def calculate_daily_allocation(
    line_item: dict,
    total_days: int,
    day_index: int,
    split_method: str
) -> float:
    """Calculate how much of a line item to allocate to a specific day"""
    estimated = line_item.get("estimated_total", 0) or 0
    calc_mode = line_item.get("calc_mode", "flat")

    if estimated == 0 or total_days == 0:
        return 0

    # Items with per-day calculation
    if calc_mode in ["rate_x_days", "rate_x_hours"]:
        # These are already daily rates, allocate full rate per day
        rate = line_item.get("rate_amount", 0) or 0
        return rate

    # Flat items - split across all days
    if split_method == "equal":
        return estimated / total_days

    # Weighted could be based on call sheet complexity, but default to equal
    return estimated / total_days


@router.post("/projects/{project_id}/budget/sync-to-daily", response_model=BudgetSyncSummary)
async def sync_budget_to_daily_budgets(
    project_id: str,
    sync_input: BudgetToDailySyncInput = BudgetToDailySyncInput(),
    authorization: str = Header(None)
):
    """
    Sync main budget line items to daily budgets.

    This interprets the main budget and creates/updates daily budget items
    for each production day based on the line item's calc_mode and phase.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    budget_id = budget["id"]

    # Get production days
    days_query = supabase.table("backlot_production_days").select("*").eq("project_id", project_id)
    if sync_input.production_day_ids:
        days_query = days_query.in_("id", sync_input.production_day_ids)

    days_response = days_query.order("date").execute()
    production_days = days_response.data or []

    if not production_days:
        raise HTTPException(status_code=400, detail="No production days found to sync")

    total_shoot_days = len([d for d in production_days if d.get("type") == "shoot"])
    total_days = len(production_days)

    # Get line items with categories
    line_items_response = supabase.table("backlot_budget_line_items").select(
        "*, category:backlot_budget_categories(id, name, category_type, phase)"
    ).eq("budget_id", budget_id).execute()
    line_items = line_items_response.data or []

    # Filter line items by phase if specified
    if sync_input.include_phases:
        line_items = [
            li for li in line_items
            if li.get("phase") in sync_input.include_phases
            or (li.get("category") and li["category"].get("phase") in sync_input.include_phases)
        ]

    # Filter by department if specified
    if sync_input.include_departments:
        line_items = [
            li for li in line_items
            if li.get("department") in sync_input.include_departments
        ]

    # Group line items by which days they apply to
    # Production phase items -> shoot days
    # Prep phase items -> prep days
    # Post phase items -> post days
    # Flat items without phase -> spread across all shoot days

    daily_results = []
    warnings = []
    total_created = 0
    total_updated = 0
    total_removed = 0

    for day_index, prod_day in enumerate(production_days):
        day_id = prod_day["id"]
        day_date = prod_day.get("date", "")
        day_type = prod_day.get("type", "shoot")

        # Get or create daily budget for this day
        daily_budget_response = supabase.table("backlot_daily_budgets").select("*").eq(
            "production_day_id", day_id
        ).execute()

        if daily_budget_response.data:
            daily_budget = daily_budget_response.data[0]
        else:
            # Create daily budget
            daily_budget_data = {
                "project_id": project_id,
                "budget_id": budget_id,
                "production_day_id": day_id,
                "date": day_date
            }
            create_response = supabase.table("backlot_daily_budgets").insert(daily_budget_data).execute()
            if not create_response.data:
                warnings.append(f"Failed to create daily budget for {day_date}")
                continue
            daily_budget = create_response.data[0]

        daily_budget_id = daily_budget["id"]

        # Get existing items for this daily budget (for update/remove)
        existing_items_response = supabase.table("backlot_daily_budget_items").select("*").eq(
            "daily_budget_id", daily_budget_id
        ).execute()
        existing_items = {
            item.get("budget_line_item_id"): item
            for item in (existing_items_response.data or [])
            if item.get("budget_line_item_id")
        }

        items_created = 0
        items_updated = 0
        items_removed = 0
        day_total = 0
        day_warnings = []

        # Determine which line items apply to this day
        applicable_items = []
        for li in line_items:
            li_phase = li.get("phase") or (li.get("category") or {}).get("phase")
            calc_mode = li.get("calc_mode", "flat")

            # Skip items that don't apply to this day type
            if day_type == "shoot":
                # Shoot days get production phase items and items calculated by day
                if li_phase in ["production", None] or calc_mode in ["rate_x_days"]:
                    applicable_items.append(li)
            elif day_type == "prep":
                if li_phase == "prep":
                    applicable_items.append(li)
            elif day_type == "wrap":
                if li_phase == "wrap":
                    applicable_items.append(li)
            # For other day types, skip

        # Process applicable items
        processed_item_ids = set()

        for li in applicable_items:
            li_id = li["id"]
            processed_item_ids.add(li_id)

            # Calculate allocation for this day
            allocation = calculate_daily_allocation(
                li,
                total_shoot_days if day_type == "shoot" else total_days,
                day_index,
                sync_input.split_method
            )

            if allocation <= 0:
                continue

            day_total += allocation

            item_data = {
                "daily_budget_id": daily_budget_id,
                "budget_line_item_id": li_id,
                "label": li.get("description", ""),
                "category_name": (li.get("category") or {}).get("name"),
                "estimated_amount": allocation,
                "is_ad_hoc": False,
                "sort_order": li.get("sort_order", 0)
            }

            if li_id in existing_items:
                # Update existing item
                existing = existing_items[li_id]
                supabase.table("backlot_daily_budget_items").update({
                    "estimated_amount": allocation,
                    "label": item_data["label"],
                    "category_name": item_data["category_name"],
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", existing["id"]).execute()
                items_updated += 1
            else:
                # Create new item
                supabase.table("backlot_daily_budget_items").insert(item_data).execute()
                items_created += 1

        # Remove items that are no longer applicable (if full sync)
        if sync_input.sync_mode == "full":
            for li_id, existing_item in existing_items.items():
                if li_id not in processed_item_ids and not existing_item.get("is_ad_hoc"):
                    supabase.table("backlot_daily_budget_items").delete().eq(
                        "id", existing_item["id"]
                    ).execute()
                    items_removed += 1

        # Update daily budget totals
        supabase.table("backlot_daily_budgets").update({
            "estimated_total": day_total,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", daily_budget_id).execute()

        daily_results.append(DailyBudgetSyncResult(
            daily_budget_id=daily_budget_id,
            production_day_id=day_id,
            date=day_date,
            items_created=items_created,
            items_updated=items_updated,
            items_removed=items_removed,
            total_estimated=day_total,
            warnings=day_warnings
        ))

        total_created += items_created
        total_updated += items_updated
        total_removed += items_removed
        warnings.extend(day_warnings)

    return BudgetSyncSummary(
        total_days_synced=len(daily_results),
        total_items_created=total_created,
        total_items_updated=total_updated,
        total_items_removed=total_removed,
        daily_results=daily_results,
        warnings=warnings
    )


@router.post("/projects/{project_id}/budget/sync-day/{production_day_id}", response_model=DailyBudgetSyncResult)
async def sync_budget_to_single_day(
    project_id: str,
    production_day_id: str,
    authorization: str = Header(None)
):
    """Sync budget to a single production day"""
    sync_input = BudgetToDailySyncInput(
        sync_mode="full",
        production_day_ids=[production_day_id]
    )

    result = await sync_budget_to_daily_budgets(project_id, sync_input, authorization)

    if result.daily_results:
        return result.daily_results[0]

    raise HTTPException(status_code=400, detail="Failed to sync day")


# =====================================================
# BUDGET PDF EXPORT
# =====================================================

class BudgetPdfExportInput(BaseModel):
    """Options for budget PDF export"""
    include_top_sheet: bool = True
    include_detail: bool = True
    include_daily_budgets: bool = False
    include_receipts_summary: bool = False
    show_actuals: bool = True
    show_variance: bool = True
    category_types: Optional[List[str]] = None  # Filter to specific category types


def generate_budget_pdf_html(
    project: Dict[str, Any],
    budget: Dict[str, Any],
    categories: List[Dict[str, Any]],
    line_items: List[Dict[str, Any]],
    top_sheet: Optional[Dict[str, Any]],
    options: BudgetPdfExportInput
) -> str:
    """Generate HTML for budget PDF"""
    # Group line items by category
    items_by_category = {}
    for item in line_items:
        cat_id = item.get("category_id") or "uncategorized"
        if cat_id not in items_by_category:
            items_by_category[cat_id] = []
        items_by_category[cat_id].append(item)

    # Format currency helper
    def fmt_currency(amount: float, currency: str = "USD") -> str:
        if currency == "USD":
            return f"${amount:,.2f}"
        elif currency == "EUR":
            return f"€{amount:,.2f}"
        elif currency == "GBP":
            return f"£{amount:,.2f}"
        else:
            return f"{currency} {amount:,.2f}"

    currency = budget.get("currency", "USD")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: 'Helvetica Neue', Arial, sans-serif;
                font-size: 10pt;
                color: #333;
                margin: 0;
                padding: 20px;
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
            }}
            .header h1 {{
                font-size: 18pt;
                margin: 0 0 5px 0;
                text-transform: uppercase;
            }}
            .header h2 {{
                font-size: 14pt;
                margin: 0 0 10px 0;
                font-weight: normal;
            }}
            .header .meta {{
                font-size: 9pt;
                color: #666;
            }}
            .section {{
                margin-bottom: 25px;
            }}
            .section-title {{
                font-size: 12pt;
                font-weight: bold;
                background-color: #f5f5f5;
                padding: 8px 12px;
                margin-bottom: 10px;
                border-left: 4px solid #333;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }}
            th, td {{
                padding: 6px 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }}
            th {{
                background-color: #f9f9f9;
                font-weight: bold;
                font-size: 9pt;
            }}
            td.amount {{
                text-align: right;
                font-family: 'Monaco', 'Courier New', monospace;
            }}
            .variance-positive {{
                color: #c53030;
            }}
            .variance-negative {{
                color: #276749;
            }}
            .total-row {{
                font-weight: bold;
                background-color: #f5f5f5;
            }}
            .grand-total-row {{
                font-weight: bold;
                font-size: 11pt;
                background-color: #333;
                color: white;
            }}
            .grand-total-row td {{
                border-bottom: none;
            }}
            .category-header {{
                background-color: #e8e8e8;
                font-weight: bold;
            }}
            .top-sheet-table th {{
                background-color: #333;
                color: white;
            }}
            .page-break {{
                page-break-before: always;
            }}
            .footer {{
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                text-align: center;
                font-size: 8pt;
                color: #999;
                padding: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{project.get("title", "Production Budget")}</h1>
            <h2>{budget.get("name", "Budget")}</h2>
            <div class="meta">
                Generated: {datetime.utcnow().strftime("%B %d, %Y at %I:%M %p UTC")}<br>
                Currency: {currency} | Status: {budget.get("status", "draft").replace("_", " ").title()}
            </div>
        </div>
    """

    # Top Sheet section
    if options.include_top_sheet and top_sheet:
        html += """
        <div class="section">
            <div class="section-title">TOP SHEET SUMMARY</div>
            <table class="top-sheet-table">
                <thead>
                    <tr>
                        <th style="width: 40%">Category</th>
                        <th style="width: 20%" class="amount">Estimated</th>
        """
        if options.show_actuals:
            html += '<th style="width: 20%" class="amount">Actual</th>'
        if options.show_variance:
            html += '<th style="width: 20%" class="amount">Variance</th>'
        html += """
                    </tr>
                </thead>
                <tbody>
        """

        # Above the Line
        atl_total = top_sheet.get("above_the_line_total", 0)
        html += f"""
                    <tr class="category-header">
                        <td>ABOVE THE LINE</td>
                        <td class="amount">{fmt_currency(atl_total, currency)}</td>
        """
        if options.show_actuals:
            html += f'<td class="amount">-</td>'
        if options.show_variance:
            html += f'<td class="amount">-</td>'
        html += "</tr>"

        # Production
        prod_total = top_sheet.get("production_total", 0)
        html += f"""
                    <tr class="category-header">
                        <td>PRODUCTION</td>
                        <td class="amount">{fmt_currency(prod_total, currency)}</td>
        """
        if options.show_actuals:
            html += f'<td class="amount">-</td>'
        if options.show_variance:
            html += f'<td class="amount">-</td>'
        html += "</tr>"

        # Post
        post_total = top_sheet.get("post_total", 0)
        html += f"""
                    <tr class="category-header">
                        <td>POST-PRODUCTION</td>
                        <td class="amount">{fmt_currency(post_total, currency)}</td>
        """
        if options.show_actuals:
            html += f'<td class="amount">-</td>'
        if options.show_variance:
            html += f'<td class="amount">-</td>'
        html += "</tr>"

        # Other
        other_total = top_sheet.get("other_total", 0)
        html += f"""
                    <tr class="category-header">
                        <td>OTHER / INDIRECT</td>
                        <td class="amount">{fmt_currency(other_total, currency)}</td>
        """
        if options.show_actuals:
            html += f'<td class="amount">-</td>'
        if options.show_variance:
            html += f'<td class="amount">-</td>'
        html += "</tr>"

        # Subtotal
        subtotal = top_sheet.get("subtotal", 0)
        html += f"""
                    <tr class="total-row">
                        <td>SUBTOTAL</td>
                        <td class="amount">{fmt_currency(subtotal, currency)}</td>
        """
        if options.show_actuals:
            html += f'<td class="amount">-</td>'
        if options.show_variance:
            html += f'<td class="amount">-</td>'
        html += "</tr>"

        # Contingency
        contingency_pct = budget.get("contingency_percent", 0)
        contingency_amt = top_sheet.get("contingency_amount", 0)
        html += f"""
                    <tr>
                        <td>Contingency ({contingency_pct}%)</td>
                        <td class="amount">{fmt_currency(contingency_amt, currency)}</td>
        """
        if options.show_actuals:
            html += f'<td class="amount">-</td>'
        if options.show_variance:
            html += f'<td class="amount">-</td>'
        html += "</tr>"

        # Grand Total
        grand_total = top_sheet.get("grand_total", 0)
        html += f"""
                    <tr class="grand-total-row">
                        <td>GRAND TOTAL</td>
                        <td class="amount">{fmt_currency(grand_total, currency)}</td>
        """
        if options.show_actuals:
            actual_total = budget.get("actual_total", 0)
            html += f'<td class="amount">{fmt_currency(actual_total, currency)}</td>'
        if options.show_variance:
            variance = budget.get("variance", 0)
            variance_class = "variance-positive" if variance > 0 else "variance-negative" if variance < 0 else ""
            html += f'<td class="amount {variance_class}">{fmt_currency(variance, currency)}</td>'
        html += """
                    </tr>
                </tbody>
            </table>
        </div>
        """

    # Detail section
    if options.include_detail:
        html += """
        <div class="section page-break">
            <div class="section-title">BUDGET DETAIL</div>
        """

        # Filter categories by type if specified
        filtered_categories = categories
        if options.category_types:
            filtered_categories = [
                c for c in categories
                if c.get("category_type") in options.category_types
            ]

        for category in filtered_categories:
            cat_id = category.get("id")
            cat_name = category.get("name", "Uncategorized")
            cat_code = category.get("code") or ""
            cat_items = items_by_category.get(cat_id, [])

            estimated_subtotal = category.get("estimated_subtotal", 0)
            actual_subtotal = category.get("actual_subtotal", 0)

            html += f"""
            <table>
                <thead>
                    <tr class="category-header">
                        <th colspan="2">{cat_code} {cat_name}</th>
                        <th class="amount">Rate</th>
                        <th class="amount">Qty</th>
                        <th class="amount">Estimated</th>
            """
            if options.show_actuals:
                html += '<th class="amount">Actual</th>'
            if options.show_variance:
                html += '<th class="amount">Variance</th>'
            html += """
                    </tr>
                </thead>
                <tbody>
            """

            for item in cat_items:
                account_code = item.get("account_code") or ""
                description = item.get("description", "")
                rate = item.get("rate_amount", 0)
                qty = item.get("quantity", 1)
                estimated = item.get("estimated_total", 0)
                actual = item.get("actual_total", 0)
                variance = actual - estimated

                variance_class = "variance-positive" if variance > 0 else "variance-negative" if variance < 0 else ""

                html += f"""
                    <tr>
                        <td style="width: 10%">{account_code}</td>
                        <td style="width: 35%">{description}</td>
                        <td class="amount">{fmt_currency(rate, currency)}</td>
                        <td class="amount">{qty}</td>
                        <td class="amount">{fmt_currency(estimated, currency)}</td>
                """
                if options.show_actuals:
                    html += f'<td class="amount">{fmt_currency(actual, currency)}</td>'
                if options.show_variance:
                    html += f'<td class="amount {variance_class}">{fmt_currency(variance, currency)}</td>'
                html += "</tr>"

            # Category subtotal
            cat_variance = actual_subtotal - estimated_subtotal
            cat_variance_class = "variance-positive" if cat_variance > 0 else "variance-negative" if cat_variance < 0 else ""

            html += f"""
                    <tr class="total-row">
                        <td colspan="4" style="text-align: right">Subtotal:</td>
                        <td class="amount">{fmt_currency(estimated_subtotal, currency)}</td>
            """
            if options.show_actuals:
                html += f'<td class="amount">{fmt_currency(actual_subtotal, currency)}</td>'
            if options.show_variance:
                html += f'<td class="amount {cat_variance_class}">{fmt_currency(cat_variance, currency)}</td>'
            html += """
                    </tr>
                </tbody>
            </table>
            """

        html += "</div>"

    # Footer
    html += """
        <div class="footer">
            Generated by Second Watch Network - Backlot Production Management
        </div>
    </body>
    </html>
    """

    return html


@router.get("/projects/{project_id}/budget/export-pdf")
async def export_budget_pdf(
    project_id: str,
    include_top_sheet: bool = True,
    include_detail: bool = True,
    include_daily_budgets: bool = False,
    include_receipts_summary: bool = False,
    show_actuals: bool = True,
    show_variance: bool = True,
    authorization: str = Header(None)
):
    """Export budget as PDF"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("*").eq("project_id", project_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget = budget_response.data[0]
    budget_id = budget["id"]

    # Get project
    project_response = supabase.table("backlot_projects").select("*").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    project = project_response.data[0]

    # Get categories
    categories_response = supabase.table("backlot_budget_categories").select("*").eq(
        "budget_id", budget_id
    ).order("sort_order").execute()
    categories = categories_response.data or []

    # Get line items
    line_items_response = supabase.table("backlot_budget_line_items").select("*").eq(
        "budget_id", budget_id
    ).order("sort_order").execute()
    line_items = line_items_response.data or []

    # Get top sheet cache if available
    top_sheet = None
    top_sheet_response = supabase.table("backlot_budget_top_sheet_cache").select("*").eq(
        "budget_id", budget_id
    ).execute()
    if top_sheet_response.data:
        top_sheet = top_sheet_response.data[0]

    # Generate PDF options
    options = BudgetPdfExportInput(
        include_top_sheet=include_top_sheet,
        include_detail=include_detail,
        include_daily_budgets=include_daily_budgets,
        include_receipts_summary=include_receipts_summary,
        show_actuals=show_actuals,
        show_variance=show_variance
    )

    # Generate HTML
    html_content = generate_budget_pdf_html(
        project=project,
        budget=budget,
        categories=categories,
        line_items=line_items,
        top_sheet=top_sheet,
        options=options
    )

    # For now, return HTML directly (can be converted to PDF with weasyprint or similar)
    # In production, you'd use a PDF generation library
    filename = f"{project.get('title', 'budget')}-budget-{datetime.utcnow().strftime('%Y%m%d')}.html"

    return Response(
        content=html_content,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# =============================================================================
# BUDGET BUNDLE ENDPOINTS - Intentional Budget Creation
# =============================================================================

def _convert_bundle_to_response(bundle, is_recommended: bool = False) -> DepartmentBundleResponse:
    """Convert internal bundle to API response format"""
    total_items = sum(
        len(cat.line_items)
        for cat in bundle.categories
    )
    return DepartmentBundleResponse(
        id=bundle.id,
        name=bundle.name,
        description=bundle.description,
        category_type=bundle.category_type.value,
        icon=bundle.icon,
        categories=[
            BundleCategoryResponse(
                name=cat.name,
                code=cat.code,
                account_code_prefix=cat.account_code_prefix,
                category_type=cat.category_type.value,
                sort_order=cat.sort_order,
                color=cat.color,
                line_items=[
                    BundleLineItemResponse(
                        account_code=item.account_code,
                        description=item.description,
                        calc_mode=item.calc_mode.value,
                        default_units=item.default_units,
                        department=item.department,
                        phase=item.phase.value if item.phase else None,
                        is_essential=item.is_essential
                    )
                    for item in cat.line_items
                ]
            )
            for cat in bundle.categories
        ],
        total_line_items=total_items,
        is_recommended=is_recommended
    )


@router.get("/budget-bundles", response_model=BundleListResponse)
async def get_budget_bundles():
    """
    Get all available department bundles for budget creation.

    These bundles are building blocks for intentional budget creation.
    Users can select which bundles to include when creating a budget.
    """
    from app.services.budget_templates import (
        get_all_bundles,
        BudgetProjectType,
        CategoryType
    )

    all_bundles = get_all_bundles()

    return BundleListResponse(
        bundles=[_convert_bundle_to_response(b) for b in all_bundles],
        project_types=[pt.value for pt in BudgetProjectType],
        category_types=[ct.value for ct in CategoryType]
    )


@router.get("/budget-bundles/recommended/{project_type}", response_model=RecommendedBundlesResponse)
async def get_recommended_bundles_for_project_type(project_type: str):
    """
    Get recommended bundles for a specific project type.

    Returns three lists:
    - recommended: Bundles commonly used for this project type
    - core_essentials: Minimal bundles with essential items only
    - all_available: All bundles (for "add more" UI)
    """
    from app.services.budget_templates import (
        get_all_bundles,
        get_recommended_bundles,
        get_core_essentials_bundles,
        BudgetProjectType
    )

    try:
        pt = BudgetProjectType(project_type)
    except ValueError:
        pt = BudgetProjectType.FEATURE

    recommended = get_recommended_bundles(pt)
    recommended_ids = {b.id for b in recommended}

    core = get_core_essentials_bundles()
    core_ids = {b.id for b in core}

    all_bundles = get_all_bundles()

    return RecommendedBundlesResponse(
        project_type=pt.value,
        recommended=[_convert_bundle_to_response(b, is_recommended=True) for b in recommended],
        core_essentials=[_convert_bundle_to_response(b) for b in core],
        all_available=[_convert_bundle_to_response(b, is_recommended=(b.id in recommended_ids)) for b in all_bundles]
    )


@router.get("/budget-bundles/{bundle_id}", response_model=DepartmentBundleResponse)
async def get_bundle_by_id(bundle_id: str):
    """Get a specific bundle by ID"""
    from app.services.budget_templates import get_bundle_by_id as get_bundle

    bundle = get_bundle(bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail=f"Bundle '{bundle_id}' not found")

    return _convert_bundle_to_response(bundle)


@router.post("/projects/{project_id}/budget/from-bundles", response_model=BudgetCreationResult)
async def create_budget_from_bundles(
    project_id: str,
    options: CreateBudgetFromBundlesInput,
    authorization: str = Header(None)
):
    """
    Create a budget with intentional seeding from selected bundles.

    This is the PRIMARY budget creation endpoint. It respects the
    "no auto-populate giant templates" rule by only including what
    the user explicitly selects.

    Seed modes:
    - "blank": Creates budget with no categories or line items
    - "categories_only": Creates high-level categories only (no line items)
    - "bundles": Creates categories and line items from selected bundles
    - "essentials": Creates from core essential items only
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()
    await verify_budget_access(supabase, project_id, user_id)

    # Check if budget already exists
    existing = supabase.table("backlot_budgets").select("id").eq("project_id", project_id).eq("name", options.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="A budget with this name already exists for this project")

    # Import template service
    from app.services.budget_templates import (
        get_bundle_by_id as get_bundle,
        get_core_essentials_bundles,
        get_high_level_categories,
        get_categories_from_bundles,
        filter_essential_items,
        BudgetProjectType
    )

    try:
        pt = BudgetProjectType(options.project_type)
    except ValueError:
        pt = BudgetProjectType.FEATURE

    # Create the budget record
    # Note: variance and contingency_amount are GENERATED columns in the database
    # They are computed automatically and cannot be inserted directly
    budget_data = {
        "project_id": project_id,
        "name": options.name,
        "currency": options.currency,
        "contingency_percent": options.contingency_percent,
        "status": "draft",
        "estimated_total": 0,
        "actual_total": 0,
        # variance is GENERATED AS (actual_total - estimated_total)
        # contingency_amount is GENERATED AS (estimated_total * contingency_percent / 100)
        "version": 1,
        "created_by": user_id,
        "project_type_template": options.project_type,
        "has_top_sheet": True,
        "shoot_days": options.shoot_days,
        "prep_days": options.prep_days,
        "wrap_days": options.wrap_days,
        "post_days": options.post_days,
        "episode_count": options.episode_count,
        "union_type": options.union_type
    }

    result = supabase.table("backlot_budgets").insert(budget_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create budget")

    budget = result.data[0]
    budget_id = budget["id"]

    categories_created = 0
    line_items_created = 0
    bundles_used = []

    # Get categories to create based on seed_mode
    categories_to_create = []

    if options.seed_mode == "blank":
        # No seeding - budget starts completely empty
        pass

    elif options.seed_mode == "categories_only":
        # Create high-level category shells without line items
        categories_to_create = get_high_level_categories(pt)
        # Filter based on user preferences
        if not options.include_above_the_line:
            categories_to_create = [c for c in categories_to_create if c.category_type.value != "above_the_line"]
        if not options.include_production:
            categories_to_create = [c for c in categories_to_create if c.category_type.value != "production"]
        if not options.include_post:
            categories_to_create = [c for c in categories_to_create if c.category_type.value != "post"]
        if not options.include_other:
            categories_to_create = [c for c in categories_to_create if c.category_type.value != "other"]
        # Clear line items for categories_only mode
        for cat in categories_to_create:
            cat.line_items = []

    elif options.seed_mode == "essentials":
        # Get core essential bundles
        essential_bundles = get_core_essentials_bundles()
        for bundle in essential_bundles:
            filtered = filter_essential_items(bundle)
            bundles_used.append(bundle.id)
            for cat in filtered.categories:
                categories_to_create.append(cat)

    elif options.seed_mode == "bundles":
        # Use selected bundles
        if options.selected_bundle_ids:
            categories_to_create = get_categories_from_bundles(
                options.selected_bundle_ids,
                essentials_only=False
            )
            bundles_used = options.selected_bundle_ids

    # Create categories and line items
    category_id_map = {}  # Track created category IDs by code

    for cat in categories_to_create:
        # Check if we already created this category (avoid duplicates)
        if cat.code in category_id_map:
            continue

        cat_data = {
            "budget_id": budget_id,
            "name": cat.name,
            "code": cat.code,
            "account_code_prefix": cat.account_code_prefix,
            "category_type": cat.category_type.value,
            "sort_order": cat.sort_order,
            "color": cat.color,
            "estimated_subtotal": 0,
            "actual_subtotal": 0,
            "is_above_the_line": cat.category_type.value == "above_the_line"
        }

        cat_result = supabase.table("backlot_budget_categories").insert(cat_data).execute()
        if cat_result.data:
            categories_created += 1
            cat_id = cat_result.data[0]["id"]
            category_id_map[cat.code] = cat_id

            # Create line items for this category
            for idx, item in enumerate(cat.line_items):
                # Note: estimated_total and variance are GENERATED columns in backlot_budget_line_items
                # estimated_total = rate_amount * quantity (computed by DB)
                # variance = actual_total - estimated_total (computed by DB)
                item_data = {
                    "budget_id": budget_id,
                    "category_id": cat_id,
                    "account_code": item.account_code,
                    "description": item.description,
                    "rate_type": "flat" if item.calc_mode.value == "flat" else "daily",
                    "rate_amount": 0,
                    "quantity": 1,
                    "units": item.default_units,
                    # estimated_total is GENERATED AS (rate_amount * quantity)
                    "actual_total": 0,
                    # variance is GENERATED AS (actual_total - estimated_total)
                    "is_allocated_to_days": False,
                    "total_allocated": 0,
                    "is_locked": False,
                    "sort_order": idx,
                    "calc_mode": item.calc_mode.value,
                    "department": item.department,
                    "phase": item.phase.value if item.phase else None
                }

                item_result = supabase.table("backlot_budget_line_items").insert(item_data).execute()
                if item_result.data:
                    line_items_created += 1

    return BudgetCreationResult(
        budget=Budget(**budget),
        categories_created=categories_created,
        line_items_created=line_items_created,
        bundles_used=bundles_used,
        seed_mode=options.seed_mode
    )


@router.post("/budgets/{budget_id}/add-bundle", response_model=Dict[str, Any])
async def add_bundle_to_budget(
    budget_id: str,
    bundle_id: str,
    essentials_only: bool = False,
    authorization: str = Header(None)
):
    """
    Add a department bundle to an existing budget.

    This allows users to incrementally add bundles after budget creation.
    Categories and line items from the bundle will be added.
    """
    current_user = await get_current_user_from_token(authorization)
    user_id = current_user["id"]

    supabase = get_supabase_admin_client()

    # Get budget
    budget_response = supabase.table("backlot_budgets").select("project_id, status").eq("id", budget_id).execute()
    if not budget_response.data:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget = budget_response.data[0]
    if budget["status"] == "locked":
        raise HTTPException(status_code=400, detail="Cannot modify a locked budget")

    await verify_budget_access(supabase, budget["project_id"], user_id)

    # Get the bundle
    from app.services.budget_templates import get_bundle_by_id as get_bundle, filter_essential_items

    bundle = get_bundle(bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail=f"Bundle '{bundle_id}' not found")

    # Filter to essentials if requested
    if essentials_only:
        bundle = filter_essential_items(bundle)

    # Get existing categories for this budget
    existing_cats = supabase.table("backlot_budget_categories").select("code").eq("budget_id", budget_id).execute()
    existing_codes = {c["code"] for c in (existing_cats.data or [])}

    categories_created = 0
    line_items_created = 0

    for cat in bundle.categories:
        # Check if category already exists
        if cat.code in existing_codes:
            # Get existing category ID
            cat_lookup = supabase.table("backlot_budget_categories").select("id").eq("budget_id", budget_id).eq("code", cat.code).execute()
            if cat_lookup.data:
                cat_id = cat_lookup.data[0]["id"]
                # Add line items to existing category
                for idx, item in enumerate(cat.line_items):
                    # Check if line item already exists
                    existing_item = supabase.table("backlot_budget_line_items").select("id").eq("budget_id", budget_id).eq("account_code", item.account_code).execute()
                    if not existing_item.data:
                        # Note: estimated_total and variance are GENERATED columns
                        item_data = {
                            "budget_id": budget_id,
                            "category_id": cat_id,
                            "account_code": item.account_code,
                            "description": item.description,
                            "rate_type": "flat" if item.calc_mode.value == "flat" else "daily",
                            "rate_amount": 0,
                            "quantity": 1,
                            "units": item.default_units,
                            # estimated_total is GENERATED AS (rate_amount * quantity)
                            "actual_total": 0,
                            # variance is GENERATED AS (actual_total - estimated_total)
                            "is_allocated_to_days": False,
                            "total_allocated": 0,
                            "is_locked": False,
                            "sort_order": 999 + idx,
                            "calc_mode": item.calc_mode.value,
                            "department": item.department,
                            "phase": item.phase.value if item.phase else None
                        }
                        item_result = supabase.table("backlot_budget_line_items").insert(item_data).execute()
                        if item_result.data:
                            line_items_created += 1
        else:
            # Create new category
            cat_data = {
                "budget_id": budget_id,
                "name": cat.name,
                "code": cat.code,
                "account_code_prefix": cat.account_code_prefix,
                "category_type": cat.category_type.value,
                "sort_order": cat.sort_order,
                "color": cat.color,
                "estimated_subtotal": 0,
                "actual_subtotal": 0,
                "is_above_the_line": cat.category_type.value == "above_the_line"
            }

            cat_result = supabase.table("backlot_budget_categories").insert(cat_data).execute()
            if cat_result.data:
                categories_created += 1
                cat_id = cat_result.data[0]["id"]
                existing_codes.add(cat.code)

                # Create line items
                for idx, item in enumerate(cat.line_items):
                    # Note: estimated_total and variance are GENERATED columns
                    item_data = {
                        "budget_id": budget_id,
                        "category_id": cat_id,
                        "account_code": item.account_code,
                        "description": item.description,
                        "rate_type": "flat" if item.calc_mode.value == "flat" else "daily",
                        "rate_amount": 0,
                        "quantity": 1,
                        "units": item.default_units,
                        # estimated_total is GENERATED AS (rate_amount * quantity)
                        "actual_total": 0,
                        # variance is GENERATED AS (actual_total - estimated_total)
                        "is_allocated_to_days": False,
                        "total_allocated": 0,
                        "is_locked": False,
                        "sort_order": idx,
                        "calc_mode": item.calc_mode.value,
                        "department": item.department,
                        "phase": item.phase.value if item.phase else None
                    }

                    item_result = supabase.table("backlot_budget_line_items").insert(item_data).execute()
                    if item_result.data:
                        line_items_created += 1

    return {
        "success": True,
        "bundle_id": bundle_id,
        "categories_created": categories_created,
        "line_items_created": line_items_created,
        "message": f"Added bundle '{bundle.name}' to budget"
    }
