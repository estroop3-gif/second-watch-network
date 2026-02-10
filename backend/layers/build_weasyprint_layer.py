#!/usr/bin/env python3
"""
Build WeasyPrint system dependencies Lambda layer for arm64/AL2023.
Downloads ARM64 RPMs from AL2023 repos and extracts shared libraries.
No Docker required.
"""
import os
import io
import gzip
import shutil
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import rpmfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LAYER_DIR = os.path.join(SCRIPT_DIR, "weasyprint-deps")
LIB_DIR = os.path.join(LAYER_DIR, "lib")

# AL2023 ARM64 repo
MIRROR_LIST_URL = "https://al2023-repos-us-east-1-de612dc2.s3.dualstack.us-east-1.amazonaws.com/core/mirrors/latest/aarch64/mirror.list"
BLOB_BASE = "https://al2023-repos-us-east-1-de612dc2.s3.dualstack.us-east-1.amazonaws.com/"
REPO_BASE = None  # Will be resolved from mirror list

# Packages needed for WeasyPrint
REQUIRED_PACKAGES = [
    "pango",
    "cairo",
    "gdk-pixbuf2",
    "glib2",
    "harfbuzz",
    "fontconfig",
    "freetype",
    "fribidi",
    "libpng",
    "libjpeg-turbo",
    "libtiff",
    "pixman",
    "graphite2",
    "libffi",
    "pcre2",
    "expat",
    "bzip2-libs",
    "libwebp",
    "libdatrie",
    "libthai",
    "libxml2",
    "xz-libs",
    "zlib",
]


def resolve_mirror():
    """Resolve the current AL2023 ARM64 repo mirror URL."""
    global REPO_BASE
    print("Resolving AL2023 mirror...")
    req = urllib.request.Request(MIRROR_LIST_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        REPO_BASE = resp.read().decode().strip().split("\n")[0]
    if not REPO_BASE.endswith("/"):
        REPO_BASE += "/"
    print(f"  Mirror: {REPO_BASE}")


def fetch_repodata():
    """Fetch and parse the AL2023 repo primary metadata."""
    print("Fetching repo metadata...")

    # First get repomd.xml to find the primary.xml.gz location
    repomd_url = REPO_BASE + "repodata/repomd.xml"
    req = urllib.request.Request(repomd_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        repomd = ET.fromstring(resp.read())

    # Find primary.xml.gz href from repomd
    ns_repo = {"repo": "http://linux.duke.edu/metadata/repo"}
    primary_href = None
    for data in repomd.findall("repo:data", ns_repo):
        if data.get("type") == "primary":
            loc = data.find("repo:location", ns_repo)
            if loc is not None:
                primary_href = loc.get("href")
                break

    if not primary_href:
        raise RuntimeError("Could not find primary.xml.gz in repomd.xml")

    primary_url = REPO_BASE + primary_href
    print(f"  Primary: {os.path.basename(primary_href)}")
    req = urllib.request.Request(primary_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        compressed = resp.read()
    xml_data = gzip.decompress(compressed)
    return ET.fromstring(xml_data)


def find_package_urls(root):
    """Find download URLs for required packages. Pick latest version of each."""
    ns = {"rpm": "http://linux.duke.edu/metadata/common", "repo": "http://linux.duke.edu/metadata/repo"}
    urls = {}
    for pkg in root.findall("rpm:package", ns):
        name = pkg.find("rpm:name", ns).text
        arch = pkg.find("rpm:arch", ns).text
        if arch != "aarch64":
            continue
        if name in REQUIRED_PACKAGES:
            location = pkg.find("rpm:location", ns)
            href = location.get("href")
            # Resolve ../../../../blobstore/ relative paths
            if href.startswith("../"):
                # Count ../ segments and strip them, resolve from base
                clean = href.replace("../../../../", "")
                url = BLOB_BASE + clean
            else:
                url = REPO_BASE + href
            # Always take latest (last found) version
            urls[name] = url
    for name, url in sorted(urls.items()):
        print(f"  Found: {name} -> {os.path.basename(url)}")
    return urls


def download_and_extract(name, url, lib_dir):
    """Download an RPM and extract .so files from it."""
    print(f"  Extracting {name}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        rpm_data = resp.read()

    rpm_stream = io.BytesIO(rpm_data)
    try:
        with rpmfile.open(fileobj=rpm_stream) as rpm:
            for member in rpm.getmembers():
                fname = member.name
                # Extract shared library files
                if ".so" in fname and ("/lib64/" in fname or "/lib/" in fname):
                    basename = os.path.basename(fname)
                    target = os.path.join(lib_dir, basename)
                    if not os.path.exists(target):
                        data = rpm.extractfile(member)
                        if data:
                            with open(target, "wb") as f:
                                f.write(data.read())
                            print(f"    -> {basename}")
    except Exception as e:
        print(f"    WARNING: Failed to extract {name}: {e}")


def create_symlinks(lib_dir):
    """Create .so symlinks for versioned libraries (e.g., libcairo.so.2.11800.0 -> libcairo.so.2)."""
    import re
    for fname in os.listdir(lib_dir):
        fpath = os.path.join(lib_dir, fname)
        if not os.path.isfile(fpath):
            continue
        # Match patterns like libfoo.so.1.2.3
        match = re.match(r"(lib.+\.so)\.(\d+)\.\d+", fname)
        if match:
            base = match.group(1)
            major = match.group(2)
            # Create libfoo.so.N symlink
            link_name = f"{base}.{major}"
            link_path = os.path.join(lib_dir, link_name)
            if not os.path.exists(link_path):
                os.symlink(fname, link_path)
                print(f"  Symlink: {link_name} -> {fname}")
            # Create libfoo.so symlink
            bare_link = os.path.join(lib_dir, base)
            if not os.path.exists(bare_link):
                os.symlink(fname, bare_link)


def main():
    # Clean and recreate
    if os.path.exists(LIB_DIR):
        shutil.rmtree(LIB_DIR)
    os.makedirs(LIB_DIR, exist_ok=True)

    resolve_mirror()
    root = fetch_repodata()
    urls = find_package_urls(root)

    missing = set(REQUIRED_PACKAGES) - set(urls.keys())
    if missing:
        print(f"\nWARNING: Could not find packages: {missing}")

    print(f"\nDownloading and extracting {len(urls)} packages...")
    for name, url in sorted(urls.items()):
        download_and_extract(name, url, LIB_DIR)

    print("\nCreating symlinks...")
    create_symlinks(LIB_DIR)

    # Count results
    so_files = [f for f in os.listdir(LIB_DIR) if ".so" in f]
    total_size = sum(os.path.getsize(os.path.join(LIB_DIR, f)) for f in os.listdir(LIB_DIR) if os.path.isfile(os.path.join(LIB_DIR, f)))
    print(f"\nLayer built: {len(so_files)} .so files, {total_size / 1024 / 1024:.1f} MB")
    print(f"Path: {LAYER_DIR}")


if __name__ == "__main__":
    main()
