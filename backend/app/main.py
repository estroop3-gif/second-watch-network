"""
Second Watch Network - FastAPI Backend
Main Application Entry Point
"""
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.startup import on_startup
from app.core.logging import (
    setup_logging,
    get_logger,
    set_request_context,
    clear_request_context,
    RequestTimer,
    log_request_end,
    is_cold_start,
    mark_warm,
)
from app.core.exceptions import register_exception_handlers
from app.api import (
    auth, users, content, filmmakers, messages, forum,
    profiles, submissions, notifications, connections,
    admin, admin_community, admin_content, admin_backlot, admin_profiles,
    admin_roles, admin_storage, admin_users, admin_emails, admin_organizations, ses_webhook,
    organization_usage,
    availability, credits, community, greenroom, order, backlot,
    scene_view, day_view, person_view, timecards, project_access, directory,
    camera_continuity, continuity, utilities, billing, expenses, camera_log,
    church_services, church_people, church_content, church_planning,
    church_resources, church_readiness, cast_crew, hot_set, invoices, coms,
    application_templates, cover_letter_templates, resumes, networks, productions,
    companies, dm_adapter, uploads, feedback, cast_position_types,
    worlds, consumer_video, shorts, live_events,
    dashboard_settings, themes, recommendations, engagement,
    media, organizations, creator_earnings,
    linear,  # Phase 2A: Linear channels
    ads, partners,  # Phase 2B: Ad/partner stack
    festivals, venues,  # Phase 2C: Festival lifecycle & venue distribution
    community_threads, career, lodges,  # Phase 3: Community, careers, lodge programming
    client_api,  # Phase 4A: Mobile/TV client APIs
    moderation,  # Phase 4B: Content review and moderation
    world_onboarding, i18n,  # Phase 4C: Creator UX and internationalization
    distribution,  # Phase 5A: Third-party distribution and export
    analytics,  # Phase 5B: Advanced analytics and insights
    watch_parties, live_production,  # Phase 5C: Watch parties and live production
    order_governance,  # Phase 6A: Order governance and funds
    financing,  # Phase 6B: Creator financing and recoupment
    ops,  # Phase 6C: Operational resilience and feature flags
    geocoding,  # Nominatim geocoding integration
    client_metrics,  # Performance diagnostics - client-side timing
    dood,  # Day Out of Days
    storyboard,  # Storyboard visual planning
    episodes,  # Episode management
    moodboard,  # Moodboard visual reference
    story_management,  # Story management with beats, characters, arcs
    script_sides,  # Script sides auto generator
    stripboard,  # Stripboard schedule planning
    project_files,  # Project file management
    downloads,  # Application downloads (Dailies Helper)
    message_templates,  # Message templates for quick replies
    e2ee,  # End-to-end encryption key management
    channels,  # Group chat channels
)
from app.api.gear import router as gear_router  # Gear House - Equipment management
from app.api.set_house import router as set_house_router  # Set House - Space/location management
from app.api import org_messages  # Organization messaging
from app.api import organization_backlot  # Organization Backlot seat management

# Configure structured logging
setup_logging(level="INFO")
logger = get_logger(__name__)


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
                        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-Request-ID",
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Max-Age": "600",
                    }
                )
        return await call_next(request)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle request context for logging and tracing.

    - Generates or uses X-Request-ID header for request correlation
    - Sets up logging context with request details
    - Logs request duration on completion
    - Tracks cold start status for Lambda performance monitoring
    """
    async def dispatch(self, request: Request, call_next):
        # Capture cold start status at start of request
        cold_start = is_cold_start()

        # Get or generate request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Set request context for logging
        set_request_context(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )

        # Time the request
        with RequestTimer() as timer:
            try:
                response = await call_next(request)
            except Exception as e:
                # Log and re-raise - exception handlers will format the response
                log_request_end(
                    method=request.method,
                    path=request.url.path,
                    status_code=500,
                    duration_ms=timer.duration_ms,
                    error=str(e),
                    cold_start=cold_start,
                )
                # Mark warm after first request (even if it failed)
                if cold_start:
                    mark_warm()
                raise
            finally:
                clear_request_context()

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # Log request completion with cold start info
        log_request_end(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=timer.duration_ms,
            cold_start=cold_start,
        )

        # Mark warm after first successful request
        if cold_start:
            mark_warm()

        return response


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

# Middleware order matters - outermost first
# 1. Request context (outermost) - sets up logging context and request ID
app.add_middleware(RequestContextMiddleware)

# 2. CORS preflight handler - handles OPTIONS before hitting routes
app.add_middleware(CORSPreflightMiddleware)

# 3. CORS middleware - handles CORS headers for all responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],  # Allow frontend to access request ID
)

# Register structured exception handlers
register_exception_handlers(app)


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
    """
    Lightweight health check endpoint.
    Used by keep-warm scheduler and load balancers.
    Does NOT perform any database queries to minimize latency.
    """
    from app.core.logging import is_cold_start, get_process_age_ms

    return {
        "status": "healthy",
        "cold_start": is_cold_start(),
        "process_age_ms": round(get_process_age_ms(), 2),
    }


# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"])
app.include_router(profiles.router, prefix=f"{settings.API_V1_PREFIX}/profiles", tags=["Profiles"])
app.include_router(users.router, prefix=f"{settings.API_V1_PREFIX}/users", tags=["Users"])
app.include_router(submissions.router, prefix=f"{settings.API_V1_PREFIX}/submissions", tags=["Submissions"])
app.include_router(content.router, prefix=f"{settings.API_V1_PREFIX}/content", tags=["Content"])
app.include_router(filmmakers.router, prefix=f"{settings.API_V1_PREFIX}/filmmakers", tags=["Filmmakers"])
app.include_router(messages.router, prefix=f"{settings.API_V1_PREFIX}/messages", tags=["Messages"])
app.include_router(message_templates.router, prefix=f"{settings.API_V1_PREFIX}/message-templates", tags=["Message Templates"])
app.include_router(e2ee.router, prefix=f"{settings.API_V1_PREFIX}/e2ee", tags=["E2EE Encryption"])
app.include_router(channels.router, prefix=f"{settings.API_V1_PREFIX}/channels", tags=["Message Channels"])
app.include_router(forum.router, prefix=f"{settings.API_V1_PREFIX}/forum", tags=["Forum"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_PREFIX}/notifications", tags=["Notifications"])
app.include_router(connections.router, prefix=f"{settings.API_V1_PREFIX}/connections", tags=["Connections"])
app.include_router(admin.router, prefix=f"{settings.API_V1_PREFIX}/admin", tags=["Admin"])
app.include_router(admin_community.router, prefix=f"{settings.API_V1_PREFIX}/admin/community", tags=["Admin Community"])
app.include_router(admin_content.router, prefix=f"{settings.API_V1_PREFIX}/admin/content", tags=["Admin Content"])
app.include_router(admin_backlot.router, prefix=f"{settings.API_V1_PREFIX}/admin/backlot", tags=["Admin Backlot"])
app.include_router(admin_profiles.router, prefix=f"{settings.API_V1_PREFIX}/admin/profiles", tags=["Admin Profiles"])
app.include_router(admin_roles.router, prefix=f"{settings.API_V1_PREFIX}/admin", tags=["Admin Roles"])
app.include_router(admin_storage.router, prefix=f"{settings.API_V1_PREFIX}/admin/storage", tags=["Admin Storage"])
app.include_router(admin_users.router, prefix=f"{settings.API_V1_PREFIX}/admin/users", tags=["Admin Users"])
app.include_router(admin_emails.router, prefix=f"{settings.API_V1_PREFIX}/admin", tags=["Admin Emails"])
app.include_router(admin_organizations.router, prefix=f"{settings.API_V1_PREFIX}/admin/organizations", tags=["Admin Organizations"])
app.include_router(organization_usage.router, prefix=f"{settings.API_V1_PREFIX}/organizations", tags=["Organization Usage"])
app.include_router(ses_webhook.router, prefix=f"{settings.API_V1_PREFIX}", tags=["SES Webhook"])
app.include_router(availability.router, prefix=f"{settings.API_V1_PREFIX}/availability", tags=["Availability"])
app.include_router(credits.router, prefix=f"{settings.API_V1_PREFIX}/credits", tags=["Credits"])
app.include_router(community.router, prefix=f"{settings.API_V1_PREFIX}/community", tags=["Community"])
app.include_router(application_templates.router, prefix=f"{settings.API_V1_PREFIX}/application-templates", tags=["Application Templates"])
app.include_router(cover_letter_templates.router, prefix=f"{settings.API_V1_PREFIX}/cover-letter-templates", tags=["Cover Letter Templates"])
app.include_router(resumes.router, prefix=f"{settings.API_V1_PREFIX}/resumes", tags=["Resumes"])
app.include_router(networks.router, prefix=f"{settings.API_V1_PREFIX}/networks", tags=["TV Networks"])
app.include_router(productions.router, prefix=f"{settings.API_V1_PREFIX}/productions", tags=["Productions"])
app.include_router(companies.router, prefix=f"{settings.API_V1_PREFIX}/companies", tags=["Companies"])
app.include_router(cast_position_types.router, prefix=f"{settings.API_V1_PREFIX}/cast-position-types", tags=["Cast Position Types"])
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
app.include_router(geocoding.router, prefix=f"{settings.API_V1_PREFIX}/geocoding", tags=["Geocoding"])

# Camera & Continuity and Utilities
app.include_router(camera_continuity.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Camera & Continuity"])
app.include_router(camera_log.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Camera Log"])
app.include_router(continuity.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Scripty Continuity"])
app.include_router(utilities.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Utilities"])
app.include_router(hot_set.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Hot Set"])
app.include_router(invoices.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Invoices"])
app.include_router(dood.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Day Out of Days"])
app.include_router(storyboard.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Storyboard"])
app.include_router(episodes.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Episodes"])
app.include_router(moodboard.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Moodboard"])
app.include_router(story_management.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Story Management"])
app.include_router(script_sides.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Script Sides"])
app.include_router(stripboard.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Stripboard"])
app.include_router(project_files.router, prefix=f"{settings.API_V1_PREFIX}/backlot", tags=["Project Files"])
app.include_router(downloads.router, prefix=f"{settings.API_V1_PREFIX}/downloads", tags=["Downloads"])
app.include_router(coms.router, prefix=f"{settings.API_V1_PREFIX}/coms", tags=["Coms"])
app.include_router(dm_adapter.router, prefix=f"{settings.API_V1_PREFIX}/dm", tags=["Direct Messages"])
app.include_router(uploads.router, prefix=f"{settings.API_V1_PREFIX}/uploads", tags=["Uploads"])
app.include_router(feedback.router, prefix=f"{settings.API_V1_PREFIX}/feedback", tags=["Alpha Feedback"])

# Consumer Streaming Platform
app.include_router(worlds.router, prefix=f"{settings.API_V1_PREFIX}/worlds", tags=["Worlds"])
app.include_router(consumer_video.router, prefix=f"{settings.API_V1_PREFIX}/video", tags=["Video Pipeline"])
app.include_router(shorts.router, prefix=f"{settings.API_V1_PREFIX}/shorts", tags=["Shorts"])
app.include_router(live_events.router, prefix=f"{settings.API_V1_PREFIX}/events", tags=["Live Events"])
app.include_router(recommendations.router, prefix=f"{settings.API_V1_PREFIX}/recommendations", tags=["Recommendations"])
app.include_router(engagement.router, prefix=f"{settings.API_V1_PREFIX}/engagement", tags=["Engagement"])

# Church Production Tools
app.include_router(church_services.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Services"])
app.include_router(church_people.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church People"])
app.include_router(church_content.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Content"])
app.include_router(church_planning.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Planning"])
app.include_router(church_resources.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Resources"])
app.include_router(church_readiness.router, prefix=f"{settings.API_V1_PREFIX}/church", tags=["Church Readiness"])

# Dashboard Customization & Themes
app.include_router(dashboard_settings.router, prefix=f"{settings.API_V1_PREFIX}/dashboard-settings", tags=["Dashboard Settings"])
app.include_router(themes.router, prefix=f"{settings.API_V1_PREFIX}/themes", tags=["Themes"])

# Media Processing
app.include_router(media.router, prefix=f"{settings.API_V1_PREFIX}/media", tags=["Media Processing"])

# Creator Monetization & Organizations
app.include_router(organizations.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Organizations"])
app.include_router(organization_backlot.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Organization Backlot"])
app.include_router(creator_earnings.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Creator Earnings"])

# Phase 2A: Linear Channels
app.include_router(linear.router, prefix=f"{settings.API_V1_PREFIX}/linear", tags=["Linear Channels"])

# Phase 2B: Ad/Partner Stack
app.include_router(ads.router, prefix=f"{settings.API_V1_PREFIX}/ads", tags=["Ads"])
app.include_router(partners.router, prefix=f"{settings.API_V1_PREFIX}/partners", tags=["Partners"])

# Phase 2C: Festival Lifecycle & Venue Distribution
app.include_router(festivals.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Festivals"])
app.include_router(venues.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Venues"])

# Phase 3A: Community Scoping & Careers
app.include_router(community_threads.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Community Threads"])
app.include_router(career.router, prefix=f"{settings.API_V1_PREFIX}/career", tags=["Career & Filmography"])

# Phase 3B: Lodge Programming
app.include_router(lodges.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Lodge Programming"])

# Phase 4A: Mobile/TV Client APIs
app.include_router(client_api.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Client API"])

# Phase 4B: Content Review and Moderation
app.include_router(moderation.router, prefix=f"{settings.API_V1_PREFIX}/moderation", tags=["Moderation"])

# Phase 4C: Creator UX and Internationalization
app.include_router(world_onboarding.router, prefix=f"{settings.API_V1_PREFIX}", tags=["World Onboarding"])
app.include_router(i18n.router, prefix=f"{settings.API_V1_PREFIX}/i18n", tags=["Internationalization"])

# Phase 5A: Third-party Distribution and Export
app.include_router(distribution.router, prefix=f"{settings.API_V1_PREFIX}/distribution", tags=["Distribution"])

# Phase 5B: Advanced Analytics
app.include_router(analytics.router, prefix=f"{settings.API_V1_PREFIX}/analytics", tags=["Analytics"])

# Phase 5C: Watch Parties and Live Production
app.include_router(watch_parties.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Watch Parties"])
app.include_router(live_production.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Live Production"])

# Phase 6A: Order Governance and Funds
app.include_router(order_governance.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Order Governance"])

# Phase 6B: Creator Financing and Recoupment
app.include_router(financing.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Financing"])

# Phase 6C: Operational Resilience and Feature Flags
app.include_router(ops.router, prefix=f"{settings.API_V1_PREFIX}", tags=["Ops"])

# Performance Diagnostics - Client-side timing metrics
app.include_router(client_metrics.router, prefix=f"{settings.API_V1_PREFIX}/client-metrics", tags=["Client Metrics"])

# Gear House - Equipment Management
app.include_router(gear_router, prefix=f"{settings.API_V1_PREFIX}/gear", tags=["Gear House"])

# Set House - Space/Location Management
app.include_router(set_house_router, prefix=f"{settings.API_V1_PREFIX}/set-house", tags=["Set House"])

app.include_router(org_messages.router, prefix=settings.API_V1_PREFIX, tags=["Organization Messages"])

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
