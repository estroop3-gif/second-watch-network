@echo off
echo SWN Dailies Helper - Windows Launcher
echo ======================================

REM Check if venv exists
if not exist "venv-win\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv venv-win

    echo Installing dependencies...
    venv-win\Scripts\pip install PyQt6 httpx python-xxhash aiohttp boto3 requests
)

echo Starting SWN Dailies Helper...
venv-win\Scripts\python -m src.main
