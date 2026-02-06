# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Second Watch Network is a faith-driven filmmaking platform with four main components:
- **Backend**: FastAPI Python REST API (117+ route modules) — see `backend/CLAUDE.md`
- **Frontend**: Vite/React TypeScript web app with shadcn/ui — see `frontend/CLAUDE.md`
- **SWN Dailies Helper**: PyQt6 desktop app for footage management (offload, proxy generation, upload)
- **Flet App**: Cross-platform desktop/mobile app in `app/` (Python/Flet)

Database: AWS RDS PostgreSQL (SQLAlchemy with a custom chainable query builder)

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
npm run build:dev    # Development build (unminified)
npm run lint         # ESLint
```

### Frontend E2E Tests (Playwright)
```bash
cd frontend
npx playwright test                         # Run all tests
npx playwright test tests/e2e/foo.spec.ts   # Run single test file
npx playwright test --headed                # Run with browser visible
npx playwright test --project=chromium      # Run specific project
```

Playwright test projects (defined in `playwright.config.ts`):
- `setup-accounts` → `setup-auth` → `chromium` (main multi-user flow)
- `setup` → `chromium` (legacy single-user flow)
- `chromium-owner` — Owner role tests (runs serial)
- `chromium-multi-role` — Multi-role visibility tests
- `chromium-no-auth` — Unauthenticated tests

Auth state stored in `playwright/.auth/`. Timeout: 60s. Dev server auto-starts on port 8080.

### SWN Dailies Helper (PyQt6)
```bash
cd swn-dailies-helper
pip install -e ".[dev]"
swn-helper           # Or: python -m src.main
pytest               # Run tests
pyinstaller build.spec  # Build executable
```

### Flet App
```bash
cd app
pip install -r requirements.txt
python main.py       # Runs on port 3001
```

### Running a Database Migration
Note: `psql` is not installed. Use Node.js `pg` client:
```bash
cd backend
node -e "
const { Client } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('migrations/211_*.sql', 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
client.connect().then(() => client.query(sql)).then(() => console.log('Done')).finally(() => client.end());
"
```

Two migration directories exist:
- `database/` — Schema migrations (001–059), the original migration set
- `backend/migrations/` — Feature migrations (001–211), the active migration directory

## Service Ports

| Service | Port | Endpoint |
|---------|------|----------|
| Backend | 8000 | /health |
| Frontend | 8080 | / |
| Flet App | 3001 | / |
| Dailies Helper | 47284 | /status |

## Architecture

### Backend Structure (`backend/app/`)
- `api/` — 117+ route modules organized by domain (largest: `backlot.py` at ~49K lines)
- `core/` — Config, database client, auth, permissions, storage, roles, exceptions
- `services/` — 67 service modules (email, PDF generation, media orchestration, revenue, gear, AI)
- `jobs/` — Background jobs and scheduled tasks
- `main.py` — FastAPI app entry with 119 router registrations and middleware stack
- `socketio_app.py` — WebSocket server for real-time features

**Request pipeline (middleware order):** RequestContextMiddleware (request ID, logging) → CORSPreflightMiddleware (OPTIONS) → CORSMiddleware → FastAPI route handler → exception handlers

### Frontend Structure (`frontend/src/`)
- `pages/` — Route components organized by domain (`admin/`, `backlot/`, `gear/`, `order/`, `watch/`)
- `components/` — Feature-based: `backlot/workspace/` (120+ components), `gear/`, `admin/`, `order/`, `dashboard/`
- `hooks/` — Domain hooks: `backlot/` (60+ hooks via `index.ts`), `gear/`, `watch/`
- `context/` — Providers: AuthContext, EnrichedProfileContext, SocketContext, DashboardSettingsContext
- `lib/api.ts` — Centralized API client (~4500 lines) with domain sub-clients

**Provider nesting order** (in `App.tsx`): QueryClient → AuthProvider → ThemeProvider → SettingsProvider → EnrichedProfileProvider → DashboardSettingsProvider → SocketProvider → GearCartProvider → SetHouseCartProvider → PlatformStatusGate → Router

### Database Patterns
Two query styles coexist in the backend:
```python
# 1. Query builder (simple CRUD) — chainable API over SQLAlchemy, does NOT support nested joins
from app.core.database import get_client
client = get_client()
result = client.table("profiles").select("*").eq("id", user_id).single().execute()

# 2. Raw SQL (complex queries, joins)
from app.core.database import execute_query, execute_single, execute_insert
rows = execute_query("SELECT * FROM worlds WHERE creator_id = :id", {"id": user_id})
```

Connection pooling: NullPool for Lambda, QueuePool for local dev (auto-detected).

### Key Domain Concepts

**Worlds & Episodes** (Consumer Streaming): Creator channels/shows with seasons, episodes, and video assets. Playback sessions track watch time.

**Backlot** (Production Management): Projects → Production Days → Scenes. Includes cast/crew management, timecards, invoices, and the Hot Set real-time tracking system.

**Gear House** (Equipment Management): Asset tracking with barcode/QR scanning, checkout/checkin workflows, work orders, and marketplace.

**Set House** (Location/Space Management): Production location and set rentals.

**The Order** (Membership): Guild membership tiers (BASE $50, STEWARD $100, PATRON $250+) with premium content access. Includes lodges, craft houses, and governance.

**Monetization**: Watch time aggregation → creator earnings from watch share pool → payouts ($25 minimum).

**Church Production**: Service management, people rosters, content planning, and production readiness tools.

## Authentication & Permissions

- AWS Cognito JWT tokens validated in `app/core/auth.py`
- Cognito `sub` → Profile UUID mapping via `get_profile_id_from_cognito_id()` (with email fallback)
- Permission system: 100+ fine-grained permissions in `app/core/permissions.py` (naming: `DOMAIN_ACTION`)
- Role hierarchy in `app/core/roles.py`: SUPERADMIN > ADMIN > MODERATOR > LODGE_OFFICER > ORDER_MEMBER > PARTNER > FILMMAKER > PREMIUM > FREE
- Multibit role system: profiles table has boolean flags (`is_admin`, `is_order_member`, etc.) — users can hold multiple roles
- Role-based dependencies in `app/core/deps.py` (`require_admin`, `require_staff`, `require_order_member`, etc.)
- Frontend uses `PermissionRoute` and `OnboardingGate` in `App.tsx` for route access control
- Backlot has its own fine-grained permission system in `app/core/backlot_permissions.py`

## Design System

| Color | Hex | Tailwind Class |
|-------|-----|----------------|
| Primary Red | #FF3C3C | `text-primary-red` |
| Charcoal Black | #121212 | `bg-charcoal-black` |
| Bone White | #F9F5EF | `text-bone-white` |
| Muted Gray | #4C4C4C | `text-muted-gray` |
| Accent Yellow | #FCDC58 | `text-accent-yellow` |

**Fonts**: Space Grotesk (headings), IBM Plex Sans (body), Permanent Marker/Special Elite (decorative)

## Important Gotchas

- **No nested joins in query builder**: `client.table("x").select("*, y(*)")` will fail. Use separate queries or raw SQL.
- **Date timezone shifts**: Use `parseLocalDate` from `@/lib/dateUtils` in frontend to prevent "2024-01-15" from becoming Jan 14 in US timezones.
- **shadcn/ui components**: Files in `frontend/src/components/ui/` are auto-generated. Don't edit directly — create wrapper components instead. Dialogs need `DialogTitle` or `ariaLabel` prop for accessibility.
- **Large backend files**: `backlot.py` is ~49K lines. Read the full file before making changes to understand structure.
- **TypeScript is relaxed**: `noImplicitAny: false`, `strictNullChecks: false`. ESLint unused-vars check is off.
- **Frontend path alias**: `@/` maps to `src/` (e.g., `import { api } from '@/lib/api'`).

## Deployment

CI/CD via GitHub Actions (`.github/workflows/deploy.yml`) triggers on push to master/main.

### Backend (AWS Lambda via SAM)
```bash
cd backend
sam build && sam deploy
```
Production API: https://vnvvoelid6.execute-api.us-east-1.amazonaws.com

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
pyinstaller build.spec
```

## S3 Buckets

- `swn-backlot-517220555400` — Main assets, uploads via desktop app (paths containing `/assets/`)
- `swn-backlot-files-517220555400` — Dailies files, review versions (paths containing `/dailies/`)

## Custom Claude Commands

Located in `.claude/commands/`:
- `/admin` — Admin panel specialist
- `/backlot_specialist` — Backlot production management expert
- `/alpha_test` — Alpha testing and feedback management
- `/test-tab` — Run Playwright E2E tests for specific Backlot tabs
- `/mobile-optimize` — Mobile screen audit and optimization workflow

## Component-Specific Documentation

For detailed patterns and architecture, see:
- `backend/CLAUDE.md` — Database patterns, permissions, services, migrations, API modules
- `frontend/CLAUDE.md` — Hooks, components, dashboard system, Gear House, expense system, routes, real-time features
