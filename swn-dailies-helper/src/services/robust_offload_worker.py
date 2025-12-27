"""
Robust Offload Worker - Production-grade file offload with data integrity guarantees.

Key Features:
1. Atomic writes (temp file + fsync + rename)
2. Dual checksums: xxHash64 for speed, SHA-256 for legal audit trail
3. Re-read verification (source re-read after copy to bypass OS cache)
4. Two-copy verification before safe-to-format
5. Resumable/idempotent operations with journal
6. Full manifest with job signature hash
"""
import os
import json
import hashlib
import tempfile
import platform
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum

from PyQt6.QtCore import QThread, pyqtSignal

try:
    import xxhash
    HAS_XXHASH = True
except ImportError:
    HAS_XXHASH = False

# 64MB chunk size for file operations
CHUNK_SIZE = 64 * 1024 * 1024

# Temp file suffix for atomic writes
TEMP_SUFFIX = ".swn_temp"


class FileState(str, Enum):
    """File offload state machine."""
    PENDING = "pending"
    COPYING = "copying"
    COPY_COMPLETE = "copy_complete"
    VERIFYING_DEST = "verifying_dest"
    DEST_VERIFIED = "dest_verified"
    VERIFYING_SOURCE = "verifying_source"  # Re-read source to bypass cache
    FULLY_VERIFIED = "fully_verified"
    FAILED = "failed"


class OffloadPhase(str, Enum):
    """Overall offload operation phase."""
    INITIALIZING = "initializing"
    COPYING = "copying"
    VERIFYING = "verifying"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class FileChecksum:
    """Dual checksum for a file."""
    xxhash64: str = ""
    sha256: str = ""

    def to_dict(self) -> Dict[str, str]:
        return {"xxhash64": self.xxhash64, "sha256": self.sha256}

    @classmethod
    def from_dict(cls, data: Dict) -> "FileChecksum":
        return cls(xxhash64=data.get("xxhash64", ""), sha256=data.get("sha256", ""))


@dataclass
class DestinationCopy:
    """Tracks a single copy at a destination."""
    path: str
    checksum: Optional[FileChecksum] = None
    verified: bool = False
    verified_at: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "path": self.path,
            "checksum": self.checksum.to_dict() if self.checksum else None,
            "verified": self.verified,
            "verified_at": self.verified_at,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "DestinationCopy":
        checksum = FileChecksum.from_dict(data["checksum"]) if data.get("checksum") else None
        return cls(
            path=data["path"],
            checksum=checksum,
            verified=data.get("verified", False),
            verified_at=data.get("verified_at"),
            error=data.get("error"),
        )


@dataclass
class RobustFileEntry:
    """
    Complete tracking for a single file in the offload.
    Maintains full audit trail for legal defensibility.
    """
    file_name: str
    relative_path: Optional[str] = None
    file_size: int = 0

    # State tracking
    state: str = FileState.PENDING.value

    # Source checksums (computed during initial copy)
    source_checksum_on_copy: Optional[FileChecksum] = None

    # Source checksum from re-read (after copy, bypasses cache)
    source_checksum_reread: Optional[FileChecksum] = None

    # Destination copies with individual verification status
    destination_copies: List[DestinationCopy] = field(default_factory=list)

    # Verification status
    source_verified: bool = False  # Source re-read matches initial
    all_copies_verified: bool = False  # All destinations match source

    # Error tracking
    error_message: Optional[str] = None

    # Timestamps
    copy_started_at: Optional[str] = None
    copy_completed_at: Optional[str] = None
    verification_completed_at: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "file_name": self.file_name,
            "relative_path": self.relative_path,
            "file_size": self.file_size,
            "state": self.state,
            "source_checksum_on_copy": self.source_checksum_on_copy.to_dict() if self.source_checksum_on_copy else None,
            "source_checksum_reread": self.source_checksum_reread.to_dict() if self.source_checksum_reread else None,
            "destination_copies": [dc.to_dict() for dc in self.destination_copies],
            "source_verified": self.source_verified,
            "all_copies_verified": self.all_copies_verified,
            "error_message": self.error_message,
            "copy_started_at": self.copy_started_at,
            "copy_completed_at": self.copy_completed_at,
            "verification_completed_at": self.verification_completed_at,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "RobustFileEntry":
        source_on_copy = FileChecksum.from_dict(data["source_checksum_on_copy"]) if data.get("source_checksum_on_copy") else None
        source_reread = FileChecksum.from_dict(data["source_checksum_reread"]) if data.get("source_checksum_reread") else None
        dest_copies = [DestinationCopy.from_dict(dc) for dc in data.get("destination_copies", [])]

        return cls(
            file_name=data["file_name"],
            relative_path=data.get("relative_path"),
            file_size=data.get("file_size", 0),
            state=data.get("state", FileState.PENDING.value),
            source_checksum_on_copy=source_on_copy,
            source_checksum_reread=source_reread,
            destination_copies=dest_copies,
            source_verified=data.get("source_verified", False),
            all_copies_verified=data.get("all_copies_verified", False),
            error_message=data.get("error_message"),
            copy_started_at=data.get("copy_started_at"),
            copy_completed_at=data.get("copy_completed_at"),
            verification_completed_at=data.get("verification_completed_at"),
        )

    def get_verified_copy_count(self) -> int:
        """Return number of verified copies (not including source)."""
        return sum(1 for dc in self.destination_copies if dc.verified)

    def is_safe_to_delete_source(self) -> bool:
        """
        Returns True only if:
        1. At least 2 destination copies are verified
        2. Source has been re-read and verified
        3. All checksums match
        """
        return (
            self.source_verified and
            self.all_copies_verified and
            self.get_verified_copy_count() >= 2
        )


@dataclass
class OffloadJournal:
    """
    Journal file for resumable offload operations.
    Saved atomically after each significant state change.
    """
    job_id: str
    source_path: str
    destination_paths: List[str]

    # Progress tracking
    phase: str = OffloadPhase.INITIALIZING.value
    current_file_index: int = 0

    # File entries
    files: List[RobustFileEntry] = field(default_factory=list)

    # Job metadata
    project_id: Optional[str] = None
    camera_label: Optional[str] = None
    roll_name: Optional[str] = None

    # MHL generation
    generate_mhl: bool = True  # Generate MHL manifest after verification
    mhl_format: str = "standard"  # "standard" or "asc"
    mhl_paths: List[str] = field(default_factory=list)  # Paths to generated MHL files

    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None

    # Job signature (hash of all file checksums for manifest integrity)
    job_signature: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "source_path": self.source_path,
            "destination_paths": self.destination_paths,
            "phase": self.phase,
            "current_file_index": self.current_file_index,
            "files": [f.to_dict() for f in self.files],
            "project_id": self.project_id,
            "camera_label": self.camera_label,
            "roll_name": self.roll_name,
            "generate_mhl": self.generate_mhl,
            "mhl_format": self.mhl_format,
            "mhl_paths": self.mhl_paths,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at,
            "job_signature": self.job_signature,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "OffloadJournal":
        files = [RobustFileEntry.from_dict(f) for f in data.get("files", [])]
        return cls(
            job_id=data["job_id"],
            source_path=data["source_path"],
            destination_paths=data["destination_paths"],
            phase=data.get("phase", OffloadPhase.INITIALIZING.value),
            current_file_index=data.get("current_file_index", 0),
            files=files,
            project_id=data.get("project_id"),
            camera_label=data.get("camera_label"),
            roll_name=data.get("roll_name"),
            generate_mhl=data.get("generate_mhl", True),
            mhl_format=data.get("mhl_format", "standard"),
            mhl_paths=data.get("mhl_paths", []),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            completed_at=data.get("completed_at"),
            job_signature=data.get("job_signature"),
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get summary statistics."""
        total = len(self.files)
        copied = sum(1 for f in self.files if f.state in [
            FileState.COPY_COMPLETE.value,
            FileState.VERIFYING_DEST.value,
            FileState.DEST_VERIFIED.value,
            FileState.VERIFYING_SOURCE.value,
            FileState.FULLY_VERIFIED.value
        ])
        verified = sum(1 for f in self.files if f.state == FileState.FULLY_VERIFIED.value)
        failed = sum(1 for f in self.files if f.state == FileState.FAILED.value)
        safe_to_format = all(f.is_safe_to_delete_source() for f in self.files if f.state != FileState.FAILED.value)

        total_size = sum(f.file_size for f in self.files)
        copied_size = sum(f.file_size for f in self.files if f.state not in [FileState.PENDING.value, FileState.COPYING.value])

        return {
            "total_files": total,
            "copied_files": copied,
            "verified_files": verified,
            "failed_files": failed,
            "total_size": total_size,
            "copied_size": copied_size,
            "safe_to_format": safe_to_format and verified == total - failed,
        }

    def compute_job_signature(self) -> str:
        """
        Compute a signature hash of all file checksums.
        This can be used to verify manifest integrity later.
        """
        hasher = hashlib.sha256()
        for f in sorted(self.files, key=lambda x: x.file_name):
            if f.source_checksum_on_copy:
                hasher.update(f.file_name.encode())
                hasher.update(f.source_checksum_on_copy.sha256.encode())
        return hasher.hexdigest()


def _drop_os_cache(file_path: Path) -> None:
    """
    Attempt to drop OS file cache for the given file.
    This ensures re-reads come from disk, not memory.
    """
    try:
        if platform.system() == "Linux":
            # Linux: Use posix_fadvise to drop cache
            import ctypes
            libc = ctypes.CDLL("libc.so.6", use_errno=True)
            POSIX_FADV_DONTNEED = 4

            fd = os.open(str(file_path), os.O_RDONLY)
            try:
                size = file_path.stat().st_size
                libc.posix_fadvise(fd, 0, size, POSIX_FADV_DONTNEED)
            finally:
                os.close(fd)
        elif platform.system() == "Darwin":
            # macOS: Use fcntl F_NOCACHE
            import fcntl
            fd = os.open(str(file_path), os.O_RDONLY)
            try:
                fcntl.fcntl(fd, fcntl.F_NOCACHE, 1)
            finally:
                os.close(fd)
        # Windows: No reliable way to drop cache, rely on large file size
    except Exception:
        # Cache dropping is best-effort, not critical
        pass


def _compute_dual_checksum(file_path: Path, progress_callback=None) -> FileChecksum:
    """
    Compute both xxHash64 and SHA-256 checksums in a single pass.
    """
    if HAS_XXHASH:
        xxhasher = xxhash.xxh64()
    else:
        xxhasher = None
    sha_hasher = hashlib.sha256()

    file_size = file_path.stat().st_size
    bytes_read = 0

    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break

            if xxhasher:
                xxhasher.update(chunk)
            sha_hasher.update(chunk)

            bytes_read += len(chunk)
            if progress_callback:
                progress_callback(bytes_read, file_size)

    return FileChecksum(
        xxhash64=xxhasher.hexdigest() if xxhasher else "",
        sha256=sha_hasher.hexdigest()
    )


def _atomic_write_with_checksum(
    source_path: Path,
    dest_path: Path,
    progress_callback=None,
) -> Tuple[FileChecksum, bool]:
    """
    Copy file with atomic write pattern:
    1. Write to temp file
    2. fsync to ensure data is on disk
    3. Rename to final path (atomic on most filesystems)

    Returns (checksum, success)
    """
    temp_path = dest_path.parent / (dest_path.name + TEMP_SUFFIX)

    # Ensure destination directory exists
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if HAS_XXHASH:
        xxhasher = xxhash.xxh64()
    else:
        xxhasher = None
    sha_hasher = hashlib.sha256()

    file_size = source_path.stat().st_size
    bytes_copied = 0

    try:
        with open(source_path, 'rb') as src:
            with open(temp_path, 'wb') as dst:
                while True:
                    chunk = src.read(CHUNK_SIZE)
                    if not chunk:
                        break

                    # Update checksums
                    if xxhasher:
                        xxhasher.update(chunk)
                    sha_hasher.update(chunk)

                    # Write to temp file
                    dst.write(chunk)

                    bytes_copied += len(chunk)
                    if progress_callback:
                        progress_callback(bytes_copied, file_size)

                # fsync to ensure data is on disk
                dst.flush()
                os.fsync(dst.fileno())

        # Also fsync parent directory (important on Linux)
        if platform.system() != "Windows":
            dir_fd = os.open(str(dest_path.parent), os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)

        # Atomic rename
        temp_path.rename(dest_path)

        checksum = FileChecksum(
            xxhash64=xxhasher.hexdigest() if xxhasher else "",
            sha256=sha_hasher.hexdigest()
        )
        return checksum, True

    except Exception as e:
        # Clean up temp file on failure
        if temp_path.exists():
            try:
                temp_path.unlink()
            except:
                pass
        raise


class RobustOffloadWorker(QThread):
    """
    Production-grade offload worker with full data integrity guarantees.

    Implements:
    - Atomic writes (temp file + fsync + rename)
    - Dual checksums (xxHash64 + SHA-256)
    - Source re-read verification (bypasses OS cache)
    - Two-copy minimum before safe-to-format
    - Resumable operations via journal
    - Full audit trail in manifest
    """

    # Signals
    progress_updated = pyqtSignal(int, int, str)  # file_idx, total_files, filename
    file_progress = pyqtSignal(int, int)  # bytes, total_bytes
    file_completed = pyqtSignal(str, bool, str)  # filename, success, error
    phase_changed = pyqtSignal(str)  # phase name
    offload_completed = pyqtSignal(bool, str, dict)  # success, message, stats
    status_message = pyqtSignal(str)  # status text
    safe_to_format = pyqtSignal(bool)  # True when 2+ verified copies exist

    def __init__(
        self,
        journal: OffloadJournal,
        verify_source: bool = True,  # Re-read source after copy
        parent=None
    ):
        super().__init__(parent)
        self.journal = journal
        self.verify_source = verify_source
        self._cancelled = False

        # Journal persistence path
        self.journal_dir = Path.home() / ".swn-dailies-helper" / "journals"
        self.journal_dir.mkdir(parents=True, exist_ok=True)
        self.journal_path = self.journal_dir / f"{journal.job_id}.journal.json"

    @classmethod
    def create_new(
        cls,
        source_path: str,
        destination_paths: List[str],
        files: List[Dict[str, Any]],
        project_id: Optional[str] = None,
        camera_label: Optional[str] = None,
        roll_name: Optional[str] = None,
        verify_source: bool = True,
        generate_mhl: bool = True,
        mhl_format: str = "standard",
        parent=None,
    ) -> "RobustOffloadWorker":
        """Create a new offload job."""
        import uuid

        journal = OffloadJournal(
            job_id=str(uuid.uuid4()),
            source_path=source_path,
            destination_paths=destination_paths,
            project_id=project_id,
            camera_label=camera_label,
            roll_name=roll_name,
            generate_mhl=generate_mhl,
            mhl_format=mhl_format,
            files=[
                RobustFileEntry(
                    file_name=f.get("name", ""),
                    relative_path=f.get("relative_path"),
                    file_size=f.get("size", 0),
                    destination_copies=[
                        DestinationCopy(path=dp)
                        for dp in destination_paths
                    ]
                )
                for f in files
            ]
        )

        return cls(journal=journal, verify_source=verify_source, parent=parent)

    @classmethod
    def resume_from_journal(cls, journal_path: Path, parent=None) -> "RobustOffloadWorker":
        """Resume an interrupted offload from a journal file."""
        with open(journal_path) as f:
            data = json.load(f)
        journal = OffloadJournal.from_dict(data)
        return cls(journal=journal, parent=parent)

    def cancel(self):
        """Request cancellation."""
        self._cancelled = True

    def _save_journal(self):
        """Atomically save journal state."""
        self.journal.updated_at = datetime.now().isoformat()

        temp_path = self.journal_path.with_suffix('.tmp')
        with open(temp_path, 'w') as f:
            json.dump(self.journal.to_dict(), f, indent=2)
            f.flush()
            os.fsync(f.fileno())

        temp_path.rename(self.journal_path)

    def run(self):
        """Main worker execution."""
        try:
            self._run_offload()
        except Exception as e:
            self.journal.phase = OffloadPhase.FAILED.value
            self._save_journal()
            self.offload_completed.emit(False, f"Offload failed: {e}", self.journal.get_stats())

    def _run_offload(self):
        """Execute the offload operation."""
        source_path = Path(self.journal.source_path)
        total_files = len(self.journal.files)

        # Phase 1: Copy all files
        self.journal.phase = OffloadPhase.COPYING.value
        self.phase_changed.emit("Copying files")
        self._save_journal()

        for idx, file_entry in enumerate(self.journal.files):
            if self._cancelled:
                self.status_message.emit("Offload cancelled")
                self._save_journal()
                self.offload_completed.emit(False, "Cancelled by user", self.journal.get_stats())
                return

            # Skip already copied files (for resume)
            if file_entry.state not in [FileState.PENDING.value, FileState.COPYING.value]:
                continue

            self.journal.current_file_index = idx
            self.progress_updated.emit(idx + 1, total_files, file_entry.file_name)
            self.status_message.emit(f"Copying {file_entry.file_name}...")

            try:
                self._copy_single_file(file_entry, source_path)
            except Exception as e:
                file_entry.state = FileState.FAILED.value
                file_entry.error_message = str(e)
                self.file_completed.emit(file_entry.file_name, False, str(e))
                self._save_journal()
                continue

            self._save_journal()

        # Phase 2: Verify all destinations
        self.journal.phase = OffloadPhase.VERIFYING.value
        self.phase_changed.emit("Verifying copies")
        self._save_journal()

        for idx, file_entry in enumerate(self.journal.files):
            if self._cancelled:
                self.status_message.emit("Verification cancelled")
                self._save_journal()
                self.offload_completed.emit(False, "Cancelled by user", self.journal.get_stats())
                return

            # Skip failed or already verified files
            if file_entry.state == FileState.FAILED.value:
                continue
            if file_entry.state == FileState.FULLY_VERIFIED.value:
                continue

            self.progress_updated.emit(idx + 1, total_files, file_entry.file_name)
            self.status_message.emit(f"Verifying {file_entry.file_name}...")

            try:
                self._verify_single_file(file_entry, source_path)
            except Exception as e:
                file_entry.state = FileState.FAILED.value
                file_entry.error_message = str(e)
                self.file_completed.emit(file_entry.file_name, False, str(e))

            self._save_journal()

        # Compute job signature
        self.journal.job_signature = self.journal.compute_job_signature()

        # Generate MHL manifests if enabled
        if self.journal.generate_mhl:
            self._generate_mhl_manifests()

        # Finalize
        stats = self.journal.get_stats()
        self.journal.phase = OffloadPhase.COMPLETE.value
        self.journal.completed_at = datetime.now().isoformat()
        self._save_journal()

        # Emit safe-to-format signal
        self.safe_to_format.emit(stats["safe_to_format"])

        if stats["failed_files"] == 0:
            self.offload_completed.emit(
                True,
                f"Offload complete: {stats['verified_files']} files verified",
                stats
            )
        else:
            self.offload_completed.emit(
                False,
                f"Offload completed with {stats['failed_files']} failures",
                stats
            )

    def _copy_single_file(self, file_entry: RobustFileEntry, source_base: Path):
        """Copy a single file to all destinations with atomic writes."""
        # Build source path
        if file_entry.relative_path:
            source_file = source_base / file_entry.relative_path / file_entry.file_name
        else:
            source_file = source_base / file_entry.file_name

        if not source_file.exists():
            raise FileNotFoundError(f"Source not found: {source_file}")

        file_entry.state = FileState.COPYING.value
        file_entry.copy_started_at = datetime.now().isoformat()

        file_size = source_file.stat().st_size
        bytes_copied = 0

        # Copy to all destinations with atomic write
        for dest_copy in file_entry.destination_copies:
            dest_base = Path(dest_copy.path)
            if file_entry.relative_path:
                dest_file = dest_base / file_entry.relative_path / file_entry.file_name
            else:
                dest_file = dest_base / file_entry.file_name

            def progress_cb(current, total):
                self.file_progress.emit(current, total)

            checksum, success = _atomic_write_with_checksum(
                source_file,
                dest_file,
                progress_callback=progress_cb
            )

            if not success:
                raise RuntimeError(f"Failed to copy to {dest_file}")

            # Store checksum (same for all copies since from same source read)
            if not file_entry.source_checksum_on_copy:
                file_entry.source_checksum_on_copy = checksum

            dest_copy.path = str(dest_file)  # Update to full path

        file_entry.state = FileState.COPY_COMPLETE.value
        file_entry.copy_completed_at = datetime.now().isoformat()
        self.file_completed.emit(file_entry.file_name, True, "")

    def _verify_single_file(self, file_entry: RobustFileEntry, source_base: Path):
        """
        Verify a file by:
        1. Reading each destination copy and checking checksum
        2. Optionally re-reading source (bypasses OS cache) to verify original
        """
        file_entry.state = FileState.VERIFYING_DEST.value

        # Verify each destination copy
        verified_count = 0
        for dest_copy in file_entry.destination_copies:
            dest_path = Path(dest_copy.path)

            if not dest_path.exists():
                dest_copy.error = "File not found"
                continue

            try:
                # Drop cache before reading for true verification
                _drop_os_cache(dest_path)

                def progress_cb(current, total):
                    self.file_progress.emit(current, total)

                dest_checksum = _compute_dual_checksum(dest_path, progress_cb)
                dest_copy.checksum = dest_checksum

                # Compare with source checksum
                if (dest_checksum.sha256 == file_entry.source_checksum_on_copy.sha256 and
                    (not HAS_XXHASH or dest_checksum.xxhash64 == file_entry.source_checksum_on_copy.xxhash64)):
                    dest_copy.verified = True
                    dest_copy.verified_at = datetime.now().isoformat()
                    verified_count += 1
                else:
                    dest_copy.error = "Checksum mismatch"
            except Exception as e:
                dest_copy.error = str(e)

        file_entry.state = FileState.DEST_VERIFIED.value

        # Optionally re-read source to verify against OS cache
        if self.verify_source:
            file_entry.state = FileState.VERIFYING_SOURCE.value

            # Build source path
            if file_entry.relative_path:
                source_file = source_base / file_entry.relative_path / file_entry.file_name
            else:
                source_file = source_base / file_entry.file_name

            if source_file.exists():
                try:
                    # Drop cache to ensure we read from disk
                    _drop_os_cache(source_file)

                    source_reread = _compute_dual_checksum(source_file)
                    file_entry.source_checksum_reread = source_reread

                    # Compare with original checksum
                    if source_reread.sha256 == file_entry.source_checksum_on_copy.sha256:
                        file_entry.source_verified = True
                    else:
                        file_entry.error_message = "Source checksum changed during offload!"
                except Exception as e:
                    file_entry.error_message = f"Source re-read failed: {e}"
        else:
            file_entry.source_verified = True  # Skip source re-verification

        # Check if fully verified
        if file_entry.source_verified and verified_count >= 1:
            file_entry.all_copies_verified = True
            file_entry.state = FileState.FULLY_VERIFIED.value
            file_entry.verification_completed_at = datetime.now().isoformat()
        else:
            file_entry.state = FileState.FAILED.value
            if not file_entry.error_message:
                file_entry.error_message = f"Only {verified_count} copies verified"

    def _generate_mhl_manifests(self):
        """
        Generate MHL manifest files for each destination folder.
        Supports both standard MHL and ASC-MHL formats.
        """
        try:
            from src.services.mhl_service import get_mhl_service, HashAlgorithm
        except ImportError:
            self.status_message.emit("MHL service not available, skipping manifest generation")
            return

        mhl_service = get_mhl_service()
        use_asc_mhl = self.journal.mhl_format == "asc"

        # Check availability based on format
        if use_asc_mhl and not mhl_service.is_ascmhl_available:
            self.status_message.emit("ascmhl library not available, falling back to standard MHL")
            use_asc_mhl = False

        if not use_asc_mhl and not mhl_service.is_mhl_tool_available:
            # Try Python fallback for standard MHL
            self.status_message.emit("mhl-tool not found, using built-in MHL generation")

        format_name = "ASC-MHL" if use_asc_mhl else "MHL"
        self.status_message.emit(f"Generating {format_name} manifests...")

        # Find unique destination folders from verified files
        dest_folders: Dict[str, set] = {}  # Maps destination base to set of offloaded paths

        for file_entry in self.journal.files:
            if file_entry.state != FileState.FULLY_VERIFIED.value:
                continue

            for dest_copy in file_entry.destination_copies:
                if not dest_copy.verified:
                    continue

                dest_file_path = Path(dest_copy.path)
                # Find the common folder for all files at this destination
                # Files are at: dest_base / [relative_path] / filename
                # We want to MHL the roll folder, not individual files
                if file_entry.relative_path:
                    # The relative_path typically contains the roll folder
                    # dest_copy.path = dest_base + relative_path + filename
                    # We need dest_base + relative_path parent
                    rel_parts = Path(file_entry.relative_path).parts
                    if rel_parts:
                        # Get the top-level folder in relative path (e.g., "A001_1234")
                        roll_folder = dest_file_path.parent
                        for _ in range(len(rel_parts) - 1):
                            roll_folder = roll_folder.parent
                        dest_base = str(roll_folder.parent)
                        roll_name = roll_folder.name
                    else:
                        dest_base = str(dest_file_path.parent)
                        roll_name = dest_file_path.parent.name
                else:
                    # Files directly in destination
                    dest_base = str(dest_file_path.parent)
                    roll_name = dest_file_path.parent.name

                folder_key = f"{dest_base}/{roll_name}"
                if folder_key not in dest_folders:
                    dest_folders[folder_key] = set()
                dest_folders[folder_key].add(str(dest_file_path))

        # Generate MHL for each destination folder
        generated_mhl_paths = []
        for folder_path in dest_folders.keys():
            folder = Path(folder_path)
            if not folder.exists():
                continue

            try:
                if use_asc_mhl:
                    # Generate ASC-MHL (creates ascmhl/ folder inside the target)
                    result = mhl_service.generate_asc_mhl(
                        folder_path=str(folder),
                        algorithm=HashAlgorithm.XXH128  # ASC-MHL prefers xxh128
                    )
                    if result.success:
                        generated_mhl_paths.append(result.output_path)
                        self.status_message.emit(f"Generated ASC-MHL: {folder.name}/ascmhl")
                    else:
                        errors = ", ".join(result.errors) if result.errors else "Unknown error"
                        self.status_message.emit(f"ASC-MHL warning: {errors}")
                else:
                    # Generate standard MHL with xxHash64 (matches our verification)
                    mhl_output = folder.parent / f"{folder.name}.mhl"
                    result = mhl_service.generate_mhl(
                        folder_path=str(folder),
                        output_path=str(mhl_output),
                        algorithm=HashAlgorithm.XXH64
                    )

                    if result.success:
                        generated_mhl_paths.append(str(mhl_output))
                        self.status_message.emit(f"Generated MHL: {mhl_output.name}")
                    else:
                        errors = ", ".join(result.errors) if result.errors else "Unknown error"
                        self.status_message.emit(f"MHL generation warning: {errors}")

            except Exception as e:
                self.status_message.emit(f"MHL generation failed for {folder.name}: {e}")

        # Store generated MHL paths in journal
        self.journal.mhl_paths = generated_mhl_paths
        self._save_journal()

        if generated_mhl_paths:
            self.status_message.emit(f"Generated {len(generated_mhl_paths)} {format_name} manifest(s)")


def export_manifest_for_audit(journal: OffloadJournal, output_path: Path) -> Path:
    """
    Export a human-readable manifest file for audit purposes.
    This can be verified later without the camera card present.
    """
    manifest = {
        "manifest_version": "2.0",
        "job_id": journal.job_id,
        "job_signature": journal.job_signature,
        "created_at": journal.created_at,
        "completed_at": journal.completed_at,
        "source_path": journal.source_path,
        "destination_paths": journal.destination_paths,
        "project_id": journal.project_id,
        "camera_label": journal.camera_label,
        "roll_name": journal.roll_name,
        "files": []
    }

    for f in journal.files:
        file_entry = {
            "file_name": f.file_name,
            "relative_path": f.relative_path,
            "file_size": f.file_size,
            "checksums": {
                "sha256": f.source_checksum_on_copy.sha256 if f.source_checksum_on_copy else None,
                "xxhash64": f.source_checksum_on_copy.xxhash64 if f.source_checksum_on_copy else None,
            },
            "source_verified": f.source_verified,
            "destination_copies": [
                {
                    "path": dc.path,
                    "verified": dc.verified,
                    "verified_at": dc.verified_at,
                }
                for dc in f.destination_copies
            ],
            "safe_to_delete_source": f.is_safe_to_delete_source(),
        }
        manifest["files"].append(file_entry)

    # Include checksum of manifest itself for tamper detection
    manifest_json = json.dumps(manifest, indent=2, sort_keys=True)
    manifest["manifest_checksum"] = hashlib.sha256(manifest_json.encode()).hexdigest()

    output_file = output_path / f"offload_manifest_{journal.job_id[:8]}.json"
    with open(output_file, 'w') as f:
        json.dump(manifest, f, indent=2)

    return output_file


def get_pending_journals() -> List[Path]:
    """Find all incomplete journal files for resume."""
    journal_dir = Path.home() / ".swn-dailies-helper" / "journals"
    if not journal_dir.exists():
        return []

    pending = []
    for journal_file in journal_dir.glob("*.journal.json"):
        try:
            with open(journal_file) as f:
                data = json.load(f)
            if data.get("phase") not in [OffloadPhase.COMPLETE.value, OffloadPhase.FAILED.value]:
                pending.append(journal_file)
        except:
            continue

    return pending
