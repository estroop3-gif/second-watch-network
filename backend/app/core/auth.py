"""
Authentication Dependencies and Utilities

Uses AWS Cognito for authentication.
"""
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    authorization: str = Header(None)
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from Bearer token.
    Validates the token with AWS Cognito and returns profile ID.
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
        # Use AWS Cognito authentication
        from app.core.cognito import CognitoAuth
        from app.core.database import get_client

        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        cognito_id = user.get("id")
        email = user.get("email")

        # Look up profile by cognito_user_id to get the profile ID
        client = get_client()
        profile_result = client.table("profiles").select("id, full_name").eq(
            "cognito_user_id", cognito_id
        ).execute()

        profile_id = None
        full_name = None
        if profile_result.data:
            profile_id = profile_result.data[0]["id"]
            full_name = profile_result.data[0].get("full_name")
        else:
            # Fallback: try lookup by email
            if email:
                profile_result = client.table("profiles").select("id, full_name").eq(
                    "email", email
                ).execute()
                if profile_result.data:
                    profile_id = profile_result.data[0]["id"]
                    full_name = profile_result.data[0].get("full_name")

        if not profile_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Return user dict with profile ID (compatible with existing code)
        return {
            "id": profile_id,
            "cognito_id": cognito_id,
            "email": email,
            "user_metadata": {
                "full_name": full_name or user.get("name"),
            },
        }

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
    Extract user ID from Cognito user dict.
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


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a JWT token and return the payload.
    Used by endpoints that manually handle auth.
    """
    try:
        from app.core.cognito import CognitoAuth
        return CognitoAuth.verify_token(token)
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None
