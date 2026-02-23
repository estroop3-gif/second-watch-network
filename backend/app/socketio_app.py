"""
Socket.IO Server for Coms Real-Time Communications
Handles messaging, voice signaling, presence, and typing indicators
"""
import socketio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Set
from app.core.cognito import CognitoAuth

logger = logging.getLogger(__name__)

# Create Socket.IO server with CORS
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True,
)

# Socket.IO ASGI app
# socketio_path should be empty since we mount at /socket.io in main.py
socket_app = socketio.ASGIApp(sio, socketio_path='')

# Track connected users and their sessions
# user_id -> set of socket ids
connected_users: Dict[str, Set[str]] = {}
# socket_id -> user info
socket_sessions: Dict[str, dict] = {}
# channel_id -> set of socket ids in voice
voice_channels: Dict[str, Set[str]] = {}


async def get_user_from_token(token: str) -> Optional[dict]:
    """Get user info from Cognito token."""
    # Handle Bearer prefix
    if token.startswith('Bearer '):
        token = token[7:]

    # Use Cognito token verification
    user = CognitoAuth.verify_token(token)
    if not user:
        logger.warning("[Socket] Token verification failed")
        return None

    return {
        'user_id': user.get('id'),
        'username': user.get('username'),
        'email': user.get('email'),
    }


# ============================================================================
# CONNECTION EVENTS
# ============================================================================

@sio.event
async def connect(sid: str, environ: dict, auth: dict):
    """Handle new socket connection."""
    logger.info(f"[Socket] Connection attempt: {sid}")

    token = auth.get('token') if auth else None
    if not token:
        logger.warning(f"[Socket] No token provided for {sid}")
        return False  # Reject connection

    user = await get_user_from_token(token)
    if not user or not user.get('user_id'):
        logger.warning(f"[Socket] Invalid token for {sid}")
        return False

    user_id = user['user_id']

    # Store session info
    socket_sessions[sid] = {
        'user_id': user_id,
        'username': user.get('username') or user.get('email'),
        'email': user.get('email'),
        'connected_at': datetime.now(timezone.utc).isoformat(),
    }

    # Track user's sockets
    was_offline = user_id not in connected_users or len(connected_users[user_id]) == 0
    if user_id not in connected_users:
        connected_users[user_id] = set()
    connected_users[user_id].add(sid)

    # Broadcast online status if this is user's first connection and they have it enabled
    if was_offline and get_user_online_status_preference(user_id):
        await sio.emit('user_presence_changed', {
            'user_id': user_id,
            'status': 'online',
        })

    logger.info(f"[Socket] User {user_id} connected with sid {sid}")
    return True


@sio.event
async def disconnect(sid: str):
    """Handle socket disconnection."""
    session = socket_sessions.pop(sid, None)
    if not session:
        return

    user_id = session.get('user_id')
    if user_id and user_id in connected_users:
        connected_users[user_id].discard(sid)
        if not connected_users[user_id]:
            del connected_users[user_id]
            # Only broadcast offline status if user has online status enabled
            if get_user_online_status_preference(user_id):
                await sio.emit('user_presence_changed', {
                    'user_id': user_id,
                    'status': 'offline',
                })

    # Remove from voice channels
    for channel_id, participants in list(voice_channels.items()):
        if sid in participants:
            participants.discard(sid)
            await sio.emit('voice_user_left', {
                'channel_id': channel_id,
                'user_id': user_id,
            }, room=channel_id)

    logger.info(f"[Socket] User {user_id} disconnected (sid: {sid})")


# ============================================================================
# CHANNEL EVENTS
# ============================================================================

@sio.event
async def join_channel(sid: str, data: dict):
    """Join a channel room for real-time updates."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    await sio.enter_room(sid, channel_id)
    logger.info(f"[Socket] {session['user_id']} joined channel {channel_id}")


@sio.event
async def leave_channel(sid: str, data: dict):
    """Leave a channel room."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    await sio.leave_room(sid, channel_id)
    logger.info(f"[Socket] {session['user_id']} left channel {channel_id}")


# ============================================================================
# MESSAGING EVENTS
# ============================================================================

@sio.event
async def send_message(sid: str, data: dict):
    """Handle new message - broadcast to channel."""
    channel_id = data.get('channel_id')
    content = data.get('content')
    message_type = data.get('message_type', 'text')

    if not channel_id or not content:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    user_id = session['user_id']

    # Create message object (in real implementation, save to DB first)
    message = {
        'id': f"msg_{datetime.now(timezone.utc).timestamp()}",
        'channel_id': channel_id,
        'sender_id': user_id,
        'content': content,
        'message_type': message_type,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'sender': {
            'id': user_id,
            'username': session.get('username'),
            'email': session.get('email'),
        }
    }

    # Broadcast to channel
    await sio.emit('new_message', {
        'channel_id': channel_id,
        'message': message,
    }, room=channel_id)

    logger.info(f"[Socket] Message sent to channel {channel_id} by {user_id}")


@sio.event
async def typing_start(sid: str, data: dict):
    """User started typing."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    await sio.emit('user_typing', {
        'channel_id': channel_id,
        'user_id': session['user_id'],
        'username': session.get('username') or session.get('email'),
    }, room=channel_id, skip_sid=sid)


@sio.event
async def typing_stop(sid: str, data: dict):
    """User stopped typing."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    await sio.emit('user_stopped_typing', {
        'channel_id': channel_id,
        'user_id': session['user_id'],
    }, room=channel_id, skip_sid=sid)


# ============================================================================
# VOICE EVENTS (WebRTC Signaling)
# ============================================================================

@sio.event
async def voice_join(sid: str, data: dict):
    """User joining voice channel."""
    channel_id = data.get('channel_id')
    peer_id = data.get('peer_id')

    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    user_id = session['user_id']

    # Add to voice channel
    if channel_id not in voice_channels:
        voice_channels[channel_id] = set()
    voice_channels[channel_id].add(sid)

    # Join the voice room
    await sio.enter_room(sid, f"voice:{channel_id}")

    # Notify others in the channel
    await sio.emit('voice_user_joined', {
        'channel_id': channel_id,
        'user_id': user_id,
        'username': session.get('username') or session.get('email'),
        'peer_id': peer_id,
    }, room=f"voice:{channel_id}", skip_sid=sid)

    logger.info(f"[Socket] {user_id} joined voice in {channel_id}")


@sio.event
async def voice_leave(sid: str, data: dict):
    """User leaving voice channel."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    user_id = session['user_id']

    # Remove from voice channel
    if channel_id in voice_channels:
        voice_channels[channel_id].discard(sid)
        if not voice_channels[channel_id]:
            del voice_channels[channel_id]

    # Leave voice room
    await sio.leave_room(sid, f"voice:{channel_id}")

    # Notify others
    await sio.emit('voice_user_left', {
        'channel_id': channel_id,
        'user_id': user_id,
    }, room=f"voice:{channel_id}")

    logger.info(f"[Socket] {user_id} left voice in {channel_id}")


@sio.event
async def voice_offer(sid: str, data: dict):
    """Relay WebRTC offer to target user."""
    to_user_id = data.get('to_user_id')
    offer = data.get('offer')

    if not to_user_id or not offer:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    # Find target user's socket(s)
    target_sids = connected_users.get(to_user_id, set())
    for target_sid in target_sids:
        await sio.emit('voice_offer', {
            'from_user_id': session['user_id'],
            'offer': offer,
        }, room=target_sid)


@sio.event
async def voice_answer(sid: str, data: dict):
    """Relay WebRTC answer to target user."""
    to_user_id = data.get('to_user_id')
    answer = data.get('answer')

    if not to_user_id or not answer:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    target_sids = connected_users.get(to_user_id, set())
    for target_sid in target_sids:
        await sio.emit('voice_answer', {
            'from_user_id': session['user_id'],
            'answer': answer,
        }, room=target_sid)


@sio.event
async def voice_ice_candidate(sid: str, data: dict):
    """Relay ICE candidate to target user."""
    to_user_id = data.get('to_user_id')
    candidate = data.get('candidate')

    if not to_user_id or not candidate:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    target_sids = connected_users.get(to_user_id, set())
    for target_sid in target_sids:
        await sio.emit('voice_ice_candidate', {
            'from_user_id': session['user_id'],
            'candidate': candidate,
        }, room=target_sid)


@sio.event
async def ptt_start(sid: str, data: dict):
    """User started push-to-talk (transmitting)."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    user_id = session['user_id']

    # Update database so REST API polling picks up the change
    try:
        from app.core.database import execute_update
        execute_update(
            """
            UPDATE coms_voice_participants vp
            SET is_transmitting = TRUE, last_activity_at = NOW()
            FROM coms_voice_rooms vr
            WHERE vp.room_id = vr.id
              AND vr.channel_id = :channel_id
              AND vp.user_id = :user_id
            """,
            {"channel_id": channel_id, "user_id": user_id}
        )
    except Exception as e:
        logger.warning(f"Failed to update PTT state in database: {e}")

    await sio.emit('ptt_active', {
        'channel_id': channel_id,
        'user_id': user_id,
        'username': session.get('username') or session.get('email'),
        'is_transmitting': True,
    }, room=f"voice:{channel_id}")


@sio.event
async def ptt_stop(sid: str, data: dict):
    """User stopped push-to-talk."""
    channel_id = data.get('channel_id')
    if not channel_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    user_id = session['user_id']

    # Update database so REST API polling picks up the change
    try:
        from app.core.database import execute_update
        execute_update(
            """
            UPDATE coms_voice_participants vp
            SET is_transmitting = FALSE, last_activity_at = NOW()
            FROM coms_voice_rooms vr
            WHERE vp.room_id = vr.id
              AND vr.channel_id = :channel_id
              AND vp.user_id = :user_id
            """,
            {"channel_id": channel_id, "user_id": user_id}
        )
    except Exception as e:
        logger.warning(f"Failed to update PTT state in database: {e}")

    await sio.emit('ptt_active', {
        'channel_id': channel_id,
        'user_id': user_id,
        'username': session.get('username') or session.get('email'),
        'is_transmitting': False,
    }, room=f"voice:{channel_id}")


# ============================================================================
# PRESENCE EVENTS
# ============================================================================

@sio.event
async def update_presence(sid: str, data: dict):
    """Update user presence status."""
    status = data.get('status', 'online')
    current_channel_id = data.get('current_channel_id')
    current_project_id = data.get('current_project_id')

    session = socket_sessions.get(sid)
    if not session:
        return

    user_id = session['user_id']

    # Only broadcast presence update if user has online status enabled
    if get_user_online_status_preference(user_id):
        await sio.emit('user_presence_changed', {
            'user_id': user_id,
            'status': status,
            'current_channel_id': current_channel_id,
            'current_project_id': current_project_id,
        })


# ============================================================================
# PROJECT UPDATES (for unified inbox)
# ============================================================================

@sio.event
async def join_project_updates(sid: str, data: dict):
    """Join a project updates room for real-time inbox notifications."""
    project_id = data.get('project_id')
    if not project_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    room_name = f"project_updates:{project_id}"
    await sio.enter_room(sid, room_name)
    logger.info(f"[Socket] {session['user_id']} joined project updates room {room_name}")


@sio.event
async def leave_project_updates(sid: str, data: dict):
    """Leave a project updates room."""
    project_id = data.get('project_id')
    if not project_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    room_name = f"project_updates:{project_id}"
    await sio.leave_room(sid, room_name)
    logger.info(f"[Socket] {session['user_id']} left project updates room {room_name}")


async def broadcast_project_update(project_id: str, update: dict, exclude_user_id: str = None):
    """
    Broadcast a new project update to all members subscribed to the project.
    Called from backlot.py when a new update is created.
    """
    room_name = f"project_updates:{project_id}"

    # Find sids to exclude based on user_id
    exclude_sids = []
    if exclude_user_id and exclude_user_id in connected_users:
        exclude_sids = list(connected_users[exclude_user_id])

    await sio.emit('project_new_update', {
        'project_id': project_id,
        'update': update,
    }, room=room_name, skip_sid=exclude_sids[0] if exclude_sids else None)

    logger.info(f"[Socket] Broadcasted project update to room {room_name}")


# ============================================================================
# BUDGET REAL-TIME UPDATES
# ============================================================================

@sio.event
async def join_budget_updates(sid: str, data: dict):
    """Join a budget updates room for real-time budget notifications."""
    project_id = data.get('project_id')
    if not project_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    room_name = f"budget_updates:{project_id}"
    await sio.enter_room(sid, room_name)
    logger.info(f"[Socket] {session['user_id']} joined budget updates room {room_name}")


@sio.event
async def leave_budget_updates(sid: str, data: dict):
    """Leave a budget updates room."""
    project_id = data.get('project_id')
    if not project_id:
        return

    session = socket_sessions.get(sid)
    if not session:
        return

    room_name = f"budget_updates:{project_id}"
    await sio.leave_room(sid, room_name)
    logger.info(f"[Socket] {session['user_id']} left budget updates room {room_name}")


async def broadcast_budget_update(project_id: str, event_type: str, data: dict, exclude_user_id: str = None):
    """
    Broadcast a budget update to all members subscribed to the project.
    event_type: actual_recorded | line_item_changed | budget_locked | dood_synced
    """
    room_name = f"budget_updates:{project_id}"

    exclude_sids = []
    if exclude_user_id and exclude_user_id in connected_users:
        exclude_sids = list(connected_users[exclude_user_id])

    await sio.emit('budget_update', {
        'project_id': project_id,
        'event_type': event_type,
        'data': data,
    }, room=room_name, skip_sid=exclude_sids[0] if exclude_sids else None)

    logger.info(f"[Socket] Broadcasted budget {event_type} to room {room_name}")


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def broadcast_to_channel(channel_id: str, event: str, data: dict, exclude_sid: str = None):
    """Broadcast event to all users in a channel."""
    await sio.emit(event, data, room=channel_id, skip_sid=exclude_sid)


async def send_to_user(user_id: str, event: str, data: dict):
    """Send event to a specific user (all their sockets)."""
    sids = connected_users.get(user_id, set())
    for sid in sids:
        await sio.emit(event, data, room=sid)


def get_online_users() -> list:
    """Get list of currently online user IDs."""
    return list(connected_users.keys())


def is_user_online(user_id: str) -> bool:
    """Check if a user is currently online."""
    return user_id in connected_users and len(connected_users[user_id]) > 0


async def broadcast_new_community_member(profile_id: str, full_name: str = None):
    """
    Broadcast that a new community member has joined.
    Called from auth.py when a new profile is created via ensure_profile.
    All connected clients can invalidate their directory cache.
    """
    await sio.emit('community_member_joined', {
        'profile_id': profile_id,
        'full_name': full_name,
    })
    logger.info(f"[Socket] Broadcasted new community member: {profile_id}")


def get_user_online_status_preference(user_id: str) -> bool:
    """Check if user has online status visibility enabled."""
    try:
        from app.core.database import get_client
        client = get_client()
        response = client.table("user_message_preferences").select(
            "show_online_status"
        ).eq("user_id", user_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0].get("show_online_status", True)
        return True  # Default to showing online status
    except Exception as e:
        logger.warning(f"Could not fetch online status preference for {user_id}: {e}")
        return True  # Default to showing on error
