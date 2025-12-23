"""
Second Watch Network - FastAPI Backend
Main Application Entry Point
"""
import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
from app.core.startup import on_startup
from app.api import (
    auth, users, content, filmmakers, messages, forum,
    profiles, submissions, notifications, connections,
    admin, availability, credits, community, greenroom, order, backlot,
    scene_view, day_view, person_view, timecards, project_access, directory,
    camera_continuity, continuity, utilities, billing, expenses,
    church_services, church_people, church_content, church_planning,
    church_resources, church_readiness, cast_crew, hot_set, invoices, coms
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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


# Global exception handler to ensure CORS headers and logging
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with proper logging and CORS headers."""
    print(f"[ERROR] Unhandled exception on {request.method} {request.url.path}: {str(exc)}", flush=True)
    print(traceback.format_exc(), flush=True)

    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
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
app.include_router(billing.router, prefix=f"{settings.API_V1_PREFIX}/billing", tags=["Billing"])
app.include_router(backlot.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot"])

# Backlot Glue Views
app.include_router(scene_view.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot Scene View"])
app.include_router(day_view.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot Day View"])
app.include_router(person_view.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot Person View"])
app.include_router(timecards.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot Timecards"])
app.include_router(expenses.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot Expenses"])
app.include_router(project_access.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Backlot Project Access"])
app.include_router(cast_crew.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Cast & Crew"])
app.include_router(directory.router, prefix=f"{settings.API_V1_PREFIX}/directory", tags=["Directory"])

# Camera & Continuity and Utilities
app.include_router(camera_continuity.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Camera & Continuity"])
app.include_router(continuity.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Scripty Continuity"])
app.include_router(utilities.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Utilities"])
app.include_router(hot_set.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Hot Set"])
app.include_router(invoices.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Invoices"])
app.include_router(coms.router, prefix=f"{settings.API_V1_PREFIX}/coms", tags=["Coms"])

# Church Production Tools
app.include_router(church_services.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Services"])
app.include_router(church_people.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church People"])
app.include_router(church_content.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Content"])
app.include_router(church_planning.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Planning"])
app.include_router(church_resources.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Resources"])
app.include_router(church_readiness.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Readiness"])

# Mount Socket.IO for real-time communications
try:
    from app.socketio_app import socket_app
    app.mount("/socket.io", socket_app)
    logger.info("Socket.IO mounted at /socket.io")
except ImportError as e:
    logger.warning(f"Socket.IO not available: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
