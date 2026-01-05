"""
Application Exception Hierarchy for Second Watch Network

This module provides a structured exception system with:
- Typed exception classes for different error categories
- Error codes for frontend handling
- Consistent JSON error responses
- Automatic logging integration

Usage:
    from app.core.exceptions import NotFoundError, ForbiddenError, ValidationError

    # Raise typed exceptions
    raise NotFoundError("User not found", code="USER_NOT_FOUND")
    raise ForbiddenError("Access denied", code="INSUFFICIENT_PERMISSIONS")
    raise ValidationError("Invalid email format", code="INVALID_EMAIL", field="email")

    # In main.py, register the exception handler
    from app.core.exceptions import register_exception_handlers
    register_exception_handlers(app)
"""
from typing import Any, Dict, List, Optional, Type
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.logging import get_logger, get_request_id


logger = get_logger(__name__)


# ============================================================================
# Error Response Schema
# ============================================================================

class ErrorDetail(BaseModel):
    """Schema for error response body."""
    code: str
    message: str
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    error: ErrorDetail
    request_id: Optional[str] = None


# ============================================================================
# Base Application Exception
# ============================================================================

class AppException(Exception):
    """
    Base exception for all application errors.

    All custom exceptions should inherit from this class to ensure
    consistent error handling and response formatting.

    Attributes:
        message: Human-readable error message
        code: Machine-readable error code (e.g., "USER_NOT_FOUND")
        status_code: HTTP status code
        field: Optional field name for validation errors
        details: Optional additional details
        headers: Optional response headers
    """

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_code: str = "INTERNAL_ERROR"
    default_message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.field = field
        self.details = details
        self.headers = headers
        super().__init__(self.message)

    def to_response(self, request_id: Optional[str] = None) -> ErrorResponse:
        """Convert exception to ErrorResponse schema."""
        return ErrorResponse(
            error=ErrorDetail(
                code=self.code,
                message=self.message,
                field=self.field,
                details=self.details,
            ),
            request_id=request_id,
        )


# ============================================================================
# Client Errors (4xx)
# ============================================================================

class BadRequestError(AppException):
    """400 Bad Request - Invalid request data or parameters."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "BAD_REQUEST"
    default_message = "Invalid request"


class ValidationError(AppException):
    """
    400 Bad Request - Validation failure.

    Used for field-level validation errors.
    """
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "VALIDATION_ERROR"
    default_message = "Validation failed"

    def __init__(
        self,
        message: Optional[str] = None,
        code: Optional[str] = None,
        field: Optional[str] = None,
        errors: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ):
        details = {"errors": errors} if errors else None
        super().__init__(message=message, code=code, field=field, details=details, **kwargs)


class UnauthorizedError(AppException):
    """401 Unauthorized - Missing or invalid authentication."""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_code = "UNAUTHORIZED"
    default_message = "Authentication required"

    def __init__(self, message: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            headers={"WWW-Authenticate": "Bearer"},
            **kwargs,
        )


class ForbiddenError(AppException):
    """403 Forbidden - Authenticated but lacks permission."""
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "FORBIDDEN"
    default_message = "Access denied"


class NotFoundError(AppException):
    """404 Not Found - Resource does not exist."""
    status_code = status.HTTP_404_NOT_FOUND
    default_code = "NOT_FOUND"
    default_message = "Resource not found"


class ConflictError(AppException):
    """409 Conflict - Resource state conflict (e.g., duplicate)."""
    status_code = status.HTTP_409_CONFLICT
    default_code = "CONFLICT"
    default_message = "Resource conflict"


class GoneError(AppException):
    """410 Gone - Resource has been permanently deleted."""
    status_code = status.HTTP_410_GONE
    default_code = "GONE"
    default_message = "Resource no longer available"


class UnprocessableEntityError(AppException):
    """422 Unprocessable Entity - Semantic validation failure."""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "UNPROCESSABLE_ENTITY"
    default_message = "Unable to process request"


class TooManyRequestsError(AppException):
    """429 Too Many Requests - Rate limit exceeded."""
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_code = "RATE_LIMITED"
    default_message = "Too many requests, please try again later"

    def __init__(
        self,
        message: Optional[str] = None,
        retry_after: Optional[int] = None,
        **kwargs,
    ):
        headers = {}
        if retry_after:
            headers["Retry-After"] = str(retry_after)
        super().__init__(message=message, headers=headers, **kwargs)


# ============================================================================
# Server Errors (5xx)
# ============================================================================

class InternalError(AppException):
    """500 Internal Server Error - Unexpected server error."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_code = "INTERNAL_ERROR"
    default_message = "An unexpected error occurred"


class ServiceUnavailableError(AppException):
    """503 Service Unavailable - Service temporarily unavailable."""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "SERVICE_UNAVAILABLE"
    default_message = "Service temporarily unavailable"


class DatabaseError(AppException):
    """500 Internal Server Error - Database operation failed."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_code = "DATABASE_ERROR"
    default_message = "Database operation failed"


class ExternalServiceError(AppException):
    """502 Bad Gateway - External service (AWS, Stripe, etc.) failed."""
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = "EXTERNAL_SERVICE_ERROR"
    default_message = "External service error"


# ============================================================================
# Domain-Specific Errors
# ============================================================================

class AuthenticationError(UnauthorizedError):
    """Authentication-specific errors."""
    default_code = "AUTHENTICATION_FAILED"
    default_message = "Authentication failed"


class TokenExpiredError(UnauthorizedError):
    """JWT token has expired."""
    default_code = "TOKEN_EXPIRED"
    default_message = "Authentication token has expired"


class TokenInvalidError(UnauthorizedError):
    """JWT token is invalid."""
    default_code = "TOKEN_INVALID"
    default_message = "Invalid authentication token"


class PermissionDeniedError(ForbiddenError):
    """User lacks required permission."""
    default_code = "PERMISSION_DENIED"
    default_message = "You do not have permission to perform this action"


class ResourceOwnershipError(ForbiddenError):
    """User does not own the resource."""
    default_code = "NOT_OWNER"
    default_message = "You do not own this resource"


class ProjectAccessError(ForbiddenError):
    """User lacks access to a backlot project."""
    default_code = "PROJECT_ACCESS_DENIED"
    default_message = "You do not have access to this project"


class SubscriptionRequiredError(ForbiddenError):
    """Feature requires subscription."""
    default_code = "SUBSCRIPTION_REQUIRED"
    default_message = "This feature requires a premium subscription"


class QuotaExceededError(ForbiddenError):
    """User has exceeded their quota/limit."""
    default_code = "QUOTA_EXCEEDED"
    default_message = "You have exceeded your quota for this resource"


class MediaProcessingError(InternalError):
    """Media processing/transcoding failed."""
    default_code = "MEDIA_PROCESSING_ERROR"
    default_message = "Failed to process media file"


class StorageError(InternalError):
    """S3/storage operation failed."""
    default_code = "STORAGE_ERROR"
    default_message = "Storage operation failed"


# ============================================================================
# Exception Handler Registration
# ============================================================================

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    Handle AppException subclasses with consistent response format.
    """
    request_id = get_request_id()

    # Log the error
    if exc.status_code >= 500:
        logger.error(
            f"{exc.code}: {exc.message}",
            extra={
                "error_code": exc.code,
                "status_code": exc.status_code,
                "field": exc.field,
                "details": exc.details,
            },
            exc_info=True,
        )
    else:
        logger.warning(
            f"{exc.code}: {exc.message}",
            extra={
                "error_code": exc.code,
                "status_code": exc.status_code,
                "field": exc.field,
            },
        )

    response = exc.to_response(request_id=request_id)

    # Get origin for CORS
    origin = request.headers.get("origin", "*")

    return JSONResponse(
        status_code=exc.status_code,
        content=response.model_dump(exclude_none=True),
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            **(exc.headers or {}),
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions that aren't AppException subclasses.
    """
    request_id = get_request_id()

    # Log the full exception
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        exc_info=True,
        extra={
            "exception_type": type(exc).__name__,
            "path": str(request.url.path),
            "method": request.method,
        },
    )

    # Don't leak internal details in production
    from app.core.config import settings
    message = str(exc) if settings.DEBUG else "An unexpected error occurred"

    response = ErrorResponse(
        error=ErrorDetail(
            code="INTERNAL_ERROR",
            message=message,
        ),
        request_id=request_id,
    )

    origin = request.headers.get("origin", "*")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response.model_dump(exclude_none=True),
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register exception handlers with the FastAPI app.

    Call this in main.py after creating the app:
        register_exception_handlers(app)
    """
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
