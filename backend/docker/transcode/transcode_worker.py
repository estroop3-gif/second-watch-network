"""
Video Transcoding Worker for ECS Fargate
Processes pending transcoding jobs from the database.
"""
import os
import sys
import time
import json
import subprocess
import tempfile
import boto3
import psycopg2

# Environment variables
DB_HOST = os.environ.get('DB_HOST', 'swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com')
DB_NAME = os.environ.get('DB_NAME', 'secondwatchnetwork')
DB_USER = os.environ.get('DB_USER', 'swn_admin')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
BUCKET_NAME = os.environ.get('S3_BUCKET', 'swn-backlot-files-517220555400')
SINGLE_RUN = os.environ.get('SINGLE_RUN', 'false').lower() == 'true'

# Quality presets
QUALITY_PRESETS = {
    "1080p": {"height": 1080, "video_bitrate": "5000k", "audio_bitrate": "192k"},
    "720p": {"height": 720, "video_bitrate": "2500k", "audio_bitrate": "128k"},
    "480p": {"height": 480, "video_bitrate": "1000k", "audio_bitrate": "96k"},
}

s3_client = boto3.client('s3', region_name='us-east-1')


def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode='require'
    )


def get_pending_job():
    """Get and lock the next pending job"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
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
            """)
            row = cur.fetchone()
            conn.commit()
            if row:
                return {
                    'id': str(row[0]),
                    'clip_id': str(row[1]),
                    'project_id': str(row[2]),
                    'source_key': row[3],
                    'target_qualities': row[4]
                }
            return None
    finally:
        conn.close()


def update_job_status(job_id: str, status: str, progress: int = None, error: str = None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if status == 'processing' and progress is not None:
                cur.execute(
                    "UPDATE backlot_transcoding_jobs SET progress = %s, updated_at = NOW() WHERE id = %s",
                    (progress, job_id)
                )
            elif status in ('completed', 'failed'):
                cur.execute(
                    "UPDATE backlot_transcoding_jobs SET status = %s, completed_at = NOW(), error_message = %s, updated_at = NOW() WHERE id = %s",
                    (status, error, job_id)
                )
            conn.commit()
    finally:
        conn.close()


def update_clip_renditions(clip_id: str, renditions: dict):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE backlot_dailies_clips
                SET renditions = COALESCE(renditions, '{}'::jsonb) || %s::jsonb, updated_at = NOW()
                WHERE id = %s
                """,
                (json.dumps(renditions), clip_id)
            )
            conn.commit()
    finally:
        conn.close()


def transcode_video(input_path: str, output_path: str, quality: str) -> bool:
    preset = QUALITY_PRESETS.get(quality)
    if not preset:
        return False

    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-vf', f"scale=-2:{preset['height']}",
        '-b:v', preset['video_bitrate'],
        '-c:a', 'aac',
        '-b:a', preset['audio_bitrate'],
        '-movflags', '+faststart',
        '-y',
        output_path
    ]

    try:
        # No timeout - can handle any video length
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"Transcoding error: {e}")
        return False


def process_job(job: dict) -> bool:
    job_id = job['id']
    clip_id = job['clip_id']
    source_key = job['source_key']
    qualities = job['target_qualities']

    print(f"Processing job {job_id}")
    print(f"  Clip: {clip_id}")
    print(f"  Source: {source_key}")
    print(f"  Qualities: {qualities}")

    renditions = {}

    with tempfile.TemporaryDirectory() as temp_dir:
        source_path = os.path.join(temp_dir, 'source.mp4')
        print("Downloading source from S3...")

        try:
            s3_client.download_file(BUCKET_NAME, source_key, source_path)
            file_size = os.path.getsize(source_path) / (1024 * 1024)
            print(f"Downloaded {file_size:.1f} MB")
        except Exception as e:
            print(f"Download failed: {e}")
            update_job_status(job_id, 'failed', error=str(e))
            return False

        total = len(qualities)
        for i, quality in enumerate(qualities):
            print(f"Transcoding to {quality} ({i+1}/{total})...")

            source_basename = os.path.splitext(source_key)[0]
            output_key = f"{source_basename}_{quality}.mp4"
            output_path = os.path.join(temp_dir, f"output_{quality}.mp4")

            if transcode_video(source_path, output_path, quality):
                print(f"Uploading {quality}...")
                try:
                    s3_client.upload_file(
                        output_path,
                        BUCKET_NAME,
                        output_key,
                        ExtraArgs={'ContentType': 'video/mp4'}
                    )
                    renditions[quality] = output_key
                    print(f"Uploaded: {output_key}")
                    # Clean up to save disk space
                    os.remove(output_path)
                except Exception as e:
                    print(f"Upload failed: {e}")
            else:
                print(f"Transcode failed for {quality}")

            update_job_status(job_id, 'processing', progress=int(((i + 1) / total) * 100))

    if renditions:
        update_clip_renditions(clip_id, renditions)
        update_job_status(job_id, 'completed')
        print(f"Job complete. Renditions: {list(renditions.keys())}")
        return True
    else:
        update_job_status(job_id, 'failed', error='No renditions created')
        print("Job failed - no renditions created")
        return False


def main():
    print("=== Video Transcoding Worker ===")
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Database: {DB_HOST}")
    print(f"Single run: {SINGLE_RUN}")

    # Verify FFmpeg
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True)
        print("FFmpeg: OK")
    except:
        print("ERROR: FFmpeg not found")
        sys.exit(1)

    while True:
        job = get_pending_job()

        if job:
            try:
                process_job(job)
            except Exception as e:
                print(f"Error: {e}")
                update_job_status(job['id'], 'failed', error=str(e))
        else:
            if SINGLE_RUN:
                print("No pending jobs. Exiting.")
                break
            print("No pending jobs. Waiting...")
            time.sleep(30)


if __name__ == '__main__':
    main()
