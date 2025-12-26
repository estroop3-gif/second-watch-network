#!/usr/bin/env python3
"""
SWN Desktop Helper - Local HTTP server for footage offload and upload

Runs on localhost:47284 and provides:
- Drive listing (removable, fixed, network)
- Directory browsing
- File streaming for video playback
- Thumbnail generation
- Checksum calculation
- Upload to cloud storage
"""

import os
import sys
import json
import hashlib
import platform
import subprocess
import mimetypes
from pathlib import Path
from datetime import datetime
from typing import Optional, List
import asyncio

from fastapi import FastAPI, HTTPException, Query, Response, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pydantic import BaseModel
import httpx

# Version info
VERSION = "1.0.0"
PORT = 47284

app = FastAPI(title="SWN Desktop Helper", version=VERSION)

# Enable CORS for web UI access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Video extensions we recognize
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.mxf', '.r3d', '.braw', '.arw', '.prores', '.dnxhd', '.webm', '.m4v'}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.raw', '.cr2', '.nef', '.arw', '.dng'}
AUDIO_EXTENSIONS = {'.wav', '.mp3', '.aac', '.flac', '.m4a', '.aiff', '.ogg'}

# Cache for checksums
checksum_cache = {}

# Current project context
current_project_id: Optional[str] = None
api_key: Optional[str] = None
api_url: str = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"


class DriveInfo(BaseModel):
    name: str
    path: str
    type: str  # 'removable', 'fixed', 'network'
    freeSpace: Optional[int] = None
    totalSpace: Optional[int] = None


class FileInfo(BaseModel):
    name: str
    path: str
    isDirectory: bool
    size: Optional[int] = None
    modifiedAt: Optional[str] = None
    isVideo: bool = False
    isImage: bool = False
    isAudio: bool = False


class UploadRequest(BaseModel):
    file_path: str
    project_id: str
    card_id: Optional[str] = None
    day_id: Optional[str] = None


class ConfigRequest(BaseModel):
    project_id: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None


@app.get("/status")
async def get_status():
    """Return helper status and version info"""
    return {
        "connected": True,
        "version": VERSION,
        "platform": platform.system(),
        "projectId": current_project_id,
        "hasApiKey": api_key is not None,
    }


@app.post("/config")
async def set_config(config: ConfigRequest):
    """Set configuration (project ID, API key)"""
    global current_project_id, api_key, api_url

    if config.project_id is not None:
        current_project_id = config.project_id
    if config.api_key is not None:
        api_key = config.api_key
    if config.api_url is not None:
        api_url = config.api_url

    return {"success": True, "projectId": current_project_id}


@app.get("/drives")
async def list_drives():
    """List available drives on the system"""
    drives: List[DriveInfo] = []

    system = platform.system()

    if system == "Windows":
        # Windows: Check drive letters
        import ctypes
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            if bitmask & 1:
                drive_path = f"{letter}:\\"
                drive_type = ctypes.windll.kernel32.GetDriveTypeW(drive_path)
                # 2=Removable, 3=Fixed, 4=Network, 5=CD-ROM
                type_map = {2: 'removable', 3: 'fixed', 4: 'network', 5: 'removable'}
                if drive_type in type_map:
                    try:
                        free_bytes = ctypes.c_ulonglong(0)
                        total_bytes = ctypes.c_ulonglong(0)
                        ctypes.windll.kernel32.GetDiskFreeSpaceExW(
                            drive_path,
                            ctypes.byref(free_bytes),
                            ctypes.byref(total_bytes),
                            None
                        )
                        drives.append(DriveInfo(
                            name=f"Drive ({letter}:)",
                            path=drive_path,
                            type=type_map[drive_type],
                            freeSpace=free_bytes.value,
                            totalSpace=total_bytes.value,
                        ))
                    except:
                        drives.append(DriveInfo(
                            name=f"Drive ({letter}:)",
                            path=drive_path,
                            type=type_map[drive_type],
                        ))
            bitmask >>= 1

    elif system == "Darwin":  # macOS
        # Check /Volumes for mounted drives
        volumes_path = Path("/Volumes")
        if volumes_path.exists():
            for volume in volumes_path.iterdir():
                if volume.is_dir() and not volume.name.startswith('.'):
                    try:
                        stat = os.statvfs(str(volume))
                        free_space = stat.f_bavail * stat.f_frsize
                        total_space = stat.f_blocks * stat.f_frsize

                        # Determine type based on mount info
                        drive_type = 'fixed'
                        if 'TimeMachine' in volume.name or volume.name == 'Macintosh HD':
                            drive_type = 'fixed'
                        elif any(x in volume.name.upper() for x in ['USB', 'SD', 'CF', 'CARD']):
                            drive_type = 'removable'

                        drives.append(DriveInfo(
                            name=volume.name,
                            path=str(volume),
                            type=drive_type,
                            freeSpace=free_space,
                            totalSpace=total_space,
                        ))
                    except:
                        drives.append(DriveInfo(
                            name=volume.name,
                            path=str(volume),
                            type='fixed',
                        ))

    else:  # Linux
        # Check common mount points
        mount_points = ['/media', '/mnt', '/run/media']
        for mount_base in mount_points:
            base_path = Path(mount_base)
            if base_path.exists():
                # Handle /run/media/username structure
                if mount_base == '/run/media':
                    for user_dir in base_path.iterdir():
                        if user_dir.is_dir():
                            for volume in user_dir.iterdir():
                                if volume.is_dir():
                                    try:
                                        stat = os.statvfs(str(volume))
                                        drives.append(DriveInfo(
                                            name=volume.name,
                                            path=str(volume),
                                            type='removable',
                                            freeSpace=stat.f_bavail * stat.f_frsize,
                                            totalSpace=stat.f_blocks * stat.f_frsize,
                                        ))
                                    except:
                                        pass
                else:
                    for volume in base_path.iterdir():
                        if volume.is_dir():
                            try:
                                stat = os.statvfs(str(volume))
                                drives.append(DriveInfo(
                                    name=volume.name,
                                    path=str(volume),
                                    type='removable',
                                    freeSpace=stat.f_bavail * stat.f_frsize,
                                    totalSpace=stat.f_blocks * stat.f_frsize,
                                ))
                            except:
                                pass

        # Also add home directory
        home = Path.home()
        try:
            stat = os.statvfs(str(home))
            drives.append(DriveInfo(
                name="Home",
                path=str(home),
                type='fixed',
                freeSpace=stat.f_bavail * stat.f_frsize,
                totalSpace=stat.f_blocks * stat.f_frsize,
            ))
        except:
            pass

    return {"drives": [d.model_dump() for d in drives]}


@app.get("/browse")
async def browse_directory(path: str = Query(..., description="Directory path to browse")):
    """Browse a directory and list its contents"""
    dir_path = Path(path)

    if not dir_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if not dir_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    files: List[FileInfo] = []

    try:
        for item in sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            if item.name.startswith('.'):
                continue  # Skip hidden files

            try:
                stat = item.stat()
                ext = item.suffix.lower()

                files.append(FileInfo(
                    name=item.name,
                    path=str(item),
                    isDirectory=item.is_dir(),
                    size=stat.st_size if item.is_file() else None,
                    modifiedAt=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    isVideo=ext in VIDEO_EXTENSIONS,
                    isImage=ext in IMAGE_EXTENSIONS,
                    isAudio=ext in AUDIO_EXTENSIONS,
                ))
            except (PermissionError, OSError):
                continue
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return {"files": [f.model_dump() for f in files], "path": str(dir_path)}


@app.get("/file")
async def stream_file(path: str = Query(..., description="File path to stream")):
    """Stream a file for playback"""
    file_path = Path(path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=file_path.name,
    )


@app.get("/thumbnail")
async def get_thumbnail(path: str = Query(..., description="Video file path")):
    """Generate a thumbnail for a video file"""
    file_path = Path(path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Check if ffmpeg is available
    try:
        # Generate thumbnail using ffmpeg
        thumb_path = Path(f"/tmp/swn_thumb_{hash(path)}.jpg")

        if not thumb_path.exists():
            result = subprocess.run([
                'ffmpeg', '-y', '-i', str(file_path),
                '-ss', '00:00:01',  # 1 second in
                '-vframes', '1',
                '-vf', 'scale=320:-1',
                str(thumb_path)
            ], capture_output=True, timeout=30)

            if result.returncode != 0:
                raise HTTPException(status_code=500, detail="Failed to generate thumbnail")

        return FileResponse(path=str(thumb_path), media_type="image/jpeg")

    except FileNotFoundError:
        raise HTTPException(status_code=501, detail="ffmpeg not installed")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Thumbnail generation timed out")


@app.post("/checksum")
async def calculate_checksum(path: str = Query(..., description="File path")):
    """Calculate MD5 checksum of a file"""
    file_path = Path(path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Check cache
    cache_key = f"{path}:{file_path.stat().st_mtime}"
    if cache_key in checksum_cache:
        return {"checksum": checksum_cache[cache_key], "cached": True}

    # Calculate checksum
    md5 = hashlib.md5()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            md5.update(chunk)

    checksum = md5.hexdigest()
    checksum_cache[cache_key] = checksum

    return {"checksum": checksum, "cached": False}


@app.post("/upload")
async def upload_file(request: UploadRequest, background_tasks: BackgroundTasks):
    """Upload a file to cloud storage"""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key not configured")

    file_path = Path(request.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get presigned upload URL
    async with httpx.AsyncClient() as client:
        # Request presigned URL
        response = await client.post(
            f"{api_url}/api/v1/backlot/dailies/upload-url",
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "project_id": request.project_id,
                "card_id": request.card_id,
                "file_name": file_path.name,
                "content_type": mimetypes.guess_type(str(file_path))[0] or "application/octet-stream",
            }
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to get upload URL")

        upload_data = response.json()
        upload_url = upload_data.get("upload_url")
        s3_key = upload_data.get("key")

        # Upload to S3
        with open(file_path, 'rb') as f:
            upload_response = await client.put(
                upload_url,
                content=f.read(),
                headers={"Content-Type": mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"}
            )

        if upload_response.status_code not in (200, 204):
            raise HTTPException(status_code=500, detail="Upload failed")

        return {
            "success": True,
            "key": s3_key,
            "file_name": file_path.name,
        }


@app.get("/media-info")
async def get_media_info(path: str = Query(..., description="Media file path")):
    """Get detailed media info using ffprobe"""
    file_path = Path(path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format', '-show_streams',
            str(file_path)
        ], capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            raise HTTPException(status_code=500, detail="Failed to get media info")

    except FileNotFoundError:
        raise HTTPException(status_code=501, detail="ffprobe not installed")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid ffprobe output")


@app.get("/scan-folder")
async def scan_folder(path: str = Query(..., description="Folder to scan for media")):
    """Recursively scan a folder for media files"""
    folder_path = Path(path)

    if not folder_path.exists():
        raise HTTPException(status_code=404, detail="Folder not found")

    media_files = []

    def scan_recursive(dir_path: Path, depth: int = 0):
        if depth > 5:  # Limit recursion depth
            return

        try:
            for item in dir_path.iterdir():
                if item.name.startswith('.'):
                    continue

                if item.is_dir():
                    scan_recursive(item, depth + 1)
                elif item.is_file():
                    ext = item.suffix.lower()
                    if ext in VIDEO_EXTENSIONS or ext in IMAGE_EXTENSIONS:
                        try:
                            stat = item.stat()
                            media_files.append({
                                "name": item.name,
                                "path": str(item),
                                "relativePath": str(item.relative_to(folder_path)),
                                "size": stat.st_size,
                                "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                                "isVideo": ext in VIDEO_EXTENSIONS,
                                "isImage": ext in IMAGE_EXTENSIONS,
                            })
                        except:
                            pass
        except PermissionError:
            pass

    scan_recursive(folder_path)

    return {
        "path": str(folder_path),
        "totalFiles": len(media_files),
        "files": media_files,
    }


def main():
    """Run the desktop helper server"""
    import uvicorn

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                  SWN Desktop Helper v{VERSION}                  ║
╠══════════════════════════════════════════════════════════════╣
║  Running on: http://localhost:{PORT}                          ║
║  Platform: {platform.system():50s}║
║                                                              ║
║  The web UI will automatically detect this helper.           ║
║  Keep this window open while using footage tools.            ║
║                                                              ║
║  Press Ctrl+C to stop.                                       ║
╚══════════════════════════════════════════════════════════════╝
""")

    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
