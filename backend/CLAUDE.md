# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run a single migration (psql not installed, use Node.js pg client)
node -e "
const { Client } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('migrations/246_*.sql', 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
client.connect().then(() => client.query(sql)).then(() => console.log('Done')).finally(() => client.end());
"

# Deploy to AWS Lambda
sam build && sam deploy
```

## Architecture

### API Structure (114 modules in `app/api/`)
- **Domain modules**: `auth.py`, `users.py`, `profiles.py`, `content.py`, `filmmakers.py`
- **Admin modules**: `admin.py`, `admin_users.py`, `admin_content.py`, `admin_backlot.py`, etc.
- **Feature modules**: `backlot.py` (~49K lines), `consumer_video.py`, `worlds.py`
- **CRM modules**: `crm.py` (~8.7K lines, 80+ routes — contacts, deals, email, scraping, pricing), `crm_admin.py` (~2.3K lines, 40+ routes)
- **Church production**: `church_services.py`, `church_people.py`, `church_content.py`, etc.
- **Monetization**: `creator_earnings.py`, `organizations.py`, `billing.py`

### Core Modules (`app/core/`)
| Module | Purpose |
|--------|---------|
| `database.py` | SQLAlchemy connection + chainable query builder |
| `auth.py` | AWS Cognito JWT validation |
| `permissions.py` | Fine-grained permission system (`Permission.BACKLOT_VIEW`, etc.) |
| `roles.py` | Role types: `SUPERADMIN`, `ADMIN`, `MODERATOR`, `ORDER_MEMBER`, `FILMMAKER`, etc. |
| `deps.py` | FastAPI dependencies: `require_admin`, `require_order_member`, `require_premium_content_access` |
| `storage.py` | S3 storage operations |
| `exceptions.py` | Structured error handling |

### Services (`app/services/`, 60 modules)
- `watch_aggregation.py` - Hourly/daily/monthly watch time rollups
- `revenue_calculation.py` - Creator earnings from watch share
- `media_orchestrator.py` - Unified media job tracking
- `email_service.py` - SES email sending
- `email_templates.py` - Shared SWN-branded email templates (`base_template()`, `cta_button()`, etc.)
- `pdf_service.py` - Call sheet, script breakdown PDFs
- `pricing_engine.py` - Tiered pricing with add-ons and annual prepay

### Background Jobs (`app/jobs/`)
- `email_scheduler.py` - APScheduler for scheduled sends, snooze expiry, sequence progression, campaign blasts, notification digests

### Docker Workers (`docker/`)
- `scraper/` - ECS Fargate web scraper (BFS recursive crawl, contact extraction, scoring)
- `discovery/` - ECS Fargate lead discovery (Google CSE + Maps adapters → find websites → score)
- `transcode/` - Media transcoding worker

## Database Patterns

### Two Query Styles
```python
# 1. Query builder (simple CRUD) — chainable API over SQLAlchemy
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

### CRM (Sales Pipeline)
- `crm_contacts`, `crm_activities`, `crm_interaction_counts` - Contact management
- `crm_deals`, `crm_deal_stage_history` - Pipeline/kanban
- `crm_sales_goals` - Goals and KPIs
- `crm_email_accounts`, `crm_email_threads`, `crm_email_messages` - Full email client
- `crm_email_campaigns`, `crm_email_sends` - Campaign blasts with DNC
- `crm_email_templates` - TipTap WYSIWYG templates
- `crm_scrape_sources`, `crm_scrape_jobs`, `crm_scraped_leads` - Web scraping
- `crm_scrape_profiles`, `crm_discovery_profiles`, `crm_discovery_runs`, `crm_discovery_sites` - Discovery
- `crm_lead_lists`, `crm_lead_list_items` - Lead list management
- `crm_business_cards` - Rep business card workflow (draft→submitted→approved→printed)
- `crm_training_resources`, `crm_discussion_*` - Training hub
- `pricing_quotes`, `pricing_quote_versions` - CPQ pricing wizard
- CRM roles: `sales_agent` (CRM_VIEW+CREATE), `sales_admin` (full CRM), `sales_rep` (broad platform+CRM)

## Migrations

Located in `migrations/`. Currently at 246. Run via Node.js pg client (psql not installed).

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

## Query Builder Limitations

The chainable query builder does NOT support nested joins:
```python
# WRONG - will fail
client.table("backlot_clips").select("*, backlot_projects(*)").execute()

# CORRECT - use separate queries or raw SQL
clip = client.table("backlot_clips").select("*").eq("id", clip_id).single().execute()
project = client.table("backlot_projects").select("*").eq("id", clip.data["project_id"]).single().execute()
```
