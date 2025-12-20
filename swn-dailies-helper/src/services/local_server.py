"""
Local HTTP server for web UI communication.
Runs on port 47284 and provides endpoints for browsing local files,
streaming video, and generating thumbnails.
"""
import os
import platform
import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import uvicorn

from src.services.card_reader import CardReader
from src.services.checksum import calculate_xxh64
from src.services.metadata_extractor import MetadataExtractor
from src.services.qc_checker import QCChecker

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
        "https://www.secondwatchnetwork.com",
        "https://secondwatchnetwork.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
card_reader = CardReader()
metadata_extractor = MetadataExtractor()
qc_checker = QCChecker()

# Server control
_server = None


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
async def get_thumbnail(path: str):
    """Generate and return a thumbnail for a video file."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # For now, return a placeholder - FFmpeg thumbnail generation will be added
    # TODO: Use FFmpeg to extract a frame and return as JPEG
    raise HTTPException(status_code=501, detail="Thumbnail generation not implemented yet")


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
