"""
Backlot API Endpoints
Handles AI co-pilot chat, call sheet distribution, and other Backlot-specific functionality
"""
from fastapi import APIRouter, HTTPException, Depends, Header, File, UploadFile, Form, Body
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

    # Get top sheet cache if available, or compute it dynamically
    top_sheet = None
    top_sheet_response = supabase.table("backlot_budget_top_sheet_cache").select("*").eq(
        "budget_id", budget_id
    ).execute()
    if top_sheet_response.data:
        top_sheet = top_sheet_response.data[0]
    else:
        # Compute top sheet dynamically from categories
        above_the_line_total = 0
        production_total = 0
        post_total = 0
        other_total = 0

        for cat in categories:
            cat_type = cat.get("category_type", "other")
            estimated = cat.get("estimated_subtotal", 0) or 0

            if cat_type == "above_the_line":
                above_the_line_total += estimated
            elif cat_type == "production":
                production_total += estimated
            elif cat_type == "post_production":
                post_total += estimated
            else:
                other_total += estimated

        subtotal = above_the_line_total + production_total + post_total + other_total
        contingency_pct = budget.get("contingency_percent", 0) or 0
        contingency_amount = subtotal * contingency_pct / 100
        grand_total = subtotal + contingency_amount

        top_sheet = {
            "above_the_line_total": above_the_line_total,
            "production_total": production_total,
            "post_total": post_total,
            "other_total": other_total,
            "subtotal": subtotal,
            "contingency_amount": contingency_amount,
            "grand_total": grand_total
        }

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

    # Convert HTML to PDF using weasyprint
    filename = f"{project.get('title', 'budget')}-budget-{datetime.utcnow().strftime('%Y%m%d')}.pdf"

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except ImportError:
        # Fallback to HTML if weasyprint is not installed
        filename = filename.replace('.pdf', '.html')
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


# =====================================================
# Global Location Library API Endpoints
# =====================================================

class LocationInput(BaseModel):
    """Input model for creating/updating a location"""
    name: str
    description: Optional[str] = None
    scene_description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: str = "USA"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    parking_notes: Optional[str] = None
    load_in_notes: Optional[str] = None
    power_available: bool = True
    restrooms_available: bool = True
    permit_required: bool = False
    permit_notes: Optional[str] = None
    permit_obtained: bool = False
    location_fee: Optional[float] = None
    fee_notes: Optional[str] = None
    images: Optional[List[str]] = None
    is_public: bool = True
    region_tag: Optional[str] = None
    location_type: Optional[str] = None
    amenities: Optional[List[str]] = None


class LocationSearchParams(BaseModel):
    """Search parameters for global location library"""
    query: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    location_type: Optional[str] = None
    limit: int = 50
    offset: int = 0


class ProjectLocationAttachment(BaseModel):
    """Model for attaching a location to a project"""
    location_id: str
    project_notes: Optional[str] = None
    scene_description: Optional[str] = None


@router.get("/locations/global")
async def search_global_locations(
    query: Optional[str] = None,
    region: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    location_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    authorization: str = Header(None)
):
    """
    Search the global location library.
    Returns public locations matching the search criteria.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Build query for public locations
        q = supabase.table("backlot_locations").select("*").eq("is_public", True)

        # Apply filters
        if query:
            # Search by name, address, or city
            q = q.or_(f"name.ilike.%{query}%,address.ilike.%{query}%,city.ilike.%{query}%")

        if region:
            q = q.eq("region_tag", region)

        if city:
            q = q.ilike("city", f"%{city}%")

        if state:
            q = q.eq("state", state)

        if location_type:
            q = q.eq("location_type", location_type)

        # Apply pagination and ordering
        q = q.order("name").range(offset, offset + limit - 1)

        result = q.execute()

        return {
            "locations": result.data or [],
            "count": len(result.data or []),
            "offset": offset,
            "limit": limit
        }

    except Exception as e:
        print(f"Error searching global locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/locations/regions")
async def get_location_regions(authorization: str = Header(None)):
    """
    Get a list of distinct region tags from the location library.
    Useful for populating a region filter dropdown.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_locations").select("region_tag").eq("is_public", True).not_.is_("region_tag", "null").execute()

        # Extract unique regions
        regions = list(set([r["region_tag"] for r in result.data if r.get("region_tag")]))
        regions.sort()

        return {"regions": regions}

    except Exception as e:
        print(f"Error fetching regions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/locations/types")
async def get_location_types(authorization: str = Header(None)):
    """
    Get a list of distinct location types from the library.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_locations").select("location_type").eq("is_public", True).not_.is_("location_type", "null").execute()

        # Extract unique types
        types = list(set([r["location_type"] for r in result.data if r.get("location_type")]))
        types.sort()

        return {"types": types}

    except Exception as e:
        print(f"Error fetching location types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/locations")
async def get_project_locations(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get all locations attached to a project.
    Returns both the attachment info and the full location data.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project membership (check both owner and members)
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id

    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        # Get attached locations with full location data
        result = supabase.table("backlot_project_locations").select(
            "*, location:location_id(*)"
        ).eq("project_id", project_id).execute()

        # Flatten the response
        locations = []
        for pl in result.data or []:
            location = pl.get("location", {})
            if location:
                locations.append({
                    **location,
                    "attachment_id": pl["id"],
                    "project_notes": pl.get("project_notes"),
                    "scene_description_override": pl.get("scene_description"),
                    "attached_at": pl.get("attached_at"),
                    "attached_by_user_id": pl.get("attached_by_user_id")
                })

        return {"locations": locations}

    except Exception as e:
        print(f"Error fetching project locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/locations")
async def create_project_location(
    project_id: str,
    location: LocationInput,
    authorization: str = Header(None)
):
    """
    Create a new location from a project context.
    The location is added to the global library (if is_public=True)
    and automatically attached to the project.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project membership with edit permissions (check both owner and members)
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id

    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

        member = member_response.data[0]
        if member["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to create locations")

    try:
        # Create the location in the global library
        location_data = {
            "name": location.name,
            "description": location.description,
            "scene_description": location.scene_description,
            "address": location.address,
            "city": location.city,
            "state": location.state,
            "zip": location.zip,
            "country": location.country,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "contact_name": location.contact_name,
            "contact_phone": location.contact_phone,
            "contact_email": location.contact_email,
            "parking_notes": location.parking_notes,
            "load_in_notes": location.load_in_notes,
            "power_available": location.power_available,
            "restrooms_available": location.restrooms_available,
            "permit_required": location.permit_required,
            "permit_notes": location.permit_notes,
            "permit_obtained": location.permit_obtained,
            "location_fee": location.location_fee,
            "fee_notes": location.fee_notes,
            "images": location.images or [],
            "is_public": location.is_public,
            "region_tag": location.region_tag,
            "location_type": location.location_type,
            "amenities": location.amenities or [],
            "created_by_user_id": user_id,
            "created_by_project_id": project_id,
            "project_id": None  # Global location, not project-specific
        }

        loc_result = supabase.table("backlot_locations").insert(location_data).execute()

        if not loc_result.data:
            raise HTTPException(status_code=500, detail="Failed to create location")

        new_location = loc_result.data[0]

        # Automatically attach to the project
        attachment_data = {
            "project_id": project_id,
            "location_id": new_location["id"],
            "attached_by_user_id": user_id
        }

        supabase.table("backlot_project_locations").insert(attachment_data).execute()

        return {
            "success": True,
            "location": new_location,
            "message": "Location created and attached to project"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/locations/attach")
async def attach_location_to_project(
    project_id: str,
    attachment: ProjectLocationAttachment,
    authorization: str = Header(None)
):
    """
    Attach an existing location from the global library to a project.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project membership (check both owner and members)
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id

    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        # Verify the location exists and is accessible
        loc_result = supabase.table("backlot_locations").select("id, name, is_public").eq("id", attachment.location_id).execute()

        if not loc_result.data:
            raise HTTPException(status_code=404, detail="Location not found")

        location = loc_result.data[0]
        if not location.get("is_public"):
            raise HTTPException(status_code=403, detail="Cannot attach a private location")

        # Check if already attached
        existing = supabase.table("backlot_project_locations").select("id").eq("project_id", project_id).eq("location_id", attachment.location_id).execute()

        if existing.data:
            return {
                "success": True,
                "message": "Location already attached to project",
                "attachment_id": existing.data[0]["id"]
            }

        # Create the attachment
        attachment_data = {
            "project_id": project_id,
            "location_id": attachment.location_id,
            "project_notes": attachment.project_notes,
            "scene_description": attachment.scene_description,
            "attached_by_user_id": user_id
        }

        result = supabase.table("backlot_project_locations").insert(attachment_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to attach location")

        return {
            "success": True,
            "message": f"Location '{location['name']}' attached to project",
            "attachment_id": result.data[0]["id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error attaching location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}/locations/{location_id}")
async def detach_location_from_project(
    project_id: str,
    location_id: str,
    authorization: str = Header(None)
):
    """
    Detach a location from a project.
    This does NOT delete the location from the global library.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project membership (check both owner and members)
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id

    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        # Delete the attachment
        result = supabase.table("backlot_project_locations").delete().eq("project_id", project_id).eq("location_id", location_id).execute()

        return {
            "success": True,
            "message": "Location detached from project"
        }

    except Exception as e:
        print(f"Error detaching location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/locations/{location_id}")
async def get_location(
    location_id: str,
    authorization: str = Header(None)
):
    """
    Get a single location by ID.
    Only returns public locations or locations the user created.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_locations").select("*").eq("id", location_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Location not found")

        location = result.data[0]

        # Check access: must be public or created by the user
        if not location.get("is_public") and location.get("created_by_user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return {"location": location}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/locations/{location_id}")
async def update_location(
    location_id: str,
    location: LocationInput,
    authorization: str = Header(None)
):
    """
    Update a location.
    Only the creator can update a location.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify ownership
        existing = supabase.table("backlot_locations").select("id, created_by_user_id").eq("id", location_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Location not found")

        if existing.data[0].get("created_by_user_id") != user_id:
            raise HTTPException(status_code=403, detail="Only the creator can update this location")

        # Update the location
        update_data = {
            "name": location.name,
            "description": location.description,
            "scene_description": location.scene_description,
            "address": location.address,
            "city": location.city,
            "state": location.state,
            "zip": location.zip,
            "country": location.country,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "contact_name": location.contact_name,
            "contact_phone": location.contact_phone,
            "contact_email": location.contact_email,
            "parking_notes": location.parking_notes,
            "load_in_notes": location.load_in_notes,
            "power_available": location.power_available,
            "restrooms_available": location.restrooms_available,
            "permit_required": location.permit_required,
            "permit_notes": location.permit_notes,
            "permit_obtained": location.permit_obtained,
            "location_fee": location.location_fee,
            "fee_notes": location.fee_notes,
            "images": location.images or [],
            "is_public": location.is_public,
            "region_tag": location.region_tag,
            "location_type": location.location_type,
            "amenities": location.amenities or []
        }

        result = supabase.table("backlot_locations").update(update_data).eq("id", location_id).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update location")

        return {
            "success": True,
            "location": result.data[0]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/locations/{location_id}")
async def delete_location(
    location_id: str,
    authorization: str = Header(None)
):
    """
    Delete a location from the global library.
    Only the creator can delete a location.
    This will also remove all project attachments.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify ownership
        existing = supabase.table("backlot_locations").select("id, created_by_user_id, name").eq("id", location_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Location not found")

        if existing.data[0].get("created_by_user_id") != user_id:
            raise HTTPException(status_code=403, detail="Only the creator can delete this location")

        location_name = existing.data[0].get("name", "Unknown")

        # Delete the location (cascade will remove attachments)
        supabase.table("backlot_locations").delete().eq("id", location_id).execute()

        return {
            "success": True,
            "message": f"Location '{location_name}' deleted"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/projects/{project_id}/locations/{location_id}")
async def update_project_location_notes(
    project_id: str,
    location_id: str,
    project_notes: Optional[str] = None,
    scene_description: Optional[str] = None,
    authorization: str = Header(None)
):
    """
    Update project-specific notes for an attached location.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project membership (check both owner and members)
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id

    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        # Find the attachment
        existing = supabase.table("backlot_project_locations").select("id").eq("project_id", project_id).eq("location_id", location_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Location not attached to this project")

        # Update the attachment
        update_data = {}
        if project_notes is not None:
            update_data["project_notes"] = project_notes
        if scene_description is not None:
            update_data["scene_description"] = scene_description

        if update_data:
            result = supabase.table("backlot_project_locations").update(update_data).eq("id", existing.data[0]["id"]).execute()

            return {
                "success": True,
                "attachment": result.data[0] if result.data else None
            }

        return {"success": True, "message": "No changes made"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating project location notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# LOCATION SCOUT PHOTOS
# =====================================================

class ScoutPhotoInput(BaseModel):
    """Input model for creating/updating scout photos"""
    image_url: str
    thumbnail_url: Optional[str] = None
    original_filename: Optional[str] = None
    # Composition & vantage
    angle_label: Optional[str] = None
    vantage_type: Optional[str] = None  # wide, medium, close-up, detail, overhead, drone
    camera_facing: Optional[str] = None  # cardinal direction
    # Time & conditions
    time_of_day: Optional[str] = None  # morning, midday, afternoon, golden_hour, blue_hour, night
    shoot_date: Optional[str] = None  # ISO date string
    weather: Optional[str] = None
    # Practical notes
    light_notes: Optional[str] = None
    sound_notes: Optional[str] = None
    access_notes: Optional[str] = None
    power_notes: Optional[str] = None
    parking_notes: Optional[str] = None
    restrictions_notes: Optional[str] = None
    general_notes: Optional[str] = None
    # Classification
    is_primary: Optional[bool] = False
    interior_exterior: Optional[str] = None  # interior, exterior, both


class ScoutPhotoUpdateInput(BaseModel):
    """Input model for updating scout photos (all fields optional)"""
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    original_filename: Optional[str] = None
    angle_label: Optional[str] = None
    vantage_type: Optional[str] = None
    camera_facing: Optional[str] = None
    time_of_day: Optional[str] = None
    shoot_date: Optional[str] = None
    weather: Optional[str] = None
    light_notes: Optional[str] = None
    sound_notes: Optional[str] = None
    access_notes: Optional[str] = None
    power_notes: Optional[str] = None
    parking_notes: Optional[str] = None
    restrictions_notes: Optional[str] = None
    general_notes: Optional[str] = None
    is_primary: Optional[bool] = None
    interior_exterior: Optional[str] = None


async def can_user_edit_location(supabase, user_id: str, location_id: str) -> bool:
    """Check if user has permission to edit a location (for adding/editing scout photos)"""
    # Check if user is the location creator
    location = supabase.table("backlot_locations").select("created_by_user_id, project_id").eq("id", location_id).execute()
    if not location.data:
        return False

    loc_data = location.data[0]

    # User is creator
    if loc_data.get("created_by_user_id") == user_id:
        return True

    # User is member of the project that owns the location
    if loc_data.get("project_id"):
        member = supabase.table("backlot_project_members").select("role").eq("project_id", loc_data["project_id"]).eq("user_id", user_id).execute()
        if member.data:
            return True

    # User is member of a project that has attached this location
    attachments = supabase.table("backlot_project_locations").select("project_id").eq("location_id", location_id).execute()
    if attachments.data:
        for att in attachments.data:
            member = supabase.table("backlot_project_members").select("role").eq("project_id", att["project_id"]).eq("user_id", user_id).execute()
            if member.data:
                return True

    # Check if user is admin/superadmin
    user_data = supabase.table("users").select("is_admin, is_superadmin").eq("id", user_id).execute()
    if user_data.data:
        if user_data.data[0].get("is_admin") or user_data.data[0].get("is_superadmin"):
            return True

    return False


async def can_user_view_location(supabase, user_id: str, location_id: str) -> bool:
    """Check if user can view a location and its scout photos"""
    location = supabase.table("backlot_locations").select("is_public, created_by_user_id, project_id").eq("id", location_id).execute()
    if not location.data:
        return False

    loc_data = location.data[0]

    # Public locations are viewable by all authenticated users
    if loc_data.get("is_public"):
        return True

    # User is creator
    if loc_data.get("created_by_user_id") == user_id:
        return True

    # User is member of owning project
    if loc_data.get("project_id"):
        member = supabase.table("backlot_project_members").select("role").eq("project_id", loc_data["project_id"]).eq("user_id", user_id).execute()
        if member.data:
            return True

    # User is member of a project that has attached this location
    attachments = supabase.table("backlot_project_locations").select("project_id").eq("location_id", location_id).execute()
    if attachments.data:
        for att in attachments.data:
            member = supabase.table("backlot_project_members").select("role").eq("project_id", att["project_id"]).eq("user_id", user_id).execute()
            if member.data:
                return True

    # Check if user is admin/superadmin
    user_data = supabase.table("users").select("is_admin, is_superadmin").eq("id", user_id).execute()
    if user_data.data:
        if user_data.data[0].get("is_admin") or user_data.data[0].get("is_superadmin"):
            return True

    return False


@router.get("/locations/{location_id}/scout-photos")
async def get_location_scout_photos(
    location_id: str,
    vantage_type: Optional[str] = None,
    time_of_day: Optional[str] = None,
    interior_exterior: Optional[str] = None,
    authorization: str = Header(None)
):
    """
    Get all scout photos for a location with optional filters.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify user can view this location
    if not await can_user_view_location(supabase, user_id, location_id):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        query = supabase.table("backlot_location_scout_photos").select("*").eq("location_id", location_id)

        if vantage_type:
            query = query.eq("vantage_type", vantage_type)
        if time_of_day:
            query = query.eq("time_of_day", time_of_day)
        if interior_exterior:
            query = query.eq("interior_exterior", interior_exterior)

        query = query.order("is_primary", desc=True).order("created_at", desc=True)
        result = query.execute()

        return {
            "success": True,
            "photos": result.data or [],
            "count": len(result.data) if result.data else 0
        }

    except Exception as e:
        print(f"Error fetching scout photos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/locations/{location_id}/scout-photos")
async def create_scout_photo(
    location_id: str,
    photo: ScoutPhotoInput,
    authorization: str = Header(None)
):
    """
    Create a new scout photo for a location.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify user can edit this location
    if not await can_user_edit_location(supabase, user_id, location_id):
        raise HTTPException(status_code=403, detail="Access denied - cannot edit this location")

    try:
        # If this is set as primary, unset any existing primary photos
        if photo.is_primary:
            supabase.table("backlot_location_scout_photos").update({"is_primary": False}).eq("location_id", location_id).eq("is_primary", True).execute()

        insert_data = {
            "location_id": location_id,
            "image_url": photo.image_url,
            "thumbnail_url": photo.thumbnail_url,
            "original_filename": photo.original_filename,
            "angle_label": photo.angle_label,
            "vantage_type": photo.vantage_type,
            "camera_facing": photo.camera_facing,
            "time_of_day": photo.time_of_day,
            "shoot_date": photo.shoot_date,
            "weather": photo.weather,
            "light_notes": photo.light_notes,
            "sound_notes": photo.sound_notes,
            "access_notes": photo.access_notes,
            "power_notes": photo.power_notes,
            "parking_notes": photo.parking_notes,
            "restrictions_notes": photo.restrictions_notes,
            "general_notes": photo.general_notes,
            "is_primary": photo.is_primary or False,
            "interior_exterior": photo.interior_exterior,
            "uploaded_by_user_id": user_id,
        }

        result = supabase.table("backlot_location_scout_photos").insert(insert_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create scout photo")

        return {
            "success": True,
            "photo": result.data[0]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating scout photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/location-scout-photos/{photo_id}")
async def get_scout_photo(
    photo_id: str,
    authorization: str = Header(None)
):
    """
    Get a single scout photo by ID.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_location_scout_photos").select("*").eq("id", photo_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Scout photo not found")

        photo = result.data[0]

        # Verify user can view the location
        if not await can_user_view_location(supabase, user_id, photo["location_id"]):
            raise HTTPException(status_code=403, detail="Access denied")

        return {
            "success": True,
            "photo": photo
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching scout photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/location-scout-photos/{photo_id}")
async def update_scout_photo(
    photo_id: str,
    photo: ScoutPhotoUpdateInput,
    authorization: str = Header(None)
):
    """
    Update a scout photo.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get existing photo
        existing = supabase.table("backlot_location_scout_photos").select("*").eq("id", photo_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Scout photo not found")

        existing_photo = existing.data[0]

        # Check if user is uploader or can edit location
        is_uploader = existing_photo.get("uploaded_by_user_id") == user_id
        can_edit = await can_user_edit_location(supabase, user_id, existing_photo["location_id"])

        if not is_uploader and not can_edit:
            raise HTTPException(status_code=403, detail="Access denied - cannot edit this photo")

        # If setting as primary, unset others first
        if photo.is_primary:
            supabase.table("backlot_location_scout_photos").update({"is_primary": False}).eq("location_id", existing_photo["location_id"]).eq("is_primary", True).neq("id", photo_id).execute()

        # Build update data (only include non-None fields)
        update_data = {}
        for field, value in photo.model_dump().items():
            if value is not None:
                update_data[field] = value

        if update_data:
            result = supabase.table("backlot_location_scout_photos").update(update_data).eq("id", photo_id).execute()
            return {
                "success": True,
                "photo": result.data[0] if result.data else None
            }

        return {"success": True, "message": "No changes made"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating scout photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/location-scout-photos/{photo_id}")
async def delete_scout_photo(
    photo_id: str,
    authorization: str = Header(None)
):
    """
    Delete a scout photo.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get existing photo
        existing = supabase.table("backlot_location_scout_photos").select("*").eq("id", photo_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Scout photo not found")

        existing_photo = existing.data[0]

        # Check if user is uploader or can edit location
        is_uploader = existing_photo.get("uploaded_by_user_id") == user_id
        can_edit = await can_user_edit_location(supabase, user_id, existing_photo["location_id"])

        if not is_uploader and not can_edit:
            raise HTTPException(status_code=403, detail="Access denied - cannot delete this photo")

        supabase.table("backlot_location_scout_photos").delete().eq("id", photo_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting scout photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/locations/{location_id}/scout-summary")
async def get_location_scout_summary(
    location_id: str,
    authorization: str = Header(None)
):
    """
    Get a summary of scout photo info for a location (for call sheet previews).
    Returns primary photo, key practical notes, and smart tags.
    """
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify user can view this location
    if not await can_user_view_location(supabase, user_id, location_id):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Get all scout photos for this location
        photos = supabase.table("backlot_location_scout_photos").select("*").eq("location_id", location_id).order("is_primary", desc=True).order("created_at", desc=True).execute()

        if not photos.data:
            return {
                "success": True,
                "has_scout_photos": False,
                "primary_photo": None,
                "photo_count": 0,
                "practical_summary": None,
                "tags": []
            }

        # Get primary photo (first one after sorting)
        primary = photos.data[0]

        # Aggregate practical notes from all photos
        practical_summary = {
            "access": None,
            "parking": None,
            "power": None,
            "sound": None,
            "light": None,
            "restrictions": None
        }

        tags = set()

        for photo in photos.data:
            # Aggregate notes (take first non-null for each category)
            if not practical_summary["access"] and photo.get("access_notes"):
                practical_summary["access"] = photo["access_notes"]
            if not practical_summary["parking"] and photo.get("parking_notes"):
                practical_summary["parking"] = photo["parking_notes"]
            if not practical_summary["power"] and photo.get("power_notes"):
                practical_summary["power"] = photo["power_notes"]
            if not practical_summary["sound"] and photo.get("sound_notes"):
                practical_summary["sound"] = photo["sound_notes"]
            if not practical_summary["light"] and photo.get("light_notes"):
                practical_summary["light"] = photo["light_notes"]
            if not practical_summary["restrictions"] and photo.get("restrictions_notes"):
                practical_summary["restrictions"] = photo["restrictions_notes"]

            # Derive tags from notes
            sound = (photo.get("sound_notes") or "").lower()
            light = (photo.get("light_notes") or "").lower()
            power = (photo.get("power_notes") or "").lower()
            parking = (photo.get("parking_notes") or "").lower()
            access = (photo.get("access_notes") or "").lower()

            # Sound tags
            if "quiet" in sound or "silent" in sound:
                tags.add("Quiet")
            if "road" in sound or "traffic" in sound or "freeway" in sound:
                tags.add("Road Noise")
            if "plane" in sound or "airplane" in sound or "airport" in sound:
                tags.add("Airport Noise")

            # Light tags
            if "natural" in light or "window" in light:
                tags.add("Natural Light")
            if "north" in light and "facing" in light:
                tags.add("North-Facing")

            # Power tags
            if "100a" in power or "200a" in power or "tie-in" in power:
                tags.add("Full Power")
            if "house power" in power or "limited" in power:
                tags.add("Limited Power")

            # Parking tags
            if "lot" in parking or "ample" in parking or "plenty" in parking:
                tags.add("Good Parking")
            if "limited" in parking or "no parking" in parking:
                tags.add("Limited Parking")

            # Access tags
            if "truck" in access or "loading" in access:
                tags.add("Truck Access")
            if "elevator" in access and "no elevator" not in access:
                tags.add("Elevator")
            if "stairs only" in access:
                tags.add("Stairs Only")

        return {
            "success": True,
            "has_scout_photos": True,
            "primary_photo": {
                "id": primary["id"],
                "image_url": primary["image_url"],
                "thumbnail_url": primary.get("thumbnail_url") or primary["image_url"],
                "angle_label": primary.get("angle_label"),
                "vantage_type": primary.get("vantage_type"),
                "time_of_day": primary.get("time_of_day")
            },
            "photo_count": len(photos.data),
            "practical_summary": practical_summary,
            "tags": list(tags)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching scout summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SCRIPT BREAKDOWN ENDPOINTS
# =====================================================

# Pydantic models for script breakdown
class ScriptInput(BaseModel):
    title: str
    file_url: Optional[str] = None
    format: Optional[str] = None  # pdf, fdx, fountain, manual
    version: Optional[str] = None

class SceneInput(BaseModel):
    scene_number: str
    slugline: Optional[str] = None
    description: Optional[str] = None
    page_length: Optional[float] = 0
    page_start: Optional[float] = None
    page_end: Optional[float] = None
    location_hint: Optional[str] = None
    int_ext: Optional[str] = None
    day_night: Optional[str] = None
    location_id: Optional[str] = None
    director_notes: Optional[str] = None
    ad_notes: Optional[str] = None

class SceneCoverageUpdate(BaseModel):
    is_scheduled: Optional[bool] = None
    is_shot: Optional[bool] = None
    needs_pickup: Optional[bool] = None
    pickup_notes: Optional[str] = None
    scheduled_day_id: Optional[str] = None
    shot_day_id: Optional[str] = None

class BreakdownItemInput(BaseModel):
    type: str  # cast, background, prop, vehicle, sfx, vfx, wardrobe, makeup, location, other
    label: str
    quantity: Optional[int] = 1
    notes: Optional[str] = None
    linked_entity_id: Optional[str] = None
    linked_entity_type: Optional[str] = None

class CallSheetSceneLinkInput(BaseModel):
    scene_id: str
    sequence: Optional[int] = 0
    estimated_time_minutes: Optional[int] = None
    notes: Optional[str] = None


# =====================================================
# SCRIPTS CRUD
# =====================================================

@router.get("/projects/{project_id}/scripts")
async def get_project_scripts(
    project_id: str,
    authorization: str = Header(None)
):
    """Get all scripts for a project"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        result = supabase.table("backlot_scripts").select("*").eq("project_id", project_id).order("created_at", desc=True).execute()
        return {"scripts": result.data or []}
    except Exception as e:
        print(f"Error fetching scripts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/scripts")
async def create_script(
    project_id: str,
    script: ScriptInput,
    authorization: str = Header(None)
):
    """Create a new script for a project"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")
        if member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to manage scripts")

    try:
        script_data = {
            "project_id": project_id,
            "title": script.title,
            "file_url": script.file_url,
            "format": script.format or "manual",
            "version": script.version,
            "parse_status": "manual" if not script.file_url else "pending",
            "created_by_user_id": user_id
        }

        result = supabase.table("backlot_scripts").insert(script_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create script")

        return {"success": True, "script": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/scripts/import")
async def import_script(
    project_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    version: str = Form(None),
    authorization: str = Header(None)
):
    """Import a script file (PDF or FDX) and parse scenes"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")
        if member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to import scripts")

    try:
        # Determine format from file extension
        filename = file.filename or "script"
        ext = filename.split(".")[-1].lower() if "." in filename else ""

        if ext not in ["pdf", "fdx", "txt", "fountain"]:
            raise HTTPException(status_code=400, detail="Only PDF, FDX, TXT, and Fountain files are supported")

        # Read file content
        content = await file.read()

        # Initialize variables for extraction
        page_count = None
        text_content = None  # For the script editor
        parsed_scenes = []

        # Extract text and page count from PDF
        if ext == "pdf":
            try:
                from pypdf import PdfReader
                import io
                pdf_reader = PdfReader(io.BytesIO(content))
                page_count = len(pdf_reader.pages)

                # Extract text from all pages for the editor
                extracted_pages = []
                for i, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        extracted_pages.append(f"=== PAGE {i + 1} ===\n\n{page_text}")

                if extracted_pages:
                    text_content = "\n\n".join(extracted_pages)

                    # Try to detect and parse scenes from extracted text
                    scene_count = 0
                    for line in text_content.split("\n"):
                        line = line.strip()
                        line_upper = line.upper()

                        # Detect scene headings
                        if any(line_upper.startswith(prefix) for prefix in ["INT.", "INT ", "EXT.", "EXT ", "INT/EXT", "INT./EXT.", "I/E "]):
                            scene_count += 1
                            slugline = line

                            # Parse slugline
                            int_ext = None
                            day_night = None
                            location_hint = slugline

                            if line_upper.startswith("INT.") or line_upper.startswith("INT "):
                                int_ext = "INT"
                                location_hint = line[4:].strip()
                            elif line_upper.startswith("EXT.") or line_upper.startswith("EXT "):
                                int_ext = "EXT"
                                location_hint = line[4:].strip()
                            elif line_upper.startswith("INT/EXT") or line_upper.startswith("INT./EXT."):
                                int_ext = "INT/EXT"
                                location_hint = line[7:].strip() if "/" in line[:10] else line[8:].strip()
                            elif line_upper.startswith("I/E "):
                                int_ext = "INT/EXT"
                                location_hint = line[4:].strip()

                            # Extract day/night
                            for dn in ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "EVENING", "CONTINUOUS", "LATER"]:
                                if f" - {dn}" in line_upper or f"- {dn}" in line_upper:
                                    day_night = dn
                                    location_hint = location_hint.replace(f" - {dn}", "").replace(f"- {dn}", "").strip()
                                    break

                            parsed_scenes.append({
                                "scene_number": str(scene_count),
                                "slugline": slugline,
                                "int_ext": int_ext,
                                "day_night": day_night,
                                "location_hint": location_hint,
                                "page_length": 1.0,
                                "sequence": scene_count
                            })

            except Exception as pdf_err:
                print(f"Could not extract from PDF: {pdf_err}")

        # Parse FDX (Final Draft) files
        elif ext == "fdx":
            try:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(content.decode('utf-8'))

                # Build text content from FDX for the editor
                text_lines = []
                scene_count = 0

                for para in root.iter():
                    if para.tag == "Paragraph":
                        para_type = para.get("Type", "")

                        # Extract text from all Text elements
                        para_text_parts = []
                        for text_elem in para.findall(".//Text"):
                            if text_elem.text:
                                para_text_parts.append(text_elem.text)
                        para_text = "".join(para_text_parts).strip()

                        if not para_text:
                            continue

                        # Format based on paragraph type (Celtx-style)
                        if para_type == "Scene Heading":
                            scene_count += 1
                            text_lines.append(f"\n{para_text.upper()}\n")

                            # Parse scene for breakdown
                            slugline = para_text
                            int_ext = None
                            day_night = None
                            location_hint = slugline
                            slugline_upper = slugline.upper()

                            if slugline_upper.startswith("INT.") or slugline_upper.startswith("INT "):
                                int_ext = "INT"
                                location_hint = slugline[4:].strip()
                            elif slugline_upper.startswith("EXT.") or slugline_upper.startswith("EXT "):
                                int_ext = "EXT"
                                location_hint = slugline[4:].strip()
                            elif slugline_upper.startswith("INT/EXT") or slugline_upper.startswith("INT./EXT."):
                                int_ext = "INT/EXT"
                                location_hint = slugline[7:].strip() if "/" in slugline[:10] else slugline[8:].strip()

                            for dn in ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "EVENING", "CONTINUOUS", "LATER"]:
                                if f" - {dn}" in slugline_upper or f"- {dn}" in slugline_upper:
                                    day_night = dn
                                    location_hint = location_hint.replace(f" - {dn}", "").replace(f"- {dn}", "").strip()
                                    break

                            parsed_scenes.append({
                                "scene_number": str(scene_count),
                                "slugline": slugline,
                                "int_ext": int_ext,
                                "day_night": day_night,
                                "location_hint": location_hint,
                                "page_length": 1.0,
                                "sequence": scene_count
                            })

                        elif para_type == "Character":
                            text_lines.append(f"\n                    {para_text.upper()}")
                        elif para_type == "Dialogue":
                            text_lines.append(f"          {para_text}")
                        elif para_type == "Parenthetical":
                            text_lines.append(f"               ({para_text})")
                        elif para_type == "Action":
                            text_lines.append(f"\n{para_text}")
                        elif para_type == "Transition":
                            text_lines.append(f"\n                                        {para_text.upper()}\n")
                        else:
                            text_lines.append(para_text)

                text_content = "\n".join(text_lines).strip()
                page_count = max(1, len(text_content) // 3000)  # Rough estimate: ~3000 chars per page

            except Exception as parse_err:
                print(f"FDX parsing error: {parse_err}")

        # Handle plain text and Fountain files
        elif ext in ["txt", "fountain"]:
            try:
                text_content = content.decode('utf-8')
                page_count = max(1, len(text_content) // 3000)

                # Parse scenes from text
                scene_count = 0
                for line in text_content.split("\n"):
                    line = line.strip()
                    line_upper = line.upper()

                    if any(line_upper.startswith(prefix) for prefix in ["INT.", "INT ", "EXT.", "EXT ", "INT/EXT", "INT./EXT.", "I/E "]):
                        scene_count += 1
                        slugline = line

                        int_ext = None
                        day_night = None
                        location_hint = slugline

                        if line_upper.startswith("INT.") or line_upper.startswith("INT "):
                            int_ext = "INT"
                            location_hint = line[4:].strip()
                        elif line_upper.startswith("EXT.") or line_upper.startswith("EXT "):
                            int_ext = "EXT"
                            location_hint = line[4:].strip()
                        elif line_upper.startswith("INT/EXT") or line_upper.startswith("INT./EXT."):
                            int_ext = "INT/EXT"
                            location_hint = line[7:].strip() if "/" in line[:10] else line[8:].strip()

                        for dn in ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "EVENING", "CONTINUOUS", "LATER"]:
                            if f" - {dn}" in line_upper or f"- {dn}" in line_upper:
                                day_night = dn
                                location_hint = location_hint.replace(f" - {dn}", "").replace(f"- {dn}", "").strip()
                                break

                        parsed_scenes.append({
                            "scene_number": str(scene_count),
                            "slugline": slugline,
                            "int_ext": int_ext,
                            "day_night": day_night,
                            "location_hint": location_hint,
                            "page_length": 1.0,
                            "sequence": scene_count
                        })

            except Exception as txt_err:
                print(f"Text parsing error: {txt_err}")

        # Upload to storage
        storage_path = f"scripts/{project_id}/{uuid.uuid4()}.{ext}"
        upload_result = supabase.storage.from_("backlot").upload(storage_path, content, {"content-type": file.content_type or "application/octet-stream"})

        # Get public URL
        file_url = supabase.storage.from_("backlot").get_public_url(storage_path)

        # Create script record with text_content for the editor
        script_data = {
            "project_id": project_id,
            "title": title,
            "file_url": file_url,
            "format": ext,
            "version": version or "v1",
            "version_number": 1,
            "color_code": "white",
            "is_current": True,
            "is_locked": False,
            "parse_status": "completed" if text_content else "pending",
            "created_by_user_id": user_id,
            "total_pages": page_count,
            "total_scenes": len(parsed_scenes),
            "text_content": text_content  # For the script editor
        }

        script_result = supabase.table("backlot_scripts").insert(script_data).execute()

        if not script_result.data:
            raise HTTPException(status_code=500, detail="Failed to create script record")

        script = script_result.data[0]

        # Create scene records if any were parsed
        if parsed_scenes:
            for scene_data in parsed_scenes:
                scene_data["project_id"] = project_id
                scene_data["script_id"] = script["id"]

            supabase.table("backlot_scenes").insert(parsed_scenes).execute()

        # Build response message
        text_extracted = bool(text_content)
        scenes_found = len(parsed_scenes)

        if text_extracted and scenes_found:
            message = f"Script imported ({page_count or 'unknown'} pages, {scenes_found} scenes detected). Text extracted for editor."
        elif text_extracted:
            message = f"Script imported ({page_count or 'unknown'} pages). Text extracted for editor, no scenes auto-detected."
        elif scenes_found:
            message = f"Script imported ({page_count or 'unknown'} pages, {scenes_found} scenes detected). Text extraction limited."
        else:
            message = f"Script imported ({page_count or 'unknown'} pages). Manual scene entry may be needed."

        return {
            "success": True,
            "script": script,
            "scenes_created": len(parsed_scenes),
            "scenes_parsed": len(parsed_scenes),
            "page_count": page_count,
            "text_extracted": text_extracted,
            "message": message
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error importing script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scripts/{script_id}")
async def get_script(
    script_id: str,
    authorization: str = Header(None)
):
    """Get a single script with scene count"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_scripts").select("*").eq("id", script_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        script = result.data

        # Verify access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", script["project_id"]).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", script["project_id"]).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Get scene count
        scene_result = supabase.table("backlot_scenes").select("id", count="exact").eq("script_id", script_id).execute()
        script["scene_count"] = scene_result.count or 0

        return {"script": script}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/scripts/{script_id}")
async def update_script(
    script_id: str,
    script: ScriptInput,
    authorization: str = Header(None)
):
    """Update a script"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        existing = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = existing.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to edit scripts")

        update_data = {
            "title": script.title,
            "version": script.version
        }
        if script.file_url:
            update_data["file_url"] = script.file_url
        if script.format:
            update_data["format"] = script.format

        result = supabase.table("backlot_scripts").update(update_data).eq("id", script_id).execute()
        return {"success": True, "script": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scripts/{script_id}")
async def delete_script(
    script_id: str,
    authorization: str = Header(None)
):
    """Delete a script and all its scenes"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        existing = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = existing.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin"]:
                raise HTTPException(status_code=403, detail="Only admins can delete scripts")

        # Delete script (cascades to scenes and breakdown items)
        supabase.table("backlot_scripts").delete().eq("id", script_id).execute()
        return {"success": True, "message": "Script deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SCRIPT VERSIONING
# =====================================================

class CreateScriptVersionInput(BaseModel):
    """Input for creating a new script version"""
    version_label: Optional[str] = None
    color_code: Optional[str] = "blue"
    revision_notes: Optional[str] = None
    carry_over_text: bool = True
    carry_over_scenes: bool = True

class UpdateScriptTextInput(BaseModel):
    """Input for updating script text content"""
    text_content: str
    create_new_version: bool = False
    version_label: Optional[str] = None
    color_code: Optional[str] = None
    revision_notes: Optional[str] = None


@router.get("/scripts/{script_id}/versions")
async def get_script_version_history(
    script_id: str,
    authorization: str = Header(None)
):
    """Get the version history for a script"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        script = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script.data["project_id"]

        # Verify project access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Use database function to get version history
        try:
            result = supabase.rpc("get_script_version_history", {"p_script_id": script_id}).execute()
            versions = result.data or []
        except Exception as rpc_err:
            # Fallback: find root and traverse manually
            print(f"RPC failed, using fallback: {rpc_err}")

            # Find the root script (no parent) in the chain
            current_id = script_id
            visited = set()
            while True:
                if current_id in visited:
                    break
                visited.add(current_id)
                current_script = supabase.table("backlot_scripts").select("id, parent_version_id").eq("id", current_id).single().execute()
                if not current_script.data or not current_script.data.get("parent_version_id"):
                    break
                current_id = current_script.data["parent_version_id"]

            root_id = current_id

            # Get all versions descending from root
            versions_result = supabase.table("backlot_scripts").select(
                "id, version, version_number, color_code, is_current, is_locked, revision_notes, created_at, created_by_user_id, parent_version_id"
            ).eq("project_id", project_id).order("version_number").execute()

            # Filter to only scripts in this version chain
            all_versions = versions_result.data or []
            chain_ids = {root_id}

            # Build the chain by iterating
            changed = True
            while changed:
                changed = False
                for v in all_versions:
                    if v.get("parent_version_id") in chain_ids and v["id"] not in chain_ids:
                        chain_ids.add(v["id"])
                        changed = True

            versions = [v for v in all_versions if v["id"] in chain_ids]

        return {"versions": versions}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching version history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/versions")
async def create_script_version(
    script_id: str,
    input_data: CreateScriptVersionInput,
    authorization: str = Header(None)
):
    """Create a new version from an existing script"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get the source script
        source_script = supabase.table("backlot_scripts").select("*").eq("id", script_id).single().execute()
        if not source_script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        source = source_script.data
        project_id = source["project_id"]

        # Verify edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to create script versions")

        # Calculate next version number
        current_version = source.get("version_number") or 1
        next_version = current_version + 1

        # Industry standard color code sequence
        color_sequence = ["white", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray", "ivory"]
        default_color = color_sequence[min(next_version - 1, len(color_sequence) - 1)]

        # Create new version
        new_script_data = {
            "project_id": project_id,
            "title": source["title"],
            "file_url": source.get("file_url"),
            "format": source.get("format"),
            "version": input_data.version_label or f"v{next_version}",
            "version_number": next_version,
            "parent_version_id": script_id,
            "color_code": input_data.color_code or default_color,
            "revision_notes": input_data.revision_notes,
            "is_current": True,
            "is_locked": False,
            "text_content": source.get("text_content") if input_data.carry_over_text else None,
            "page_count": source.get("page_count"),
            "total_scenes": source.get("total_scenes"),
            "total_pages": source.get("total_pages"),
            "parse_status": source.get("parse_status"),
            "created_by_user_id": user_id
        }

        # Mark old versions as not current
        supabase.table("backlot_scripts").update({"is_current": False}).eq("project_id", project_id).execute()

        # Create new version
        new_script_result = supabase.table("backlot_scripts").insert(new_script_data).execute()
        if not new_script_result.data:
            raise HTTPException(status_code=500, detail="Failed to create new version")

        new_script = new_script_result.data[0]

        # Optionally copy scenes to new version
        scenes_copied = 0
        if input_data.carry_over_scenes:
            source_scenes = supabase.table("backlot_scenes").select("*").eq("script_id", script_id).execute()
            if source_scenes.data:
                for scene in source_scenes.data:
                    new_scene_data = {
                        "project_id": project_id,
                        "script_id": new_script["id"],
                        "scene_number": scene.get("scene_number"),
                        "slugline": scene.get("slugline"),
                        "description": scene.get("description"),
                        "synopsis": scene.get("synopsis"),
                        "page_length": scene.get("page_length"),
                        "int_ext": scene.get("int_ext"),
                        "time_of_day": scene.get("time_of_day"),
                        "location_hint": scene.get("location_hint"),
                        "location_id": scene.get("location_id"),
                        "sequence": scene.get("sequence"),
                        "coverage_status": scene.get("coverage_status", "not_scheduled"),
                        "is_omitted": scene.get("is_omitted", False)
                    }
                    supabase.table("backlot_scenes").insert(new_scene_data).execute()
                    scenes_copied += 1

        return {
            "success": True,
            "script": new_script,
            "scenes_copied": scenes_copied,
            "message": f"Created version {new_script['version']} ({new_script['color_code']})"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating script version: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/set-current")
async def set_current_script_version(
    script_id: str,
    authorization: str = Header(None)
):
    """Set a script version as the current active version"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        script = supabase.table("backlot_scripts").select("project_id, is_locked").eq("id", script_id).single().execute()
        if not script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script.data["project_id"]

        # Verify edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to change script versions")

        # Mark all versions in this project as not current
        supabase.table("backlot_scripts").update({"is_current": False}).eq("project_id", project_id).execute()

        # Set this version as current
        result = supabase.table("backlot_scripts").update({"is_current": True}).eq("id", script_id).execute()

        return {"success": True, "script": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error setting current version: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/lock")
async def lock_script_version(
    script_id: str,
    authorization: str = Header(None)
):
    """Lock a script version to prevent editing"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        script = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script.data["project_id"]

        # Verify edit access (only owners/admins can lock)
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin"]:
                raise HTTPException(status_code=403, detail="Only admins can lock script versions")

        # Lock the version
        result = supabase.table("backlot_scripts").update({
            "is_locked": True,
            "locked_by_user_id": user_id,
            "locked_at": "now()"
        }).eq("id", script_id).execute()

        return {"success": True, "script": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error locking script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/unlock")
async def unlock_script_version(
    script_id: str,
    authorization: str = Header(None)
):
    """Unlock a script version to allow editing"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        script = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script.data["project_id"]

        # Verify edit access (only owners/admins can unlock)
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin"]:
                raise HTTPException(status_code=403, detail="Only admins can unlock script versions")

        # Unlock the version
        result = supabase.table("backlot_scripts").update({
            "is_locked": False,
            "locked_by_user_id": None,
            "locked_at": None
        }).eq("id", script_id).execute()

        return {"success": True, "script": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error unlocking script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/scripts/{script_id}/text")
async def update_script_text(
    script_id: str,
    input_data: UpdateScriptTextInput,
    authorization: str = Header(None)
):
    """Update the text content of a script (for the editor)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        script = supabase.table("backlot_scripts").select("*").eq("id", script_id).single().execute()
        if not script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        script_data = script.data
        project_id = script_data["project_id"]

        # Check if locked
        if script_data.get("is_locked"):
            raise HTTPException(status_code=403, detail="This script version is locked and cannot be edited")

        # Verify edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to edit scripts")

        if input_data.create_new_version:
            # Create a new version with the updated text
            current_version = script_data.get("version_number") or 1
            next_version = current_version + 1

            color_sequence = ["white", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray", "ivory"]
            default_color = color_sequence[min(next_version - 1, len(color_sequence) - 1)]

            new_script_data = {
                "project_id": project_id,
                "title": script_data["title"],
                "file_url": script_data.get("file_url"),
                "format": script_data.get("format"),
                "version": input_data.version_label or f"v{next_version}",
                "version_number": next_version,
                "parent_version_id": script_id,
                "color_code": input_data.color_code or default_color,
                "revision_notes": input_data.revision_notes,
                "is_current": True,
                "is_locked": False,
                "text_content": input_data.text_content,
                "page_count": script_data.get("page_count"),
                "total_scenes": script_data.get("total_scenes"),
                "total_pages": script_data.get("total_pages"),
                "parse_status": "manual",
                "created_by_user_id": user_id
            }

            # Mark old versions as not current
            supabase.table("backlot_scripts").update({"is_current": False}).eq("project_id", project_id).execute()

            # Create new version
            result = supabase.table("backlot_scripts").insert(new_script_data).execute()

            return {
                "success": True,
                "script": result.data[0] if result.data else None,
                "new_version_created": True,
                "message": f"Created new version {new_script_data['version']}"
            }
        else:
            # Update text in place
            result = supabase.table("backlot_scripts").update({
                "text_content": input_data.text_content
            }).eq("id", script_id).execute()

            return {
                "success": True,
                "script": result.data[0] if result.data else None,
                "new_version_created": False,
                "message": "Script text updated"
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating script text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/extract-text")
async def extract_text_from_script_pdf(
    script_id: str,
    authorization: str = Header(None)
):
    """Extract text content from a script's PDF file for editing"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get script and verify access
        script = supabase.table("backlot_scripts").select("*").eq("id", script_id).single().execute()
        if not script.data:
            raise HTTPException(status_code=404, detail="Script not found")

        script_data = script.data
        project_id = script_data["project_id"]

        # Verify project edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["admin", "editor"]:
                raise HTTPException(status_code=403, detail="Edit access required")

        # Check if script has a file URL
        file_url = script_data.get("file_url")
        if not file_url:
            raise HTTPException(status_code=400, detail="Script has no PDF file to extract from")

        # Check if already has text content
        if script_data.get("text_content"):
            return {
                "success": True,
                "text_content": script_data["text_content"],
                "already_extracted": True,
                "message": "Script already has text content"
            }

        # Download the PDF from storage
        import httpx
        from pypdf import PdfReader
        import io

        async with httpx.AsyncClient() as client:
            response = await client.get(file_url)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to download script PDF")
            content = response.content

        # Extract text from PDF
        try:
            pdf_reader = PdfReader(io.BytesIO(content))
            page_count = len(pdf_reader.pages)
            extracted_pages = []

            for i, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    extracted_pages.append(f"=== PAGE {i + 1} ===\n\n{page_text}")

            text_content = "\n\n".join(extracted_pages)

            if not text_content.strip():
                raise HTTPException(status_code=400, detail="Could not extract text from PDF. The PDF may be image-based.")

        except Exception as pdf_err:
            print(f"PDF extraction error: {pdf_err}")
            raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {str(pdf_err)}")

        # Update the script with extracted text
        result = supabase.table("backlot_scripts").update({
            "text_content": text_content,
            "total_pages": page_count
        }).eq("id", script_id).execute()

        return {
            "success": True,
            "text_content": text_content,
            "page_count": page_count,
            "already_extracted": False,
            "message": f"Successfully extracted text from {page_count} pages"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting text from script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SCENES CRUD
# =====================================================

@router.get("/projects/{project_id}/scenes")
async def get_project_scenes(
    project_id: str,
    script_id: str = None,
    include_breakdown: bool = False,
    authorization: str = Header(None)
):
    """Get all scenes for a project, optionally filtered by script"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        query = supabase.table("backlot_scenes").select("*").eq("project_id", project_id).order("sequence")

        if script_id:
            query = query.eq("script_id", script_id)

        result = query.execute()
        scenes = result.data or []

        # Optionally include breakdown summary for each scene
        if include_breakdown and scenes:
            for scene in scenes:
                breakdown_result = supabase.table("backlot_scene_breakdown_items").select("type, label").eq("scene_id", scene["id"]).execute()

                # Group by type
                breakdown_summary = {}
                for item in breakdown_result.data or []:
                    item_type = item["type"]
                    if item_type not in breakdown_summary:
                        breakdown_summary[item_type] = []
                    breakdown_summary[item_type].append(item["label"])

                scene["breakdown_summary"] = breakdown_summary

        return {"scenes": scenes}

    except Exception as e:
        print(f"Error fetching scenes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/scenes")
async def create_scene(
    project_id: str,
    scene: SceneInput,
    authorization: str = Header(None)
):
    """Create a new scene"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to create scenes")

    try:
        # Get next sequence number
        seq_result = supabase.table("backlot_scenes").select("sequence").eq("project_id", project_id).order("sequence", desc=True).limit(1).execute()
        next_sequence = (seq_result.data[0]["sequence"] + 1) if seq_result.data else 1

        scene_data = {
            "project_id": project_id,
            "scene_number": scene.scene_number,
            "slugline": scene.slugline,
            "description": scene.description,
            "page_length": scene.page_length or 0,
            "page_start": scene.page_start,
            "page_end": scene.page_end,
            "location_hint": scene.location_hint,
            "int_ext": scene.int_ext,
            "day_night": scene.day_night,
            "location_id": scene.location_id,
            "director_notes": scene.director_notes,
            "ad_notes": scene.ad_notes,
            "sequence": next_sequence
        }

        result = supabase.table("backlot_scenes").insert(scene_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create scene")

        return {"success": True, "scene": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scenes/{scene_id}")
async def get_scene(
    scene_id: str,
    include_breakdown: bool = True,
    authorization: str = Header(None)
):
    """Get a single scene with optional breakdown items"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_scenes").select("*").eq("id", scene_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Scene not found")

        scene = result.data

        # Verify access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", scene["project_id"]).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", scene["project_id"]).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Get breakdown items
        if include_breakdown:
            breakdown_result = supabase.table("backlot_scene_breakdown_items").select("*").eq("scene_id", scene_id).order("type").execute()
            scene["breakdown_items"] = breakdown_result.data or []

        # Get linked location if any
        if scene.get("location_id"):
            loc_result = supabase.table("backlot_locations").select("id, name, address, city, state").eq("id", scene["location_id"]).execute()
            scene["location"] = loc_result.data[0] if loc_result.data else None

        return {"scene": scene}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/scenes/{scene_id}")
async def update_scene(
    scene_id: str,
    scene: SceneInput,
    authorization: str = Header(None)
):
    """Update a scene"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get scene and verify access
        existing = supabase.table("backlot_scenes").select("project_id").eq("id", scene_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Scene not found")

        project_id = existing.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to edit scenes")

        update_data = {
            "scene_number": scene.scene_number,
            "slugline": scene.slugline,
            "description": scene.description,
            "page_length": scene.page_length,
            "page_start": scene.page_start,
            "page_end": scene.page_end,
            "location_hint": scene.location_hint,
            "int_ext": scene.int_ext,
            "day_night": scene.day_night,
            "location_id": scene.location_id,
            "director_notes": scene.director_notes,
            "ad_notes": scene.ad_notes
        }

        result = supabase.table("backlot_scenes").update(update_data).eq("id", scene_id).execute()
        return {"success": True, "scene": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/scenes/{scene_id}/coverage")
async def update_scene_coverage(
    scene_id: str,
    coverage: SceneCoverageUpdate,
    authorization: str = Header(None)
):
    """Update scene coverage status (scheduled, shot, pickup needed)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get scene and verify access
        existing = supabase.table("backlot_scenes").select("project_id").eq("id", scene_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Scene not found")

        project_id = existing.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to update coverage")

        update_data = {}
        if coverage.is_scheduled is not None:
            update_data["is_scheduled"] = coverage.is_scheduled
        if coverage.is_shot is not None:
            update_data["is_shot"] = coverage.is_shot
        if coverage.needs_pickup is not None:
            update_data["needs_pickup"] = coverage.needs_pickup
        if coverage.pickup_notes is not None:
            update_data["pickup_notes"] = coverage.pickup_notes
        if coverage.scheduled_day_id is not None:
            update_data["scheduled_day_id"] = coverage.scheduled_day_id
        if coverage.shot_day_id is not None:
            update_data["shot_day_id"] = coverage.shot_day_id

        if update_data:
            result = supabase.table("backlot_scenes").update(update_data).eq("id", scene_id).execute()
            return {"success": True, "scene": result.data[0] if result.data else None}

        return {"success": True, "message": "No changes made"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating scene coverage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/scenes/reorder")
async def reorder_scenes(
    project_id: str,
    scene_ids: List[str] = Body(...),
    authorization: str = Header(None)
):
    """Reorder scenes by providing new sequence"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to reorder scenes")

    try:
        for idx, scene_id in enumerate(scene_ids):
            supabase.table("backlot_scenes").update({"sequence": idx + 1}).eq("id", scene_id).eq("project_id", project_id).execute()

        return {"success": True, "message": f"Reordered {len(scene_ids)} scenes"}

    except Exception as e:
        print(f"Error reordering scenes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scenes/{scene_id}")
async def delete_scene(
    scene_id: str,
    authorization: str = Header(None)
):
    """Delete a scene and its breakdown items"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get scene and verify access
        existing = supabase.table("backlot_scenes").select("project_id").eq("id", scene_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Scene not found")

        project_id = existing.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to delete scenes")

        # Delete scene (cascades to breakdown items)
        supabase.table("backlot_scenes").delete().eq("id", scene_id).execute()
        return {"success": True, "message": "Scene deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# BREAKDOWN ITEMS CRUD
# =====================================================

@router.get("/scenes/{scene_id}/breakdown")
async def get_scene_breakdown(
    scene_id: str,
    authorization: str = Header(None)
):
    """Get all breakdown items for a scene"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify access via scene
        scene = supabase.table("backlot_scenes").select("project_id").eq("id", scene_id).single().execute()
        if not scene.data:
            raise HTTPException(status_code=404, detail="Scene not found")

        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", scene.data["project_id"]).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", scene.data["project_id"]).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        result = supabase.table("backlot_scene_breakdown_items").select("*").eq("scene_id", scene_id).order("type").execute()

        # Group by type
        grouped = {}
        for item in result.data or []:
            item_type = item["type"]
            if item_type not in grouped:
                grouped[item_type] = []
            grouped[item_type].append(item)

        return {"breakdown_items": result.data or [], "grouped": grouped}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching breakdown items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenes/{scene_id}/breakdown")
async def create_breakdown_item(
    scene_id: str,
    item: BreakdownItemInput,
    authorization: str = Header(None)
):
    """Create a breakdown item for a scene"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify access via scene
        scene = supabase.table("backlot_scenes").select("project_id").eq("id", scene_id).single().execute()
        if not scene.data:
            raise HTTPException(status_code=404, detail="Scene not found")

        project_id = scene.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to add breakdown items")

        item_data = {
            "scene_id": scene_id,
            "type": item.type,
            "label": item.label,
            "quantity": item.quantity or 1,
            "notes": item.notes,
            "linked_entity_id": item.linked_entity_id,
            "linked_entity_type": item.linked_entity_type
        }

        result = supabase.table("backlot_scene_breakdown_items").insert(item_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create breakdown item")

        return {"success": True, "item": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating breakdown item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/breakdown-items/{item_id}")
async def update_breakdown_item(
    item_id: str,
    item: BreakdownItemInput,
    authorization: str = Header(None)
):
    """Update a breakdown item"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get item and verify access
        existing = supabase.table("backlot_scene_breakdown_items").select("scene_id").eq("id", item_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Breakdown item not found")

        scene = supabase.table("backlot_scenes").select("project_id").eq("id", existing.data["scene_id"]).single().execute()
        project_id = scene.data["project_id"]

        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to edit breakdown items")

        update_data = {
            "type": item.type,
            "label": item.label,
            "quantity": item.quantity,
            "notes": item.notes,
            "linked_entity_id": item.linked_entity_id,
            "linked_entity_type": item.linked_entity_type
        }

        result = supabase.table("backlot_scene_breakdown_items").update(update_data).eq("id", item_id).execute()
        return {"success": True, "item": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating breakdown item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/breakdown-items/{item_id}")
async def delete_breakdown_item(
    item_id: str,
    authorization: str = Header(None)
):
    """Delete a breakdown item"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get item and verify access
        existing = supabase.table("backlot_scene_breakdown_items").select("scene_id").eq("id", item_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Breakdown item not found")

        scene = supabase.table("backlot_scenes").select("project_id").eq("id", existing.data["scene_id"]).single().execute()
        project_id = scene.data["project_id"]

        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to delete breakdown items")

        supabase.table("backlot_scene_breakdown_items").delete().eq("id", item_id).execute()
        return {"success": True, "message": "Breakdown item deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting breakdown item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SCENE COVERAGE & DASHBOARD
# =====================================================

@router.get("/projects/{project_id}/script/coverage")
async def get_project_coverage(
    project_id: str,
    authorization: str = Header(None)
):
    """Get scene coverage statistics for a project"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        # Get all scenes
        scenes = supabase.table("backlot_scenes").select("id, scene_number, slugline, page_length, is_scheduled, is_shot, needs_pickup").eq("project_id", project_id).execute()

        all_scenes = scenes.data or []

        total_scenes = len(all_scenes)
        total_pages = sum(s.get("page_length", 0) or 0 for s in all_scenes)

        scheduled = [s for s in all_scenes if s.get("is_scheduled")]
        shot = [s for s in all_scenes if s.get("is_shot")]
        pickup = [s for s in all_scenes if s.get("needs_pickup")]
        remaining = [s for s in all_scenes if not s.get("is_shot") and not s.get("needs_pickup")]

        return {
            "coverage": {
                "total_scenes": total_scenes,
                "total_pages": float(total_pages),
                "scenes_scheduled": len(scheduled),
                "pages_scheduled": sum(s.get("page_length", 0) or 0 for s in scheduled),
                "scenes_shot": len(shot),
                "pages_shot": sum(s.get("page_length", 0) or 0 for s in shot),
                "scenes_pickup": len(pickup),
                "pages_pickup": sum(s.get("page_length", 0) or 0 for s in pickup),
                "scenes_remaining": len(remaining),
                "pages_remaining": sum(s.get("page_length", 0) or 0 for s in remaining),
                "percent_complete": round((len(shot) / total_scenes * 100) if total_scenes > 0 else 0, 1)
            }
        }

    except Exception as e:
        print(f"Error fetching coverage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/script/location-needs")
async def get_location_needs(
    project_id: str,
    authorization: str = Header(None)
):
    """Get location needs grouped by location hint"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        # Get all scenes with location info
        scenes = supabase.table("backlot_scenes").select("id, scene_number, slugline, location_hint, int_ext, day_night, page_length, location_id, sequence").eq("project_id", project_id).order("sequence").execute()

        # Group by location_hint
        location_groups = {}
        for scene in scenes.data or []:
            hint = scene.get("location_hint") or "UNSPECIFIED"
            if hint not in location_groups:
                location_groups[hint] = {
                    "location_hint": hint,
                    "int_ext": scene.get("int_ext"),
                    "day_night_options": set(),
                    "scenes": [],
                    "total_pages": 0,
                    "linked_location_id": scene.get("location_id")
                }

            location_groups[hint]["scenes"].append({
                "id": scene["id"],
                "scene_number": scene["scene_number"],
                "slugline": scene.get("slugline"),
                "page_length": scene.get("page_length", 0)
            })
            location_groups[hint]["total_pages"] += scene.get("page_length", 0) or 0
            if scene.get("day_night"):
                location_groups[hint]["day_night_options"].add(scene["day_night"])

        # Convert sets to lists and add location info
        result = []
        for hint, group in location_groups.items():
            group["day_night_options"] = list(group["day_night_options"])
            group["scene_count"] = len(group["scenes"])

            # Get linked location name if any
            if group["linked_location_id"]:
                loc = supabase.table("backlot_locations").select("name, address, city").eq("id", group["linked_location_id"]).execute()
                if loc.data:
                    group["linked_location"] = loc.data[0]

            result.append(group)

        # Sort by scene count descending
        result.sort(key=lambda x: x["scene_count"], reverse=True)

        return {"location_needs": result}

    except Exception as e:
        print(f"Error fetching location needs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK GENERATION FROM BREAKDOWN
# =====================================================

@router.post("/projects/{project_id}/script/generate-tasks")
async def generate_tasks_from_breakdown(
    project_id: str,
    scene_ids: List[str] = Body(None),  # Optional: limit to specific scenes
    regenerate: bool = False,
    authorization: str = Header(None)
):
    """Generate departmental tasks from breakdown items"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to generate tasks")

    # Map breakdown types to departments
    type_to_department = {
        "cast": "Casting",
        "background": "Casting",
        "stunt": "Stunts",
        "location": "Locations",
        "prop": "Art/Props",
        "set_dressing": "Art/Set Dec",
        "wardrobe": "Wardrobe",
        "makeup": "Makeup/Hair",
        "sfx": "SFX",
        "vfx": "VFX",
        "vehicle": "Transportation",
        "animal": "Animals",
        "greenery": "Art/Greens",
        "special_equipment": "Grip/Electric",
        "sound": "Sound",
        "music": "Music"
    }

    try:
        # Get scenes (all or filtered)
        query = supabase.table("backlot_scenes").select("id, scene_number, slugline").eq("project_id", project_id)
        if scene_ids:
            query = query.in_("id", scene_ids)
        scenes = query.execute()

        if not scenes.data:
            return {"success": True, "tasks_created": 0, "message": "No scenes found"}

        scene_map = {s["id"]: s for s in scenes.data}
        scene_id_list = list(scene_map.keys())

        # Get breakdown items
        breakdown_query = supabase.table("backlot_scene_breakdown_items").select("*").in_("scene_id", scene_id_list)
        if not regenerate:
            breakdown_query = breakdown_query.eq("task_generated", False)

        items = breakdown_query.execute()

        tasks_created = 0
        for item in items.data or []:
            scene = scene_map.get(item["scene_id"])
            if not scene:
                continue

            department = type_to_department.get(item["type"], "Production")

            task_title = f"[Sc {scene['scene_number']}] {item['type'].replace('_', ' ').title()}: {item['label']}"
            if item.get("quantity", 1) > 1:
                task_title += f" (x{item['quantity']})"

            task_data = {
                "project_id": project_id,
                "title": task_title,
                "description": f"From breakdown: {item.get('notes', '')}".strip() or f"Breakdown item for Scene {scene['scene_number']}",
                "status": "todo",
                "priority": "medium",
                "department": department,
                "created_by_user_id": user_id
            }

            task_result = supabase.table("backlot_tasks").insert(task_data).execute()

            if task_result.data:
                # Mark breakdown item as having task generated
                supabase.table("backlot_scene_breakdown_items").update({
                    "task_generated": True,
                    "task_id": task_result.data[0]["id"]
                }).eq("id", item["id"]).execute()

                tasks_created += 1

        return {
            "success": True,
            "tasks_created": tasks_created,
            "message": f"Generated {tasks_created} tasks from breakdown items"
        }

    except Exception as e:
        print(f"Error generating tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# BUDGET SUGGESTIONS FROM BREAKDOWN
# =====================================================

@router.post("/projects/{project_id}/script/generate-budget-suggestions")
async def generate_budget_suggestions(
    project_id: str,
    scene_ids: List[str] = Body(None),
    authorization: str = Header(None)
):
    """Generate budget suggestions from breakdown items"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to generate budget suggestions")

    # Map breakdown types to budget suggestion types and departments
    type_mapping = {
        "prop": {"type": "prop", "department": "Art"},
        "set_dressing": {"type": "set_dressing", "department": "Art"},
        "wardrobe": {"type": "wardrobe", "department": "Wardrobe"},
        "makeup": {"type": "makeup", "department": "Makeup/Hair"},
        "sfx": {"type": "sfx", "department": "SFX"},
        "vfx": {"type": "vfx", "department": "VFX"},
        "vehicle": {"type": "vehicle", "department": "Transportation"},
        "animal": {"type": "animal", "department": "Animals"},
        "special_equipment": {"type": "equipment", "department": "Grip/Electric"},
        "background": {"type": "extra_crew", "department": "Casting"},
        "stunt": {"type": "stunt", "department": "Stunts"}
    }

    try:
        # Get scenes
        query = supabase.table("backlot_scenes").select("id, scene_number").eq("project_id", project_id)
        if scene_ids:
            query = query.in_("id", scene_ids)
        scenes = query.execute()

        if not scenes.data:
            return {"success": True, "suggestions_created": 0}

        scene_map = {s["id"]: s for s in scenes.data}
        scene_id_list = list(scene_map.keys())

        # Get breakdown items that map to budget items
        items = supabase.table("backlot_scene_breakdown_items").select("*").in_("scene_id", scene_id_list).in_("type", list(type_mapping.keys())).execute()

        suggestions_created = 0
        for item in items.data or []:
            scene = scene_map.get(item["scene_id"])
            mapping = type_mapping.get(item["type"])
            if not scene or not mapping:
                continue

            # Check if suggestion already exists
            existing = supabase.table("backlot_budget_suggestions").select("id").eq("breakdown_item_id", item["id"]).execute()
            if existing.data:
                continue

            suggestion_data = {
                "project_id": project_id,
                "scene_id": item["scene_id"],
                "breakdown_item_id": item["id"],
                "suggestion_type": mapping["type"],
                "department": mapping["department"],
                "description": f"Scene {scene['scene_number']}: {item['label']}" + (f" (x{item['quantity']})" if item.get("quantity", 1) > 1 else ""),
                "notes": item.get("notes"),
                "status": "pending",
                "created_by_user_id": user_id
            }

            supabase.table("backlot_budget_suggestions").insert(suggestion_data).execute()
            suggestions_created += 1

        return {
            "success": True,
            "suggestions_created": suggestions_created,
            "message": f"Generated {suggestions_created} budget suggestions"
        }

    except Exception as e:
        print(f"Error generating budget suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/budget-suggestions")
async def get_budget_suggestions(
    project_id: str,
    status: str = None,
    authorization: str = Header(None)
):
    """Get budget suggestions for a project"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        query = supabase.table("backlot_budget_suggestions").select("*").eq("project_id", project_id).order("created_at", desc=True)
        if status:
            query = query.eq("status", status)

        result = query.execute()
        return {"suggestions": result.data or []}

    except Exception as e:
        print(f"Error fetching budget suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/budget-suggestions/{suggestion_id}")
async def update_budget_suggestion(
    suggestion_id: str,
    status: str = Body(...),
    linked_budget_line_id: str = Body(None),
    authorization: str = Header(None)
):
    """Update a budget suggestion status"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get suggestion and verify access
        existing = supabase.table("backlot_budget_suggestions").select("project_id").eq("id", suggestion_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Suggestion not found")

        project_id = existing.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to update suggestions")

        update_data = {"status": status}
        if linked_budget_line_id:
            update_data["linked_budget_line_id"] = linked_budget_line_id

        result = supabase.table("backlot_budget_suggestions").update(update_data).eq("id", suggestion_id).execute()
        return {"success": True, "suggestion": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating budget suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# CALL SHEET SCENE LINKS
# =====================================================

@router.get("/call-sheets/{call_sheet_id}/linked-scenes")
async def get_call_sheet_linked_scenes(
    call_sheet_id: str,
    authorization: str = Header(None)
):
    """Get scenes linked to a call sheet"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify access via call sheet
        cs = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).single().execute()
        if not cs.data:
            raise HTTPException(status_code=404, detail="Call sheet not found")

        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", cs.data["project_id"]).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", cs.data["project_id"]).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Get linked scenes with full scene data
        links = supabase.table("backlot_call_sheet_scene_links").select("*").eq("call_sheet_id", call_sheet_id).order("sequence").execute()

        if not links.data:
            return {"linked_scenes": [], "total_pages": 0}

        scene_ids = [l["scene_id"] for l in links.data]
        scenes = supabase.table("backlot_scenes").select("*").in_("id", scene_ids).execute()
        scene_map = {s["id"]: s for s in scenes.data or []}

        result = []
        total_pages = 0
        for link in links.data:
            scene = scene_map.get(link["scene_id"])
            if scene:
                result.append({
                    **link,
                    "scene": scene
                })
                total_pages += scene.get("page_length", 0) or 0

        return {"linked_scenes": result, "total_pages": total_pages}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching linked scenes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/call-sheets/{call_sheet_id}/linked-scenes")
async def link_scene_to_call_sheet(
    call_sheet_id: str,
    link: CallSheetSceneLinkInput,
    authorization: str = Header(None)
):
    """Link a scene to a call sheet"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify access
        cs = supabase.table("backlot_call_sheets").select("project_id, production_day_id").eq("id", call_sheet_id).single().execute()
        if not cs.data:
            raise HTTPException(status_code=404, detail="Call sheet not found")

        project_id = cs.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to link scenes")

        # Check if already linked
        existing = supabase.table("backlot_call_sheet_scene_links").select("id").eq("call_sheet_id", call_sheet_id).eq("scene_id", link.scene_id).execute()
        if existing.data:
            return {"success": True, "message": "Scene already linked", "link": existing.data[0]}

        # Get next sequence
        seq_result = supabase.table("backlot_call_sheet_scene_links").select("sequence").eq("call_sheet_id", call_sheet_id).order("sequence", desc=True).limit(1).execute()
        next_seq = (seq_result.data[0]["sequence"] + 1) if seq_result.data else 1

        link_data = {
            "call_sheet_id": call_sheet_id,
            "scene_id": link.scene_id,
            "sequence": link.sequence if link.sequence else next_seq,
            "estimated_time_minutes": link.estimated_time_minutes,
            "notes": link.notes
        }

        result = supabase.table("backlot_call_sheet_scene_links").insert(link_data).execute()

        # Mark scene as scheduled
        supabase.table("backlot_scenes").update({
            "is_scheduled": True,
            "scheduled_day_id": cs.data.get("production_day_id")
        }).eq("id", link.scene_id).execute()

        return {"success": True, "link": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error linking scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/call-sheets/{call_sheet_id}/linked-scenes/{scene_id}")
async def unlink_scene_from_call_sheet(
    call_sheet_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """Unlink a scene from a call sheet"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify access
        cs = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).single().execute()
        if not cs.data:
            raise HTTPException(status_code=404, detail="Call sheet not found")

        project_id = cs.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to unlink scenes")

        # Delete link
        supabase.table("backlot_call_sheet_scene_links").delete().eq("call_sheet_id", call_sheet_id).eq("scene_id", scene_id).execute()

        # Check if scene is linked to any other call sheets
        other_links = supabase.table("backlot_call_sheet_scene_links").select("id").eq("scene_id", scene_id).execute()
        if not other_links.data:
            # Unmark scene as scheduled
            supabase.table("backlot_scenes").update({
                "is_scheduled": False,
                "scheduled_day_id": None
            }).eq("id", scene_id).execute()

        return {"success": True, "message": "Scene unlinked from call sheet"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error unlinking scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/call-sheet-scene-links/{link_id}")
async def delete_call_sheet_scene_link(
    link_id: str,
    authorization: str = Header(None)
):
    """Delete a call sheet scene link by its ID"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get the link to find associated call sheet and scene
        link = supabase.table("backlot_call_sheet_scene_links").select("*").eq("id", link_id).single().execute()
        if not link.data:
            raise HTTPException(status_code=404, detail="Scene link not found")

        call_sheet_id = link.data["call_sheet_id"]
        scene_id = link.data["scene_id"]

        # Verify access via call sheet
        cs = supabase.table("backlot_call_sheets").select("project_id").eq("id", call_sheet_id).single().execute()
        if not cs.data:
            raise HTTPException(status_code=404, detail="Call sheet not found")

        project_id = cs.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to delete scene links")

        # Delete link
        supabase.table("backlot_call_sheet_scene_links").delete().eq("id", link_id).execute()

        # Check if scene is linked to any other call sheets
        other_links = supabase.table("backlot_call_sheet_scene_links").select("id").eq("scene_id", scene_id).execute()
        if not other_links.data:
            # Unmark scene as scheduled
            supabase.table("backlot_scenes").update({
                "is_scheduled": False,
                "scheduled_day_id": None
            }).eq("id", scene_id).execute()

        return {"success": True, "message": "Scene link deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting scene link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SCRIPT PAGE NOTES - Acrobat-style annotations
# =====================================================

class ScriptPageNoteInput(BaseModel):
    page_number: int
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    note_text: str
    note_type: Optional[str] = "general"
    scene_id: Optional[str] = None

class ScriptPageNoteUpdate(BaseModel):
    note_text: Optional[str] = None
    note_type: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    scene_id: Optional[str] = None
    resolved: Optional[bool] = None


@router.get("/scripts/{script_id}/notes")
async def get_script_page_notes(
    script_id: str,
    page_number: Optional[int] = None,
    note_type: Optional[str] = None,
    resolved: Optional[bool] = None,
    authorization: str = Header(None)
):
    """Get all notes for a script, optionally filtered by page, type, or resolved status"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify script access
        script_result = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script_result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script_result.data["project_id"]

        # Verify project access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Build query - don't use relationship, just select the base columns
        query = supabase.table("backlot_script_page_notes").select("*").eq("script_id", script_id)

        if page_number is not None:
            query = query.eq("page_number", page_number)
        if note_type is not None:
            query = query.eq("note_type", note_type)
        if resolved is not None:
            query = query.eq("resolved", resolved)

        query = query.order("page_number").order("created_at")
        result = query.execute()

        return {"notes": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching script notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scripts/{script_id}/notes/summary")
async def get_script_notes_summary(
    script_id: str,
    authorization: str = Header(None)
):
    """Get summary of notes per page for a script"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify script access - page_count might not exist, use total_pages instead
        script_result = supabase.table("backlot_scripts").select("project_id, total_pages").eq("id", script_id).single().execute()
        if not script_result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script_result.data["project_id"]
        page_count = script_result.data.get("total_pages")

        # Verify project access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Get notes grouped by page
        notes_result = supabase.table("backlot_script_page_notes").select("page_number, note_type, resolved").eq("script_id", script_id).execute()

        # Build summary
        page_summary = {}
        for note in notes_result.data or []:
            pg = note["page_number"]
            if pg not in page_summary:
                page_summary[pg] = {
                    "page_number": pg,
                    "total_count": 0,
                    "unresolved_count": 0,
                    "note_types": []
                }
            page_summary[pg]["total_count"] += 1
            if not note.get("resolved"):
                page_summary[pg]["unresolved_count"] += 1
            if note["note_type"] not in page_summary[pg]["note_types"]:
                page_summary[pg]["note_types"].append(note["note_type"])

        return {
            "page_count": page_count,
            "pages_with_notes": list(page_summary.values())
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching notes summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/notes")
async def create_script_page_note(
    script_id: str,
    note: ScriptPageNoteInput,
    authorization: str = Header(None)
):
    """Create a new note on a script page"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify script access
        script_result = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script_result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script_result.data["project_id"]

        # Verify project membership (any member can add notes)
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Validate note_type
        valid_types = ["general", "direction", "production", "character", "blocking", "camera", "continuity", "sound", "vfx", "prop", "wardrobe", "makeup", "location", "safety", "other"]
        if note.note_type and note.note_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid note type. Must be one of: {', '.join(valid_types)}")

        # Create note
        note_data = {
            "script_id": script_id,
            "project_id": project_id,
            "page_number": note.page_number,
            "position_x": note.position_x,
            "position_y": note.position_y,
            "note_text": note.note_text,
            "note_type": note.note_type or "general",
            "scene_id": note.scene_id,
            "author_user_id": user_id,
            "resolved": False
        }

        result = supabase.table("backlot_script_page_notes").insert(note_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create note")

        # Fetch with author profile
        created_note = supabase.table("backlot_script_page_notes").select("*, profiles:author_user_id(id, full_name, avatar_url)").eq("id", result.data[0]["id"]).single().execute()

        return {"success": True, "note": created_note.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating script note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/scripts/{script_id}/notes/{note_id}")
async def update_script_page_note(
    script_id: str,
    note_id: str,
    note_update: ScriptPageNoteUpdate,
    authorization: str = Header(None)
):
    """Update a script page note"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get note and verify ownership/permissions
        note_result = supabase.table("backlot_script_page_notes").select("*, backlot_scripts(project_id)").eq("id", note_id).eq("script_id", script_id).single().execute()

        if not note_result.data:
            raise HTTPException(status_code=404, detail="Note not found")

        note_data = note_result.data
        project_id = note_data["backlot_scripts"]["project_id"]
        is_author = note_data["author_user_id"] == user_id

        # Check if user can edit (author or editor role)
        can_edit = is_author
        if not can_edit:
            project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
            is_owner = project_response.data[0]["owner_id"] == user_id
            if is_owner:
                can_edit = True
            else:
                member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
                if member_response.data and member_response.data[0]["role"] in ["owner", "admin", "editor"]:
                    can_edit = True

        if not can_edit:
            raise HTTPException(status_code=403, detail="You don't have permission to edit this note")

        # Build update data
        update_data = {}
        if note_update.note_text is not None:
            update_data["note_text"] = note_update.note_text
        if note_update.note_type is not None:
            valid_types = ["general", "direction", "production", "character", "blocking", "camera", "continuity", "sound", "vfx", "prop", "wardrobe", "makeup", "location", "safety", "other"]
            if note_update.note_type not in valid_types:
                raise HTTPException(status_code=400, detail=f"Invalid note type")
            update_data["note_type"] = note_update.note_type
        if note_update.position_x is not None:
            update_data["position_x"] = note_update.position_x
        if note_update.position_y is not None:
            update_data["position_y"] = note_update.position_y
        if note_update.scene_id is not None:
            update_data["scene_id"] = note_update.scene_id if note_update.scene_id else None
        if note_update.resolved is not None:
            update_data["resolved"] = note_update.resolved
            if note_update.resolved:
                update_data["resolved_at"] = datetime.utcnow().isoformat()
                update_data["resolved_by_user_id"] = user_id
            else:
                update_data["resolved_at"] = None
                update_data["resolved_by_user_id"] = None

        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")

        result = supabase.table("backlot_script_page_notes").update(update_data).eq("id", note_id).execute()

        # Fetch updated note with author
        updated_note = supabase.table("backlot_script_page_notes").select("*, profiles:author_user_id(id, full_name, avatar_url)").eq("id", note_id).single().execute()

        return {"success": True, "note": updated_note.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating script note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scripts/{script_id}/notes/{note_id}")
async def delete_script_page_note(
    script_id: str,
    note_id: str,
    authorization: str = Header(None)
):
    """Delete a script page note"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get note and verify ownership/permissions
        note_result = supabase.table("backlot_script_page_notes").select("*, backlot_scripts(project_id)").eq("id", note_id).eq("script_id", script_id).single().execute()

        if not note_result.data:
            raise HTTPException(status_code=404, detail="Note not found")

        note_data = note_result.data
        project_id = note_data["backlot_scripts"]["project_id"]
        is_author = note_data["author_user_id"] == user_id

        # Check if user can delete (author or editor role)
        can_delete = is_author
        if not can_delete:
            project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
            is_owner = project_response.data[0]["owner_id"] == user_id
            if is_owner:
                can_delete = True
            else:
                member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
                if member_response.data and member_response.data[0]["role"] in ["owner", "admin"]:
                    can_delete = True

        if not can_delete:
            raise HTTPException(status_code=403, detail="You don't have permission to delete this note")

        # Delete note
        supabase.table("backlot_script_page_notes").delete().eq("id", note_id).execute()

        return {"success": True, "message": "Note deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting script note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/scripts/{script_id}/notes/{note_id}/resolve")
async def toggle_note_resolved(
    script_id: str,
    note_id: str,
    resolved: bool = True,
    authorization: str = Header(None)
):
    """Toggle the resolved status of a note"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get note and verify access
        note_result = supabase.table("backlot_script_page_notes").select("*, backlot_scripts(project_id)").eq("id", note_id).eq("script_id", script_id).single().execute()

        if not note_result.data:
            raise HTTPException(status_code=404, detail="Note not found")

        project_id = note_result.data["backlot_scripts"]["project_id"]

        # Any project member can resolve/unresolve
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Update resolved status
        update_data = {"resolved": resolved}
        if resolved:
            update_data["resolved_at"] = datetime.utcnow().isoformat()
            update_data["resolved_by_user_id"] = user_id
        else:
            update_data["resolved_at"] = None
            update_data["resolved_by_user_id"] = None

        result = supabase.table("backlot_script_page_notes").update(update_data).eq("id", note_id).execute()

        return {"success": True, "resolved": resolved}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling note resolved: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Script Highlight Endpoints (Breakdown from text selection)
# =====================================================

class ScriptHighlightInput(BaseModel):
    """Input for creating a script highlight"""
    scene_id: Optional[str] = None
    page_number: int
    start_offset: int
    end_offset: int
    highlighted_text: str
    rect_x: Optional[float] = None
    rect_y: Optional[float] = None
    rect_width: Optional[float] = None
    rect_height: Optional[float] = None
    category: str  # breakdown item type
    color: Optional[str] = None
    suggested_label: Optional[str] = None


class ScriptHighlightUpdate(BaseModel):
    """Input for updating a highlight"""
    scene_id: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    suggested_label: Optional[str] = None
    breakdown_item_id: Optional[str] = None
    status: Optional[str] = None  # pending, confirmed, rejected


@router.get("/scripts/{script_id}/highlights")
async def get_script_highlights(
    script_id: str,
    page_number: Optional[int] = None,
    scene_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get highlights for a script with optional filtering"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify script access
        script_result = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script_result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script_result.data["project_id"]

        # Check project membership
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Build query - don't use nested relationships that don't exist
        query = supabase.table("backlot_script_highlight_breakdowns").select("*").eq("script_id", script_id)

        if page_number is not None:
            query = query.eq("page_number", page_number)
        if scene_id:
            query = query.eq("scene_id", scene_id)
        if category:
            query = query.eq("category", category)
        if status:
            query = query.eq("status", status)

        result = query.order("page_number").order("start_offset").execute()

        return {"highlights": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting script highlights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scripts/{script_id}/highlights/summary")
async def get_script_highlight_summary(
    script_id: str,
    authorization: str = Header(None)
):
    """Get summary of highlights by category"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify script access
        script_result = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script_result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script_result.data["project_id"]

        # Check project membership
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Get all highlights for this script
        result = supabase.table("backlot_script_highlight_breakdowns").select(
            "category, status, suggested_label"
        ).eq("script_id", script_id).execute()

        highlights = result.data or []

        # Group by category
        summary = {}
        for h in highlights:
            cat = h["category"]
            if cat not in summary:
                summary[cat] = {
                    "category": cat,
                    "total_count": 0,
                    "pending_count": 0,
                    "confirmed_count": 0,
                    "labels": set()
                }
            summary[cat]["total_count"] += 1
            if h["status"] == "pending":
                summary[cat]["pending_count"] += 1
            elif h["status"] == "confirmed":
                summary[cat]["confirmed_count"] += 1
            if h.get("suggested_label"):
                summary[cat]["labels"].add(h["suggested_label"])

        # Convert sets to lists
        for cat in summary:
            summary[cat]["labels"] = list(summary[cat]["labels"])

        return {"summary": list(summary.values())}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting highlight summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/highlights")
async def create_script_highlight(
    script_id: str,
    input: ScriptHighlightInput,
    authorization: str = Header(None)
):
    """Create a new highlight (text selection for breakdown)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify script access and get project_id
        script_result = supabase.table("backlot_scripts").select("project_id").eq("id", script_id).single().execute()
        if not script_result.data:
            raise HTTPException(status_code=404, detail="Script not found")

        project_id = script_result.data["project_id"]

        # Check project membership - need edit rights
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")
            role = member_response.data[0]["role"]
            if role not in ["admin", "editor", "coordinator"]:
                raise HTTPException(status_code=403, detail="Insufficient permissions to create highlights")

        # Determine default color based on category
        default_colors = {
            "cast": "#FF6B6B",
            "extra": "#FFA07A",
            "stunt": "#FF4500",
            "vehicle": "#4ECDC4",
            "prop": "#45B7D1",
            "set_dressing": "#96CEB4",
            "wardrobe": "#DDA0DD",
            "makeup": "#FFB6C1",
            "hair": "#D2691E",
            "livestock": "#8B4513",
            "animal": "#228B22",
            "sfx": "#9932CC",
            "vfx": "#00CED1",
            "sound": "#1E90FF",
            "music": "#FF1493",
            "greenery": "#32CD32",
            "special_equipment": "#FFD700",
            "security": "#DC143C",
            "other": "#808080",
        }
        color = input.color or default_colors.get(input.category, "#808080")

        highlight_data = {
            "id": str(uuid.uuid4()),
            "script_id": script_id,
            "scene_id": input.scene_id,
            "page_number": input.page_number,
            "start_offset": input.start_offset,
            "end_offset": input.end_offset,
            "highlighted_text": input.highlighted_text,
            "rect_x": input.rect_x,
            "rect_y": input.rect_y,
            "rect_width": input.rect_width,
            "rect_height": input.rect_height,
            "category": input.category,
            "color": color,
            "suggested_label": input.suggested_label or input.highlighted_text,
            "status": "pending",
            "created_by_user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = supabase.table("backlot_script_highlight_breakdowns").insert(highlight_data).execute()

        return {"success": True, "highlight": result.data[0] if result.data else highlight_data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating script highlight: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/scripts/{script_id}/highlights/{highlight_id}")
async def update_script_highlight(
    script_id: str,
    highlight_id: str,
    input: ScriptHighlightUpdate,
    authorization: str = Header(None)
):
    """Update a highlight"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify highlight exists and access
        highlight_result = supabase.table("backlot_script_highlight_breakdowns").select(
            "*, backlot_scripts(project_id)"
        ).eq("id", highlight_id).eq("script_id", script_id).single().execute()

        if not highlight_result.data:
            raise HTTPException(status_code=404, detail="Highlight not found")

        project_id = highlight_result.data["backlot_scripts"]["project_id"]

        # Check project membership
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")
            role = member_response.data[0]["role"]
            if role not in ["admin", "editor", "coordinator"]:
                raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if input.scene_id is not None:
            update_data["scene_id"] = input.scene_id
        if input.category is not None:
            update_data["category"] = input.category
        if input.color is not None:
            update_data["color"] = input.color
        if input.suggested_label is not None:
            update_data["suggested_label"] = input.suggested_label
        if input.breakdown_item_id is not None:
            update_data["breakdown_item_id"] = input.breakdown_item_id
        if input.status is not None:
            update_data["status"] = input.status

        result = supabase.table("backlot_script_highlight_breakdowns").update(update_data).eq("id", highlight_id).execute()

        return {"success": True, "highlight": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating script highlight: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/highlights/{highlight_id}/confirm")
async def confirm_script_highlight(
    script_id: str,
    highlight_id: str,
    create_breakdown: bool = True,
    authorization: str = Header(None)
):
    """Confirm a highlight and optionally create a breakdown item from it"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify highlight exists and access
        highlight_result = supabase.table("backlot_script_highlight_breakdowns").select(
            "*, backlot_scripts(project_id)"
        ).eq("id", highlight_id).eq("script_id", script_id).single().execute()

        if not highlight_result.data:
            raise HTTPException(status_code=404, detail="Highlight not found")

        highlight = highlight_result.data
        project_id = highlight["backlot_scripts"]["project_id"]

        # Check project membership
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        breakdown_item_id = highlight.get("breakdown_item_id")

        # Create breakdown item if requested and doesn't exist
        if create_breakdown and not breakdown_item_id and highlight.get("scene_id"):
            breakdown_data = {
                "id": str(uuid.uuid4()),
                "scene_id": highlight["scene_id"],
                "type": highlight["category"],
                "label": highlight.get("suggested_label") or highlight["highlighted_text"],
                "notes": f"Created from script highlight on page {highlight['page_number']}",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            breakdown_result = supabase.table("backlot_scene_breakdown_items").insert(breakdown_data).execute()
            if breakdown_result.data:
                breakdown_item_id = breakdown_result.data[0]["id"]

        # Update highlight status
        update_data = {
            "status": "confirmed",
            "updated_at": datetime.utcnow().isoformat(),
        }
        if breakdown_item_id:
            update_data["breakdown_item_id"] = breakdown_item_id

        supabase.table("backlot_script_highlight_breakdowns").update(update_data).eq("id", highlight_id).execute()

        return {
            "success": True,
            "status": "confirmed",
            "breakdown_item_id": breakdown_item_id
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error confirming script highlight: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scripts/{script_id}/highlights/{highlight_id}/reject")
async def reject_script_highlight(
    script_id: str,
    highlight_id: str,
    authorization: str = Header(None)
):
    """Reject/dismiss a highlight"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify highlight exists and access
        highlight_result = supabase.table("backlot_script_highlight_breakdowns").select(
            "*, backlot_scripts(project_id)"
        ).eq("id", highlight_id).eq("script_id", script_id).single().execute()

        if not highlight_result.data:
            raise HTTPException(status_code=404, detail="Highlight not found")

        project_id = highlight_result.data["backlot_scripts"]["project_id"]

        # Check project membership
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")

        # Update highlight status
        supabase.table("backlot_script_highlight_breakdowns").update({
            "status": "rejected",
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", highlight_id).execute()

        return {"success": True, "status": "rejected"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error rejecting script highlight: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scripts/{script_id}/highlights/{highlight_id}")
async def delete_script_highlight(
    script_id: str,
    highlight_id: str,
    authorization: str = Header(None)
):
    """Delete a highlight"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify highlight exists and access
        highlight_result = supabase.table("backlot_script_highlight_breakdowns").select(
            "*, backlot_scripts(project_id)"
        ).eq("id", highlight_id).eq("script_id", script_id).single().execute()

        if not highlight_result.data:
            raise HTTPException(status_code=404, detail="Highlight not found")

        project_id = highlight_result.data["backlot_scripts"]["project_id"]

        # Check project membership
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id
        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied - not a project member")
            role = member_response.data[0]["role"]
            if role not in ["admin", "editor", "coordinator"]:
                raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Delete highlight
        supabase.table("backlot_script_highlight_breakdowns").delete().eq("id", highlight_id).execute()

        return {"success": True, "message": "Highlight deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting script highlight: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# CASTING & CREW HIRING PIPELINE
# =====================================================

# =====================================================
# Pydantic Models for Casting & Crew
# =====================================================

class ProjectRoleInput(BaseModel):
    """Input for creating/updating a project role"""
    type: Literal["cast", "crew"]
    title: str
    description: Optional[str] = None
    department: Optional[str] = None
    character_name: Optional[str] = None
    character_description: Optional[str] = None
    age_range: Optional[str] = None
    gender_requirement: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_estimated: Optional[float] = None
    paid: bool = False
    rate_description: Optional[str] = None
    rate_amount_cents: Optional[int] = None
    rate_type: Optional[Literal["flat", "daily", "weekly", "hourly"]] = None
    is_order_only: bool = False
    is_featured: bool = False
    status: Optional[Literal["draft", "open", "closed", "booked", "cancelled"]] = "open"
    requires_reel: bool = False
    requires_headshot: bool = False
    application_deadline: Optional[str] = None
    max_applications: Optional[int] = None


class RoleApplicationInput(BaseModel):
    """Input for creating a role application"""
    cover_note: Optional[str] = None
    availability_notes: Optional[str] = None
    rate_expectation: Optional[str] = None
    reel_url: Optional[str] = None
    headshot_url: Optional[str] = None
    resume_url: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    """Input for updating application status"""
    status: Literal["applied", "viewed", "shortlisted", "interview", "offered", "booked", "rejected", "withdrawn"]
    internal_notes: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)


class UserAvailabilityInput(BaseModel):
    """Input for setting user availability"""
    date: str
    status: Literal["available", "unavailable", "hold", "booked", "tentative"]
    notes: Optional[str] = None
    project_id: Optional[str] = None


class BulkAvailabilityInput(BaseModel):
    """Input for setting availability for a date range"""
    start_date: str
    end_date: str
    status: Literal["available", "unavailable", "hold", "tentative"]
    notes: Optional[str] = None


# =====================================================
# Helper: Check Order Membership
# =====================================================

async def check_is_order_member(supabase, user_id: str) -> bool:
    """Check if a user is an active Order member"""
    try:
        result = supabase.table("order_member_profiles").select("status").eq("user_id", user_id).execute()
        if result.data:
            return result.data[0]["status"] in ("active", "probationary")
        return False
    except:
        return False


async def get_user_profile_snapshot(supabase, user_id: str) -> Dict[str, Any]:
    """Get a snapshot of user profile for application"""
    try:
        # Get base profile
        profile_result = supabase.table("profiles").select("full_name, username, avatar_url").eq("id", user_id).execute()
        profile = profile_result.data[0] if profile_result.data else {}

        # Get filmmaker profile if exists
        filmmaker_result = supabase.table("filmmaker_profiles").select(
            "department, location, portfolio_url, reel_url"
        ).eq("user_id", user_id).execute()
        filmmaker = filmmaker_result.data[0] if filmmaker_result.data else {}

        # Get order profile if exists
        order_result = supabase.table("order_member_profiles").select(
            "primary_track, city, portfolio_url, years_experience, status"
        ).eq("user_id", user_id).execute()
        order_profile = order_result.data[0] if order_result.data else {}

        # Get recent credits count
        credits_result = supabase.table("backlot_project_credits").select("id").eq("user_id", user_id).limit(10).execute()
        credits_count = len(credits_result.data) if credits_result.data else 0

        return {
            "name": profile.get("full_name") or profile.get("username") or "Unknown",
            "avatar_url": profile.get("avatar_url"),
            "primary_role": filmmaker.get("department") or order_profile.get("primary_track") or "Unknown",
            "department": filmmaker.get("department") or order_profile.get("primary_track"),
            "city": filmmaker.get("location") or order_profile.get("city"),
            "portfolio_url": filmmaker.get("portfolio_url") or order_profile.get("portfolio_url"),
            "reel_url": filmmaker.get("reel_url"),
            "years_experience": order_profile.get("years_experience"),
            "is_order_member": order_profile.get("status") in ("active", "probationary") if order_profile else False,
            "credits_count": credits_count
        }
    except Exception as e:
        print(f"Error getting profile snapshot: {e}")
        return {"name": "Unknown", "is_order_member": False}


# =====================================================
# Project Roles Endpoints
# =====================================================

@router.get("/projects/{project_id}/roles")
async def get_project_roles(
    project_id: str,
    type: Optional[str] = None,
    status: Optional[str] = None,
    include_applications: bool = False,
    authorization: str = Header(None)
):
    """Get all roles for a project"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied - not a project member")

    try:
        query = supabase.table("backlot_project_roles").select("*").eq("project_id", project_id).order("created_at", desc=True)

        if type:
            query = query.eq("type", type)
        if status:
            query = query.eq("status", status)

        result = query.execute()
        roles = result.data or []

        # Optionally include application counts
        if include_applications and roles:
            for role in roles:
                app_result = supabase.table("backlot_project_role_applications").select("id, status").eq("role_id", role["id"]).execute()
                apps = app_result.data or []
                role["application_count"] = len(apps)
                role["shortlisted_count"] = len([a for a in apps if a["status"] == "shortlisted"])
                role["booked_count"] = len([a for a in apps if a["status"] == "booked"])

        # Get booked user info if any
        for role in roles:
            if role.get("booked_user_id"):
                user_result = supabase.table("profiles").select("id, full_name, username, avatar_url").eq("id", role["booked_user_id"]).execute()
                role["booked_user"] = user_result.data[0] if user_result.data else None

        return {"success": True, "roles": roles, "count": len(roles)}

    except Exception as e:
        print(f"Error fetching project roles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/roles")
async def create_project_role(
    project_id: str,
    role_input: ProjectRoleInput,
    authorization: str = Header(None)
):
    """Create a new role posting for a project"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to create roles")

    try:
        role_data = {
            "project_id": project_id,
            "created_by_user_id": user_id,
            "type": role_input.type,
            "title": role_input.title,
            "description": role_input.description,
            "department": role_input.department,
            "character_name": role_input.character_name,
            "character_description": role_input.character_description,
            "age_range": role_input.age_range,
            "gender_requirement": role_input.gender_requirement,
            "location": role_input.location,
            "start_date": role_input.start_date,
            "end_date": role_input.end_date,
            "days_estimated": role_input.days_estimated,
            "paid": role_input.paid,
            "rate_description": role_input.rate_description,
            "rate_amount_cents": role_input.rate_amount_cents,
            "rate_type": role_input.rate_type,
            "is_order_only": role_input.is_order_only,
            "is_featured": role_input.is_featured,
            "status": role_input.status or "open",
            "requires_reel": role_input.requires_reel,
            "requires_headshot": role_input.requires_headshot,
            "application_deadline": role_input.application_deadline,
            "max_applications": role_input.max_applications,
        }

        result = supabase.table("backlot_project_roles").insert(role_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create role")

        return {"success": True, "role": result.data[0], "message": "Role created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating project role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/roles/{role_id}")
async def get_role(
    role_id: str,
    include_applications: bool = False,
    authorization: str = Header(None)
):
    """Get a single role with optional applications"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_project_roles").select("*").eq("id", role_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Role not found")

        role = result.data

        # Check access
        project_response = supabase.table("backlot_projects").select("owner_id, title").eq("id", role["project_id"]).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project = project_response.data[0]
        is_owner = project["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", role["project_id"]).eq("user_id", user_id).execute()
            is_member = bool(member_response.data)

            # Check if role is Order-only and user is not an Order member
            if role["is_order_only"] and not is_member:
                is_order_member = await check_is_order_member(supabase, user_id)
                if not is_order_member:
                    raise HTTPException(status_code=403, detail="This role is only visible to Order members")
            elif role["status"] != "open" and not is_member:
                raise HTTPException(status_code=403, detail="Access denied")

        role["project_title"] = project["title"]

        # Get booked user info
        if role.get("booked_user_id"):
            user_result = supabase.table("profiles").select("id, full_name, username, avatar_url").eq("id", role["booked_user_id"]).execute()
            role["booked_user"] = user_result.data[0] if user_result.data else None

        # Include applications for project admins
        if include_applications and (is_owner or (member_response.data and member_response.data[0]["role"] in ["owner", "admin", "editor"])):
            app_result = supabase.table("backlot_project_role_applications").select("*").eq("role_id", role_id).order("created_at", desc=True).execute()
            role["applications"] = app_result.data or []

        return {"success": True, "role": role}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    role_input: ProjectRoleInput,
    authorization: str = Header(None)
):
    """Update a role"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get existing role
        existing = supabase.table("backlot_project_roles").select("project_id").eq("id", role_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Role not found")

        project_id = existing.data["project_id"]

        # Verify edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to edit roles")

        update_data = {
            "type": role_input.type,
            "title": role_input.title,
            "description": role_input.description,
            "department": role_input.department,
            "character_name": role_input.character_name,
            "character_description": role_input.character_description,
            "age_range": role_input.age_range,
            "gender_requirement": role_input.gender_requirement,
            "location": role_input.location,
            "start_date": role_input.start_date,
            "end_date": role_input.end_date,
            "days_estimated": role_input.days_estimated,
            "paid": role_input.paid,
            "rate_description": role_input.rate_description,
            "rate_amount_cents": role_input.rate_amount_cents,
            "rate_type": role_input.rate_type,
            "is_order_only": role_input.is_order_only,
            "is_featured": role_input.is_featured,
            "status": role_input.status,
            "requires_reel": role_input.requires_reel,
            "requires_headshot": role_input.requires_headshot,
            "application_deadline": role_input.application_deadline,
            "max_applications": role_input.max_applications,
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = supabase.table("backlot_project_roles").update(update_data).eq("id", role_id).execute()

        return {"success": True, "role": result.data[0] if result.data else None, "message": "Role updated"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    authorization: str = Header(None)
):
    """Delete a role"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get existing role
        existing = supabase.table("backlot_project_roles").select("project_id").eq("id", role_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Role not found")

        project_id = existing.data["project_id"]

        # Verify delete access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin"]:
                raise HTTPException(status_code=403, detail="You don't have permission to delete roles")

        supabase.table("backlot_project_roles").delete().eq("id", role_id).execute()

        return {"success": True, "message": "Role deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/roles/{role_id}/book")
async def book_role(
    role_id: str,
    user_id_to_book: str = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Book a user for a role (from shortlist or directly)"""
    user = await get_current_user_from_token(authorization)
    current_user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get role
        role_result = supabase.table("backlot_project_roles").select("*").eq("id", role_id).single().execute()
        if not role_result.data:
            raise HTTPException(status_code=404, detail="Role not found")

        role = role_result.data

        # Verify admin access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", role["project_id"]).execute()
        is_owner = project_response.data[0]["owner_id"] == current_user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", role["project_id"]).eq("user_id", current_user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin"]:
                raise HTTPException(status_code=403, detail="You don't have permission to book roles")

        # Update role
        supabase.table("backlot_project_roles").update({
            "status": "booked",
            "booked_user_id": user_id_to_book,
            "booked_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", role_id).execute()

        # Update application status if exists
        supabase.table("backlot_project_role_applications").update({
            "status": "booked",
            "status_changed_at": datetime.utcnow().isoformat(),
            "status_changed_by_user_id": current_user_id,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("role_id", role_id).eq("applicant_user_id", user_id_to_book).execute()

        # Optionally add as project member if not already
        existing_member = supabase.table("backlot_project_members").select("id").eq("project_id", role["project_id"]).eq("user_id", user_id_to_book).execute()

        if not existing_member.data:
            # Get user profile for name/email
            profile = supabase.table("profiles").select("full_name, email").eq("id", user_id_to_book).execute()
            profile_data = profile.data[0] if profile.data else {}

            supabase.table("backlot_project_members").insert({
                "project_id": role["project_id"],
                "user_id": user_id_to_book,
                "role": "viewer",  # Basic access
                "production_role": role["title"],
                "department": role.get("department"),
                "invited_by": current_user_id,
            }).execute()

        return {"success": True, "message": f"User booked for {role['title']}"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error booking role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Open/Public Roles Listing (for Community/Order)
# =====================================================

@router.get("/open-roles")
async def get_open_roles(
    type: Optional[str] = None,
    location: Optional[str] = None,
    paid_only: bool = False,
    order_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    authorization: str = Header(None)
):
    """Get all open roles (public listing for job board)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Check if user is Order member
        is_order_member = await check_is_order_member(supabase, user_id)

        # Base query for open roles
        query = supabase.table("backlot_project_roles").select(
            "*, backlot_projects(id, title, slug, cover_image_url, owner_id)"
        ).eq("status", "open")

        # Filter Order-only roles if user is not an Order member
        if not is_order_member:
            query = query.eq("is_order_only", False)
        elif order_only:
            query = query.eq("is_order_only", True)

        if type:
            query = query.eq("type", type)
        if location:
            query = query.ilike("location", f"%{location}%")
        if paid_only:
            query = query.eq("paid", True)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

        result = query.execute()
        roles = result.data or []

        # Get application counts
        for role in roles:
            app_count = supabase.table("backlot_project_role_applications").select("id", count="exact").eq("role_id", role["id"]).execute()
            role["application_count"] = app_count.count if app_count.count else 0

            # Check if current user has applied
            user_app = supabase.table("backlot_project_role_applications").select("id, status").eq("role_id", role["id"]).eq("applicant_user_id", user_id).execute()
            role["user_has_applied"] = bool(user_app.data)
            role["user_application_status"] = user_app.data[0]["status"] if user_app.data else None

        return {"success": True, "roles": roles, "count": len(roles), "is_order_member": is_order_member}

    except Exception as e:
        print(f"Error fetching open roles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Role Applications Endpoints
# =====================================================

@router.get("/roles/{role_id}/applications")
async def get_role_applications(
    role_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all applications for a role (project admin only)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get role and verify admin access
        role_result = supabase.table("backlot_project_roles").select("project_id").eq("id", role_id).single().execute()
        if not role_result.data:
            raise HTTPException(status_code=404, detail="Role not found")

        project_id = role_result.data["project_id"]

        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                raise HTTPException(status_code=403, detail="Access denied")

        query = supabase.table("backlot_project_role_applications").select("*").eq("role_id", role_id).order("created_at", desc=True)

        if status:
            query = query.eq("status", status)

        result = query.execute()
        applications = result.data or []

        # Group by status for board view
        applications_by_status = {
            "applied": [],
            "viewed": [],
            "shortlisted": [],
            "interview": [],
            "offered": [],
            "booked": [],
            "rejected": [],
            "withdrawn": [],
        }

        for app in applications:
            if app["status"] in applications_by_status:
                applications_by_status[app["status"]].append(app)

        return {
            "success": True,
            "applications": applications,
            "applications_by_status": applications_by_status,
            "count": len(applications)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/roles/{role_id}/apply")
async def apply_to_role(
    role_id: str,
    application: RoleApplicationInput,
    authorization: str = Header(None)
):
    """Apply to a role"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get role
        role_result = supabase.table("backlot_project_roles").select("*").eq("id", role_id).single().execute()
        if not role_result.data:
            raise HTTPException(status_code=404, detail="Role not found")

        role = role_result.data

        # Check if role is open
        if role["status"] != "open":
            raise HTTPException(status_code=400, detail="This role is no longer accepting applications")

        # Check if Order-only
        if role["is_order_only"]:
            is_order_member = await check_is_order_member(supabase, user_id)
            if not is_order_member:
                raise HTTPException(status_code=403, detail="This role is only open to Order members")

        # Check application deadline
        if role.get("application_deadline"):
            deadline = datetime.fromisoformat(role["application_deadline"])
            if datetime.utcnow() > deadline:
                raise HTTPException(status_code=400, detail="Application deadline has passed")

        # Check max applications
        if role.get("max_applications"):
            current_count = supabase.table("backlot_project_role_applications").select("id", count="exact").eq("role_id", role_id).execute()
            if current_count.count and current_count.count >= role["max_applications"]:
                raise HTTPException(status_code=400, detail="Maximum applications reached for this role")

        # Check for existing application
        existing = supabase.table("backlot_project_role_applications").select("id").eq("role_id", role_id).eq("applicant_user_id", user_id).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="You have already applied to this role")

        # Get profile snapshot
        profile_snapshot = await get_user_profile_snapshot(supabase, user_id)

        application_data = {
            "role_id": role_id,
            "applicant_user_id": user_id,
            "applicant_profile_snapshot": profile_snapshot,
            "cover_note": application.cover_note,
            "availability_notes": application.availability_notes,
            "rate_expectation": application.rate_expectation,
            "reel_url": application.reel_url,
            "headshot_url": application.headshot_url,
            "resume_url": application.resume_url,
            "status": "applied",
        }

        result = supabase.table("backlot_project_role_applications").insert(application_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit application")

        return {"success": True, "application": result.data[0], "message": "Application submitted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    status_update: ApplicationStatusUpdate,
    authorization: str = Header(None)
):
    """Update application status (project admin) or withdraw (applicant)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get application
        app_result = supabase.table("backlot_project_role_applications").select(
            "*, backlot_project_roles(project_id)"
        ).eq("id", application_id).single().execute()

        if not app_result.data:
            raise HTTPException(status_code=404, detail="Application not found")

        application = app_result.data
        project_id = application["backlot_project_roles"]["project_id"]

        # Check permissions
        is_applicant = application["applicant_user_id"] == user_id

        if is_applicant:
            # Applicant can only withdraw
            if status_update.status != "withdrawn":
                raise HTTPException(status_code=403, detail="You can only withdraw your application")
        else:
            # Must be project admin
            project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
            is_owner = project_response.data[0]["owner_id"] == user_id

            if not is_owner:
                member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
                if not member_response.data or member_response.data[0]["role"] not in ["owner", "admin", "editor"]:
                    raise HTTPException(status_code=403, detail="Access denied")

        update_data = {
            "status": status_update.status,
            "status_changed_at": datetime.utcnow().isoformat(),
            "status_changed_by_user_id": user_id,
            "updated_at": datetime.utcnow().isoformat(),
        }

        if status_update.internal_notes is not None:
            update_data["internal_notes"] = status_update.internal_notes
        if status_update.rating is not None:
            update_data["rating"] = status_update.rating

        result = supabase.table("backlot_project_role_applications").update(update_data).eq("id", application_id).execute()

        # If booking, also update the role
        if status_update.status == "booked":
            supabase.table("backlot_project_roles").update({
                "status": "booked",
                "booked_user_id": application["applicant_user_id"],
                "booked_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", application["role_id"]).execute()

        return {"success": True, "application": result.data[0] if result.data else None, "message": f"Application {status_update.status}"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-applications")
async def get_my_applications(
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get current user's applications"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_project_role_applications").select(
            "*, backlot_project_roles(*, backlot_projects(id, title, slug, cover_image_url))"
        ).eq("applicant_user_id", user_id).order("created_at", desc=True)

        if status:
            query = query.eq("status", status)

        result = query.execute()
        applications = result.data or []

        return {"success": True, "applications": applications, "count": len(applications)}

    except Exception as e:
        print(f"Error fetching my applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# User Availability Endpoints
# =====================================================

@router.get("/users/{target_user_id}/availability")
async def get_user_availability(
    target_user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get user's availability (own or project members)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Users can view their own availability or project members' availability
        is_self = target_user_id == user_id

        if not is_self:
            # Check if they share any project
            shared_projects = supabase.rpc("shared_projects", {"user_a": user_id, "user_b": target_user_id}).execute()
            # For now, allow viewing if they're authenticated (simplified)
            pass

        query = supabase.table("backlot_user_availability").select(
            "*, backlot_projects(id, title)"
        ).eq("user_id", target_user_id).order("date")

        if start_date:
            query = query.gte("date", start_date)
        if end_date:
            query = query.lte("date", end_date)

        result = query.execute()
        availability = result.data or []

        return {"success": True, "availability": availability, "count": len(availability)}

    except Exception as e:
        print(f"Error fetching availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-availability")
async def get_my_availability(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get current user's availability"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_user_availability").select(
            "*, backlot_projects(id, title), backlot_project_roles(id, title, type)"
        ).eq("user_id", user_id).order("date")

        if start_date:
            query = query.gte("date", start_date)
        if end_date:
            query = query.lte("date", end_date)

        result = query.execute()
        availability = result.data or []

        return {"success": True, "availability": availability, "count": len(availability)}

    except Exception as e:
        print(f"Error fetching my availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/my-availability")
async def set_my_availability(
    availability_input: UserAvailabilityInput,
    authorization: str = Header(None)
):
    """Set availability for a single date"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        data = {
            "user_id": user_id,
            "date": availability_input.date,
            "status": availability_input.status,
            "notes": availability_input.notes,
            "project_id": availability_input.project_id,
        }

        # Upsert (insert or update)
        result = supabase.table("backlot_user_availability").upsert(
            data,
            on_conflict="user_id,date"
        ).execute()

        return {"success": True, "availability": result.data[0] if result.data else None}

    except Exception as e:
        print(f"Error setting availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/my-availability/bulk")
async def set_bulk_availability(
    bulk_input: BulkAvailabilityInput,
    authorization: str = Header(None)
):
    """Set availability for a date range"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        from datetime import datetime, timedelta

        start = datetime.fromisoformat(bulk_input.start_date)
        end = datetime.fromisoformat(bulk_input.end_date)

        if end < start:
            raise HTTPException(status_code=400, detail="End date must be after start date")

        if (end - start).days > 365:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")

        entries = []
        current = start
        while current <= end:
            entries.append({
                "user_id": user_id,
                "date": current.strftime("%Y-%m-%d"),
                "status": bulk_input.status,
                "notes": bulk_input.notes,
            })
            current += timedelta(days=1)

        # Upsert all entries
        result = supabase.table("backlot_user_availability").upsert(
            entries,
            on_conflict="user_id,date"
        ).execute()

        return {"success": True, "entries_set": len(entries), "message": f"Availability set for {len(entries)} days"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error setting bulk availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/my-availability/{date}")
async def delete_my_availability(
    date: str,
    authorization: str = Header(None)
):
    """Remove availability entry for a date"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        supabase.table("backlot_user_availability").delete().eq("user_id", user_id).eq("date", date).execute()

        return {"success": True, "message": "Availability entry removed"}

    except Exception as e:
        print(f"Error deleting availability: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Booked Cast/Crew for Call Sheets
# =====================================================

@router.get("/projects/{project_id}/booked-people")
async def get_booked_people(
    project_id: str,
    type: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all booked cast/crew for a project (for call sheet integration)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        query = supabase.table("backlot_project_roles").select(
            "*, profiles!booked_user_id(id, full_name, username, avatar_url, email)"
        ).eq("project_id", project_id).eq("status", "booked").not_.is_("booked_user_id", "null")

        if type:
            query = query.eq("type", type)

        result = query.execute()
        booked_roles = result.data or []

        # Format for call sheet use
        booked_people = []
        for role in booked_roles:
            profile = role.get("profiles") or {}
            booked_people.append({
                "role_id": role["id"],
                "role_title": role["title"],
                "role_type": role["type"],
                "department": role.get("department"),
                "character_name": role.get("character_name"),
                "user_id": role["booked_user_id"],
                "name": profile.get("full_name") or profile.get("username") or "Unknown",
                "avatar_url": profile.get("avatar_url"),
                "email": profile.get("email"),
                "start_date": role.get("start_date"),
                "end_date": role.get("end_date"),
            })

        return {"success": True, "booked_people": booked_people, "count": len(booked_people)}

    except Exception as e:
        print(f"Error fetching booked people: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# Availability Conflicts Check
# =====================================================

@router.post("/check-availability-conflicts")
async def check_availability_conflicts(
    user_ids: List[str] = Body(...),
    start_date: str = Body(...),
    end_date: str = Body(...),
    authorization: str = Header(None)
):
    """Check for availability conflicts for multiple users"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        conflicts = {}

        for uid in user_ids:
            result = supabase.table("backlot_user_availability").select(
                "date, status, notes, backlot_projects(title)"
            ).eq("user_id", uid).gte("date", start_date).lte("date", end_date).in_("status", ["unavailable", "booked"]).execute()

            if result.data:
                conflicts[uid] = result.data

        return {
            "success": True,
            "conflicts": conflicts,
            "has_conflicts": len(conflicts) > 0
        }

    except Exception as e:
        print(f"Error checking conflicts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CLEARANCES, RELEASES, AND CONTRACTS
# =============================================================================

class ClearanceItemInput(BaseModel):
    type: str  # talent_release, location_release, appearance_release, nda, music_license, stock_license, other_contract
    title: str
    description: Optional[str] = None
    related_person_id: Optional[str] = None
    related_person_name: Optional[str] = None
    related_location_id: Optional[str] = None
    related_project_location_id: Optional[str] = None
    related_asset_label: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_is_sensitive: Optional[bool] = False
    status: Optional[str] = "not_started"
    requested_date: Optional[str] = None
    signed_date: Optional[str] = None
    expiration_date: Optional[str] = None
    notes: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


CLEARANCE_TYPES = [
    "talent_release",
    "location_release",
    "appearance_release",
    "nda",
    "music_license",
    "stock_license",
    "other_contract"
]

CLEARANCE_STATUSES = [
    "not_started",
    "requested",
    "signed",
    "expired",
    "rejected"
]


@router.get("/projects/{project_id}/clearances")
async def get_project_clearances(
    project_id: str,
    type: Optional[str] = None,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all clearance items for a project with optional filtering"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        query = supabase.table("backlot_clearance_items").select("*").eq("project_id", project_id)

        if type:
            query = query.eq("type", type)
        if status:
            query = query.eq("status", status)

        result = query.order("created_at", desc=True).execute()

        # Get summary statistics
        summary_result = supabase.rpc("get_project_clearance_summary", {"p_project_id": project_id}).execute()
        summary = summary_result.data if summary_result.data else {}

        return {
            "success": True,
            "clearances": result.data or [],
            "count": len(result.data or []),
            "summary": summary
        }

    except Exception as e:
        print(f"Error fetching clearances: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/clearances")
async def create_clearance_item(
    project_id: str,
    item: ClearanceItemInput,
    authorization: str = Header(None)
):
    """Create a new clearance item"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify project edit access
    project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project_response.data[0]["owner_id"] == user_id
    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data or member_response.data[0]["role"] not in ["admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to create clearances")

    # Validate type
    if item.type not in CLEARANCE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid clearance type. Must be one of: {CLEARANCE_TYPES}")

    # Validate status
    if item.status and item.status not in CLEARANCE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {CLEARANCE_STATUSES}")

    try:
        clearance_data = {
            "project_id": project_id,
            "type": item.type,
            "title": item.title,
            "description": item.description,
            "related_person_id": item.related_person_id,
            "related_person_name": item.related_person_name,
            "related_location_id": item.related_location_id,
            "related_project_location_id": item.related_project_location_id,
            "related_asset_label": item.related_asset_label,
            "file_url": item.file_url,
            "file_name": item.file_name,
            "file_is_sensitive": item.file_is_sensitive or False,
            "status": item.status or "not_started",
            "requested_date": item.requested_date,
            "signed_date": item.signed_date,
            "expiration_date": item.expiration_date,
            "notes": item.notes,
            "contact_email": item.contact_email,
            "contact_phone": item.contact_phone,
            "created_by_user_id": user_id,
        }

        result = supabase.table("backlot_clearance_items").insert(clearance_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create clearance item")

        return {"success": True, "clearance": result.data[0], "message": "Clearance item created"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating clearance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clearances/{clearance_id}")
async def get_clearance_item(
    clearance_id: str,
    authorization: str = Header(None)
):
    """Get a single clearance item"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_clearance_items").select("*").eq("id", clearance_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Clearance item not found")

        # Verify access
        project_id = result.data["project_id"]
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data:
                raise HTTPException(status_code=403, detail="Access denied")

        return {"success": True, "clearance": result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching clearance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/clearances/{clearance_id}")
async def update_clearance_item(
    clearance_id: str,
    item: ClearanceItemInput,
    authorization: str = Header(None)
):
    """Update a clearance item"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get existing clearance
        existing = supabase.table("backlot_clearance_items").select("project_id").eq("id", clearance_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Clearance item not found")

        project_id = existing.data["project_id"]

        # Verify edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to update clearances")

        # Validate type and status
        if item.type and item.type not in CLEARANCE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid clearance type")
        if item.status and item.status not in CLEARANCE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status")

        update_data = {
            "type": item.type,
            "title": item.title,
            "description": item.description,
            "related_person_id": item.related_person_id,
            "related_person_name": item.related_person_name,
            "related_location_id": item.related_location_id,
            "related_project_location_id": item.related_project_location_id,
            "related_asset_label": item.related_asset_label,
            "file_url": item.file_url,
            "file_name": item.file_name,
            "file_is_sensitive": item.file_is_sensitive,
            "status": item.status,
            "requested_date": item.requested_date,
            "signed_date": item.signed_date,
            "expiration_date": item.expiration_date,
            "notes": item.notes,
            "contact_email": item.contact_email,
            "contact_phone": item.contact_phone,
        }

        result = supabase.table("backlot_clearance_items").update(update_data).eq("id", clearance_id).execute()

        return {"success": True, "clearance": result.data[0] if result.data else None, "message": "Clearance updated"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating clearance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clearances/{clearance_id}")
async def delete_clearance_item(
    clearance_id: str,
    authorization: str = Header(None)
):
    """Delete a clearance item"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Get existing clearance
        existing = supabase.table("backlot_clearance_items").select("project_id").eq("id", clearance_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Clearance item not found")

        project_id = existing.data["project_id"]

        # Verify delete access (admin only)
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] != "admin":
                raise HTTPException(status_code=403, detail="Only admins can delete clearances")

        supabase.table("backlot_clearance_items").delete().eq("id", clearance_id).execute()

        return {"success": True, "message": "Clearance deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting clearance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/clearances/{clearance_id}/status")
async def update_clearance_status(
    clearance_id: str,
    status: str = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Quick update of clearance status"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    if status not in CLEARANCE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {CLEARANCE_STATUSES}")

    try:
        # Get existing clearance
        existing = supabase.table("backlot_clearance_items").select("project_id").eq("id", clearance_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Clearance item not found")

        project_id = existing.data["project_id"]

        # Verify edit access
        project_response = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
        is_owner = project_response.data and project_response.data[0]["owner_id"] == user_id

        if not is_owner:
            member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
            if not member_response.data or member_response.data[0]["role"] not in ["admin", "editor"]:
                raise HTTPException(status_code=403, detail="You don't have permission to update clearances")

        update_data = {"status": status}

        # Auto-set signed_date when marking as signed
        if status == "signed":
            update_data["signed_date"] = datetime.utcnow().strftime("%Y-%m-%d")

        result = supabase.table("backlot_clearance_items").update(update_data).eq("id", clearance_id).execute()

        return {"success": True, "clearance": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating clearance status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CLEARANCE STATUS LOOKUPS (for Call Sheets and Locations)
# =============================================================================

@router.get("/projects/{project_id}/clearances/location/{location_id}")
async def get_location_clearances(
    project_id: str,
    location_id: str,
    authorization: str = Header(None)
):
    """Get all clearances for a specific location"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_clearance_items").select("*").eq("project_id", project_id).eq("type", "location_release").or_(f"related_location_id.eq.{location_id},related_project_location_id.eq.{location_id}").execute()

        # Get the best status
        status = "missing"
        if result.data:
            for item in result.data:
                if item["status"] == "signed":
                    # Check if not expired
                    exp_date = item.get("expiration_date")
                    if not exp_date or exp_date >= datetime.utcnow().strftime("%Y-%m-%d"):
                        status = "signed"
                        break
                elif item["status"] == "requested" and status != "signed":
                    status = "requested"
                elif item["status"] == "not_started" and status not in ["signed", "requested"]:
                    status = "not_started"

        return {
            "success": True,
            "clearances": result.data or [],
            "release_status": status,
            "has_signed_release": status == "signed"
        }

    except Exception as e:
        print(f"Error fetching location clearances: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/clearances/person/{person_id}")
async def get_person_clearances(
    project_id: str,
    person_id: str,
    release_type: Optional[str] = "talent_release",
    authorization: str = Header(None)
):
    """Get all clearances for a specific person"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_clearance_items").select("*").eq("project_id", project_id).eq("related_person_id", person_id)

        if release_type:
            query = query.eq("type", release_type)

        result = query.execute()

        # Get the best status
        status = "missing"
        if result.data:
            for item in result.data:
                if item["status"] == "signed":
                    exp_date = item.get("expiration_date")
                    if not exp_date or exp_date >= datetime.utcnow().strftime("%Y-%m-%d"):
                        status = "signed"
                        break
                elif item["status"] == "requested" and status != "signed":
                    status = "requested"
                elif item["status"] == "not_started" and status not in ["signed", "requested"]:
                    status = "not_started"

        return {
            "success": True,
            "clearances": result.data or [],
            "release_status": status,
            "has_signed_release": status == "signed"
        }

    except Exception as e:
        print(f"Error fetching person clearances: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/clearances/bulk-status")
async def get_bulk_clearance_status(
    project_id: str,
    location_ids: Optional[List[str]] = Body(default=[]),
    person_ids: Optional[List[str]] = Body(default=[]),
    authorization: str = Header(None)
):
    """Get clearance status for multiple locations and people at once (for call sheets)"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = {
            "locations": {},
            "people": {}
        }

        # Get location clearances
        if location_ids:
            for loc_id in location_ids:
                loc_result = supabase.table("backlot_clearance_items").select("status, expiration_date").eq("project_id", project_id).eq("type", "location_release").or_(f"related_location_id.eq.{loc_id},related_project_location_id.eq.{loc_id}").execute()

                status = "missing"
                if loc_result.data:
                    for item in loc_result.data:
                        if item["status"] == "signed":
                            exp_date = item.get("expiration_date")
                            if not exp_date or exp_date >= datetime.utcnow().strftime("%Y-%m-%d"):
                                status = "signed"
                                break
                        elif item["status"] == "requested" and status != "signed":
                            status = "requested"
                        elif status == "missing":
                            status = item["status"]

                result["locations"][loc_id] = status

        # Get person clearances (talent releases)
        if person_ids:
            for person_id in person_ids:
                person_result = supabase.table("backlot_clearance_items").select("status, expiration_date").eq("project_id", project_id).eq("related_person_id", person_id).in_("type", ["talent_release", "appearance_release"]).execute()

                status = "missing"
                if person_result.data:
                    for item in person_result.data:
                        if item["status"] == "signed":
                            exp_date = item.get("expiration_date")
                            if not exp_date or exp_date >= datetime.utcnow().strftime("%Y-%m-%d"):
                                status = "signed"
                                break
                        elif item["status"] == "requested" and status != "signed":
                            status = "requested"
                        elif status == "missing":
                            status = item["status"]

                result["people"][person_id] = status

        return {"success": True, **result}

    except Exception as e:
        print(f"Error fetching bulk clearance status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CLEARANCE REPORT GENERATION
# =============================================================================

@router.get("/projects/{project_id}/clearances/report")
async def generate_clearance_report(
    project_id: str,
    format: Optional[str] = "json",  # json or csv
    authorization: str = Header(None)
):
    """Generate a comprehensive clearance report for delivery/sales"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    # Verify access
    project_response = supabase.table("backlot_projects").select("*").eq("id", project_id).single().execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_response.data
    is_owner = project["owner_id"] == user_id

    if not is_owner:
        member_response = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
        if not member_response.data:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Get all clearances
        clearances_result = supabase.table("backlot_clearance_items").select("*").eq("project_id", project_id).order("type").order("status").execute()
        clearances = clearances_result.data or []

        # Organize by type
        by_type = {}
        for c in clearances:
            t = c["type"]
            if t not in by_type:
                by_type[t] = []
            by_type[t].append(c)

        # Calculate statistics
        stats = {
            "total": len(clearances),
            "signed": len([c for c in clearances if c["status"] == "signed"]),
            "requested": len([c for c in clearances if c["status"] == "requested"]),
            "not_started": len([c for c in clearances if c["status"] == "not_started"]),
            "expired": len([c for c in clearances if c["status"] == "expired"]),
            "rejected": len([c for c in clearances if c["status"] == "rejected"]),
        }

        # Type-specific stats
        type_stats = {}
        for t in CLEARANCE_TYPES:
            items = by_type.get(t, [])
            type_stats[t] = {
                "total": len(items),
                "signed": len([c for c in items if c["status"] == "signed"]),
                "requested": len([c for c in items if c["status"] == "requested"]),
                "not_started": len([c for c in items if c["status"] == "not_started"]),
                "expired": len([c for c in items if c["status"] == "expired"]),
                "completion_rate": round(len([c for c in items if c["status"] == "signed"]) / len(items) * 100, 1) if items else 0
            }

        # Expiring soon (within 30 days)
        today = datetime.utcnow().strftime("%Y-%m-%d")
        thirty_days = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        expiring_soon = [
            c for c in clearances
            if c["status"] == "signed"
            and c.get("expiration_date")
            and c["expiration_date"] <= thirty_days
            and c["expiration_date"] >= today
        ]

        report = {
            "project": {
                "id": project["id"],
                "title": project["title"],
                "status": project["status"],
            },
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": user_id,
            "summary": {
                "overall_stats": stats,
                "completion_rate": round(stats["signed"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0,
                "by_type": type_stats,
                "expiring_soon_count": len(expiring_soon),
            },
            "clearances_by_type": by_type,
            "expiring_soon": expiring_soon,
            "issues": {
                "missing_files": [c for c in clearances if c["status"] == "signed" and not c.get("file_url")],
                "expired": [c for c in clearances if c["status"] == "expired"],
                "rejected": [c for c in clearances if c["status"] == "rejected"]
            }
        }

        if format == "csv":
            # Generate CSV format
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # Header
            writer.writerow([
                "Type", "Title", "Status", "Related Person", "Related Location",
                "Asset Label", "Requested Date", "Signed Date", "Expiration Date",
                "Has File", "Notes"
            ])

            # Data rows
            for c in clearances:
                writer.writerow([
                    c["type"],
                    c["title"],
                    c["status"],
                    c.get("related_person_name", ""),
                    c.get("related_location_id", ""),
                    c.get("related_asset_label", ""),
                    c.get("requested_date", ""),
                    c.get("signed_date", ""),
                    c.get("expiration_date", ""),
                    "Yes" if c.get("file_url") else "No",
                    c.get("notes", "")
                ])

            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=clearance_report_{project_id}.csv"}
            )

        return {"success": True, "report": report}

    except Exception as e:
        print(f"Error generating clearance report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CLEARANCE TEMPLATES
# =============================================================================

@router.get("/clearance-templates")
async def get_clearance_templates(
    type: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get available clearance templates (system + user's own)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_clearance_templates").select("*").or_(f"owner_user_id.is.null,owner_user_id.eq.{user_id}").eq("is_active", True)

        if type:
            query = query.eq("type", type)

        result = query.order("name").execute()

        return {"success": True, "templates": result.data or []}

    except Exception as e:
        print(f"Error fetching clearance templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SHOT LISTS & COVERAGE - MODELS
# =============================================================================

class SceneShotInput(BaseModel):
    """Input model for creating/updating a scene shot"""
    shot_number: str
    shot_type: str  # ECU, CU, MCU, MS, MLS, LS, WS, EWS, POV, OTS, INSERT, 2SHOT, GROUP, OTHER
    lens: Optional[str] = None
    camera_movement: Optional[str] = None
    description: Optional[str] = None
    est_time_minutes: Optional[float] = None
    priority: Optional[str] = None  # must_have, nice_to_have
    coverage_status: Optional[str] = "not_shot"
    notes: Optional[str] = None
    sort_order: Optional[int] = 0


class ShotImageInput(BaseModel):
    """Input model for shot images/storyboards"""
    image_url: str
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class CoverageUpdateInput(BaseModel):
    """Input for updating coverage status"""
    coverage_status: str  # not_shot, shot, alt_needed, dropped


class BulkCoverageUpdateInput(BaseModel):
    """Input for bulk updating coverage status"""
    shot_ids: List[str]
    coverage_status: str


# =============================================================================
# SHOT LIST CRUD ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/scenes/{scene_id}/shots")
async def get_scene_shots(
    project_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """Get all shots for a scene"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify scene belongs to project
        scene_check = supabase.table("backlot_scenes").select("id").eq("id", scene_id).eq("project_id", project_id).execute()
        if not scene_check.data:
            raise HTTPException(status_code=404, detail="Scene not found in project")

        # Get shots with images
        shots_result = supabase.table("backlot_scene_shots").select("*").eq("scene_id", scene_id).order("sort_order").order("shot_number").execute()

        shots = shots_result.data or []

        # Get images for all shots
        if shots:
            shot_ids = [s["id"] for s in shots]
            images_result = supabase.table("backlot_scene_shot_images").select("*").in_("scene_shot_id", shot_ids).order("sort_order").execute()
            images_by_shot = {}
            for img in (images_result.data or []):
                shot_id = img["scene_shot_id"]
                if shot_id not in images_by_shot:
                    images_by_shot[shot_id] = []
                images_by_shot[shot_id].append(img)

            for shot in shots:
                shot["images"] = images_by_shot.get(shot["id"], [])

        return {"success": True, "shots": shots}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching scene shots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/scenes/{scene_id}/shots")
async def create_scene_shot(
    project_id: str,
    scene_id: str,
    shot: SceneShotInput,
    authorization: str = Header(None)
):
    """Create a new shot for a scene"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        # Verify scene belongs to project
        scene_check = supabase.table("backlot_scenes").select("id").eq("id", scene_id).eq("project_id", project_id).execute()
        if not scene_check.data:
            raise HTTPException(status_code=404, detail="Scene not found in project")

        # Check for duplicate shot number
        existing = supabase.table("backlot_scene_shots").select("id").eq("scene_id", scene_id).eq("shot_number", shot.shot_number).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail=f"Shot number {shot.shot_number} already exists in this scene")

        # Create shot
        result = supabase.table("backlot_scene_shots").insert({
            "project_id": project_id,
            "scene_id": scene_id,
            "shot_number": shot.shot_number,
            "shot_type": shot.shot_type,
            "lens": shot.lens,
            "camera_movement": shot.camera_movement,
            "description": shot.description,
            "est_time_minutes": shot.est_time_minutes,
            "priority": shot.priority,
            "coverage_status": shot.coverage_status or "not_shot",
            "notes": shot.notes,
            "sort_order": shot.sort_order or 0,
            "created_by_user_id": user_id
        }).select().execute()

        return {"success": True, "shot": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating scene shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shots/{shot_id}")
async def get_shot(
    shot_id: str,
    authorization: str = Header(None)
):
    """Get a single shot by ID"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_scene_shots").select("*").eq("id", shot_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        shot = result.data[0]

        # Get images
        images_result = supabase.table("backlot_scene_shot_images").select("*").eq("scene_shot_id", shot_id).order("sort_order").execute()
        shot["images"] = images_result.data or []

        return {"success": True, "shot": shot}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/shots/{shot_id}")
async def update_shot(
    shot_id: str,
    shot: SceneShotInput,
    authorization: str = Header(None)
):
    """Update a shot"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Check shot exists
        existing = supabase.table("backlot_scene_shots").select("id, scene_id").eq("id", shot_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        scene_id = existing.data[0]["scene_id"]

        # Check for duplicate shot number (if changed)
        dupe_check = supabase.table("backlot_scene_shots").select("id").eq("scene_id", scene_id).eq("shot_number", shot.shot_number).neq("id", shot_id).execute()
        if dupe_check.data:
            raise HTTPException(status_code=400, detail=f"Shot number {shot.shot_number} already exists in this scene")

        update_data = {
            "shot_number": shot.shot_number,
            "shot_type": shot.shot_type,
            "lens": shot.lens,
            "camera_movement": shot.camera_movement,
            "description": shot.description,
            "est_time_minutes": shot.est_time_minutes,
            "priority": shot.priority,
            "notes": shot.notes,
            "sort_order": shot.sort_order or 0,
        }

        # Only update coverage_status if provided
        if shot.coverage_status:
            update_data["coverage_status"] = shot.coverage_status

        result = supabase.table("backlot_scene_shots").update(update_data).eq("id", shot_id).select().execute()

        return {"success": True, "shot": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/shots/{shot_id}")
async def delete_shot(
    shot_id: str,
    authorization: str = Header(None)
):
    """Delete a shot"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Check shot exists
        existing = supabase.table("backlot_scene_shots").select("id").eq("id", shot_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        # Delete (images will cascade)
        supabase.table("backlot_scene_shots").delete().eq("id", shot_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/shots/{shot_id}/reorder")
async def reorder_shot(
    shot_id: str,
    new_sort_order: int = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Update shot sort order"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_scene_shots").update({"sort_order": new_sort_order}).eq("id", shot_id).select().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        return {"success": True, "shot": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reordering shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SHOT IMAGES (STORYBOARDS) ENDPOINTS
# =============================================================================

@router.get("/shots/{shot_id}/images")
async def get_shot_images(
    shot_id: str,
    authorization: str = Header(None)
):
    """Get all images for a shot"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_scene_shot_images").select("*").eq("scene_shot_id", shot_id).order("sort_order").execute()

        return {"success": True, "images": result.data or []}

    except Exception as e:
        print(f"Error fetching shot images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/shots/{shot_id}/images")
async def add_shot_image(
    shot_id: str,
    image: ShotImageInput,
    authorization: str = Header(None)
):
    """Add an image to a shot"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify shot exists
        shot_check = supabase.table("backlot_scene_shots").select("id").eq("id", shot_id).execute()
        if not shot_check.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        result = supabase.table("backlot_scene_shot_images").insert({
            "scene_shot_id": shot_id,
            "image_url": image.image_url,
            "thumbnail_url": image.thumbnail_url,
            "description": image.description,
            "sort_order": image.sort_order or 0
        }).select().execute()

        return {"success": True, "image": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding shot image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/shot-images/{image_id}")
async def update_shot_image(
    image_id: str,
    image: ShotImageInput,
    authorization: str = Header(None)
):
    """Update a shot image"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_scene_shot_images").update({
            "image_url": image.image_url,
            "thumbnail_url": image.thumbnail_url,
            "description": image.description,
            "sort_order": image.sort_order or 0
        }).eq("id", image_id).select().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Image not found")

        return {"success": True, "image": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating shot image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/shot-images/{image_id}")
async def delete_shot_image(
    image_id: str,
    authorization: str = Header(None)
):
    """Delete a shot image"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        existing = supabase.table("backlot_scene_shot_images").select("id").eq("id", image_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Image not found")

        supabase.table("backlot_scene_shot_images").delete().eq("id", image_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting shot image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# COVERAGE TRACKING ENDPOINTS
# =============================================================================

@router.patch("/shots/{shot_id}/coverage")
async def update_shot_coverage(
    shot_id: str,
    coverage: CoverageUpdateInput,
    authorization: str = Header(None)
):
    """Update coverage status for a shot"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        update_data = {
            "coverage_status": coverage.coverage_status,
        }

        # Set covered_at and covered_by when marking as shot
        if coverage.coverage_status == "shot":
            update_data["covered_at"] = datetime.utcnow().isoformat()
            update_data["covered_by_user_id"] = user_id
        elif coverage.coverage_status == "not_shot":
            update_data["covered_at"] = None
            update_data["covered_by_user_id"] = None

        result = supabase.table("backlot_scene_shots").update(update_data).eq("id", shot_id).select().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        return {"success": True, "shot": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating coverage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/shots/bulk-coverage")
async def bulk_update_coverage(
    project_id: str,
    bulk_input: BulkCoverageUpdateInput,
    authorization: str = Header(None)
):
    """Bulk update coverage status for multiple shots"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    supabase = get_supabase_admin_client()

    try:
        update_data = {
            "coverage_status": bulk_input.coverage_status,
        }

        if bulk_input.coverage_status == "shot":
            update_data["covered_at"] = datetime.utcnow().isoformat()
            update_data["covered_by_user_id"] = user_id
        elif bulk_input.coverage_status == "not_shot":
            update_data["covered_at"] = None
            update_data["covered_by_user_id"] = None

        # Update all shots
        for shot_id in bulk_input.shot_ids:
            supabase.table("backlot_scene_shots").update(update_data).eq("id", shot_id).eq("project_id", project_id).execute()

        return {"success": True, "updated_count": len(bulk_input.shot_ids)}

    except Exception as e:
        print(f"Error bulk updating coverage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/shots")
async def get_project_shots(
    project_id: str,
    scene_id: Optional[str] = None,
    coverage_status: Optional[str] = None,
    priority: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all shots for a project, optionally filtered"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_scene_shots").select("*, scene:backlot_scenes(id, scene_number, setting, int_ext, time_of_day, description)").eq("project_id", project_id)

        if scene_id:
            query = query.eq("scene_id", scene_id)
        if coverage_status:
            query = query.eq("coverage_status", coverage_status)
        if priority:
            query = query.eq("priority", priority)

        result = query.order("scene_id").order("sort_order").order("shot_number").execute()

        shots = result.data or []

        # Get images for all shots
        if shots:
            shot_ids = [s["id"] for s in shots]
            images_result = supabase.table("backlot_scene_shot_images").select("*").in_("scene_shot_id", shot_ids).order("sort_order").execute()
            images_by_shot = {}
            for img in (images_result.data or []):
                shot_id = img["scene_shot_id"]
                if shot_id not in images_by_shot:
                    images_by_shot[shot_id] = []
                images_by_shot[shot_id].append(img)

            for shot in shots:
                shot["images"] = images_by_shot.get(shot["id"], [])

        return {"success": True, "shots": shots}

    except Exception as e:
        print(f"Error fetching project shots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/coverage/summary")
async def get_coverage_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """Get coverage summary for a project"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get all shots
        shots_result = supabase.table("backlot_scene_shots").select("id, scene_id, coverage_status, priority, est_time_minutes").eq("project_id", project_id).execute()
        shots = shots_result.data or []

        # Calculate summary
        total_shots = len(shots)
        shot_count = len([s for s in shots if s["coverage_status"] == "shot"])
        not_shot_count = len([s for s in shots if s["coverage_status"] == "not_shot"])
        alt_needed_count = len([s for s in shots if s["coverage_status"] == "alt_needed"])
        dropped_count = len([s for s in shots if s["coverage_status"] == "dropped"])

        must_have_total = len([s for s in shots if s["priority"] == "must_have"])
        must_have_shot = len([s for s in shots if s["priority"] == "must_have" and s["coverage_status"] == "shot"])

        est_total = sum([s["est_time_minutes"] or 0 for s in shots])
        est_remaining = sum([s["est_time_minutes"] or 0 for s in shots if s["coverage_status"] == "not_shot"])

        # Get unique scenes
        unique_scenes = set([s["scene_id"] for s in shots])

        summary = {
            "total_scenes": len(unique_scenes),
            "total_shots": total_shots,
            "shot": shot_count,
            "not_shot": not_shot_count,
            "alt_needed": alt_needed_count,
            "dropped": dropped_count,
            "coverage_percentage": round(100.0 * shot_count / total_shots, 1) if total_shots > 0 else 0,
            "must_have_total": must_have_total,
            "must_have_shot": must_have_shot,
            "must_have_coverage": round(100.0 * must_have_shot / must_have_total, 1) if must_have_total > 0 else 100,
            "est_total_minutes": est_total,
            "est_remaining_minutes": est_remaining,
        }

        return {"success": True, "summary": summary}

    except Exception as e:
        print(f"Error fetching coverage summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/coverage/by-scene")
async def get_coverage_by_scene(
    project_id: str,
    authorization: str = Header(None)
):
    """Get coverage breakdown by scene"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get scenes with shot counts
        scenes_result = supabase.table("backlot_scenes").select("id, scene_number, setting, int_ext, time_of_day, description").eq("project_id", project_id).order("scene_number").execute()
        scenes = scenes_result.data or []

        # Get all shots grouped by scene
        shots_result = supabase.table("backlot_scene_shots").select("id, scene_id, coverage_status, priority").eq("project_id", project_id).execute()
        shots = shots_result.data or []

        # Group shots by scene
        shots_by_scene = {}
        for shot in shots:
            scene_id = shot["scene_id"]
            if scene_id not in shots_by_scene:
                shots_by_scene[scene_id] = []
            shots_by_scene[scene_id].append(shot)

        # Build scene coverage data
        scene_coverage = []
        for scene in scenes:
            scene_shots = shots_by_scene.get(scene["id"], [])
            total = len(scene_shots)
            shot_count = len([s for s in scene_shots if s["coverage_status"] == "shot"])
            not_shot_count = len([s for s in scene_shots if s["coverage_status"] == "not_shot"])
            alt_needed_count = len([s for s in scene_shots if s["coverage_status"] == "alt_needed"])

            scene_coverage.append({
                "scene": scene,
                "total_shots": total,
                "shot": shot_count,
                "not_shot": not_shot_count,
                "alt_needed": alt_needed_count,
                "coverage_percentage": round(100.0 * shot_count / total, 1) if total > 0 else 0,
            })

        return {"success": True, "scenes": scene_coverage}

    except Exception as e:
        print(f"Error fetching coverage by scene: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/coverage/report")
async def get_coverage_report(
    project_id: str,
    format: str = "json",
    authorization: str = Header(None)
):
    """Generate a coverage report for the project"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get scenes
        scenes_result = supabase.table("backlot_scenes").select("id, scene_number, setting, int_ext, time_of_day, description").eq("project_id", project_id).order("scene_number").execute()
        scenes = scenes_result.data or []
        scenes_map = {s["id"]: s for s in scenes}

        # Get all shots
        shots_result = supabase.table("backlot_scene_shots").select("*").eq("project_id", project_id).order("scene_id").order("sort_order").execute()
        shots = shots_result.data or []

        # Build report
        report = []
        for shot in shots:
            scene = scenes_map.get(shot["scene_id"], {})
            report.append({
                "scene_number": scene.get("scene_number", ""),
                "scene_setting": scene.get("setting", ""),
                "shot_number": shot["shot_number"],
                "shot_type": shot["shot_type"],
                "lens": shot.get("lens", ""),
                "camera_movement": shot.get("camera_movement", ""),
                "description": shot.get("description", ""),
                "priority": shot.get("priority", ""),
                "coverage_status": shot["coverage_status"],
                "est_time_minutes": shot.get("est_time_minutes"),
                "notes": shot.get("notes", ""),
            })

        if format == "csv":
            import csv
            import io
            output = io.StringIO()
            if report:
                writer = csv.DictWriter(output, fieldnames=report[0].keys())
                writer.writeheader()
                writer.writerows(report)
            csv_content = output.getvalue()
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=coverage_report_{project_id}.csv"}
            )

        return {"success": True, "report": report}

    except Exception as e:
        print(f"Error generating coverage report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# AI CO-PILOT COVERAGE SUMMARY ENDPOINT
# =============================================================================

@router.post("/projects/{project_id}/coverage/summary-for-ai")
async def get_coverage_summary_for_ai(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get structured coverage summary for AI Co-Pilot consumption.
    Returns scenes, shot coverage status, and notes for editing strategy suggestions.
    """
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get project info
        project_result = supabase.table("backlot_projects").select("id, title, logline, status").eq("id", project_id).execute()
        project = project_result.data[0] if project_result.data else None

        # Get scenes with descriptions
        scenes_result = supabase.table("backlot_scenes").select(
            "id, scene_number, setting, int_ext, time_of_day, description, page_count"
        ).eq("project_id", project_id).order("scene_number").execute()
        scenes = scenes_result.data or []

        # Get all shots
        shots_result = supabase.table("backlot_scene_shots").select(
            "id, scene_id, shot_number, shot_type, description, coverage_status, priority, notes"
        ).eq("project_id", project_id).execute()
        shots = shots_result.data or []

        # Group shots by scene
        shots_by_scene = {}
        for shot in shots:
            scene_id = shot["scene_id"]
            if scene_id not in shots_by_scene:
                shots_by_scene[scene_id] = []
            shots_by_scene[scene_id].append(shot)

        # Build AI-friendly summary
        scenes_summary = []
        for scene in scenes:
            scene_shots = shots_by_scene.get(scene["id"], [])

            shot_summary = {
                "total": len(scene_shots),
                "shot": len([s for s in scene_shots if s["coverage_status"] == "shot"]),
                "not_shot": len([s for s in scene_shots if s["coverage_status"] == "not_shot"]),
                "alt_needed": len([s for s in scene_shots if s["coverage_status"] == "alt_needed"]),
                "dropped": len([s for s in scene_shots if s["coverage_status"] == "dropped"]),
            }

            # Get shots needing attention (not_shot or alt_needed)
            attention_shots = [
                {
                    "shot_number": s["shot_number"],
                    "shot_type": s["shot_type"],
                    "status": s["coverage_status"],
                    "priority": s.get("priority"),
                    "notes": s.get("notes"),
                }
                for s in scene_shots
                if s["coverage_status"] in ("not_shot", "alt_needed")
            ]

            scenes_summary.append({
                "scene_number": scene["scene_number"],
                "setting": scene.get("setting", ""),
                "int_ext": scene.get("int_ext", ""),
                "time_of_day": scene.get("time_of_day", ""),
                "description": scene.get("description", ""),
                "page_count": scene.get("page_count"),
                "coverage": shot_summary,
                "shots_needing_attention": attention_shots,
            })

        # Calculate overall stats
        total_shots = len(shots)
        shot_count = len([s for s in shots if s["coverage_status"] == "shot"])
        coverage_pct = round(100.0 * shot_count / total_shots, 1) if total_shots > 0 else 0

        ai_summary = {
            "project": {
                "id": project["id"] if project else project_id,
                "title": project["title"] if project else "",
                "logline": project.get("logline", "") if project else "",
            },
            "overall_coverage": {
                "total_scenes_with_shots": len([s for s in scenes_summary if s["coverage"]["total"] > 0]),
                "total_shots": total_shots,
                "shots_completed": shot_count,
                "shots_not_shot": len([s for s in shots if s["coverage_status"] == "not_shot"]),
                "shots_alt_needed": len([s for s in shots if s["coverage_status"] == "alt_needed"]),
                "coverage_percentage": coverage_pct,
            },
            "scenes": scenes_summary,
            "notes_summary": {
                "alt_needed_count": len([s for s in shots if s["coverage_status"] == "alt_needed"]),
                "alt_needed_notes": [
                    {"scene_id": s["scene_id"], "shot": s["shot_number"], "notes": s["notes"]}
                    for s in shots
                    if s["coverage_status"] == "alt_needed" and s.get("notes")
                ],
            },
        }

        return {"success": True, "ai_summary": ai_summary}

    except Exception as e:
        print(f"Error generating AI coverage summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CALL SHEET SCENE SHOTS - Get shots for scenes in a call sheet
# =============================================================================

@router.get("/call-sheets/{call_sheet_id}/shots")
async def get_call_sheet_shots(
    call_sheet_id: str,
    authorization: str = Header(None)
):
    """Get all shots for scenes linked to a call sheet"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get call sheet
        cs_result = supabase.table("backlot_call_sheets").select("id, project_id").eq("id", call_sheet_id).execute()
        if not cs_result.data:
            raise HTTPException(status_code=404, detail="Call sheet not found")

        project_id = cs_result.data[0]["project_id"]

        # Get scene links for this call sheet
        links_result = supabase.table("backlot_call_sheet_scene_links").select("scene_id").eq("call_sheet_id", call_sheet_id).execute()
        scene_ids = [l["scene_id"] for l in (links_result.data or [])]

        if not scene_ids:
            return {"success": True, "scenes_with_shots": []}

        # Get scenes
        scenes_result = supabase.table("backlot_scenes").select("id, scene_number, setting, int_ext, time_of_day, description").in_("id", scene_ids).order("scene_number").execute()
        scenes = scenes_result.data or []

        # Get shots for these scenes
        shots_result = supabase.table("backlot_scene_shots").select("*").in_("scene_id", scene_ids).order("sort_order").order("shot_number").execute()
        shots = shots_result.data or []

        # Group shots by scene
        shots_by_scene = {}
        for shot in shots:
            scene_id = shot["scene_id"]
            if scene_id not in shots_by_scene:
                shots_by_scene[scene_id] = []
            shots_by_scene[scene_id].append(shot)

        # Build response
        scenes_with_shots = []
        for scene in scenes:
            scene_shots = shots_by_scene.get(scene["id"], [])
            scenes_with_shots.append({
                "scene": scene,
                "shots": scene_shots,
                "coverage": {
                    "total": len(scene_shots),
                    "shot": len([s for s in scene_shots if s["coverage_status"] == "shot"]),
                    "not_shot": len([s for s in scene_shots if s["coverage_status"] == "not_shot"]),
                    "alt_needed": len([s for s in scene_shots if s["coverage_status"] == "alt_needed"]),
                }
            })

        return {"success": True, "scenes_with_shots": scenes_with_shots}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching call sheet shots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/scenes/{scene_id}/next-shot-number")
async def get_next_shot_number(
    project_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """Get suggested next shot number for a scene"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get existing shot numbers
        shots_result = supabase.table("backlot_scene_shots").select("shot_number").eq("scene_id", scene_id).execute()
        shots = shots_result.data or []

        if not shots:
            return {"success": True, "next_shot_number": "1"}

        # Try to find max numeric value
        max_num = 0
        for shot in shots:
            num_str = shot["shot_number"]
            # Extract leading number
            import re
            match = re.match(r'^(\d+)', num_str)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num

        return {"success": True, "next_shot_number": str(max_num + 1)}

    except Exception as e:
        print(f"Error getting next shot number: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ASSETS, MEDIA, AND DELIVERABLES
# =============================================================================

class AssetInput(BaseModel):
    asset_type: str  # episode, feature, trailer, teaser, social, bts, other
    title: str
    description: Optional[str] = None
    duration_seconds: Optional[int] = None
    version_label: Optional[str] = None
    file_reference: Optional[str] = None
    status: Optional[str] = "not_started"
    sort_order: Optional[int] = None


class DeliverableTemplateInput(BaseModel):
    name: str
    description: Optional[str] = None
    target_platform: str
    specs: Optional[Dict[str, Any]] = None


class ProjectDeliverableInput(BaseModel):
    asset_id: str
    template_id: str
    status: Optional[str] = "not_started"
    due_date: Optional[str] = None
    delivered_date: Optional[str] = None
    reviewer_name: Optional[str] = None
    notes: Optional[str] = None
    custom_specs: Optional[Dict[str, Any]] = None


# -----------------------------------------------------------------------------
# ASSETS ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/projects/{project_id}/assets")
async def get_project_assets(
    project_id: str,
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all assets for a project"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_assets").select("*").eq("project_id", project_id).order("sort_order", desc=False).order("created_at", desc=True)

        if asset_type:
            query = query.eq("asset_type", asset_type)
        if status:
            query = query.eq("status", status)

        result = query.execute()

        return {"success": True, "assets": result.data or []}

    except Exception as e:
        print(f"Error fetching assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/assets")
async def create_asset(
    project_id: str,
    asset_input: AssetInput,
    authorization: str = Header(None)
):
    """Create a new asset"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Validate asset_type
        valid_types = ["episode", "feature", "trailer", "teaser", "social", "bts", "other"]
        if asset_input.asset_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid asset_type. Must be one of: {valid_types}")

        # Validate status
        valid_statuses = ["not_started", "in_progress", "in_review", "approved", "delivered"]
        if asset_input.status and asset_input.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        # Get next sort order
        sort_order = asset_input.sort_order
        if sort_order is None:
            max_result = supabase.table("backlot_assets").select("sort_order").eq("project_id", project_id).order("sort_order", desc=True).limit(1).execute()
            if max_result.data:
                sort_order = (max_result.data[0].get("sort_order") or 0) + 1
            else:
                sort_order = 0

        insert_data = {
            "project_id": project_id,
            "asset_type": asset_input.asset_type,
            "title": asset_input.title,
            "description": asset_input.description,
            "duration_seconds": asset_input.duration_seconds,
            "version_label": asset_input.version_label,
            "file_reference": asset_input.file_reference,
            "status": asset_input.status or "not_started",
            "sort_order": sort_order,
            "created_by_user_id": user["id"],
        }

        result = supabase.table("backlot_assets").insert(insert_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create asset")

        return {"success": True, "asset": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assets/{asset_id}")
async def get_asset(
    asset_id: str,
    authorization: str = Header(None)
):
    """Get a single asset"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_assets").select("*").eq("id", asset_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Asset not found")

        return {"success": True, "asset": result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/assets/{asset_id}")
async def update_asset(
    asset_id: str,
    asset_input: AssetInput,
    authorization: str = Header(None)
):
    """Update an asset"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Validate asset_type
        valid_types = ["episode", "feature", "trailer", "teaser", "social", "bts", "other"]
        if asset_input.asset_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid asset_type. Must be one of: {valid_types}")

        # Validate status
        valid_statuses = ["not_started", "in_progress", "in_review", "approved", "delivered"]
        if asset_input.status and asset_input.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        update_data = {
            "asset_type": asset_input.asset_type,
            "title": asset_input.title,
            "description": asset_input.description,
            "duration_seconds": asset_input.duration_seconds,
            "version_label": asset_input.version_label,
            "file_reference": asset_input.file_reference,
            "status": asset_input.status,
        }

        if asset_input.sort_order is not None:
            update_data["sort_order"] = asset_input.sort_order

        result = supabase.table("backlot_assets").update(update_data).eq("id", asset_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Asset not found")

        return {"success": True, "asset": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/assets/{asset_id}/status")
async def update_asset_status(
    asset_id: str,
    status: str = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Update asset status only"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        valid_statuses = ["not_started", "in_progress", "in_review", "approved", "delivered"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        result = supabase.table("backlot_assets").update({"status": status}).eq("id", asset_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Asset not found")

        return {"success": True, "asset": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating asset status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assets/{asset_id}")
async def delete_asset(
    asset_id: str,
    authorization: str = Header(None)
):
    """Delete an asset"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Delete associated deliverables first
        supabase.table("backlot_project_deliverables").delete().eq("asset_id", asset_id).execute()

        # Delete the asset
        result = supabase.table("backlot_assets").delete().eq("id", asset_id).execute()

        return {"success": True, "deleted": True}

    except Exception as e:
        print(f"Error deleting asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/assets/summary")
async def get_assets_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """Get assets summary for a project"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_assets").select("asset_type, status").eq("project_id", project_id).execute()
        assets = result.data or []

        summary = {
            "total": len(assets),
            "by_type": {
                "episode": 0, "feature": 0, "trailer": 0, "teaser": 0,
                "social": 0, "bts": 0, "other": 0
            },
            "by_status": {
                "not_started": 0, "in_progress": 0, "in_review": 0,
                "approved": 0, "delivered": 0
            }
        }

        for asset in assets:
            if asset.get("asset_type") in summary["by_type"]:
                summary["by_type"][asset["asset_type"]] += 1
            if asset.get("status") in summary["by_status"]:
                summary["by_status"][asset["status"]] += 1

        return {"success": True, "summary": summary}

    except Exception as e:
        print(f"Error fetching assets summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# DELIVERABLE TEMPLATES ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/deliverable-templates")
async def get_deliverable_templates(
    platform: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all deliverable templates (system + user's own)"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get system templates and user's own templates
        query = supabase.table("backlot_deliverable_templates").select("*").eq("is_active", True).or_(f"is_system_template.eq.true,owner_user_id.eq.{user['id']},owner_user_id.is.null").order("target_platform", desc=False).order("name", desc=False)

        if platform:
            query = query.eq("target_platform", platform)

        result = query.execute()

        return {"success": True, "templates": result.data or []}

    except Exception as e:
        print(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deliverable-templates")
async def create_deliverable_template(
    template_input: DeliverableTemplateInput,
    authorization: str = Header(None)
):
    """Create a custom deliverable template"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        insert_data = {
            "name": template_input.name,
            "description": template_input.description,
            "target_platform": template_input.target_platform,
            "specs": template_input.specs or {},
            "is_system_template": False,
            "owner_user_id": user["id"],
        }

        result = supabase.table("backlot_deliverable_templates").insert(insert_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create template")

        return {"success": True, "template": result.data[0]}

    except Exception as e:
        print(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deliverable-templates/{template_id}")
async def get_deliverable_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Get a single deliverable template"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_deliverable_templates").select("*").eq("id", template_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"success": True, "template": result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/deliverable-templates/{template_id}")
async def update_deliverable_template(
    template_id: str,
    template_input: DeliverableTemplateInput,
    authorization: str = Header(None)
):
    """Update a custom deliverable template"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Check ownership
        existing = supabase.table("backlot_deliverable_templates").select("owner_user_id, is_system_template").eq("id", template_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")

        if existing.data.get("is_system_template"):
            raise HTTPException(status_code=403, detail="Cannot modify system templates")

        if existing.data.get("owner_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to modify this template")

        update_data = {
            "name": template_input.name,
            "description": template_input.description,
            "target_platform": template_input.target_platform,
            "specs": template_input.specs or {},
        }

        result = supabase.table("backlot_deliverable_templates").update(update_data).eq("id", template_id).execute()

        return {"success": True, "template": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deliverable-templates/{template_id}")
async def delete_deliverable_template(
    template_id: str,
    authorization: str = Header(None)
):
    """Delete a custom deliverable template"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Check ownership
        existing = supabase.table("backlot_deliverable_templates").select("owner_user_id, is_system_template").eq("id", template_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Template not found")

        if existing.data.get("is_system_template"):
            raise HTTPException(status_code=403, detail="Cannot delete system templates")

        if existing.data.get("owner_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this template")

        # Soft delete - just mark as inactive
        result = supabase.table("backlot_deliverable_templates").update({"is_active": False}).eq("id", template_id).execute()

        return {"success": True, "deleted": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deliverable-templates/platforms/list")
async def get_platforms_list(
    authorization: str = Header(None)
):
    """Get list of unique platforms from templates"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_deliverable_templates").select("target_platform").eq("is_active", True).execute()

        platforms = list(set([t["target_platform"] for t in (result.data or [])]))
        platforms.sort()

        return {"success": True, "platforms": platforms}

    except Exception as e:
        print(f"Error fetching platforms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# PROJECT DELIVERABLES ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/projects/{project_id}/deliverables")
async def get_project_deliverables(
    project_id: str,
    asset_id: Optional[str] = None,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get all deliverables for a project"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        query = supabase.table("backlot_project_deliverables").select("*, asset:backlot_assets(id, title, asset_type, version_label, status), template:backlot_deliverable_templates(id, name, target_platform, specs)").eq("project_id", project_id).order("due_date", desc=False, nullsfirst=False).order("created_at", desc=True)

        if asset_id:
            query = query.eq("asset_id", asset_id)
        if status:
            query = query.eq("status", status)

        result = query.execute()

        return {"success": True, "deliverables": result.data or []}

    except Exception as e:
        print(f"Error fetching deliverables: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/deliverables")
async def create_project_deliverable(
    project_id: str,
    deliverable_input: ProjectDeliverableInput,
    authorization: str = Header(None)
):
    """Create a new deliverable for an asset"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Validate status
        valid_statuses = ["not_started", "in_progress", "in_review", "approved", "delivered"]
        if deliverable_input.status and deliverable_input.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        # Verify asset belongs to project
        asset_check = supabase.table("backlot_assets").select("id").eq("id", deliverable_input.asset_id).eq("project_id", project_id).execute()
        if not asset_check.data:
            raise HTTPException(status_code=400, detail="Asset not found in project")

        # Verify template exists
        template_check = supabase.table("backlot_deliverable_templates").select("id").eq("id", deliverable_input.template_id).execute()
        if not template_check.data:
            raise HTTPException(status_code=400, detail="Template not found")

        insert_data = {
            "project_id": project_id,
            "asset_id": deliverable_input.asset_id,
            "template_id": deliverable_input.template_id,
            "status": deliverable_input.status or "not_started",
            "due_date": deliverable_input.due_date,
            "delivered_date": deliverable_input.delivered_date,
            "reviewer_name": deliverable_input.reviewer_name,
            "notes": deliverable_input.notes,
            "custom_specs": deliverable_input.custom_specs,
            "created_by_user_id": user["id"],
        }

        result = supabase.table("backlot_project_deliverables").insert(insert_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create deliverable")

        # Fetch with relations
        full_result = supabase.table("backlot_project_deliverables").select("*, asset:backlot_assets(id, title, asset_type, version_label, status), template:backlot_deliverable_templates(id, name, target_platform, specs)").eq("id", result.data[0]["id"]).single().execute()

        return {"success": True, "deliverable": full_result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating deliverable: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deliverables/{deliverable_id}")
async def get_deliverable(
    deliverable_id: str,
    authorization: str = Header(None)
):
    """Get a single deliverable"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_project_deliverables").select("*, asset:backlot_assets(id, title, asset_type, version_label, status), template:backlot_deliverable_templates(id, name, target_platform, specs)").eq("id", deliverable_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Deliverable not found")

        return {"success": True, "deliverable": result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching deliverable: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/deliverables/{deliverable_id}")
async def update_deliverable(
    deliverable_id: str,
    deliverable_input: ProjectDeliverableInput,
    authorization: str = Header(None)
):
    """Update a deliverable"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Validate status
        valid_statuses = ["not_started", "in_progress", "in_review", "approved", "delivered"]
        if deliverable_input.status and deliverable_input.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        update_data = {
            "status": deliverable_input.status,
            "due_date": deliverable_input.due_date,
            "delivered_date": deliverable_input.delivered_date,
            "reviewer_name": deliverable_input.reviewer_name,
            "notes": deliverable_input.notes,
            "custom_specs": deliverable_input.custom_specs,
        }

        result = supabase.table("backlot_project_deliverables").update(update_data).eq("id", deliverable_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Deliverable not found")

        # Fetch with relations
        full_result = supabase.table("backlot_project_deliverables").select("*, asset:backlot_assets(id, title, asset_type, version_label, status), template:backlot_deliverable_templates(id, name, target_platform, specs)").eq("id", deliverable_id).single().execute()

        return {"success": True, "deliverable": full_result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating deliverable: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/deliverables/{deliverable_id}/status")
async def update_deliverable_status(
    deliverable_id: str,
    status: str = Body(..., embed=True),
    delivered_date: Optional[str] = Body(None, embed=True),
    authorization: str = Header(None)
):
    """Update deliverable status"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        valid_statuses = ["not_started", "in_progress", "in_review", "approved", "delivered"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        update_data = {"status": status}

        # Auto-set delivered_date if marking as delivered
        if status == "delivered":
            if delivered_date:
                update_data["delivered_date"] = delivered_date
            else:
                from datetime import date
                update_data["delivered_date"] = date.today().isoformat()

        result = supabase.table("backlot_project_deliverables").update(update_data).eq("id", deliverable_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Deliverable not found")

        return {"success": True, "deliverable": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating deliverable status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deliverables/{deliverable_id}")
async def delete_deliverable(
    deliverable_id: str,
    authorization: str = Header(None)
):
    """Delete a deliverable"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        result = supabase.table("backlot_project_deliverables").delete().eq("id", deliverable_id).execute()

        return {"success": True, "deleted": True}

    except Exception as e:
        print(f"Error deleting deliverable: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/deliverables/summary")
async def get_deliverables_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """Get deliverables summary for a project"""
    await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        from datetime import date

        # Get all deliverables
        result = supabase.table("backlot_project_deliverables").select("id, status, due_date, asset:backlot_assets(title), template:backlot_deliverable_templates(name)").eq("project_id", project_id).execute()
        deliverables = result.data or []

        # Get asset count
        assets_result = supabase.table("backlot_assets").select("id").eq("project_id", project_id).execute()

        summary = {
            "total_assets": len(assets_result.data or []),
            "total_deliverables": len(deliverables),
            "by_status": {
                "not_started": 0, "in_progress": 0, "in_review": 0,
                "approved": 0, "delivered": 0
            },
            "delivered_count": 0,
            "overdue_count": 0,
            "upcoming_deadlines": []
        }

        today = date.today().isoformat()

        for d in deliverables:
            status = d.get("status", "not_started")
            if status in summary["by_status"]:
                summary["by_status"][status] += 1

            if status == "delivered":
                summary["delivered_count"] += 1

            # Check overdue
            if d.get("due_date") and d["due_date"] < today and status not in ["delivered", "approved"]:
                summary["overdue_count"] += 1

            # Upcoming deadlines
            if d.get("due_date") and d["due_date"] >= today and status not in ["delivered", "approved"]:
                summary["upcoming_deadlines"].append({
                    "id": d["id"],
                    "asset_title": d.get("asset", {}).get("title") if d.get("asset") else None,
                    "template_name": d.get("template", {}).get("name") if d.get("template") else None,
                    "due_date": d["due_date"],
                    "status": status
                })

        # Sort upcoming deadlines by due date
        summary["upcoming_deadlines"] = sorted(summary["upcoming_deadlines"], key=lambda x: x["due_date"])[:5]

        return {"success": True, "summary": summary}

    except Exception as e:
        print(f"Error fetching deliverables summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assets/{asset_id}/deliverables/bulk")
async def bulk_create_deliverables(
    asset_id: str,
    template_ids: List[str] = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Bulk create deliverables for an asset from multiple templates"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get asset to verify it exists and get project_id
        asset_result = supabase.table("backlot_assets").select("id, project_id").eq("id", asset_id).single().execute()
        if not asset_result.data:
            raise HTTPException(status_code=404, detail="Asset not found")

        project_id = asset_result.data["project_id"]

        # Create deliverables for each template
        created = []
        for template_id in template_ids:
            try:
                insert_data = {
                    "project_id": project_id,
                    "asset_id": asset_id,
                    "template_id": template_id,
                    "status": "not_started",
                    "created_by_user_id": user["id"],
                }
                result = supabase.table("backlot_project_deliverables").insert(insert_data).execute()
                if result.data:
                    created.append(result.data[0])
            except Exception as e:
                # Skip duplicates silently
                print(f"Skipping template {template_id}: {e}")
                continue

        return {"success": True, "created_count": len(created), "deliverables": created}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error bulk creating deliverables: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# PRODUCER ANALYTICS (READ-ONLY)
# =====================================================

@router.get("/projects/{project_id}/analytics/cost-by-department")
async def get_cost_by_department_analytics(
    project_id: str,
    authorization: str = Header(None)
):
    """
    READ-ONLY: Get cost vs budget breakdown by department/category.
    Reads from budget categories and line items - no modifications.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify user has access to project (producer/admin only)
        member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user["id"]).single().execute()
        if not member_result.data or member_result.data["role"] not in ["owner", "producer", "admin"]:
            raise HTTPException(status_code=403, detail="Analytics access requires producer or admin role")

        # Get the active budget for the project
        budget_result = supabase.table("backlot_budgets").select("id, name, estimated_total, actual_total, variance").eq("project_id", project_id).eq("status", "approved").limit(1).execute()

        if not budget_result.data:
            # Try to get any budget if no approved one
            budget_result = supabase.table("backlot_budgets").select("id, name, estimated_total, actual_total, variance").eq("project_id", project_id).order("created_at", desc=True).limit(1).execute()

        if not budget_result.data:
            return {
                "success": True,
                "has_budget": False,
                "departments": [],
                "totals": {"budgeted": 0, "actual": 0, "variance": 0}
            }

        budget = budget_result.data[0]
        budget_id = budget["id"]

        # Get categories with their line items aggregated
        categories_result = supabase.table("backlot_budget_categories").select(
            "id, name, category_type, account_code_prefix, estimated_total, actual_total"
        ).eq("budget_id", budget_id).order("sort_order").execute()

        departments = []
        for cat in (categories_result.data or []):
            # Get line items for this category to sum by department
            items_result = supabase.table("backlot_budget_line_items").select(
                "department, estimated_total, actual_total"
            ).eq("category_id", cat["id"]).execute()

            # Group by department within category
            dept_totals = {}
            for item in (items_result.data or []):
                dept = item.get("department") or cat["name"]
                if dept not in dept_totals:
                    dept_totals[dept] = {"budgeted": 0, "actual": 0}
                dept_totals[dept]["budgeted"] += float(item.get("estimated_total") or 0)
                dept_totals[dept]["actual"] += float(item.get("actual_total") or 0)

            # If no items, use category totals
            if not dept_totals:
                dept_totals[cat["name"]] = {
                    "budgeted": float(cat.get("estimated_total") or 0),
                    "actual": float(cat.get("actual_total") or 0)
                }

            for dept_name, totals in dept_totals.items():
                departments.append({
                    "department": dept_name,
                    "category_type": cat.get("category_type", "other"),
                    "budgeted_amount": totals["budgeted"],
                    "actual_amount": totals["actual"],
                    "variance": totals["actual"] - totals["budgeted"],
                    "variance_percent": round((totals["actual"] - totals["budgeted"]) / totals["budgeted"] * 100, 1) if totals["budgeted"] > 0 else 0
                })

        # Sort by budgeted amount descending
        departments.sort(key=lambda x: x["budgeted_amount"], reverse=True)

        return {
            "success": True,
            "has_budget": True,
            "budget_name": budget["name"],
            "departments": departments,
            "totals": {
                "budgeted": float(budget.get("estimated_total") or 0),
                "actual": float(budget.get("actual_total") or 0),
                "variance": float(budget.get("variance") or 0)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching cost analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/analytics/time-and-schedule")
async def get_time_schedule_analytics(
    project_id: str,
    authorization: str = Header(None)
):
    """
    READ-ONLY: Get schedule health metrics - pages planned vs shot over time.
    Reads from scenes, call sheets, and production days - no modifications.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify user has access to project
        member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user["id"]).single().execute()
        if not member_result.data or member_result.data["role"] not in ["owner", "producer", "admin"]:
            raise HTTPException(status_code=403, detail="Analytics access requires producer or admin role")

        # Get all scenes with page counts and coverage status
        scenes_result = supabase.table("backlot_scenes").select(
            "id, scene_number, page_count, coverage_status, is_omitted"
        ).eq("project_id", project_id).eq("is_omitted", False).execute()

        scenes = scenes_result.data or []

        # Calculate total pages
        total_pages = 0
        pages_by_status = {"not_scheduled": 0, "scheduled": 0, "shot": 0, "needs_pickup": 0}

        for scene in scenes:
            try:
                page_count = float(scene.get("page_count") or 0)
            except (ValueError, TypeError):
                page_count = 0
            total_pages += page_count
            status = scene.get("coverage_status", "not_scheduled")
            if status in pages_by_status:
                pages_by_status[status] += page_count

        # Get production days with dates
        prod_days_result = supabase.table("backlot_production_days").select(
            "id, day_number, date, is_completed"
        ).eq("project_id", project_id).order("day_number").execute()

        production_days = prod_days_result.data or []
        total_shoot_days = len(production_days)
        completed_days = sum(1 for d in production_days if d.get("is_completed"))

        # Get call sheet scenes to calculate pages per day
        daily_data = []
        cumulative_planned = 0
        cumulative_shot = 0

        for day in production_days:
            # Get scenes linked to this day's call sheet
            cs_result = supabase.table("backlot_call_sheets").select("id").eq("production_day_id", day["id"]).limit(1).execute()

            pages_planned = 0
            pages_shot = 0

            if cs_result.data:
                call_sheet_id = cs_result.data[0]["id"]

                # Get scene links for this call sheet
                links_result = supabase.table("backlot_call_sheet_scene_links").select(
                    "scene_id, status"
                ).eq("call_sheet_id", call_sheet_id).execute()

                for link in (links_result.data or []):
                    # Find the scene's page count
                    scene = next((s for s in scenes if s["id"] == link["scene_id"]), None)
                    if scene:
                        try:
                            pc = float(scene.get("page_count") or 0)
                        except:
                            pc = 0
                        pages_planned += pc
                        if link.get("status") == "completed":
                            pages_shot += pc

            cumulative_planned += pages_planned
            cumulative_shot += pages_shot

            daily_data.append({
                "day_number": day["day_number"],
                "date": day.get("date"),
                "is_completed": day.get("is_completed", False),
                "pages_planned": round(pages_planned, 2),
                "pages_shot": round(pages_shot, 2),
                "cumulative_planned": round(cumulative_planned, 2),
                "cumulative_shot": round(cumulative_shot, 2)
            })

        # Calculate schedule health
        pages_shot = pages_by_status["shot"]
        pages_scheduled = pages_by_status["scheduled"] + pages_by_status["shot"]

        # Determine schedule status
        if total_shoot_days == 0:
            schedule_status = "not_started"
            progress_percent = 0
        else:
            progress_percent = round((pages_shot / total_pages * 100) if total_pages > 0 else 0, 1)
            expected_progress = (completed_days / total_shoot_days * 100) if total_shoot_days > 0 else 0

            if progress_percent >= expected_progress + 5:
                schedule_status = "ahead"
            elif progress_percent >= expected_progress - 5:
                schedule_status = "on_track"
            else:
                schedule_status = "behind"

        # Average pages per day
        avg_pages_per_day = round(pages_shot / completed_days, 2) if completed_days > 0 else 0
        target_pages_per_day = round(total_pages / total_shoot_days, 2) if total_shoot_days > 0 else 0

        return {
            "success": True,
            "summary": {
                "total_pages": round(total_pages, 2),
                "pages_shot": round(pages_shot, 2),
                "pages_scheduled": round(pages_scheduled, 2),
                "pages_remaining": round(total_pages - pages_shot, 2),
                "total_shoot_days": total_shoot_days,
                "completed_days": completed_days,
                "remaining_days": total_shoot_days - completed_days,
                "progress_percent": progress_percent,
                "schedule_status": schedule_status,
                "avg_pages_per_day": avg_pages_per_day,
                "target_pages_per_day": target_pages_per_day
            },
            "pages_by_status": {
                "not_scheduled": round(pages_by_status["not_scheduled"], 2),
                "scheduled": round(pages_by_status["scheduled"], 2),
                "shot": round(pages_by_status["shot"], 2),
                "needs_pickup": round(pages_by_status["needs_pickup"], 2)
            },
            "daily_trend": daily_data
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching schedule analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/analytics/utilization")
async def get_utilization_analytics(
    project_id: str,
    authorization: str = Header(None)
):
    """
    READ-ONLY: Get resource utilization metrics - locations, cast, and crew usage.
    Reads from production days, call sheets, locations, and bookings - no modifications.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify user has access to project
        member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user["id"]).single().execute()
        if not member_result.data or member_result.data["role"] not in ["owner", "producer", "admin"]:
            raise HTTPException(status_code=403, detail="Analytics access requires producer or admin role")

        # Get all production days
        prod_days_result = supabase.table("backlot_production_days").select(
            "id, day_number, date, location_id, location_name, is_completed"
        ).eq("project_id", project_id).execute()

        production_days = prod_days_result.data or []
        total_days = len(production_days)
        completed_days = sum(1 for d in production_days if d.get("is_completed"))

        # Location utilization
        location_usage = {}
        for day in production_days:
            loc_id = day.get("location_id")
            loc_name = day.get("location_name", "Unknown Location")

            if loc_id:
                if loc_id not in location_usage:
                    # Get location name
                    loc_result = supabase.table("backlot_locations").select("name").eq("id", loc_id).single().execute()
                    location_usage[loc_id] = {
                        "location_id": loc_id,
                        "name": loc_result.data["name"] if loc_result.data else loc_name,
                        "days_scheduled": 0,
                        "days_completed": 0
                    }
                location_usage[loc_id]["days_scheduled"] += 1
                if day.get("is_completed"):
                    location_usage[loc_id]["days_completed"] += 1
            elif loc_name:
                key = f"name:{loc_name}"
                if key not in location_usage:
                    location_usage[key] = {
                        "location_id": None,
                        "name": loc_name,
                        "days_scheduled": 0,
                        "days_completed": 0
                    }
                location_usage[key]["days_scheduled"] += 1
                if day.get("is_completed"):
                    location_usage[key]["days_completed"] += 1

        locations = sorted(location_usage.values(), key=lambda x: x["days_scheduled"], reverse=True)

        # Cast and crew utilization from call sheet people
        person_usage = {}

        for day in production_days:
            # Get call sheet for this day
            cs_result = supabase.table("backlot_call_sheets").select("id").eq("production_day_id", day["id"]).limit(1).execute()

            if cs_result.data:
                call_sheet_id = cs_result.data[0]["id"]

                # Get people on this call sheet
                people_result = supabase.table("backlot_call_sheet_people").select(
                    "id, name, role, department, is_cast, character_name"
                ).eq("call_sheet_id", call_sheet_id).execute()

                for person in (people_result.data or []):
                    key = person.get("name", "Unknown")
                    if key not in person_usage:
                        person_usage[key] = {
                            "name": key,
                            "role": person.get("role") or person.get("character_name", ""),
                            "department": person.get("department", ""),
                            "is_cast": person.get("is_cast", False),
                            "days_scheduled": 0,
                            "days_worked": 0
                        }
                    person_usage[key]["days_scheduled"] += 1
                    if day.get("is_completed"):
                        person_usage[key]["days_worked"] += 1

        # Separate cast and crew
        cast_usage = [p for p in person_usage.values() if p["is_cast"]]
        crew_usage = [p for p in person_usage.values() if not p["is_cast"]]

        # Sort by days scheduled
        cast_usage.sort(key=lambda x: x["days_scheduled"], reverse=True)
        crew_usage.sort(key=lambda x: x["days_scheduled"], reverse=True)

        # Get booked roles for additional context
        roles_result = supabase.table("backlot_project_roles").select(
            "id, title, type, department, status, days_estimated, booked_user_id"
        ).eq("project_id", project_id).execute()

        roles = roles_result.data or []
        booked_roles = [r for r in roles if r.get("booked_user_id")]
        open_roles = [r for r in roles if r.get("status") == "open"]

        return {
            "success": True,
            "summary": {
                "total_shoot_days": total_days,
                "completed_days": completed_days,
                "unique_locations": len(locations),
                "total_cast_booked": len([c for c in cast_usage if c["days_scheduled"] > 0]),
                "total_crew_booked": len([c for c in crew_usage if c["days_scheduled"] > 0]),
                "open_roles": len(open_roles),
                "filled_roles": len(booked_roles)
            },
            "locations": locations[:20],
            "cast": cast_usage[:20],
            "crew": crew_usage[:30],
            "roles_summary": {
                "total": len(roles),
                "booked": len(booked_roles),
                "open": len(open_roles),
                "cast_roles": len([r for r in roles if r.get("type") == "cast"]),
                "crew_roles": len([r for r in roles if r.get("type") == "crew"])
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching utilization analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/analytics/overview")
async def get_analytics_overview(
    project_id: str,
    authorization: str = Header(None)
):
    """
    READ-ONLY: Get combined analytics overview for producer dashboard.
    Aggregates key metrics from cost, schedule, and utilization.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify user has access to project (producer/admin only)
        member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user["id"]).single().execute()
        if not member_result.data or member_result.data["role"] not in ["owner", "producer", "admin"]:
            raise HTTPException(status_code=403, detail="Analytics access requires producer or admin role")

        # Get project info
        project_result = supabase.table("backlot_projects").select("title, status").eq("id", project_id).single().execute()
        project = project_result.data if project_result.data else {"title": "Unknown", "status": "unknown"}

        # Budget summary
        budget_result = supabase.table("backlot_budgets").select(
            "estimated_total, actual_total, variance"
        ).eq("project_id", project_id).order("created_at", desc=True).limit(1).execute()

        budget_summary = {
            "has_budget": bool(budget_result.data),
            "estimated_total": float(budget_result.data[0].get("estimated_total") or 0) if budget_result.data else 0,
            "actual_total": float(budget_result.data[0].get("actual_total") or 0) if budget_result.data else 0,
            "variance": float(budget_result.data[0].get("variance") or 0) if budget_result.data else 0,
            "budget_status": "on_track"
        }

        if budget_summary["has_budget"] and budget_summary["estimated_total"] > 0:
            variance_percent = (budget_summary["variance"] / budget_summary["estimated_total"]) * 100
            if variance_percent > 10:
                budget_summary["budget_status"] = "over_budget"
            elif variance_percent < -10:
                budget_summary["budget_status"] = "under_budget"

        # Schedule summary
        scenes_result = supabase.table("backlot_scenes").select("page_count, coverage_status").eq("project_id", project_id).eq("is_omitted", False).execute()

        total_pages = 0
        pages_shot = 0
        for scene in (scenes_result.data or []):
            try:
                pc = float(scene.get("page_count") or 0)
            except:
                pc = 0
            total_pages += pc
            if scene.get("coverage_status") == "shot":
                pages_shot += pc

        prod_days_result = supabase.table("backlot_production_days").select("id, is_completed").eq("project_id", project_id).execute()
        total_days = len(prod_days_result.data or [])
        completed_days = sum(1 for d in (prod_days_result.data or []) if d.get("is_completed"))

        schedule_summary = {
            "total_pages": round(total_pages, 2),
            "pages_shot": round(pages_shot, 2),
            "progress_percent": round((pages_shot / total_pages * 100) if total_pages > 0 else 0, 1),
            "total_shoot_days": total_days,
            "completed_days": completed_days,
            "schedule_status": "on_track"
        }

        if total_days > 0:
            expected = completed_days / total_days * 100
            actual = schedule_summary["progress_percent"]
            if actual >= expected + 5:
                schedule_summary["schedule_status"] = "ahead"
            elif actual < expected - 5:
                schedule_summary["schedule_status"] = "behind"

        # Team summary
        members_result = supabase.table("backlot_project_members").select("id").eq("project_id", project_id).execute()
        roles_result = supabase.table("backlot_project_roles").select("status").eq("project_id", project_id).execute()

        team_summary = {
            "total_members": len(members_result.data or []),
            "total_roles": len(roles_result.data or []),
            "open_roles": len([r for r in (roles_result.data or []) if r.get("status") == "open"]),
            "booked_roles": len([r for r in (roles_result.data or []) if r.get("status") == "booked"])
        }

        return {
            "success": True,
            "project": project,
            "budget": budget_summary,
            "schedule": schedule_summary,
            "team": team_summary
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching analytics overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SHOT LISTS API (Professional DP/Producer Shot Lists)
# =====================================================

class ShotListCreate(BaseModel):
    """Request model for creating a shot list"""
    title: str
    description: Optional[str] = None
    list_type: Optional[str] = None  # 'scene_based', 'day_based', 'sequence_based', 'location_based', 'custom'
    production_day_id: Optional[str] = None
    scene_id: Optional[str] = None


class ShotListUpdate(BaseModel):
    """Request model for updating a shot list"""
    title: Optional[str] = None
    description: Optional[str] = None
    list_type: Optional[str] = None
    production_day_id: Optional[str] = None
    scene_id: Optional[str] = None
    is_archived: Optional[bool] = None


class ShotCreate(BaseModel):
    """Request model for creating a shot"""
    shot_number: Optional[str] = None
    scene_number: Optional[str] = None
    scene_id: Optional[str] = None
    camera_label: Optional[str] = None
    frame_size: Optional[str] = None
    lens: Optional[str] = None
    focal_length_mm: Optional[float] = None
    camera_height: Optional[str] = None
    movement: Optional[str] = None
    location_hint: Optional[str] = None
    time_of_day: Optional[str] = None
    description: Optional[str] = None
    technical_notes: Optional[str] = None
    performance_notes: Optional[str] = None
    est_time_minutes: Optional[float] = None


class ShotUpdate(BaseModel):
    """Request model for updating a shot"""
    shot_number: Optional[str] = None
    scene_number: Optional[str] = None
    scene_id: Optional[str] = None
    camera_label: Optional[str] = None
    frame_size: Optional[str] = None
    lens: Optional[str] = None
    focal_length_mm: Optional[float] = None
    camera_height: Optional[str] = None
    movement: Optional[str] = None
    location_hint: Optional[str] = None
    time_of_day: Optional[str] = None
    description: Optional[str] = None
    technical_notes: Optional[str] = None
    performance_notes: Optional[str] = None
    est_time_minutes: Optional[float] = None
    is_completed: Optional[bool] = None
    sort_order: Optional[int] = None


class ShotReorderItem(BaseModel):
    """Single item in a reorder request"""
    id: str
    sort_order: int


class ShotReorderRequest(BaseModel):
    """Request model for reordering shots"""
    shots: List[ShotReorderItem]


# Helper to check if user can edit shot lists (producer-level roles)
async def verify_shot_list_edit_access(supabase, project_id: str, user_id: str) -> bool:
    """Check if user has producer-level access to edit shot lists"""
    # Check if owner
    project_result = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).single().execute()
    if project_result.data and project_result.data.get("owner_id") == user_id:
        return True

    # Check membership role
    member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).single().execute()
    if member_result.data:
        role = member_result.data.get("role")
        if role in ["owner", "admin", "editor", "producer", "director", "dp", "first_ad"]:
            return True

    return False


@router.get("/projects/{project_id}/shot-lists")
async def list_shot_lists(
    project_id: str,
    include_archived: bool = False,
    authorization: str = Header(None)
):
    """
    Get all shot lists for a project.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify project access
        await verify_project_access(supabase, project_id, user["id"])

        # Build query - simple select without joins to avoid schema issues
        query = supabase.table("backlot_shot_lists").select("*").eq("project_id", project_id)

        if not include_archived:
            query = query.eq("is_archived", False)

        query = query.order("created_at", desc=True)
        result = query.execute()

        shot_lists = result.data or []

        # Get shot counts for each list
        for shot_list in shot_lists:
            count_result = supabase.table("backlot_shots").select("id", count="exact").eq("shot_list_id", shot_list["id"]).execute()
            shot_list["shot_count"] = count_result.count or 0

            # Get completion stats
            completed_result = supabase.table("backlot_shots").select("id", count="exact").eq("shot_list_id", shot_list["id"]).eq("is_completed", True).execute()
            shot_list["completed_count"] = completed_result.count or 0

        return {"success": True, "shot_lists": shot_lists}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing shot lists: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/shot-lists")
async def create_shot_list(
    project_id: str,
    request: ShotListCreate,
    authorization: str = Header(None)
):
    """
    Create a new shot list.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to create shot lists")

        # Create shot list
        shot_list_data = {
            "project_id": project_id,
            "title": request.title,
            "description": request.description,
            "list_type": request.list_type,
            "production_day_id": request.production_day_id,
            "scene_id": request.scene_id,
            "created_by_user_id": user["id"],
        }

        result = supabase.table("backlot_shot_lists").insert(shot_list_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create shot list")

        return {"success": True, "shot_list": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating shot list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shot-lists/{shot_list_id}")
async def get_shot_list(
    shot_list_id: str,
    authorization: str = Header(None)
):
    """
    Get a single shot list with all its shots.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot list - simple select without joins to avoid schema issues
        shot_list_result = supabase.table("backlot_shot_lists").select("*").eq("id", shot_list_id).single().execute()

        if not shot_list_result.data:
            raise HTTPException(status_code=404, detail="Shot list not found")

        shot_list = shot_list_result.data

        # Verify project access
        await verify_project_access(supabase, shot_list["project_id"], user["id"])

        # Get shots - simple select without joins to avoid schema issues
        shots_result = supabase.table("backlot_shots").select("*").eq("shot_list_id", shot_list_id).order("sort_order").order("created_at").execute()

        shot_list["shots"] = shots_result.data or []

        return {"success": True, "shot_list": shot_list}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting shot list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/shot-lists/{shot_list_id}")
async def update_shot_list(
    shot_list_id: str,
    request: ShotListUpdate,
    authorization: str = Header(None)
):
    """
    Update a shot list.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot list to verify access
        shot_list_result = supabase.table("backlot_shot_lists").select("project_id").eq("id", shot_list_id).single().execute()

        if not shot_list_result.data:
            raise HTTPException(status_code=404, detail="Shot list not found")

        project_id = shot_list_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to edit shot lists")

        # Build update data
        update_data = {}
        if request.title is not None:
            update_data["title"] = request.title
        if request.description is not None:
            update_data["description"] = request.description
        if request.list_type is not None:
            update_data["list_type"] = request.list_type
        if request.production_day_id is not None:
            update_data["production_day_id"] = request.production_day_id if request.production_day_id else None
        if request.scene_id is not None:
            update_data["scene_id"] = request.scene_id if request.scene_id else None
        if request.is_archived is not None:
            update_data["is_archived"] = request.is_archived

        if update_data:
            result = supabase.table("backlot_shot_lists").update(update_data).eq("id", shot_list_id).execute()
            return {"success": True, "shot_list": result.data[0] if result.data else None}

        return {"success": True, "shot_list": shot_list_result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating shot list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/shot-lists/{shot_list_id}")
async def delete_shot_list(
    shot_list_id: str,
    hard_delete: bool = False,
    authorization: str = Header(None)
):
    """
    Delete (archive) a shot list.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot list to verify access
        shot_list_result = supabase.table("backlot_shot_lists").select("project_id").eq("id", shot_list_id).single().execute()

        if not shot_list_result.data:
            raise HTTPException(status_code=404, detail="Shot list not found")

        project_id = shot_list_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to delete shot lists")

        if hard_delete:
            # Hard delete - will cascade to shots
            supabase.table("backlot_shot_lists").delete().eq("id", shot_list_id).execute()
        else:
            # Soft delete - archive
            supabase.table("backlot_shot_lists").update({"is_archived": True}).eq("id", shot_list_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting shot list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# SHOTS API (Individual shots within a list)
# =====================================================

@router.post("/shot-lists/{shot_list_id}/shots")
async def create_shot(
    shot_list_id: str,
    request: ShotCreate,
    authorization: str = Header(None)
):
    """
    Create a new shot in a shot list.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot list to verify access and get project_id
        shot_list_result = supabase.table("backlot_shot_lists").select("project_id").eq("id", shot_list_id).single().execute()

        if not shot_list_result.data:
            raise HTTPException(status_code=404, detail="Shot list not found")

        project_id = shot_list_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to add shots")

        # Get next sort order
        max_order_result = supabase.table("backlot_shots").select("sort_order").eq("shot_list_id", shot_list_id).order("sort_order", desc=True).limit(1).execute()
        next_sort_order = (max_order_result.data[0]["sort_order"] + 1) if max_order_result.data else 0

        # Get next shot number if not provided
        shot_number = request.shot_number
        if not shot_number:
            max_num_result = supabase.table("backlot_shots").select("shot_number").eq("shot_list_id", shot_list_id).execute()
            if max_num_result.data:
                # Extract max numeric part
                max_num = 0
                for s in max_num_result.data:
                    try:
                        num_part = ''.join(c for c in s["shot_number"] if c.isdigit())
                        if num_part:
                            max_num = max(max_num, int(num_part))
                    except:
                        pass
                shot_number = str(max_num + 1)
            else:
                shot_number = "1"

        # Create shot
        shot_data = {
            "project_id": project_id,
            "shot_list_id": shot_list_id,
            "sort_order": next_sort_order,
            "shot_number": shot_number,
            "scene_number": request.scene_number,
            "scene_id": request.scene_id,
            "camera_label": request.camera_label,
            "frame_size": request.frame_size,
            "lens": request.lens,
            "focal_length_mm": request.focal_length_mm,
            "camera_height": request.camera_height,
            "movement": request.movement,
            "location_hint": request.location_hint,
            "time_of_day": request.time_of_day,
            "description": request.description,
            "technical_notes": request.technical_notes,
            "performance_notes": request.performance_notes,
            "est_time_minutes": request.est_time_minutes,
            "created_by_user_id": user["id"],
        }

        result = supabase.table("backlot_shots").insert(shot_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create shot")

        return {"success": True, "shot": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/shots/{shot_id}")
async def update_shot(
    shot_id: str,
    request: ShotUpdate,
    authorization: str = Header(None)
):
    """
    Update a shot.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot to verify access
        shot_result = supabase.table("backlot_shots").select("project_id").eq("id", shot_id).single().execute()

        if not shot_result.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        project_id = shot_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to edit shots")

        # Build update data
        update_data = {}
        fields = [
            "shot_number", "scene_number", "scene_id", "camera_label", "frame_size",
            "lens", "focal_length_mm", "camera_height", "movement", "location_hint",
            "time_of_day", "description", "technical_notes", "performance_notes",
            "est_time_minutes", "is_completed", "sort_order"
        ]

        for field in fields:
            value = getattr(request, field, None)
            if value is not None:
                update_data[field] = value

        if update_data:
            result = supabase.table("backlot_shots").update(update_data).eq("id", shot_id).execute()
            return {"success": True, "shot": result.data[0] if result.data else None}

        return {"success": True, "shot": shot_result.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/shots/{shot_id}")
async def delete_shot(
    shot_id: str,
    authorization: str = Header(None)
):
    """
    Delete a shot.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot to verify access
        shot_result = supabase.table("backlot_shots").select("project_id").eq("id", shot_id).single().execute()

        if not shot_result.data:
            raise HTTPException(status_code=404, detail="Shot not found")

        project_id = shot_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to delete shots")

        # Delete
        supabase.table("backlot_shots").delete().eq("id", shot_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting shot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/shot-lists/{shot_list_id}/shots/reorder")
async def reorder_shots(
    shot_list_id: str,
    request: ShotReorderRequest,
    authorization: str = Header(None)
):
    """
    Reorder shots within a shot list.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot list to verify access
        shot_list_result = supabase.table("backlot_shot_lists").select("project_id").eq("id", shot_list_id).single().execute()

        if not shot_list_result.data:
            raise HTTPException(status_code=404, detail="Shot list not found")

        project_id = shot_list_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to reorder shots")

        # Verify all shots belong to this shot list
        shot_ids = [s.id for s in request.shots]
        verify_result = supabase.table("backlot_shots").select("id").eq("shot_list_id", shot_list_id).in_("id", shot_ids).execute()

        if len(verify_result.data or []) != len(shot_ids):
            raise HTTPException(status_code=400, detail="Some shots don't belong to this shot list")

        # Update sort orders
        for shot_item in request.shots:
            supabase.table("backlot_shots").update({"sort_order": shot_item.sort_order}).eq("id", shot_item.id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reordering shots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/shot-lists/{shot_list_id}/shots/bulk")
async def bulk_create_shots(
    shot_list_id: str,
    shots: List[ShotCreate],
    authorization: str = Header(None)
):
    """
    Bulk create multiple shots in a shot list.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get shot list to verify access and get project_id
        shot_list_result = supabase.table("backlot_shot_lists").select("project_id").eq("id", shot_list_id).single().execute()

        if not shot_list_result.data:
            raise HTTPException(status_code=404, detail="Shot list not found")

        project_id = shot_list_result.data["project_id"]

        # Verify edit access
        has_access = await verify_shot_list_edit_access(supabase, project_id, user["id"])
        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have permission to add shots")

        # Get starting sort order
        max_order_result = supabase.table("backlot_shots").select("sort_order").eq("shot_list_id", shot_list_id).order("sort_order", desc=True).limit(1).execute()
        next_sort_order = (max_order_result.data[0]["sort_order"] + 1) if max_order_result.data else 0

        # Get max shot number
        max_num_result = supabase.table("backlot_shots").select("shot_number").eq("shot_list_id", shot_list_id).execute()
        max_num = 0
        if max_num_result.data:
            for s in max_num_result.data:
                try:
                    num_part = ''.join(c for c in s["shot_number"] if c.isdigit())
                    if num_part:
                        max_num = max(max_num, int(num_part))
                except:
                    pass

        # Create shots
        created_shots = []
        for i, shot_req in enumerate(shots):
            shot_number = shot_req.shot_number or str(max_num + i + 1)

            shot_data = {
                "project_id": project_id,
                "shot_list_id": shot_list_id,
                "sort_order": next_sort_order + i,
                "shot_number": shot_number,
                "scene_number": shot_req.scene_number,
                "scene_id": shot_req.scene_id,
                "camera_label": shot_req.camera_label,
                "frame_size": shot_req.frame_size,
                "lens": shot_req.lens,
                "focal_length_mm": shot_req.focal_length_mm,
                "camera_height": shot_req.camera_height,
                "movement": shot_req.movement,
                "location_hint": shot_req.location_hint,
                "time_of_day": shot_req.time_of_day,
                "description": shot_req.description,
                "technical_notes": shot_req.technical_notes,
                "performance_notes": shot_req.performance_notes,
                "est_time_minutes": shot_req.est_time_minutes,
                "created_by_user_id": user["id"],
            }

            result = supabase.table("backlot_shots").insert(shot_data).execute()
            if result.data:
                created_shots.append(result.data[0])

        return {"success": True, "shots": created_shots, "count": len(created_shots)}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error bulk creating shots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK SYSTEM - Pydantic Models
# =====================================================

class TaskListCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    default_view_type: Optional[str] = "board"
    sharing_mode: Optional[str] = "project_wide"


class TaskListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    default_view_type: Optional[str] = None
    sharing_mode: Optional[str] = None
    is_archived: Optional[bool] = None


class TaskListMemberCreate(BaseModel):
    user_id: str
    can_edit: Optional[bool] = True


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = None
    section: Optional[str] = None
    due_date: Optional[str] = None
    start_date: Optional[str] = None
    department: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    estimate_hours: Optional[float] = None
    assignee_ids: Optional[List[str]] = None
    label_ids: Optional[List[str]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    section: Optional[str] = None
    due_date: Optional[str] = None
    start_date: Optional[str] = None
    department: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    estimate_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    is_completed: Optional[bool] = None
    sort_index: Optional[float] = None


class TaskLabelCreate(BaseModel):
    name: str
    color: Optional[str] = None


class TaskCommentCreate(BaseModel):
    body: str


class TaskCommentUpdate(BaseModel):
    body: str


class TaskViewCreate(BaseModel):
    name: str
    view_type: str = "board"
    config: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = False


class TaskViewUpdate(BaseModel):
    name: Optional[str] = None
    view_type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None


# =====================================================
# TASK SYSTEM - Helper Functions
# =====================================================

async def verify_task_list_access(supabase, task_list_id: str, user_id: str, require_edit: bool = False) -> Dict[str, Any]:
    """Verify user has access to a task list and return task list data"""
    # Get task list
    result = supabase.table("backlot_task_lists").select("*").eq("id", task_list_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Task list not found")

    task_list = result.data
    project_id = task_list["project_id"]

    # Check if project admin
    member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).single().execute()

    if member_result.data and member_result.data["role"] == "admin":
        return task_list

    # Check sharing mode
    if task_list["sharing_mode"] == "project_wide":
        # Any project member can view
        if not member_result.data:
            raise HTTPException(status_code=403, detail="You don't have access to this project")
        if require_edit and member_result.data["role"] not in ["admin", "editor"]:
            raise HTTPException(status_code=403, detail="You don't have permission to edit this task list")
        return task_list
    else:
        # Selected sharing mode - check task list members
        list_member_result = supabase.table("backlot_task_list_members").select("can_edit").eq("task_list_id", task_list_id).eq("user_id", user_id).single().execute()

        if not list_member_result.data:
            raise HTTPException(status_code=403, detail="You don't have access to this task list")

        if require_edit and not list_member_result.data["can_edit"]:
            raise HTTPException(status_code=403, detail="You don't have permission to edit this task list")

        return task_list


async def can_manage_task_list(supabase, task_list_id: str, user_id: str) -> bool:
    """Check if user can manage task list (owner, project admin)"""
    result = supabase.table("backlot_task_lists").select("project_id, created_by_user_id").eq("id", task_list_id).single().execute()

    if not result.data:
        return False

    # Creator can always manage
    if result.data["created_by_user_id"] == user_id:
        return True

    # Check if project admin
    member_result = supabase.table("backlot_project_members").select("role").eq("project_id", result.data["project_id"]).eq("user_id", user_id).single().execute()

    return member_result.data and member_result.data["role"] == "admin"


# =====================================================
# TASK LIST ENDPOINTS
# =====================================================

@router.get("/projects/{project_id}/task-lists")
async def get_project_task_lists(
    project_id: str,
    include_archived: bool = False,
    authorization: str = Header(None)
):
    """Get all task lists for a project that the user can access"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify project access
        await verify_project_access(supabase, project_id, user["id"])

        # Check if user is project admin
        member_result = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user["id"]).single().execute()
        is_admin = member_result.data and member_result.data["role"] == "admin"

        # Build query
        query = supabase.table("backlot_task_lists").select("*").eq("project_id", project_id)

        if not include_archived:
            query = query.eq("is_archived", False)

        result = query.order("created_at", desc=False).execute()
        task_lists = result.data or []

        # Filter by sharing if not admin
        if not is_admin:
            # Get list memberships for user
            memberships_result = supabase.table("backlot_task_list_members").select("task_list_id").eq("user_id", user["id"]).execute()
            user_list_ids = set(m["task_list_id"] for m in (memberships_result.data or []))

            task_lists = [
                tl for tl in task_lists
                if tl["sharing_mode"] == "project_wide" or tl["id"] in user_list_ids
            ]

        # Get task counts for each list
        for task_list in task_lists:
            # Get status counts
            count_result = supabase.table("backlot_tasks").select("status").eq("task_list_id", task_list["id"]).execute()
            tasks = count_result.data or []

            status_counts = {}
            for task in tasks:
                status = task.get("status", "todo")
                status_counts[status] = status_counts.get(status, 0) + 1

            task_list["task_count"] = len(tasks)
            task_list["status_counts"] = status_counts

        return {"success": True, "task_lists": task_lists}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task lists: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/task-lists")
async def create_task_list(
    project_id: str,
    request: TaskListCreate,
    authorization: str = Header(None)
):
    """Create a new task list for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Verify edit access to project
        await verify_project_access(supabase, project_id, user["id"], require_edit=True)

        # Create task list
        task_list_data = {
            "project_id": project_id,
            "name": request.name,
            "description": request.description,
            "icon": request.icon,
            "default_view_type": request.default_view_type or "board",
            "sharing_mode": request.sharing_mode or "project_wide",
            "created_by_user_id": user["id"],
        }

        result = supabase.table("backlot_task_lists").insert(task_list_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create task list")

        task_list = result.data[0]

        # Create default views
        default_views = [
            {
                "task_list_id": task_list["id"],
                "name": "Board",
                "view_type": "board",
                "is_default": True,
                "config": {"group_by": "status", "sort_by": [{"field": "sort_index", "direction": "asc"}]},
                "created_by_user_id": user["id"],
            },
            {
                "task_list_id": task_list["id"],
                "name": "List",
                "view_type": "list",
                "is_default": False,
                "config": {"sort_by": [{"field": "sort_index", "direction": "asc"}]},
                "created_by_user_id": user["id"],
            },
            {
                "task_list_id": task_list["id"],
                "name": "Calendar",
                "view_type": "calendar",
                "is_default": False,
                "config": {"calendar_field": "due_date"},
                "created_by_user_id": user["id"],
            },
        ]

        supabase.table("backlot_task_views").insert(default_views).execute()

        # If selective sharing mode, add creator as member
        if request.sharing_mode == "selective":
            supabase.table("backlot_task_list_members").insert({
                "task_list_id": task_list["id"],
                "user_id": user["id"],
                "can_edit": True,
            }).execute()

        return {"success": True, "task_list": task_list}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating task list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task-lists/{task_list_id}")
async def get_task_list(
    task_list_id: str,
    authorization: str = Header(None)
):
    """Get a task list with its views and sharing info"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        task_list = await verify_task_list_access(supabase, task_list_id, user["id"])

        # Get views
        views_result = supabase.table("backlot_task_views").select("*").eq("task_list_id", task_list_id).order("created_at").execute()
        task_list["views"] = views_result.data or []

        # Get members if selective sharing mode
        if task_list["sharing_mode"] == "selective":
            members_result = supabase.table("backlot_task_list_members").select("*").eq("task_list_id", task_list_id).execute()
            task_list["members"] = members_result.data or []
        else:
            task_list["members"] = []

        # Get task counts
        count_result = supabase.table("backlot_tasks").select("status").eq("task_list_id", task_list_id).execute()
        tasks = count_result.data or []

        status_counts = {}
        for task in tasks:
            status = task.get("status", "todo")
            status_counts[status] = status_counts.get(status, 0) + 1

        task_list["task_count"] = len(tasks)
        task_list["status_counts"] = status_counts

        return {"success": True, "task_list": task_list}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/task-lists/{task_list_id}")
async def update_task_list(
    task_list_id: str,
    request: TaskListUpdate,
    authorization: str = Header(None)
):
    """Update a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        task_list = await verify_task_list_access(supabase, task_list_id, user["id"], require_edit=True)

        # Build update data
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.icon is not None:
            update_data["icon"] = request.icon
        if request.default_view_type is not None:
            update_data["default_view_type"] = request.default_view_type
        if request.sharing_mode is not None:
            update_data["sharing_mode"] = request.sharing_mode
        if request.is_archived is not None:
            update_data["is_archived"] = request.is_archived

        if update_data:
            result = supabase.table("backlot_task_lists").update(update_data).eq("id", task_list_id).execute()

            # If switching to selective mode, ensure creator is a member
            if request.sharing_mode == "selective":
                existing_member = supabase.table("backlot_task_list_members").select("id").eq("task_list_id", task_list_id).eq("user_id", task_list["created_by_user_id"]).single().execute()

                if not existing_member.data:
                    supabase.table("backlot_task_list_members").insert({
                        "task_list_id": task_list_id,
                        "user_id": task_list["created_by_user_id"],
                        "can_edit": True,
                    }).execute()

            return {"success": True, "task_list": result.data[0] if result.data else None}

        return {"success": True, "task_list": task_list}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating task list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task-lists/{task_list_id}")
async def delete_task_list(
    task_list_id: str,
    hard_delete: bool = False,
    authorization: str = Header(None)
):
    """Delete (archive) a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        can_manage = await can_manage_task_list(supabase, task_list_id, user["id"])
        if not can_manage:
            raise HTTPException(status_code=403, detail="You don't have permission to delete this task list")

        if hard_delete:
            supabase.table("backlot_task_lists").delete().eq("id", task_list_id).execute()
        else:
            supabase.table("backlot_task_lists").update({"is_archived": True}).eq("id", task_list_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting task list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK LIST MEMBERS ENDPOINTS
# =====================================================

@router.get("/task-lists/{task_list_id}/members")
async def get_task_list_members(
    task_list_id: str,
    authorization: str = Header(None)
):
    """Get members of a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        task_list = await verify_task_list_access(supabase, task_list_id, user["id"])

        result = supabase.table("backlot_task_list_members").select("*").eq("task_list_id", task_list_id).execute()

        return {"success": True, "members": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task list members: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task-lists/{task_list_id}/members")
async def add_task_list_member(
    task_list_id: str,
    request: TaskListMemberCreate,
    authorization: str = Header(None)
):
    """Add a member to a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        can_manage = await can_manage_task_list(supabase, task_list_id, user["id"])
        if not can_manage:
            raise HTTPException(status_code=403, detail="You don't have permission to manage this task list")

        # Check if already a member
        existing = supabase.table("backlot_task_list_members").select("id").eq("task_list_id", task_list_id).eq("user_id", request.user_id).single().execute()

        if existing.data:
            # Update existing
            result = supabase.table("backlot_task_list_members").update({"can_edit": request.can_edit}).eq("id", existing.data["id"]).execute()
        else:
            # Create new
            result = supabase.table("backlot_task_list_members").insert({
                "task_list_id": task_list_id,
                "user_id": request.user_id,
                "can_edit": request.can_edit if request.can_edit is not None else True,
            }).execute()

        return {"success": True, "member": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding task list member: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task-list-members/{member_id}")
async def remove_task_list_member(
    member_id: str,
    authorization: str = Header(None)
):
    """Remove a member from a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get member to find task list
        member_result = supabase.table("backlot_task_list_members").select("task_list_id").eq("id", member_id).single().execute()

        if not member_result.data:
            raise HTTPException(status_code=404, detail="Member not found")

        task_list_id = member_result.data["task_list_id"]

        can_manage = await can_manage_task_list(supabase, task_list_id, user["id"])
        if not can_manage:
            raise HTTPException(status_code=403, detail="You don't have permission to manage this task list")

        supabase.table("backlot_task_list_members").delete().eq("id", member_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing task list member: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK ENDPOINTS
# =====================================================

@router.get("/task-lists/{task_list_id}/tasks")
async def get_task_list_tasks(
    task_list_id: str,
    view_id: Optional[str] = None,
    status: Optional[str] = None,
    section: Optional[str] = None,
    department: Optional[str] = None,
    assignee_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get tasks in a task list, optionally filtered by view"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        task_list = await verify_task_list_access(supabase, task_list_id, user["id"])

        # Build query
        query = supabase.table("backlot_tasks").select("*").eq("task_list_id", task_list_id)

        # Apply view filters if provided
        if view_id:
            view_result = supabase.table("backlot_task_views").select("config").eq("id", view_id).single().execute()
            if view_result.data and view_result.data.get("config"):
                config = view_result.data["config"]

                # Apply filters from view config
                filters = config.get("filters", [])
                for f in filters:
                    field = f.get("field")
                    op = f.get("op")
                    value = f.get("value")

                    if field and op and value is not None:
                        if op == "eq":
                            query = query.eq(field, value)
                        elif op == "in" and isinstance(value, list):
                            query = query.in_(field, value)
                        elif op == "neq":
                            query = query.neq(field, value)

        # Apply direct filters
        if status:
            query = query.eq("status", status)
        if section:
            query = query.eq("section", section)
        if department:
            query = query.eq("department", department)

        query = query.order("sort_index").order("created_at")
        result = query.execute()
        tasks = result.data or []

        # Get assignees for all tasks
        if tasks:
            task_ids = [t["id"] for t in tasks]
            assignees_result = supabase.table("backlot_task_assignees").select("*").in_("task_id", task_ids).execute()

            # Group assignees by task
            assignees_by_task = {}
            for a in (assignees_result.data or []):
                task_id = a["task_id"]
                if task_id not in assignees_by_task:
                    assignees_by_task[task_id] = []
                assignees_by_task[task_id].append(a)

            # Get labels for all tasks
            labels_result = supabase.table("backlot_task_label_links").select("*, label:label_id(*)").in_("task_id", task_ids).execute()

            # Group labels by task
            labels_by_task = {}
            for l in (labels_result.data or []):
                task_id = l["task_id"]
                if task_id not in labels_by_task:
                    labels_by_task[task_id] = []
                if l.get("label"):
                    labels_by_task[task_id].append(l["label"])

            # Add to tasks
            for task in tasks:
                task["assignees"] = assignees_by_task.get(task["id"], [])
                task["labels"] = labels_by_task.get(task["id"], [])

        # Filter by assignee if provided
        if assignee_id:
            tasks = [t for t in tasks if any(a["user_id"] == assignee_id for a in t.get("assignees", []))]

        return {"success": True, "tasks": tasks}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task-lists/{task_list_id}/tasks")
async def create_task(
    task_list_id: str,
    request: TaskCreate,
    authorization: str = Header(None)
):
    """Create a new task in a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        task_list = await verify_task_list_access(supabase, task_list_id, user["id"], require_edit=True)

        # Get next sort index
        max_sort_result = supabase.table("backlot_tasks").select("sort_index").eq("task_list_id", task_list_id).order("sort_index", desc=True).limit(1).execute()
        next_sort_index = (max_sort_result.data[0]["sort_index"] + 1) if max_sort_result.data else 0

        # Create task
        task_data = {
            "project_id": task_list["project_id"],
            "task_list_id": task_list_id,
            "title": request.title,
            "description": request.description,
            "status": request.status or "todo",
            "priority": request.priority,
            "section": request.section,
            "due_date": request.due_date,
            "start_date": request.start_date,
            "department": request.department,
            "source_type": request.source_type,
            "source_id": request.source_id,
            "estimate_hours": request.estimate_hours,
            "sort_index": next_sort_index,
            "created_by_user_id": user["id"],
            "is_completed": request.status == "done",
        }

        result = supabase.table("backlot_tasks").insert(task_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create task")

        task = result.data[0]

        # Add assignees if provided
        if request.assignee_ids:
            assignee_data = [{"task_id": task["id"], "user_id": uid} for uid in request.assignee_ids]
            supabase.table("backlot_task_assignees").insert(assignee_data).execute()

        # Add labels if provided
        if request.label_ids:
            label_data = [{"task_id": task["id"], "label_id": lid} for lid in request.label_ids]
            supabase.table("backlot_task_label_links").insert(label_data).execute()

        # Fetch complete task with relations
        task["assignees"] = []
        task["labels"] = []

        if request.assignee_ids:
            assignees_result = supabase.table("backlot_task_assignees").select("*").eq("task_id", task["id"]).execute()
            task["assignees"] = assignees_result.data or []

        if request.label_ids:
            labels_result = supabase.table("backlot_task_label_links").select("*, label:label_id(*)").eq("task_id", task["id"]).execute()
            task["labels"] = [l["label"] for l in (labels_result.data or []) if l.get("label")]

        return {"success": True, "task": task}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str,
    authorization: str = Header(None)
):
    """Get a single task with all details"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("*").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        task = task_result.data

        # Verify access to task list
        await verify_task_list_access(supabase, task["task_list_id"], user["id"])

        # Get assignees
        assignees_result = supabase.table("backlot_task_assignees").select("*").eq("task_id", task_id).execute()
        task["assignees"] = assignees_result.data or []

        # Get watchers
        watchers_result = supabase.table("backlot_task_watchers").select("*").eq("task_id", task_id).execute()
        task["watchers"] = watchers_result.data or []

        # Get labels
        labels_result = supabase.table("backlot_task_label_links").select("*, label:label_id(*)").eq("task_id", task_id).execute()
        task["labels"] = [l["label"] for l in (labels_result.data or []) if l.get("label")]

        # Get comment count
        comments_result = supabase.table("backlot_task_comments").select("id", count="exact").eq("task_id", task_id).execute()
        task["comment_count"] = comments_result.count or 0

        return {"success": True, "task": task}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    request: TaskUpdate,
    authorization: str = Header(None)
):
    """Update a task"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify edit access
        await verify_task_list_access(supabase, task_result.data["task_list_id"], user["id"], require_edit=True)

        # Build update data
        update_data = {"last_updated_by_user_id": user["id"]}

        if request.title is not None:
            update_data["title"] = request.title
        if request.description is not None:
            update_data["description"] = request.description
        if request.status is not None:
            update_data["status"] = request.status
            update_data["is_completed"] = request.status == "done"
        if request.priority is not None:
            update_data["priority"] = request.priority
        if request.section is not None:
            update_data["section"] = request.section
        if request.due_date is not None:
            update_data["due_date"] = request.due_date if request.due_date else None
        if request.start_date is not None:
            update_data["start_date"] = request.start_date if request.start_date else None
        if request.department is not None:
            update_data["department"] = request.department
        if request.source_type is not None:
            update_data["source_type"] = request.source_type
        if request.source_id is not None:
            update_data["source_id"] = request.source_id
        if request.estimate_hours is not None:
            update_data["estimate_hours"] = request.estimate_hours
        if request.actual_hours is not None:
            update_data["actual_hours"] = request.actual_hours
        if request.is_completed is not None:
            update_data["is_completed"] = request.is_completed
            if request.is_completed:
                update_data["status"] = "done"
        if request.sort_index is not None:
            update_data["sort_index"] = request.sort_index

        result = supabase.table("backlot_tasks").update(update_data).eq("id", task_id).execute()

        return {"success": True, "task": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    authorization: str = Header(None)
):
    """Delete a task"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id, created_by_user_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        task = task_result.data

        # Check if creator or can manage list
        if task["created_by_user_id"] != user["id"]:
            can_manage = await can_manage_task_list(supabase, task["task_list_id"], user["id"])
            if not can_manage:
                # Also check if user has edit access
                await verify_task_list_access(supabase, task["task_list_id"], user["id"], require_edit=True)

        supabase.table("backlot_tasks").delete().eq("id", task_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK ASSIGNEES & WATCHERS ENDPOINTS
# =====================================================

@router.post("/tasks/{task_id}/assignees")
async def add_task_assignee(
    task_id: str,
    user_id: str = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Add an assignee to a task"""
    current_user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify edit access
        await verify_task_list_access(supabase, task_result.data["task_list_id"], current_user["id"], require_edit=True)

        # Check if already assigned
        existing = supabase.table("backlot_task_assignees").select("id").eq("task_id", task_id).eq("user_id", user_id).single().execute()

        if existing.data:
            return {"success": True, "assignee": existing.data}

        result = supabase.table("backlot_task_assignees").insert({
            "task_id": task_id,
            "user_id": user_id,
        }).execute()

        return {"success": True, "assignee": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding assignee: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}/assignees/{assignee_id}")
async def remove_task_assignee(
    task_id: str,
    assignee_id: str,
    authorization: str = Header(None)
):
    """Remove an assignee from a task"""
    current_user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify edit access
        await verify_task_list_access(supabase, task_result.data["task_list_id"], current_user["id"], require_edit=True)

        supabase.table("backlot_task_assignees").delete().eq("id", assignee_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing assignee: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/watchers")
async def add_task_watcher(
    task_id: str,
    user_id: str = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Add a watcher to a task"""
    current_user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify view access (anyone who can view can watch)
        await verify_task_list_access(supabase, task_result.data["task_list_id"], current_user["id"])

        # Check if already watching
        existing = supabase.table("backlot_task_watchers").select("id").eq("task_id", task_id).eq("user_id", user_id).single().execute()

        if existing.data:
            return {"success": True, "watcher": existing.data}

        result = supabase.table("backlot_task_watchers").insert({
            "task_id": task_id,
            "user_id": user_id,
        }).execute()

        return {"success": True, "watcher": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding watcher: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}/watchers/{watcher_id}")
async def remove_task_watcher(
    task_id: str,
    watcher_id: str,
    authorization: str = Header(None)
):
    """Remove a watcher from a task"""
    current_user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get watcher to check ownership
        watcher_result = supabase.table("backlot_task_watchers").select("user_id, task_id").eq("id", watcher_id).single().execute()

        if not watcher_result.data:
            raise HTTPException(status_code=404, detail="Watcher not found")

        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", watcher_result.data["task_id"]).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # User can remove themselves or admins can remove anyone
        if watcher_result.data["user_id"] != current_user["id"]:
            can_manage = await can_manage_task_list(supabase, task_result.data["task_list_id"], current_user["id"])
            if not can_manage:
                raise HTTPException(status_code=403, detail="You can only remove yourself as a watcher")

        supabase.table("backlot_task_watchers").delete().eq("id", watcher_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing watcher: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK LABELS ENDPOINTS
# =====================================================

@router.get("/projects/{project_id}/task-labels")
async def get_project_task_labels(
    project_id: str,
    authorization: str = Header(None)
):
    """Get all task labels for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        await verify_project_access(supabase, project_id, user["id"])

        result = supabase.table("backlot_task_labels").select("*").eq("project_id", project_id).order("name").execute()

        return {"success": True, "labels": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task labels: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/task-labels")
async def create_task_label(
    project_id: str,
    request: TaskLabelCreate,
    authorization: str = Header(None)
):
    """Create a new task label for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        await verify_project_access(supabase, project_id, user["id"], require_edit=True)

        result = supabase.table("backlot_task_labels").insert({
            "project_id": project_id,
            "name": request.name,
            "color": request.color,
        }).execute()

        return {"success": True, "label": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating task label: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task-labels/{label_id}")
async def delete_task_label(
    label_id: str,
    authorization: str = Header(None)
):
    """Delete a task label"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get label to find project
        label_result = supabase.table("backlot_task_labels").select("project_id").eq("id", label_id).single().execute()

        if not label_result.data:
            raise HTTPException(status_code=404, detail="Label not found")

        # Verify edit access
        await verify_project_access(supabase, label_result.data["project_id"], user["id"], require_edit=True)

        supabase.table("backlot_task_labels").delete().eq("id", label_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting task label: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/labels")
async def add_task_label(
    task_id: str,
    label_id: str = Body(..., embed=True),
    authorization: str = Header(None)
):
    """Add a label to a task"""
    current_user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify edit access
        await verify_task_list_access(supabase, task_result.data["task_list_id"], current_user["id"], require_edit=True)

        # Check if already linked
        existing = supabase.table("backlot_task_label_links").select("id").eq("task_id", task_id).eq("label_id", label_id).single().execute()

        if existing.data:
            return {"success": True, "label_link": existing.data}

        result = supabase.table("backlot_task_label_links").insert({
            "task_id": task_id,
            "label_id": label_id,
        }).execute()

        return {"success": True, "label_link": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding task label: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}/labels/{label_link_id}")
async def remove_task_label(
    task_id: str,
    label_link_id: str,
    authorization: str = Header(None)
):
    """Remove a label from a task"""
    current_user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify edit access
        await verify_task_list_access(supabase, task_result.data["task_list_id"], current_user["id"], require_edit=True)

        supabase.table("backlot_task_label_links").delete().eq("id", label_link_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing task label: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK COMMENTS ENDPOINTS
# =====================================================

@router.get("/tasks/{task_id}/comments")
async def get_task_comments(
    task_id: str,
    authorization: str = Header(None)
):
    """Get comments for a task"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify view access
        await verify_task_list_access(supabase, task_result.data["task_list_id"], user["id"])

        result = supabase.table("backlot_task_comments").select("*").eq("task_id", task_id).order("created_at").execute()

        return {"success": True, "comments": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/comments")
async def create_task_comment(
    task_id: str,
    request: TaskCommentCreate,
    authorization: str = Header(None)
):
    """Add a comment to a task"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get task
        task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", task_id).single().execute()

        if not task_result.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Verify view access (anyone who can view can comment)
        await verify_task_list_access(supabase, task_result.data["task_list_id"], user["id"])

        result = supabase.table("backlot_task_comments").insert({
            "task_id": task_id,
            "author_user_id": user["id"],
            "body": request.body,
        }).execute()

        return {"success": True, "comment": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/task-comments/{comment_id}")
async def update_task_comment(
    comment_id: str,
    request: TaskCommentUpdate,
    authorization: str = Header(None)
):
    """Update a comment"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get comment
        comment_result = supabase.table("backlot_task_comments").select("author_user_id").eq("id", comment_id).single().execute()

        if not comment_result.data:
            raise HTTPException(status_code=404, detail="Comment not found")

        # Only author can edit
        if comment_result.data["author_user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="You can only edit your own comments")

        result = supabase.table("backlot_task_comments").update({
            "body": request.body,
        }).eq("id", comment_id).execute()

        return {"success": True, "comment": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task-comments/{comment_id}")
async def delete_task_comment(
    comment_id: str,
    authorization: str = Header(None)
):
    """Delete a comment"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get comment
        comment_result = supabase.table("backlot_task_comments").select("author_user_id, task_id").eq("id", comment_id).single().execute()

        if not comment_result.data:
            raise HTTPException(status_code=404, detail="Comment not found")

        comment = comment_result.data

        # Author can delete, or admins
        if comment["author_user_id"] != user["id"]:
            # Get task to check permissions
            task_result = supabase.table("backlot_tasks").select("task_list_id").eq("id", comment["task_id"]).single().execute()

            if task_result.data:
                can_manage = await can_manage_task_list(supabase, task_result.data["task_list_id"], user["id"])
                if not can_manage:
                    raise HTTPException(status_code=403, detail="You can only delete your own comments")

        supabase.table("backlot_task_comments").delete().eq("id", comment_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK VIEWS ENDPOINTS
# =====================================================

@router.get("/task-lists/{task_list_id}/views")
async def get_task_list_views(
    task_list_id: str,
    authorization: str = Header(None)
):
    """Get views for a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        await verify_task_list_access(supabase, task_list_id, user["id"])

        result = supabase.table("backlot_task_views").select("*").eq("task_list_id", task_list_id).order("created_at").execute()

        return {"success": True, "views": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting task views: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task-lists/{task_list_id}/views")
async def create_task_view(
    task_list_id: str,
    request: TaskViewCreate,
    authorization: str = Header(None)
):
    """Create a new view for a task list"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        await verify_task_list_access(supabase, task_list_id, user["id"], require_edit=True)

        # If setting as default, unset other defaults
        if request.is_default:
            supabase.table("backlot_task_views").update({"is_default": False}).eq("task_list_id", task_list_id).execute()

        result = supabase.table("backlot_task_views").insert({
            "task_list_id": task_list_id,
            "name": request.name,
            "view_type": request.view_type,
            "config": request.config or {},
            "is_default": request.is_default or False,
            "created_by_user_id": user["id"],
        }).execute()

        return {"success": True, "view": result.data[0] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating task view: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/task-views/{view_id}")
async def update_task_view(
    view_id: str,
    request: TaskViewUpdate,
    authorization: str = Header(None)
):
    """Update a task view"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get view
        view_result = supabase.table("backlot_task_views").select("task_list_id, created_by_user_id").eq("id", view_id).single().execute()

        if not view_result.data:
            raise HTTPException(status_code=404, detail="View not found")

        view = view_result.data

        # Check if creator or can manage list
        if view["created_by_user_id"] != user["id"]:
            can_manage = await can_manage_task_list(supabase, view["task_list_id"], user["id"])
            if not can_manage:
                raise HTTPException(status_code=403, detail="You don't have permission to edit this view")

        # Build update data
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.view_type is not None:
            update_data["view_type"] = request.view_type
        if request.config is not None:
            update_data["config"] = request.config
        if request.is_default is not None:
            # If setting as default, unset other defaults
            if request.is_default:
                supabase.table("backlot_task_views").update({"is_default": False}).eq("task_list_id", view["task_list_id"]).execute()
            update_data["is_default"] = request.is_default

        if update_data:
            result = supabase.table("backlot_task_views").update(update_data).eq("id", view_id).execute()
            return {"success": True, "view": result.data[0] if result.data else None}

        return {"success": True, "view": view}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating task view: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task-views/{view_id}")
async def delete_task_view(
    view_id: str,
    authorization: str = Header(None)
):
    """Delete a task view"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        # Get view
        view_result = supabase.table("backlot_task_views").select("task_list_id, created_by_user_id").eq("id", view_id).single().execute()

        if not view_result.data:
            raise HTTPException(status_code=404, detail="View not found")

        view = view_result.data

        # Check if creator or can manage list
        if view["created_by_user_id"] != user["id"]:
            can_manage = await can_manage_task_list(supabase, view["task_list_id"], user["id"])
            if not can_manage:
                raise HTTPException(status_code=403, detail="You don't have permission to delete this view")

        supabase.table("backlot_task_views").delete().eq("id", view_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting task view: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TASK REORDERING ENDPOINT
# =====================================================

class TaskReorderItem(BaseModel):
    id: str
    sort_index: float
    status: Optional[str] = None
    section: Optional[str] = None


class TaskReorderRequest(BaseModel):
    tasks: List[TaskReorderItem]


@router.post("/task-lists/{task_list_id}/tasks/reorder")
async def reorder_tasks(
    task_list_id: str,
    request: TaskReorderRequest,
    authorization: str = Header(None)
):
    """Reorder tasks (for drag-and-drop) and optionally update status/section"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    try:
        await verify_task_list_access(supabase, task_list_id, user["id"], require_edit=True)

        # Verify all tasks belong to this list
        task_ids = [t.id for t in request.tasks]
        verify_result = supabase.table("backlot_tasks").select("id").eq("task_list_id", task_list_id).in_("id", task_ids).execute()

        if len(verify_result.data or []) != len(task_ids):
            raise HTTPException(status_code=400, detail="Some tasks don't belong to this task list")

        # Update each task
        for task_item in request.tasks:
            update_data = {
                "sort_index": task_item.sort_index,
                "last_updated_by_user_id": user["id"],
            }

            if task_item.status is not None:
                update_data["status"] = task_item.status
                update_data["is_completed"] = task_item.status == "done"

            if task_item.section is not None:
                update_data["section"] = task_item.section

            supabase.table("backlot_tasks").update(update_data).eq("id", task_item.id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reordering tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))
