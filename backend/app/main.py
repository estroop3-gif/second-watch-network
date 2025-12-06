"""
Second Watch Network - FastAPI Backend
Main Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.core.startup import on_startup
from app.api import (
    auth, users, content, filmmakers, messages, forum,
    profiles, submissions, notifications, connections,
    admin, availability, credits, community, greenroom, order, backlot
)


class CORSPreflightMiddleware(BaseHTTPMiddleware):
    """Handle CORS preflight requests before they hit route handlers"""
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            origin = request.headers.get("origin", "")
            if origin in settings.BACKEND_CORS_ORIGINS or "*" in settings.BACKEND_CORS_ORIGINS:
                return Response(
                    status_code=200,
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With",
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Max-Age": "600",
                    }
                )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await on_startup()
    yield
    # Shutdown (add cleanup tasks here if needed)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Configure CORS preflight handler (must be added first to handle OPTIONS before auth)
app.add_middleware(CORSPreflightMiddleware)

# Configure CORS - Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "environment": settings.APP_ENV,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"])
app.include_router(profiles.router, prefix=f"{settings.API_V1_PREFIX}/profiles", tags=["Profiles"])
app.include_router(users.router, prefix=f"{settings.API_V1_PREFIX}/users", tags=["Users"])
app.include_router(submissions.router, prefix=f"{settings.API_V1_PREFIX}/submissions", tags=["Submissions"])
app.include_router(content.router, prefix=f"{settings.API_V1_PREFIX}/content", tags=["Content"])
app.include_router(filmmakers.router, prefix=f"{settings.API_V1_PREFIX}/filmmakers", tags=["Filmmakers"])
app.include_router(messages.router, prefix=f"{settings.API_V1_PREFIX}/messages", tags=["Messages"])
app.include_router(forum.router, prefix=f"{settings.API_V1_PREFIX}/forum", tags=["Forum"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_PREFIX}/notifications", tags=["Notifications"])
app.include_router(connections.router, prefix=f"{settings.API_V1_PREFIX}/connections", tags=["Connections"])
app.include_router(admin.router, prefix=f"{settings.API_V1_PREFIX}/admin", tags=["Admin"])
app.include_router(availability.router, prefix=f"{settings.API_V1_PREFIX}/availability", tags=["Availability"])
app.include_router(credits.router, prefix=f"{settings.API_V1_PREFIX}/credits", tags=["Credits"])
app.include_router(community.router, prefix=f"{settings.API_V1_PREFIX}/community", tags=["Community"])
app.include_router(greenroom.router, prefix=f"{settings.API_V1_PREFIX}/greenroom", tags=["Green Room"])
app.include_router(order.router, prefix=f"{settings.API_V1_PREFIX}/order", tags=["Order"])
app.include_router(backlot.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
