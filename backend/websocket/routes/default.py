"""
$default route handler - Message router for all WebSocket actions
Handles: channel management, messaging, voice signaling, PTT
"""
import json
import traceback
from typing import Dict, Any
from connection_manager import (
    get_connection,
    subscribe_to_channel,
    unsubscribe_from_channel,
    broadcast_to_channel,
    broadcast_to_voice,
    send_to_user,
    send_to_connection,
    join_voice,
    leave_voice,
    get_voice_participants,
    set_ptt_state,
    # DM operations
    subscribe_to_dm,
    unsubscribe_from_dm,
    broadcast_to_dm,
)


def handler(event: dict, context, connection_id: str, callback_url: str) -> dict:
    """
    Route incoming messages based on 'action' field.
    """
    try:
        # Parse message body
        body = event.get('body', '{}')
        if isinstance(body, str):
            message = json.loads(body)
        else:
            message = body

        action = message.get('action')
        if not action:
            print(f"[Default] No action in message from {connection_id}")
            return {'statusCode': 400, 'body': 'Missing action'}

        print(f"[Default] Processing action={action} from connection={connection_id}")

        # Get connection info
        connection = get_connection(connection_id)
        if not connection:
            print(f"[Default] Connection not found: {connection_id}")
            return {'statusCode': 401, 'body': 'Connection not found'}

        user_id = connection.get('userId')
        username = connection.get('username')
        print(f"[Default] User={user_id}, username={username}")

        # Route to appropriate handler
        handlers = {
            'join_channel': handle_join_channel,
            'leave_channel': handle_leave_channel,
            'send_message': handle_send_message,
            'typing_start': handle_typing_start,
            'typing_stop': handle_typing_stop,
            'voice_join': handle_voice_join,
            'voice_leave': handle_voice_leave,
            'voice_offer': handle_voice_offer,
            'voice_answer': handle_voice_answer,
            'voice_ice_candidate': handle_voice_ice_candidate,
            'ptt_start': handle_ptt_start,
            'ptt_stop': handle_ptt_stop,
            # DM handlers
            'join_dm': handle_join_dm,
            'leave_dm': handle_leave_dm,
            'dm_typing_start': handle_dm_typing_start,
            'dm_typing_stop': handle_dm_typing_stop,
        }

        handler_func = handlers.get(action)
        if handler_func:
            try:
                result = handler_func(
                    message=message,
                    connection_id=connection_id,
                    user_id=user_id,
                    username=username,
                    callback_url=callback_url
                )
                print(f"[Default] Action {action} returned status={result.get('statusCode')}")
                return result
            except Exception as e:
                print(f"[Default] Handler error for {action}: {e}")
                print(traceback.format_exc())
                return {'statusCode': 500, 'body': f'Handler error: {str(e)}'}
        else:
            print(f"[Default] Unknown action: {action}")
            return {'statusCode': 400, 'body': f'Unknown action: {action}'}

    except json.JSONDecodeError as e:
        print(f"[Default] Invalid JSON from {connection_id}: {e}")
        return {'statusCode': 400, 'body': 'Invalid JSON'}
    except Exception as e:
        print(f"[Default] Error handling message: {e}")
        print(traceback.format_exc())
        return {'statusCode': 500, 'body': 'Internal error'}


# =============================================================================
# CHANNEL HANDLERS
# =============================================================================

def handle_join_channel(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Subscribe to a channel"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    subscribe_to_channel(connection_id, channel_id, user_id)
    print(f"[Channel] User {user_id} joined channel {channel_id}")

    return {'statusCode': 200, 'body': 'Joined channel'}


def handle_leave_channel(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Unsubscribe from a channel"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    unsubscribe_from_channel(connection_id, channel_id)
    print(f"[Channel] User {user_id} left channel {channel_id}")

    return {'statusCode': 200, 'body': 'Left channel'}


# =============================================================================
# MESSAGING HANDLERS
# =============================================================================

def handle_send_message(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """
    Handle send_message - broadcasts to channel subscribers.
    Note: For persistence, this should also save to database.
    Currently just broadcasts for real-time delivery.
    """
    channel_id = message.get('channel_id')
    content = message.get('content')
    message_type = message.get('message_type', 'text')

    if not channel_id or not content:
        return {'statusCode': 400, 'body': 'Missing channel_id or content'}

    # TODO: Save message to PostgreSQL database here
    # For now, just broadcast for real-time

    # Broadcast to channel (excluding sender)
    broadcast_to_channel(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'new_message',
            'channel_id': channel_id,
            'message': {
                'id': f'temp_{connection_id}_{int(__import__("time").time() * 1000)}',
                'channel_id': channel_id,
                'sender_id': user_id,
                'content': content,
                'message_type': message_type,
                'created_at': __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                'sender': {
                    'id': user_id,
                    'username': username,
                    'full_name': username,
                    'avatar_url': None,
                    'production_role': None
                }
            }
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'Message sent'}


def handle_typing_start(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Broadcast typing indicator"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    broadcast_to_channel(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'user_typing',
            'channel_id': channel_id,
            'user_id': user_id,
            'username': username or 'Unknown'
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'OK'}


def handle_typing_stop(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Broadcast stopped typing"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    broadcast_to_channel(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'user_stopped_typing',
            'channel_id': channel_id,
            'user_id': user_id
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'OK'}


# =============================================================================
# DM (DIRECT MESSAGE) HANDLERS
# =============================================================================

def handle_join_dm(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Subscribe to a DM conversation for real-time updates"""
    conversation_id = message.get('conversation_id')
    if not conversation_id:
        return {'statusCode': 400, 'body': 'Missing conversation_id'}

    subscribe_to_dm(connection_id, conversation_id, user_id)
    print(f"[DM] User {user_id} joined DM conversation {conversation_id}")

    return {'statusCode': 200, 'body': 'Joined DM conversation'}


def handle_leave_dm(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Unsubscribe from a DM conversation"""
    conversation_id = message.get('conversation_id')
    if not conversation_id:
        return {'statusCode': 400, 'body': 'Missing conversation_id'}

    unsubscribe_from_dm(connection_id, conversation_id)
    print(f"[DM] User {user_id} left DM conversation {conversation_id}")

    return {'statusCode': 200, 'body': 'Left DM conversation'}


def handle_dm_typing_start(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Broadcast typing indicator in DM"""
    conversation_id = message.get('conversation_id')
    if not conversation_id:
        return {'statusCode': 400, 'body': 'Missing conversation_id'}

    broadcast_to_dm(
        callback_url=callback_url,
        conversation_id=conversation_id,
        message={
            'event': 'dm_typing',
            'conversation_id': conversation_id,
            'user_id': user_id,
            'username': username or 'Unknown',
            'is_typing': True
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'OK'}


def handle_dm_typing_stop(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Broadcast stopped typing in DM"""
    conversation_id = message.get('conversation_id')
    if not conversation_id:
        return {'statusCode': 400, 'body': 'Missing conversation_id'}

    broadcast_to_dm(
        callback_url=callback_url,
        conversation_id=conversation_id,
        message={
            'event': 'dm_typing',
            'conversation_id': conversation_id,
            'user_id': user_id,
            'username': username or 'Unknown',
            'is_typing': False
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'OK'}


# =============================================================================
# VOICE HANDLERS
# =============================================================================

def handle_voice_join(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Join voice channel"""
    channel_id = message.get('channel_id')
    peer_id = message.get('peer_id')

    if not channel_id or not peer_id:
        return {'statusCode': 400, 'body': 'Missing channel_id or peer_id'}

    # Get existing participants before joining
    existing_participants = get_voice_participants(channel_id)

    # Add to voice channel
    join_voice(connection_id, channel_id, user_id, peer_id)

    # Notify existing participants
    broadcast_to_voice(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'voice_user_joined',
            'channel_id': channel_id,
            'user_id': user_id,
            'username': username or 'Unknown',
            'peer_id': peer_id
        },
        exclude_connection=connection_id
    )

    # Send list of existing participants to the new user
    for participant in existing_participants:
        send_to_connection(
            callback_url=callback_url,
            connection_id=connection_id,
            message={
                'event': 'voice_user_joined',
                'channel_id': channel_id,
                'user_id': participant.get('userId'),
                'username': participant.get('username', 'Unknown'),
                'peer_id': participant.get('peerId')
            }
        )

    return {'statusCode': 200, 'body': 'Joined voice'}


def handle_voice_leave(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Leave voice channel"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    # Remove from voice channel
    leave_voice(connection_id, channel_id)

    # Notify remaining participants
    broadcast_to_voice(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'voice_user_left',
            'channel_id': channel_id,
            'user_id': user_id
        }
    )

    return {'statusCode': 200, 'body': 'Left voice'}


def handle_voice_offer(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Relay WebRTC offer to target user"""
    to_user_id = message.get('to_user_id')
    offer = message.get('offer')

    if not to_user_id or not offer:
        return {'statusCode': 400, 'body': 'Missing to_user_id or offer'}

    send_to_user(
        callback_url=callback_url,
        user_id=to_user_id,
        message={
            'event': 'voice_offer',
            'from_user_id': user_id,
            'offer': offer
        }
    )

    return {'statusCode': 200, 'body': 'Offer sent'}


def handle_voice_answer(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Relay WebRTC answer to target user"""
    to_user_id = message.get('to_user_id')
    answer = message.get('answer')

    if not to_user_id or not answer:
        return {'statusCode': 400, 'body': 'Missing to_user_id or answer'}

    send_to_user(
        callback_url=callback_url,
        user_id=to_user_id,
        message={
            'event': 'voice_answer',
            'from_user_id': user_id,
            'answer': answer
        }
    )

    return {'statusCode': 200, 'body': 'Answer sent'}


def handle_voice_ice_candidate(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Relay ICE candidate to target user"""
    to_user_id = message.get('to_user_id')
    candidate = message.get('candidate')

    if not to_user_id or not candidate:
        return {'statusCode': 400, 'body': 'Missing to_user_id or candidate'}

    send_to_user(
        callback_url=callback_url,
        user_id=to_user_id,
        message={
            'event': 'voice_ice_candidate',
            'from_user_id': user_id,
            'candidate': candidate
        }
    )

    return {'statusCode': 200, 'body': 'ICE candidate sent'}


# =============================================================================
# PTT HANDLERS
# =============================================================================

def handle_ptt_start(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Start PTT (push-to-talk)"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    set_ptt_state(connection_id, channel_id, True)

    broadcast_to_voice(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'ptt_active',
            'channel_id': channel_id,
            'user_id': user_id,
            'username': username or 'Unknown',
            'is_transmitting': True
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'PTT started'}


def handle_ptt_stop(message: Dict, connection_id: str, user_id: str, username: str, callback_url: str) -> dict:
    """Stop PTT (push-to-talk)"""
    channel_id = message.get('channel_id')
    if not channel_id:
        return {'statusCode': 400, 'body': 'Missing channel_id'}

    set_ptt_state(connection_id, channel_id, False)

    broadcast_to_voice(
        callback_url=callback_url,
        channel_id=channel_id,
        message={
            'event': 'ptt_active',
            'channel_id': channel_id,
            'user_id': user_id,
            'username': username or 'Unknown',
            'is_transmitting': False
        },
        exclude_connection=connection_id
    )

    return {'statusCode': 200, 'body': 'PTT stopped'}
