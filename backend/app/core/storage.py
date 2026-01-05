"""
AWS S3 Storage Module

Replaces Supabase Storage with S3 for file operations.
"""

import os
import uuid
import mimetypes
from typing import Optional, BinaryIO
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

from app.core.config import settings


# AWS Configuration
AWS_REGION = getattr(settings, 'AWS_REGION', None) or os.getenv('AWS_REGION', 'us-east-1')

# S3 Bucket names
AVATARS_BUCKET = os.getenv('AWS_S3_AVATARS_BUCKET', 'swn-avatars-517220555400')
BACKLOT_BUCKET = os.getenv('AWS_S3_BACKLOT_BUCKET', 'swn-backlot-517220555400')
BACKLOT_FILES_BUCKET = os.getenv('AWS_S3_BACKLOT_FILES_BUCKET', 'swn-backlot-files-517220555400')
VIDEO_MASTERS_BUCKET = os.getenv('AWS_S3_VIDEO_MASTERS_BUCKET', 'swn-video-masters-517220555400')
VIDEO_PUBLISH_BUCKET = os.getenv('AWS_S3_VIDEO_PUBLISH_BUCKET', 'swn-video-publish-517220555400')

# Bucket mapping (matches Supabase bucket names)
BUCKET_MAPPING = {
    'avatars': AVATARS_BUCKET,
    'backlot': BACKLOT_BUCKET,
    'backlot-files': BACKLOT_FILES_BUCKET,
    'video-masters': VIDEO_MASTERS_BUCKET,
    'video-publish': VIDEO_PUBLISH_BUCKET,
}

# S3 Client configuration
s3_config = Config(
    region_name=AWS_REGION,
    signature_version='s3v4',
    retries={'max_attempts': 3, 'mode': 'standard'}
)

# Always use boto3's default credential chain - this properly handles:
# - Lambda execution role (includes AWS_SESSION_TOKEN for presigned URLs)
# - EC2 instance profile
# - Local ~/.aws/credentials or environment variables
# - ECS task role, etc.
s3_client = boto3.client(
    's3',
    region_name=AWS_REGION,
    config=s3_config
)


class StorageBucket:
    """
    Provides Supabase Storage-like interface for S3 operations.
    """

    def __init__(self, bucket_name: str):
        self.bucket_name = BUCKET_MAPPING.get(bucket_name, bucket_name)

    def upload(
        self,
        path: str,
        file: BinaryIO,
        file_options: dict = None
    ) -> dict:
        """
        Upload a file to S3.

        Args:
            path: The path/key for the file in the bucket
            file: File-like object to upload
            file_options: Optional dict with content_type, cache_control, etc.

        Returns:
            dict with path and public URL
        """
        try:
            content_type = None
            if file_options:
                content_type = file_options.get('content_type') or file_options.get('contentType')

            if not content_type:
                content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'

            extra_args = {
                'ContentType': content_type,
            }

            # Add cache control if specified
            if file_options and file_options.get('cache_control'):
                extra_args['CacheControl'] = file_options['cache_control']

            s3_client.upload_fileobj(
                file,
                self.bucket_name,
                path,
                ExtraArgs=extra_args
            )

            return {
                'path': path,
                'fullPath': f"{self.bucket_name}/{path}",
                'id': path,
            }

        except ClientError as e:
            raise Exception(f"Failed to upload file: {e}")

    def download(self, path: str) -> bytes:
        """
        Download a file from S3.
        """
        try:
            response = s3_client.get_object(Bucket=self.bucket_name, Key=path)
            return response['Body'].read()
        except ClientError as e:
            raise Exception(f"Failed to download file: {e}")

    def remove(self, paths: list) -> dict:
        """
        Remove files from S3.
        """
        try:
            if isinstance(paths, str):
                paths = [paths]

            objects = [{'Key': path} for path in paths]
            response = s3_client.delete_objects(
                Bucket=self.bucket_name,
                Delete={'Objects': objects}
            )
            return {'data': response.get('Deleted', [])}
        except ClientError as e:
            raise Exception(f"Failed to remove files: {e}")

    def list(self, path: str = "", options: dict = None) -> list:
        """
        List files in a bucket path.
        """
        try:
            prefix = path if path else ""
            response = s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )

            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'name': obj['Key'].split('/')[-1],
                    'id': obj['Key'],
                    'updated_at': obj['LastModified'].isoformat(),
                    'created_at': obj['LastModified'].isoformat(),
                    'metadata': {
                        'size': obj['Size'],
                        'mimetype': mimetypes.guess_type(obj['Key'])[0],
                    }
                })
            return files
        except ClientError as e:
            raise Exception(f"Failed to list files: {e}")

    def get_public_url(self, path: str) -> str:
        """
        Get the public URL for a file.
        Only works for public buckets (like avatars).
        """
        return f"https://{self.bucket_name}.s3.{AWS_REGION}.amazonaws.com/{path}"

    def create_signed_url(
        self,
        path: str,
        expires_in: int = 3600
    ) -> dict:
        """
        Create a signed URL for private file access.

        Args:
            path: The file path in the bucket
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            dict with signedUrl
        """
        try:
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': path
                },
                ExpiresIn=expires_in
            )
            return {'signedUrl': url, 'error': None}
        except ClientError as e:
            return {'signedUrl': None, 'error': str(e)}

    def create_signed_upload_url(
        self,
        path: str,
        expires_in: int = 3600
    ) -> dict:
        """
        Create a signed URL for uploading a file.
        Use this for direct browser uploads.

        Args:
            path: The file path in the bucket
            expires_in: URL expiration time in seconds

        Returns:
            dict with signedUrl and fields for form upload
        """
        try:
            response = s3_client.generate_presigned_post(
                self.bucket_name,
                path,
                ExpiresIn=expires_in
            )
            return {
                'signedUrl': response['url'],
                'fields': response['fields'],
                'path': path,
                'error': None
            }
        except ClientError as e:
            return {'signedUrl': None, 'fields': None, 'error': str(e)}

    def move(self, from_path: str, to_path: str) -> dict:
        """
        Move a file within the bucket.
        """
        try:
            # Copy to new location
            s3_client.copy_object(
                Bucket=self.bucket_name,
                CopySource={'Bucket': self.bucket_name, 'Key': from_path},
                Key=to_path
            )
            # Delete original
            s3_client.delete_object(Bucket=self.bucket_name, Key=from_path)
            return {'path': to_path}
        except ClientError as e:
            raise Exception(f"Failed to move file: {e}")

    def copy(self, from_path: str, to_path: str) -> dict:
        """
        Copy a file within the bucket.
        """
        try:
            s3_client.copy_object(
                Bucket=self.bucket_name,
                CopySource={'Bucket': self.bucket_name, 'Key': from_path},
                Key=to_path
            )
            return {'path': to_path}
        except ClientError as e:
            raise Exception(f"Failed to copy file: {e}")


class StorageClient:
    """
    Supabase Storage-compatible client for S3.
    """

    def from_(self, bucket_name: str) -> StorageBucket:
        """
        Get a bucket interface (matches Supabase .from_() method).
        """
        return StorageBucket(bucket_name)

    # Alias for compatibility
    def from_bucket(self, bucket_name: str) -> StorageBucket:
        return self.from_(bucket_name)


# Global storage client
storage_client = StorageClient()


def get_storage_client() -> StorageClient:
    """
    Get the storage client (Supabase Storage-compatible interface).
    """
    return storage_client


# Convenience functions
def upload_file(
    bucket: str,
    path: str,
    file: BinaryIO,
    content_type: str = None
) -> dict:
    """
    Upload a file to S3.
    """
    return storage_client.from_(bucket).upload(
        path,
        file,
        {'content_type': content_type} if content_type else None
    )


def get_public_url(bucket: str, path: str) -> str:
    """
    Get public URL for a file.
    """
    return storage_client.from_(bucket).get_public_url(path)


def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """
    Get signed URL for a private file.
    """
    result = storage_client.from_(bucket).create_signed_url(path, expires_in)
    return result.get('signedUrl')


def delete_file(bucket: str, path: str) -> bool:
    """
    Delete a file from S3.
    """
    try:
        storage_client.from_(bucket).remove([path])
        return True
    except Exception:
        return False


def download_file(bucket: str, path: str) -> bytes:
    """
    Download a file from S3.
    """
    return storage_client.from_(bucket).download(path)


def download_from_s3_uri(s3_uri: str) -> bytes:
    """
    Download a file from an S3 URI (s3://bucket/key format).

    Args:
        s3_uri: Full S3 URI like s3://bucket-name/path/to/file.pdf

    Returns:
        File contents as bytes
    """
    if not s3_uri.startswith('s3://'):
        raise ValueError(f"Invalid S3 URI: {s3_uri}")

    # Parse s3://bucket-name/path/to/file
    uri_without_prefix = s3_uri[5:]  # Remove 's3://'
    parts = uri_without_prefix.split('/', 1)

    if len(parts) < 2:
        raise ValueError(f"Invalid S3 URI format: {s3_uri}")

    bucket_name = parts[0]
    key = parts[1]

    return StorageBucket(bucket_name).download(key)


def generate_unique_filename(original_filename: str) -> str:
    """
    Generate a unique filename preserving the extension.
    """
    ext = os.path.splitext(original_filename)[1] if original_filename else ''
    return f"{uuid.uuid4()}{ext}"


# =============================================================================
# S3 Path Builder
# =============================================================================

class S3PathBuilder:
    """
    Generates consistent S3 paths across the platform.

    This ensures all media files follow predictable naming conventions
    for easier management, CDN caching, and debugging.

    Path Patterns:
    - Avatars: avatars/{user_id}/{filename}
    - Backlot Dailies: backlot/{project_id}/dailies/{shoot_day_id}/{clip_id}/{filename}
    - Backlot Assets: backlot/{project_id}/assets/{asset_type}/{asset_id}/{filename}
    - World Episodes: worlds/{world_id}/episodes/{episode_id}/{quality}/{filename}
    - Shorts: shorts/{short_id}/{quality}/{filename}
    - Thumbnails: thumbnails/{content_type}/{content_id}/{filename}
    """

    # Bucket assignments by content type
    BUCKET_MAP = {
        'avatar': AVATARS_BUCKET,
        'backlot_daily': BACKLOT_BUCKET,
        'backlot_asset': BACKLOT_FILES_BUCKET,
        'world_master': VIDEO_MASTERS_BUCKET,
        'world_publish': VIDEO_PUBLISH_BUCKET,
        'short_master': VIDEO_MASTERS_BUCKET,
        'short_publish': VIDEO_PUBLISH_BUCKET,
    }

    @classmethod
    def avatar(cls, user_id: str, filename: str) -> tuple[str, str]:
        """
        Generate path for user avatar.

        Returns: (bucket, key)
        """
        key = f"avatars/{user_id}/{filename}"
        return (AVATARS_BUCKET, key)

    @classmethod
    def backlot_daily(
        cls,
        project_id: str,
        shoot_day_id: str,
        clip_id: str,
        filename: str
    ) -> tuple[str, str]:
        """
        Generate path for a dailies clip.

        Returns: (bucket, key)
        """
        key = f"projects/{project_id}/dailies/{shoot_day_id}/{clip_id}/{filename}"
        return (BACKLOT_BUCKET, key)

    @classmethod
    def backlot_daily_proxy(
        cls,
        project_id: str,
        shoot_day_id: str,
        clip_id: str
    ) -> tuple[str, str]:
        """
        Generate path for a dailies proxy file.

        Returns: (bucket, key)
        """
        key = f"projects/{project_id}/dailies/{shoot_day_id}/{clip_id}/proxy.mp4"
        return (BACKLOT_BUCKET, key)

    @classmethod
    def backlot_daily_thumbnail(
        cls,
        project_id: str,
        shoot_day_id: str,
        clip_id: str
    ) -> tuple[str, str]:
        """
        Generate path for a dailies thumbnail.

        Returns: (bucket, key)
        """
        key = f"projects/{project_id}/dailies/{shoot_day_id}/{clip_id}/thumbnail.jpg"
        return (BACKLOT_BUCKET, key)

    @classmethod
    def backlot_asset(
        cls,
        project_id: str,
        asset_type: str,
        asset_id: str,
        filename: str
    ) -> tuple[str, str]:
        """
        Generate path for a backlot asset file.

        asset_type: 'documents', 'images', 'audio', etc.

        Returns: (bucket, key)
        """
        key = f"projects/{project_id}/assets/{asset_type}/{asset_id}/{filename}"
        return (BACKLOT_FILES_BUCKET, key)

    @classmethod
    def world_master(
        cls,
        world_id: str,
        episode_id: str,
        filename: str
    ) -> tuple[str, str]:
        """
        Generate path for an episode master file (original upload).

        Returns: (bucket, key)
        """
        key = f"worlds/{world_id}/episodes/{episode_id}/master/{filename}"
        return (VIDEO_MASTERS_BUCKET, key)

    @classmethod
    def world_hls(
        cls,
        world_id: str,
        episode_id: str,
        quality: str,
        filename: str
    ) -> tuple[str, str]:
        """
        Generate path for HLS transcoded output.

        quality: '1080p', '720p', '480p', 'audio'
        filename: 'playlist.m3u8', 'segment_001.ts', etc.

        Returns: (bucket, key)
        """
        key = f"worlds/{world_id}/episodes/{episode_id}/hls/{quality}/{filename}"
        return (VIDEO_PUBLISH_BUCKET, key)

    @classmethod
    def world_thumbnail(
        cls,
        world_id: str,
        episode_id: str,
        filename: str = "thumbnail.jpg"
    ) -> tuple[str, str]:
        """
        Generate path for episode thumbnail.

        Returns: (bucket, key)
        """
        key = f"worlds/{world_id}/episodes/{episode_id}/thumbnails/{filename}"
        return (VIDEO_PUBLISH_BUCKET, key)

    @classmethod
    def short_master(
        cls,
        short_id: str,
        filename: str
    ) -> tuple[str, str]:
        """
        Generate path for a Short's master file.

        Returns: (bucket, key)
        """
        key = f"shorts/{short_id}/master/{filename}"
        return (VIDEO_MASTERS_BUCKET, key)

    @classmethod
    def short_hls(
        cls,
        short_id: str,
        quality: str,
        filename: str
    ) -> tuple[str, str]:
        """
        Generate path for Short's HLS output.

        Returns: (bucket, key)
        """
        key = f"shorts/{short_id}/hls/{quality}/{filename}"
        return (VIDEO_PUBLISH_BUCKET, key)

    @classmethod
    def short_thumbnail(
        cls,
        short_id: str,
        filename: str = "thumbnail.jpg"
    ) -> tuple[str, str]:
        """
        Generate path for Short's thumbnail.

        Returns: (bucket, key)
        """
        key = f"shorts/{short_id}/thumbnails/{filename}"
        return (VIDEO_PUBLISH_BUCKET, key)

    @classmethod
    def live_event_thumbnail(
        cls,
        event_id: str,
        filename: str = "thumbnail.jpg"
    ) -> tuple[str, str]:
        """
        Generate path for live event thumbnail.

        Returns: (bucket, key)
        """
        key = f"events/{event_id}/thumbnails/{filename}"
        return (VIDEO_PUBLISH_BUCKET, key)

    @classmethod
    def parse_s3_uri(cls, s3_uri: str) -> tuple[str, str]:
        """
        Parse an S3 URI into bucket and key.

        Args:
            s3_uri: s3://bucket-name/path/to/file

        Returns: (bucket, key)
        """
        if not s3_uri.startswith('s3://'):
            raise ValueError(f"Invalid S3 URI: {s3_uri}")

        uri_without_prefix = s3_uri[5:]
        parts = uri_without_prefix.split('/', 1)

        if len(parts) < 2:
            raise ValueError(f"Invalid S3 URI format: {s3_uri}")

        return (parts[0], parts[1])

    @classmethod
    def to_s3_uri(cls, bucket: str, key: str) -> str:
        """
        Convert bucket and key to S3 URI.

        Returns: s3://bucket/key
        """
        return f"s3://{bucket}/{key}"

    @classmethod
    def to_cloudfront_url(
        cls,
        key: str,
        distribution_domain: str = None
    ) -> str:
        """
        Convert S3 key to CloudFront URL.

        Args:
            key: S3 object key
            distribution_domain: CloudFront domain (uses default if not provided)

        Returns: https://domain/key
        """
        if not distribution_domain:
            # Default CloudFront distribution for video publish bucket
            distribution_domain = os.getenv(
                'CLOUDFRONT_VIDEO_DOMAIN',
                'd1234567890.cloudfront.net'  # Placeholder - configure in settings
            )
        return f"https://{distribution_domain}/{key}"
