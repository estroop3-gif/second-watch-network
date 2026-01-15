@echo off
echo SWN Dailies Helper - Windows Updater
echo =====================================
echo.

REM Navigate to the script's directory
cd /d "%~dp0"

REM Check for git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/download/win
    pause
    exit /b 1
)

echo Pulling latest code from repository...
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo.
    echo WARNING: Git pull failed. You may have local changes.
    echo Try running: git stash
    echo Then run this script again.
    pause
    exit /b 1
)

echo.
echo Updating dependencies...
if exist "venv-win\Scripts\pip.exe" (
    venv-win\Scripts\pip install -q --upgrade pip
    venv-win\Scripts\pip install -q -e ".[dev]" 2>nul || venv-win\Scripts\pip install -q PyQt6 httpx python-xxhash aiohttp boto3 requests keyring
) else (
    echo Virtual environment not found. Run run_windows.bat first to set it up.
    pause
    exit /b 1
)

echo.
echo =====================================
echo Update complete!
echo =====================================
echo.
echo Run 'run_windows.bat' to start the app.
echo.
pause
