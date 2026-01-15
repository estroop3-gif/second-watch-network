"""
Downloads API - Authenticated download URLs for SWN applications

Provides presigned S3 URLs for downloading the SWN Dailies Helper application.
Requires authentication to access download links.
"""
import os
import boto3
from fastapi import APIRouter, Depends, HTTPException
from botocore.exceptions import ClientError

from app.core.auth import get_current_user

router = APIRouter()

# S3 bucket for downloads (private bucket, accessed via presigned URLs)
S3_DOWNLOADS_BUCKET = os.environ.get(
    "S3_DOWNLOADS_BUCKET",
    "swn-downloads-517220555400"
)
S3_REGION = "us-east-1"

# Current version - can be updated or read from version.json in S3
DAILIES_HELPER_VERSION = "1.0.0"


@router.get("/dailies-helper")
async def get_dailies_helper_downloads(
    current_user: dict = Depends(get_current_user)
):
    """
    Get presigned download URLs for SWN Dailies Helper.

    Returns download URLs only for platforms that have files available.
    URLs are valid for 1 hour.

    Requires authentication.
    """
    try:
        s3_client = boto3.client("s3", region_name=S3_REGION)
        prefix = "dailies-helper/latest"

        # Define available platforms and their files
        platform_files = {
            "windows": {
                "key": "SWN-Dailies-Helper-win.exe",
                "filename": "SWN-Dailies-Helper.exe",
                "platform": "Windows",
                "description": "Windows executable (.exe)"
            },
            "mac": {
                "key": "SWN-Dailies-Helper-mac.dmg",
                "filename": "SWN-Dailies-Helper.dmg",
                "platform": "macOS",
                "description": "macOS disk image (.dmg)"
            },
            "linux": {
                "key": "SWN-Dailies-Helper-linux.AppImage",
                "filename": "SWN-Dailies-Helper.AppImage",
                "platform": "Linux",
                "description": "Linux AppImage (.AppImage)"
            }
        }

        def file_exists(key: str) -> bool:
            """Check if a file exists in S3."""
            try:
                s3_client.head_object(Bucket=S3_DOWNLOADS_BUCKET, Key=f'{prefix}/{key}')
                return True
            except ClientError:
                return False

        def get_presigned_url(key: str) -> str:
            """Generate presigned URL for a file in S3."""
            return s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': S3_DOWNLOADS_BUCKET,
                    'Key': f'{prefix}/{key}'
                },
                ExpiresIn=3600  # 1 hour
            )

        # Only include platforms that have files available
        downloads = {}
        for platform, info in platform_files.items():
            if file_exists(info["key"]):
                downloads[platform] = {
                    "url": get_presigned_url(info["key"]),
                    "filename": info["filename"],
                    "platform": info["platform"],
                    "description": info["description"]
                }

        return {
            "version": DAILIES_HELPER_VERSION,
            "downloads": downloads
        }
    except ClientError as e:
        print(f"Error generating presigned URLs: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate download URLs"
        )
