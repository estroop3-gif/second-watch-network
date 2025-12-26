# Local Development Startup Guide

When asked to "start localhost" or "start local development", start all three services:

## 1. Backend (FastAPI)
```bash
cd /home/estro/second-watch-network/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- URL: http://localhost:8000
- Health check: http://localhost:8000/health

## 2. Frontend (Vite/React)
```bash
cd /home/estro/second-watch-network/frontend
npm run dev
```
- URL: http://localhost:8080 (or next available port like 8081, 8082)

## 3. Desktop Helper (SWN Dailies Helper)
```bash
cd /home/estro/second-watch-network/swn-dailies-helper
DISPLAY=:0 /home/estro/second-watch-network/backend/venv/bin/python -m src.main
```
- Local server URL: http://localhost:47284
- Status check: http://localhost:47284/status

## Quick Reference
| Service | Port | Health/Status Endpoint |
|---------|------|------------------------|
| Backend | 8000 | /health |
| Frontend | 8080+ | / |
| Desktop Helper | 47284 | /status |
