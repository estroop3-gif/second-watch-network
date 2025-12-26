"""
WebSocket Client - Broadcast messages to connected WebSocket clients
Uses AWS API Gateway Management API and DynamoDB for connection state
"""
import boto3
import json
import logging
from typing import Optional, List, Dict
from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialized clients
_apigw_client = None
_dynamodb = None
_table = None


def _get_dynamodb_table():
    """Get or create DynamoDB table resource"""
    global _dynamodb, _table
    if _dynamodb is None:
        _dynamodb = boto3.resource(
            'dynamodb',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None
        )
        _table = _dynamodb.Table(settings.WEBSOCKET_CONNECTIONS_TABLE)
    return _table


def _get_apigw_client(endpoint_url: str = None):
    """Get or create API Gateway Management API client"""
    global _apigw_client
    endpoint = endpoint_url or settings.WEBSOCKET_API_ENDPOINT
    if not endpoint:
        logger.warning("WebSocket API endpoint not configured")
        return None

    if _apigw_client is None:
        _apigw_client = boto3.client(
            'apigatewaymanagementapi',
            endpoint_url=endpoint,
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None
        )
    return _apigw_client


def get_dm_connections(conversation_id: str) -> List[Dict]:
    """Get all connections subscribed to a DM conversation"""
    try:
        table = _get_dynamodb_table()
        result = table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'DM#{conversation_id}'}
        )
        return result.get('Items', [])
    except Exception as e:
        logger.error(f"Failed to get DM connections: {e}")
        return []


def get_user_connections(user_id: str) -> List[str]:
    """Get all connection IDs for a user"""
    try:
        table = _get_dynamodb_table()
        result = table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={':pk': f'USER#{user_id}'}
        )
        return [
            item['connectionId'] for item in result.get('Items', [])
            if item.get('SK', '').startswith('CONNECTION#')
        ]
    except Exception as e:
        logger.error(f"Failed to get user connections: {e}")
        return []


def broadcast_to_dm(
    conversation_id: str,
    message: dict,
    exclude_user_id: Optional[str] = None
) -> bool:
    """
    Broadcast a message to all connections in a DM conversation.
    Returns True if at least one message was sent successfully.
    """
    if not settings.WEBSOCKET_API_ENDPOINT:
        logger.debug("WebSocket API endpoint not configured, skipping broadcast")
        return False

    client = _get_apigw_client()
    if not client:
        return False

    connections = get_dm_connections(conversation_id)
    if not connections:
        logger.debug(f"No connections for DM {conversation_id}")
        return False

    message_data = json.dumps(message).encode('utf-8')
    sent_count = 0
    stale_connections = []

    for conn in connections:
        conn_id = conn.get('connectionId')
        user_id = conn.get('userId')

        # Skip if this is the user we want to exclude
        if exclude_user_id and user_id == exclude_user_id:
            continue

        try:
            client.post_to_connection(
                ConnectionId=conn_id,
                Data=message_data
            )
            sent_count += 1
        except client.exceptions.GoneException:
            stale_connections.append(conn_id)
        except Exception as e:
            logger.error(f"Failed to send to {conn_id}: {e}")

    # Cleanup stale connections
    for conn_id in stale_connections:
        _remove_connection(conn_id)

    logger.info(f"Broadcast to DM {conversation_id}: {sent_count} sent, {len(stale_connections)} stale")
    return sent_count > 0


def send_to_user(user_id: str, message: dict) -> bool:
    """
    Send a message to all connections for a specific user.
    Useful for notifications.
    """
    if not settings.WEBSOCKET_API_ENDPOINT:
        return False

    client = _get_apigw_client()
    if not client:
        return False

    connections = get_user_connections(user_id)
    if not connections:
        return False

    message_data = json.dumps(message).encode('utf-8')
    sent_count = 0
    stale_connections = []

    for conn_id in connections:
        try:
            client.post_to_connection(
                ConnectionId=conn_id,
                Data=message_data
            )
            sent_count += 1
        except client.exceptions.GoneException:
            stale_connections.append(conn_id)
        except Exception as e:
            logger.error(f"Failed to send to {conn_id}: {e}")

    # Cleanup stale connections
    for conn_id in stale_connections:
        _remove_connection(conn_id)

    return sent_count > 0


def _remove_connection(connection_id: str):
    """Remove a stale connection from DynamoDB"""
    try:
        table = _get_dynamodb_table()

        # Get all subscriptions for this connection
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

        # Delete subscription records
        for sub in subscriptions:
            table.delete_item(Key={'PK': sub['PK'], 'SK': sub['SK']})

        logger.info(f"Removed stale connection {connection_id}")
    except Exception as e:
        logger.error(f"Failed to remove connection {connection_id}: {e}")
