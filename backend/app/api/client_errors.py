"""
Client Error Logging API
Receives client-side JavaScript errors and stores them for admin review.
Public endpoint — no auth required (errors can come from unauthenticated pages).
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, validator
from typing import Optional
from app.core.database import execute_insert, execute_query, execute_single, execute_update
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Simple in-memory rate limit: track IP → (count, window_start)
# Resets every 60 seconds. 20 errors/min per IP.
_rate_limit_state: dict = {}
_RATE_LIMIT = 20
_RATE_WINDOW_S = 60


def _check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = datetime.now(timezone.utc).timestamp()
    if ip not in _rate_limit_state:
        _rate_limit_state[ip] = {"count": 1, "window_start": now}
        return True
    state = _rate_limit_state[ip]
    if now - state["window_start"] > _RATE_WINDOW_S:
        _rate_limit_state[ip] = {"count": 1, "window_start": now}
        return True
    if state["count"] >= _RATE_LIMIT:
        return False
    state["count"] += 1
    return True


class ClientErrorPayload(BaseModel):
    error_name: Optional[str] = "Error"
    error_message: str
    error_stack: Optional[str] = None
    component_stack: Optional[str] = None
    pathname: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    severity: Optional[str] = "error"
    context: Optional[dict] = None
    session_id: Optional[str] = None

    @validator("error_message")
    def truncate_message(cls, v):
        return v[:2000] if v else v

    @validator("error_stack", "component_stack")
    def truncate_stack(cls, v):
        return v[:8000] if v else v

    @validator("error_name", "pathname", "url", "user_agent", "session_id")
    def truncate_short(cls, v):
        return v[:500] if v else v

    @validator("severity")
    def validate_severity(cls, v):
        if v not in ("warning", "error", "fatal"):
            return "error"
        return v


@router.post("", status_code=200)
async def report_client_error(payload: ClientErrorPayload, request: Request):
    """
    Receive a client-side error report and store it.
    Always returns { ok: true } — we never error on error reporting.
    """
    try:
        # Rate limit by IP
        client_ip = request.client.host if request.client else "unknown"
        if not _check_rate_limit(client_ip):
            return {"ok": True}  # Silent rate limit — don't tell client

        # Try to resolve user from auth header (optional enrichment)
        user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.core.auth import decode_token
                from app.api.users import get_profile_id_from_cognito_id
                token = auth_header[7:]
                claims = decode_token(token)
                cognito_sub = claims.get("sub")
                if cognito_sub:
                    user_id = await get_profile_id_from_cognito_id(cognito_sub)
            except Exception:
                pass  # Auth enrichment is optional

        # Store error
        context_json = json.dumps(payload.context) if payload.context else None
        row = execute_insert(
            """
            INSERT INTO client_error_logs (
                user_id, session_id, error_name, error_message,
                error_stack, component_stack, pathname, url,
                user_agent, severity, context
            ) VALUES (
                :user_id, :session_id, :error_name, :error_message,
                :error_stack, :component_stack, :pathname, :url,
                :user_agent, :severity, :context::jsonb
            )
            RETURNING id, severity
            """,
            {
                "user_id": user_id,
                "session_id": payload.session_id,
                "error_name": payload.error_name or "Error",
                "error_message": payload.error_message,
                "error_stack": payload.error_stack,
                "component_stack": payload.component_stack,
                "pathname": payload.pathname,
                "url": payload.url,
                "user_agent": payload.user_agent,
                "severity": payload.severity or "error",
                "context": context_json,
            }
        )

        # If fatal: notify all admins
        if payload.severity == "fatal" and row:
            try:
                await _notify_admins_fatal(row["id"], payload)
            except Exception as e:
                logger.warning(f"Failed to send fatal error notification: {e}")

    except Exception as e:
        logger.error(f"Failed to store client error: {e}")

    return {"ok": True}


async def _notify_admins_fatal(error_id: str, payload: ClientErrorPayload):
    """Create in-app notifications for all admin users when a fatal error occurs."""
    admins = execute_query(
        "SELECT id FROM profiles WHERE is_admin = TRUE OR is_superadmin = TRUE LIMIT 50",
        {}
    )
    if not admins:
        return

    short_msg = (payload.error_message or "Unknown error")[:200]
    for admin in admins:
        try:
            execute_insert(
                """
                INSERT INTO notifications (
                    user_id, type, title, body, related_id, payload, is_read
                ) VALUES (
                    :user_id, 'system_alert', :title, :body, :related_id, :payload::jsonb, false
                )
                """,
                {
                    "user_id": admin["id"],
                    "title": "Fatal Client Error Detected",
                    "body": f"A fatal JavaScript error occurred: {short_msg}",
                    "related_id": str(error_id),
                    "payload": json.dumps({
                        "error_id": str(error_id),
                        "pathname": payload.pathname,
                        "severity": "fatal",
                    }),
                }
            )
        except Exception:
            pass
