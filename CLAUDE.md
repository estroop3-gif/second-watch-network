# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Second Watch Network is a faith-driven filmmaking platform with three main components:
- **Backend**: FastAPI Python REST API (112 API modules) - see `backend/CLAUDE.md`
- **Frontend**: Vite/React TypeScript web app with shadcn/ui - see `frontend/CLAUDE.md`
- **SWN Dailies Helper**: PyQt6 desktop app for footage management (offload, proxy generation, upload)

Database: AWS RDS PostgreSQL (SQLAlchemy with Supabase-compatible query wrapper)

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

### Frontend E2E Tests (Playwright)
```bash
cd frontend
npx playwright test                         # Run all tests
npx playwright test tests/e2e/foo.spec.ts   # Run single test file
npx playwright test --headed                # Run with browser visible
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
See `LOCALHOST_STARTUP.md` for detailed startup instructions.

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
- `api/` - 112 route modules organized by domain and phase
- `core/` - Config, database client, auth, permissions, storage
- `services/` - Business logic (email, PDF generation, media orchestration, revenue calculation)
- `jobs/` - Background jobs and scheduled tasks
- `main.py` - FastAPI app entry with all router registrations (~21k lines)
- `socketio_app.py` - WebSocket server for real-time features (~16k lines)

**Major API domains** (112 modules total):
- Auth/Users: `auth.py`, `users.py`, `profiles.py`
- Production (Backlot): `backlot.py` (~40k lines), plus `scene_view.py`, `day_view.py`, `timecards.py`, `invoices.py`, `camera_continuity.py`, etc.
- Streaming: `consumer_video.py`, `worlds.py`, `episodes.py`, `shorts.py`, `live_events.py`
- Church Tools: `church_services.py`, `church_people.py`, `church_planning.py`, `church_readiness.py`
- Admin: `admin.py`, `admin_users.py`, `admin_content.py`, `admin_backlot.py`, `admin_organizations.py`
- Monetization: `creator_earnings.py`, `organizations.py`, `billing.py`, `financing.py`
- Career/Guild: `career.py`, `application_templates.py`, `availability.py`

### Frontend Structure (`frontend/src/`)
- `pages/` - 62 route components organized by domain
- `components/` - Feature-based: `backlot/`, `gear/`, `admin/`, `order/`, `watch/`, `dashboard/`
- `hooks/` - Domain hooks: `backlot/` (60+), `gear/`, `watch/`
- `context/` - Providers: AuthContext, EnrichedProfileContext, SocketContext, ThemeContext
- `lib/api.ts` - Centralized API client (~4100 lines) with domain sub-clients

### Dailies Helper Structure (`swn-dailies-helper/src/`)
- `ui/pages/` - PyQt6 page components (Setup, Offload, Settings)
- `services/` - Proxy transcoding, uploads, ASC-MHL manifest generation
- `models/` - Data models (Project, Clip, OffloadSettings)
- `bin/` - Bundled binaries (rclone, ffmpeg, mhl-tool)
- Local HTTP server runs on port 47284 for web UI integration

## Database & Migrations

### Migrations (`backend/migrations/`)
157 SQL migration files (currently at 195_e2ee_messages_table.sql).

**Running a single migration**:
```bash
node -e "
const { Client } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('migrations/195_*.sql', 'utf8');
const client = new Client({
  host: 'swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com',
  port: 5432, database: 'secondwatchnetwork',
  user: 'swn_admin', password: 'I6YvLh4FIUj2Wp40XeJ0mJVP',
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => client.query(sql)).then(() => console.log('Done')).finally(() => client.end());
"
```

Note: `psql` is not installed, use Node.js `pg` client for migrations.

### Database Access Patterns
```python
# Supabase-style client (simple CRUD)
from app.core.database import get_client
client = get_client()
result = client.table("profiles").select("*").eq("id", user_id).single().execute()

# Raw SQL (complex queries)
from app.core.database import execute_query, execute_single, execute_insert
rows = execute_query("SELECT * FROM worlds WHERE creator_id = :id", {"id": user_id})
```

### Authentication
- AWS Cognito JWT tokens
- Cognito `sub` → Profile UUID mapping via `get_profile_id_from_cognito_id()`
- Permission system in `app/core/permissions.py` with `Permission.BACKLOT_VIEW`, etc.
- Role-based deps in `app/core/deps.py`: `require_admin`, `require_order_member`, `require_premium_content_access`

### Frontend Data Fetching
```typescript
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const { data } = useQuery({
  queryKey: ['backlot-project', projectId],
  queryFn: () => api.get(`/backlot/projects/${projectId}`)
});
```

## Design System

| Color | Hex | Tailwind Class |
|-------|-----|----------------|
| Primary Red | #FF3C3C | `text-primary-red` |
| Charcoal Black | #121212 | `bg-charcoal-black` |
| Bone White | #F9F5EF | `text-bone-white` |
| Muted Gray | #4C4C4C | `text-muted-gray` |
| Accent Yellow | #FCDC58 | `text-accent-yellow` |

**Fonts**: Space Grotesk (headings), IBM Plex Sans (body), Permanent Marker/Special Elite (decorative)

## Service Ports

| Service | Port | Endpoint |
|---------|------|----------|
| Backend | 8000 | /health |
| Frontend | 8080 | / |
| Dailies Helper | 47284 | /status |

## Deployment

### Backend (AWS Lambda via SAM)
```bash
cd backend
sam build
sam deploy
```

Uses `template.yaml` (AWS SAM CloudFormation template) and `samconfig.toml`.

**Environment**: Python 3.12, Lambda timeout 30s, 1024MB memory

**Production API**: https://vnvvoelid6.execute-api.us-east-1.amazonaws.com

### Frontend (S3 + CloudFront)
```bash
cd frontend
VITE_API_URL=https://vnvvoelid6.execute-api.us-east-1.amazonaws.com npm run build
aws s3 sync dist/ s3://swn-frontend-517220555400 --delete
aws cloudfront create-invalidation --distribution-id EJRGRTMJFSXN2 --paths "/*"
```

### Dailies Helper (PyInstaller)
```bash
cd swn-dailies-helper
pyinstaller build.spec  # Creates standalone executables for Windows/Mac/Linux
```

## Custom Claude Agents

Located in `.claude/commands/`:
- `/admin` - Admin panel specialist for planning, building, and debugging admin features
- `/backlot_specialist` - Backlot production management expert for production features

## Component-Specific Documentation

For detailed patterns and architecture, see:
- `backend/CLAUDE.md` - Database patterns, permissions, services, migrations, API modules
- `frontend/CLAUDE.md` - Hooks, components, dashboard system, Gear House, expense system, routes
- `swn-dailies-helper/README.md` - Dailies helper features, installation, usage

## Key Files to Know

- `backend/app/main.py` (~21k lines) - FastAPI app with all route registrations
- `backend/app/socketio_app.py` (~16k lines) - WebSocket server
- `backend/app/api/backlot.py` (~40k lines) - Main production management API
- `frontend/src/App.tsx` (~24k lines) - All frontend routes and permission gates
- `frontend/src/lib/api.ts` (~4100 lines) - Centralized API client
- `backend/template.yaml` - AWS SAM deployment configuration
