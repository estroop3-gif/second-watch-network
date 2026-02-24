"""
Authentication API Routes

Uses AWS Cognito for authentication.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.auth import get_current_user

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    birthdate: str | None = None  # ISO date string YYYY-MM-DD


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


class ChallengeResponse(BaseModel):
    challenge: str
    session: str
    parameters: dict = {}


class CompleteNewPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str
    session: str


@router.post("/signup", response_model=AuthResponse)
async def sign_up(request: SignUpRequest):
    """Register a new user with AWS Cognito"""
    try:
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
                INSERT INTO profiles (cognito_user_id, email, full_name, display_name, birthdate)
                VALUES (:cognito_user_id, :email, :full_name, :display_name, :birthdate)
                RETURNING *
            """, {
                "cognito_user_id": cognito_user["id"],
                "email": request.email,
                "full_name": request.full_name,
                "display_name": request.full_name,
                "birthdate": request.birthdate,
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/confirm-signup")
async def confirm_sign_up(request: ConfirmSignUpRequest):
    """Confirm user registration with verification code"""
    try:
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.confirm_sign_up(
            email=request.email,
            confirmation_code=request.confirmation_code
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        # Send welcome email (non-blocking — don't fail confirm if email fails)
        try:
            from app.services.email_templates import build_welcome_email
            from app.services.email_service import EmailService
            from app.core.database import get_client

            # Look up the user's name from their profile
            client = get_client()
            profile = client.table("profiles").select("full_name").eq(
                "email", request.email
            ).execute()
            name = profile.data[0]["full_name"] if profile.data else ""

            subject, html = build_welcome_email(name)
            await EmailService.send_email(
                to_emails=[request.email],
                subject=subject,
                html_content=html,
                email_type="welcome",
                source_service="auth",
                source_action="confirm_signup",
            )
        except Exception as e:
            print(f"Welcome email failed (non-blocking): {e}")

        return {"message": "Email confirmed successfully. You can now sign in."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def sign_in(request: SignInRequest):
    """Sign in an existing user with AWS Cognito"""
    try:
        from app.core.cognito import CognitoAuth
        from app.core.database import execute_single

        result = CognitoAuth.sign_in(
            email=request.email,
            password=request.password
        )

        if result.get("error"):
            error = result["error"]
            raise HTTPException(status_code=401, detail={
                "code": error.get("code", "unknown"),
                "message": error.get("message", "Sign in failed"),
            })

        # Check if there's a challenge (e.g., NEW_PASSWORD_REQUIRED)
        if result.get("challenge"):
            challenge = result["challenge"]
            return {
                "challenge": challenge["name"],
                "session": challenge["session"],
                "parameters": challenge.get("parameters", {}),
            }

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

        # Build user data - include full profile if available
        if profile:
            # Return full profile data to avoid needing a second API call
            from uuid import UUID
            user_data = {}
            for key, value in profile.items():
                if isinstance(value, UUID):
                    user_data[key] = str(value)
                else:
                    user_data[key] = value
        else:
            user_data = {
                "id": cognito_user.get("id"),
                "email": cognito_user.get("email") or request.email,
                "full_name": cognito_user.get("name"),
                "cognito_user_id": cognito_user.get("id"),
            }

        return {
            "access_token": session["access_token"],
            "refresh_token": session.get("refresh_token"),
            "user": user_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/complete-new-password", response_model=AuthResponse)
async def complete_new_password(request: CompleteNewPasswordRequest):
    """Complete the NEW_PASSWORD_REQUIRED challenge for first-time login"""
    try:
        from app.core.cognito import CognitoAuth
        from app.core.database import execute_single

        result = CognitoAuth.respond_to_new_password_challenge(
            email=request.email,
            new_password=request.new_password,
            session=request.session
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"]["message"])

        session = result["session"]
        cognito_user = result["user"]

        # Get profile from database
        profile = None
        if cognito_user:
            try:
                profile = execute_single("""
                    SELECT * FROM profiles WHERE cognito_user_id = :cognito_user_id OR email = :email
                """, {
                    "cognito_user_id": cognito_user.get("id"),
                    "email": request.email
                })
            except Exception as e:
                print(f"Profile lookup error: {e}")

        # Build user data - include full profile data
        if profile:
            from uuid import UUID
            user_data = {}
            for key, value in profile.items():
                if isinstance(value, UUID):
                    user_data[key] = str(value)
                else:
                    user_data[key] = value
        else:
            user_data = {
                "id": cognito_user.get("id"),
                "email": cognito_user.get("email") or request.email,
                "full_name": cognito_user.get("name"),
                "cognito_user_id": cognito_user.get("id"),
            }

        return {
            "access_token": session["access_token"],
            "refresh_token": session.get("refresh_token"),
            "user": user_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signout")
async def sign_out(user=Depends(get_current_user)):
    """Sign out current user"""
    try:
        # Cognito sign out - client discards tokens
        return {"message": "Successfully signed out"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Initiate password reset flow with AWS Cognito"""
    try:
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.forgot_password(email=request.email)

        if result.get("error"):
            # Don't reveal if email exists or not
            pass

        return {"message": "If an account exists with this email, a password reset code has been sent."}

    except Exception as e:
        # Don't reveal errors for security
        return {"message": "If an account exists with this email, a password reset code has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with confirmation code"""
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
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.resend_confirmation_code(email=request.email)

        if result.get("error"):
            # Don't reveal if email exists for security
            pass

        return {"message": "If an account exists with this email, a new confirmation code has been sent."}

    except Exception as e:
        # Don't reveal errors for security
        return {"message": "If an account exists with this email, a new confirmation code has been sent."}


@router.get("/me")
async def get_user_info(user=Depends(get_current_user)):
    """Get current authenticated user"""
    from app.core.database import execute_single
    from uuid import UUID

    user_id = str(user.get("id", ""))
    cognito_id = str(user.get("cognito_id") or user_id)

    # Get full profile from database
    try:
        profile = execute_single("""
            SELECT * FROM profiles WHERE cognito_user_id = :cognito_user_id OR id::text = :user_id
        """, {
            "cognito_user_id": cognito_id,
            "user_id": user_id
        })

        if profile:
            # Convert UUID fields to strings for JSON serialization
            result = {}
            for key, value in profile.items():
                if isinstance(value, UUID):
                    result[key] = str(value)
                else:
                    result[key] = value
            return result
    except Exception as e:
        print(f"Profile lookup error: {e}")

    return user


@router.post("/ensure-profile")
async def ensure_profile(user=Depends(get_current_user)):
    """
    Ensure a profile exists for the authenticated user.
    Creates one if it doesn't exist. Also ensures filmmaker_profiles entry exists
    so user appears in community listing. Returns profile and newly_created flag.
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

        newly_created = False

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
        else:
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
            newly_created = True

        # Ensure filmmaker_profiles entry exists so user appears in community
        profile_id = profile.get("id")
        if profile_id:
            filmmaker_profile = execute_single("""
                SELECT user_id FROM filmmaker_profiles WHERE user_id = :user_id
            """, {"user_id": str(profile_id)})

            if not filmmaker_profile:
                try:
                    execute_insert("""
                        INSERT INTO filmmaker_profiles (user_id, bio, skills, accepting_work)
                        VALUES (:user_id, :bio, :skills, :accepting_work)
                        RETURNING user_id
                    """, {
                        "user_id": str(profile_id),
                        "bio": "",
                        "skills": [],
                        "accepting_work": False,
                    })
                except Exception as e:
                    # Filmmaker profile creation is optional, log but don't fail
                    print(f"filmmaker_profiles creation error (non-fatal): {e}")

        # Broadcast new member via WebSocket so directory updates in real-time
        if newly_created and profile_id:
            try:
                from app.socketio_app import broadcast_new_community_member
                await broadcast_new_community_member(
                    profile_id=str(profile_id),
                    full_name=profile.get("full_name"),
                )
            except Exception as e:
                print(f"WebSocket broadcast failed (non-fatal): {e}")

        return {"profile": profile, "newly_created": newly_created}

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
        from app.core.cognito import CognitoAuth

        result = CognitoAuth.refresh_token(refresh_token=request.refresh_token)

        if result.get("error"):
            raise HTTPException(status_code=401, detail=result["error"]["message"])

        session = result["session"]
        user = result.get("user", {})

        return {
            "access_token": session["access_token"],
            "refresh_token": session.get("refresh_token") or request.refresh_token,
            "user": user
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
