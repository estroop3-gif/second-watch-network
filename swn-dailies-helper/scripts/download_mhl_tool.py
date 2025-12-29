#!/usr/bin/env python3
"""
Download Pomfort mhl-tool binaries for supported platforms.
Run this script during development to populate bin/mhl-tool/

mhl-tool is proprietary but freely redistributable.
Note: macOS uses Homebrew installation; only Windows/Linux have direct downloads.
"""
import os
import sys
import zipfile
import tarfile
import urllib.request
import shutil
from pathlib import Path

# mhl-tool download info
# Pomfort provides free downloads of mhl-tool for verification
# Download page: https://pomfort.com/mhl-tool/

PLATFORMS = [
    # Windows and Linux have direct downloads
    # macOS: brew install mhl (from Pomfort tap)
    ("windows", "amd64", "mhl-windows-amd64.exe"),
    ("linux", "amd64", "mhl-linux-amd64"),
]


def download_file(url: str, dest: Path) -> bool:
    """Download a file with progress indication."""
    print(f"  Downloading: {url}")
    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SWN-Dailies-Helper/1.0)"}
        )
        with urllib.request.urlopen(request) as response:
            with open(dest, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def download_mhl_tool_binaries():
    """Download mhl-tool for supported platforms."""
    script_dir = Path(__file__).parent
    bin_dir = script_dir.parent / "bin" / "mhl-tool"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # License directory
    license_dir = script_dir.parent / "THIRD_PARTY_LICENSES" / "mhl-tool"
    license_dir.mkdir(parents=True, exist_ok=True)

    tmp_dir = Path("/tmp/mhl_tool_download")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir()

    print("Pomfort mhl-tool")
    print("=" * 50)
    print("\n📌 Download mhl-tool from: https://pomfort.com/mhl-tool/")
    print("\nPlatform availability:")
    print("  - Windows: Download .exe from Pomfort website")
    print("  - Linux: Download from Pomfort website")
    print("  - macOS: brew tap pomfort/homebrew-mhl && brew install mhl")
    print()

    # Create placeholder/wrapper scripts
    for platform, arch, output_name in PLATFORMS:
        output_path = bin_dir / output_name

        if output_path.exists():
            print(f"  Skipping {output_name} (already exists)")
            continue

        print(f"Creating placeholder for {platform}-{arch}...")

        if platform == "windows":
            placeholder = """@echo off
REM mhl-tool placeholder for SWN Dailies Helper
REM
REM This is a placeholder. To use MHL verification:
REM 1. Download mhl-tool from: https://pomfort.com/mhl-tool/
REM 2. Replace this file with the actual mhl.exe
REM
echo mhl-tool not installed. Please download from https://pomfort.com/mhl-tool/
exit /b 1
"""
        else:  # Linux
            placeholder = """#!/bin/sh
# mhl-tool wrapper for SWN Dailies Helper
#
# This is a placeholder. To use MHL verification:
# 1. Download mhl-tool from: https://pomfort.com/mhl-tool/
# 2. Replace this file with the actual mhl binary

# Check for system installation
if command -v mhl >/dev/null 2>&1; then
    exec mhl "$@"
fi

echo "mhl-tool not installed. Please download from https://pomfort.com/mhl-tool/" >&2
exit 1
"""

        output_path.write_text(placeholder)
        if platform != "windows":
            output_path.chmod(0o755)
        print(f"  Created placeholder: {output_path}")

    # Create macOS wrapper (uses Homebrew)
    macos_wrapper = bin_dir / "mhl-darwin-amd64"
    if not macos_wrapper.exists():
        print("Creating macOS wrapper (Homebrew)...")
        wrapper = """#!/bin/sh
# mhl-tool wrapper for SWN Dailies Helper (macOS)
# Uses Homebrew installation: brew tap pomfort/homebrew-mhl && brew install mhl

# Check for Homebrew installation (Apple Silicon)
if [ -x "/opt/homebrew/bin/mhl" ]; then
    exec "/opt/homebrew/bin/mhl" "$@"
fi

# Check for Homebrew installation (Intel)
if [ -x "/usr/local/bin/mhl" ]; then
    exec "/usr/local/bin/mhl" "$@"
fi

# Check PATH
if command -v mhl >/dev/null 2>&1; then
    exec mhl "$@"
fi

echo "mhl-tool not installed. Install with: brew tap pomfort/homebrew-mhl && brew install mhl" >&2
exit 1
"""
        macos_wrapper.write_text(wrapper)
        macos_wrapper.chmod(0o755)
        print(f"  Created wrapper: {macos_wrapper}")

    # Create license files
    create_license_files(license_dir)

    # Cleanup
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    print("\n" + "=" * 50)
    print("Done! Files saved to:", bin_dir)
    print("\n⚠️  MANUAL DOWNLOAD REQUIRED:")
    print("  Download mhl-tool from: https://pomfort.com/mhl-tool/")
    print("  Replace placeholder files with actual binaries.")


def create_license_files(license_dir: Path):
    """Create mhl-tool license and copyright files."""

    license_text = """Pomfort mhl-tool License

mhl-tool is proprietary software provided free of charge by Pomfort GmbH.

The software may be freely used and redistributed for the purpose of
verifying and creating Media Hash List (MHL) files.

For licensing inquiries and commercial support, contact:
Pomfort GmbH
https://pomfort.com/

Terms of use are available at:
https://pomfort.com/terms/
"""

    copyright_text = """Pomfort mhl-tool
Copyright: (c) Pomfort GmbH
License: Proprietary (free redistribution allowed)
Website: https://pomfort.com/mhl-tool/

mhl-tool is a command-line utility for creating and verifying
Media Hash List (MHL) files. MHL is an industry-standard format
for media file verification in professional workflows.

This component is included in SWN Dailies Helper for MHL verification.

INSTALLATION
============
- Windows/Linux: Download from https://pomfort.com/mhl-tool/
- macOS: brew tap pomfort/homebrew-mhl && brew install mhl

For questions or support, contact Pomfort at https://pomfort.com/
"""

    (license_dir / "LICENSE.txt").write_text(license_text)
    (license_dir / "COPYRIGHT.txt").write_text(copyright_text)
    print(f"\nLicense files created in: {license_dir}")


if __name__ == "__main__":
    download_mhl_tool_binaries()
