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
AWS_ACCESS_KEY_ID = getattr(settings, 'AWS_ACCESS_KEY_ID', None) or os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None) or os.getenv('AWS_SECRET_ACCESS_KEY')

# S3 Bucket names
AVATARS_BUCKET = os.getenv('AWS_S3_AVATARS_BUCKET', 'swn-avatars-517220555400')
BACKLOT_BUCKET = os.getenv('AWS_S3_BACKLOT_BUCKET', 'swn-backlot-517220555400')
BACKLOT_FILES_BUCKET = os.getenv('AWS_S3_BACKLOT_FILES_BUCKET', 'swn-backlot-files-517220555400')

# Bucket mapping (matches Supabase bucket names)
BUCKET_MAPPING = {
    'avatars': AVATARS_BUCKET,
    'backlot': BACKLOT_BUCKET,
    'backlot-files': BACKLOT_FILES_BUCKET,
}

# S3 Client configuration
s3_config = Config(
    region_name=AWS_REGION,
    signature_version='s3v4',
    retries={'max_attempts': 3, 'mode': 'standard'}
)

# Create S3 client
s3_client = boto3.client(
    's3',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
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
