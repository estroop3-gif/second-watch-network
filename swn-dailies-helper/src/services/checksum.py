"""
Checksum calculation using XXH64.
Fast and reliable checksums for verifying file integrity during offload.

Uses memory-mapped I/O for large files to minimize memory usage
while maintaining high throughput.
"""
import mmap
import os
from pathlib import Path
from typing import Callable, Optional, List, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import xxhash
    HAS_XXHASH = True
except ImportError:
    HAS_XXHASH = False
    import hashlib

# Constants
CHUNK_SIZE = 64 * 1024 * 1024  # 64MB chunks for optimal performance
MMAP_THRESHOLD = 1024 * 1024 * 1024  # Use mmap for files > 1GB


@dataclass
class ChecksumResult:
    """Result of a checksum calculation."""
    file_path: str
    file_size: int
    checksum: str
    success: bool
    error_message: Optional[str] = None


@dataclass
class VerificationResult:
    """Result of comparing checksums."""
    source_path: str
    dest_path: str
    source_checksum: str
    dest_checksum: str
    match: bool
    file_size: int


def calculate_xxh64(
    file_path: str,
    chunk_size: int = CHUNK_SIZE,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> str:
    """
    Calculate XXH64 checksum for a file.

    Args:
        file_path: Path to the file
        chunk_size: Size of chunks to read (default 64MB)
        progress_callback: Optional callback(bytes_read, total_bytes) for progress

    Returns:
        Hexadecimal checksum string
    """
    path = Path(file_path)
    total_size = path.stat().st_size
    bytes_read = 0

    if HAS_XXHASH:
        hasher = xxhash.xxh64()
    else:
        hasher = hashlib.sha256()

    # Use memory-mapped I/O for large files
    if total_size > MMAP_THRESHOLD:
        with open(path, "rb") as f:
            with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
                while bytes_read < total_size:
                    end = min(bytes_read + chunk_size, total_size)
                    hasher.update(mm[bytes_read:end])
                    bytes_read = end
                    if progress_callback:
                        progress_callback(bytes_read, total_size)
    else:
        with open(path, "rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
                bytes_read += len(chunk)
                if progress_callback:
                    progress_callback(bytes_read, total_size)

    return hasher.hexdigest()


def verify_checksum(file_path: str, expected_checksum: str) -> bool:
    """
    Verify a file matches an expected XXH64 checksum.

    Args:
        file_path: Path to the file
        expected_checksum: Expected hexadecimal checksum

    Returns:
        True if checksums match, False otherwise
    """
    actual = calculate_xxh64(file_path)
    return actual.lower() == expected_checksum.lower()


def compute_checksum_safe(
    file_path: str,
    progress_callback: Optional[Callable[[float], None]] = None
) -> ChecksumResult:
    """
    Safely compute checksum with error handling.

    Args:
        file_path: Path to the file
        progress_callback: Optional callback with progress (0.0-1.0)

    Returns:
        ChecksumResult with success/failure info
    """
    path = Path(file_path)

    if not path.exists():
        return ChecksumResult(
            file_path=str(path),
            file_size=0,
            checksum="",
            success=False,
            error_message="File not found"
        )

    try:
        file_size = path.stat().st_size

        def wrapper_callback(bytes_read: int, total: int):
            if progress_callback and total > 0:
                progress_callback(bytes_read / total)

        checksum = calculate_xxh64(str(path), progress_callback=wrapper_callback)

        return ChecksumResult(
            file_path=str(path),
            file_size=file_size,
            checksum=checksum,
            success=True
        )

    except Exception as e:
        return ChecksumResult(
            file_path=str(path),
            file_size=0,
            checksum="",
            success=False,
            error_message=str(e)
        )


def verify_copy(
    source_path: str,
    dest_path: str,
    progress_callback: Optional[Callable[[float], None]] = None
) -> VerificationResult:
    """
    Verify that a copied file matches the source.

    Args:
        source_path: Path to source file
        dest_path: Path to destination file
        progress_callback: Optional progress callback (0.0-1.0)

    Returns:
        VerificationResult with comparison details
    """
    # Compute source checksum (0-50% progress)
    def source_progress(p: float):
        if progress_callback:
            progress_callback(p * 0.5)

    source_result = compute_checksum_safe(source_path, source_progress)

    if not source_result.success:
        return VerificationResult(
            source_path=source_path,
            dest_path=dest_path,
            source_checksum="",
            dest_checksum="",
            match=False,
            file_size=0
        )

    # Compute dest checksum (50-100% progress)
    def dest_progress(p: float):
        if progress_callback:
            progress_callback(0.5 + p * 0.5)

    dest_result = compute_checksum_safe(dest_path, dest_progress)

    return VerificationResult(
        source_path=source_path,
        dest_path=dest_path,
        source_checksum=source_result.checksum,
        dest_checksum=dest_result.checksum if dest_result.success else "",
        match=source_result.checksum == dest_result.checksum and dest_result.success,
        file_size=source_result.file_size
    )


def batch_compute(
    file_paths: List[str],
    max_workers: int = 4,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> List[ChecksumResult]:
    """
    Compute checksums for multiple files in parallel.

    Args:
        file_paths: List of file paths
        max_workers: Maximum number of parallel workers
        progress_callback: Callback(completed, total)

    Returns:
        List of ChecksumResult objects
    """
    results = []
    total = len(file_paths)
    completed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(compute_checksum_safe, fp): fp
            for fp in file_paths
        }

        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            completed += 1

            if progress_callback:
                progress_callback(completed, total)

    return results


def batch_verify(
    file_pairs: List[Tuple[str, str]],
    max_workers: int = 4,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> List[VerificationResult]:
    """
    Verify multiple file copies in parallel.

    Args:
        file_pairs: List of (source, dest) tuples
        max_workers: Maximum number of parallel workers
        progress_callback: Callback(completed, total)

    Returns:
        List of VerificationResult objects
    """
    results = []
    total = len(file_pairs)
    completed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(verify_copy, src, dst): (src, dst)
            for src, dst in file_pairs
        }

        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            completed += 1

            if progress_callback:
                progress_callback(completed, total)

    return results


def check_xxhash_available() -> bool:
    """Check if xxhash library is available."""
    return HAS_XXHASH
