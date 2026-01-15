# SWN Dailies Helper - Future TODOs

## Install Wizard
Build a proper Windows installer that:
- Bundles Python runtime (or uses embedded Python)
- Installs all dependencies automatically
- Creates Start Menu shortcuts
- Handles updates automatically
- Includes all required binaries (ffmpeg, rclone, mhl-tool, etc.)

**Options to explore:**
- **NSIS** - Free, scriptable Windows installer
- **Inno Setup** - Free, easy to use
- **PyInstaller + NSIS** - Build exe then wrap in installer
- **cx_Freeze** - Alternative to PyInstaller
- **Briefcase** (BeeWare) - Cross-platform native packaging
- **MSIX** - Modern Windows packaging format

**Dependencies to bundle:**
- Python 3.11+
- PyQt6
- FastAPI, uvicorn
- httpx, aiohttp, boto3
- keyring
- xxhash
- ffmpeg (for proxy generation)
- rclone (for cloud storage)
- mhl-tool (for ASC-MHL)
- MediaInfo (for metadata)

**Nice to have:**
- Auto-updater built into the app
- Silent install option for enterprise deployment
- Portable mode (run from USB without install)
