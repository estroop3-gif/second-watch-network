"""
Project Files API Endpoints
File management system with S3 storage, folder hierarchy, and multipart upload
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import re
import mimetypes
import json

from app.core.database import get_client, execute_query, execute_single
from app.core.storage import s3_client, BACKLOT_FILES_BUCKET, BACKLOT_BUCKET

router = APIRouter()

# Constants
MULTIPART_THRESHOLD = 20 * 1024 * 1024  # 20MB - use multipart above this
PART_SIZE = 10 * 1024 * 1024  # 10MB per part
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB max
PRESIGNED_URL_EXPIRY = 3600  # 1 hour for upload/download URLs


# =====================================================
# Pydantic Models
# =====================================================

class FolderCreate(BaseModel):
    parent_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_id: Optional[str] = None  # Use empty string to move to root


class FileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder_id: Optional[str] = None  # Use empty string to move to root
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class UploadInitiate(BaseModel):
    folder_id: Optional[str] = None
    original_name: str = Field(..., min_length=1)
    mime_type: Optional[str] = None
    size_bytes: int = Field(..., gt=0)


class MultipartPartRequest(BaseModel):
    upload_id: str
    part_number: int = Field(..., ge=1, le=10000)


class MultipartComplete(BaseModel):
    upload_id: str
    parts: List[Dict[str, Any]]  # [{partNumber, etag}]


class MultipartAbort(BaseModel):
    upload_id: str


class FileLinkCreate(BaseModel):
    target_type: str
    target_id: str
    label: Optional[str] = None


# =====================================================
# Helper Functions
# =====================================================

async def verify_project_access(project_id: str, user_id: str) -> dict:
    """Verify user has access to project and return profile ID"""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :user_id",
        {"user_id": user_id}
    )
    if not profile:
        raise HTTPException(status_code=401, detail="Profile not found")

    profile_id = profile['id']

    access = execute_single("""
        SELECT bp.id, bpm.role
        FROM backlot_projects bp
        LEFT JOIN backlot_project_members bpm ON bpm.project_id = bp.id AND bpm.user_id = :profile_id
        WHERE bp.id = :project_id
        AND (bp.owner_id = :profile_id OR bpm.user_id IS NOT NULL)
    """, {"project_id": project_id, "profile_id": profile_id})

    if not access:
        raise HTTPException(status_code=403, detail="No access to this project")

    return {"profile_id": profile_id, "role": access.get('role')}


def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage"""
    # Remove path separators and null bytes
    filename = filename.replace('/', '_').replace('\\', '_').replace('\0', '')
    # Keep only safe characters
    filename = re.sub(r'[^\w\s\-\.\(\)]', '_', filename)
    # Limit length
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200-len(ext)] + ext
    return filename.strip() or 'unnamed'


def get_extension(filename: str) -> Optional[str]:
    """Extract file extension"""
    _, ext = os.path.splitext(filename)
    return ext.lower() if ext else None


def guess_mime_type(filename: str, provided: Optional[str] = None) -> str:
    """Guess MIME type from filename or use provided"""
    if provided and provided != 'application/octet-stream':
        return provided
    mime, _ = mimetypes.guess_type(filename)
    return mime or 'application/octet-stream'


def build_s3_key(project_id: str, file_id: str, filename: str) -> str:
    """Build S3 key for file storage"""
    safe_name = sanitize_filename(filename)
    return f"projects/{project_id}/files/{file_id}/{safe_name}"


async def ensure_root_folder(project_id: str, profile_id: str) -> dict:
    """Ensure root folder exists for project, create if not"""
    root = execute_single("""
        SELECT id, name, path FROM backlot_project_folders
        WHERE project_id = :project_id AND parent_id IS NULL AND name = 'Root'
    """, {"project_id": project_id})

    if root:
        return root

    # Create root folder
    client = get_client()
    result = client.table("backlot_project_folders").insert({
        "project_id": project_id,
        "parent_id": None,
        "name": "Root",
        "path": "/Root",
        "sort_order": 0,
        "created_by_user_id": profile_id
    }).execute()

    return result.data[0] if result.data else None


async def update_folder_paths(folder_id: str, new_path: str, project_id: str):
    """Update path for folder and all descendants"""
    client = get_client()

    # Update this folder
    client.table("backlot_project_folders").update({
        "path": new_path
    }).eq("id", folder_id).execute()

    # Get children and update recursively
    children = execute_query("""
        SELECT id, name FROM backlot_project_folders
        WHERE project_id = :project_id AND parent_id = :folder_id
    """, {"project_id": project_id, "folder_id": folder_id})

    for child in children:
        child_path = f"{new_path}/{child['name']}"
        await update_folder_paths(child['id'], child_path, project_id)


def is_descendant_of(folder_id: str, potential_ancestor_id: str, project_id: str) -> bool:
    """Check if folder_id is a descendant of potential_ancestor_id"""
    current = execute_single("""
        SELECT parent_id FROM backlot_project_folders
        WHERE id = :folder_id AND project_id = :project_id
    """, {"folder_id": folder_id, "project_id": project_id})

    while current and current.get('parent_id'):
        if current['parent_id'] == potential_ancestor_id:
            return True
        current = execute_single("""
            SELECT parent_id FROM backlot_project_folders
            WHERE id = :folder_id AND project_id = :project_id
        """, {"folder_id": current['parent_id'], "project_id": project_id})

    return False


# =====================================================
# Folder Endpoints
# =====================================================

@router.get("/projects/{project_id}/files/folders")
async def list_folders(
    project_id: str,
    authorization: str = Header(...)
):
    """Get folder tree for project"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    access = await verify_project_access(project_id, user_id)

    # Ensure root folder exists
    await ensure_root_folder(project_id, access['profile_id'])

    folders = execute_query("""
        SELECT id, parent_id, name, path, sort_order, created_at
        FROM backlot_project_folders
        WHERE project_id = :project_id
        ORDER BY sort_order, name
    """, {"project_id": project_id})

    return {"folders": folders}


@router.post("/projects/{project_id}/files/folders")
async def create_folder(
    project_id: str,
    data: FolderCreate,
    authorization: str = Header(...)
):
    """Create a new folder"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    access = await verify_project_access(project_id, user_id)
    profile_id = access['profile_id']

    # Ensure root exists
    root = await ensure_root_folder(project_id, profile_id)

    # Determine parent
    parent_id = data.parent_id
    if not parent_id:
        parent_id = root['id']

    # Get parent info for path
    parent = execute_single("""
        SELECT id, path FROM backlot_project_folders
        WHERE id = :parent_id AND project_id = :project_id
    """, {"parent_id": parent_id, "project_id": project_id})

    if not parent:
        raise HTTPException(status_code=404, detail="Parent folder not found")

    # Check for duplicate name
    existing = execute_single("""
        SELECT id FROM backlot_project_folders
        WHERE project_id = :project_id AND parent_id = :parent_id AND name = :name
    """, {"project_id": project_id, "parent_id": parent_id, "name": data.name})

    if existing:
        raise HTTPException(status_code=409, detail="Folder with this name already exists")

    # Create folder
    new_path = f"{parent['path']}/{data.name}"
    client = get_client()
    result = client.table("backlot_project_folders").insert({
        "project_id": project_id,
        "parent_id": parent_id,
        "name": data.name,
        "path": new_path,
        "sort_order": 0,
        "created_by_user_id": profile_id
    }).execute()

    return result.data[0] if result.data else None


@router.put("/projects/{project_id}/files/folders/{folder_id}")
async def update_folder(
    project_id: str,
    folder_id: str,
    data: FolderUpdate,
    authorization: str = Header(...)
):
    """Update folder name or move to different parent"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get current folder
    folder = execute_single("""
        SELECT * FROM backlot_project_folders
        WHERE id = :folder_id AND project_id = :project_id
    """, {"folder_id": folder_id, "project_id": project_id})

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Cannot modify root folder
    if folder['parent_id'] is None and folder['name'] == 'Root':
        raise HTTPException(status_code=400, detail="Cannot modify root folder")

    update_data = {}
    new_name = data.name or folder['name']
    new_parent_id = folder['parent_id']

    # Handle parent change
    if data.parent_id is not None:
        if data.parent_id == '':
            # Move to root - find root folder
            root = execute_single("""
                SELECT id FROM backlot_project_folders
                WHERE project_id = :project_id AND parent_id IS NULL AND name = 'Root'
            """, {"project_id": project_id})
            new_parent_id = root['id'] if root else None
        else:
            # Check target exists
            target = execute_single("""
                SELECT id FROM backlot_project_folders
                WHERE id = :target_id AND project_id = :project_id
            """, {"target_id": data.parent_id, "project_id": project_id})
            if not target:
                raise HTTPException(status_code=404, detail="Target folder not found")

            # Cannot move into itself or descendants
            if data.parent_id == folder_id or is_descendant_of(data.parent_id, folder_id, project_id):
                raise HTTPException(status_code=400, detail="Cannot move folder into itself or its descendants")

            new_parent_id = data.parent_id

        update_data['parent_id'] = new_parent_id

    # Handle rename
    if data.name:
        update_data['name'] = data.name

    # Check for duplicate sibling name
    if update_data:
        existing = execute_single("""
            SELECT id FROM backlot_project_folders
            WHERE project_id = :project_id AND parent_id = :parent_id AND name = :name AND id != :folder_id
        """, {"project_id": project_id, "parent_id": new_parent_id, "name": new_name, "folder_id": folder_id})

        if existing:
            raise HTTPException(status_code=409, detail="Folder with this name already exists in destination")

    if not update_data:
        return folder

    # Update folder
    client = get_client()
    result = client.table("backlot_project_folders").update(update_data).eq("id", folder_id).execute()

    # Update paths
    if update_data:
        parent = execute_single("""
            SELECT path FROM backlot_project_folders WHERE id = :parent_id
        """, {"parent_id": new_parent_id})
        new_path = f"{parent['path']}/{new_name}" if parent else f"/{new_name}"
        await update_folder_paths(folder_id, new_path, project_id)

    return result.data[0] if result.data else folder


@router.delete("/projects/{project_id}/files/folders/{folder_id}")
async def delete_folder(
    project_id: str,
    folder_id: str,
    authorization: str = Header(...)
):
    """Delete a folder (must be empty)"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get folder
    folder = execute_single("""
        SELECT * FROM backlot_project_folders
        WHERE id = :folder_id AND project_id = :project_id
    """, {"folder_id": folder_id, "project_id": project_id})

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Cannot delete root
    if folder['parent_id'] is None and folder['name'] == 'Root':
        raise HTTPException(status_code=400, detail="Cannot delete root folder")

    # Check for children
    children = execute_single("""
        SELECT COUNT(*) as count FROM backlot_project_folders
        WHERE project_id = :project_id AND parent_id = :folder_id
    """, {"project_id": project_id, "folder_id": folder_id})

    if children and children['count'] > 0:
        raise HTTPException(status_code=409, detail="Folder not empty - contains subfolders")

    # Check for files
    files = execute_single("""
        SELECT COUNT(*) as count FROM backlot_project_files
        WHERE project_id = :project_id AND folder_id = :folder_id AND upload_status != 'DELETED'
    """, {"project_id": project_id, "folder_id": folder_id})

    if files and files['count'] > 0:
        raise HTTPException(status_code=409, detail="Folder not empty - contains files")

    # Delete folder
    client = get_client()
    client.table("backlot_project_folders").delete().eq("id", folder_id).execute()

    return {"success": True}


# =====================================================
# File Listing Endpoints
# =====================================================

@router.get("/projects/{project_id}/files")
async def list_files(
    project_id: str,
    folder_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),  # video, audio, image, document, other
    authorization: str = Header(...)
):
    """List files with optional filters"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Build query
    conditions = ["project_id = :project_id", "upload_status != 'DELETED'"]
    params = {"project_id": project_id}

    if folder_id:
        conditions.append("folder_id = :folder_id")
        params["folder_id"] = folder_id

    if search:
        conditions.append("(name ILIKE :search OR original_name ILIKE :search)")
        params["search"] = f"%{search}%"

    if tag:
        conditions.append("tags @> :tag::jsonb")
        params["tag"] = json.dumps([tag])

    if file_type:
        # Map file type to MIME type patterns
        mime_patterns = {
            'video': ['video/%'],
            'audio': ['audio/%'],
            'image': ['image/%'],
            'document': ['application/pdf', 'application/msword', 'application/vnd.%', 'text/%'],
            'other': None  # Handled separately
        }
        patterns = mime_patterns.get(file_type)
        if patterns:
            mime_conditions = " OR ".join([f"mime_type LIKE '{p}'" for p in patterns])
            conditions.append(f"({mime_conditions})")

    where_clause = " AND ".join(conditions)

    files = execute_query(f"""
        SELECT id, folder_id, name, original_name, extension, mime_type,
               size_bytes, upload_status, tags, notes, uploaded_at, created_at, updated_at
        FROM backlot_project_files
        WHERE {where_clause}
        ORDER BY name
    """, params)

    return {"files": files}


@router.put("/projects/{project_id}/files/{file_id}")
async def update_file(
    project_id: str,
    file_id: str,
    data: FileUpdate,
    authorization: str = Header(...)
):
    """Update file metadata (name, folder, notes, tags)"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get current file
    file = execute_single("""
        SELECT * FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id AND upload_status != 'DELETED'
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    update_data = {}

    if data.name is not None:
        update_data['name'] = sanitize_filename(data.name)
        update_data['extension'] = get_extension(data.name)

    if data.folder_id is not None:
        if data.folder_id == '':
            # Move to root
            root = execute_single("""
                SELECT id FROM backlot_project_folders
                WHERE project_id = :project_id AND parent_id IS NULL AND name = 'Root'
            """, {"project_id": project_id})
            update_data['folder_id'] = root['id'] if root else None
        else:
            # Verify folder exists
            folder = execute_single("""
                SELECT id FROM backlot_project_folders
                WHERE id = :folder_id AND project_id = :project_id
            """, {"folder_id": data.folder_id, "project_id": project_id})
            if not folder:
                raise HTTPException(status_code=404, detail="Folder not found")
            update_data['folder_id'] = data.folder_id

    if data.notes is not None:
        update_data['notes'] = data.notes

    if data.tags is not None:
        update_data['tags'] = json.dumps(data.tags)

    if not update_data:
        return file

    client = get_client()
    result = client.table("backlot_project_files").update(update_data).eq("id", file_id).execute()

    return result.data[0] if result.data else file


@router.delete("/projects/{project_id}/files/{file_id}")
async def delete_file(
    project_id: str,
    file_id: str,
    authorization: str = Header(...)
):
    """Soft delete a file (marks as DELETED, attempts S3 deletion)"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get file
    file = execute_single("""
        SELECT * FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Mark as deleted in DB
    client = get_client()
    client.table("backlot_project_files").update({
        "upload_status": "DELETED"
    }).eq("id", file_id).execute()

    # Try to delete from S3 (best effort)
    try:
        if file['s3_key'] and file['s3_bucket']:
            s3_client.delete_object(
                Bucket=file['s3_bucket'],
                Key=file['s3_key']
            )
    except Exception as e:
        # Log but don't fail
        print(f"Warning: Failed to delete S3 object {file['s3_key']}: {e}")

    return {"success": True}


# =====================================================
# File Download Endpoint
# =====================================================

@router.get("/projects/{project_id}/files/{file_id}/download")
async def get_download_url(
    project_id: str,
    file_id: str,
    authorization: str = Header(...)
):
    """Get presigned download URL for file"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get file
    file = execute_single("""
        SELECT s3_bucket, s3_key, name, mime_type, upload_status
        FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file['upload_status'] != 'COMPLETE':
        raise HTTPException(status_code=400, detail="File upload not complete")

    # Generate presigned URL
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': file['s3_bucket'],
                'Key': file['s3_key'],
                'ResponseContentDisposition': f'attachment; filename="{file["name"]}"'
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY
        )
        return {"download_url": url, "mime_type": file['mime_type']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")


# =====================================================
# File Links Endpoints
# =====================================================

@router.get("/projects/{project_id}/files/{file_id}/links")
async def list_file_links(
    project_id: str,
    file_id: str,
    authorization: str = Header(...)
):
    """List all links for a file"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    links = execute_query("""
        SELECT id, target_type, target_id, label, created_at
        FROM backlot_project_file_links
        WHERE file_id = :file_id AND project_id = :project_id
        ORDER BY created_at DESC
    """, {"file_id": file_id, "project_id": project_id})

    return {"links": links}


@router.post("/projects/{project_id}/files/{file_id}/links")
async def create_file_link(
    project_id: str,
    file_id: str,
    data: FileLinkCreate,
    authorization: str = Header(...)
):
    """Create a link between file and another entity"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Validate target type
    valid_types = ['PROJECT', 'EPISODE', 'STORY', 'STORYBOARD', 'SIDES_PACKET', 'STRIP', 'PROJECT_DAY', 'OTHER']
    if data.target_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid target type. Must be one of: {valid_types}")

    # Check file exists
    file = execute_single("""
        SELECT id FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id AND upload_status != 'DELETED'
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check for existing link
    existing = execute_single("""
        SELECT id FROM backlot_project_file_links
        WHERE file_id = :file_id AND target_type = :target_type AND target_id = :target_id
    """, {"file_id": file_id, "target_type": data.target_type, "target_id": data.target_id})

    if existing:
        raise HTTPException(status_code=409, detail="Link already exists")

    # Create link
    client = get_client()
    result = client.table("backlot_project_file_links").insert({
        "project_id": project_id,
        "file_id": file_id,
        "target_type": data.target_type,
        "target_id": data.target_id,
        "label": data.label
    }).execute()

    return result.data[0] if result.data else None


@router.delete("/projects/{project_id}/files/{file_id}/links/{link_id}")
async def delete_file_link(
    project_id: str,
    file_id: str,
    link_id: str,
    authorization: str = Header(...)
):
    """Delete a file link"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    client = get_client()
    client.table("backlot_project_file_links").delete().eq("id", link_id).eq("file_id", file_id).execute()

    return {"success": True}


# =====================================================
# Upload Initiate Endpoint
# =====================================================

@router.post("/projects/{project_id}/files/uploads")
async def initiate_upload(
    project_id: str,
    data: UploadInitiate,
    authorization: str = Header(...)
):
    """
    Initiate a file upload.
    For files < 20MB: returns single PUT presigned URL
    For files >= 20MB: returns multipart upload initialization data
    """
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    access = await verify_project_access(project_id, user_id)
    profile_id = access['profile_id']

    # Validate size
    if data.size_bytes > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024*1024):.1f}GB")

    # Ensure root folder if no folder specified
    folder_id = data.folder_id
    if not folder_id:
        root = await ensure_root_folder(project_id, profile_id)
        folder_id = root['id']
    else:
        # Verify folder exists
        folder = execute_single("""
            SELECT id FROM backlot_project_folders
            WHERE id = :folder_id AND project_id = :project_id
        """, {"folder_id": folder_id, "project_id": project_id})
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    # Create file record
    safe_name = sanitize_filename(data.original_name)
    extension = get_extension(data.original_name)
    mime_type = guess_mime_type(data.original_name, data.mime_type)

    client = get_client()
    file_result = client.table("backlot_project_files").insert({
        "project_id": project_id,
        "folder_id": folder_id,
        "name": safe_name,
        "original_name": data.original_name,
        "extension": extension,
        "mime_type": mime_type,
        "size_bytes": data.size_bytes,
        "storage_provider": "S3",
        "s3_bucket": BACKLOT_FILES_BUCKET,
        "s3_key": "",  # Will be set after we have file ID
        "upload_status": "PENDING",
        "created_by_user_id": profile_id
    }).execute()

    if not file_result.data:
        raise HTTPException(status_code=500, detail="Failed to create file record")

    file_record = file_result.data[0]
    file_id = file_record['id']

    # Build S3 key
    s3_key = build_s3_key(project_id, file_id, safe_name)

    # Update file with S3 key
    client.table("backlot_project_files").update({
        "s3_key": s3_key
    }).eq("id", file_id).execute()

    # Determine upload type
    if data.size_bytes < MULTIPART_THRESHOLD:
        # Single PUT upload
        try:
            url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': BACKLOT_FILES_BUCKET,
                    'Key': s3_key,
                    'ContentType': mime_type
                },
                ExpiresIn=PRESIGNED_URL_EXPIRY
            )
            return {
                "file_id": file_id,
                "upload_type": "single",
                "url": url,
                "bucket": BACKLOT_FILES_BUCKET,
                "key": s3_key
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")
    else:
        # Multipart upload
        try:
            response = s3_client.create_multipart_upload(
                Bucket=BACKLOT_FILES_BUCKET,
                Key=s3_key,
                ContentType=mime_type
            )
            upload_id = response['UploadId']

            # Store upload ID
            client.table("backlot_project_files").update({
                "upload_id": upload_id,
                "upload_status": "UPLOADING"
            }).eq("id", file_id).execute()

            # Calculate parts
            num_parts = (data.size_bytes + PART_SIZE - 1) // PART_SIZE

            return {
                "file_id": file_id,
                "upload_type": "multipart",
                "upload_id": upload_id,
                "bucket": BACKLOT_FILES_BUCKET,
                "key": s3_key,
                "part_size": PART_SIZE,
                "total_parts": num_parts
            }
        except Exception as e:
            # Cleanup file record on error
            client.table("backlot_project_files").update({
                "upload_status": "FAILED"
            }).eq("id", file_id).execute()
            raise HTTPException(status_code=500, detail=f"Failed to initiate multipart upload: {str(e)}")


# =====================================================
# Multipart Upload Endpoints
# =====================================================

@router.post("/projects/{project_id}/files/uploads/{file_id}/part-url")
async def get_part_upload_url(
    project_id: str,
    file_id: str,
    data: MultipartPartRequest,
    authorization: str = Header(...)
):
    """Get presigned URL for uploading a single part"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get file
    file = execute_single("""
        SELECT s3_bucket, s3_key, upload_id, upload_status
        FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file['upload_status'] not in ['PENDING', 'UPLOADING']:
        raise HTTPException(status_code=400, detail="Upload not in progress")

    if file['upload_id'] != data.upload_id:
        raise HTTPException(status_code=400, detail="Invalid upload ID")

    try:
        url = s3_client.generate_presigned_url(
            'upload_part',
            Params={
                'Bucket': file['s3_bucket'],
                'Key': file['s3_key'],
                'UploadId': data.upload_id,
                'PartNumber': data.part_number
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY
        )
        return {"url": url, "part_number": data.part_number}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate part URL: {str(e)}")


@router.post("/projects/{project_id}/files/uploads/{file_id}/complete")
async def complete_multipart_upload(
    project_id: str,
    file_id: str,
    data: MultipartComplete,
    authorization: str = Header(...)
):
    """Complete a multipart upload"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get file
    file = execute_single("""
        SELECT s3_bucket, s3_key, upload_id
        FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file['upload_id'] != data.upload_id:
        raise HTTPException(status_code=400, detail="Invalid upload ID")

    try:
        # Format parts for S3
        parts = [{"PartNumber": p["partNumber"], "ETag": p["etag"]} for p in data.parts]
        parts.sort(key=lambda x: x["PartNumber"])

        response = s3_client.complete_multipart_upload(
            Bucket=file['s3_bucket'],
            Key=file['s3_key'],
            UploadId=data.upload_id,
            MultipartUpload={"Parts": parts}
        )

        # Update file record
        client = get_client()
        client.table("backlot_project_files").update({
            "upload_status": "COMPLETE",
            "etag": response.get('ETag', '').strip('"'),
            "uploaded_at": datetime.utcnow().isoformat(),
            "upload_id": None
        }).eq("id", file_id).execute()

        return {"success": True, "etag": response.get('ETag')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to complete upload: {str(e)}")


@router.post("/projects/{project_id}/files/uploads/{file_id}/abort")
async def abort_multipart_upload(
    project_id: str,
    file_id: str,
    data: MultipartAbort,
    authorization: str = Header(...)
):
    """Abort a multipart upload"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Get file
    file = execute_single("""
        SELECT s3_bucket, s3_key, upload_id
        FROM backlot_project_files
        WHERE id = :file_id AND project_id = :project_id
    """, {"file_id": file_id, "project_id": project_id})

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        s3_client.abort_multipart_upload(
            Bucket=file['s3_bucket'],
            Key=file['s3_key'],
            UploadId=data.upload_id
        )
    except Exception as e:
        print(f"Warning: Failed to abort S3 multipart upload: {e}")

    # Update file record
    client = get_client()
    client.table("backlot_project_files").update({
        "upload_status": "FAILED",
        "upload_id": None
    }).eq("id", file_id).execute()

    return {"success": True}


@router.post("/projects/{project_id}/files/uploads/{file_id}/finalize")
async def finalize_single_upload(
    project_id: str,
    file_id: str,
    authorization: str = Header(...)
):
    """Finalize a single PUT upload (mark as complete)"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    # Update file record
    client = get_client()
    result = client.table("backlot_project_files").update({
        "upload_status": "COMPLETE",
        "uploaded_at": datetime.utcnow().isoformat()
    }).eq("id", file_id).eq("project_id", project_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="File not found")

    return {"success": True}


# =====================================================
# Get Linked Files for Entity
# =====================================================

@router.get("/projects/{project_id}/files/by-target/{target_type}/{target_id}")
async def get_files_by_target(
    project_id: str,
    target_type: str,
    target_id: str,
    authorization: str = Header(...)
):
    """Get all files linked to a specific entity"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    files = execute_query("""
        SELECT f.id, f.name, f.original_name, f.extension, f.mime_type,
               f.size_bytes, f.upload_status, f.tags, f.uploaded_at,
               l.label, l.id as link_id
        FROM backlot_project_files f
        JOIN backlot_project_file_links l ON l.file_id = f.id
        WHERE l.project_id = :project_id
        AND l.target_type = :target_type
        AND l.target_id = :target_id
        AND f.upload_status = 'COMPLETE'
        ORDER BY f.name
    """, {"project_id": project_id, "target_type": target_type, "target_id": target_id})

    return {"files": files}


# =====================================================
# Get All Tags for Project
# =====================================================

# =====================================================
# Unified Files — All Project Files Across Tools
# =====================================================

SOURCE_LABELS = {
    'project_files': 'Project Files',
    'scripts': 'Scripts',
    'receipts': 'Receipts',
    'clearances': 'Clearances',
    'dailies': 'Dailies',
    'review_versions': 'Review',
    'standalone_assets': 'Assets',
    'continuity_exports': 'Continuity',
    'moodboards': 'Moodboards',
    'storyboards': 'Storyboards',
}


def _build_unified_query(project_id: str, source: Optional[str], search: Optional[str],
                         file_type: Optional[str], limit: int, offset: int):
    """Build UNION ALL query across all file-storing tables."""
    params = {"project_id": project_id, "limit": limit, "offset": offset}

    subqueries = []

    # 1. project_files
    subqueries.append("""
        SELECT id::text, name, 'project_files' AS source, 'Project Files' AS source_label,
               s3_key AS file_url, size_bytes, mime_type, created_at, id::text AS source_entity_id
        FROM backlot_project_files
        WHERE project_id = :project_id AND upload_status != 'DELETED' AND s3_key IS NOT NULL AND s3_key != ''
    """)

    # 2. scripts (master records + all continuity exports: PDFs, notes, breakdowns, sides)
    subqueries.append("""
        SELECT id::text, title AS name, 'scripts' AS source, 'Scripts' AS source_label,
               file_url, NULL::bigint AS size_bytes, 'application/pdf' AS mime_type,
               created_at, id::text AS source_entity_id
        FROM backlot_scripts
        WHERE project_id = :project_id AND file_url IS NOT NULL AND file_url != ''
        UNION ALL
        SELECT id::text, file_name AS name, 'scripts' AS source, 'Scripts' AS source_label,
               file_url, file_size AS size_bytes, 'application/pdf' AS mime_type,
               created_at, id::text AS source_entity_id
        FROM backlot_continuity_exports
        WHERE project_id = :project_id AND file_url IS NOT NULL AND file_url != ''
    """)

    # 3. receipts
    subqueries.append("""
        SELECT id::text, original_filename AS name, 'receipts' AS source, 'Receipts' AS source_label,
               file_url, file_size_bytes AS size_bytes, file_type AS mime_type,
               created_at, id::text AS source_entity_id
        FROM backlot_receipts
        WHERE project_id = :project_id AND file_url IS NOT NULL AND file_url != ''
    """)

    # 4. clearances
    subqueries.append("""
        SELECT id::text, file_name AS name, 'clearances' AS source, 'Clearances' AS source_label,
               file_url, NULL::bigint AS size_bytes, NULL::text AS mime_type,
               created_at, id::text AS source_entity_id
        FROM backlot_clearance_items
        WHERE project_id = :project_id AND file_url IS NOT NULL AND file_url != ''
    """)

    # 5. dailies
    subqueries.append("""
        SELECT id::text, file_name AS name, 'dailies' AS source, 'Dailies' AS source_label,
               cloud_url AS file_url, file_size_bytes AS size_bytes, 'video/*' AS mime_type,
               created_at, id::text AS source_entity_id
        FROM backlot_dailies_clips
        WHERE project_id = :project_id AND cloud_url IS NOT NULL AND cloud_url != ''
    """)

    # 6. review_versions (join to review_assets for project_id)
    subqueries.append("""
        SELECT rv.id::text, COALESCE(rv.original_filename, ra.name) AS name,
               'review_versions' AS source, 'Review' AS source_label,
               COALESCE(rv.s3_key, rv.file_url) AS file_url,
               rv.file_size_bytes AS size_bytes, NULL::text AS mime_type,
               rv.created_at, rv.id::text AS source_entity_id
        FROM backlot_review_versions rv
        JOIN backlot_review_assets ra ON ra.id = rv.asset_id
        WHERE ra.project_id = :project_id
        AND (rv.s3_key IS NOT NULL AND rv.s3_key != '' OR rv.file_url IS NOT NULL AND rv.file_url != '')
    """)

    # 7. standalone_assets
    subqueries.append("""
        SELECT id::text, file_name AS name, 'standalone_assets' AS source, 'Assets' AS source_label,
               COALESCE(s3_key, source_url) AS file_url, file_size_bytes AS size_bytes,
               mime_type, created_at, id::text AS source_entity_id
        FROM backlot_standalone_assets
        WHERE project_id = :project_id
        AND (s3_key IS NOT NULL AND s3_key != '' OR source_url IS NOT NULL AND source_url != '')
    """)

    # 8. continuity_exports — now empty, all records moved to scripts source (#2)
    # Kept as placeholder to preserve source_indices mapping
    subqueries.append("""
        SELECT NULL::text AS id, NULL::text AS name, 'continuity_exports' AS source, 'Continuity' AS source_label,
               NULL::text AS file_url, NULL::bigint AS size_bytes, NULL::text AS mime_type,
               NULL::timestamptz AS created_at, NULL::text AS source_entity_id
        WHERE false
    """)

    # 9. moodboards
    subqueries.append("""
        SELECT id::text, COALESCE(title, 'Moodboard Image') AS name,
               'moodboards' AS source, 'Moodboards' AS source_label,
               image_url AS file_url, NULL::bigint AS size_bytes, 'image/*' AS mime_type,
               created_at, id::text AS source_entity_id
        FROM moodboard_items
        WHERE project_id = :project_id AND image_url IS NOT NULL AND image_url != ''
    """)

    # 10. storyboards (panels via storyboards join)
    subqueries.append("""
        SELECT sp.id::text, COALESCE(sp.title, 'Storyboard Panel') AS name,
               'storyboards' AS source, 'Storyboards' AS source_label,
               sp.reference_image_url AS file_url, NULL::bigint AS size_bytes,
               'image/*' AS mime_type, sp.created_at, sp.id::text AS source_entity_id
        FROM storyboard_panels sp
        JOIN storyboards sb ON sb.id = sp.storyboard_id
        WHERE sb.project_id = :project_id
        AND sp.reference_image_url IS NOT NULL AND sp.reference_image_url != ''
    """)

    # Apply source filter
    if source:
        source_indices = {
            'project_files': 0, 'scripts': 1, 'receipts': 2, 'clearances': 3,
            'dailies': 4, 'review_versions': 5, 'standalone_assets': 6,
            'continuity_exports': 7, 'moodboards': 8, 'storyboards': 9,
        }
        idx = source_indices.get(source)
        if idx is not None:
            subqueries = [subqueries[idx]]

    union_query = " UNION ALL ".join(subqueries)

    # Wrap with filters, ordering, pagination
    where_clauses = []

    if search:
        where_clauses.append("name ILIKE :search")
        params["search"] = f"%{search}%"

    if file_type:
        mime_map = {
            'video': "mime_type LIKE 'video/%'",
            'image': "mime_type LIKE 'image/%'",
            'audio': "mime_type LIKE 'audio/%'",
            'document': "mime_type LIKE 'application/pdf' OR mime_type LIKE 'application/msword' OR mime_type LIKE 'application/vnd.%' OR mime_type LIKE 'text/%'",
        }
        mime_filter = mime_map.get(file_type)
        if mime_filter:
            where_clauses.append(f"({mime_filter})")

    outer_where = ""
    if where_clauses:
        outer_where = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
        SELECT id, name, source, source_label, file_url, size_bytes, mime_type,
               created_at, source_entity_id
        FROM ({union_query}) AS unified
        {outer_where}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """

    return sql, params


@router.get("/projects/{project_id}/files/all")
async def get_all_project_files(
    project_id: str,
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    authorization: str = Header(...)
):
    """Get unified view of all files across all project tools."""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    sql, params = _build_unified_query(project_id, source, search, file_type, limit, offset)

    files = execute_query(sql, params)

    # Serialize datetimes
    for f in files:
        if f.get('created_at') and hasattr(f['created_at'], 'isoformat'):
            f['created_at'] = f['created_at'].isoformat()

    return {"files": files, "total": len(files), "limit": limit, "offset": offset}


@router.get("/projects/{project_id}/files/all/{source}/{source_entity_id}/download")
async def download_unified_file(
    project_id: str,
    source: str,
    source_entity_id: str,
    authorization: str = Header(...)
):
    """Get download URL for a unified file from any source."""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    file_url = None
    filename = "download"
    s3_key = None
    bucket = None

    if source == 'project_files':
        row = execute_single("""
            SELECT s3_bucket, s3_key, name, mime_type FROM backlot_project_files
            WHERE id = :id AND project_id = :project_id AND upload_status = 'COMPLETE'
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            bucket = row['s3_bucket']
            s3_key = row['s3_key']
            filename = row.get('name', 'download')

    elif source == 'scripts':
        row = execute_single("""
            SELECT file_url, title FROM backlot_scripts
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['file_url']
            filename = row.get('title', 'script')

    elif source == 'receipts':
        row = execute_single("""
            SELECT file_url, original_filename FROM backlot_receipts
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['file_url']
            filename = row.get('original_filename', 'receipt')

    elif source == 'clearances':
        row = execute_single("""
            SELECT file_url, file_name FROM backlot_clearance_items
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['file_url']
            filename = row.get('file_name', 'clearance')

    elif source == 'dailies':
        row = execute_single("""
            SELECT cloud_url, file_name FROM backlot_dailies_clips
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['cloud_url']
            filename = row.get('file_name', 'clip')

    elif source == 'review_versions':
        row = execute_single("""
            SELECT rv.s3_key, rv.file_url, rv.storage_mode,
                   COALESCE(rv.original_filename, ra.name) as filename
            FROM backlot_review_versions rv
            JOIN backlot_review_assets ra ON ra.id = rv.asset_id
            WHERE rv.id = :id AND ra.project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            filename = row.get('filename', 'review')
            if row.get('storage_mode') == 's3' and row.get('s3_key'):
                s3_key = row['s3_key']
                bucket = BACKLOT_FILES_BUCKET
            else:
                file_url = row.get('file_url')

    elif source == 'standalone_assets':
        row = execute_single("""
            SELECT s3_key, source_url, file_name, mime_type FROM backlot_standalone_assets
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            filename = row.get('file_name', 'asset')
            if row.get('s3_key'):
                s3_key = row['s3_key']
                bucket = BACKLOT_FILES_BUCKET
            else:
                file_url = row.get('source_url')

    elif source == 'continuity_exports':
        row = execute_single("""
            SELECT file_url, file_name FROM backlot_continuity_exports
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['file_url']
            filename = row.get('file_name', 'continuity')

    elif source == 'moodboards':
        row = execute_single("""
            SELECT image_url, title FROM moodboard_items
            WHERE id = :id AND project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['image_url']
            filename = row.get('title', 'moodboard-image')

    elif source == 'storyboards':
        row = execute_single("""
            SELECT sp.reference_image_url, sp.title
            FROM storyboard_panels sp
            JOIN storyboards sb ON sb.id = sp.storyboard_id
            WHERE sp.id = :id AND sb.project_id = :project_id
        """, {"id": source_entity_id, "project_id": project_id})
        if row:
            file_url = row['reference_image_url']
            filename = row.get('title', 'storyboard-panel')

    else:
        raise HTTPException(status_code=400, detail=f"Unknown source: {source}")

    # Generate presigned URL for S3 keys
    if s3_key and bucket:
        # Handle s3:// URI format
        if s3_key.startswith('s3://'):
            parts = s3_key.replace('s3://', '').split('/', 1)
            if len(parts) == 2:
                bucket = parts[0]
                s3_key = parts[1]

        try:
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket,
                    'Key': s3_key,
                    'ResponseContentDisposition': f'attachment; filename="{filename}"'
                },
                ExpiresIn=PRESIGNED_URL_EXPIRY
            )
            return {"download_url": url, "filename": filename}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")

    # For external URLs, return directly
    if file_url:
        # Handle s3:// URI format in file_url too
        if file_url.startswith('s3://'):
            parts = file_url.replace('s3://', '').split('/', 1)
            if len(parts) == 2:
                try:
                    url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': parts[0],
                            'Key': parts[1],
                            'ResponseContentDisposition': f'attachment; filename="{filename}"'
                        },
                        ExpiresIn=PRESIGNED_URL_EXPIRY
                    )
                    return {"download_url": url, "filename": filename}
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")

        # Check if it's a relative S3 key (no protocol prefix, not a full URL)
        if not file_url.startswith('http://') and not file_url.startswith('https://'):
            try:
                url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': BACKLOT_BUCKET,
                        'Key': file_url,
                        'ResponseContentDisposition': f'attachment; filename="{filename}"'
                    },
                    ExpiresIn=PRESIGNED_URL_EXPIRY
                )
                return {"download_url": url, "filename": filename}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")

        return {"download_url": file_url, "filename": filename}

    raise HTTPException(status_code=404, detail="File not found")


# =====================================================
# Get All Tags for Project
# =====================================================

@router.get("/projects/{project_id}/files/tags")
async def get_project_tags(
    project_id: str,
    authorization: str = Header(...)
):
    """Get all unique tags used in project files"""
    token = authorization.replace("Bearer ", "")
    import jwt
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("sub")

    await verify_project_access(project_id, user_id)

    result = execute_query("""
        SELECT DISTINCT jsonb_array_elements_text(tags) as tag
        FROM backlot_project_files
        WHERE project_id = :project_id
        AND upload_status != 'DELETED'
        AND tags IS NOT NULL
        AND jsonb_array_length(tags) > 0
        ORDER BY tag
    """, {"project_id": project_id})

    tags = [r['tag'] for r in result]
    return {"tags": tags}
