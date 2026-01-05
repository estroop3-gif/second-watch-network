# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `/home/estro/second-watch-network/CLAUDE.md` for full project overview including backend and deployment.

## Development Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build (unminified)
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Architecture

### API Client (`src/lib/api.ts`)
Centralized API client (~4100 lines) with:
- `APIClient` class with automatic token management
- JWT token decoding for Cognito user ID extraction
- Domain-specific API modules exported as `api.admin`, `api.backlot`, etc.
- Sub-clients in `src/lib/api/` for Order, community features

```typescript
import { api } from '@/lib/api';
await api.get('/users/me');
await api.admin.getStats();
```

### Performance Metrics (`src/lib/performanceMetrics.ts`)
Client-side timing instrumentation for diagnosing cold start and load issues:
- Tracks bundle load, app mount, auth check, first API call
- Sends metrics to `/api/v1/client-metrics/initial-load` and `/api/v1/client-metrics/login`
- Logs summaries to browser console with `[PerfMetrics]` prefix

### Context Providers (`src/context/`)
- `AuthContext` - Authentication state, login/logout, profile
- `EnrichedProfileContext` - User profile with badges, permissions, Order membership
- `DashboardSettingsContext` - Dashboard customization state
- `SettingsContext` - User preferences
- `SocketContext` - Real-time WebSocket connections

### Dashboard System (`src/components/dashboard/`)
Role-based adaptive dashboard with lazy-loaded widgets:

**Configuration** (`config/`):
- `dashboardConfig.ts` - Section definitions, role visibility, priorities
- `sectionRegistry.ts` - Lazy-loaded component mappings

**Role Groups**:
- `ALL_ROLES` - Everyone including free users
- `AUTHENTICATED_ROLES` - Logged-in users (excludes free)
- `CREATOR_ROLES` - Filmmakers, partners, staff
- `ORDER_ROLES` - Guild members, lodge officers, staff
- `STAFF_ROLES` - Superadmin, admin, moderator

**Adding a new widget**:
1. Create component in `sections/<category>/`
2. Add ID to `DashboardSectionId` type in `dashboardConfig.ts`
3. Add section config to `DASHBOARD_SECTIONS` array
4. Add lazy import to `sectionRegistry.ts`
5. Add to `dataMap` in `AdaptiveDashboard.tsx`

### Component Organization (`src/components/`)
- `ui/` - shadcn/ui base components (auto-generated, avoid direct edits)
- `dashboard/` - Adaptive dashboard and widgets
- `backlot/workspace/` - Production management UI (largest feature area)
- `admin/` - Admin panel components
- `order/` - Order (guild) components

### Hooks (`src/hooks/`)
- `backlot/` - 50+ production management hooks
- `watch/` - Streaming hooks (useWorlds, useContinueWatching, useEvents, useShorts)
- General hooks for profiles, notifications, permissions

### Page Organization (`src/pages/`)
- Root level: General pages (Dashboard, Account, Messages)
- `admin/` - Admin panel pages
- `backlot/` - Production workspace (20+ sub-routes)
- `order/` - Order guild pages
- `watch/` - Streaming/player pages

### Routes
All routes defined in `src/App.tsx`. Uses React Router with:
- `PermissionRoute` - Role-based access control
- `OnboardingGate` - Onboarding flow enforcement

## Key Patterns

### Data Fetching
TanStack React Query with custom hooks:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => api.get(`/resource/${id}`)
});
```

### Forms
React Hook Form + Zod validation:
```typescript
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
});
```

### Styling
Tailwind CSS with design tokens:
- `bg-charcoal-black` (#121212)
- `text-bone-white` (#F9F5EF)
- `text-muted-gray` (#4C4C4C)
- `text-accent-yellow` (#FCDC58)
- `text-primary-red` (#FF3C3C)

### Imports
Path alias `@/` maps to `src/`:
```typescript
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
```

## Vite Configuration

- Dev server: Port 8080
- API proxy: `/api` routes to `localhost:8000` in development
- Production: Uses `VITE_API_URL` environment variable (https://vnvvoelid6.execute-api.us-east-1.amazonaws.com)

## Deployment

```bash
# Build for production
VITE_API_URL=https://vnvvoelid6.execute-api.us-east-1.amazonaws.com npm run build

# Deploy to S3 + invalidate CloudFront
aws s3 sync dist/ s3://swn-frontend-517220555400 --delete
aws cloudfront create-invalidation --distribution-id EJRGRTMJFSXN2 --paths "/*"
```
