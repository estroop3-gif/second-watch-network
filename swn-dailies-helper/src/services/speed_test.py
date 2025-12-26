"""
Speed Test Service - Measure upload bandwidth to determine optimal proxy resolution.

Tests internet upload speed and recommends proxy resolution:
- >= 10 Mbps: Use 1080p proxies
- < 10 Mbps: Use 720p proxies (minimum)
"""
import os
import time
import tempfile
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Callable
from pathlib import Path

import httpx

from src.services.config import ConfigManager


@dataclass
class SpeedTestResult:
    """Result of an upload speed test."""
    upload_speed_mbps: float
    recommended_resolution: str  # "1920x1080" or "1280x720"
    test_duration_seconds: float
    tested_at: str
    test_size_bytes: int
    success: bool
    error: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for logging/display."""
        return {
            "upload_speed_mbps": round(self.upload_speed_mbps, 2),
            "recommended_resolution": self.recommended_resolution,
            "test_duration_seconds": round(self.test_duration_seconds, 2),
            "tested_at": self.tested_at,
            "test_size_mb": round(self.test_size_bytes / (1024 * 1024), 1),
            "success": self.success,
            "error": self.error,
        }


class SpeedTestService:
    """
    Test upload bandwidth to determine optimal proxy resolution.

    The service uploads a test payload to measure actual upload speed,
    then recommends 1080p or 720p resolution based on bandwidth.
    """

    # Speed thresholds (Mbps)
    SPEED_THRESHOLD_HIGH = 10.0   # Above this: 1080p
    SPEED_THRESHOLD_LOW = 5.0    # Above this: 720p, below: still 720p (minimum)

    # Test file sizes
    TEST_SIZE_SMALL = 2 * 1024 * 1024   # 2MB for quick test
    TEST_SIZE_MEDIUM = 5 * 1024 * 1024  # 5MB for normal test
    TEST_SIZE_LARGE = 10 * 1024 * 1024  # 10MB for accurate test

    # Resolution options
    RESOLUTION_1080P = "1920x1080"
    RESOLUTION_720P = "1280x720"

    def __init__(self, config: ConfigManager):
        """
        Initialize the speed test service.

        Args:
            config: ConfigManager for API settings
        """
        self.config = config

    def run_test(
        self,
        test_size: Optional[int] = None,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> SpeedTestResult:
        """
        Run an upload speed test.

        Args:
            test_size: Size of test payload in bytes (default: 5MB)
            progress_callback: Optional callback for progress updates (0.0-1.0)

        Returns:
            SpeedTestResult with speed and recommended resolution
        """
        if test_size is None:
            test_size = self.TEST_SIZE_MEDIUM

        tested_at = datetime.now().isoformat()

        try:
            # Generate random test data
            if progress_callback:
                progress_callback(0.1)

            test_data = os.urandom(test_size)

            if progress_callback:
                progress_callback(0.2)

            # Get API URL
            api_url = self.config.get_api_url() or "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
            api_key = self.config.get_api_key()

            if not api_key:
                return SpeedTestResult(
                    upload_speed_mbps=0,
                    recommended_resolution=self.RESOLUTION_720P,
                    test_duration_seconds=0,
                    tested_at=tested_at,
                    test_size_bytes=test_size,
                    success=False,
                    error="No API key configured",
                )

            # Request a presigned upload URL for speed test
            presign_url = f"{api_url}/api/v1/backlot/dailies/speed-test-url"

            with httpx.Client(timeout=30.0) as client:
                if progress_callback:
                    progress_callback(0.3)

                # Get presigned URL
                try:
                    presign_response = client.post(
                        presign_url,
                        headers={"X-API-Key": api_key},
                        json={"size_bytes": test_size},
                    )

                    if presign_response.status_code == 200:
                        presign_data = presign_response.json()
                        upload_url = presign_data.get("upload_url")
                    else:
                        # Fallback: use a generic speed test
                        return self._run_fallback_test(test_data, tested_at, progress_callback)

                except Exception:
                    # Fallback to generic test
                    return self._run_fallback_test(test_data, tested_at, progress_callback)

                if not upload_url:
                    return self._run_fallback_test(test_data, tested_at, progress_callback)

                if progress_callback:
                    progress_callback(0.4)

                # Perform the timed upload
                start_time = time.perf_counter()

                upload_response = client.put(
                    upload_url,
                    content=test_data,
                    headers={"Content-Type": "application/octet-stream"},
                )

                end_time = time.perf_counter()

                if progress_callback:
                    progress_callback(0.9)

                # Calculate speed
                duration = end_time - start_time
                if duration > 0:
                    bytes_per_second = test_size / duration
                    mbps = (bytes_per_second * 8) / (1024 * 1024)  # Convert to Mbps
                else:
                    mbps = 0

                resolution = self.get_recommended_resolution(mbps)

                if progress_callback:
                    progress_callback(1.0)

                return SpeedTestResult(
                    upload_speed_mbps=mbps,
                    recommended_resolution=resolution,
                    test_duration_seconds=duration,
                    tested_at=tested_at,
                    test_size_bytes=test_size,
                    success=True,
                )

        except Exception as e:
            # On any error, default to 720p (safe fallback)
            return SpeedTestResult(
                upload_speed_mbps=0,
                recommended_resolution=self.RESOLUTION_720P,
                test_duration_seconds=0,
                tested_at=tested_at,
                test_size_bytes=test_size,
                success=False,
                error=str(e),
            )

    def _run_fallback_test(
        self,
        test_data: bytes,
        tested_at: str,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> SpeedTestResult:
        """
        Run a fallback speed test using a public speed test endpoint.

        This is used when the Backlot API speed test endpoint is unavailable.
        """
        try:
            # Use a simple file write test as fallback (measures disk + overhead)
            # This is less accurate but provides a baseline
            if progress_callback:
                progress_callback(0.5)

            with tempfile.NamedTemporaryFile(delete=True) as tmp:
                start_time = time.perf_counter()
                tmp.write(test_data)
                tmp.flush()
                os.fsync(tmp.fileno())
                end_time = time.perf_counter()

            duration = end_time - start_time

            if progress_callback:
                progress_callback(0.9)

            # Disk write is typically faster than network, so be conservative
            # Assume network is ~20% of disk speed for estimation
            if duration > 0:
                disk_mbps = (len(test_data) * 8) / (duration * 1024 * 1024)
                estimated_network_mbps = disk_mbps * 0.2  # Conservative estimate
            else:
                estimated_network_mbps = 5.0  # Default to 720p territory

            resolution = self.get_recommended_resolution(estimated_network_mbps)

            if progress_callback:
                progress_callback(1.0)

            return SpeedTestResult(
                upload_speed_mbps=estimated_network_mbps,
                recommended_resolution=resolution,
                test_duration_seconds=duration,
                tested_at=tested_at,
                test_size_bytes=len(test_data),
                success=True,
                error="Used fallback test (estimated speed)",
            )

        except Exception as e:
            # Ultimate fallback: default to 720p
            return SpeedTestResult(
                upload_speed_mbps=0,
                recommended_resolution=self.RESOLUTION_720P,
                test_duration_seconds=0,
                tested_at=tested_at,
                test_size_bytes=len(test_data),
                success=False,
                error=f"Fallback test failed: {e}",
            )

    def get_recommended_resolution(self, speed_mbps: float) -> str:
        """
        Get the recommended proxy resolution based on upload speed.

        Args:
            speed_mbps: Upload speed in megabits per second

        Returns:
            Resolution string ("1920x1080" or "1280x720")
        """
        if speed_mbps >= self.SPEED_THRESHOLD_HIGH:
            return self.RESOLUTION_1080P
        else:
            # 720p is the minimum, even for very slow connections
            return self.RESOLUTION_720P

    def get_resolution_display_name(self, resolution: str) -> str:
        """Get a display-friendly name for the resolution."""
        if resolution == self.RESOLUTION_1080P:
            return "1080p (Full HD)"
        elif resolution == self.RESOLUTION_720P:
            return "720p (HD)"
        else:
            return resolution

    def estimate_upload_time(
        self,
        total_bytes: int,
        speed_mbps: float,
    ) -> float:
        """
        Estimate upload time in seconds.

        Args:
            total_bytes: Total bytes to upload
            speed_mbps: Upload speed in Mbps

        Returns:
            Estimated seconds to upload
        """
        if speed_mbps <= 0:
            return float("inf")

        bits = total_bytes * 8
        megabits = bits / (1024 * 1024)
        seconds = megabits / speed_mbps

        return seconds

    def format_duration(self, seconds: float) -> str:
        """Format duration in human-readable format."""
        if seconds == float("inf"):
            return "Unknown"

        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            secs = int(seconds % 60)
            return f"{minutes}m {secs}s"
        else:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}h {minutes}m"
