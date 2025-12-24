"""
$connect route handler - WebSocket connection establishment
"""
import logging
from auth import get_user_from_event
from connection_manager import store_connection

logger = logging.getLogger(__name__)


def handler(event: dict, context, connection_id: str, callback_url: str) -> dict:
    """
    Handle new WebSocket connection.
    Authenticates the user and stores connection in DynamoDB.

    Returns 200 to accept connection, 401 to reject.
    """
    logger.info(f"$connect: connection_id={connection_id}")

    # Authenticate user from token
    user = get_user_from_event(event)
    if not user:
        logger.warning(f"Authentication failed for connection {connection_id}")
        return {
            'statusCode': 401,
            'body': 'Unauthorized'
        }

    user_id = user['user_id']
    username = user.get('username')
    email = user.get('email')

    # Store connection in DynamoDB
    try:
        store_connection(
            connection_id=connection_id,
            user_id=user_id,
            username=username,
            full_name=username  # Use username as display name
        )

        logger.info(f"Connection established: {connection_id} for user {user_id}")

        return {
            'statusCode': 200,
            'body': 'Connected'
        }

    except Exception as e:
        logger.error(f"Failed to store connection: {e}")
        return {
            'statusCode': 500,
            'body': 'Internal Server Error'
        }
