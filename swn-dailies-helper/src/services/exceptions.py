"""
Custom exceptions for the SWN Dailies Helper.
"""


class SWNHelperError(Exception):
    """Base exception for all SWN Helper errors."""

    def __init__(self, message: str, code: str = "UNKNOWN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


# Configuration Errors
class ConfigError(SWNHelperError):
    """Configuration-related errors."""

    def __init__(self, message: str):
        super().__init__(message, "CONFIG_ERROR")


class APIKeyNotFoundError(ConfigError):
    """API key is not configured."""

    def __init__(self):
        super().__init__("API key not configured. Please set up your API key in the Setup page.")
        self.code = "API_KEY_NOT_FOUND"


class ProjectNotFoundError(ConfigError):
    """Project ID is not configured."""

    def __init__(self):
        super().__init__("Project not configured. Please connect to a project in the Setup page.")
        self.code = "PROJECT_NOT_FOUND"


# Upload Errors
class UploadError(SWNHelperError):
    """Upload-related errors."""

    def __init__(self, message: str, code: str = "UPLOAD_ERROR"):
        super().__init__(message, code)


class PresignedUrlError(UploadError):
    """Failed to get presigned URL."""

    def __init__(self, message: str):
        super().__init__(f"Failed to get upload URL: {message}", "PRESIGNED_URL_ERROR")


class FileUploadError(UploadError):
    """File upload failed."""

    def __init__(self, filename: str, reason: str):
        super().__init__(f"Failed to upload '{filename}': {reason}", "FILE_UPLOAD_ERROR")
        self.filename = filename


class ChecksumMismatchError(UploadError):
    """Checksum verification failed."""

    def __init__(self, filename: str, expected: str, actual: str):
        super().__init__(
            f"Checksum mismatch for '{filename}'. Expected {expected}, got {actual}",
            "CHECKSUM_MISMATCH"
        )
        self.filename = filename
        self.expected = expected
        self.actual = actual


# File System Errors
class FileSystemError(SWNHelperError):
    """File system related errors."""

    def __init__(self, message: str, code: str = "FILESYSTEM_ERROR"):
        super().__init__(message, code)


class PathNotFoundError(FileSystemError):
    """Path does not exist."""

    def __init__(self, path: str):
        super().__init__(f"Path not found: {path}", "PATH_NOT_FOUND")
        self.path = path


class PathNotDirectoryError(FileSystemError):
    """Path is not a directory."""

    def __init__(self, path: str):
        super().__init__(f"Path is not a directory: {path}", "NOT_A_DIRECTORY")
        self.path = path


class PathNotFileError(FileSystemError):
    """Path is not a file."""

    def __init__(self, path: str):
        super().__init__(f"Path is not a file: {path}", "NOT_A_FILE")
        self.path = path


class PermissionDeniedError(FileSystemError):
    """Permission denied."""

    def __init__(self, path: str):
        super().__init__(f"Permission denied: {path}", "PERMISSION_DENIED")
        self.path = path


class PathTraversalError(FileSystemError):
    """Path traversal attempt detected."""

    def __init__(self):
        super().__init__("Access denied - path traversal detected", "PATH_TRAVERSAL")


# Watch Folder Errors
class WatchFolderError(SWNHelperError):
    """Watch folder related errors."""

    def __init__(self, message: str, code: str = "WATCH_FOLDER_ERROR"):
        super().__init__(message, code)


class WatchFolderNotConfiguredError(WatchFolderError):
    """No watch folder configured."""

    def __init__(self):
        super().__init__("No watch folder configured", "WATCH_FOLDER_NOT_CONFIGURED")


class WatchFolderAlreadyRunningError(WatchFolderError):
    """Watch folder service is already running."""

    def __init__(self):
        super().__init__("Watch folder is already running", "WATCH_FOLDER_ALREADY_RUNNING")


# Linked Drive Errors
class LinkedDriveError(SWNHelperError):
    """Linked drive related errors."""

    def __init__(self, message: str, code: str = "LINKED_DRIVE_ERROR"):
        super().__init__(message, code)


class LinkedDriveNotFoundError(LinkedDriveError):
    """Linked drive not found."""

    def __init__(self, name: str):
        super().__init__(f"Linked drive not found: {name}", "LINKED_DRIVE_NOT_FOUND")
        self.name = name


class LinkedDriveAlreadyExistsError(LinkedDriveError):
    """Linked drive with this name already exists."""

    def __init__(self, name: str):
        super().__init__(f"A drive named '{name}' is already linked", "LINKED_DRIVE_EXISTS")
        self.name = name


class LinkedDriveUnavailableError(LinkedDriveError):
    """Linked drive is not available (disconnected)."""

    def __init__(self, name: str):
        super().__init__(f"Drive '{name}' is not available", "LINKED_DRIVE_UNAVAILABLE")
        self.name = name


# Network Errors
class NetworkError(SWNHelperError):
    """Network-related errors."""

    def __init__(self, message: str, code: str = "NETWORK_ERROR"):
        super().__init__(message, code)


class APIConnectionError(NetworkError):
    """Failed to connect to API."""

    def __init__(self, message: str = "Failed to connect to the server"):
        super().__init__(message, "API_CONNECTION_ERROR")


class APIResponseError(NetworkError):
    """API returned an error response."""

    def __init__(self, status_code: int, message: str):
        super().__init__(f"API error ({status_code}): {message}", "API_RESPONSE_ERROR")
        self.status_code = status_code


class TimeoutError(NetworkError):
    """Request timed out."""

    def __init__(self, operation: str):
        super().__init__(f"Operation timed out: {operation}", "TIMEOUT_ERROR")
        self.operation = operation
