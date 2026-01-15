# SWN Dailies Helper - PowerShell Updater
Write-Host "SWN Dailies Helper - Updater" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Navigate to script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Pull latest code
Write-Host "Pulling latest code..." -ForegroundColor Yellow
git pull origin master

if ($LASTEXITCODE -ne 0) {
    Write-Host "Git pull failed. You may have local changes." -ForegroundColor Red
    Write-Host "Try: git stash" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Update dependencies
Write-Host ""
Write-Host "Updating dependencies..." -ForegroundColor Yellow

if (Test-Path "venv-win\Scripts\pip.exe") {
    & venv-win\Scripts\pip install -q --upgrade pip
    & venv-win\Scripts\pip install -q PyQt6 httpx python-xxhash aiohttp boto3 requests keyring
} else {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv-win
    & venv-win\Scripts\pip install --upgrade pip
    & venv-win\Scripts\pip install PyQt6 httpx python-xxhash aiohttp boto3 requests keyring
}

Write-Host ""
Write-Host "=============================" -ForegroundColor Green
Write-Host "Update complete!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""
Write-Host "Run: .\run.ps1" -ForegroundColor Cyan
