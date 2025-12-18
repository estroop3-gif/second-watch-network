"""
Authentication Dependencies and Utilities

Supports both AWS Cognito and Supabase authentication based on configuration.
"""
import os
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

from app.core.config import settings

# Feature flag to determine which auth provider to use
USE_AWS = getattr(settings, 'USE_AWS', False) or os.getenv('USE_AWS', 'false').lower() == 'true'

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    authorization: str = Header(None)
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from Bearer token.
    Validates the token with Cognito or Supabase based on configuration.
    """
    # Get token from credentials or header
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization:
        if authorization.startswith('Bearer '):
            token = authorization[7:]
        else:
            token = authorization

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        if USE_AWS:
            # Use Cognito authentication
            from app.core.cognito import CognitoAuth

            user = CognitoAuth.verify_token(token)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Return user dict compatible with existing code
            return {
                "id": user.get("id"),
                "email": user.get("email"),
                "user_metadata": {
                    "full_name": user.get("name"),
                },
            }
        else:
            # Use Supabase authentication (legacy)
            from app.core.supabase import get_supabase_client

            supabase = get_supabase_client()
            user_response = supabase.auth.get_user(token)

            if not user_response or not user_response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            user = user_response.user
            return user.model_dump() if hasattr(user, 'model_dump') else user.__dict__

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: str = Header(None)
) -> Optional[Dict[str, Any]]:
    """
    Optional authentication dependency.
    Returns user if authenticated, None otherwise.
    """
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization:
        if authorization.startswith('Bearer '):
            token = authorization[7:]
        else:
            token = authorization

    if not token:
        return None

    try:
        return await get_current_user(credentials, authorization)
    except:
        return None


def get_user_id(user: Dict[str, Any]) -> str:
    """
    Extract user ID from user dict (handles both Cognito and Supabase formats).
    """
    if isinstance(user, dict):
        return user.get("id") or user.get("sub") or user.get("user_id")
    return getattr(user, "id", None) or getattr(user, "sub", None)


def get_user_email(user: Dict[str, Any]) -> str:
    """
    Extract user email from user dict.
    """
    if isinstance(user, dict):
        return user.get("email")
    return getattr(user, "email", None)
