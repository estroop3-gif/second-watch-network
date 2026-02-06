"""
Review Video Transcoder

Background transcoding service for review version uploads.
Detects source resolution, generates H.264 renditions (720p floor),
extracts a thumbnail, and updates the DB with results.

Triggered by complete_review_version_upload in backlot.py via asyncio.create_task().
"""

import os
import json
import asyncio
import shutil
import tempfile
import subprocess
import traceback
from pathlib import Path
from functools import partial

import boto3

from app.core.database import get_client


# Quality ladder (source-capped, 720p floor)
QUALITY_PRESETS = {
    "4k":    {"height": 2160, "video_bitrate": "15000k", "audio_bitrate": "192k"},
    "1080p": {"height": 1080, "video_bitrate": "5000k",  "audio_bitrate": "192k"},
    "720p":  {"height": 720,  "video_bitrate": "2500k",  "audio_bitrate": "128k"},
}
QUALITY_ORDER = ["4k", "1080p", "720p"]

BUCKET = os.environ.get("AWS_S3_BACKLOT_FILES_BUCKET", "swn-backlot-files-517220555400")


def _get_s3_client():
    return boto3.client("s3", region_name="us-east-1")


def _probe_video(input_path: str) -> dict:
    """Run ffprobe to get video metadata (height, width, duration)."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)

    # Find the video stream
    video_stream = None
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if not video_stream:
        raise ValueError("No video stream found in file")

    height = int(video_stream.get("height", 0))
    width = int(video_stream.get("width", 0))
    codec = video_stream.get("codec_name", "unknown")

    # Duration from format (more reliable) or stream
    duration = float(
        data.get("format", {}).get("duration")
        or video_stream.get("duration")
        or 0
    )

    return {
        "height": height,
        "width": width,
        "codec": codec,
        "duration_seconds": round(duration, 3),
    }


def _extract_thumbnail(input_path: str, output_path: str):
    """Extract a single thumbnail frame at t=2s (or start if shorter)."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", "2",
        "-i", input_path,
        "-frames:v", "1",
        "-vf", "scale=640:-2",
        "-q:v", "2",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def _transcode_rendition(input_path: str, output_path: str, height: int,
                         video_bitrate: str, audio_bitrate: str):
    """Transcode to a single H.264 MP4 rendition."""
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-vf", f"scale=-2:{height}",
        "-b:v", video_bitrate,
        "-c:a", "aac",
        "-b:a", audio_bitrate,
        "-movflags", "+faststart",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def _s3_key_without_ext(s3_key: str) -> str:
    """Strip file extension from an S3 key."""
    return str(Path(s3_key).with_suffix(""))


def _s3_key_dir(s3_key: str) -> str:
    """Get the directory portion of an S3 key."""
    return str(Path(s3_key).parent)


async def transcode_review_version(version_id: str, s3_key: str, asset_id: str):
    """
    Background task: download source from S3, probe, generate renditions,
    extract thumbnail, upload results, and update DB.
    """
    print(f"[ReviewTranscoder] Starting transcode for version {version_id}, key={s3_key}, asset={asset_id}")
    client = get_client()
    tmp_dir = None

    try:
        # Create temp working directory
        tmp_dir = tempfile.mkdtemp(prefix="review_transcode_")
        source_ext = Path(s3_key).suffix or ".mp4"
        source_path = os.path.join(tmp_dir, f"source{source_ext}")

        # 1. Download source from S3
        s3 = _get_s3_client()
        await asyncio.to_thread(
            s3.download_file, BUCKET, s3_key, source_path
        )

        print(f"[ReviewTranscoder] Downloaded source to {source_path}")

        # 2. Probe source video
        probe = await asyncio.to_thread(_probe_video, source_path)
        source_height = probe["height"]
        print(f"[ReviewTranscoder] Probed: {probe['width']}x{probe['height']}, duration={probe['duration_seconds']}s, codec={probe['codec']}")

        if source_height <= 0:
            raise ValueError(f"Invalid source height: {source_height}")

        # 3. Determine which quality presets to generate (source-capped, 720p floor)
        target_qualities = [
            label for label in QUALITY_ORDER
            if QUALITY_PRESETS[label]["height"] <= source_height
        ]
        # Always include at least 720p
        if not target_qualities:
            target_qualities = ["720p"]

        key_base = _s3_key_without_ext(s3_key)
        key_dir = _s3_key_dir(s3_key)

        # 4. Extract thumbnail
        thumb_path = os.path.join(tmp_dir, "thumbnail.jpg")
        await asyncio.to_thread(_extract_thumbnail, source_path, thumb_path)

        thumb_s3_key = f"{key_dir}/thumbnail.jpg"
        await asyncio.to_thread(
            partial(s3.upload_file, ExtraArgs={"ContentType": "image/jpeg"}),
            thumb_path, BUCKET, thumb_s3_key,
        )

        # Generate a presigned thumbnail URL for DB storage
        thumb_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": thumb_s3_key},
            ExpiresIn=31536000,  # 1 year
        )

        # Update thumbnail on version and asset
        client.table("backlot_review_versions").update({
            "thumbnail_url": thumb_url,
        }).eq("id", version_id).execute()

        client.table("backlot_review_assets").update({
            "thumbnail_url": thumb_url,
        }).eq("id", asset_id).execute()

        # 5. Transcode each rendition
        renditions = {"original": s3_key}

        for label in target_qualities:
            preset = QUALITY_PRESETS[label]
            rendition_filename = f"{Path(s3_key).stem}_{label}.mp4"
            rendition_path = os.path.join(tmp_dir, rendition_filename)
            rendition_s3_key = f"{key_base}_{label}.mp4"

            await asyncio.to_thread(
                _transcode_rendition,
                source_path,
                rendition_path,
                preset["height"],
                preset["video_bitrate"],
                preset["audio_bitrate"],
            )

            await asyncio.to_thread(
                partial(s3.upload_file, ExtraArgs={"ContentType": "video/mp4"}),
                rendition_path, BUCKET, rendition_s3_key,
            )

            renditions[label] = rendition_s3_key

            # Clean up rendition file immediately to save disk space
            try:
                os.remove(rendition_path)
            except OSError:
                pass

        # 6. Update version with results
        resolution_str = f"{probe['width']}x{probe['height']}"
        client.table("backlot_review_versions").update({
            "transcode_status": "completed",
            "renditions": renditions,
            "duration_seconds": probe["duration_seconds"],
            "resolution": resolution_str,
            "codec": probe["codec"],
        }).eq("id", version_id).execute()

        # Also update the linked standalone asset if present
        version_data = client.table("backlot_review_versions").select(
            "linked_standalone_asset_id"
        ).eq("id", version_id).single().execute()

        standalone_id = version_data.data.get("linked_standalone_asset_id") if version_data.data else None
        if standalone_id:
            client.table("backlot_standalone_assets").update({
                "thumbnail_url": thumb_url,
                "duration_seconds": probe["duration_seconds"],
                "dimensions": resolution_str,
            }).eq("id", standalone_id).execute()

        print(f"[ReviewTranscoder] Completed version {version_id}: {list(renditions.keys())}")

    except Exception as e:
        error_detail = f"{e}\n{traceback.format_exc()}"
        print(f"[ReviewTranscoder] Failed version {version_id}: {error_detail}")
        try:
            client.table("backlot_review_versions").update({
                "transcode_status": "failed",
                "transcode_error": str(e)[:500],
            }).eq("id", version_id).execute()
        except Exception as db_err:
            print(f"[ReviewTranscoder] Failed to update error status: {db_err}")

    finally:
        # Clean up temp directory
        if tmp_dir:
            shutil.rmtree(tmp_dir, ignore_errors=True)
