"""
HLS Transcoding Worker
Processes consumer video transcoding jobs from the queue.

Run with: python -m app.services.hls_transcode_worker

Requires FFmpeg to be installed on the system.
"""

import os
import sys
import time
import json
import uuid
import tempfile
import subprocess
from typing import Dict, Optional
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.database import execute_single, execute_query, execute_update
from app.services.video_pipeline import (
    video_pipeline,
    HLS_QUALITY_LADDER,
    STANDARD_QUALITIES,
    VIDEO_MASTERS_BUCKET,
    VIDEO_PUBLISH_BUCKET,
)

import boto3

# Configuration
POLL_INTERVAL = 10  # seconds
MAX_RETRIES = 3
WORKER_ID = os.getenv("WORKER_ID", f"worker-{uuid.uuid4().hex[:8]}")


def check_ffmpeg() -> bool:
    """Check if FFmpeg is available"""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            check=True
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_pending_job() -> Optional[Dict]:
    """Get the next pending transcoding job, prioritized by priority and age"""
    return execute_single(
        """
        UPDATE consumer_transcode_jobs
        SET
            status = 'processing',
            worker_id = :worker_id,
            started_at = NOW(),
            updated_at = NOW(),
            attempts = attempts + 1
        WHERE id = (
            SELECT id FROM consumer_transcode_jobs
            WHERE status = 'pending'
              AND attempts < :max_retries
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, asset_id, source_bucket, source_key, target_qualities, attempts
        """,
        {"worker_id": WORKER_ID, "max_retries": MAX_RETRIES}
    )


def update_job_progress(job_id: str, progress: int, stage: str = None):
    """Update job progress"""
    execute_update(
        """
        UPDATE consumer_transcode_jobs
        SET
            progress = :progress,
            stage = COALESCE(:stage, stage),
            updated_at = NOW()
        WHERE id = :job_id
        """,
        {"job_id": job_id, "progress": progress, "stage": stage}
    )


def complete_job(
    job_id: str,
    success: bool,
    output_info: Dict = None,
    error_message: str = None
):
    """Mark job as complete or failed"""
    status = "completed" if success else "failed"
    execute_update(
        """
        UPDATE consumer_transcode_jobs
        SET
            status = :status,
            completed_at = NOW(),
            error_message = :error,
            output_info = :output_info,
            updated_at = NOW()
        WHERE id = :job_id
        """,
        {
            "job_id": job_id,
            "status": status,
            "error": error_message,
            "output_info": json.dumps(output_info) if output_info else None,
        }
    )


def update_asset_status(asset_id: str, status: str, manifest_url: str = None):
    """Update the video asset record with transcoding results"""
    if manifest_url:
        execute_update(
            """
            UPDATE video_assets
            SET
                processing_status = :status,
                hls_manifest_url = :manifest_url,
                updated_at = NOW()
            WHERE id = :asset_id
            """,
            {"asset_id": asset_id, "status": status, "manifest_url": manifest_url}
        )
    else:
        execute_update(
            """
            UPDATE video_assets
            SET
                processing_status = :status,
                updated_at = NOW()
            WHERE id = :asset_id
            """,
            {"asset_id": asset_id, "status": status}
        )


def create_rendition_records(
    asset_id: str,
    version_id: str,
    renditions: Dict,
    manifest_key: str
):
    """Create video_renditions records for the transcoded output"""
    from app.services.video_pipeline import VIDEO_PUBLISH_BUCKET

    for quality, info in renditions.items():
        # Build file_key for the quality's HLS folder
        file_key = f"assets/{asset_id}/hls/{version_id}/{quality}/"

        execute_update(
            """
            INSERT INTO video_renditions (
                id, video_asset_id, version_id, quality, quality_label,
                resolution_width, resolution_height, bitrate_kbps,
                file_bucket, file_key, manifest_key, status, created_at
            ) VALUES (
                gen_random_uuid(), :asset_id, :version_id, :quality, :quality,
                :width, :height, :bitrate,
                :bucket, :file_key, :manifest_key, 'ready', NOW()
            )
            ON CONFLICT (video_asset_id, COALESCE(version_id, ''), COALESCE(quality, quality_label))
            DO UPDATE SET
                resolution_width = EXCLUDED.resolution_width,
                resolution_height = EXCLUDED.resolution_height,
                bitrate_kbps = EXCLUDED.bitrate_kbps,
                file_key = EXCLUDED.file_key,
                manifest_key = EXCLUDED.manifest_key,
                status = 'ready'
            """,
            {
                "asset_id": asset_id,
                "version_id": version_id,
                "quality": quality,
                "width": info["width"],
                "height": info["height"],
                "bitrate": int(info["bitrate"].replace("k", "")),
                "bucket": VIDEO_PUBLISH_BUCKET,
                "file_key": file_key,
                "manifest_key": manifest_key,
            }
        )


def process_job(job: Dict) -> bool:
    """Process a single transcoding job"""
    job_id = job["id"]
    asset_id = job["asset_id"]
    source_bucket = job["source_bucket"]
    source_key = job["source_key"]
    qualities = json.loads(job["target_qualities"]) if isinstance(job["target_qualities"], str) else job["target_qualities"]

    print(f"[{WORKER_ID}] Processing job {job_id}")
    print(f"  Asset: {asset_id}")
    print(f"  Source: s3://{source_bucket}/{source_key}")
    print(f"  Qualities: {qualities}")

    s3_client = boto3.client("s3", region_name="us-east-1")
    version_id = uuid.uuid4().hex[:12]

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Stage 1: Download source
            update_job_progress(job_id, 5, "downloading")
            print(f"  Downloading source file...")

            source_ext = os.path.splitext(source_key)[1] or ".mp4"
            source_path = os.path.join(temp_dir, f"source{source_ext}")

            s3_client.download_file(source_bucket, source_key, source_path)

            # Verify file exists and has content
            if not os.path.exists(source_path) or os.path.getsize(source_path) == 0:
                raise Exception("Downloaded file is empty or missing")

            file_size_mb = os.path.getsize(source_path) / (1024 * 1024)
            print(f"  Downloaded: {file_size_mb:.1f} MB")

            # Stage 2: Transcode to HLS
            update_job_progress(job_id, 15, "transcoding")
            print(f"  Starting HLS transcode...")

            output_dir = os.path.join(temp_dir, "hls_output")
            os.makedirs(output_dir, exist_ok=True)

            result = video_pipeline.transcode_to_hls(
                source_path=source_path,
                output_dir=output_dir,
                qualities=qualities,
            )

            print(f"  Transcode complete: {result['qualities']}")
            update_job_progress(job_id, 70, "uploading")

            # Stage 3: Upload to S3
            print(f"  Uploading HLS files to S3...")

            upload_result = video_pipeline.upload_hls_output(
                asset_id=asset_id,
                version_id=version_id,
                local_dir=output_dir,
            )

            print(f"  Uploaded {upload_result['files_count']} files")
            update_job_progress(job_id, 90, "finalizing")

            # Stage 4: Update database records
            manifest_key = upload_result["master_manifest"]

            create_rendition_records(
                asset_id=asset_id,
                version_id=version_id,
                renditions=result["renditions"],
                manifest_key=manifest_key,
            )

            update_asset_status(
                asset_id=asset_id,
                status="ready",
                manifest_url=manifest_key,
            )

            output_info = {
                "version_id": version_id,
                "manifest_key": manifest_key,
                "qualities": result["qualities"],
                "files_count": upload_result["files_count"],
            }

            complete_job(job_id, True, output_info)
            print(f"  Job {job_id} completed successfully!")
            return True

        except Exception as e:
            error_msg = str(e)
            print(f"  ERROR: {error_msg}")

            # Check if we should retry
            if job["attempts"] >= MAX_RETRIES:
                complete_job(job_id, False, error_message=error_msg)
                update_asset_status(asset_id, "failed")
                print(f"  Job {job_id} failed after {job['attempts']} attempts")
            else:
                # Put back in queue for retry
                execute_update(
                    """
                    UPDATE consumer_transcode_jobs
                    SET
                        status = 'pending',
                        error_message = :error,
                        updated_at = NOW()
                    WHERE id = :job_id
                    """,
                    {"job_id": job_id, "error": error_msg}
                )
                print(f"  Job {job_id} will be retried (attempt {job['attempts']}/{MAX_RETRIES})")

            return False


def run_worker(single_run: bool = False):
    """Run the HLS transcoding worker"""
    print(f"=" * 60)
    print(f"HLS Transcoding Worker - {WORKER_ID}")
    print(f"=" * 60)

    if not check_ffmpeg():
        print("ERROR: FFmpeg is not installed or not in PATH")
        print("Please install FFmpeg to use this worker")
        sys.exit(1)

    print("FFmpeg found, worker ready")
    print(f"Source bucket: {VIDEO_MASTERS_BUCKET}")
    print(f"Publish bucket: {VIDEO_PUBLISH_BUCKET}")
    print(f"Poll interval: {POLL_INTERVAL}s")
    print()

    jobs_processed = 0
    jobs_failed = 0

    while True:
        try:
            job = get_pending_job()

            if job:
                success = process_job(job)
                if success:
                    jobs_processed += 1
                else:
                    jobs_failed += 1
                print(f"Stats: {jobs_processed} completed, {jobs_failed} failed")
                print()
            else:
                if single_run:
                    print("No pending jobs found")
                    break
                # Wait before checking again
                time.sleep(POLL_INTERVAL)

            if single_run:
                break

        except KeyboardInterrupt:
            print("\nShutting down worker...")
            break
        except Exception as e:
            print(f"Worker error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HLS Transcoding Worker")
    parser.add_argument(
        "--single",
        action="store_true",
        help="Process one job and exit"
    )
    parser.add_argument(
        "--worker-id",
        type=str,
        default=None,
        help="Custom worker ID"
    )

    args = parser.parse_args()

    if args.worker_id:
        WORKER_ID = args.worker_id

    run_worker(single_run=args.single)
