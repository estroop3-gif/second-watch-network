"""
Connection Manager - DynamoDB operations for WebSocket connections
Uses single-table design with PK/SK + GSIs for efficient queries
"""
import boto3
import json
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict
import time
import logging

logger = logging.getLogger(__name__)

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'second-watch-websocket-connections')
table = dynamodb.Table(CONNECTIONS_TABLE)

# API Gateway Management API client (lazy initialized)
_apigw_client = None
_apigw_endpoint = None


def get_apigw_client(callback_url: str):
    """Get or create API Gateway Management API client"""
    global _apigw_client, _apigw_endpoint
    if _apigw_client is None or _apigw_endpoint != callback_url:
        _apigw_endpoint = callback_url
        _apigw_client = boto3.client(
            'apigatewaymanagementapi',
            endpoint_url=callback_url
        )
    return _apigw_client


def get_ttl(hours: int = 24) -> int:
    """Get TTL timestamp hours from now"""
    return int(time.time()) + (hours * 3600)


# =============================================================================
# CONNECTION OPERATIONS
# =============================================================================

def store_connection(connection_id: str, user_id: str, username: str = None, full_name: str = None):
    """Store new connection in DynamoDB"""
    now = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item={
            'PK': f'CONNECTION#{connection_id}',
            'SK': f'CONNECTION#{connection_id}',
            'GSI1PK': f'USER#{user_id}',
            'GSI1SK': f'CONNECTION#{connection_id}',
            'connectionId': connection_id,
            'userId': user_id,
            'username': username,
            'fullName': full_name,
            'connectedAt': now,
            'ttl': get_ttl(24),
        })
        logger.info(f"Stored connection {connection_id} for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to store connection: {e}")
        raise


def remove_connection(connection_id: str):
    """Remove connection and all subscriptions"""
    try:
        # First get all subscriptions for this connection via GSI1
        subscriptions = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={':pk': f'CONNECTION#{connection_id}'}
        ).get('Items', [])

        # Delete connection record
        table.delete_item(Key={
            'PK': f'CONNECTION#{connection_id}',
            'SK': f'CONNECTION#{connection_id}'
        })

        # Delete all subscription records
        for sub in subscriptions:
            table.delete_item(Key={'PK': sub['PK'], 'SK': sub['SK']})

        logger.info(f"Removed connection {connection_id} and {len(subscriptions)} subscriptions")
    except Exception as e:
        logger.error(f"Failed to remove connection: {e}")


def get_connection(connection_id: str) -> Optional[Dict]:
    """Get connection details"""
    try:
        result = table.get_item(Key={
            'PK': f'CONNECTION#{connection_id}',
            'SK': f'CONNECTION#{connection_id}'
        })
        return result.get('Item')
    except Exception as e:
        logger.error(f"Failed to get connection: {e}")
        return None


def get_user_connections(user_id: str) -> List[str]:
    """Get all connection IDs for a user"""
    try:
        result = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={':pk': f'USER#{user_id}'}
        )
        return [item['connectionId'] for item in result.get('Items', [])
                if item.get('SK', '').startswith('CONNECTION#')]
    except Exception as e:
        logger.error(f"Failed to get user connections: {e}")
        return []


# =============================================================================
# CHANNEL SUBSCRIPTION OPERATIONS
# =============================================================================

def subscribe_to_channel(connection_id: str, channel_id: str, user_id: str):
    """Subscribe connection to a channel"""
    now = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item={
            'PK': f'CHANNEL#{channel_id}',
            'SK': f'CONNECTION#{connection_id}',
            'GSI1PK': f'CONNECTION#{connection_id}',
            'GSI1SK': f'CHANNEL#{channel_id}',
            'GSI2PK': f'USER#{user_id}',
            'GSI2SK': f'CHANNEL#{channel_id}',
            'channelId': channel_id,
            'connectionId': connection_id,
            'userId': user_id,
            'subscribedAt': now,
            'ttl': get_ttl(24),
        })
        logger.info(f"Subscribed connection {connection_id} to channel {channel_id}")
    except Exception as e:
        logger.error(f"Failed to subscribe to channel: {e}")
        raise


def unsubscribe_from_channel(connection_id: str, channel_id: str):
    """Unsubscribe connection from a channel"""
    try:
        table.delete_item(Key={
            'PK': f'CHANNEL#{channel_id}',
            'SK': f'CONNECTION#{connection_id}'
        })
        logger.info(f"Unsubscribed connection {connection_id} from channel {channel_id}")
    except Exception as e:
        logger.error(f"Failed to unsubscribe from channel: {e}")


def get_channel_connections(channel_id: str) -> List[Dict]:
    """Get all connections subscribed to a channel"""
    try:
        result = table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'CHANNEL#{channel_id}'}
        )
        return result.get('Items', [])
    except Exception as e:
        logger.error(f"Failed to get channel connections: {e}")
        return []


# =============================================================================
# DM (DIRECT MESSAGE) SUBSCRIPTION OPERATIONS
# =============================================================================

def subscribe_to_dm(connection_id: str, conversation_id: str, user_id: str):
    """Subscribe connection to a DM conversation"""
    now = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item={
            'PK': f'DM#{conversation_id}',
            'SK': f'CONNECTION#{connection_id}',
            'GSI1PK': f'CONNECTION#{connection_id}',
            'GSI1SK': f'DM#{conversation_id}',
            'GSI2PK': f'USER#{user_id}',
            'GSI2SK': f'DM#{conversation_id}',
            'conversationId': conversation_id,
            'connectionId': connection_id,
            'userId': user_id,
            'subscribedAt': now,
            'ttl': get_ttl(24),
        })
        logger.info(f"Subscribed connection {connection_id} to DM {conversation_id}")
    except Exception as e:
        logger.error(f"Failed to subscribe to DM: {e}")
        raise


def unsubscribe_from_dm(connection_id: str, conversation_id: str):
    """Unsubscribe connection from a DM conversation"""
    try:
        table.delete_item(Key={
            'PK': f'DM#{conversation_id}',
            'SK': f'CONNECTION#{connection_id}'
        })
        logger.info(f"Unsubscribed connection {connection_id} from DM {conversation_id}")
    except Exception as e:
        logger.error(f"Failed to unsubscribe from DM: {e}")


def get_dm_connections(conversation_id: str) -> List[Dict]:
    """Get all connections subscribed to a DM conversation"""
    try:
        result = table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'DM#{conversation_id}'}
        )
        return result.get('Items', [])
    except Exception as e:
        logger.error(f"Failed to get DM connections: {e}")
        return []


def broadcast_to_dm(callback_url: str, conversation_id: str, message: dict, exclude_connection: str = None):
    """Send message to all connections in a DM conversation"""
    client = get_apigw_client(callback_url)
    connections = get_dm_connections(conversation_id)

    message_data = json.dumps(message).encode('utf-8')
    stale_connections = []

    for conn in connections:
        conn_id = conn.get('connectionId')
        if conn_id == exclude_connection:
            continue
        try:
            client.post_to_connection(
                ConnectionId=conn_id,
                Data=message_data
            )
        except client.exceptions.GoneException:
            stale_connections.append(conn_id)
        except Exception as e:
            logger.error(f"Failed to send to {conn_id}: {e}")

    # Cleanup stale connections
    for conn_id in stale_connections:
        remove_connection(conn_id)


# =============================================================================
# VOICE OPERATIONS
# =============================================================================

def join_voice(connection_id: str, channel_id: str, user_id: str, peer_id: str):
    """Add user to voice channel"""
    now = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item={
            'PK': f'VOICE#{channel_id}',
            'SK': f'CONNECTION#{connection_id}',
            'GSI1PK': f'USER#{user_id}',
            'GSI1SK': f'VOICE#{channel_id}',
            'channelId': channel_id,
            'connectionId': connection_id,
            'userId': user_id,
            'peerId': peer_id,
            'joinedAt': now,
            'isTransmitting': False,
            'ttl': get_ttl(24),
        })
        logger.info(f"User {user_id} joined voice in channel {channel_id}")
    except Exception as e:
        logger.error(f"Failed to join voice: {e}")
        raise


def leave_voice(connection_id: str, channel_id: str):
    """Remove user from voice channel"""
    try:
        table.delete_item(Key={
            'PK': f'VOICE#{channel_id}',
            'SK': f'CONNECTION#{connection_id}'
        })
        logger.info(f"Connection {connection_id} left voice in channel {channel_id}")
    except Exception as e:
        logger.error(f"Failed to leave voice: {e}")


def get_voice_participants(channel_id: str) -> List[Dict]:
    """Get all voice participants in a channel"""
    try:
        result = table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'VOICE#{channel_id}'}
        )
        return result.get('Items', [])
    except Exception as e:
        logger.error(f"Failed to get voice participants: {e}")
        return []


def set_ptt_state(connection_id: str, channel_id: str, is_transmitting: bool):
    """Update PTT state for a voice participant"""
    try:
        table.update_item(
            Key={
                'PK': f'VOICE#{channel_id}',
                'SK': f'CONNECTION#{connection_id}'
            },
            UpdateExpression='SET isTransmitting = :val',
            ExpressionAttributeValues={':val': is_transmitting}
        )
    except Exception as e:
        logger.error(f"Failed to set PTT state: {e}")


# =============================================================================
# BROADCAST OPERATIONS
# =============================================================================

def broadcast_to_channel(callback_url: str, channel_id: str, message: dict, exclude_connection: str = None):
    """Send message to all connections in a channel"""
    client = get_apigw_client(callback_url)
    connections = get_channel_connections(channel_id)

    message_data = json.dumps(message).encode('utf-8')
    stale_connections = []

    for conn in connections:
        conn_id = conn.get('connectionId')
        if conn_id == exclude_connection:
            continue
        try:
            client.post_to_connection(
                ConnectionId=conn_id,
                Data=message_data
            )
        except client.exceptions.GoneException:
            stale_connections.append(conn_id)
        except Exception as e:
            logger.error(f"Failed to send to {conn_id}: {e}")

    # Cleanup stale connections
    for conn_id in stale_connections:
        remove_connection(conn_id)


def broadcast_to_voice(callback_url: str, channel_id: str, message: dict, exclude_connection: str = None):
    """Send message to all voice participants in a channel"""
    client = get_apigw_client(callback_url)
    participants = get_voice_participants(channel_id)

    message_data = json.dumps(message).encode('utf-8')
    stale_connections = []

    for participant in participants:
        conn_id = participant.get('connectionId')
        if conn_id == exclude_connection:
            continue
        try:
            client.post_to_connection(
                ConnectionId=conn_id,
                Data=message_data
            )
        except client.exceptions.GoneException:
            stale_connections.append(conn_id)
        except Exception as e:
            logger.error(f"Failed to send to {conn_id}: {e}")

    # Cleanup stale connections
    for conn_id in stale_connections:
        remove_connection(conn_id)


def send_to_user(callback_url: str, user_id: str, message: dict):
    """Send message to all connections for a user"""
    client = get_apigw_client(callback_url)
    connections = get_user_connections(user_id)

    message_data = json.dumps(message).encode('utf-8')
    stale_connections = []

    for conn_id in connections:
        try:
            client.post_to_connection(
                ConnectionId=conn_id,
                Data=message_data
            )
        except client.exceptions.GoneException:
            stale_connections.append(conn_id)
        except Exception as e:
            logger.error(f"Failed to send to {conn_id}: {e}")

    # Cleanup stale connections
    for conn_id in stale_connections:
        remove_connection(conn_id)


def send_to_connection(callback_url: str, connection_id: str, message: dict):
    """Send message to a specific connection"""
    client = get_apigw_client(callback_url)
    try:
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(message).encode('utf-8')
        )
    except client.exceptions.GoneException:
        remove_connection(connection_id)
    except Exception as e:
        logger.error(f"Failed to send to {connection_id}: {e}")
