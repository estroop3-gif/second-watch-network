# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Second Watch Network is a faith-driven filmmaking platform with three main components:
- **Backend**: FastAPI Python REST API (~50 API modules)
- **Frontend**: Vite/React TypeScript web app with shadcn/ui
- **SWN Dailies Helper**: PyQt6 desktop app for footage management

Database: Supabase (PostgreSQL)

## Development Commands

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Frontend (Vite/React)
```bash
cd frontend
npm install
npm run dev          # Development server (port 8080)
npm run build        # Production build
npm run lint         # ESLint
```

### SWN Dailies Helper (PyQt6)
```bash
cd swn-dailies-helper
pip install -e ".[dev]"
swn-helper           # Or: python -m src.main
pytest               # Run tests
pyinstaller build.spec  # Build executable
```

### Start All Services (Local Development)
```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - Desktop Helper (optional)
cd swn-dailies-helper && DISPLAY=:0 python -m src.main
```

## Architecture

### Backend Structure (`backend/app/`)
- `api/` - Route modules organized by domain (auth, users, filmmakers, submissions, backlot, messages, notifications, billing, etc.)
- `core/` - Config (Pydantic settings), Supabase client, startup logic
- `models/` - SQLModel database models
- `schemas/` - Pydantic request/response schemas
- `services/` - Business logic (email_service, etc.)
- `main.py` - FastAPI app entry point
- `socketio_app.py` - WebSocket configuration

**Largest API module**: `api/backlot.py` (~40k lines) - Production management hub

Deployment: AWS Lambda via SAM (`template.yaml`, `deploy.sh`)

### Frontend Structure (`frontend/src/`)
- `pages/` - Route components (70+ pages)
- `components/` - Feature-based organization
  - `ui/` - shadcn/ui base components (do not edit directly)
  - `backlot/workspace/` - Production management UI (largest: clearances, casting, invoices, etc.)
- `hooks/` - Custom React hooks
  - `backlot/` - 50+ specialized hooks for production features (useClearances, useCastingCrew, useInvoices, etc.)
- `context/` - React Context providers (AuthContext, SettingsContext, SocketContext)
- `lib/api.ts` - Centralized API client (APIClient class with token management)
- `types/` - TypeScript type definitions (backlot.ts is the largest)

Routes defined in `src/App.tsx`. Vite proxies `/api` to backend at localhost:8000.

### Dailies Helper Structure (`swn-dailies-helper/src/`)
- `ui/pages/` - PyQt6 page components
- `ui/dialogs/` - Modal dialogs
- `services/` - Business logic (proxy transcoding, uploads, MHL generation)
- `models/` - Data models
- `bin/` - Bundled binaries (rclone, smartctl, mhl-tool)

## Key Patterns

### Frontend
- TypeScript exclusively
- shadcn/ui components (import from `@/components/ui/`)
- Tailwind CSS for styling
- React Router for navigation
- TanStack React Query for data fetching (hooks in `hooks/backlot/`)
- React Hook Form + Zod for forms

### Backend
- Async/await throughout with FastAPI
- Two database patterns:
  - Supabase client for simple CRUD: `from app.core.database import get_client`
  - Raw SQL via SQLAlchemy for complex queries: `from app.core.database import execute_query, execute_single`
- Modular API routes organized by domain
- JWT authentication via AWS Cognito
- **Cognito ID → Profile ID**: Auth tokens contain Cognito user IDs, but the `profiles` table uses UUIDs. Use `get_profile_id_from_cognito_id()` helper to resolve (see `app/api/users.py`)

### Database Migrations
Located in `backend/migrations/`. Run manually against Supabase:
```bash
PGPASSWORD='...' psql -h <host> -U swn_admin -d secondwatchnetwork -f migrations/044_*.sql
```

### Design System Colors
- Primary Red: #FF3C3C
- Charcoal Black: #121212
- Bone White: #F9F5EF
- Muted Gray: #4C4C4C
- Accent Yellow: #FCDC58

## Service Ports
| Service | Port | Endpoint |
|---------|------|----------|
| Backend | 8000 | /health |
| Frontend | 8080 | / |
| Dailies Helper | 47284 | /status |

## Deployment
- Backend: AWS Lambda + SAM (`template.yaml`, `deploy.sh`)
- Frontend: S3 + CloudFront (via GitHub Actions on push to master)
- Production API: https://vnvvoelid6.execute-api.us-east-1.amazonaws.com

### Deploy Commands
```bash
# Backend (AWS Lambda)
cd backend && sam build && sam deploy

# Frontend (S3 + CloudFront)
cd frontend && VITE_API_URL=https://vnvvoelid6.execute-api.us-east-1.amazonaws.com npm run build
aws s3 sync dist/ s3://swn-frontend-517220555400 --delete
aws cloudfront create-invalidation --distribution-id E2V5T2HN1P6FFI --paths "/*"
```

## Custom Claude Agents
Located in `.claude/commands/`:
- `/admin` - Admin panel specialist for planning, building, and debugging admin features
- `/backlot_specialist` - Backlot production management expert for production features
