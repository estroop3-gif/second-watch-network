"""
Overnight Upload Worker - Orchestrates speed test, proxy generation, and upload.

This worker handles the overnight upload workflow:
1. Run speed test to determine optimal proxy resolution
2. Generate proxies for all session files
3. Upload all proxies to Backlot
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from PyQt6.QtCore import QThread, pyqtSignal

from src.services.config import ConfigManager
from src.services.session_manager import SessionManager
from src.services.speed_test import SpeedTestService, SpeedTestResult
from src.services.ffmpeg_encoder import FFmpegEncoder, ProxySettings
from src.services.uploader import UploaderService


@dataclass
class OvernightStats:
    """Statistics from overnight upload workflow."""
    speed_test_mbps: float
    resolution_used: str
    total_files: int
    proxies_generated: int
    proxies_failed: int
    proxies_uploaded: int
    uploads_failed: int
    total_bytes_uploaded: int
    total_duration_seconds: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "speed_test_mbps": round(self.speed_test_mbps, 2),
            "resolution_used": self.resolution_used,
            "total_files": self.total_files,
            "proxies_generated": self.proxies_generated,
            "proxies_failed": self.proxies_failed,
            "proxies_uploaded": self.proxies_uploaded,
            "uploads_failed": self.uploads_failed,
            "total_mb_uploaded": round(self.total_bytes_uploaded / (1024 * 1024), 1),
            "total_duration_minutes": round(self.total_duration_seconds / 60, 1),
        }


class OvernightUploadWorker(QThread):
    """
    Worker thread for overnight upload workflow.

    Orchestrates:
    1. Speed test -> determine proxy resolution
    2. Proxy generation for all session files
    3. Upload all proxies to cloud

    Signals:
        speed_test_started: Emitted when speed test begins
        speed_test_completed(float, str): speed_mbps, resolution
        proxy_started(int): total_files
        proxy_progress(int, int, str): current_idx, total, filename
        proxy_file_completed(str, bool, str): filename, success, error
        upload_started(int): total_proxies
        upload_progress(int, int, str): current_idx, total, filename
        upload_file_completed(str, bool, str): filename, success, error
        status_message(str): Status updates for UI
        workflow_completed(bool, str, dict): success, message, stats
    """

    # Signals
    speed_test_started = pyqtSignal()
    speed_test_completed = pyqtSignal(float, str)  # speed_mbps, resolution

    proxy_started = pyqtSignal(int)  # total_files
    proxy_progress = pyqtSignal(int, int, str)  # current_idx, total, filename
    proxy_file_completed = pyqtSignal(str, bool, str)  # filename, success, error

    upload_started = pyqtSignal(int)  # total_proxies
    upload_progress = pyqtSignal(int, int, str)  # current_idx, total, filename
    upload_file_completed = pyqtSignal(str, bool, str)  # filename, success, error

    status_message = pyqtSignal(str)
    workflow_completed = pyqtSignal(bool, str, dict)  # success, message, stats

    def __init__(
        self,
        session_manager: SessionManager,
        config: ConfigManager,
        parent=None,
    ):
        super().__init__(parent)
        self.session_manager = session_manager
        self.config = config
        self.speed_test_service = SpeedTestService(config)
        self.encoder = FFmpegEncoder()
        self.uploader = UploaderService(config)
        self._cancelled = False
        self._start_time = 0.0

    def cancel(self):
        """Request cancellation of the workflow."""
        self._cancelled = True
        self.status_message.emit("Cancelling overnight upload...")

    def run(self):
        """Execute the overnight upload workflow."""
        import time
        self._start_time = time.time()

        session = self.session_manager.get_active_session()
        if not session:
            self.workflow_completed.emit(False, "No active session", {})
            return

        # Initialize stats
        stats = OvernightStats(
            speed_test_mbps=0,
            resolution_used="1280x720",
            total_files=0,
            proxies_generated=0,
            proxies_failed=0,
            proxies_uploaded=0,
            uploads_failed=0,
            total_bytes_uploaded=0,
            total_duration_seconds=0,
        )

        try:
            # Mark session as uploading
            self.session_manager.start_upload()

            # Phase 1: Speed Test
            self.status_message.emit("Running internet speed test...")
            self.speed_test_started.emit()

            speed_result = self.speed_test_service.run_test()
            stats.speed_test_mbps = speed_result.upload_speed_mbps
            stats.resolution_used = speed_result.recommended_resolution

            self.speed_test_completed.emit(
                speed_result.upload_speed_mbps,
                speed_result.recommended_resolution
            )

            if self._cancelled:
                self._handle_cancel(stats)
                return

            resolution_name = self.speed_test_service.get_resolution_display_name(
                speed_result.recommended_resolution
            )
            self.status_message.emit(
                f"Speed: {speed_result.upload_speed_mbps:.1f} Mbps - Using {resolution_name}"
            )

            # Phase 2: Get all files from session
            self.status_message.emit("Collecting files from session...")
            session_files = self.session_manager.get_all_session_files()
            stats.total_files = len(session_files)

            if not session_files:
                self.session_manager.complete_session(success=True)
                stats.total_duration_seconds = time.time() - self._start_time
                self.workflow_completed.emit(
                    True,
                    "No files to process in session",
                    stats.to_dict()
                )
                return

            # Phase 3: Generate proxies
            self.status_message.emit(f"Generating {len(session_files)} proxies...")
            self.proxy_started.emit(len(session_files))

            # Build proxy settings
            proxy_settings = self._build_proxy_settings(
                speed_result.recommended_resolution,
                session
            )

            # Create proxy output directory
            proxy_dir = self._get_proxy_output_dir(session)

            proxy_paths = []
            for idx, (manifest_id, source_path) in enumerate(session_files):
                if self._cancelled:
                    self._handle_cancel(stats)
                    return

                filename = source_path.name
                self.proxy_progress.emit(idx + 1, len(session_files), filename)

                # Generate proxy
                output_path = proxy_dir / f"{source_path.stem}_proxy.mp4"

                try:
                    success = self.encoder.generate_proxy(
                        input_path=str(source_path),
                        output_path=str(output_path),
                        settings=proxy_settings,
                        progress_callback=None,  # Could add per-file progress
                    )

                    if success and output_path.exists():
                        proxy_paths.append(output_path)
                        stats.proxies_generated += 1
                        self.proxy_file_completed.emit(filename, True, "")
                    else:
                        stats.proxies_failed += 1
                        self.proxy_file_completed.emit(filename, False, "Proxy generation failed")

                except Exception as e:
                    stats.proxies_failed += 1
                    self.proxy_file_completed.emit(filename, False, str(e))

            if self._cancelled:
                self._handle_cancel(stats)
                return

            # Phase 4: Upload proxies
            if not proxy_paths:
                self.session_manager.complete_session(success=False)
                stats.total_duration_seconds = time.time() - self._start_time
                self.workflow_completed.emit(
                    False,
                    "No proxies were generated successfully",
                    stats.to_dict()
                )
                return

            self.status_message.emit(f"Uploading {len(proxy_paths)} proxies...")
            self.upload_started.emit(len(proxy_paths))

            for idx, proxy_path in enumerate(proxy_paths):
                if self._cancelled:
                    self._handle_cancel(stats)
                    return

                filename = proxy_path.name
                self.upload_progress.emit(idx + 1, len(proxy_paths), filename)

                try:
                    # Create upload job and upload
                    file_size = proxy_path.stat().st_size

                    success = self._upload_file(proxy_path, session)

                    if success:
                        stats.proxies_uploaded += 1
                        stats.total_bytes_uploaded += file_size
                        self.upload_file_completed.emit(filename, True, "")
                    else:
                        stats.uploads_failed += 1
                        self.upload_file_completed.emit(filename, False, "Upload failed")

                except Exception as e:
                    stats.uploads_failed += 1
                    self.upload_file_completed.emit(filename, False, str(e))

            # Complete
            stats.total_duration_seconds = time.time() - self._start_time
            self.session_manager.complete_session(success=True)

            message = (
                f"Overnight upload complete: "
                f"{stats.proxies_uploaded}/{stats.total_files} files uploaded"
            )
            self.workflow_completed.emit(True, message, stats.to_dict())

        except Exception as e:
            stats.total_duration_seconds = time.time() - self._start_time
            self.session_manager.complete_session(success=False)
            self.workflow_completed.emit(False, f"Error: {e}", stats.to_dict())

    def _build_proxy_settings(self, resolution: str, session) -> ProxySettings:
        """Build proxy settings with resolution and optional LUT."""
        # Get base settings from config
        config_settings = self.config.get_proxy_settings()

        return ProxySettings(
            resolution=resolution,
            codec=config_settings.get("codec", "libx264"),
            preset=config_settings.get("preset", "fast"),
            bitrate=config_settings.get("bitrate", "10M"),
            lut_path=session.lut_path if session.lut_enabled else None,
        )

    def _get_proxy_output_dir(self, session) -> Path:
        """Get or create proxy output directory for this session."""
        # Store proxies in ~/.swn-dailies-helper/proxies/{session_id}/
        proxy_base = Path.home() / ".swn-dailies-helper" / "proxies" / session.session_id
        proxy_base.mkdir(parents=True, exist_ok=True)
        return proxy_base

    def _upload_file(self, file_path: Path, session) -> bool:
        """Upload a single file to Backlot."""
        try:
            # Get presigned URL
            api_url = self.config.get_api_url() or "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
            api_key = self.config.get_api_key()

            if not api_key:
                return False

            import httpx

            with httpx.Client(timeout=300.0) as client:
                # Request presigned URL
                presign_response = client.post(
                    f"{api_url}/api/v1/backlot/dailies/upload-url",
                    headers={"X-API-Key": api_key},
                    json={
                        "file_name": file_path.name,
                        "file_size": file_path.stat().st_size,
                        "content_type": "video/mp4",
                        "project_id": session.project_id,
                        "production_day_id": session.production_day_id,
                    },
                )

                if presign_response.status_code != 200:
                    return False

                presign_data = presign_response.json()
                upload_url = presign_data.get("upload_url")

                if not upload_url:
                    return False

                # Upload the file
                with open(file_path, "rb") as f:
                    upload_response = client.put(
                        upload_url,
                        content=f.read(),
                        headers={"Content-Type": "video/mp4"},
                    )

                return upload_response.status_code in (200, 201)

        except Exception as e:
            print(f"Upload error: {e}")
            return False

    def _handle_cancel(self, stats: OvernightStats):
        """Handle workflow cancellation."""
        import time
        stats.total_duration_seconds = time.time() - self._start_time
        self.session_manager.complete_session(success=False)
        self.workflow_completed.emit(
            False,
            "Overnight upload cancelled",
            stats.to_dict()
        )
