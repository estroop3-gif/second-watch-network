#!/usr/bin/env python3
"""
Complete Workflow Integration Test

Tests the entire flow from offloading to uploading to Backlot:
1. Simulate offload with "Generate proxies" checkbox checked
2. Upload original to Backlot
3. Transcode to 480p, 720p, 1080p (maintaining vertical aspect ratio)
4. Upload each proxy and register with backend
5. Verify renditions are available via API

Usage:
    python test_complete_workflow.py /path/to/video.mp4
"""
import os
import sys
import json
import time
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

import httpx

# Test configuration
API_BASE = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
TEST_PROJECT_ID = None  # Will be fetched
TEST_VIDEO_PATH = None


def log(msg: str, level: str = "INFO"):
    """Log with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")


def get_api_key() -> str:
    """Get API key from config."""
    config_path = Path.home() / ".swn-dailies-helper" / "config.json"
    if not config_path.exists():
        raise Exception("No config file found. Please configure the desktop helper first.")

    with open(config_path) as f:
        config = json.load(f)

    # Try both key names (app uses _api_key internally)
    api_key = config.get("api_key") or config.get("_api_key")
    if not api_key:
        raise Exception("No API key configured. Please configure in Settings.")

    return api_key


def verify_api_key(api_key: str) -> dict:
    """Verify API key and get projects."""
    log("Verifying API key...")

    response = httpx.post(
        f"{API_BASE}/api/v1/backlot/desktop-keys/verify",
        headers={"X-API-Key": api_key},
        timeout=30.0,
    )

    if response.status_code != 200:
        raise Exception(f"API key verification failed: {response.status_code}")

    data = response.json()
    if not data.get("valid"):
        raise Exception("API key is not valid")

    projects = data.get("projects", [])
    log(f"API key valid. Found {len(projects)} projects.")

    return data


def get_upload_url(api_key: str, project_id: str, filename: str, is_rendition: bool = False,
                   clip_id: str = None, quality: str = None) -> dict:
    """Get presigned URL for upload."""
    payload = {
        "project_id": project_id,
        "file_name": filename,
        "content_type": "video/mp4",
    }

    if is_rendition:
        payload["is_rendition"] = True
        payload["clip_id"] = clip_id
        payload["quality"] = quality

    response = httpx.post(
        f"{API_BASE}/api/v1/backlot/upload-url",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30.0,
    )

    if response.status_code != 200:
        # Try alternate endpoint
        response = httpx.post(
            f"{API_BASE}/api/v1/backlot/dailies/upload-url",
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )

    if response.status_code != 200:
        raise Exception(f"Failed to get upload URL: {response.status_code} - {response.text}")

    return response.json()


def upload_to_s3(upload_url: str, file_path: Path):
    """Upload file to S3 using presigned URL."""
    file_size = file_path.stat().st_size
    log(f"Uploading {file_path.name} ({file_size / 1024 / 1024:.2f} MB)...")

    with open(file_path, "rb") as f:
        response = httpx.put(
            upload_url,
            content=f.read(),
            headers={"Content-Type": "video/mp4"},
            timeout=600.0,
        )

    if response.status_code not in (200, 204):
        raise Exception(f"S3 upload failed: {response.status_code}")

    log(f"Upload complete: {file_path.name}")


def create_clip(api_key: str, project_id: str, s3_key: str, filename: str,
                production_day_id: str = None) -> dict:
    """Create a clip record in the database using desktop-keys endpoint."""
    log(f"Creating clip record for {filename}...")

    # Use the desktop-keys register-clips endpoint
    payload = {
        "project_id": project_id,
        "cards": [
            {
                "camera_label": "TEST",
                "clips": [
                    {
                        "s3_key": s3_key,
                        "file_name": filename,
                    }
                ]
            }
        ]
    }

    response = httpx.post(
        f"{API_BASE}/api/v1/backlot/desktop-keys/dailies/register-clips",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30.0,
    )

    if response.status_code not in (200, 201):
        raise Exception(f"Failed to create clip: {response.status_code} - {response.text}")

    result = response.json()
    clip_ids = result.get("clip_ids", [])
    if not clip_ids:
        raise Exception("No clip ID returned")

    clip_id = clip_ids[0]
    log(f"Clip created with ID: {clip_id}")
    return {"id": clip_id}


def register_rendition(api_key: str, clip_id: str, quality: str, s3_key: str, size: int) -> dict:
    """Register a rendition with the backend."""
    log(f"Registering {quality} rendition for clip {clip_id}...")

    response = httpx.post(
        f"{API_BASE}/api/v1/backlot/dailies/clips/{clip_id}/renditions",
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "quality": quality,
            "s3_key": s3_key,
            "size": size,
        },
        timeout=30.0,
    )

    if response.status_code not in (200, 201):
        raise Exception(f"Failed to register rendition: {response.status_code} - {response.text}")

    result = response.json()
    log(f"Rendition registered: {quality}")
    return result


def get_stream_url(api_key: str, clip_id: str, quality: str = "auto") -> dict:
    """Get streaming URL for a clip."""
    response = httpx.get(
        f"{API_BASE}/api/v1/backlot/dailies/clips/{clip_id}/stream-url",
        params={"quality": quality},
        headers={"X-API-Key": api_key},
        timeout=30.0,
    )

    if response.status_code != 200:
        raise Exception(f"Failed to get stream URL: {response.status_code}")

    return response.json()


def test_proxy_transcoder(video_path: Path, output_dir: Path) -> dict:
    """Test the proxy transcoder with a video file."""
    log("=" * 60)
    log("TESTING PROXY TRANSCODER")
    log("=" * 60)

    from src.services.ffmpeg_encoder import FFmpegEncoder, ProxySettings

    encoder = FFmpegEncoder()

    if not encoder.available:
        raise Exception("FFmpeg not available!")

    log(f"FFmpeg path: {encoder.ffmpeg_path}")
    log(f"FFprobe path: {encoder.ffprobe_path}")

    # Get source video info
    info = encoder.get_media_info(str(video_path))

    if not info:
        raise Exception("Failed to get video info")

    # Extract video dimensions
    video_stream = None
    for stream in info.get("streams", []):
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if not video_stream:
        raise Exception("No video stream found")

    source_width = video_stream.get("width", 0)
    source_height = video_stream.get("height", 0)
    source_aspect = source_width / source_height if source_height > 0 else 1

    log(f"Source: {source_width}x{source_height} (aspect: {source_aspect:.3f})")
    log(f"Vertical video: {source_aspect < 1}")

    results = {}

    # Quality presets matching proxy_transcoder.py
    QUALITY_PRESETS = {
        "480p": {"max_width": 854, "max_height": 480, "bitrate": "1000k", "audio": "96k"},
        "720p": {"max_width": 1280, "max_height": 720, "bitrate": "2500k", "audio": "128k"},
        "1080p": {"max_width": 1920, "max_height": 1080, "bitrate": "5000k", "audio": "192k"},
    }

    for quality, preset in QUALITY_PRESETS.items():
        log(f"\n--- Transcoding to {quality} ---")

        max_w = preset["max_width"]
        max_h = preset["max_height"]

        # Calculate output dimensions maintaining aspect ratio
        if source_aspect > 1:
            # Horizontal video - constrain by height
            out_height = min(source_height, max_h)
            out_width = int(out_height * source_aspect)
            out_width = out_width - (out_width % 2)
        else:
            # Vertical video - constrain by the shorter dimension
            out_width = min(source_width, max_h)
            out_height = int(out_width / source_aspect)
            out_width = out_width - (out_width % 2)
            out_height = out_height - (out_height % 2)

        resolution = f"{out_width}x{out_height}"
        log(f"Target resolution: {resolution}")

        output_path = output_dir / f"test_{quality}.mp4"

        settings = ProxySettings(
            resolution=resolution,
            bitrate=preset["bitrate"],
            audio_bitrate=preset["audio"],
            codec="libx264",
            preset="fast",
            pixel_format="yuv420p",
        )

        start_time = time.time()

        def on_progress(p):
            pct = int(p * 100)
            if pct % 25 == 0:
                log(f"  Progress: {pct}%")

        success = encoder.generate_proxy(
            str(video_path),
            str(output_path),
            settings,
            on_progress,
        )

        elapsed = time.time() - start_time

        if success and output_path.exists():
            file_size = output_path.stat().st_size
            log(f"  SUCCESS: {file_size / 1024:.1f} KB in {elapsed:.1f}s")

            # Verify output dimensions
            output_info = encoder.get_media_info(str(output_path))
            if output_info:
                for stream in output_info.get("streams", []):
                    if stream.get("codec_type") == "video":
                        actual_w = stream.get("width", 0)
                        actual_h = stream.get("height", 0)
                        log(f"  Output: {actual_w}x{actual_h}")

                        # Verify aspect ratio is maintained
                        output_aspect = actual_w / actual_h if actual_h > 0 else 1
                        aspect_diff = abs(source_aspect - output_aspect)
                        if aspect_diff > 0.1:
                            log(f"  WARNING: Aspect ratio changed from {source_aspect:.3f} to {output_aspect:.3f}", "WARN")
                        else:
                            log(f"  Aspect ratio maintained: {output_aspect:.3f}")
                        break

            results[quality] = {
                "success": True,
                "path": output_path,
                "size": file_size,
                "resolution": resolution,
            }
        else:
            log(f"  FAILED after {elapsed:.1f}s", "ERROR")
            results[quality] = {"success": False}

    return results


def test_full_upload_flow(api_key: str, project_id: str, video_path: Path, proxies: dict) -> dict:
    """Test the full upload flow."""
    log("\n" + "=" * 60)
    log("TESTING FULL UPLOAD FLOW")
    log("=" * 60)

    results = {
        "original_uploaded": False,
        "clip_created": False,
        "renditions_registered": {},
        "stream_urls": {},
    }

    # 1. Get upload URL for original
    log("\n1. Uploading original video...")
    filename = video_path.name

    try:
        upload_info = get_upload_url(api_key, project_id, filename)
        upload_url = upload_info.get("upload_url")
        s3_key = upload_info.get("key")

        if not upload_url:
            raise Exception("No upload URL returned")

        log(f"   S3 key: {s3_key}")

        # Upload to S3
        upload_to_s3(upload_url, video_path)
        results["original_uploaded"] = True
        results["s3_key"] = s3_key

    except Exception as e:
        log(f"   FAILED: {e}", "ERROR")
        return results

    # 2. Create clip record
    log("\n2. Creating clip record...")
    try:
        clip = create_clip(api_key, project_id, s3_key, filename)
        clip_id = clip.get("id")
        if not clip_id:
            raise Exception("No clip ID returned")

        results["clip_created"] = True
        results["clip_id"] = clip_id

    except Exception as e:
        log(f"   FAILED: {e}", "ERROR")
        return results

    # 3. Upload and register each proxy
    log("\n3. Uploading and registering proxies...")
    for quality, proxy_info in proxies.items():
        if not proxy_info.get("success"):
            log(f"   Skipping {quality} (transcoding failed)")
            continue

        proxy_path = proxy_info["path"]

        try:
            # Get upload URL for rendition
            rendition_upload = get_upload_url(
                api_key, project_id,
                f"{video_path.stem}_{quality}.mp4",
                is_rendition=True,
                clip_id=clip_id,
                quality=quality,
            )

            rendition_url = rendition_upload.get("upload_url")
            rendition_key = rendition_upload.get("key")

            # Upload proxy
            upload_to_s3(rendition_url, proxy_path)

            # Register rendition
            register_rendition(
                api_key, clip_id, quality,
                rendition_key, proxy_info["size"]
            )

            results["renditions_registered"][quality] = True

        except Exception as e:
            log(f"   FAILED {quality}: {e}", "ERROR")
            results["renditions_registered"][quality] = False

    # 4. Verify stream URLs work
    log("\n4. Verifying stream URLs...")
    for quality in ["original", "480p", "720p", "1080p", "auto"]:
        try:
            stream_info = get_stream_url(api_key, clip_id, quality)
            url = stream_info.get("url")
            actual_quality = stream_info.get("quality", "unknown")
            available = stream_info.get("available_renditions", [])

            log(f"   {quality}: OK (serving: {actual_quality}, available: {available})")
            results["stream_urls"][quality] = True

        except Exception as e:
            log(f"   {quality}: FAILED - {e}", "ERROR")
            results["stream_urls"][quality] = False

    return results


def run_checkbox_tests():
    """Test that checkbox options work correctly."""
    log("\n" + "=" * 60)
    log("TESTING CHECKBOX OPTIONS")
    log("=" * 60)

    tests = {
        "verify_checksum": "Verify checksums - ensures file integrity during copy",
        "generate_proxy": "Generate proxies - creates 480p/720p/1080p after upload",
        "upload_cloud": "Upload to cloud - queues files for Backlot upload",
        "create_footage_asset": "Create footage asset - registers in asset library",
    }

    log("\nCheckbox functionality verified in code:")

    # Read offload_page.py and verify checkboxes
    offload_page = Path(__file__).parent / "src" / "ui" / "pages" / "offload_page.py"

    if offload_page.exists():
        content = offload_page.read_text()

        for checkbox, description in tests.items():
            # Check if checkbox exists in code
            if f"self.{checkbox}" in content:
                log(f"  [OK] {checkbox}: {description}")
            else:
                log(f"  [MISSING] {checkbox}", "ERROR")
    else:
        log("  Cannot verify - offload_page.py not found", "WARN")

    # Verify integration points
    log("\nIntegration verification:")

    # Check upload_queue integration
    upload_queue = Path(__file__).parent / "src" / "services" / "upload_queue.py"
    if upload_queue.exists():
        content = upload_queue.read_text()
        if "generate_proxies" in content:
            log("  [OK] generate_proxies flag in UploadQueueItem")
        if "_queue_for_proxy_transcoding" in content:
            log("  [OK] Proxy transcoding trigger on upload complete")

    # Check proxy_transcoder
    proxy_transcoder = Path(__file__).parent / "src" / "services" / "proxy_transcoder.py"
    if proxy_transcoder.exists():
        content = proxy_transcoder.read_text()
        if "QUALITY_PRESETS" in content:
            log("  [OK] Quality presets defined (480p, 720p, 1080p)")
        if "source_aspect" in content:
            log("  [OK] Aspect ratio handling for vertical videos")


def main():
    """Run complete workflow test."""
    if len(sys.argv) < 2:
        print("Usage: python test_complete_workflow.py /path/to/video.mp4")
        print("\nThis script tests the complete offload-to-upload workflow.")
        sys.exit(1)

    video_path = Path(sys.argv[1])

    if not video_path.exists():
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)

    log("=" * 60)
    log("COMPLETE WORKFLOW INTEGRATION TEST")
    log("=" * 60)
    log(f"Video: {video_path}")
    log(f"Size: {video_path.stat().st_size / 1024 / 1024:.2f} MB")

    # Create temp directory for proxies
    temp_dir = Path(tempfile.mkdtemp(prefix="swn_test_"))
    log(f"Temp dir: {temp_dir}")

    try:
        # Get API key
        api_key = get_api_key()

        # Verify and get projects
        verify_result = verify_api_key(api_key)
        projects = verify_result.get("projects", [])

        if not projects:
            raise Exception("No projects available")

        # Use first project for testing
        project = projects[0]
        project_id = project.get("id")
        log(f"Using project: {project.get('name')} ({project_id})")

        # Run checkbox tests
        run_checkbox_tests()

        # Test proxy transcoder
        proxy_results = test_proxy_transcoder(video_path, temp_dir)

        # Count successes
        success_count = sum(1 for r in proxy_results.values() if r.get("success"))
        log(f"\nProxy transcoding: {success_count}/3 successful")

        # Test full upload flow
        upload_results = test_full_upload_flow(api_key, project_id, video_path, proxy_results)

        # Summary
        log("\n" + "=" * 60)
        log("TEST SUMMARY")
        log("=" * 60)
        log(f"Original uploaded: {upload_results.get('original_uploaded')}")
        log(f"Clip created: {upload_results.get('clip_created')}")
        log(f"Clip ID: {upload_results.get('clip_id', 'N/A')}")
        log(f"Renditions registered: {upload_results.get('renditions_registered')}")
        log(f"Stream URLs working: {upload_results.get('stream_urls')}")

        if upload_results.get("clip_id"):
            log(f"\nView clip at: https://www.secondwatchnetwork.com/backlot/dailies/{upload_results['clip_id']}")

        # Overall result
        all_passed = (
            upload_results.get("original_uploaded") and
            upload_results.get("clip_created") and
            all(upload_results.get("renditions_registered", {}).values()) and
            all(upload_results.get("stream_urls", {}).values())
        )

        log("\n" + ("=" * 60))
        if all_passed:
            log("ALL TESTS PASSED!")
        else:
            log("SOME TESTS FAILED - see details above", "ERROR")
        log("=" * 60)

    finally:
        # Cleanup
        log(f"\nCleaning up temp directory: {temp_dir}")
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
