"""
WebSocket Lambda Handler - Entry point for all WebSocket events
"""
import json
import traceback

# Import route handlers
from routes import connect, disconnect, default


def handler(event, context):
    """
    Main WebSocket Lambda handler.
    Routes events to appropriate handlers based on routeKey.
    """
    # Extract request context
    request_context = event.get('requestContext', {})
    route_key = request_context.get('routeKey')
    connection_id = request_context.get('connectionId')
    domain_name = request_context.get('domainName')
    stage = request_context.get('stage')

    # Build callback URL for sending messages back to clients
    callback_url = f"https://{domain_name}/{stage}"

    # Parse body for logging
    body = event.get('body', '{}')
    action = None
    if body:
        try:
            parsed = json.loads(body) if isinstance(body, str) else body
            action = parsed.get('action', 'N/A')
        except:
            action = 'parse_error'

    print(f"[WebSocket] route={route_key}, connection={connection_id}, action={action}")

    # Route to appropriate handler
    handlers = {
        '$connect': connect.handler,
        '$disconnect': disconnect.handler,
        '$default': default.handler,
    }

    handler_func = handlers.get(route_key, default.handler)

    try:
        result = handler_func(event, context, connection_id, callback_url)
        print(f"[WebSocket] Handler returned: {result.get('statusCode')}")
        return result
    except Exception as e:
        print(f"[WebSocket] ERROR: {e}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': 'Internal Server Error'
        }
