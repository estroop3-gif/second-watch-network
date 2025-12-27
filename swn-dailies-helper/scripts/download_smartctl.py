#!/usr/bin/env python3
"""
Download smartmontools (smartctl) binaries for all supported platforms.
Run this script during development to populate bin/smartctl/

smartmontools is licensed under GPL-2.0.
GPL compliance requires making source code available.
"""
import os
import sys
import zipfile
import tarfile
import urllib.request
import shutil
from pathlib import Path

# smartmontools version
SMARTCTL_VERSION = "7.4"

# Platform configurations
# Note: smartmontools requires building from source for most platforms
# or using pre-built packages from various sources
PLATFORMS = [
    ("windows", "amd64", "smartctl-windows-amd64.exe"),
    ("linux", "amd64", "smartctl-linux-amd64"),
    ("darwin", "amd64", "smartctl-darwin-amd64"),
    ("darwin", "arm64", "smartctl-darwin-arm64"),
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


def download_smartctl_binaries():
    """Download smartctl for all supported platforms."""
    script_dir = Path(__file__).parent
    bin_dir = script_dir.parent / "bin" / "smartctl"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # License directory
    license_dir = script_dir.parent / "THIRD_PARTY_LICENSES" / "smartmontools"
    license_dir.mkdir(parents=True, exist_ok=True)

    tmp_dir = Path("/tmp/smartctl_download")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir()

    print(f"smartmontools v{SMARTCTL_VERSION}")
    print("=" * 50)
    print("\n⚠️  NOTE: smartmontools requires platform-specific installation:")
    print("  - Windows: Download from https://www.smartmontools.org/wiki/Download#InstalltheWindowspackage")
    print("  - macOS: brew install smartmontools")
    print("  - Linux: apt-get install smartmontools / yum install smartmontools")
    print("\nThis script creates placeholder files. For distribution,")
    print("use pre-built binaries or build from source.\n")

    # Download source tarball for GPL compliance
    print("Downloading source code for GPL compliance...")
    source_url = f"https://downloads.sourceforge.net/project/smartmontools/smartmontools/{SMARTCTL_VERSION}/smartmontools-{SMARTCTL_VERSION}.tar.gz"
    source_path = tmp_dir / f"smartmontools-{SMARTCTL_VERSION}.tar.gz"

    # Try to download source for license compliance
    if download_file(source_url, source_path):
        print(f"  Source saved to: {source_path}")
        print("  This should be hosted at secondwatchnetwork.com/opensource/")
    else:
        print("  Could not download source. Download manually from:")
        print(f"  https://www.smartmontools.org/browser/tags/RELEASE_{SMARTCTL_VERSION.replace('.', '_')}")

    # For Windows, try to download from SF
    windows_output = bin_dir / "smartctl-windows-amd64.exe"
    if not windows_output.exists():
        print("\nWindows: Attempting download from SourceForge...")
        # Windows installer is an exe, we need the CLI only
        # The installer contains smartctl.exe in the bin directory
        win_url = f"https://downloads.sourceforge.net/project/smartmontools/smartmontools/{SMARTCTL_VERSION}/smartmontools-{SMARTCTL_VERSION}-1.win32-setup.exe"
        print(f"  NOTE: Windows requires manual extraction from installer")
        print(f"  Download: {win_url}")
        print(f"  Extract smartctl.exe and rename to: {windows_output.name}")

        # Create a placeholder script
        placeholder = f"""@echo off
REM smartctl placeholder for SWN Dailies Helper
REM
REM This is a placeholder. To use SMART monitoring:
REM 1. Download smartmontools from: https://www.smartmontools.org/wiki/Download
REM 2. Replace this file with the actual smartctl.exe
REM
echo smartctl not installed. Please install smartmontools.
exit /b 1
"""
        windows_output.write_text(placeholder)
        print(f"  Created placeholder: {windows_output}")

    # For macOS and Linux, create placeholder scripts
    for platform, arch, output_name in [
        ("darwin", "amd64", "smartctl-darwin-amd64"),
        ("darwin", "arm64", "smartctl-darwin-arm64"),
        ("linux", "amd64", "smartctl-linux-amd64"),
    ]:
        output_path = bin_dir / output_name

        if output_path.exists():
            print(f"\n  Skipping {output_name} (already exists)")
            continue

        print(f"\nCreating placeholder for {platform}-{arch}...")

        # Create a placeholder that checks for system installation
        if platform == "darwin":
            system_path = "/usr/local/bin/smartctl"
            brew_path = "/opt/homebrew/bin/smartctl"
            placeholder = f"""#!/bin/sh
# smartctl wrapper for SWN Dailies Helper
# smartmontools v{SMARTCTL_VERSION} - GPL-2.0 Licensed

# Check for Homebrew installation
if [ -x "{brew_path}" ]; then
    exec "{brew_path}" "$@"
fi

# Check for Intel Mac Homebrew
if [ -x "{system_path}" ]; then
    exec "{system_path}" "$@"
fi

# Not found
echo "smartctl not installed. Install with: brew install smartmontools" >&2
exit 1
"""
        else:  # Linux
            placeholder = f"""#!/bin/sh
# smartctl wrapper for SWN Dailies Helper
# smartmontools v{SMARTCTL_VERSION} - GPL-2.0 Licensed

# Check for system installation
if command -v smartctl >/dev/null 2>&1; then
    exec smartctl "$@"
fi

# Not found
echo "smartctl not installed. Install with: apt-get install smartmontools" >&2
exit 1
"""

        output_path.write_text(placeholder)
        output_path.chmod(0o755)
        print(f"  Created wrapper: {output_path}")

    # Create license files
    create_license_files(license_dir)

    # Cleanup
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    print("\n" + "=" * 50)
    print("Done! Files saved to:", bin_dir)
    print("\n⚠️  GPL-2.0 COMPLIANCE NOTE:")
    print("  smartmontools is licensed under GPL-2.0.")
    print("  Source code must be made available for distribution.")
    print(f"  Source: https://www.smartmontools.org/browser/tags/RELEASE_{SMARTCTL_VERSION.replace('.', '_')}")


def create_license_files(license_dir: Path):
    """Create smartmontools license and copyright files."""

    license_text = """GNU GENERAL PUBLIC LICENSE
Version 2, June 1991

The full text of this license can be found at:
https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt

SPDX Identifier: GPL-2.0-only

smartmontools is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

smartmontools is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
"""

    copyright_text = f"""smartmontools (smartctl)
Version: {SMARTCTL_VERSION}
Copyright: (c) 2002-2024 Bruce Allen, Christian Franke, and others
License: GPL-2.0-only
Website: https://www.smartmontools.org/

smartmontools contains the smartctl utility, which controls and monitors
storage devices using the Self-Monitoring, Analysis and Reporting Technology
(SMART) system built into most modern ATA/SATA, SCSI/SAS and NVMe disks.

This component is included in SWN Dailies Helper for drive health monitoring.

SOURCE CODE AVAILABILITY
========================
As required by the GPL-2.0 license, source code for smartmontools is available at:
https://secondwatchnetwork.com/opensource/

Or directly from the project at:
https://www.smartmontools.org/browser/tags/RELEASE_{SMARTCTL_VERSION.replace('.', '_')}
"""

    (license_dir / "LICENSE.txt").write_text(license_text)
    (license_dir / "COPYRIGHT.txt").write_text(copyright_text)
    print(f"\nLicense files created in: {license_dir}")


if __name__ == "__main__":
    download_smartctl_binaries()
