"""
MHL (Media Hash List) verification service.

Provides MHL file verification and generation using:
- Pomfort mhl-tool CLI (for standard MHL)
- Python ascmhl library (for ASC-MHL standard)

MHL is an industry-standard format for verifying media file integrity
in professional video production workflows.
"""
import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from src.services.binary_manager import BinaryManager


class VerificationStatus(Enum):
    """MHL verification result status."""
    OK = "ok"
    FAILED = "failed"
    MISSING = "missing"
    EXTRA = "extra"
    ERROR = "error"


class HashAlgorithm(Enum):
    """Supported hash algorithms for MHL."""
    MD5 = "md5"
    SHA1 = "sha1"
    SHA256 = "sha256"  # SHA-256
    XXH64 = "xxh64"
    XXH128 = "xxh128"


@dataclass
class FileVerification:
    """Verification result for a single file."""
    file_path: str
    status: VerificationStatus
    expected_hash: str = ""
    actual_hash: str = ""
    hash_algorithm: str = ""
    file_size: int = 0
    message: str = ""


@dataclass
class VerificationResult:
    """Complete MHL verification result."""
    mhl_path: str
    success: bool
    total_files: int = 0
    verified_files: int = 0
    failed_files: int = 0
    missing_files: int = 0
    extra_files: int = 0
    files: List[FileVerification] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    timestamp: str = ""


@dataclass
class MHLGeneration:
    """Result of MHL file generation."""
    output_path: str
    success: bool
    total_files: int = 0
    total_bytes: int = 0
    hash_algorithm: str = ""
    duration_seconds: float = 0.0
    errors: List[str] = field(default_factory=list)


class MHLService:
    """
    Service for MHL verification and generation.

    Supports two backends:
    - mhl-tool: Pomfort's CLI tool for standard MHL
    - ascmhl: Python library for ASC-MHL (modern standard)
    """

    def __init__(self):
        self._binary_manager = BinaryManager()
        self._mhl_path: Optional[Path] = None
        self._ascmhl_available: Optional[bool] = None

    @property
    def is_mhl_tool_available(self) -> bool:
        """Check if mhl-tool CLI is available."""
        return self._binary_manager.is_available("mhl")

    @property
    def is_ascmhl_available(self) -> bool:
        """Check if Python ascmhl library is available."""
        if self._ascmhl_available is None:
            try:
                import ascmhl
                self._ascmhl_available = True
            except ImportError:
                self._ascmhl_available = False
        return self._ascmhl_available

    @property
    def mhl_tool_path(self) -> Optional[Path]:
        """Get the path to the mhl-tool binary."""
        if self._mhl_path is None:
            self._mhl_path = self._binary_manager.get_binary_path("mhl")
        return self._mhl_path

    def verify_mhl(self, mhl_path: str) -> VerificationResult:
        """
        Verify files against an MHL file.

        Args:
            mhl_path: Path to the MHL file

        Returns:
            VerificationResult with details of verification
        """
        path = Path(mhl_path)
        if not path.exists():
            return VerificationResult(
                mhl_path=mhl_path,
                success=False,
                errors=[f"MHL file not found: {mhl_path}"]
            )

        # Try mhl-tool first
        if self.is_mhl_tool_available:
            return self._verify_with_mhl_tool(path)

        # Fall back to Python parsing
        return self._verify_with_python(path)

    def verify_asc_mhl(self, folder_path: str) -> VerificationResult:
        """
        Verify files using ASC-MHL history in a folder.

        Args:
            folder_path: Path to folder with ASC-MHL history

        Returns:
            VerificationResult with details
        """
        if not self.is_ascmhl_available:
            return VerificationResult(
                mhl_path=folder_path,
                success=False,
                errors=["ascmhl library not installed"]
            )

        try:
            from ascmhl import MHLHistory

            history = MHLHistory.from_path(folder_path)
            result = VerificationResult(
                mhl_path=folder_path,
                success=True,
                timestamp=datetime.now().isoformat()
            )

            # Verify all files in history
            for item in history.items:
                for hash_entry in item.hash_entries:
                    verification = FileVerification(
                        file_path=str(item.path),
                        status=VerificationStatus.OK,
                        expected_hash=hash_entry.hash_string,
                        hash_algorithm=hash_entry.hash_type,
                        file_size=item.size or 0
                    )

                    # Verify the file
                    file_path = Path(folder_path) / item.path
                    if not file_path.exists():
                        verification.status = VerificationStatus.MISSING
                        result.missing_files += 1
                    else:
                        # Use ascmhl's verification
                        try:
                            if item.verify():
                                verification.status = VerificationStatus.OK
                                result.verified_files += 1
                            else:
                                verification.status = VerificationStatus.FAILED
                                result.failed_files += 1
                        except Exception as e:
                            verification.status = VerificationStatus.ERROR
                            verification.message = str(e)
                            result.failed_files += 1

                    result.files.append(verification)
                    result.total_files += 1

            result.success = result.failed_files == 0 and result.missing_files == 0
            return result

        except Exception as e:
            return VerificationResult(
                mhl_path=folder_path,
                success=False,
                errors=[str(e)]
            )

    def generate_mhl(
        self,
        folder_path: str,
        output_path: str,
        algorithm: HashAlgorithm = HashAlgorithm.XXH64
    ) -> MHLGeneration:
        """
        Generate an MHL file for a folder.

        Args:
            folder_path: Path to folder to hash
            output_path: Path for output MHL file
            algorithm: Hash algorithm to use

        Returns:
            MHLGeneration result
        """
        folder = Path(folder_path)
        if not folder.exists() or not folder.is_dir():
            return MHLGeneration(
                output_path=output_path,
                success=False,
                errors=[f"Folder not found: {folder_path}"]
            )

        # Try mhl-tool first
        if self.is_mhl_tool_available:
            return self._generate_with_mhl_tool(folder, Path(output_path), algorithm)

        # Fall back to Python generation
        return self._generate_with_python(folder, Path(output_path), algorithm)

    def generate_asc_mhl(
        self,
        folder_path: str,
        algorithm: HashAlgorithm = HashAlgorithm.XXH128
    ) -> MHLGeneration:
        """
        Generate ASC-MHL manifest for a folder.

        Args:
            folder_path: Path to folder
            algorithm: Hash algorithm

        Returns:
            MHLGeneration result
        """
        if not self.is_ascmhl_available:
            return MHLGeneration(
                output_path=folder_path,
                success=False,
                errors=["ascmhl library not installed"]
            )

        try:
            from ascmhl import MHLCreator
            from ascmhl.hasher import HashType

            # Map algorithm
            hash_map = {
                HashAlgorithm.XXH64: HashType.xxh64,
                HashAlgorithm.XXH128: HashType.xxh128,
                HashAlgorithm.SHA256: HashType.sha256,
                HashAlgorithm.MD5: HashType.md5,
            }
            hash_type = hash_map.get(algorithm, HashType.xxh128)

            folder = Path(folder_path)
            creator = MHLCreator(folder)

            start_time = datetime.now()
            result = creator.create(hash_types=[hash_type])
            duration = (datetime.now() - start_time).total_seconds()

            return MHLGeneration(
                output_path=str(folder / "ascmhl"),
                success=True,
                total_files=len(result.items) if result else 0,
                hash_algorithm=algorithm.value,
                duration_seconds=duration
            )

        except Exception as e:
            return MHLGeneration(
                output_path=folder_path,
                success=False,
                errors=[str(e)]
            )

    def parse_mhl(self, mhl_path: str) -> List[Tuple[str, str, str, int]]:
        """
        Parse an MHL file and return file entries.

        Args:
            mhl_path: Path to MHL file

        Returns:
            List of (file_path, hash, algorithm, size) tuples
        """
        path = Path(mhl_path)
        if not path.exists():
            return []

        try:
            tree = ET.parse(path)
            root = tree.getroot()

            entries = []
            for hash_elem in root.iter("hash"):
                file_path = hash_elem.findtext("file", "")
                size = int(hash_elem.findtext("size", "0"))

                # Find hash value (can be md5, sha1, xxhash64, etc.)
                for algo in ["xxhash64", "xxhash128", "sha256", "sha1", "md5"]:
                    hash_value = hash_elem.findtext(algo)
                    if hash_value:
                        entries.append((file_path, hash_value, algo, size))
                        break

            return entries

        except ET.ParseError:
            return []

    def _verify_with_mhl_tool(self, mhl_path: Path) -> VerificationResult:
        """Verify using mhl-tool CLI."""
        try:
            start_time = datetime.now()
            result = subprocess.run(
                [str(self.mhl_tool_path), "verify", str(mhl_path)],
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout for large verifications
            )
            duration = (datetime.now() - start_time).total_seconds()

            verification = VerificationResult(
                mhl_path=str(mhl_path),
                success=result.returncode == 0,
                duration_seconds=duration,
                timestamp=datetime.now().isoformat()
            )

            # Parse output
            for line in result.stdout.splitlines():
                if "OK" in line or "PASS" in line:
                    verification.verified_files += 1
                elif "FAIL" in line:
                    verification.failed_files += 1
                elif "MISSING" in line:
                    verification.missing_files += 1

            verification.total_files = (
                verification.verified_files +
                verification.failed_files +
                verification.missing_files
            )

            if result.stderr:
                verification.errors.append(result.stderr)

            return verification

        except subprocess.TimeoutExpired:
            return VerificationResult(
                mhl_path=str(mhl_path),
                success=False,
                errors=["Verification timed out"]
            )
        except Exception as e:
            return VerificationResult(
                mhl_path=str(mhl_path),
                success=False,
                errors=[str(e)]
            )

    def _verify_with_python(self, mhl_path: Path) -> VerificationResult:
        """Verify MHL using Python XML parsing and hash verification."""
        import hashlib
        import xxhash

        result = VerificationResult(
            mhl_path=str(mhl_path),
            success=True,
            timestamp=datetime.now().isoformat()
        )

        entries = self.parse_mhl(str(mhl_path))
        if not entries:
            result.success = False
            result.errors.append("Could not parse MHL file")
            return result

        mhl_dir = mhl_path.parent

        start_time = datetime.now()

        for file_path, expected_hash, algorithm, size in entries:
            full_path = mhl_dir / file_path
            verification = FileVerification(
                file_path=file_path,
                expected_hash=expected_hash,
                hash_algorithm=algorithm,
                file_size=size,
                status=VerificationStatus.OK
            )

            if not full_path.exists():
                verification.status = VerificationStatus.MISSING
                result.missing_files += 1
            else:
                try:
                    # Calculate hash
                    if algorithm in ("xxhash64", "xxh64"):
                        hasher = xxhash.xxh64()
                    elif algorithm in ("xxhash128", "xxh128"):
                        hasher = xxhash.xxh128()
                    elif algorithm == "sha256":
                        hasher = hashlib.sha256()
                    elif algorithm == "sha1":
                        hasher = hashlib.sha1()
                    elif algorithm == "md5":
                        hasher = hashlib.md5()
                    else:
                        verification.status = VerificationStatus.ERROR
                        verification.message = f"Unknown algorithm: {algorithm}"
                        result.errors.append(verification.message)
                        continue

                    with open(full_path, "rb") as f:
                        for chunk in iter(lambda: f.read(8192), b""):
                            hasher.update(chunk)

                    actual = hasher.hexdigest()
                    verification.actual_hash = actual

                    if actual.lower() != expected_hash.lower():
                        verification.status = VerificationStatus.FAILED
                        result.failed_files += 1
                    else:
                        result.verified_files += 1

                except Exception as e:
                    verification.status = VerificationStatus.ERROR
                    verification.message = str(e)
                    result.errors.append(str(e))

            result.files.append(verification)
            result.total_files += 1

        result.duration_seconds = (datetime.now() - start_time).total_seconds()
        result.success = result.failed_files == 0 and result.missing_files == 0
        return result

    def _generate_with_mhl_tool(
        self,
        folder: Path,
        output: Path,
        algorithm: HashAlgorithm
    ) -> MHLGeneration:
        """Generate MHL using mhl-tool CLI."""
        try:
            algo_map = {
                HashAlgorithm.MD5: "md5",
                HashAlgorithm.SHA1: "sha1",
                HashAlgorithm.SHA256: "sha256",
                HashAlgorithm.XXH64: "xxhash64",
                HashAlgorithm.XXH128: "xxhash128",
            }

            start_time = datetime.now()
            result = subprocess.run(
                [
                    str(self.mhl_tool_path),
                    "create",
                    "-t", algo_map.get(algorithm, "xxhash64"),
                    "-o", str(output),
                    str(folder)
                ],
                capture_output=True,
                text=True,
                timeout=3600
            )
            duration = (datetime.now() - start_time).total_seconds()

            return MHLGeneration(
                output_path=str(output),
                success=result.returncode == 0,
                hash_algorithm=algorithm.value,
                duration_seconds=duration,
                errors=[result.stderr] if result.stderr else []
            )

        except Exception as e:
            return MHLGeneration(
                output_path=str(output),
                success=False,
                errors=[str(e)]
            )

    def _generate_with_python(
        self,
        folder: Path,
        output: Path,
        algorithm: HashAlgorithm
    ) -> MHLGeneration:
        """Generate MHL using Python (basic implementation)."""
        import hashlib
        import xxhash
        from datetime import datetime

        result = MHLGeneration(
            output_path=str(output),
            success=True,
            hash_algorithm=algorithm.value
        )

        try:
            start_time = datetime.now()
            entries = []
            total_bytes = 0

            for file_path in folder.rglob("*"):
                if file_path.is_file() and not file_path.name.endswith(".mhl"):
                    relative = file_path.relative_to(folder)
                    size = file_path.stat().st_size
                    total_bytes += size

                    # Calculate hash
                    if algorithm == HashAlgorithm.XXH64:
                        hasher = xxhash.xxh64()
                        hash_tag = "xxhash64"
                    elif algorithm == HashAlgorithm.XXH128:
                        hasher = xxhash.xxh128()
                        hash_tag = "xxhash128"
                    elif algorithm == HashAlgorithm.SHA256:
                        hasher = hashlib.sha256()
                        hash_tag = "sha256"
                    elif algorithm == HashAlgorithm.MD5:
                        hasher = hashlib.md5()
                        hash_tag = "md5"
                    else:
                        hasher = xxhash.xxh64()
                        hash_tag = "xxhash64"

                    with open(file_path, "rb") as f:
                        for chunk in iter(lambda: f.read(8192), b""):
                            hasher.update(chunk)

                    entries.append({
                        "file": str(relative),
                        "size": size,
                        "hash": hasher.hexdigest(),
                        "hash_tag": hash_tag,
                        "lastmodificationdate": datetime.fromtimestamp(
                            file_path.stat().st_mtime
                        ).isoformat()
                    })

            # Generate MHL XML
            xml_content = self._generate_mhl_xml(entries, folder.name)
            output.write_text(xml_content)

            result.total_files = len(entries)
            result.total_bytes = total_bytes
            result.duration_seconds = (datetime.now() - start_time).total_seconds()

        except Exception as e:
            result.success = False
            result.errors.append(str(e))

        return result

    def _generate_mhl_xml(self, entries: List[Dict], folder_name: str) -> str:
        """Generate MHL XML content."""
        now = datetime.now().isoformat()

        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="1.1">
  <creatorinfo>
    <name>SWN Dailies Helper</name>
    <username>system</username>
    <hostname>local</hostname>
    <tool>SWN Dailies Helper MHL Generator</tool>
    <startdate>{now}</startdate>
    <finishdate>{now}</finishdate>
  </creatorinfo>
"""

        for entry in entries:
            xml += f"""  <hash>
    <file>{entry['file']}</file>
    <size>{entry['size']}</size>
    <lastmodificationdate>{entry['lastmodificationdate']}</lastmodificationdate>
    <{entry['hash_tag']}>{entry['hash']}</{entry['hash_tag']}>
  </hash>
"""

        xml += "</hashlist>\n"
        return xml


# Singleton instance
_service: Optional[MHLService] = None


def get_mhl_service() -> MHLService:
    """Get the singleton MHL service instance."""
    global _service
    if _service is None:
        _service = MHLService()
    return _service
