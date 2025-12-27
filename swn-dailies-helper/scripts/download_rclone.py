#!/usr/bin/env python3
"""
Download rclone binaries for all supported platforms.
Run this script during development to populate bin/rclone/
"""
import os
import sys
import zipfile
import urllib.request
import shutil
from pathlib import Path

RCLONE_VERSION = "v1.68.2"

PLATFORMS = [
    ("osx", "amd64", "rclone-darwin-amd64"),
    ("osx", "arm64", "rclone-darwin-arm64"),
    ("windows", "amd64", "rclone-windows-amd64.exe"),
    ("linux", "amd64", "rclone-linux-amd64"),
]

def download_rclone_binaries():
    """Download rclone for all supported platforms."""
    script_dir = Path(__file__).parent
    bin_dir = script_dir.parent / "bin" / "rclone"
    bin_dir.mkdir(parents=True, exist_ok=True)

    tmp_dir = Path("/tmp/rclone_download")
    tmp_dir.mkdir(exist_ok=True)

    for os_name, arch, output_name in PLATFORMS:
        output_path = bin_dir / output_name

        if output_path.exists():
            print(f"  Skipping {output_name} (already exists)")
            continue

        print(f"Downloading rclone for {os_name}-{arch}...")

        # Build download URL
        url = f"https://downloads.rclone.org/{RCLONE_VERSION}/rclone-{RCLONE_VERSION}-{os_name}-{arch}.zip"
        zip_path = tmp_dir / f"rclone-{os_name}-{arch}.zip"

        try:
            # Download
            print(f"  URL: {url}")
            urllib.request.urlretrieve(url, zip_path)

            # Extract
            extract_dir = tmp_dir / f"rclone-{os_name}-{arch}"
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(tmp_dir)

            # Find the rclone binary in extracted files
            extracted_folder = tmp_dir / f"rclone-{RCLONE_VERSION}-{os_name}-{arch}"
            if os_name == "windows":
                binary_name = "rclone.exe"
            else:
                binary_name = "rclone"

            source_binary = extracted_folder / binary_name

            if not source_binary.exists():
                print(f"  ERROR: Binary not found at {source_binary}")
                continue

            # Copy to bin directory with platform-specific name
            shutil.copy2(source_binary, output_path)

            # Make executable on Unix
            if os_name != "windows":
                output_path.chmod(0o755)

            print(f"  Saved to {output_path}")

            # Cleanup
            if zip_path.exists():
                zip_path.unlink()
            if extracted_folder.exists():
                shutil.rmtree(extracted_folder)

        except Exception as e:
            print(f"  ERROR downloading {os_name}-{arch}: {e}")

    # Cleanup tmp dir
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    print("\nDone! Binaries saved to:", bin_dir)
    print("\nAvailable binaries:")
    for f in sorted(bin_dir.iterdir()):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    download_rclone_binaries()
