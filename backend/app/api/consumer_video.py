"""
Consumer Video API - Video Upload, Transcoding, and Playback
Part of: Consumer Streaming Platform
"""
import os
import json
import uuid
import math
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query

import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

from app.core.database import get_client, execute_query, execute_single
from app.core.auth import get_current_user
from app.core.deps import get_user_profile
from app.services.festival_service import FestivalService
from app.schemas.video import (
    UploadInitiateRequest, UploadInitiateResponse, UploadPartUrl,
    UploadCompleteRequest, UploadAbortRequest, UploadStatusResponse,
    UploadPartInfo, UploadSessionStatus,
    VideoAsset, VideoAssetSummary, VideoAssetUpdate,
    VideoRendition, HLSManifest, VideoThumbnail, VideoSubtitle, VideoSpriteSheet,
    PlaybackSessionRequest, PlaybackSession,
    TranscodeRequest, TranscodeStatus, ProcessingStatus,
    SubtitleUploadRequest, SubtitleUploadResponse,
    ThumbnailGenerateRequest, ThumbnailSetPrimaryRequest,
    VideoListParams, VideoListResponse
)

router = APIRouter()

# =============================================================================
# AWS Configuration
# =============================================================================

AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

# S3 Buckets for consumer video
RAW_INGEST_BUCKET = os.getenv('AWS_S3_VIDEO_MASTERS_BUCKET', 'swn-video-masters-517220555400')
PUBLISH_BUCKET = os.getenv('AWS_S3_VIDEO_PUBLISH_BUCKET', 'swn-video-publish-517220555400')

# CloudFront distribution for streaming
CLOUDFRONT_DOMAIN = os.getenv('CLOUDFRONT_VIDEO_DOMAIN', 'd1u4sv04wott56.cloudfront.net')
CLOUDFRONT_KEY_PAIR_ID = os.getenv('CLOUDFRONT_KEY_PAIR_ID', '')

# S3 Client
s3_config = Config(
    region_name=AWS_REGION,
    signature_version='s3v4',
    retries={'max_attempts': 3, 'mode': 'standard'}
)
s3_client = boto3.client('s3', region_name=AWS_REGION, config=s3_config)

# Multipart upload settings
PART_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB parts
URL_EXPIRY_SECONDS = 3600  # 1 hour for upload URLs
SESSION_EXPIRY_HOURS = 24  # Upload session valid for 24 hours


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id_from_cognito_id(cognito_user_id: str) -> Optional[str]:
    """
    Look up the profile ID from a Cognito user ID.
    Returns the profile ID or None if not found.
    """
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)
    # First try to find by cognito_user_id (preferred)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    # Fallback: check if it's already a profile ID
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    return None


def generate_asset_key(asset_id: str, version_id: str, filename: str) -> str:
    """Generate S3 key following convention: /asset/{assetId}/version/{versionId}/raw/{filename}"""
    return f"asset/{asset_id}/version/{version_id}/raw/{filename}"


def calculate_parts(file_size: int) -> int:
    """Calculate number of parts needed for multipart upload"""
    return max(1, math.ceil(file_size / PART_SIZE_BYTES))


def generate_signed_cookie_policy(resource_url: str, expires_at: datetime) -> dict:
    """Generate CloudFront signed cookie policy (placeholder - needs key integration)"""
    # In production, this would use CloudFront private key to sign
    return {
        "CloudFront-Policy": "",
        "CloudFront-Signature": "",
        "CloudFront-Key-Pair-Id": CLOUDFRONT_KEY_PAIR_ID
    }


# =============================================================================
# Upload Endpoints
# =============================================================================

@router.post("/upload/initiate", response_model=UploadInitiateResponse)
async def initiate_upload(
    request: UploadInitiateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Initiate a multipart video upload.
    Returns presigned URLs for each part.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Generate IDs
    asset_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())

    # Calculate parts needed
    num_parts = calculate_parts(request.file_size_bytes)

    # Generate S3 key
    s3_key = generate_asset_key(asset_id, version_id, request.filename)

    try:
        # Start multipart upload
        multipart = s3_client.create_multipart_upload(
            Bucket=RAW_INGEST_BUCKET,
            Key=s3_key,
            ContentType=request.content_type or 'video/mp4'
        )
        upload_id = multipart['UploadId']

        # Generate presigned URLs for each part
        part_urls = []
        expires_at = datetime.utcnow() + timedelta(seconds=URL_EXPIRY_SECONDS)

        for part_num in range(1, num_parts + 1):
            url = s3_client.generate_presigned_url(
                'upload_part',
                Params={
                    'Bucket': RAW_INGEST_BUCKET,
                    'Key': s3_key,
                    'UploadId': upload_id,
                    'PartNumber': part_num
                },
                ExpiresIn=URL_EXPIRY_SECONDS
            )
            part_urls.append(UploadPartUrl(
                part_number=part_num,
                upload_url=url,
                expires_at=expires_at
            ))

        # Create video asset record
        client = get_client()
        asset_result = client.table("video_assets").insert({
            "id": asset_id,
            "version_id": version_id,
            "owner_id": profile_id,
            "world_id": request.world_id,
            "master_bucket": RAW_INGEST_BUCKET,
            "master_file_key": s3_key,
            "master_file_size_bytes": request.file_size_bytes,
            "original_filename": request.filename,
            "title": request.title or request.filename,
            "description": request.description,
            "processing_status": "pending",
            "uploaded_by": profile_id
        }).execute()

        # Create upload session record
        session_expires = datetime.utcnow() + timedelta(hours=SESSION_EXPIRY_HOURS)
        session_result = client.table("video_upload_sessions").insert({
            "id": session_id,
            "video_asset_id": asset_id,
            "user_id": profile_id,
            "original_filename": request.filename,
            "content_type": request.content_type,
            "file_size_bytes": request.file_size_bytes,
            "upload_id": upload_id,
            "bucket": RAW_INGEST_BUCKET,
            "key": s3_key,
            "status": "initiated",
            "parts_expected": num_parts,
            "expires_at": session_expires.isoformat()
        }).execute()

        return UploadInitiateResponse(
            session_id=session_id,
            video_asset_id=asset_id,
            upload_id=upload_id,
            bucket=RAW_INGEST_BUCKET,
            key=s3_key,
            part_urls=part_urls,
            expires_at=session_expires
        )

    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate upload: {str(e)}")


@router.post("/upload/complete")
async def complete_upload(
    request: UploadCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Complete a multipart upload after all parts are uploaded.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get upload session
    session = client.table("video_upload_sessions").select("*").eq(
        "id", request.session_id
    ).eq("user_id", profile_id).single().execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Upload session not found")

    session_data = session.data

    if session_data["status"] not in ["initiated", "uploading"]:
        raise HTTPException(status_code=400, detail=f"Cannot complete upload in status: {session_data['status']}")

    try:
        # Complete multipart upload
        parts = [
            {"ETag": part.etag, "PartNumber": part.part_number}
            for part in sorted(request.parts, key=lambda p: p.part_number)
        ]

        s3_client.complete_multipart_upload(
            Bucket=session_data["bucket"],
            Key=session_data["key"],
            UploadId=session_data["upload_id"],
            MultipartUpload={"Parts": parts}
        )

        # Update session status
        client.table("video_upload_sessions").update({
            "status": "completed",
            "parts_uploaded": len(request.parts),
            "parts_info": [p.model_dump() for p in request.parts],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", request.session_id).execute()

        # Update video asset to start processing
        client.table("video_assets").update({
            "processing_status": "pending"
        }).eq("id", session_data["video_asset_id"]).execute()

        return {
            "status": "completed",
            "video_asset_id": session_data["video_asset_id"],
            "message": "Upload completed successfully. Video will be processed shortly."
        }

    except ClientError as e:
        # Update session to failed
        client.table("video_upload_sessions").update({
            "status": "failed"
        }).eq("id", request.session_id).execute()

        raise HTTPException(status_code=500, detail=f"Failed to complete upload: {str(e)}")


@router.post("/upload/abort")
async def abort_upload(
    request: UploadAbortRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Abort a multipart upload and clean up.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get upload session
    session = client.table("video_upload_sessions").select("*").eq(
        "id", request.session_id
    ).eq("user_id", profile_id).single().execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Upload session not found")

    session_data = session.data

    try:
        # Abort S3 multipart upload
        s3_client.abort_multipart_upload(
            Bucket=session_data["bucket"],
            Key=session_data["key"],
            UploadId=session_data["upload_id"]
        )
    except ClientError:
        pass  # May already be aborted

    # Update session and asset status
    client.table("video_upload_sessions").update({
        "status": "cancelled"
    }).eq("id", request.session_id).execute()

    client.table("video_assets").update({
        "processing_status": "cancelled"
    }).eq("id", session_data["video_asset_id"]).execute()

    return {"status": "cancelled", "message": "Upload aborted successfully"}


@router.get("/upload/{session_id}/status", response_model=UploadStatusResponse)
async def get_upload_status(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the status of an upload session.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()
    session = client.table("video_upload_sessions").select("*").eq(
        "id", session_id
    ).eq("user_id", profile_id).single().execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Upload session not found")

    s = session.data
    return UploadStatusResponse(
        session_id=s["id"],
        video_asset_id=s["video_asset_id"],
        status=s["status"],
        parts_expected=s["parts_expected"],
        parts_uploaded=s["parts_uploaded"] or 0,
        created_at=s["created_at"],
        expires_at=s["expires_at"]
    )


# =============================================================================
# Video Asset Endpoints
# =============================================================================

@router.get("/assets", response_model=VideoListResponse)
async def list_video_assets(
    world_id: Optional[str] = None,
    status: Optional[ProcessingStatus] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    List video assets owned by the current user.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Build query
    query = client.table("video_assets").select(
        "id, title, duration_seconds, resolution_width, resolution_height, "
        "processing_status, processing_progress, created_at",
        count="exact"
    ).eq("owner_id", profile_id).eq("is_current_version", True)

    if world_id:
        query = query.eq("world_id", world_id)
    if status:
        query = query.eq("processing_status", status.value)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    # Get primary thumbnails for each video
    videos = []
    for v in result.data:
        thumb_result = client.table("video_thumbnails").select(
            "image_url"
        ).eq("video_asset_id", v["id"]).eq("is_primary", True).limit(1).execute()

        thumbnail_url = thumb_result.data[0]["image_url"] if thumb_result.data else None

        videos.append(VideoAssetSummary(
            id=v["id"],
            title=v["title"],
            duration_seconds=v["duration_seconds"],
            resolution_width=v["resolution_width"],
            resolution_height=v["resolution_height"],
            processing_status=v["processing_status"],
            processing_progress=v["processing_progress"] or 0,
            thumbnail_url=thumbnail_url,
            created_at=v["created_at"]
        ))

    return VideoListResponse(
        videos=videos,
        total=result.count or 0,
        limit=limit,
        offset=offset
    )


@router.get("/assets/{video_id}", response_model=VideoAsset)
async def get_video_asset(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get full video asset details including renditions, manifest, etc.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get video asset
    result = client.table("video_assets").select("*").eq("id", video_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Video asset not found")

    video = result.data

    # Check ownership
    if video["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this video")

    # Get renditions
    renditions_result = client.table("video_renditions").select("*").eq(
        "video_asset_id", video_id
    ).execute()

    # Get manifest
    manifest_result = client.table("hls_manifests").select("*").eq(
        "video_asset_id", video_id
    ).limit(1).execute()

    # Get thumbnails
    thumbs_result = client.table("video_thumbnails").select("*").eq(
        "video_asset_id", video_id
    ).order("timecode_seconds").execute()

    # Get subtitles
    subs_result = client.table("video_subtitles").select("*").eq(
        "video_asset_id", video_id
    ).execute()

    # Get sprite sheet
    sprite_result = client.table("video_sprite_sheets").select("*").eq(
        "video_asset_id", video_id
    ).limit(1).execute()

    return VideoAsset(
        **video,
        validation_errors=video.get("validation_errors") or [],
        renditions=[VideoRendition(**r) for r in renditions_result.data] if renditions_result.data else None,
        manifest=HLSManifest(**manifest_result.data[0]) if manifest_result.data else None,
        thumbnails=[VideoThumbnail(**t) for t in thumbs_result.data] if thumbs_result.data else None,
        subtitles=[VideoSubtitle(**s) for s in subs_result.data] if subs_result.data else None,
        sprite_sheet=VideoSpriteSheet(**sprite_result.data[0]) if sprite_result.data else None
    )


@router.put("/assets/{video_id}", response_model=VideoAsset)
async def update_video_asset(
    video_id: str,
    update: VideoAssetUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update video asset metadata.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify ownership
    existing = client.table("video_assets").select("owner_id").eq(
        "id", video_id
    ).single().execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Video asset not found")

    if existing.data["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this video")

    # Update
    update_data = update.model_dump(exclude_unset=True)
    if update_data:
        client.table("video_assets").update(update_data).eq("id", video_id).execute()

    # Return updated video
    return await get_video_asset(video_id, current_user)


@router.delete("/assets/{video_id}")
async def delete_video_asset(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a video asset and all associated files.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get video to verify ownership and get S3 keys
    result = client.table("video_assets").select("*").eq("id", video_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Video asset not found")

    video = result.data

    if video["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")

    # Delete from S3 (both raw and publish buckets)
    # Note: In production, this should be a background job
    try:
        # Delete raw file
        if video.get("master_file_key"):
            s3_client.delete_object(
                Bucket=video.get("master_bucket", RAW_INGEST_BUCKET),
                Key=video["master_file_key"]
            )

        # Delete published files (HLS segments, thumbnails, etc.)
        # List and delete all objects with the asset prefix
        asset_prefix = f"asset/{video_id}/"
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=PUBLISH_BUCKET, Prefix=asset_prefix):
            if 'Contents' in page:
                objects = [{'Key': obj['Key']} for obj in page['Contents']]
                if objects:
                    s3_client.delete_objects(
                        Bucket=PUBLISH_BUCKET,
                        Delete={'Objects': objects}
                    )
    except ClientError as e:
        # Log but don't fail - cleanup can happen later
        print(f"Warning: Failed to delete S3 files for video {video_id}: {e}")

    # Delete from database (cascades to renditions, manifests, thumbnails, etc.)
    client.table("video_assets").delete().eq("id", video_id).execute()

    return {"status": "deleted", "video_id": video_id}


# =============================================================================
# Playback Endpoints
# =============================================================================

@router.post("/playback/session", response_model=PlaybackSession)
async def create_playback_session(
    request: PlaybackSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a playback session for a video.
    Returns signed URLs and session info for the player.

    Premium content access is required for episodes with visibility='premium'.
    Access is granted to Order members, staff, and premium subscribers.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get video asset with manifest
    video = client.table("video_assets").select("*").eq(
        "id", request.video_asset_id
    ).single().execute()

    if not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    video_data = video.data

    # Check if video is ready for playback
    if video_data["processing_status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Video not ready for playback. Status: {video_data['processing_status']}"
        )

    # Free-to-watch: premium visibility no longer gates playback.
    # All authenticated users can watch premium content. Private episodes
    # are still restricted via their own visibility check.

    # Phase 2C: Check festival/venue availability
    # Look up the episode's world to check for release window restrictions
    episode_world = execute_single("""
        SELECT wc.id as episode_id, wc.world_id
        FROM world_content wc
        WHERE wc.video_asset_id = :video_asset_id
          AND wc.status = 'published'
        LIMIT 1
    """, {"video_asset_id": request.video_asset_id})

    if episode_world and episode_world.get("world_id"):
        # Check platform availability (festival exclusivity, release windows, etc.)
        availability = await FestivalService.check_platform_availability(
            episode_world["world_id"],
            territory="US"  # TODO: Get from user profile or request headers
        )

        if not availability.get("available"):
            reason = availability.get("reason", "unavailable")
            detail_msg = "This content is not currently available on the platform"

            if reason == "festival_exclusivity":
                festival_name = availability.get("festival", "a festival")
                ends = availability.get("exclusivity_ends")
                if ends:
                    detail_msg = f"This content is currently in festival exclusivity with {festival_name} until {ends}"
                else:
                    detail_msg = f"This content is currently in festival exclusivity with {festival_name}"
            elif reason == "before_platform_release":
                release_date = availability.get("release_date")
                detail_msg = f"This content will be available on {release_date}"
            elif reason in ("festival_exclusive", "venue_exclusive", "theatrical_exclusive"):
                window_ends = availability.get("window_ends")
                if window_ends:
                    detail_msg = f"This content is currently in an exclusive window until {window_ends}"
                else:
                    detail_msg = "This content is currently in an exclusive release window"
            elif reason == "territory_restricted":
                detail_msg = "This content is not available in your region"

            raise HTTPException(
                status_code=403,
                detail=detail_msg
            )

    # Get HLS manifest
    manifest = client.table("hls_manifests").select("*").eq(
        "video_asset_id", request.video_asset_id
    ).eq("status", "ready").single().execute()

    if not manifest.data:
        raise HTTPException(status_code=400, detail="Video manifest not available")

    manifest_data = manifest.data

    # Get subtitles
    subs = client.table("video_subtitles").select("*").eq(
        "video_asset_id", request.video_asset_id
    ).execute()

    # Get sprite sheet
    sprite = client.table("video_sprite_sheets").select("*").eq(
        "video_asset_id", request.video_asset_id
    ).limit(1).execute()

    # Get watch progress
    progress = client.table("watch_history").select(
        "position_seconds"
    ).eq("user_id", profile_id).eq(
        "video_asset_id", request.video_asset_id
    ).limit(1).execute()

    resume_position = None
    if progress.data:
        resume_position = progress.data[0]["position_seconds"]

    # Generate session
    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=4)  # 4 hour session

    # Build playback URL
    # In production, this would use CloudFront signed cookies
    cdn_base = manifest_data.get("cdn_base_url") or f"https://{CLOUDFRONT_DOMAIN}"
    playback_url = manifest_data.get("playback_url") or f"{cdn_base}/asset/{request.video_asset_id}/version/{video_data['version_id']}/hls/master.m3u8"

    # For now, use presigned S3 URL as fallback if no CloudFront
    if not CLOUDFRONT_DOMAIN and manifest_data.get("master_manifest_key"):
        playback_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': manifest_data.get("manifest_bucket", PUBLISH_BUCKET),
                'Key': manifest_data["master_manifest_key"]
            },
            ExpiresIn=14400  # 4 hours
        )

    return PlaybackSession(
        session_id=session_id,
        video_asset_id=request.video_asset_id,
        playback_url=playback_url,
        cdn_base_url=cdn_base,
        available_qualities=manifest_data.get("included_qualities") or [],
        subtitles=[VideoSubtitle(**s) for s in subs.data] if subs.data else [],
        sprite_sheet=VideoSpriteSheet(**sprite.data[0]) if sprite.data else None,
        expires_at=expires_at,
        resume_position_seconds=resume_position
    )


# =============================================================================
# Transcoding Endpoints
# =============================================================================

@router.post("/transcode", response_model=TranscodeStatus)
async def start_transcode(
    request: TranscodeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger HLS transcoding for a video.
    Creates a job in the consumer_transcode_jobs queue.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify ownership
    video = client.table("video_assets").select("*").eq(
        "id", request.video_asset_id
    ).single().execute()

    if not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.data["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if already processing
    if video.data["processing_status"] in ["validating", "transcoding", "packaging"]:
        raise HTTPException(status_code=400, detail="Video is already being processed")

    # Default qualities for HLS transcoding
    target_qualities = request.qualities if hasattr(request, 'qualities') and request.qualities else [
        "1080p", "720p", "480p", "360p"
    ]

    # Create transcoding job in queue
    job_id = str(uuid.uuid4())
    job_result = execute_single(
        """
        INSERT INTO consumer_transcode_jobs (
            id, asset_id, source_bucket, source_key,
            target_qualities, status, priority, created_at
        ) VALUES (
            :job_id, :asset_id, :bucket, :source_key,
            :qualities, 'pending', :priority, NOW()
        )
        RETURNING id
        """,
        {
            "job_id": job_id,
            "asset_id": request.video_asset_id,
            "bucket": video.data.get("master_bucket", RAW_INGEST_BUCKET),
            "source_key": video.data["master_file_key"],
            "qualities": json.dumps(target_qualities),
            "priority": request.priority if hasattr(request, 'priority') else 0,
        }
    )

    # Update asset status
    client.table("video_assets").update({
        "processing_status": "pending",
        "processing_progress": 0,
        "processing_error": None,
        "processing_job_id": job_id
    }).eq("id", request.video_asset_id).execute()

    return TranscodeStatus(
        video_asset_id=request.video_asset_id,
        job_id=job_id,
        status=ProcessingStatus.pending,
        progress=0,
        current_stage="queued",
        renditions=[]
    )


@router.get("/transcode/{video_id}/status", response_model=TranscodeStatus)
async def get_transcode_status(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current transcoding status for a video.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    video = client.table("video_assets").select(
        "id, owner_id, processing_status, processing_progress, processing_error, "
        "processing_job_id, processing_started_at, processing_completed_at"
    ).eq("id", video_id).single().execute()

    if not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.data["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get renditions
    renditions = client.table("video_renditions").select("*").eq(
        "video_asset_id", video_id
    ).execute()

    v = video.data
    return TranscodeStatus(
        video_asset_id=video_id,
        job_id=v.get("processing_job_id"),
        status=v["processing_status"],
        progress=v["processing_progress"] or 0,
        current_stage=v["processing_status"],  # Simplified
        error_message=v.get("processing_error"),
        renditions=[VideoRendition(**r) for r in renditions.data] if renditions.data else [],
        started_at=v.get("processing_started_at"),
        completed_at=v.get("processing_completed_at")
    )


# =============================================================================
# Subtitle Endpoints
# =============================================================================

@router.post("/subtitles/upload", response_model=SubtitleUploadResponse)
async def initiate_subtitle_upload(
    request: SubtitleUploadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a presigned URL to upload subtitles for a video.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify video ownership
    video = client.table("video_assets").select("owner_id, version_id").eq(
        "id", request.video_asset_id
    ).single().execute()

    if not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.data["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Generate subtitle ID and S3 key
    subtitle_id = str(uuid.uuid4())
    s3_key = f"asset/{request.video_asset_id}/version/{video.data['version_id']}/captions/{request.language_code}.vtt"

    # Create subtitle record
    client.table("video_subtitles").insert({
        "id": subtitle_id,
        "video_asset_id": request.video_asset_id,
        "language_code": request.language_code,
        "language_name": request.language_name,
        "subtitle_type": request.subtitle_type.value,
        "subtitle_bucket": PUBLISH_BUCKET,
        "subtitle_key": s3_key,
        "is_default": request.is_default,
        "is_auto_generated": False
    }).execute()

    # Generate presigned upload URL
    expires_at = datetime.utcnow() + timedelta(hours=1)
    upload_url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': PUBLISH_BUCKET,
            'Key': s3_key,
            'ContentType': 'text/vtt'
        },
        ExpiresIn=3600
    )

    return SubtitleUploadResponse(
        subtitle_id=subtitle_id,
        upload_url=upload_url,
        expires_at=expires_at
    )


@router.delete("/subtitles/{subtitle_id}")
async def delete_subtitle(
    subtitle_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a subtitle track.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get subtitle with video info
    subtitle = client.table("video_subtitles").select(
        "*, video_assets!inner(owner_id)"
    ).eq("id", subtitle_id).single().execute()

    if not subtitle.data:
        raise HTTPException(status_code=404, detail="Subtitle not found")

    if subtitle.data["video_assets"]["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete from S3
    try:
        s3_client.delete_object(
            Bucket=subtitle.data.get("subtitle_bucket", PUBLISH_BUCKET),
            Key=subtitle.data["subtitle_key"]
        )
    except ClientError:
        pass

    # Delete record
    client.table("video_subtitles").delete().eq("id", subtitle_id).execute()

    return {"status": "deleted"}


# =============================================================================
# Thumbnail Endpoints
# =============================================================================

@router.post("/thumbnails/{video_id}/set-primary")
async def set_primary_thumbnail(
    video_id: str,
    request: ThumbnailSetPrimaryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Set a thumbnail as the primary thumbnail for a video.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify video ownership
    video = client.table("video_assets").select("owner_id").eq(
        "id", video_id
    ).single().execute()

    if not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.data["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify thumbnail belongs to this video
    thumb = client.table("video_thumbnails").select("id").eq(
        "id", request.thumbnail_id
    ).eq("video_asset_id", video_id).single().execute()

    if not thumb.data:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    # Clear all primary flags for this video
    client.table("video_thumbnails").update({
        "is_primary": False
    }).eq("video_asset_id", video_id).execute()

    # Set new primary
    client.table("video_thumbnails").update({
        "is_primary": True
    }).eq("id", request.thumbnail_id).execute()

    return {"status": "updated", "primary_thumbnail_id": request.thumbnail_id}


@router.get("/thumbnails/{video_id}", response_model=List[VideoThumbnail])
async def get_video_thumbnails(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all thumbnails for a video.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify video ownership
    video = client.table("video_assets").select("owner_id").eq(
        "id", video_id
    ).single().execute()

    if not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.data["owner_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    thumbs = client.table("video_thumbnails").select("*").eq(
        "video_asset_id", video_id
    ).order("timecode_seconds").execute()

    return [VideoThumbnail(**t) for t in thumbs.data] if thumbs.data else []
