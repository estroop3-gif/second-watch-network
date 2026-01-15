@echo off
echo SWN Dailies Helper - Windows Launcher
echo ======================================

REM Navigate to the script's directory
cd /d "%~dp0"

REM Check if venv exists
if not exist "venv-win\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv venv-win

    echo Installing dependencies...
    venv-win\Scripts\pip install --upgrade pip
    venv-win\Scripts\pip install PyQt6 httpx python-xxhash aiohttp boto3 requests keyring
)

echo Starting SWN Dailies Helper...
venv-win\Scripts\python -m src.main
