"""
Card Fingerprinting - Prevent duplicate offloads by uniquely identifying cards.

Fingerprint components:
- Volume UUID (filesystem metadata)
- First 3 files sorted by creation time (filename + size + ctime)
- Directory structure hash (top 2 levels)
- Total file count and total size
"""
import hashlib
import os
import platform
import subprocess
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
from dataclasses import dataclass


@dataclass
class CardFingerprint:
    """Represents a unique card fingerprint."""
    fingerprint: str
    card_label: str
    volume_uuid: str
    total_files: int
    total_size: int
    first_files_hash: str
    dir_structure_hash: str
    created_at: datetime


@dataclass
class OffloadRecord:
    """Record of a previous offload."""
    fingerprint: str
    card_label: str
    offload_timestamp: datetime
    destination_paths: List[str]
    status: str  # 'complete', 'partial', 'failed'
    total_files: int
    total_size: int


class CardFingerprintService:
    """Service for fingerprinting camera cards and tracking offloads."""

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the fingerprint service.

        Args:
            db_path: Path to SQLite database. Defaults to user config dir.
        """
        if db_path is None:
            config_dir = self._get_config_dir()
            config_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(config_dir / "card_fingerprints.db")

        self.db_path = db_path
        self._init_database()

    def _get_config_dir(self) -> Path:
        """Get the config directory for storing the fingerprint database."""
        system = platform.system()
        if system == "Darwin":
            return Path.home() / "Library" / "Application Support" / "SWN Dailies Helper"
        elif system == "Windows":
            return Path(os.environ.get("APPDATA", "")) / "SWN Dailies Helper"
        else:
            return Path.home() / ".config" / "swn-dailies-helper"

    def _init_database(self):
        """Initialize the SQLite database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS offload_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT NOT NULL,
                card_label TEXT NOT NULL,
                offload_timestamp TEXT NOT NULL,
                destination_paths TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'complete',
                total_files INTEGER,
                total_size INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_fingerprint ON offload_records(fingerprint)
        """)

        conn.commit()
        conn.close()

    def compute_fingerprint(self, card_path: Path) -> CardFingerprint:
        """
        Compute a unique fingerprint for a camera card.

        Args:
            card_path: Path to the mounted card/volume

        Returns:
            CardFingerprint object with computed hash
        """
        # Get volume UUID
        volume_uuid = self._get_volume_uuid(card_path)

        # Get first 3 files by creation time
        first_files = self._get_first_files(card_path, count=3)
        first_files_data = ""
        for f in first_files:
            try:
                stat = f.stat()
                first_files_data += f"{f.name}{stat.st_size}{stat.st_ctime}"
            except (OSError, PermissionError):
                continue
        first_files_hash = hashlib.sha256(first_files_data.encode()).hexdigest()[:16]

        # Get directory structure hash (top 2 levels)
        dir_structure = self._get_dir_structure(card_path, max_depth=2)
        dir_structure_hash = hashlib.sha256(dir_structure.encode()).hexdigest()[:16]

        # Count total files and size
        total_files, total_size = self._count_files_and_size(card_path)

        # Compute final fingerprint
        fingerprint_data = (
            f"{volume_uuid}"
            f"{first_files_data}"
            f"{dir_structure}"
            f"{total_files}"
            f"{total_size}"
        )
        fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()

        return CardFingerprint(
            fingerprint=fingerprint,
            card_label=card_path.name,
            volume_uuid=volume_uuid,
            total_files=total_files,
            total_size=total_size,
            first_files_hash=first_files_hash,
            dir_structure_hash=dir_structure_hash,
            created_at=datetime.now(),
        )

    def _get_volume_uuid(self, path: Path) -> str:
        """Get the filesystem UUID for a volume."""
        system = platform.system()

        try:
            if system == "Darwin":
                # macOS: use diskutil
                result = subprocess.run(
                    ["diskutil", "info", str(path)],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                for line in result.stdout.split("\n"):
                    if "Volume UUID" in line:
                        return line.split(":")[1].strip()
                    if "Disk / Partition UUID" in line:
                        return line.split(":")[1].strip()

            elif system == "Linux":
                # Linux: use blkid or findmnt
                result = subprocess.run(
                    ["findmnt", "-n", "-o", "UUID", str(path)],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.stdout.strip():
                    return result.stdout.strip()

            elif system == "Windows":
                # Windows: use vol command or wmic
                result = subprocess.run(
                    ["vol", str(path)[:2]],
                    capture_output=True,
                    text=True,
                    shell=True,
                    timeout=10
                )
                # Parse "Volume Serial Number is XXXX-XXXX"
                for line in result.stdout.split("\n"):
                    if "Serial Number" in line:
                        return line.split("is")[1].strip()

        except (subprocess.TimeoutExpired, subprocess.SubprocessError, Exception):
            pass

        # Fallback: use path + device info hash
        try:
            stat = os.statvfs(path)
            fallback_data = f"{path}{stat.f_fsid}"
            return hashlib.md5(fallback_data.encode()).hexdigest()[:16]
        except (OSError, AttributeError):
            return hashlib.md5(str(path).encode()).hexdigest()[:16]

    def _get_first_files(self, path: Path, count: int = 3) -> List[Path]:
        """Get the first N files by creation time."""
        files = []

        try:
            for item in path.rglob("*"):
                if item.is_file():
                    try:
                        files.append((item, item.stat().st_ctime))
                    except (OSError, PermissionError):
                        continue
        except (OSError, PermissionError):
            pass

        # Sort by creation time and return first N
        files.sort(key=lambda x: x[1])
        return [f[0] for f in files[:count]]

    def _get_dir_structure(self, path: Path, max_depth: int = 2) -> str:
        """Get a string representation of directory structure."""
        dirs = []

        def walk(current: Path, depth: int):
            if depth > max_depth:
                return
            try:
                for item in sorted(current.iterdir()):
                    if item.is_dir():
                        dirs.append(str(item.relative_to(path)))
                        walk(item, depth + 1)
            except (OSError, PermissionError):
                pass

        walk(path, 0)
        return "|".join(sorted(dirs))

    def _count_files_and_size(self, path: Path) -> tuple[int, int]:
        """Count total files and total size in bytes."""
        total_files = 0
        total_size = 0

        try:
            for item in path.rglob("*"):
                if item.is_file():
                    try:
                        total_files += 1
                        total_size += item.stat().st_size
                    except (OSError, PermissionError):
                        continue
        except (OSError, PermissionError):
            pass

        return total_files, total_size

    def check_previous_offload(self, fingerprint: str) -> Optional[OffloadRecord]:
        """
        Check if a card with this fingerprint was previously offloaded.

        Args:
            fingerprint: The card fingerprint hash

        Returns:
            OffloadRecord if found, None otherwise
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT fingerprint, card_label, offload_timestamp, destination_paths,
                   status, total_files, total_size
            FROM offload_records
            WHERE fingerprint = ?
            ORDER BY offload_timestamp DESC
            LIMIT 1
        """, (fingerprint,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return OffloadRecord(
                fingerprint=row[0],
                card_label=row[1],
                offload_timestamp=datetime.fromisoformat(row[2]),
                destination_paths=row[3].split("|"),
                status=row[4],
                total_files=row[5] or 0,
                total_size=row[6] or 0,
            )

        return None

    def record_offload(
        self,
        fingerprint: CardFingerprint,
        destinations: List[str],
        status: str = "complete"
    ):
        """
        Record a successful offload in the database.

        Args:
            fingerprint: The card fingerprint
            destinations: List of destination paths
            status: Offload status ('complete', 'partial', 'failed')
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO offload_records
            (fingerprint, card_label, offload_timestamp, destination_paths,
             status, total_files, total_size)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            fingerprint.fingerprint,
            fingerprint.card_label,
            datetime.now().isoformat(),
            "|".join(destinations),
            status,
            fingerprint.total_files,
            fingerprint.total_size,
        ))

        conn.commit()
        conn.close()

    def get_offload_history(self, limit: int = 50) -> List[OffloadRecord]:
        """
        Get recent offload history.

        Args:
            limit: Maximum number of records to return

        Returns:
            List of OffloadRecord objects
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT fingerprint, card_label, offload_timestamp, destination_paths,
                   status, total_files, total_size
            FROM offload_records
            ORDER BY offload_timestamp DESC
            LIMIT ?
        """, (limit,))

        records = []
        for row in cursor.fetchall():
            records.append(OffloadRecord(
                fingerprint=row[0],
                card_label=row[1],
                offload_timestamp=datetime.fromisoformat(row[2]),
                destination_paths=row[3].split("|"),
                status=row[4],
                total_files=row[5] or 0,
                total_size=row[6] or 0,
            ))

        conn.close()
        return records

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"
