#!/usr/bin/env python3
"""
Download MediaInfo CLI binaries for all supported platforms.
Run this script during development to populate bin/mediainfo/

MediaInfo is licensed under BSD-2-Clause.
"""
import os
import sys
import zipfile
import tarfile
import urllib.request
import shutil
from pathlib import Path

# MediaInfo version to download
MEDIAINFO_VERSION = "24.12"

# Platform configurations: (url_os, url_arch, output_name, archive_type)
PLATFORMS = [
    # macOS Intel
    ("Mac_OS", "x86_64", "mediainfo-darwin-amd64", "dmg"),
    # macOS ARM - same universal binary
    ("Mac_OS", "arm64", "mediainfo-darwin-arm64", "dmg"),
    # Windows x64
    ("Windows", "x64", "mediainfo-windows-amd64.exe", "zip"),
    # Linux x64
    ("Linux", "x86_64", "mediainfo-linux-amd64", "tar.xz"),
]


def download_file(url: str, dest: Path) -> bool:
    """Download a file with progress indication."""
    print(f"  Downloading: {url}")
    try:
        urllib.request.urlretrieve(url, dest)
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def extract_windows(zip_path: Path, output_path: Path, tmp_dir: Path) -> bool:
    """Extract MediaInfo from Windows zip."""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Find the CLI executable
            for name in zf.namelist():
                if name.endswith("MediaInfo.exe") and "CLI" in name:
                    # Extract to temp location
                    zf.extract(name, tmp_dir)
                    src = tmp_dir / name
                    shutil.copy2(src, output_path)
                    return True
            # Fallback: look for any MediaInfo.exe
            for name in zf.namelist():
                if name.endswith("MediaInfo.exe"):
                    zf.extract(name, tmp_dir)
                    src = tmp_dir / name
                    shutil.copy2(src, output_path)
                    return True
        print("  ERROR: MediaInfo.exe not found in archive")
        return False
    except Exception as e:
        print(f"  ERROR extracting: {e}")
        return False


def extract_linux(tar_path: Path, output_path: Path, tmp_dir: Path) -> bool:
    """Extract MediaInfo from Linux tar.xz."""
    try:
        with tarfile.open(tar_path, 'r:xz') as tf:
            tf.extractall(tmp_dir)

        # Find the mediainfo binary
        for path in tmp_dir.rglob("mediainfo"):
            if path.is_file() and path.stat().st_mode & 0o111:
                shutil.copy2(path, output_path)
                output_path.chmod(0o755)
                return True

        print("  ERROR: mediainfo binary not found in archive")
        return False
    except Exception as e:
        print(f"  ERROR extracting: {e}")
        return False


def extract_macos(dmg_path: Path, output_path: Path, tmp_dir: Path) -> bool:
    """
    Extract MediaInfo from macOS DMG.
    Note: This requires running on macOS with hdiutil.
    For cross-platform builds, download manually or use pre-extracted binaries.
    """
    # Check if we're on macOS
    if sys.platform != "darwin":
        print("  SKIP: macOS DMG extraction requires running on macOS")
        print("  NOTE: Download manually from https://mediaarea.net/en/MediaInfo/Download/Mac_OS")
        return False

    try:
        import subprocess

        # Mount the DMG
        mount_point = tmp_dir / "mediainfo_mount"
        mount_point.mkdir(exist_ok=True)

        result = subprocess.run(
            ["hdiutil", "attach", str(dmg_path), "-mountpoint", str(mount_point), "-nobrowse"],
            capture_output=True, text=True
        )

        if result.returncode != 0:
            print(f"  ERROR mounting DMG: {result.stderr}")
            return False

        try:
            # Find the mediainfo CLI binary
            cli_path = mount_point / "mediainfo"
            if cli_path.exists():
                shutil.copy2(cli_path, output_path)
                output_path.chmod(0o755)
                return True

            # Search for it
            for path in mount_point.rglob("mediainfo"):
                if path.is_file():
                    shutil.copy2(path, output_path)
                    output_path.chmod(0o755)
                    return True

            print("  ERROR: mediainfo binary not found in DMG")
            return False
        finally:
            # Unmount
            subprocess.run(["hdiutil", "detach", str(mount_point)], capture_output=True)

    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def download_mediainfo_binaries():
    """Download MediaInfo for all supported platforms."""
    script_dir = Path(__file__).parent
    bin_dir = script_dir.parent / "bin" / "mediainfo"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # License directory
    license_dir = script_dir.parent / "THIRD_PARTY_LICENSES" / "mediainfo"
    license_dir.mkdir(parents=True, exist_ok=True)

    tmp_dir = Path("/tmp/mediainfo_download")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir()

    print(f"Downloading MediaInfo v{MEDIAINFO_VERSION}")
    print("=" * 50)

    for url_os, url_arch, output_name, archive_type in PLATFORMS:
        output_path = bin_dir / output_name

        if output_path.exists():
            print(f"\n  Skipping {output_name} (already exists)")
            continue

        print(f"\nDownloading for {url_os}-{url_arch}...")

        # Build URL based on platform
        # MediaArea download structure:
        # https://mediaarea.net/download/binary/mediainfo/{version}/MediaInfo_CLI_{version}_{os}.{ext}

        if url_os == "Windows":
            filename = f"MediaInfo_CLI_{MEDIAINFO_VERSION}_Windows_x64.zip"
        elif url_os == "Mac_OS":
            # macOS uses universal binary DMG
            filename = f"MediaInfo_CLI_{MEDIAINFO_VERSION}_Mac.dmg"
        else:  # Linux
            filename = f"MediaInfo_CLI_{MEDIAINFO_VERSION}_GNU_FromSource.tar.xz"

        url = f"https://mediaarea.net/download/binary/mediainfo/{MEDIAINFO_VERSION}/{filename}"
        archive_path = tmp_dir / filename

        if not download_file(url, archive_path):
            continue

        # Extract based on type
        if archive_type == "zip":
            success = extract_windows(archive_path, output_path, tmp_dir)
        elif archive_type == "tar.xz":
            success = extract_linux(archive_path, output_path, tmp_dir)
        elif archive_type == "dmg":
            success = extract_macos(archive_path, output_path, tmp_dir)
        else:
            print(f"  ERROR: Unknown archive type: {archive_type}")
            success = False

        if success:
            print(f"  Saved to: {output_path}")

    # Create license files
    create_license_files(license_dir)

    # Cleanup
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    print("\n" + "=" * 50)
    print("Done! Binaries saved to:", bin_dir)
    print("\nAvailable binaries:")
    for f in sorted(bin_dir.iterdir()):
        if f.is_file():
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"  {f.name} ({size_mb:.1f} MB)")


def create_license_files(license_dir: Path):
    """Create MediaInfo license and copyright files."""

    license_text = """BSD 2-Clause License

Copyright (c) 2002-2024, MediaArea.net SARL
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
"""

    copyright_text = f"""MediaInfo CLI
Version: {MEDIAINFO_VERSION}
Copyright: (c) 2002-2024 MediaArea.net SARL
License: BSD-2-Clause
Website: https://mediaarea.net/en/MediaInfo

MediaInfo supplies technical and tag information about video and audio files.

This component is included in SWN Dailies Helper for media analysis purposes.
"""

    (license_dir / "LICENSE.txt").write_text(license_text)
    (license_dir / "COPYRIGHT.txt").write_text(copyright_text)
    print(f"\nLicense files created in: {license_dir}")


if __name__ == "__main__":
    download_mediainfo_binaries()
