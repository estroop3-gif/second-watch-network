"""
Socket.IO Server for Coms Real-Time Communications
Handles messaging, voice signaling, presence, and typing indicators
"""
import socketio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Set
from jose import jwt, JWTError
from app.core.config import settings

logger = logging.getLogger(__name__)

# Create Socket.IO server with CORS
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True,
)

# Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, socketio_path='/socket.io')

# Track connected users and their sessions
# user_id -> set of socket ids
connected_users: Dict[str, Set[str]] = {}
# socket_id -> user info
socket_sessions: Dict[str, dict] = {}
# channel_id -> set of socket ids in voice
voice_channels: Dict[str, Set[str]] = {}


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token."""
    try:
        # Handle Bearer prefix
        if token.startswith('Bearer '):
            token = token[7:]

        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None


async def get_user_from_token(token: str) -> Optional[dict]:
    """Get user info from token."""
    payload = decode_token(token)
    if not payload:
        return None

    return {
        'user_id': payload.get('sub'),
        'username': payload.get('username'),
        'full_name': payload.get('full_name'),
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
        'username': user.get('username'),
        'full_name': user.get('full_name'),
        'connected_at': datetime.now(timezone.utc).isoformat(),
    }

    # Track user's sockets
    if user_id not in connected_users:
        connected_users[user_id] = set()
    connected_users[user_id].add(sid)

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
            # Broadcast offline status
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
            'full_name': session.get('full_name'),
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
        'username': session.get('username') or session.get('full_name'),
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
        'username': session.get('username') or session.get('full_name'),
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

    await sio.emit('ptt_active', {
        'channel_id': channel_id,
        'user_id': session['user_id'],
        'username': session.get('username') or session.get('full_name'),
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

    await sio.emit('ptt_active', {
        'channel_id': channel_id,
        'user_id': session['user_id'],
        'username': session.get('username') or session.get('full_name'),
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

    # Broadcast presence update
    await sio.emit('user_presence_changed', {
        'user_id': user_id,
        'status': status,
        'current_channel_id': current_channel_id,
        'current_project_id': current_project_id,
    })


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
