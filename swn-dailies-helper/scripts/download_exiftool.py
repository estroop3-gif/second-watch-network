#!/usr/bin/env python3
"""
Download ExifTool binaries for all supported platforms.
Run this script during development to populate bin/exiftool/

ExifTool is licensed under GPL-1.0+ or Artistic License.
GPL compliance requires making source code available.
"""
import os
import sys
import zipfile
import tarfile
import urllib.request
import shutil
from pathlib import Path

# ExifTool version to download
EXIFTOOL_VERSION = "12.97"

# Platform configurations
# ExifTool provides:
# - Windows: Standalone .exe (no Perl needed)
# - macOS/Linux: Perl distribution (requires Perl) OR we can use the Perl-free portable
PLATFORMS = [
    ("windows", "exiftool-windows-amd64.exe"),
    ("linux", "exiftool-linux-amd64"),
    ("darwin", "exiftool-darwin-amd64"),  # Universal works on ARM too
]


def download_file(url: str, dest: Path) -> bool:
    """Download a file with progress indication."""
    print(f"  Downloading: {url}")
    try:
        # Add headers to avoid 403
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


def download_exiftool_binaries():
    """Download ExifTool for all supported platforms."""
    script_dir = Path(__file__).parent
    bin_dir = script_dir.parent / "bin" / "exiftool"
    bin_dir.mkdir(parents=True, exist_ok=True)

    # License directory
    license_dir = script_dir.parent / "THIRD_PARTY_LICENSES" / "exiftool"
    license_dir.mkdir(parents=True, exist_ok=True)

    tmp_dir = Path("/tmp/exiftool_download")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir()

    print(f"Downloading ExifTool v{EXIFTOOL_VERSION}")
    print("=" * 50)

    # Download Windows standalone exe
    windows_output = bin_dir / "exiftool-windows-amd64.exe"
    if not windows_output.exists():
        print("\nDownloading for Windows...")
        # Windows standalone exe from exiftool.org
        url = f"https://exiftool.org/exiftool-{EXIFTOOL_VERSION}.zip"
        zip_path = tmp_dir / "exiftool-windows.zip"

        if download_file(url, zip_path):
            try:
                with zipfile.ZipFile(zip_path, 'r') as zf:
                    zf.extractall(tmp_dir)

                # The exe is named exiftool(-k).exe, we rename it
                for f in tmp_dir.iterdir():
                    if f.suffix == ".exe":
                        shutil.copy2(f, windows_output)
                        print(f"  Saved to: {windows_output}")
                        break
            except Exception as e:
                print(f"  ERROR extracting: {e}")
    else:
        print(f"\n  Skipping Windows (already exists)")

    # Download Perl distribution for macOS/Linux
    # These platforms need either Perl installed or we package the full distribution
    for platform, output_name in [("linux", "exiftool-linux-amd64"), ("darwin", "exiftool-darwin-amd64")]:
        output_path = bin_dir / output_name

        if output_path.exists():
            print(f"\n  Skipping {platform} (already exists)")
            continue

        print(f"\nDownloading for {platform}...")

        # Download the Perl distribution
        url = f"https://exiftool.org/Image-ExifTool-{EXIFTOOL_VERSION}.tar.gz"
        tar_path = tmp_dir / f"exiftool-{platform}.tar.gz"

        if not download_file(url, tar_path):
            continue

        try:
            with tarfile.open(tar_path, 'r:gz') as tf:
                tf.extractall(tmp_dir)

            # Find the exiftool script
            extracted_dir = tmp_dir / f"Image-ExifTool-{EXIFTOOL_VERSION}"
            exiftool_script = extracted_dir / "exiftool"

            if exiftool_script.exists():
                # Create a wrapper script that includes the lib directory
                # For distribution, we need to package both the script and lib/

                # Option 1: Create a self-contained script with embedded paths
                # Option 2: Package the full distribution

                # For now, we'll create a wrapper that expects lib/ to be alongside
                wrapper_content = f"""#!/bin/sh
# ExifTool wrapper for SWN Dailies Helper
# Version: {EXIFTOOL_VERSION}
# License: GPL-1.0+ / Artistic License

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec perl "$SCRIPT_DIR/exiftool.pl" "$@"
"""
                output_path.write_text(wrapper_content)
                output_path.chmod(0o755)

                # Copy the actual Perl script
                perl_script = bin_dir / "exiftool.pl"
                shutil.copy2(exiftool_script, perl_script)
                perl_script.chmod(0o755)

                # Copy the lib directory
                lib_src = extracted_dir / "lib"
                lib_dst = bin_dir / "lib"
                if lib_dst.exists():
                    shutil.rmtree(lib_dst)
                shutil.copytree(lib_src, lib_dst)

                print(f"  Saved to: {output_path}")
                print(f"  Note: Requires Perl runtime on {platform}")
            else:
                print(f"  ERROR: exiftool script not found")

        except Exception as e:
            print(f"  ERROR extracting: {e}")

    # Create license files
    create_license_files(license_dir)

    # Cleanup
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    print("\n" + "=" * 50)
    print("Done! Binaries saved to:", bin_dir)
    print("\nAvailable files:")
    for f in sorted(bin_dir.iterdir()):
        if f.is_file():
            size_kb = f.stat().st_size / 1024
            print(f"  {f.name} ({size_kb:.1f} KB)")

    print("\n⚠️  GPL COMPLIANCE NOTE:")
    print("  ExifTool is licensed under GPL-1.0+ / Artistic License.")
    print("  Source code must be made available for distribution.")
    print(f"  Source: https://exiftool.org/Image-ExifTool-{EXIFTOOL_VERSION}.tar.gz")


def create_license_files(license_dir: Path):
    """Create ExifTool license and copyright files."""

    license_text = """ExifTool License

ExifTool is free software; you can redistribute it and/or modify
it under the same terms as Perl itself:

1. GNU General Public License (GPL) version 1 or later
   https://www.gnu.org/licenses/gpl-1.0.html

   OR

2. Artistic License
   https://opensource.org/licenses/Artistic-1.0

You may choose either license for redistribution.

---

GNU GENERAL PUBLIC LICENSE
Version 1, February 1989

The full text of the GPL-1.0 license can be found at:
https://www.gnu.org/licenses/gpl-1.0.txt

---

For the Artistic License text, see:
https://opensource.org/licenses/Artistic-1.0
"""

    copyright_text = f"""ExifTool
Version: {EXIFTOOL_VERSION}
Copyright: (c) 2003-2024 Phil Harvey
License: GPL-1.0-or-later OR Artistic-1.0
Website: https://exiftool.org/

ExifTool is a platform-independent Perl library plus a command-line
application for reading, writing and editing meta information in a
wide variety of files.

This component is included in SWN Dailies Helper for metadata extraction.

SOURCE CODE AVAILABILITY
========================
As required by the GPL license, source code for ExifTool is available at:
https://secondwatchnetwork.com/opensource/

Or directly from the author at:
https://exiftool.org/Image-ExifTool-{EXIFTOOL_VERSION}.tar.gz
"""

    (license_dir / "LICENSE.txt").write_text(license_text)
    (license_dir / "COPYRIGHT.txt").write_text(copyright_text)
    print(f"\nLicense files created in: {license_dir}")


if __name__ == "__main__":
    download_exiftool_binaries()
