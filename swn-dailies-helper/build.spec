# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for SWN Dailies Helper.
Builds standalone executables for Windows, macOS, and Linux.
"""

import sys
from pathlib import Path

block_cipher = None

# Determine platform-specific settings
if sys.platform == 'win32':
    icon_file = 'resources/icon.ico'
    exe_name = 'SWN-Dailies-Helper'
elif sys.platform == 'darwin':
    icon_file = 'resources/icon.icns'
    exe_name = 'SWN Dailies Helper'
else:
    icon_file = 'resources/icon.png'
    exe_name = 'swn-dailies-helper'

a = Analysis(
    ['src/main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('resources', 'resources'),
        ('bin', 'bin'),  # CLI tool binaries (MediaInfo, ExifTool, smartctl, mhl-tool, rclone)
        ('THIRD_PARTY_LICENSES', 'THIRD_PARTY_LICENSES'),  # License files for GPL compliance
    ],
    hiddenimports=[
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'PyQt6.QtWidgets',
        # FastAPI and dependencies
        'fastapi',
        'fastapi.applications',
        'fastapi.routing',
        'fastapi.middleware',
        'starlette',
        'starlette.routing',
        'starlette.middleware',
        'pydantic',
        'anyio',
        'sniffio',
        # Uvicorn
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'httptools',
        'websockets',
        # Other dependencies
        'httpx',
        'xxhash',
        'keyring.backends',
        'keyring.backends.SecretService',
        'keyring.backends.Windows',
        'keyring.backends.macOS',
        # Professional media libraries
        'opentimelineio',
        'opentimelineio.adapters',
        'opentimelineio.core',
        'opentimelineio.schema',
        'PyOpenColorIO',
        'ascmhl',
        'ascmhl.hasher',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name=exe_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Windowed app, no console
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file if Path(icon_file).exists() else None,
)

# macOS app bundle
if sys.platform == 'darwin':
    app = BUNDLE(
        exe,
        name='SWN Dailies Helper.app',
        icon=icon_file if Path(icon_file).exists() else None,
        bundle_identifier='com.secondwatchnetwork.dailies-helper',
        info_plist={
            'CFBundleName': 'SWN Dailies Helper',
            'CFBundleDisplayName': 'SWN Dailies Helper',
            'CFBundleVersion': '1.0.0',
            'CFBundleShortVersionString': '1.0.0',
            'NSHighResolutionCapable': True,
            'LSMinimumSystemVersion': '10.15.0',
        },
    )
