# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Second Watch Network is a faith-driven filmmaking platform with three main components:
- **Backend**: FastAPI Python REST API (~70 API modules) - see `backend/CLAUDE.md`
- **Frontend**: Vite/React TypeScript web app with shadcn/ui - see `frontend/CLAUDE.md`
- **SWN Dailies Helper**: PyQt6 desktop app for footage management

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
- `api/` - ~70 route modules organized by domain and phase
- `core/` - Config, database client, auth, permissions, storage
- `services/` - Business logic (email, PDF generation, media orchestration, revenue calculation)
- `main.py` - FastAPI app entry with all router registrations

**Major API domains**:
- Auth/Users: `auth.py`, `users.py`, `profiles.py`
- Production (Backlot): `backlot.py` (~40k lines), plus `scene_view.py`, `day_view.py`, `timecards.py`, `invoices.py`, etc.
- Streaming: `consumer_video.py`, `worlds.py`, `episodes.py`, `shorts.py`, `live_events.py`
- Church Tools: `church_services.py`, `church_people.py`, `church_planning.py`
- Admin: `admin.py`, `admin_users.py`, `admin_content.py`, `admin_backlot.py`
- Monetization: `creator_earnings.py`, `organizations.py`, `billing.py`, `financing.py`

### Frontend Structure (`frontend/src/`)
- `pages/` - 70+ route components organized by domain
- `components/` - Feature-based: `backlot/`, `gear/`, `admin/`, `order/`, `watch/`, `dashboard/`
- `hooks/` - Domain hooks: `backlot/` (60+), `gear/`, `watch/`
- `context/` - Providers: AuthContext, EnrichedProfileContext, SocketContext, ThemeContext
- `lib/api.ts` - Centralized API client (~4100 lines) with domain sub-clients

### Dailies Helper Structure (`swn-dailies-helper/src/`)
- `ui/pages/` - PyQt6 page components
- `services/` - Proxy transcoding, uploads, ASC-MHL manifest generation
- `models/` - Data models
- `bin/` - Bundled binaries (rclone, ffmpeg, mhl-tool)

## Key Patterns

### Database Access (Backend)
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

### Design System
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
```bash
# Backend (AWS Lambda)
cd backend && sam build && sam deploy

# Frontend (S3 + CloudFront)
cd frontend && VITE_API_URL=https://vnvvoelid6.execute-api.us-east-1.amazonaws.com npm run build
aws s3 sync dist/ s3://swn-frontend-517220555400 --delete
aws cloudfront create-invalidation --distribution-id EJRGRTMJFSXN2 --paths "/*"
```

Production API: https://vnvvoelid6.execute-api.us-east-1.amazonaws.com

## Custom Claude Agents
Located in `.claude/commands/`:
- `/admin` - Admin panel specialist for planning, building, and debugging admin features
- `/backlot_specialist` - Backlot production management expert for production features

## Component-Specific Documentation
For detailed patterns and architecture, see:
- `backend/CLAUDE.md` - Database patterns, permissions, services, migrations
- `frontend/CLAUDE.md` - Hooks, components, dashboard system, Gear House, expense system
