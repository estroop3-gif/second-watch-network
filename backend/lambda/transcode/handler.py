"""
AWS Lambda function for video transcoding using FFmpeg.

This function:
1. Receives a transcoding job from the queue
2. Downloads the source video from S3
3. Transcodes to requested qualities using FFmpeg
4. Uploads renditions back to S3
5. Updates the database with rendition paths

Requires:
- FFmpeg Lambda Layer
- S3 read/write permissions
- Database connection (via environment variables)
"""
import os
import json
import subprocess
import boto3
import tempfile
import psycopg2
from urllib.parse import unquote_plus

# Environment variables
DB_HOST = os.environ.get('DB_HOST')
DB_NAME = os.environ.get('DB_NAME')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
BUCKET_NAME = os.environ.get('S3_BUCKET', 'swn-backlot-files-517220555400')

# Quality presets
QUALITY_PRESETS = {
    "1080p": {"height": 1080, "video_bitrate": "5000k", "audio_bitrate": "192k"},
    "720p": {"height": 720, "video_bitrate": "2500k", "audio_bitrate": "128k"},
    "480p": {"height": 480, "video_bitrate": "1000k", "audio_bitrate": "96k"},
}

s3_client = boto3.client('s3')


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode='require'
    )


def update_job_status(job_id: str, status: str, progress: int = None, error: str = None):
    """Update transcoding job status in database"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if status == 'processing':
                cur.execute(
                    "UPDATE backlot_transcoding_jobs SET status = %s, started_at = NOW(), updated_at = NOW() WHERE id = %s",
                    (status, job_id)
                )
            elif status in ('completed', 'failed'):
                cur.execute(
                    "UPDATE backlot_transcoding_jobs SET status = %s, completed_at = NOW(), error_message = %s, updated_at = NOW() WHERE id = %s",
                    (status, error, job_id)
                )
            if progress is not None:
                cur.execute(
                    "UPDATE backlot_transcoding_jobs SET progress = %s, updated_at = NOW() WHERE id = %s",
                    (progress, job_id)
                )
            conn.commit()
    finally:
        conn.close()


def update_clip_renditions(clip_id: str, renditions: dict):
    """Update clip with new renditions"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Merge new renditions with existing
            cur.execute(
                """
                UPDATE backlot_dailies_clips
                SET renditions = COALESCE(renditions, '{}'::jsonb) || %s::jsonb,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (json.dumps(renditions), clip_id)
            )
            conn.commit()
    finally:
        conn.close()


def transcode_video(input_path: str, output_path: str, quality: str) -> bool:
    """Transcode video to specified quality using FFmpeg"""
    preset = QUALITY_PRESETS.get(quality)
    if not preset:
        print(f"Unknown quality preset: {quality}")
        return False

    # FFmpeg binary location in Lambda layer
    ffmpeg_path = '/opt/bin/ffmpeg'
    if not os.path.exists(ffmpeg_path):
        ffmpeg_path = 'ffmpeg'  # Fallback to PATH

    cmd = [
        ffmpeg_path,
        '-i', input_path,
        '-c:v', 'libx264',
        '-preset', 'fast',  # Use 'fast' for Lambda speed
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
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=840  # 14 minutes (Lambda max is 15)
        )
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


def process_job(job: dict) -> dict:
    """Process a single transcoding job"""
    job_id = job['id']
    clip_id = job['clip_id']
    source_key = job['source_key']
    qualities = job['target_qualities']

    print(f"Processing job {job_id} for clip {clip_id}")
    print(f"Source: {source_key}")
    print(f"Target qualities: {qualities}")

    update_job_status(job_id, 'processing')
    renditions = {}

    with tempfile.TemporaryDirectory() as temp_dir:
        # Download source video
        source_path = os.path.join(temp_dir, 'source.mp4')
        print(f"Downloading source from S3: {source_key}")

        try:
            s3_client.download_file(BUCKET_NAME, source_key, source_path)
        except Exception as e:
            error_msg = f"Failed to download source: {str(e)}"
            print(error_msg)
            update_job_status(job_id, 'failed', error=error_msg)
            return {'success': False, 'error': error_msg}

        # Process each quality
        total_qualities = len(qualities)
        for i, quality in enumerate(qualities):
            print(f"Transcoding to {quality}...")

            # Generate output filename
            source_basename = os.path.splitext(source_key)[0]
            output_key = f"{source_basename}_{quality}.mp4"
            output_path = os.path.join(temp_dir, f"output_{quality}.mp4")

            if transcode_video(source_path, output_path, quality):
                # Upload to S3
                print(f"Uploading {quality} rendition to S3...")
                try:
                    s3_client.upload_file(
                        output_path,
                        BUCKET_NAME,
                        output_key,
                        ExtraArgs={'ContentType': 'video/mp4'}
                    )
                    renditions[quality] = output_key
                    print(f"Uploaded {quality} rendition: {output_key}")
                except Exception as e:
                    print(f"Failed to upload {quality}: {e}")
            else:
                print(f"Failed to transcode to {quality}")

            # Update progress
            progress = int(((i + 1) / total_qualities) * 100)
            update_job_status(job_id, 'processing', progress=progress)

    if renditions:
        update_clip_renditions(clip_id, renditions)
        update_job_status(job_id, 'completed')
        print(f"Job {job_id} completed. Renditions: {list(renditions.keys())}")
        return {'success': True, 'renditions': renditions}
    else:
        update_job_status(job_id, 'failed', error='No renditions were created')
        return {'success': False, 'error': 'No renditions were created'}


def lambda_handler(event, context):
    """
    Lambda entry point.

    Can be triggered by:
    1. Direct invocation with job details
    2. SQS queue message
    3. API Gateway (for manual triggers)
    """
    print(f"Event: {json.dumps(event)}")

    # Handle SQS trigger
    if 'Records' in event:
        results = []
        for record in event['Records']:
            if record.get('eventSource') == 'aws:sqs':
                job = json.loads(record['body'])
                result = process_job(job)
                results.append(result)
        return {'statusCode': 200, 'body': json.dumps(results)}

    # Handle direct invocation with job details
    if 'id' in event and 'clip_id' in event:
        result = process_job(event)
        return {'statusCode': 200, 'body': json.dumps(result)}

    # Handle API Gateway trigger to process pending jobs
    if event.get('httpMethod') or event.get('requestContext'):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                # Get next pending job
                cur.execute("""
                    UPDATE backlot_transcoding_jobs
                    SET status = 'processing', started_at = NOW()
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
                    job = {
                        'id': str(row[0]),
                        'clip_id': str(row[1]),
                        'project_id': str(row[2]),
                        'source_key': row[3],
                        'target_qualities': row[4]
                    }
                    result = process_job(job)
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json'},
                        'body': json.dumps(result)
                    }
                else:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json'},
                        'body': json.dumps({'message': 'No pending jobs'})
                    }
        finally:
            conn.close()

    return {
        'statusCode': 400,
        'body': json.dumps({'error': 'Invalid event format'})
    }
