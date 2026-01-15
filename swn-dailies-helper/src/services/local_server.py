"""
Local HTTP server for web UI communication.
Runs on port 47284 and provides endpoints for browsing local files,
streaming video, and generating thumbnails.
"""
import os
import platform
import mimetypes
import logging
import traceback
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
import uvicorn

from src.services.card_reader import CardReader
from src.services.checksum import calculate_xxh64
from src.services.config import ConfigManager
from src.services.metadata_extractor import MetadataExtractor
from src.services.qc_checker import QCChecker
from src.services.exceptions import (
    SWNHelperError,
    PathNotFoundError,
    PathNotDirectoryError,
    PathNotFileError,
    PermissionDeniedError,
    PathTraversalError,
    LinkedDriveNotFoundError,
    LinkedDriveAlreadyExistsError,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("swn-helper")

# Server configuration
HELPER_PORT = 47284
VERSION = "1.0.0"

app = FastAPI(title="SWN Dailies Helper", version=VERSION)

# Allow CORS from localhost and the SWN domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:8082",
        "https://www.secondwatchnetwork.com",
        "https://secondwatchnetwork.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
card_reader = CardReader()
config_manager = ConfigManager()
metadata_extractor = MetadataExtractor()
qc_checker = QCChecker()

# Server control
_server = None


# =============================================================================
# Global Exception Handlers
# =============================================================================

@app.exception_handler(SWNHelperError)
async def swn_error_handler(request: Request, exc: SWNHelperError):
    """Handle custom SWN Helper errors."""
    logger.error(f"SWN Error: {exc.code} - {exc.message}")
    status_code = 400
    if "NOT_FOUND" in exc.code:
        status_code = 404
    elif "PERMISSION" in exc.code or "TRAVERSAL" in exc.code:
        status_code = 403
    elif "EXISTS" in exc.code:
        status_code = 409

    return JSONResponse(
        status_code=status_code,
        content={
            "error": True,
            "code": exc.code,
            "message": exc.message,
            "detail": exc.message,
        },
    )


@app.exception_handler(Exception)
async def general_error_handler(request: Request, exc: Exception):
    """Handle unexpected errors."""
    logger.error(f"Unexpected error: {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
            "detail": str(exc) if os.environ.get("DEBUG") else "Internal server error",
        },
    )


# =============================================================================
# Health & Status Endpoints
# =============================================================================

@app.get("/status")
async def get_status():
    """Health check and app version info."""
    return {
        "status": "ok",
        "version": VERSION,
        "platform": platform.system(),
        "projectId": None,  # Set when connected to a project
    }


@app.get("/drives")
async def list_drives():
    """List mounted drives/volumes."""
    drives = card_reader.list_drives()
    return {"drives": drives}


@app.get("/browse")
async def browse_directory(path: str):
    """List contents of a directory."""
    try:
        dir_path = Path(path)
        if not dir_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        if not dir_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")

        files = []
        for item in dir_path.iterdir():
            try:
                stat = item.stat()
                is_video = item.suffix.lower() in {
                    ".mov", ".mp4", ".mxf", ".avi", ".r3d", ".braw", ".arw", ".dng"
                }
                is_image = item.suffix.lower() in {
                    ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".dpx", ".exr"
                }
                files.append({
                    "name": item.name,
                    "path": str(item),
                    "isDirectory": item.is_dir(),
                    "size": stat.st_size if item.is_file() else None,
                    "modifiedAt": stat.st_mtime,
                    "isVideo": is_video,
                    "isImage": is_image,
                })
            except (PermissionError, OSError):
                continue

        # Sort: directories first, then by name
        files.sort(key=lambda x: (not x["isDirectory"], x["name"].lower()))
        return {"files": files}

    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")


@app.get("/file")
async def stream_file(path: str):
    """Stream a video/image file for playback."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    # Determine content type
    content_type, _ = mimetypes.guess_type(str(file_path))
    if not content_type:
        content_type = "application/octet-stream"

    # Return file response (supports range requests for video seeking)
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        filename=file_path.name
    )


@app.get("/thumbnail")
async def get_thumbnail(path: str, time: float = 1.0, width: int = 320):
    """Generate and return a thumbnail for a video file.

    Args:
        path: Path to the video file
        time: Time in seconds to extract frame from (default: 1.0)
        width: Width of thumbnail in pixels (default: 320, height auto-scaled)
    """
    import subprocess
    import tempfile
    from src.services.ffmpeg_encoder import get_ffmpeg_binary

    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Check if it's a video file
    video_extensions = {'.mp4', '.mov', '.mxf', '.avi', '.mkv', '.m4v', '.webm', '.r3d', '.braw', '.arw'}
    if file_path.suffix.lower() not in video_extensions:
        raise HTTPException(status_code=400, detail="Not a video file")

    try:
        ffmpeg_path = get_ffmpeg_binary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg not available: {e}")

    # Create temporary file for thumbnail
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Run FFmpeg to extract a frame
        # -ss before -i for fast seeking
        # -vf scale for resizing
        # -vframes 1 to extract single frame
        # -q:v 2 for high quality JPEG
        cmd = [
            str(ffmpeg_path),
            '-ss', str(time),
            '-i', str(file_path),
            '-vf', f'scale={width}:-1',
            '-vframes', '1',
            '-q:v', '2',
            '-y',  # Overwrite output
            tmp_path
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=30
        )

        if result.returncode != 0:
            # Try again at the start of the video
            cmd[2] = '0'  # Change -ss to 0
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=30
            )

        if not Path(tmp_path).exists() or Path(tmp_path).stat().st_size == 0:
            raise HTTPException(status_code=500, detail="Failed to generate thumbnail")

        # Read the thumbnail and return it
        with open(tmp_path, 'rb') as f:
            thumbnail_data = f.read()

        return Response(
            content=thumbnail_data,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "max-age=3600",  # Cache for 1 hour
            }
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Thumbnail generation timed out")
    except Exception as e:
        logger.error(f"Thumbnail generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except:
            pass


@app.post("/checksum")
async def calculate_checksum(path: str):
    """Calculate XXH64 checksum for a file."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    try:
        checksum = calculate_xxh64(str(file_path))
        return {"checksum": checksum, "algorithm": "xxh64"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metadata")
async def get_metadata(path: str):
    """Extract metadata from a media file."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    try:
        metadata = metadata_extractor.extract(str(file_path))
        return metadata.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/qc")
async def run_qc_check(path: str):
    """Run QC checks on a media file."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    try:
        # Extract metadata first
        metadata = metadata_extractor.extract(str(file_path))
        # Run QC checks
        qc_result = qc_checker.check_clip(metadata)
        return qc_result.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/qc/batch")
async def run_batch_qc(paths: list[str]):
    """Run QC checks on multiple media files."""
    results = []

    for path in paths:
        file_path = Path(path)
        if not file_path.exists() or not file_path.is_file():
            continue

        try:
            metadata = metadata_extractor.extract(str(file_path))
            qc_result = qc_checker.check_clip(metadata)
            results.append(qc_result.to_dict())
        except Exception:
            continue

    # Generate summary
    clips_metadata = [metadata_extractor.extract(p) for p in paths if Path(p).exists()]
    _, summary = qc_checker.check_batch(clips_metadata)

    return {
        "results": results,
        "summary": summary.to_dict()
    }


# =============================================================================
# Linked Drives Endpoints
# =============================================================================

@app.get("/linked-drives")
async def list_linked_drives():
    """List all linked drives configured for remote viewing."""
    drives = config_manager.get_linked_drives()

    # Add availability status for each drive
    result = []
    for drive in drives:
        drive_path = Path(drive["path"])
        is_available = drive_path.exists() and drive_path.is_dir()

        drive_info = {
            "name": drive["name"],
            "path": drive["path"],
            "available": is_available,
        }

        # Add storage info if available
        if is_available:
            try:
                import shutil
                usage = shutil.disk_usage(drive["path"])
                drive_info["freeBytes"] = usage.free
                drive_info["totalBytes"] = usage.total
                drive_info["usedBytes"] = usage.used
            except OSError:
                pass

        result.append(drive_info)

    return {"drives": result}


@app.post("/linked-drives")
async def link_drive(name: str, path: str):
    """Link a new drive for remote viewing."""
    logger.info(f"Linking drive: {name} -> {path}")

    # Validate path
    drive_path = Path(path)
    if not drive_path.exists():
        raise PathNotFoundError(path)
    if not drive_path.is_dir():
        raise PathNotDirectoryError(path)

    # Add the drive
    if config_manager.add_linked_drive(name, path):
        logger.info(f"Successfully linked drive: {name}")
        return {"success": True, "name": name, "path": path}
    else:
        raise LinkedDriveAlreadyExistsError(name)


@app.delete("/linked-drives/{name}")
async def unlink_drive(name: str):
    """Unlink a drive by name."""
    logger.info(f"Unlinking drive: {name}")

    if config_manager.remove_linked_drive(name):
        logger.info(f"Successfully unlinked drive: {name}")
        return {"success": True, "name": name}
    else:
        raise LinkedDriveNotFoundError(name)


def _validate_path_security(base_path: str, relative_path: str) -> Path:
    """Validate a path is within the base directory (prevent traversal attacks)."""
    full_path = Path(base_path) / relative_path
    try:
        resolved = full_path.resolve()
        base_resolved = Path(base_path).resolve()
        if not str(resolved).startswith(str(base_resolved)):
            raise PathTraversalError()
    except ValueError:
        raise PathTraversalError()
    return full_path


@app.get("/linked-drives/{name}/browse")
async def browse_linked_drive(name: str, path: str = ""):
    """Browse contents of a linked drive.

    Args:
        name: Name of the linked drive
        path: Relative path within the drive (optional)
    """
    logger.debug(f"Browsing linked drive: {name}, path: {path}")

    # Get the drive's base path
    base_path = config_manager.get_linked_drive_path(name)
    if not base_path:
        raise LinkedDriveNotFoundError(name)

    # Construct and validate full path
    if path:
        full_path = _validate_path_security(base_path, path)
    else:
        full_path = Path(base_path)

    if not full_path.exists():
        raise PathNotFoundError(str(full_path))
    if not full_path.is_dir():
        raise PathNotDirectoryError(str(full_path))

    try:
        files = []
        for item in full_path.iterdir():
            try:
                stat = item.stat()
                is_video = item.suffix.lower() in {
                    ".mov", ".mp4", ".mxf", ".avi", ".r3d", ".braw", ".arw", ".dng", ".mkv", ".webm"
                }
                is_image = item.suffix.lower() in {
                    ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".dpx", ".exr"
                }

                # Get relative path from base
                rel_path = str(item.relative_to(base_path))

                files.append({
                    "name": item.name,
                    "path": str(item),
                    "relativePath": rel_path,
                    "isDirectory": item.is_dir(),
                    "size": stat.st_size if item.is_file() else None,
                    "modifiedAt": stat.st_mtime,
                    "isVideo": is_video,
                    "isImage": is_image,
                })
            except PermissionError:
                logger.warning(f"Permission denied for: {item}")
                continue
            except OSError as e:
                logger.warning(f"OS error accessing {item}: {e}")
                continue

        # Sort: directories first, then by name
        files.sort(key=lambda x: (not x["isDirectory"], x["name"].lower()))

        return {
            "success": True,
            "drive": name,
            "path": path or "/",
            "basePath": base_path,
            "files": files,
            "fileCount": len(files),
        }

    except PermissionError:
        raise PermissionDeniedError(str(full_path))


@app.get("/linked-drives/{name}/file")
async def stream_linked_drive_file(name: str, path: str):
    """Stream a file from a linked drive.

    Args:
        name: Name of the linked drive
        path: Relative path to the file within the drive
    """
    logger.debug(f"Streaming file from linked drive: {name}, path: {path}")

    # Get the drive's base path
    base_path = config_manager.get_linked_drive_path(name)
    if not base_path:
        raise LinkedDriveNotFoundError(name)

    # Validate path security
    full_path = _validate_path_security(base_path, path)

    if not full_path.exists():
        raise PathNotFoundError(str(full_path))
    if not full_path.is_file():
        raise PathNotFileError(str(full_path))

    # Determine content type
    content_type, _ = mimetypes.guess_type(str(full_path))
    if not content_type:
        content_type = "application/octet-stream"

    logger.info(f"Streaming: {full_path.name} ({content_type})")

    return FileResponse(
        path=str(full_path),
        media_type=content_type,
        filename=full_path.name
    )


def start_local_server():
    """Start the local HTTP server."""
    global _server
    config = uvicorn.Config(app, host="127.0.0.1", port=HELPER_PORT, log_level="warning")
    _server = uvicorn.Server(config)
    _server.run()


def stop_local_server():
    """Stop the local HTTP server."""
    global _server
    if _server:
        _server.should_exit = True
