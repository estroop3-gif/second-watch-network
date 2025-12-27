"""
Video Transcoding Worker
Processes pending transcoding jobs from the queue.

Run with: python -m app.services.transcoding_worker

Requires FFmpeg to be installed on the system.
"""
import os
import sys
import time
import subprocess
import tempfile
import boto3
from typing import Dict, List, Optional
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.database import execute_single, execute_query

# S3 Configuration
BUCKET_NAME = os.environ.get("AWS_S3_BACKLOT_FILES_BUCKET", "swn-backlot-files-517220555400")
REGION = "us-east-1"

# Quality presets (height, video bitrate, audio bitrate)
QUALITY_PRESETS = {
    "1080p": {"height": 1080, "video_bitrate": "5000k", "audio_bitrate": "192k"},
    "720p": {"height": 720, "video_bitrate": "2500k", "audio_bitrate": "128k"},
    "480p": {"height": 480, "video_bitrate": "1000k", "audio_bitrate": "96k"},
}


def check_ffmpeg() -> bool:
    """Check if FFmpeg is available"""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_pending_job() -> Optional[Dict]:
    """Get the next pending transcoding job"""
    return execute_single(
        """
        UPDATE backlot_transcoding_jobs
        SET status = 'processing', started_at = NOW(), updated_at = NOW()
        WHERE id = (
            SELECT id FROM backlot_transcoding_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, clip_id, project_id, source_key, target_qualities
        """,
        {}
    )


def update_job_progress(job_id: str, progress: int):
    """Update job progress"""
    execute_single(
        """
        UPDATE backlot_transcoding_jobs
        SET progress = :progress, updated_at = NOW()
        WHERE id = :job_id
        """,
        {"job_id": job_id, "progress": progress}
    )


def complete_job(job_id: str, success: bool, error_message: Optional[str] = None):
    """Mark job as complete or failed"""
    status = "completed" if success else "failed"
    execute_single(
        """
        UPDATE backlot_transcoding_jobs
        SET status = :status, completed_at = NOW(), error_message = :error, updated_at = NOW()
        WHERE id = :job_id
        """,
        {"job_id": job_id, "status": status, "error": error_message}
    )


def update_clip_renditions(clip_id: str, renditions: Dict[str, str]):
    """Update clip with new renditions"""
    execute_single(
        """
        UPDATE backlot_dailies_clips
        SET renditions = COALESCE(renditions, '{}'::jsonb) || :renditions::jsonb, updated_at = NOW()
        WHERE id = :clip_id
        """,
        {"clip_id": clip_id, "renditions": renditions}
    )


def transcode_video(input_path: str, output_path: str, quality: str) -> bool:
    """Transcode video to specified quality using FFmpeg"""
    preset = QUALITY_PRESETS.get(quality)
    if not preset:
        print(f"Unknown quality preset: {quality}")
        return False

    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-vf", f"scale=-2:{preset['height']}",
        "-b:v", preset["video_bitrate"],
        "-c:a", "aac",
        "-b:a", preset["audio_bitrate"],
        "-movflags", "+faststart",
        "-y",  # Overwrite output
        output_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)  # 1 hour timeout
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("Transcoding timed out")
        return False
    except Exception as e:
        print(f"Transcoding error: {e}")
        return False


def process_job(job: Dict) -> bool:
    """Process a single transcoding job"""
    job_id = job["id"]
    clip_id = job["clip_id"]
    source_key = job["source_key"]
    qualities = job["target_qualities"]

    print(f"Processing job {job_id} for clip {clip_id}")
    print(f"Source: {source_key}")
    print(f"Target qualities: {qualities}")

    s3_client = boto3.client("s3", region_name=REGION)
    renditions = {}

    with tempfile.TemporaryDirectory() as temp_dir:
        # Download source video
        source_path = os.path.join(temp_dir, "source.mp4")
        print(f"Downloading source from S3...")

        try:
            s3_client.download_file(BUCKET_NAME, source_key, source_path)
        except Exception as e:
            print(f"Failed to download source: {e}")
            complete_job(job_id, False, f"Failed to download source: {str(e)}")
            return False

        # Process each quality
        total_qualities = len(qualities)
        for i, quality in enumerate(qualities):
            print(f"Transcoding to {quality}...")

            # Generate output filename
            source_basename = os.path.splitext(source_key)[0]
            output_key = f"{source_basename}_{quality}.mp4"
            output_path = os.path.join(temp_dir, f"output_{quality}.mp4")

            # Transcode
            if transcode_video(source_path, output_path, quality):
                # Upload to S3
                print(f"Uploading {quality} rendition to S3...")
                try:
                    s3_client.upload_file(
                        output_path,
                        BUCKET_NAME,
                        output_key,
                        ExtraArgs={"ContentType": "video/mp4"}
                    )
                    renditions[quality] = output_key
                    print(f"Uploaded {quality} rendition: {output_key}")
                except Exception as e:
                    print(f"Failed to upload {quality}: {e}")
            else:
                print(f"Failed to transcode to {quality}")

            # Update progress
            progress = int(((i + 1) / total_qualities) * 100)
            update_job_progress(job_id, progress)

    if renditions:
        # Update clip with new renditions
        update_clip_renditions(clip_id, renditions)
        complete_job(job_id, True)
        print(f"Job {job_id} completed successfully. Renditions: {list(renditions.keys())}")
        return True
    else:
        complete_job(job_id, False, "No renditions were created")
        print(f"Job {job_id} failed - no renditions created")
        return False


def run_worker(single_run: bool = False):
    """Run the transcoding worker"""
    print("Starting transcoding worker...")

    if not check_ffmpeg():
        print("ERROR: FFmpeg is not installed or not in PATH")
        print("Please install FFmpeg to use this worker")
        sys.exit(1)

    print("FFmpeg found, worker ready")
    print(f"S3 Bucket: {BUCKET_NAME}")

    while True:
        job = get_pending_job()

        if job:
            try:
                process_job(job)
            except Exception as e:
                print(f"Error processing job: {e}")
                complete_job(job["id"], False, str(e))
        else:
            if single_run:
                print("No pending jobs found")
                break
            # Wait before checking again
            time.sleep(10)

        if single_run:
            break


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Video Transcoding Worker")
    parser.add_argument("--single", action="store_true", help="Process one job and exit")
    args = parser.parse_args()

    run_worker(single_run=args.single)
