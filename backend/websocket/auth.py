"""
WebSocket Authentication - Cognito JWT verification
"""
import os
import logging
from typing import Optional, Dict
import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

# Cognito Configuration from environment
COGNITO_REGION = os.environ.get('COGNITO_REGION', 'us-east-1')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
COGNITO_CLIENT_ID = os.environ.get('COGNITO_CLIENT_ID')

# Cognito endpoints
COGNITO_ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
COGNITO_JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

# JWKS client (lazy initialized)
_jwks_client = None


def get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client"""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(COGNITO_JWKS_URL)
    return _jwks_client


def verify_token(token: str) -> Optional[Dict]:
    """
    Verify Cognito JWT and return user claims.

    Args:
        token: JWT access token (with or without 'Bearer ' prefix)

    Returns:
        Dict with user_id, email, username if valid, None otherwise
    """
    try:
        # Handle Bearer prefix if present
        if token.startswith('Bearer '):
            token = token[7:]

        if not token:
            logger.warning("Empty token provided")
            return None

        # Get signing key from JWKS
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify token
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            issuer=COGNITO_ISSUER,
            options={"verify_aud": False}  # Cognito uses client_id instead of aud
        )

        # Verify client_id if configured
        if COGNITO_CLIENT_ID and claims.get('client_id') != COGNITO_CLIENT_ID:
            logger.warning(f"Token client_id mismatch: {claims.get('client_id')}")
            return None

        # Extract user info
        user_info = {
            'user_id': claims.get('sub'),
            'email': claims.get('email'),
            'username': claims.get('cognito:username') or claims.get('username'),
        }

        logger.info(f"Token verified for user {user_info['user_id']}")
        return user_info

    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return None


def get_user_from_event(event: dict) -> Optional[Dict]:
    """
    Extract and verify user from WebSocket $connect event.
    Token is passed as query parameter: ?token=JWT

    Args:
        event: Lambda event from API Gateway WebSocket

    Returns:
        Dict with user_id, email, username if valid, None otherwise
    """
    try:
        # Get query string parameters
        query_params = event.get('queryStringParameters') or {}
        token = query_params.get('token')

        if not token:
            # Also check for Authorization header (fallback)
            headers = event.get('headers') or {}
            token = headers.get('Authorization') or headers.get('authorization')

        if not token:
            logger.warning("No token provided in query params or headers")
            return None

        return verify_token(token)

    except Exception as e:
        logger.error(f"Error extracting user from event: {e}")
        return None
