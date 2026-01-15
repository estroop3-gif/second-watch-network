# SWN Dailies Helper - PowerShell Launcher
Write-Host "SWN Dailies Helper" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan

# Navigate to script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Check if venv exists
if (-not (Test-Path "venv-win\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv-win

    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & venv-win\Scripts\pip install --upgrade pip
    & venv-win\Scripts\pip install PyQt6 httpx python-xxhash aiohttp boto3 requests keyring
}

Write-Host "Starting..." -ForegroundColor Green
& venv-win\Scripts\python -m src.main
