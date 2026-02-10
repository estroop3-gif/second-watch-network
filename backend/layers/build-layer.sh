#!/bin/bash
# Build WeasyPrint system dependencies Lambda layer for arm64/AL2023
# This script downloads ARM64 RPMs from Amazon Linux 2023 repos and extracts shared libraries
set -e

LAYER_DIR="$(dirname "$0")/weasyprint-deps"
LIB_DIR="$LAYER_DIR/lib"
rm -rf "$LIB_DIR"
mkdir -p "$LIB_DIR"

WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

# AL2023 ARM64 repo base
REPO="https://al2023-repos-us-east-1-de612dc2.s3.dualstack.us-east-1.amazonaws.com/core/mirrors/latest/aarch64/mirror.list"

echo "Fetching AL2023 ARM64 mirror list..."
MIRROR=$(curl -sL "$REPO" | head -1)
echo "Using mirror: $MIRROR"

# Packages needed for WeasyPrint on Lambda:
# - pango (text layout)
# - cairo (2D graphics)
# - gdk-pixbuf2 (image loading)
# - glib2 (foundation)
# - harfbuzz (text shaping)
# - fontconfig (font config)
# - freetype (font rendering)
# - fribidi (bidirectional text)
# - libpng (PNG support)
# - libjpeg-turbo (JPEG support)
# - libtiff (TIFF support)
# - libxml2 (XML)
# - pixman (pixel manipulation for cairo)
# - shared-mime-info (MIME type detection)

PACKAGES=(
  pango
  cairo
  gdk-pixbuf2
  glib2
  harfbuzz
  fontconfig
  freetype
  fribidi
  libpng
  libjpeg-turbo
  libtiff
  libxml2
  pixman
  shared-mime-info
  graphite2
  libX11
  libXext
  libXrender
  libxcb
  libffi
  pcre2
  expat
  bzip2-libs
  libwebp
  libidn2
  libunistring
  gnutls
  nettle
  libdatrie
  libthai
  gobject-introspection
)

echo "Downloading RPMs..."
cd "$WORK_DIR"

for pkg in "${PACKAGES[@]}"; do
  echo "  Downloading $pkg..."
  # Try to find and download the package
  RPM_URL=$(curl -sL "${MIRROR}repodata/primary.xml.gz" 2>/dev/null | zcat 2>/dev/null | grep -oP "href=\"[^\"]*${pkg}-[0-9][^\"]*aarch64\.rpm" | head -1 | sed 's/href="//' || true)
  if [ -n "$RPM_URL" ]; then
    curl -sLO "${MIRROR}${RPM_URL}" 2>/dev/null || true
  fi
done

echo "Extracting shared libraries..."
for rpm in *.rpm; do
  [ -f "$rpm" ] || continue
  rpm2cpio "$rpm" 2>/dev/null | cpio -idm 2>/dev/null || true
done

# Copy all .so files to the layer lib directory
find . -name "*.so*" -type f -exec cp -n {} "$LIB_DIR/" \; 2>/dev/null || true
find . -name "*.so*" -type l -exec cp -a {} "$LIB_DIR/" \; 2>/dev/null || true

echo "Layer contents:"
ls -la "$LIB_DIR/" | head -30
echo "Total files: $(ls "$LIB_DIR/" | wc -l)"
echo "Total size: $(du -sh "$LIB_DIR/" | cut -f1)"

echo ""
echo "Done! Layer dir: $LAYER_DIR"
