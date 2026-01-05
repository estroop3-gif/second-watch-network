"""
Video Pipeline Service
Handles video upload, transcoding to HLS, and CDN delivery.

This service manages:
- Multipart upload initialization for large video files
- HLS transcoding with adaptive bitrate ladder
- CloudFront signed URL/cookie generation for premium content
"""

import os
import json
import uuid
import subprocess
import tempfile
import shutil
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
import base64

from app.core.database import execute_single, execute_query
from app.core.storage import (
    VIDEO_MASTERS_BUCKET,
    VIDEO_PUBLISH_BUCKET,
    AWS_REGION,
    s3_client,
)


# HLS Quality Ladder (per plan)
HLS_QUALITY_LADDER = {
    "4k": {"width": 3840, "height": 2160, "bitrate": "15000k", "audio": "192k"},
    "1080p": {"width": 1920, "height": 1080, "bitrate": "5000k", "audio": "192k"},
    "720p": {"width": 1280, "height": 720, "bitrate": "2500k", "audio": "128k"},
    "480p": {"width": 854, "height": 480, "bitrate": "1000k", "audio": "96k"},
    "360p": {"width": 640, "height": 360, "bitrate": "600k", "audio": "64k"},
}

# Default quality ladder for standard content (skip 4K for non-premium)
STANDARD_QUALITIES = ["1080p", "720p", "480p", "360p"]
PREMIUM_QUALITIES = ["4k", "1080p", "720p", "480p", "360p"]

# CloudFront configuration
CLOUDFRONT_DOMAIN = os.getenv("CLOUDFRONT_VIDEO_DOMAIN", "d1u4sv04wott56.cloudfront.net")
CLOUDFRONT_DISTRIBUTION_ID = os.getenv("CLOUDFRONT_VIDEO_DISTRIBUTION_ID", "E17MNILTBIP3I2")
CLOUDFRONT_KEY_PAIR_ID = os.getenv("CLOUDFRONT_KEY_PAIR_ID", "")
CLOUDFRONT_PRIVATE_KEY_PATH = os.getenv("CLOUDFRONT_PRIVATE_KEY_PATH", "")


class TranscodeStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class UploadSession:
    """Represents an active multipart upload session"""
    upload_id: str
    asset_id: str
    bucket: str
    key: str
    parts: List[Dict]
    created_at: datetime


class VideoPipelineService:
    """
    Service for managing the video pipeline from upload through streaming.
    """

    def __init__(self):
        self.s3_client = s3_client
        self._cloudfront_key = None

    # =========================================================================
    # UPLOAD MANAGEMENT
    # =========================================================================

    def initiate_upload(
        self,
        asset_id: str,
        filename: str,
        content_type: str = "video/mp4",
        file_size: int = 0,
    ) -> Dict:
        """
        Initiate a multipart upload for a video file.

        Args:
            asset_id: UUID of the video asset record
            filename: Original filename
            content_type: MIME type of the video
            file_size: Expected file size in bytes

        Returns:
            Dict with upload_id, key, and presigned URLs for each part
        """
        # Generate unique key
        ext = os.path.splitext(filename)[1] or ".mp4"
        key = f"assets/{asset_id}/raw/{uuid.uuid4()}{ext}"

        # Initiate multipart upload
        response = self.s3_client.create_multipart_upload(
            Bucket=VIDEO_MASTERS_BUCKET,
            Key=key,
            ContentType=content_type,
            Metadata={
                "asset_id": asset_id,
                "original_filename": filename,
            }
        )

        upload_id = response["UploadId"]

        # Calculate number of parts (5MB minimum part size, except last)
        part_size = 5 * 1024 * 1024  # 5MB
        num_parts = max(1, (file_size + part_size - 1) // part_size) if file_size > 0 else 1

        # Generate presigned URLs for each part
        part_urls = []
        for part_number in range(1, min(num_parts + 1, 10001)):  # Max 10000 parts
            url = self.s3_client.generate_presigned_url(
                "upload_part",
                Params={
                    "Bucket": VIDEO_MASTERS_BUCKET,
                    "Key": key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=3600 * 24,  # 24 hours
            )
            part_urls.append({
                "part_number": part_number,
                "url": url,
            })

        # Store upload session in database
        execute_single(
            """
            INSERT INTO video_upload_sessions (
                id, asset_id, upload_id, bucket, key, status, created_at
            ) VALUES (
                gen_random_uuid(), :asset_id, :upload_id, :bucket, :key, 'active', NOW()
            )
            """,
            {
                "asset_id": asset_id,
                "upload_id": upload_id,
                "bucket": VIDEO_MASTERS_BUCKET,
                "key": key,
            }
        )

        return {
            "upload_id": upload_id,
            "key": key,
            "bucket": VIDEO_MASTERS_BUCKET,
            "part_size": part_size,
            "part_urls": part_urls,
        }

    def complete_upload(
        self,
        upload_id: str,
        key: str,
        parts: List[Dict],
    ) -> Dict:
        """
        Complete a multipart upload.

        Args:
            upload_id: The multipart upload ID
            key: S3 key for the object
            parts: List of {part_number, etag} dicts

        Returns:
            Dict with final S3 location
        """
        # Format parts for S3 API
        s3_parts = [
            {"PartNumber": p["part_number"], "ETag": p["etag"]}
            for p in sorted(parts, key=lambda x: x["part_number"])
        ]

        # Complete the upload
        response = self.s3_client.complete_multipart_upload(
            Bucket=VIDEO_MASTERS_BUCKET,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": s3_parts}
        )

        # Update session status
        execute_single(
            """
            UPDATE video_upload_sessions
            SET status = 'completed', completed_at = NOW()
            WHERE upload_id = :upload_id
            """,
            {"upload_id": upload_id}
        )

        return {
            "location": response["Location"],
            "bucket": VIDEO_MASTERS_BUCKET,
            "key": key,
            "etag": response["ETag"],
        }

    def abort_upload(self, upload_id: str, key: str) -> bool:
        """Abort a multipart upload."""
        try:
            self.s3_client.abort_multipart_upload(
                Bucket=VIDEO_MASTERS_BUCKET,
                Key=key,
                UploadId=upload_id,
            )

            execute_single(
                """
                UPDATE video_upload_sessions
                SET status = 'aborted', completed_at = NOW()
                WHERE upload_id = :upload_id
                """,
                {"upload_id": upload_id}
            )
            return True
        except ClientError:
            return False

    def create_simple_upload_url(
        self,
        asset_id: str,
        filename: str,
        content_type: str = "video/mp4",
        expires_in: int = 3600,
    ) -> Dict:
        """
        Create a simple presigned PUT URL for smaller files.

        Args:
            asset_id: UUID of the video asset record
            filename: Original filename
            content_type: MIME type
            expires_in: URL expiration in seconds

        Returns:
            Dict with presigned URL and key
        """
        ext = os.path.splitext(filename)[1] or ".mp4"
        key = f"assets/{asset_id}/raw/{uuid.uuid4()}{ext}"

        url = self.s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": VIDEO_MASTERS_BUCKET,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

        return {
            "upload_url": url,
            "key": key,
            "bucket": VIDEO_MASTERS_BUCKET,
            "method": "PUT",
            "content_type": content_type,
        }

    # =========================================================================
    # TRANSCODING
    # =========================================================================

    def queue_transcode(
        self,
        asset_id: str,
        source_key: str,
        qualities: List[str] = None,
        priority: int = 0,
    ) -> str:
        """
        Queue a video for HLS transcoding.

        Args:
            asset_id: UUID of the video asset
            source_key: S3 key of the source file
            qualities: List of quality levels to generate
            priority: Job priority (higher = more urgent)

        Returns:
            Job ID
        """
        if qualities is None:
            qualities = STANDARD_QUALITIES

        job = execute_single(
            """
            INSERT INTO consumer_transcode_jobs (
                id, asset_id, source_bucket, source_key,
                target_qualities, status, priority, created_at
            ) VALUES (
                gen_random_uuid(), :asset_id, :bucket, :source_key,
                :qualities, 'pending', :priority, NOW()
            )
            RETURNING id
            """,
            {
                "asset_id": asset_id,
                "bucket": VIDEO_MASTERS_BUCKET,
                "source_key": source_key,
                "qualities": json.dumps(qualities),
                "priority": priority,
            }
        )

        return job["id"]

    def transcode_to_hls(
        self,
        source_path: str,
        output_dir: str,
        qualities: List[str] = None,
        segment_duration: int = 6,
    ) -> Dict:
        """
        Transcode a video file to HLS with adaptive bitrate.

        Args:
            source_path: Path to source video file
            output_dir: Directory for HLS output
            qualities: List of quality levels to generate
            segment_duration: HLS segment duration in seconds

        Returns:
            Dict with master manifest path and rendition info
        """
        if qualities is None:
            qualities = STANDARD_QUALITIES

        # Probe source video for dimensions
        probe_cmd = [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration",
            "-of", "json",
            source_path
        ]

        try:
            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
            probe_data = json.loads(probe_result.stdout)
            source_width = probe_data["streams"][0].get("width", 1920)
            source_height = probe_data["streams"][0].get("height", 1080)
        except Exception:
            source_width, source_height = 1920, 1080

        # Filter qualities based on source resolution
        valid_qualities = []
        for q in qualities:
            preset = HLS_QUALITY_LADDER[q]
            if preset["height"] <= source_height:
                valid_qualities.append(q)

        if not valid_qualities:
            valid_qualities = [qualities[-1]]  # At least lowest quality

        renditions = {}
        stream_maps = []
        filter_complex_parts = []
        output_args = []

        # Build FFmpeg command for all renditions
        for i, quality in enumerate(valid_qualities):
            preset = HLS_QUALITY_LADDER[quality]
            rendition_dir = os.path.join(output_dir, quality)
            os.makedirs(rendition_dir, exist_ok=True)

            # Scale filter
            filter_complex_parts.append(
                f"[0:v]scale={preset['width']}:{preset['height']}:force_original_aspect_ratio=decrease,"
                f"pad={preset['width']}:{preset['height']}:(ow-iw)/2:(oh-ih)/2[v{i}]"
            )

            stream_maps.extend(["-map", f"[v{i}]", "-map", "0:a?"])

            # HLS output options for this rendition
            output_args.extend([
                f"-c:v:{i}", "libx264",
                f"-b:v:{i}", preset["bitrate"],
                f"-maxrate:v:{i}", preset["bitrate"],
                f"-bufsize:v:{i}", str(int(preset["bitrate"].replace("k", "")) * 2) + "k",
                f"-c:a:{i}", "aac",
                f"-b:a:{i}", preset["audio"],
                f"-ar:{i}", "48000",
            ])

            renditions[quality] = {
                "width": preset["width"],
                "height": preset["height"],
                "bitrate": preset["bitrate"],
                "path": f"{quality}/media.m3u8",
            }

        # Build complete FFmpeg command
        filter_complex = ";".join(filter_complex_parts)

        cmd = [
            "ffmpeg", "-y",
            "-i", source_path,
            "-filter_complex", filter_complex,
        ]
        cmd.extend(stream_maps)
        cmd.extend([
            "-preset", "fast",
            "-g", str(segment_duration * 30),  # GOP size
            "-keyint_min", str(segment_duration * 30),
            "-sc_threshold", "0",
            "-hls_time", str(segment_duration),
            "-hls_playlist_type", "vod",
            "-hls_flags", "independent_segments",
            "-hls_segment_type", "mpegts",
            "-master_pl_name", "master.m3u8",
            "-var_stream_map", " ".join([f"v:{i},a:{i}" for i in range(len(valid_qualities))]),
        ])
        cmd.extend(output_args)
        cmd.append(os.path.join(output_dir, "%v/media.m3u8"))

        # Run FFmpeg
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)

        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr}")

        # Generate master playlist manually for better control
        master_content = "#EXTM3U\n#EXT-X-VERSION:3\n\n"
        for quality in valid_qualities:
            preset = HLS_QUALITY_LADDER[quality]
            bandwidth = int(preset["bitrate"].replace("k", "")) * 1000
            master_content += (
                f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},"
                f"RESOLUTION={preset['width']}x{preset['height']}\n"
                f"{quality}/media.m3u8\n\n"
            )

        master_path = os.path.join(output_dir, "master.m3u8")
        with open(master_path, "w") as f:
            f.write(master_content)

        return {
            "master_manifest": "master.m3u8",
            "renditions": renditions,
            "qualities": valid_qualities,
        }

    def upload_hls_output(
        self,
        asset_id: str,
        version_id: str,
        local_dir: str,
    ) -> Dict:
        """
        Upload transcoded HLS files to S3.

        Args:
            asset_id: UUID of the video asset
            version_id: Version identifier for this transcode
            local_dir: Local directory containing HLS output

        Returns:
            Dict with S3 paths
        """
        base_key = f"assets/{asset_id}/hls/{version_id}"
        uploaded_files = []

        for root, dirs, files in os.walk(local_dir):
            for filename in files:
                local_path = os.path.join(root, filename)
                relative_path = os.path.relpath(local_path, local_dir)
                s3_key = f"{base_key}/{relative_path}"

                # Determine content type
                if filename.endswith(".m3u8"):
                    content_type = "application/vnd.apple.mpegurl"
                elif filename.endswith(".ts"):
                    content_type = "video/MP2T"
                else:
                    content_type = "application/octet-stream"

                # Upload with long cache for segments, short for manifests
                cache_control = (
                    "max-age=31536000" if filename.endswith(".ts")
                    else "max-age=60"
                )

                self.s3_client.upload_file(
                    local_path,
                    VIDEO_PUBLISH_BUCKET,
                    s3_key,
                    ExtraArgs={
                        "ContentType": content_type,
                        "CacheControl": cache_control,
                    }
                )
                uploaded_files.append(s3_key)

        return {
            "bucket": VIDEO_PUBLISH_BUCKET,
            "base_key": base_key,
            "master_manifest": f"{base_key}/master.m3u8",
            "files_count": len(uploaded_files),
        }

    # =========================================================================
    # CLOUDFRONT SIGNED URLS/COOKIES
    # =========================================================================

    def _load_cloudfront_key(self):
        """Load CloudFront private key for signing."""
        if self._cloudfront_key:
            return self._cloudfront_key

        key_path = CLOUDFRONT_PRIVATE_KEY_PATH
        if not key_path or not os.path.exists(key_path):
            # Try loading from environment variable
            key_pem = os.getenv("CLOUDFRONT_PRIVATE_KEY")
            if key_pem:
                self._cloudfront_key = serialization.load_pem_private_key(
                    key_pem.encode(),
                    password=None,
                    backend=default_backend()
                )
                return self._cloudfront_key
            return None

        with open(key_path, "rb") as f:
            self._cloudfront_key = serialization.load_pem_private_key(
                f.read(),
                password=None,
                backend=default_backend()
            )
        return self._cloudfront_key

    def _rsa_sign(self, message: bytes) -> bytes:
        """Sign a message with RSA-SHA1 for CloudFront."""
        key = self._load_cloudfront_key()
        if not key:
            raise Exception("CloudFront private key not configured")

        return key.sign(
            message,
            padding.PKCS1v15(),
            hashes.SHA1()
        )

    def _create_signed_policy(
        self,
        resource: str,
        expires: datetime,
        ip_address: str = None,
    ) -> Tuple[str, str]:
        """
        Create a CloudFront signed policy.

        Returns:
            Tuple of (policy_base64, signature_base64)
        """
        policy = {
            "Statement": [{
                "Resource": resource,
                "Condition": {
                    "DateLessThan": {
                        "AWS:EpochTime": int(expires.timestamp())
                    }
                }
            }]
        }

        if ip_address:
            policy["Statement"][0]["Condition"]["IpAddress"] = {
                "AWS:SourceIp": ip_address
            }

        policy_json = json.dumps(policy, separators=(",", ":"))
        policy_b64 = base64.b64encode(policy_json.encode()).decode()

        # CloudFront-safe base64
        policy_b64 = policy_b64.replace("+", "-").replace("=", "_").replace("/", "~")

        signature = self._rsa_sign(policy_json.encode())
        signature_b64 = base64.b64encode(signature).decode()
        signature_b64 = signature_b64.replace("+", "-").replace("=", "_").replace("/", "~")

        return policy_b64, signature_b64

    def create_signed_url(
        self,
        path: str,
        expires_in: int = 3600,
        ip_address: str = None,
    ) -> str:
        """
        Create a CloudFront signed URL for a video resource.

        Args:
            path: Path to the resource (e.g., "assets/123/hls/v1/master.m3u8")
            expires_in: Expiration time in seconds
            ip_address: Optional IP restriction

        Returns:
            Signed URL
        """
        if not CLOUDFRONT_DOMAIN:
            # Fall back to S3 signed URL
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": VIDEO_PUBLISH_BUCKET, "Key": path},
                ExpiresIn=expires_in,
            )

        resource = f"https://{CLOUDFRONT_DOMAIN}/{path}"
        expires = datetime.utcnow() + timedelta(seconds=expires_in)

        policy_b64, signature_b64 = self._create_signed_policy(
            resource, expires, ip_address
        )

        return (
            f"{resource}?Policy={policy_b64}"
            f"&Signature={signature_b64}"
            f"&Key-Pair-Id={CLOUDFRONT_KEY_PAIR_ID}"
        )

    def create_signed_cookies(
        self,
        asset_id: str,
        expires_in: int = 14400,  # 4 hours
        ip_address: str = None,
    ) -> Dict[str, str]:
        """
        Create CloudFront signed cookies for streaming a video.

        Cookies allow access to all segments without per-URL signing.

        Args:
            asset_id: UUID of the video asset
            expires_in: Cookie expiration in seconds
            ip_address: Optional IP restriction

        Returns:
            Dict of cookie name -> value
        """
        if not CLOUDFRONT_DOMAIN:
            raise Exception("CloudFront not configured")

        # Wildcard resource for all files under this asset
        resource = f"https://{CLOUDFRONT_DOMAIN}/assets/{asset_id}/*"
        expires = datetime.utcnow() + timedelta(seconds=expires_in)

        policy_b64, signature_b64 = self._create_signed_policy(
            resource, expires, ip_address
        )

        return {
            "CloudFront-Policy": policy_b64,
            "CloudFront-Signature": signature_b64,
            "CloudFront-Key-Pair-Id": CLOUDFRONT_KEY_PAIR_ID,
        }

    def get_playback_url(
        self,
        asset_id: str,
        version_id: str = "latest",
        use_signed_cookies: bool = True,
    ) -> Dict:
        """
        Get the playback URL for a video asset.

        Args:
            asset_id: UUID of the video asset
            version_id: Version to play (default: latest)
            use_signed_cookies: Whether to use cookies vs per-URL signing

        Returns:
            Dict with manifest_url and optional cookies
        """
        # Get latest version if not specified
        if version_id == "latest":
            result = execute_single(
                """
                SELECT version_id, manifest_key
                FROM video_renditions
                WHERE asset_id = :asset_id AND status = 'ready'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                {"asset_id": asset_id}
            )
            if not result:
                return {"error": "No ready renditions found"}
            version_id = result["version_id"]
            manifest_key = result["manifest_key"]
        else:
            manifest_key = f"assets/{asset_id}/hls/{version_id}/master.m3u8"

        if use_signed_cookies and CLOUDFRONT_DOMAIN:
            cookies = self.create_signed_cookies(asset_id)
            return {
                "manifest_url": f"https://{CLOUDFRONT_DOMAIN}/{manifest_key}",
                "cookies": cookies,
                "cookie_domain": CLOUDFRONT_DOMAIN,
            }
        else:
            signed_url = self.create_signed_url(manifest_key)
            return {
                "manifest_url": signed_url,
            }


# Global service instance
video_pipeline = VideoPipelineService()


def get_video_pipeline() -> VideoPipelineService:
    """Get the video pipeline service instance."""
    return video_pipeline
