"""
Client Performance Metrics API

Lightweight endpoint for frontend performance instrumentation.
Accepts timing data from initial load and login flows, logs them
for correlation with backend Lambda metrics in CloudWatch.
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


class TimingMark(BaseModel):
    """Individual timing mark within a flow."""
    name: str
    timestamp_ms: float  # Milliseconds since page load
    duration_ms: Optional[float] = None  # Duration for spans


class InitialLoadMetrics(BaseModel):
    """Timing metrics for initial app load."""
    event_type: str = Field(default="initial_load")

    # Core timings (ms since navigation start)
    js_bundle_loaded_ms: Optional[float] = None
    app_mounted_ms: Optional[float] = None
    auth_check_started_ms: Optional[float] = None
    auth_check_completed_ms: Optional[float] = None
    first_api_call_started_ms: Optional[float] = None
    first_api_call_completed_ms: Optional[float] = None

    # Results
    auth_had_token: Optional[bool] = None
    auth_token_valid: Optional[bool] = None
    first_api_call_path: Optional[str] = None
    first_api_call_status: Optional[int] = None
    first_api_call_duration_ms: Optional[float] = None

    # Browser Performance API data
    navigation_timing: Optional[Dict[str, float]] = None

    # Additional marks
    marks: Optional[List[TimingMark]] = None

    # Context
    user_agent: Optional[str] = None
    viewport_width: Optional[int] = None
    viewport_height: Optional[int] = None
    connection_type: Optional[str] = None  # effectiveType from navigator.connection


class LoginMetrics(BaseModel):
    """Timing metrics for login flow."""
    event_type: str = Field(default="login")

    # Login flow timings (ms since page load)
    login_button_clicked_ms: Optional[float] = None
    cognito_request_started_ms: Optional[float] = None
    cognito_response_received_ms: Optional[float] = None
    token_stored_ms: Optional[float] = None
    bootstrap_started_ms: Optional[float] = None
    bootstrap_completed_ms: Optional[float] = None

    # Results
    cognito_duration_ms: Optional[float] = None
    bootstrap_duration_ms: Optional[float] = None
    total_login_duration_ms: Optional[float] = None

    # Outcome
    success: bool = False
    error_message: Optional[str] = None
    retry_count: Optional[int] = 0

    # Additional marks
    marks: Optional[List[TimingMark]] = None


class GenericMetrics(BaseModel):
    """Generic timing metrics for any flow."""
    event_type: str
    marks: List[TimingMark] = []
    metadata: Optional[Dict[str, Any]] = None


@router.post("/initial-load")
async def log_initial_load_metrics(
    metrics: InitialLoadMetrics,
    request: Request,
):
    """
    Log initial app load timing metrics.

    Called by frontend after initial load completes.
    """
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Calculate derived metrics
    auth_check_duration = None
    if metrics.auth_check_started_ms and metrics.auth_check_completed_ms:
        auth_check_duration = metrics.auth_check_completed_ms - metrics.auth_check_started_ms

    total_bootstrap_time = None
    if metrics.js_bundle_loaded_ms and metrics.first_api_call_completed_ms:
        total_bootstrap_time = metrics.first_api_call_completed_ms - metrics.js_bundle_loaded_ms

    # Log structured metrics for CloudWatch Logs Insights
    logger.info(
        "Client initial load metrics",
        extra={
            "event": "client_metrics_initial_load",
            "request_id": request_id,
            # Core timings
            "js_bundle_loaded_ms": metrics.js_bundle_loaded_ms,
            "app_mounted_ms": metrics.app_mounted_ms,
            "auth_check_duration_ms": auth_check_duration,
            "first_api_call_duration_ms": metrics.first_api_call_duration_ms,
            "total_bootstrap_ms": total_bootstrap_time,
            # Auth state
            "auth_had_token": metrics.auth_had_token,
            "auth_token_valid": metrics.auth_token_valid,
            # API call details
            "first_api_call_path": metrics.first_api_call_path,
            "first_api_call_status": metrics.first_api_call_status,
            # Navigation timing
            "nav_dns_lookup_ms": metrics.navigation_timing.get("domainLookupEnd", 0) - metrics.navigation_timing.get("domainLookupStart", 0) if metrics.navigation_timing else None,
            "nav_tcp_connect_ms": metrics.navigation_timing.get("connectEnd", 0) - metrics.navigation_timing.get("connectStart", 0) if metrics.navigation_timing else None,
            "nav_ttfb_ms": metrics.navigation_timing.get("responseStart", 0) - metrics.navigation_timing.get("requestStart", 0) if metrics.navigation_timing else None,
            "nav_dom_interactive_ms": metrics.navigation_timing.get("domInteractive") if metrics.navigation_timing else None,
            "nav_dom_complete_ms": metrics.navigation_timing.get("domComplete") if metrics.navigation_timing else None,
            # Context
            "viewport": f"{metrics.viewport_width}x{metrics.viewport_height}" if metrics.viewport_width else None,
            "connection_type": metrics.connection_type,
        }
    )

    return {"status": "logged", "request_id": request_id}


@router.post("/login")
async def log_login_metrics(
    metrics: LoginMetrics,
    request: Request,
):
    """
    Log login flow timing metrics.

    Called by frontend after login attempt completes (success or failure).
    """
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Log structured metrics
    logger.info(
        "Client login metrics",
        extra={
            "event": "client_metrics_login",
            "request_id": request_id,
            # Timings
            "cognito_duration_ms": metrics.cognito_duration_ms,
            "bootstrap_duration_ms": metrics.bootstrap_duration_ms,
            "total_login_duration_ms": metrics.total_login_duration_ms,
            # Outcome
            "success": metrics.success,
            "error_message": metrics.error_message,
            "retry_count": metrics.retry_count,
        }
    )

    return {"status": "logged", "request_id": request_id}


@router.post("/generic")
async def log_generic_metrics(
    metrics: GenericMetrics,
    request: Request,
):
    """
    Log generic timing metrics for any flow.

    Flexible endpoint for ad-hoc performance measurements.
    """
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Convert marks to a simple dict for logging
    marks_dict = {mark.name: mark.timestamp_ms for mark in metrics.marks}

    logger.info(
        f"Client metrics: {metrics.event_type}",
        extra={
            "event": f"client_metrics_{metrics.event_type}",
            "request_id": request_id,
            "marks": marks_dict,
            "metadata": metrics.metadata,
        }
    )

    return {"status": "logged", "request_id": request_id}
