# FFmpeg Binaries

This directory should contain FFmpeg binaries for bundling with the application.

## Download FFmpeg

### Windows
1. Go to https://www.gyan.dev/ffmpeg/builds/
2. Download "ffmpeg-release-essentials.zip" (smaller) or "ffmpeg-release-full.zip" (includes more codecs)
3. Extract the following files to this directory:
   - `ffmpeg.exe`
   - `ffprobe.exe`

### macOS
1. Install via Homebrew: `brew install ffmpeg`
2. Or download from https://evermeet.cx/ffmpeg/

### Linux
Install via package manager:
```bash
sudo apt install ffmpeg   # Ubuntu/Debian
sudo dnf install ffmpeg   # Fedora
```

## Directory Structure

After adding FFmpeg binaries, this directory should contain:

```
resources/ffmpeg/
  - README.md (this file)
  - ffmpeg.exe (Windows)
  - ffprobe.exe (Windows)
```

## Notes

- The binaries are not included in git (they're in .gitignore)
- The application will use system FFmpeg if bundled binaries are not found
- For production builds, include FFmpeg in the PyInstaller spec file
