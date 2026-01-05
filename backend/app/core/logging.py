"""
Structured Logging for Second Watch Network

This module provides JSON-formatted logging optimized for AWS CloudWatch
and Lambda environments. All logs are structured for easy querying and
correlation via request IDs.

Usage:
    from app.core.logging import get_logger, setup_logging

    # In main.py startup
    setup_logging()

    # In any module
    logger = get_logger(__name__)
    logger.info("User logged in", extra={"user_id": user_id, "action": "login"})
"""
import json
import logging
import sys
import time
import traceback
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.config import settings


# Context variable to store request-scoped data
request_context: ContextVar[Dict[str, Any]] = ContextVar("request_context", default={})


def get_request_id() -> Optional[str]:
    """Get the current request ID from context."""
    ctx = request_context.get()
    return ctx.get("request_id")


def set_request_context(
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    path: Optional[str] = None,
    method: Optional[str] = None,
    **kwargs: Any
) -> None:
    """
    Set request-scoped context for logging.

    Args:
        request_id: Unique request identifier (X-Request-ID header)
        user_id: Authenticated user's profile ID
        path: Request path
        method: HTTP method
        **kwargs: Additional context fields
    """
    ctx = {
        "request_id": request_id,
        "user_id": user_id,
        "path": path,
        "method": method,
        **kwargs,
    }
    # Filter out None values
    ctx = {k: v for k, v in ctx.items() if v is not None}
    request_context.set(ctx)


def clear_request_context() -> None:
    """Clear request-scoped context."""
    request_context.set({})


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.

    Produces CloudWatch-friendly JSON with:
    - timestamp in ISO format
    - level (INFO, WARNING, ERROR, etc.)
    - logger name
    - message
    - request context (request_id, user_id, path, method)
    - exception details if present
    - extra fields from log calls
    """

    # Fields that are part of the standard LogRecord but not useful in JSON output
    EXCLUDE_ATTRS = {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "module", "msecs",
        "msg", "name", "pathname", "process", "processName", "relativeCreated",
        "stack_info", "thread", "threadName", "taskName",
    }

    def __init__(self, include_traceback: bool = True):
        super().__init__()
        self.include_traceback = include_traceback

    def format(self, record: logging.LogRecord) -> str:
        # Base log structure
        log_dict: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add environment info
        log_dict["environment"] = settings.APP_ENV

        # Add request context
        ctx = request_context.get()
        if ctx:
            log_dict["context"] = ctx

        # Add source location for errors
        if record.levelno >= logging.WARNING:
            log_dict["source"] = {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            }

        # Add exception info if present
        if record.exc_info and self.include_traceback:
            exc_type, exc_value, exc_tb = record.exc_info
            if exc_type is not None:
                log_dict["exception"] = {
                    "type": exc_type.__name__,
                    "message": str(exc_value),
                    "traceback": traceback.format_exception(exc_type, exc_value, exc_tb),
                }

        # Add any extra fields passed to the log call
        for key, value in record.__dict__.items():
            if key not in self.EXCLUDE_ATTRS and key not in log_dict:
                # Handle non-serializable objects
                try:
                    json.dumps(value)
                    log_dict[key] = value
                except (TypeError, ValueError):
                    log_dict[key] = str(value)

        return json.dumps(log_dict, default=str)


class DevelopmentFormatter(logging.Formatter):
    """
    Human-readable formatter for local development.

    Produces colored, easy-to-read output while still including
    request context and extra fields.
    """

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")

        # Format timestamp
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]

        # Get request context
        ctx = request_context.get()
        request_id = ctx.get("request_id", "-")[:8] if ctx.get("request_id") else "-"

        # Base message
        msg = f"{color}[{timestamp}] [{record.levelname:7}]{self.RESET} "
        msg += f"[{request_id}] "
        msg += f"{record.name}: {record.getMessage()}"

        # Add extra fields
        extras = {}
        for key in record.__dict__:
            if key not in JSONFormatter.EXCLUDE_ATTRS and key not in {"context"}:
                extras[key] = getattr(record, key)

        if extras:
            extras_str = " ".join(f"{k}={v}" for k, v in extras.items())
            msg += f" | {extras_str}"

        # Add exception if present
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)

        return msg


def setup_logging(
    level: str = "INFO",
    json_output: Optional[bool] = None,
) -> None:
    """
    Configure application logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_output: Force JSON output (default: auto-detect from APP_ENV)
    """
    # Determine output format
    if json_output is None:
        # Use JSON in production/staging, human-readable in development
        json_output = settings.APP_ENV in ("production", "staging", "lambda")

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Add stdout handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, level.upper()))

    if json_output:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(DevelopmentFormatter())

    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a module.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# ============================================================================
# Request Timing Utilities
# ============================================================================

class RequestTimer:
    """
    Context manager for timing request duration.

    Usage:
        with RequestTimer() as timer:
            # ... handle request ...
        logger.info("Request completed", extra={"duration_ms": timer.duration_ms})
    """

    def __init__(self):
        self.start_time: float = 0
        self.end_time: float = 0

    def __enter__(self) -> "RequestTimer":
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, *args) -> None:
        self.end_time = time.perf_counter()

    @property
    def duration_ms(self) -> float:
        """Get duration in milliseconds."""
        return (self.end_time - self.start_time) * 1000


def log_request_start(
    method: str,
    path: str,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """Log the start of a request."""
    logger = get_logger("request")
    logger.info(
        f"{method} {path}",
        extra={
            "event": "request_start",
            "method": method,
            "path": path,
        }
    )


def log_request_end(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    error: Optional[str] = None,
) -> None:
    """Log the completion of a request."""
    logger = get_logger("request")

    level = logging.INFO
    if status_code >= 500:
        level = logging.ERROR
    elif status_code >= 400:
        level = logging.WARNING

    extra = {
        "event": "request_end",
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
    }

    if error:
        extra["error"] = error

    logger.log(level, f"{method} {path} -> {status_code} ({duration_ms:.0f}ms)", extra=extra)
