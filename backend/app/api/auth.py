"""
Authentication API Routes

Supports both AWS Cognito and Supabase authentication based on configuration.
"""
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.config import settings
from app.core.auth import get_current_user

router = APIRouter()

# Feature flag to determine which auth provider to use
USE_AWS = getattr(settings, 'USE_AWS', False) or os.getenv('USE_AWS', 'false').lower() == 'true'


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class ConfirmSignUpRequest(BaseModel):
    email: EmailStr
    confirmation_code: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    confirmation_code: str
    new_password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: dict


@router.post("/signup", response_model=AuthResponse)
async def sign_up(request: SignUpRequest):
    """Register a new user"""
    try:
        if USE_AWS:
            from app.core.cognito import CognitoAuth
            from app.core.database import execute_insert

            # Sign up with Cognito
            result = CognitoAuth.sign_up(
                email=request.email,
                password=request.password,
                name=request.full_name
            )

            if result.get("error"):
                raise HTTPException(status_code=400, detail=result["error"]["message"])

            cognito_user = result["user"]

            # Create profile in database
            try:
                profile = execute_insert("""
                    INSERT INTO profiles (cognito_user_id, email, full_name, display_name)
                    VALUES (:cognito_user_id, :email, :full_name, :display_name)
                    RETURNING *
                """, {
                    "cognito_user_id": cognito_user["id"],
                    "email": request.email,
                    "full_name": request.full_name,
                    "display_name": request.full_name,
                })
            except Exception as e:
                print(f"Profile creation error: {e}")
                # Profile creation is optional, continue without it

            return {
                "access_token": "pending_confirmation",
                "refresh_token": None,
                "user": {
                    "id": cognito_user["id"],
                    "email": request.email,
                    "confirmed": cognito_user.get("confirmed", False),
                }
            }
        else:
            # Use Supabase authentication
            from app.core.supabase import get_supabase_client

            supabase = get_supabase_client()
            response = supabase.auth.sign_up({
                "email": request.email,
                "password": request.password,
                "options": {
                    "data": {"full_name": request.full_name} if request.full_name else {}
                }
            })

            if response.user is None:
                raise HTTPException(status_code=400, detail="Failed to create user")

            access_token = response.session.access_token if response.session else "temp_token_pending_confirmation"
            refresh_token = response.session.refresh_token if response.session else None

            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": response.user.model_dump() if hasattr(response.user, 'model_dump') else response.user.__dict__
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/confirm-signup")
async def confirm_sign_up(request: ConfirmSignUpRequest):
    """Confirm user registration with verification code (Cognito only)"""
    if not USE_AWS:
        raise HTTPException(status_code=400, detail="This endpoint is only available with AWS Cognito")

    try:
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.confirm_sign_up(
            email=request.email,
            confirmation_code=request.confirmation_code
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        return {"message": "Email confirmed successfully. You can now sign in."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin", response_model=AuthResponse)
async def sign_in(request: SignInRequest):
    """Sign in an existing user"""
    try:
        if USE_AWS:
            from app.core.cognito import CognitoAuth
            from app.core.database import execute_single

            result = CognitoAuth.sign_in(
                email=request.email,
                password=request.password
            )

            if result.get("error"):
                raise HTTPException(status_code=401, detail=result["error"]["message"])

            session = result["session"]
            cognito_user = result["user"]

            # Get or create profile from database
            profile = None
            if cognito_user:
                try:
                    profile = execute_single("""
                        SELECT * FROM profiles WHERE cognito_user_id = :cognito_user_id OR email = :email
                    """, {
                        "cognito_user_id": cognito_user.get("id"),
                        "email": request.email
                    })

                    # Update cognito_user_id if profile exists but doesn't have it
                    if profile and not profile.get("cognito_user_id"):
                        from app.core.database import execute_update
                        execute_update("""
                            UPDATE profiles SET cognito_user_id = :cognito_user_id WHERE id = :id
                        """, {
                            "cognito_user_id": cognito_user.get("id"),
                            "id": profile["id"]
                        })
                except Exception as e:
                    print(f"Profile lookup error: {e}")

            user_data = {
                "id": profile["id"] if profile else cognito_user.get("id"),
                "email": cognito_user.get("email") or request.email,
                "full_name": cognito_user.get("name"),
                "cognito_user_id": cognito_user.get("id"),
            }

            if profile:
                user_data.update({
                    "username": profile.get("username"),
                    "avatar_url": profile.get("avatar_url"),
                    "role": profile.get("role"),
                })

            return {
                "access_token": session["access_token"],
                "refresh_token": session.get("refresh_token"),
                "user": user_data
            }
        else:
            # Use Supabase authentication
            from app.core.supabase import get_supabase_client

            supabase = get_supabase_client()
            response = supabase.auth.sign_in_with_password({
                "email": request.email,
                "password": request.password
            })

            if response.user is None:
                raise HTTPException(status_code=401, detail="Invalid credentials")

            if response.session is None:
                raise HTTPException(status_code=401, detail="No session created")

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "user": response.user.model_dump() if hasattr(response.user, 'model_dump') else response.user.__dict__
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/signout")
async def sign_out(user=Depends(get_current_user)):
    """Sign out current user"""
    try:
        if USE_AWS:
            # Cognito sign out would invalidate tokens server-side
            # For now, client just discards tokens
            return {"message": "Successfully signed out"}
        else:
            from app.core.supabase import get_supabase_client
            supabase = get_supabase_client()
            supabase.auth.sign_out()
            return {"message": "Successfully signed out"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Initiate password reset flow"""
    try:
        if USE_AWS:
            from app.core.cognito import CognitoAuth

            result = CognitoAuth.forgot_password(email=request.email)

            if result.get("error"):
                # Don't reveal if email exists or not
                pass

            return {"message": "If an account exists with this email, a password reset code has been sent."}
        else:
            from app.core.supabase import get_supabase_client

            supabase = get_supabase_client()
            supabase.auth.reset_password_email(request.email)
            return {"message": "If an account exists with this email, a password reset link has been sent."}

    except Exception as e:
        # Don't reveal errors for security
        return {"message": "If an account exists with this email, a password reset code has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with confirmation code (Cognito only)"""
    if not USE_AWS:
        raise HTTPException(status_code=400, detail="This endpoint is only available with AWS Cognito")

    try:
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.confirm_forgot_password(
            email=request.email,
            confirmation_code=request.confirmation_code,
            new_password=request.new_password
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        return {"message": "Password reset successfully. You can now sign in with your new password."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ResendConfirmationRequest(BaseModel):
    email: EmailStr


@router.post("/resend-confirmation")
async def resend_confirmation(request: ResendConfirmationRequest):
    """Resend email confirmation code"""
    try:
        if USE_AWS:
            from app.core.cognito import CognitoAuth

            result = CognitoAuth.resend_confirmation_code(email=request.email)

            if result.get("error"):
                # Don't reveal if email exists for security
                pass

            return {"message": "If an account exists with this email, a new confirmation code has been sent."}
        else:
            # For Supabase, there's no direct resend - user needs to sign up again
            # or we could call the Supabase edge function
            return {"message": "If an account exists with this email, a new confirmation code has been sent."}

    except Exception as e:
        # Don't reveal errors for security
        return {"message": "If an account exists with this email, a new confirmation code has been sent."}


@router.get("/me")
async def get_user_info(user=Depends(get_current_user)):
    """Get current authenticated user"""
    if USE_AWS:
        from app.core.database import execute_single

        # Get full profile from database
        try:
            profile = execute_single("""
                SELECT * FROM profiles WHERE cognito_user_id = :cognito_user_id OR id::text = :user_id
            """, {
                "cognito_user_id": user.get("id"),
                "user_id": user.get("id")
            })

            if profile:
                return profile
        except Exception as e:
            print(f"Profile lookup error: {e}")

    return user.model_dump() if hasattr(user, 'model_dump') else user


@router.post("/ensure-profile")
async def ensure_profile(user=Depends(get_current_user)):
    """
    Ensure a profile exists for the authenticated user.
    Creates one if it doesn't exist. Returns profile and newly_created flag.
    """
    from app.core.database import execute_single, execute_insert

    user_id = user.get("id")
    email = user.get("email")

    # Check if profile exists
    try:
        profile = execute_single("""
            SELECT * FROM profiles WHERE cognito_user_id = :user_id OR email = :email
        """, {
            "user_id": user_id,
            "email": email
        })

        if profile:
            # Update cognito_user_id if missing
            if not profile.get("cognito_user_id"):
                from app.core.database import execute_update
                execute_update("""
                    UPDATE profiles SET cognito_user_id = :cognito_user_id WHERE id = :id
                """, {
                    "cognito_user_id": user_id,
                    "id": profile["id"]
                })
            return {"profile": profile, "newly_created": False}

        # Create new profile
        profile = execute_insert("""
            INSERT INTO profiles (cognito_user_id, email, full_name, display_name)
            VALUES (:cognito_user_id, :email, :full_name, :display_name)
            RETURNING *
        """, {
            "cognito_user_id": user_id,
            "email": email,
            "full_name": user.get("name") or email.split("@")[0] if email else "User",
            "display_name": user.get("name") or email.split("@")[0] if email else "User",
        })

        return {"profile": profile, "newly_created": True}

    except Exception as e:
        print(f"ensure_profile error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ensure profile: {str(e)}")


class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None


@router.post("/oauth/callback", response_model=AuthResponse)
async def oauth_callback(request: OAuthCallbackRequest):
    """
    Exchange OAuth authorization code for tokens.
    Used for Cognito hosted UI OAuth flows.
    """
    if not USE_AWS:
        raise HTTPException(status_code=400, detail="OAuth callback only available with AWS Cognito")

    try:
        from app.core.cognito import CognitoAuth
        from app.core.database import execute_single

        # Exchange code for tokens
        result = CognitoAuth.exchange_code_for_tokens(
            code=request.code,
            redirect_uri=request.redirect_uri
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        session = result["session"]
        cognito_user = result["user"]

        # Get or create profile
        profile = None
        if cognito_user:
            try:
                profile = execute_single("""
                    SELECT * FROM profiles WHERE cognito_user_id = :cognito_user_id OR email = :email
                """, {
                    "cognito_user_id": cognito_user.get("id"),
                    "email": cognito_user.get("email")
                })
            except Exception as e:
                print(f"Profile lookup error: {e}")

        user_data = {
            "id": profile["id"] if profile else cognito_user.get("id"),
            "email": cognito_user.get("email"),
            "full_name": cognito_user.get("name"),
            "cognito_user_id": cognito_user.get("id"),
        }

        if profile:
            user_data.update({
                "username": profile.get("username"),
                "avatar_url": profile.get("avatar_url"),
                "role": profile.get("role"),
            })

        return {
            "access_token": session["access_token"],
            "refresh_token": session.get("refresh_token"),
            "user": user_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token"""
    try:
        if USE_AWS:
            from app.core.cognito import CognitoAuth

            result = CognitoAuth.refresh_tokens(refresh_token=request.refresh_token)

            if result.get("error"):
                raise HTTPException(status_code=401, detail=result["error"]["message"])

            session = result["session"]
            user = result.get("user", {})

            return {
                "access_token": session["access_token"],
                "refresh_token": session.get("refresh_token") or request.refresh_token,
                "user": user
            }
        else:
            from app.core.supabase import get_supabase_client

            supabase = get_supabase_client()
            response = supabase.auth.refresh_session(request.refresh_token)

            if response.session is None:
                raise HTTPException(status_code=401, detail="Failed to refresh session")

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "user": response.user.model_dump() if hasattr(response.user, 'model_dump') else response.user.__dict__
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
