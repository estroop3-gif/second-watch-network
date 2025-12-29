#!/usr/bin/env python3
"""
Download all third-party CLI binaries for bundling.

This master script downloads all required binaries for the current platform.
Run this before building the application with PyInstaller.

Usage:
    python scripts/download_all_binaries.py           # Current platform only
    python scripts/download_all_binaries.py --all     # All platforms
    python scripts/download_all_binaries.py --check   # Check availability only
"""
import argparse
import subprocess
import sys
from pathlib import Path


def get_script_dir() -> Path:
    """Get the scripts directory path."""
    return Path(__file__).parent


def run_download_script(script_name: str) -> bool:
    """Run a download script and return success status."""
    script_path = get_script_dir() / script_name

    if not script_path.exists():
        print(f"  ERROR: Script not found: {script_path}")
        return False

    print(f"\n{'='*60}")
    print(f"Running: {script_name}")
    print('='*60)

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            check=False,
            cwd=script_path.parent.parent  # Run from project root
        )
        return result.returncode == 0
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def check_binaries() -> dict:
    """Check which binaries are available."""
    from pathlib import Path
    import platform
    import shutil

    project_root = get_script_dir().parent
    bin_dir = project_root / "bin"

    # Determine current platform
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "darwin":
        os_name = "darwin"
    elif system == "windows":
        os_name = "windows"
    else:
        os_name = "linux"

    if machine in ("x86_64", "amd64"):
        arch = "amd64"
    elif machine in ("arm64", "aarch64"):
        arch = "arm64"
    else:
        arch = machine

    binaries = {
        "rclone": {
            "path": bin_dir / "rclone" / f"rclone-{os_name}-{arch}{'exe' if os_name == 'windows' else ''}",
            "fallback": "rclone",
        },
        "mediainfo": {
            "path": bin_dir / "mediainfo" / f"mediainfo-{os_name}-{arch}{'.exe' if os_name == 'windows' else ''}",
            "fallback": "mediainfo",
        },
        "exiftool": {
            "path": bin_dir / "exiftool" / f"exiftool-{os_name}-{arch}{'.exe' if os_name == 'windows' else ''}",
            "fallback": "exiftool",
        },
        "smartctl": {
            "path": bin_dir / "smartctl" / f"smartctl-{os_name}-{arch}{'.exe' if os_name == 'windows' else ''}",
            "fallback": "smartctl",
        },
        "mhl": {
            "path": bin_dir / "mhl-tool" / f"mhl-{os_name}-{arch}{'.exe' if os_name == 'windows' else ''}",
            "fallback": "mhl",
        },
    }

    results = {}
    for name, info in binaries.items():
        bundled = info["path"].exists()
        system_path = shutil.which(info["fallback"])
        results[name] = {
            "bundled": bundled,
            "bundled_path": str(info["path"]) if bundled else None,
            "system": system_path is not None,
            "system_path": system_path,
            "available": bundled or (system_path is not None),
        }

    return results


def print_status():
    """Print the current binary availability status."""
    print("\n" + "="*60)
    print("Binary Availability Status")
    print("="*60)

    results = check_binaries()

    for name, status in results.items():
        if status["available"]:
            if status["bundled"]:
                icon = "[Bundled]"
                path = status["bundled_path"]
            else:
                icon = "[System] "
                path = status["system_path"]
            print(f"  {name:12} {icon} {path}")
        else:
            print(f"  {name:12} [Missing] Not found")

    print()

    # Summary
    bundled_count = sum(1 for s in results.values() if s["bundled"])
    system_count = sum(1 for s in results.values() if s["system"] and not s["bundled"])
    missing_count = sum(1 for s in results.values() if not s["available"])

    print(f"Summary: {bundled_count} bundled, {system_count} system, {missing_count} missing")

    if missing_count > 0:
        print("\nTo download missing binaries, run:")
        print("  python scripts/download_all_binaries.py")


def download_all():
    """Download all binaries."""
    scripts = [
        "download_rclone.py",
        "download_mediainfo.py",
        "download_exiftool.py",
        "download_smartctl.py",
        "download_mhl_tool.py",
    ]

    print("="*60)
    print("Downloading All Third-Party Binaries")
    print("="*60)
    print("\nThis will download binaries for the current platform.")
    print("Some binaries may require manual download due to licensing.")
    print()

    results = {}
    for script in scripts:
        success = run_download_script(script)
        results[script] = success

    # Print summary
    print("\n" + "="*60)
    print("Download Summary")
    print("="*60)

    for script, success in results.items():
        status = "[OK]" if success else "[FAILED/PARTIAL]"
        print(f"  {script:30} {status}")

    # Print final status
    print_status()


def main():
    parser = argparse.ArgumentParser(
        description="Download third-party CLI binaries for bundling"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only check binary availability, don't download"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Download binaries for all platforms (not just current)"
    )

    args = parser.parse_args()

    if args.check:
        print_status()
        return

    download_all()


if __name__ == "__main__":
    main()
