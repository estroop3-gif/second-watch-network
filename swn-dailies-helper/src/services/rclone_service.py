"""
rclone service for robust file uploads with checksum verification.
Uses bundled rclone binaries - no external installation required.
"""
import asyncio
import json
import os
import platform
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional, Tuple
from datetime import datetime
import uuid


@dataclass
class RcloneConfig:
    """rclone backend configuration."""
    backend_type: Literal["s3", "gdrive", "dropbox", "local", "sftp"]
    remote_name: str  # e.g., "swn-s3", "my-gdrive"
    bucket_or_path: str

    # S3-specific
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    region: str = "us-east-1"
    endpoint: Optional[str] = None  # For S3-compatible services

    # Auth for other backends
    token_path: Optional[Path] = None

    # General settings
    bandwidth_limit: Optional[str] = None  # e.g., "50M" for 50 MB/s

    def to_rclone_config(self) -> str:
        """Generate rclone config file content for this remote."""
        lines = [f"[{self.remote_name}]"]

        if self.backend_type == "s3":
            lines.append("type = s3")
            lines.append("provider = AWS")
            if self.access_key_id:
                lines.append(f"access_key_id = {self.access_key_id}")
            if self.secret_access_key:
                lines.append(f"secret_access_key = {self.secret_access_key}")
            lines.append(f"region = {self.region}")
            if self.endpoint:
                lines.append(f"endpoint = {self.endpoint}")
        elif self.backend_type == "gdrive":
            lines.append("type = drive")
            if self.token_path:
                lines.append(f"token = {self.token_path}")
        elif self.backend_type == "dropbox":
            lines.append("type = dropbox")
            if self.token_path:
                lines.append(f"token = {self.token_path}")
        elif self.backend_type == "sftp":
            lines.append("type = sftp")
        elif self.backend_type == "local":
            lines.append("type = local")

        return "\n".join(lines)


@dataclass
class UploadResult:
    """Result of an upload operation."""
    success: bool
    local_path: Path
    remote_path: str
    local_checksum: Optional[str] = None
    remote_checksum: Optional[str] = None
    checksum_verified: bool = False
    bytes_transferred: int = 0
    duration_seconds: float = 0.0
    error_message: Optional[str] = None
    resumed: bool = False


@dataclass
class UploadProgress:
    """Progress update during upload."""
    file_name: str
    bytes_transferred: int
    total_bytes: int
    percent: float
    speed_bytes_per_sec: float
    eta_seconds: Optional[float] = None


def get_rclone_binary() -> Path:
    """Get the bundled rclone binary for current platform."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    # Normalize architecture names
    if machine in ('x86_64', 'amd64'):
        arch = 'amd64'
    elif machine in ('arm64', 'aarch64'):
        arch = 'arm64'
    else:
        arch = machine

    # Build binary name
    if system == 'darwin':
        binary_name = f"rclone-darwin-{arch}"
    elif system == 'windows':
        binary_name = f"rclone-windows-{arch}.exe"
    elif system == 'linux':
        binary_name = f"rclone-linux-{arch}"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")

    # Find binary relative to app
    if getattr(sys, 'frozen', False):
        # Running as compiled app (PyInstaller)
        base_path = Path(sys._MEIPASS)
    else:
        # Running from source
        base_path = Path(__file__).parent.parent.parent

    binary_path = base_path / "bin" / "rclone" / binary_name

    if not binary_path.exists():
        raise FileNotFoundError(
            f"rclone binary not found: {binary_path}\n"
            f"Run 'python scripts/download_rclone.py' to download binaries."
        )

    # Ensure executable on Unix
    if system != 'windows':
        binary_path.chmod(0o755)

    return binary_path


class RcloneService:
    """Wrapper for bundled rclone binary with async upload support."""

    def __init__(self, config: Optional[RcloneConfig] = None):
        self.config = config
        self.binary_path = get_rclone_binary()
        self.config_dir = self._get_config_dir()
        self.config_path = self.config_dir / "rclone.conf"

        # Ensure config directory exists
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # Setup remote if config provided
        if config:
            self._setup_remote(config)

    def _get_config_dir(self) -> Path:
        """Get the rclone config directory."""
        home = Path.home()
        return home / ".swn-dailies-helper" / "rclone"

    def _setup_remote(self, config: RcloneConfig):
        """Write rclone config file for the remote."""
        config_content = config.to_rclone_config()

        # Read existing config if exists
        existing_config = ""
        if self.config_path.exists():
            existing_config = self.config_path.read_text()

        # Check if remote already defined
        remote_pattern = rf"\[{config.remote_name}\]"
        if re.search(remote_pattern, existing_config):
            # Replace existing remote config
            # Find and replace the section
            pattern = rf"\[{config.remote_name}\][^\[]*"
            existing_config = re.sub(pattern, config_content + "\n\n", existing_config)
            self.config_path.write_text(existing_config)
        else:
            # Append new remote
            with open(self.config_path, "a") as f:
                if existing_config and not existing_config.endswith("\n"):
                    f.write("\n")
                f.write(config_content + "\n\n")

    def _run_rclone(
        self,
        args: List[str],
        capture_output: bool = True,
        **kwargs
    ) -> subprocess.CompletedProcess:
        """Run rclone command synchronously."""
        cmd = [str(self.binary_path), "--config", str(self.config_path)] + args

        if capture_output:
            return subprocess.run(cmd, capture_output=True, text=True, **kwargs)
        else:
            return subprocess.run(cmd, **kwargs)

    async def _run_rclone_async(
        self,
        args: List[str],
        progress_callback: Optional[Callable[[UploadProgress], None]] = None,
    ) -> Tuple[int, str, str]:
        """Run rclone with async progress streaming."""
        cmd = [
            str(self.binary_path),
            "--config", str(self.config_path),
        ] + args + [
            "--progress",
            "--stats", "1s",
            "--stats-one-line",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout_lines = []
        stderr_lines = []

        async def read_stream(stream, lines_list, is_stderr=False):
            while True:
                line = await stream.readline()
                if not line:
                    break
                line_str = line.decode().strip()
                lines_list.append(line_str)

                # Parse progress from stderr
                if is_stderr and progress_callback:
                    progress = self._parse_progress(line_str)
                    if progress:
                        progress_callback(progress)

        # Read both streams concurrently
        await asyncio.gather(
            read_stream(process.stdout, stdout_lines),
            read_stream(process.stderr, stderr_lines, is_stderr=True)
        )

        await process.wait()

        return process.returncode, "\n".join(stdout_lines), "\n".join(stderr_lines)

    def _parse_progress(self, line: str) -> Optional[UploadProgress]:
        """Parse rclone progress output line."""
        # Example: Transferred: 1.234 GiB / 10.000 GiB, 12%, 50.000 MiB/s, ETA 2m30s
        try:
            # Try to parse stats line
            transferred_match = re.search(
                r'Transferred:\s+(\d+\.?\d*)\s*(\w+)\s*/\s*(\d+\.?\d*)\s*(\w+),\s*(\d+)%',
                line
            )
            if transferred_match:
                # Parse transferred bytes
                trans_val = float(transferred_match.group(1))
                trans_unit = transferred_match.group(2)
                total_val = float(transferred_match.group(3))
                total_unit = transferred_match.group(4)
                percent = int(transferred_match.group(5))

                bytes_transferred = self._parse_size(trans_val, trans_unit)
                total_bytes = self._parse_size(total_val, total_unit)

                # Parse speed
                speed = 0.0
                speed_match = re.search(r'(\d+\.?\d*)\s*(\w+)/s', line)
                if speed_match:
                    speed = self._parse_size(
                        float(speed_match.group(1)),
                        speed_match.group(2)
                    )

                # Parse ETA
                eta = None
                eta_match = re.search(r'ETA\s+(\d+)m(\d+)s', line)
                if eta_match:
                    eta = int(eta_match.group(1)) * 60 + int(eta_match.group(2))

                return UploadProgress(
                    file_name="",  # Will be set by caller
                    bytes_transferred=int(bytes_transferred),
                    total_bytes=int(total_bytes),
                    percent=percent,
                    speed_bytes_per_sec=speed,
                    eta_seconds=eta,
                )
        except Exception:
            pass
        return None

    def _parse_size(self, value: float, unit: str) -> float:
        """Convert size string to bytes."""
        unit = unit.lower().replace('i', '')  # Normalize GiB -> GB, etc.
        multipliers = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 ** 2,
            'gb': 1024 ** 3,
            'tb': 1024 ** 4,
        }
        return value * multipliers.get(unit, 1)

    def get_version(self) -> str:
        """Get rclone version."""
        result = self._run_rclone(["version"])
        if result.returncode == 0:
            # First line contains version
            return result.stdout.split("\n")[0]
        return "unknown"

    def list_remotes(self) -> List[str]:
        """List configured remotes."""
        result = self._run_rclone(["listremotes"])
        if result.returncode == 0:
            return [r.strip().rstrip(':') for r in result.stdout.strip().split("\n") if r.strip()]
        return []

    async def upload_file(
        self,
        local_path: Path,
        remote_path: str,
        checksum_verify: bool = True,
        progress_callback: Optional[Callable[[UploadProgress], None]] = None,
    ) -> UploadResult:
        """
        Upload a file using rclone.

        Args:
            local_path: Local file path
            remote_path: Full remote path (e.g., "swn-s3:bucket/path/file.mov")
            checksum_verify: Whether to verify checksum after upload
            progress_callback: Optional callback for progress updates

        Returns:
            UploadResult with status and checksums
        """
        if not local_path.exists():
            return UploadResult(
                success=False,
                local_path=local_path,
                remote_path=remote_path,
                error_message=f"File not found: {local_path}"
            )

        start_time = datetime.now()
        file_size = local_path.stat().st_size

        # Calculate local checksum first
        local_checksum = None
        if checksum_verify:
            local_checksum = await self._calculate_checksum(local_path)

        # Build rclone args
        args = [
            "copyto",
            str(local_path),
            remote_path,
            "--checksum",  # Use checksums to skip identical files
        ]

        if self.config and self.config.bandwidth_limit:
            args.extend(["--bwlimit", self.config.bandwidth_limit])

        # For large files, use multipart upload
        if file_size > 100 * 1024 * 1024:  # > 100MB
            args.extend([
                "--s3-upload-cutoff", "100M",
                "--s3-chunk-size", "50M",
            ])

        # Wrap progress callback to add filename
        def wrapped_progress(p: UploadProgress):
            if progress_callback:
                p.file_name = local_path.name
                progress_callback(p)

        # Run upload
        returncode, stdout, stderr = await self._run_rclone_async(args, wrapped_progress)

        duration = (datetime.now() - start_time).total_seconds()

        if returncode != 0:
            return UploadResult(
                success=False,
                local_path=local_path,
                remote_path=remote_path,
                local_checksum=local_checksum,
                duration_seconds=duration,
                error_message=stderr or stdout,
            )

        # Verify checksum if requested
        remote_checksum = None
        checksum_verified = False

        if checksum_verify and local_checksum:
            remote_checksum = await self._get_remote_checksum(remote_path)
            checksum_verified = (local_checksum == remote_checksum)

            if not checksum_verified:
                return UploadResult(
                    success=False,
                    local_path=local_path,
                    remote_path=remote_path,
                    local_checksum=local_checksum,
                    remote_checksum=remote_checksum,
                    checksum_verified=False,
                    bytes_transferred=file_size,
                    duration_seconds=duration,
                    error_message="Checksum mismatch after upload",
                )

        return UploadResult(
            success=True,
            local_path=local_path,
            remote_path=remote_path,
            local_checksum=local_checksum,
            remote_checksum=remote_checksum,
            checksum_verified=checksum_verified,
            bytes_transferred=file_size,
            duration_seconds=duration,
        )

    async def upload_batch(
        self,
        files: List[Tuple[Path, str]],  # [(local_path, remote_path), ...]
        parallel: int = 3,
        checksum_verify: bool = True,
        progress_callback: Optional[Callable[[UploadProgress], None]] = None,
    ) -> List[UploadResult]:
        """
        Upload multiple files with parallel transfers.

        Args:
            files: List of (local_path, remote_path) tuples
            parallel: Number of parallel uploads
            checksum_verify: Whether to verify checksums
            progress_callback: Optional callback for progress updates

        Returns:
            List of UploadResult for each file
        """
        semaphore = asyncio.Semaphore(parallel)

        async def upload_with_semaphore(local_path: Path, remote_path: str) -> UploadResult:
            async with semaphore:
                return await self.upload_file(
                    local_path,
                    remote_path,
                    checksum_verify,
                    progress_callback,
                )

        tasks = [
            upload_with_semaphore(local_path, remote_path)
            for local_path, remote_path in files
        ]

        return await asyncio.gather(*tasks)

    async def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate XXH64 checksum of local file using rclone."""
        result = self._run_rclone([
            "hashsum", "xxhash",
            str(file_path),
        ])

        if result.returncode == 0:
            # Output format: "checksum  filename"
            parts = result.stdout.strip().split()
            if parts:
                return parts[0]

        return ""

    async def _get_remote_checksum(self, remote_path: str) -> str:
        """Get XXH64 checksum of remote file."""
        result = self._run_rclone([
            "hashsum", "xxhash",
            remote_path,
        ])

        if result.returncode == 0:
            parts = result.stdout.strip().split()
            if parts:
                return parts[0]

        return ""

    async def verify_upload(self, local_path: Path, remote_path: str) -> bool:
        """Verify a remote file matches local checksum."""
        local_checksum = await self._calculate_checksum(local_path)
        remote_checksum = await self._get_remote_checksum(remote_path)

        return local_checksum == remote_checksum and local_checksum != ""

    async def get_remote_size(self, remote_path: str) -> int:
        """Get size of remote file (0 if not exists)."""
        result = self._run_rclone([
            "size", remote_path, "--json"
        ])

        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                return data.get("bytes", 0)
            except json.JSONDecodeError:
                pass

        return 0

    async def file_exists(self, remote_path: str) -> bool:
        """Check if remote file exists."""
        result = self._run_rclone([
            "lsf", remote_path,
        ])
        return result.returncode == 0 and result.stdout.strip() != ""

    def delete_remote(self, remote_path: str) -> bool:
        """Delete a remote file."""
        result = self._run_rclone([
            "deletefile", remote_path,
        ])
        return result.returncode == 0

    def test_remote(self, remote_name: str) -> Tuple[bool, str]:
        """
        Test if a remote is accessible.

        Args:
            remote_name: Name of the remote (without colon)

        Returns:
            Tuple of (success, error_message)
        """
        result = self._run_rclone([
            "lsd", f"{remote_name}:",
            "--max-depth", "0",
        ], timeout=30)

        if result.returncode == 0:
            return True, ""
        else:
            return False, result.stderr or "Connection failed"

    def get_remote_info(self, remote_name: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a configured remote.

        Args:
            remote_name: Name of the remote

        Returns:
            Dictionary with remote configuration, or None if not found
        """
        result = self._run_rclone([
            "config", "dump",
        ])

        if result.returncode != 0:
            return None

        try:
            config = json.loads(result.stdout)
            return config.get(remote_name)
        except json.JSONDecodeError:
            return None

    def list_configured_remotes(self) -> List[Dict[str, Any]]:
        """
        List all configured remotes with their types.

        Returns:
            List of dicts with 'name' and 'type' keys
        """
        result = self._run_rclone([
            "config", "dump",
        ])

        if result.returncode != 0:
            return []

        try:
            config = json.loads(result.stdout)
            remotes = []
            for name, settings in config.items():
                remotes.append({
                    "name": name,
                    "type": settings.get("type", "unknown"),
                    "config": settings,
                })
            return remotes
        except json.JSONDecodeError:
            return []

    def list_directory(
        self,
        remote_path: str,
        recursive: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List files and directories in a remote path.

        Args:
            remote_path: Remote path (e.g., "gdrive:folder/subfolder")
            recursive: If True, list recursively

        Returns:
            List of file/directory info dicts
        """
        args = ["lsjson", remote_path]
        if recursive:
            args.append("--recursive")

        result = self._run_rclone(args, timeout=60)

        if result.returncode != 0:
            return []

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return []

    async def download_file(
        self,
        remote_path: str,
        local_path: Path,
        progress_callback: Optional[Callable[[UploadProgress], None]] = None,
    ) -> UploadResult:
        """
        Download a file from remote to local.

        Args:
            remote_path: Full remote path (e.g., "gdrive:folder/file.mov")
            local_path: Local destination path
            progress_callback: Optional callback for progress updates

        Returns:
            UploadResult (reused for downloads)
        """
        start_time = datetime.now()

        # Ensure parent directory exists
        local_path.parent.mkdir(parents=True, exist_ok=True)

        args = [
            "copyto",
            remote_path,
            str(local_path),
        ]

        if self.config and self.config.bandwidth_limit:
            args.extend(["--bwlimit", self.config.bandwidth_limit])

        def wrapped_progress(p: UploadProgress):
            if progress_callback:
                p.file_name = local_path.name
                progress_callback(p)

        returncode, stdout, stderr = await self._run_rclone_async(args, wrapped_progress)

        duration = (datetime.now() - start_time).total_seconds()

        if returncode != 0:
            return UploadResult(
                success=False,
                local_path=local_path,
                remote_path=remote_path,
                duration_seconds=duration,
                error_message=stderr or stdout,
            )

        file_size = local_path.stat().st_size if local_path.exists() else 0

        return UploadResult(
            success=True,
            local_path=local_path,
            remote_path=remote_path,
            bytes_transferred=file_size,
            duration_seconds=duration,
        )

    async def sync_folder(
        self,
        source: str,
        dest: str,
        direction: Literal["push", "pull"] = "push",
        dry_run: bool = False,
        progress_callback: Optional[Callable[[UploadProgress], None]] = None,
    ) -> Tuple[bool, str]:
        """
        Sync folders between local and remote.

        Args:
            source: Source path (local path for push, remote for pull)
            dest: Destination path
            direction: "push" syncs local->remote, "pull" syncs remote->local
            dry_run: If True, only show what would be done
            progress_callback: Optional callback for progress updates

        Returns:
            Tuple of (success, output_message)
        """
        args = ["sync", source, dest]

        if dry_run:
            args.append("--dry-run")

        if self.config and self.config.bandwidth_limit:
            args.extend(["--bwlimit", self.config.bandwidth_limit])

        returncode, stdout, stderr = await self._run_rclone_async(args, progress_callback)

        if returncode == 0:
            return True, stdout or "Sync completed successfully"
        else:
            return False, stderr or stdout or "Sync failed"

    def create_remote(
        self,
        name: str,
        remote_type: str,
        config: Dict[str, str]
    ) -> bool:
        """
        Create a new remote configuration.

        Args:
            name: Remote name
            remote_type: Remote type (e.g., "s3", "drive", "dropbox")
            config: Configuration parameters

        Returns:
            True if successful
        """
        args = ["config", "create", name, remote_type]

        for key, value in config.items():
            args.extend([key, value])

        result = self._run_rclone(args)
        return result.returncode == 0

    def delete_remote_config(self, name: str) -> bool:
        """
        Delete a remote configuration.

        Args:
            name: Remote name to delete

        Returns:
            True if successful
        """
        result = self._run_rclone(["config", "delete", name])
        return result.returncode == 0

    def get_about(self, remote_name: str) -> Optional[Dict[str, Any]]:
        """
        Get storage quota/usage information for a remote.

        Args:
            remote_name: Name of the remote

        Returns:
            Dict with 'total', 'used', 'free' in bytes, or None
        """
        result = self._run_rclone([
            "about", f"{remote_name}:", "--json"
        ], timeout=30)

        if result.returncode != 0:
            return None

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return None

    def authorize_oauth(self, remote_type: str) -> Tuple[bool, str]:
        """
        Start OAuth authorization flow for a remote type.
        Opens browser for authorization.

        Args:
            remote_type: Type of remote ("drive", "dropbox", "onedrive")

        Returns:
            Tuple of (success, token_or_error)
        """
        # rclone authorize opens browser automatically
        result = self._run_rclone([
            "authorize", remote_type
        ], timeout=300)  # 5 min timeout for user to complete OAuth

        if result.returncode == 0:
            # Token is in stdout
            return True, result.stdout.strip()
        else:
            return False, result.stderr or "Authorization failed"
