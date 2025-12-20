# SWN Dailies Helper

Desktop application for Second Watch Network - offload footage, generate proxies, and upload to cloud for dailies review.

## Features

- **Card Offloading**: Detect camera cards and offload footage with XXH64 checksum verification
- **Dual-Drive Copy**: Copy to two drives simultaneously for redundancy
- **Proxy Generation**: Generate H.264 1080p proxies using FFmpeg for faster review
- **Cloud Upload**: Upload proxies to SWN cloud for remote dailies review
- **Local Server**: Allows the web UI to browse and stream local files

## Requirements

- Python 3.10+
- FFmpeg (automatically downloaded on first run, or install manually)

## Installation

### From Release (Recommended)

Download the latest release for your platform:
- **Windows**: `SWN-Dailies-Helper-win.exe`
- **macOS**: `SWN-Dailies-Helper-mac.dmg`
- **Linux**: `SWN-Dailies-Helper-linux.AppImage`

### From Source

```bash
# Clone the repository
git clone https://github.com/secondwatchnetwork/swn-dailies-helper.git
cd swn-dailies-helper

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Run the app
swn-helper
```

## Usage

1. **Setup**: Enter your Desktop API Key (generate from the Dailies tab in Backlot)
2. **Connect a Card**: Insert a camera card - the app will detect it automatically
3. **Select Destinations**: Choose primary and backup drives for offload
4. **Start Offload**: Click "Start Offload" to begin the process

The app will:
1. Calculate source checksums
2. Copy files to both drives with verification
3. Generate H.264 proxies (if enabled)
4. Upload proxies to cloud (if enabled)
5. Register clips in your project's Dailies tab

## Proxy Settings

Default proxy settings:
- **Resolution**: 1920x1080
- **Codec**: H.264 (libx264)
- **Bitrate**: 10 Mbps
- **Audio**: AAC 192kbps

These can be customized in Settings.

## Local Server

The app runs a local HTTP server on port 47284 that allows the SWN web interface to:
- Browse files on your local drives
- Stream video for playback
- Access footage without uploading to cloud

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Build executable
pyinstaller src/main.py --name "SWN Dailies Helper" --windowed
```

## License

MIT License - See LICENSE file for details.
