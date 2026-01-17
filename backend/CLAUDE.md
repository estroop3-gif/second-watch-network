# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run a single migration
node -e "
const { Client } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('migrations/076_*.sql', 'utf8');
const client = new Client({
  host: 'swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com',
  port: 5432, database: 'secondwatchnetwork',
  user: 'swn_admin', password: 'I6YvLh4FIUj2Wp40XeJ0mJVP',
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => client.query(sql)).then(() => console.log('Done')).finally(() => client.end());
"

# Deploy to AWS Lambda
sam build && sam deploy
```

## Architecture

### API Structure (~70 modules in `app/api/`)
- **Domain modules**: `auth.py`, `users.py`, `profiles.py`, `content.py`, `filmmakers.py`
- **Admin modules**: `admin.py`, `admin_users.py`, `admin_content.py`, `admin_backlot.py`, etc.
- **Feature modules**: `backlot.py` (40k lines - production management), `consumer_video.py`, `worlds.py`
- **Church production**: `church_services.py`, `church_people.py`, `church_content.py`, etc.
- **Monetization**: `creator_earnings.py`, `organizations.py`, `billing.py`

### Core Modules (`app/core/`)
| Module | Purpose |
|--------|---------|
| `database.py` | SQLAlchemy connection + Supabase-compatible client wrapper |
| `auth.py` | AWS Cognito JWT validation |
| `permissions.py` | Fine-grained permission system (`Permission.BACKLOT_VIEW`, etc.) |
| `roles.py` | Role types: `SUPERADMIN`, `ADMIN`, `MODERATOR`, `ORDER_MEMBER`, `FILMMAKER`, etc. |
| `deps.py` | FastAPI dependencies: `require_admin`, `require_order_member`, `require_premium_content_access` |
| `storage.py` | S3 storage operations |
| `exceptions.py` | Structured error handling |

### Services (`app/services/`)
- `watch_aggregation.py` - Hourly/daily/monthly watch time rollups
- `revenue_calculation.py` - Creator earnings from watch share
- `media_orchestrator.py` - Unified media job tracking
- `email_service.py` - SES email sending
- `pdf_service.py` - Call sheet, script breakdown PDFs

## Database Patterns

### Two Query Styles
```python
# 1. Supabase-style client (simple CRUD)
from app.core.database import get_client
client = get_client()
result = client.table("profiles").select("*").eq("id", user_id).single().execute()

# 2. Raw SQL (complex queries)
from app.core.database import execute_query, execute_single, execute_insert
rows = execute_query("SELECT * FROM worlds WHERE creator_id = :id", {"id": user_id})
row = execute_single("SELECT * FROM profiles WHERE id = :id", {"id": profile_id})
result = execute_insert("INSERT INTO ... RETURNING *", {...})
```

### Cognito ID → Profile ID Resolution
Auth tokens contain Cognito `sub`, but `profiles` table uses UUIDs:
```python
from app.api.users import get_profile_id_from_cognito_id
profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
```

## Permission System

```python
from app.core.permissions import Permission, require_permissions
from app.core.deps import require_admin, require_order_member

# Fine-grained permissions
@router.get("/admin/users")
async def route(profile = Depends(require_permissions(Permission.USER_MANAGE))):
    pass

# Role-based
@router.get("/order-only")
async def route(profile = Depends(require_order_member)):
    pass

# Premium content access (Order members, staff, premium subscribers)
from app.core.deps import require_premium_content_access
@router.get("/premium-episode")
async def route(profile = Depends(require_premium_content_access)):
    pass
```

## Key Domain Concepts

### Worlds & Episodes (Consumer Streaming)
- `worlds` - Creator channels/shows with seasons and episodes
- `episodes` - Video content with `visibility` ('public', 'premium', 'private')
- `video_assets` - Source videos with HLS manifests
- `playback_sessions` - Active viewing sessions for watch tracking

### Backlot (Production Management)
- `backlot_projects` - Film/TV productions
- `backlot_production_days` - Shooting days with call times
- `backlot_scenes` - Script scenes linked to shoot days
- `backlot_cast_members` / `backlot_crew_members` - Project personnel
- `backlot_timecards` - Crew time tracking
- `backlot_invoices` - Vendor invoices with approval workflow

### Monetization
- `world_watch_aggregates` - Per-world watch time (hourly/daily/monthly)
- `world_earnings` - Creator earnings from watch share of creator pool
- `organizations` - Studios that can own Worlds and receive payouts
- `creator_payouts` - Payout records ($25 minimum threshold)

### The Order (Membership)
- Members have `is_order_member = true` on profiles
- Tiers: BASE ($50), STEWARD ($100), PATRON ($250+)
- All tiers get premium content access

## Migrations

Located in `migrations/`. Currently at 169. Run via Node.js pg client (psql not installed).

## S3 Buckets

Two main buckets for file storage:
- `AWS_S3_BACKLOT_BUCKET` (`swn-backlot-517220555400`) - Main assets, uploads via desktop app
- `AWS_S3_BACKLOT_FILES_BUCKET` (`swn-backlot-files-517220555400`) - Dailies files, review versions

When generating presigned URLs, detect bucket from file path patterns:
- `/assets/` or `swn-backlot-517220555400` → use main bucket
- `/dailies/` or `swn-backlot-files-517220555400` → use files bucket

## Environment Variables

Key variables in `.env` and Lambda parameters:
- `DATABASE_URL` / `DatabaseUrl` - PostgreSQL connection
- `COGNITO_USER_POOL_ID` / `CognitoUserPoolId` - Auth
- `AWS_S3_BACKLOT_BUCKET` - Main production file storage
- `AWS_S3_BACKLOT_FILES_BUCKET` - Dailies/review file storage
- `ANTHROPIC_API_KEY` - AI features

## Supabase-Style Client Limitations

The custom Supabase-compatible query client does NOT support nested joins:
```python
# WRONG - will fail
client.table("backlot_clips").select("*, backlot_projects(*)").execute()

# CORRECT - use separate queries
clip = client.table("backlot_clips").select("*").eq("id", clip_id).single().execute()
project = client.table("backlot_projects").select("*").eq("id", clip.data["project_id"]).single().execute()
```
