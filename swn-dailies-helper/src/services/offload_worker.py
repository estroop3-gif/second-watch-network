"""
Offload worker for copying files from camera cards to destinations.
Runs in a separate thread to keep UI responsive.
"""
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from PyQt6.QtCore import QThread, pyqtSignal

try:
    import xxhash
    HAS_XXHASH = True
except ImportError:
    HAS_XXHASH = False
    import hashlib

from src.services.offload_manifest import OffloadManifest, OffloadedFile

# 64MB chunk size for file operations
CHUNK_SIZE = 64 * 1024 * 1024


class OffloadWorker(QThread):
    """Worker thread for file offload operations."""

    # Signals for UI updates
    progress_updated = pyqtSignal(int, int, str)      # file_idx, total_files, current_filename
    file_progress = pyqtSignal(int, int)               # bytes_copied, total_bytes (for current file)
    file_completed = pyqtSignal(str, bool, str)        # filename, success, error_message
    offload_completed = pyqtSignal(bool, str, dict)    # success, summary_message, stats
    status_message = pyqtSignal(str)                   # status text for UI

    def __init__(
        self,
        manifest: OffloadManifest,
        source_path: str,
        destinations: List[str],
        verify_checksums: bool = True,
        parent=None
    ):
        super().__init__(parent)
        self.manifest = manifest
        self.source_path = Path(source_path)
        self.destinations = [Path(d) for d in destinations]
        self.verify_checksums = verify_checksums
        self._cancelled = False

        # Statistics
        self.stats = {
            "files_copied": 0,
            "files_failed": 0,
            "bytes_copied": 0,
            "checksums_verified": 0,
            "checksums_failed": 0,
            "started_at": None,
            "completed_at": None,
        }

    def cancel(self):
        """Request cancellation of the offload operation."""
        self._cancelled = True

    def run(self):
        """Main worker thread execution."""
        self.stats["started_at"] = datetime.now().isoformat()
        total_files = len(self.manifest.files)

        self.status_message.emit(f"Starting offload of {total_files} files...")

        try:
            for idx, file_info in enumerate(self.manifest.files):
                if self._cancelled:
                    self.status_message.emit("Offload cancelled by user")
                    self._finalize(success=False, message="Cancelled by user")
                    return

                filename = file_info.file_name
                self.progress_updated.emit(idx + 1, total_files, filename)
                self.status_message.emit(f"Copying {filename}...")

                # Update file status
                file_info.offload_status = "in_progress"

                try:
                    # Copy file to all destinations
                    success = self._copy_file(file_info)

                    if success:
                        file_info.offload_status = "completed"
                        self.stats["files_copied"] += 1
                        self.file_completed.emit(filename, True, "")
                    else:
                        file_info.offload_status = "failed"
                        self.stats["files_failed"] += 1
                        self.file_completed.emit(filename, False, file_info.error_message or "Copy failed")

                except Exception as e:
                    file_info.offload_status = "failed"
                    file_info.error_message = str(e)
                    self.stats["files_failed"] += 1
                    self.file_completed.emit(filename, False, str(e))

            # Finalize
            if self.stats["files_failed"] == 0:
                self._finalize(success=True, message=f"Successfully copied {self.stats['files_copied']} files")
            else:
                self._finalize(
                    success=False,
                    message=f"Completed with {self.stats['files_failed']} failed files"
                )

        except Exception as e:
            self._finalize(success=False, message=f"Offload error: {str(e)}")

    def _copy_file(self, file_info: OffloadedFile) -> bool:
        """
        Copy a single file to all destinations with checksum calculation.

        Returns True on success, False on failure.
        """
        # Build source path
        if file_info.relative_path:
            source_file = self.source_path / file_info.relative_path / file_info.file_name
        else:
            source_file = self.source_path / file_info.file_name

        if not source_file.exists():
            file_info.error_message = f"Source file not found: {source_file}"
            return False

        file_size = source_file.stat().st_size
        bytes_copied = 0

        # Initialize hasher for source checksum
        if HAS_XXHASH:
            hasher = xxhash.xxh64()
        else:
            hasher = hashlib.sha256()

        # Prepare destination paths
        dest_paths = []
        for dest_base in self.destinations:
            if file_info.relative_path:
                dest_dir = dest_base / file_info.relative_path
            else:
                dest_dir = dest_base

            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_paths.append(dest_dir / file_info.file_name)

        try:
            # Open source file
            with open(source_file, 'rb') as src:
                # Open all destination files
                dest_files = [open(dp, 'wb') for dp in dest_paths]

                try:
                    while True:
                        if self._cancelled:
                            # Clean up partial files
                            for df in dest_files:
                                df.close()
                            for dp in dest_paths:
                                if dp.exists():
                                    dp.unlink()
                            return False

                        chunk = src.read(CHUNK_SIZE)
                        if not chunk:
                            break

                        # Update hasher
                        hasher.update(chunk)

                        # Write to all destinations
                        for df in dest_files:
                            df.write(chunk)

                        bytes_copied += len(chunk)
                        self.stats["bytes_copied"] += len(chunk)
                        self.file_progress.emit(bytes_copied, file_size)

                finally:
                    for df in dest_files:
                        df.close()

            # Store source checksum
            file_info.source_checksum = hasher.hexdigest()

            # Verify checksums if enabled
            if self.verify_checksums:
                self.status_message.emit(f"Verifying {file_info.file_name}...")
                verified = self._verify_destinations(file_info, dest_paths)
                if not verified:
                    return False

            return True

        except Exception as e:
            file_info.error_message = str(e)
            # Clean up partial files on error
            for dp in dest_paths:
                if dp.exists():
                    try:
                        dp.unlink()
                    except:
                        pass
            return False

    def _verify_destinations(self, file_info: OffloadedFile, dest_paths: List[Path]) -> bool:
        """
        Verify checksums of copied files against source.

        Returns True if all destinations match, False otherwise.
        """
        for dest_path in dest_paths:
            if HAS_XXHASH:
                hasher = xxhash.xxh64()
            else:
                hasher = hashlib.sha256()

            try:
                with open(dest_path, 'rb') as f:
                    while chunk := f.read(CHUNK_SIZE):
                        hasher.update(chunk)

                dest_checksum = hasher.hexdigest()

                if dest_checksum != file_info.source_checksum:
                    file_info.error_message = f"Checksum mismatch for {dest_path}"
                    file_info.checksum_verified = False
                    self.stats["checksums_failed"] += 1
                    return False

            except Exception as e:
                file_info.error_message = f"Verification failed: {str(e)}"
                file_info.checksum_verified = False
                self.stats["checksums_failed"] += 1
                return False

        # All destinations verified
        file_info.dest_checksum = file_info.source_checksum
        file_info.checksum_verified = True
        self.stats["checksums_verified"] += 1
        return True

    def _finalize(self, success: bool, message: str):
        """Finalize the offload operation."""
        self.stats["completed_at"] = datetime.now().isoformat()

        # Update manifest status
        self.manifest.offload_status = "completed" if success else "failed"

        self.offload_completed.emit(success, message, self.stats)


def format_bytes(size: int) -> str:
    """Format bytes into human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"
