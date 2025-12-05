"""
Authentication API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.core.supabase import get_supabase_client
from app.core.auth import get_current_user

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/signup", response_model=AuthResponse)
async def sign_up(request: SignUpRequest):
    """Register a new user"""
    try:
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

        # Check if session exists, otherwise create a temporary token
        access_token = response.session.access_token if response.session else "temp_token_pending_confirmation"

        return {
            "access_token": access_token,
            "user": response.user.model_dump() if hasattr(response.user, 'model_dump') else response.user.__dict__
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin", response_model=AuthResponse)
async def sign_in(request: SignInRequest):
    """Sign in an existing user"""
    try:
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
            "user": response.user.model_dump() if hasattr(response.user, 'model_dump') else response.user.__dict__
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/signout")
async def sign_out():
    """Sign out current user"""
    try:
        supabase = get_supabase_client()
        supabase.auth.sign_out()
        return {"message": "Successfully signed out"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_user_info(user = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump() if hasattr(user, 'model_dump') else user
