# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `/home/estro/second-watch-network/CLAUDE.md` for full project overview including backend and deployment.

## Development Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Architecture

### API Client (`src/lib/api.ts`)
Centralized 120KB+ API client with:
- `APIClient` class with automatic token management
- Domain-specific API modules exported as `api.admin`, `api.backlot`, etc.
- Sub-clients in `src/lib/api/` for Order, community features

```typescript
import { api } from '@/lib/api';
await api.get('/users/me');
await api.admin.getStats();
```

### Context Providers (`src/context/`)
- `AuthContext` - Authentication state, login/logout
- `EnrichedProfileContext` - User profile with badges, permissions, Order membership
- `SettingsContext` - User preferences
- `SocketContext` - Real-time WebSocket connections

### Component Organization (`src/components/`)
- `ui/` - shadcn/ui base components (auto-generated, avoid direct edits)
- `backlot/workspace/` - Production management UI (largest feature area)
- `admin/` - Admin panel components
- `order/` - Order (guild) components

### Hooks (`src/hooks/`)
- `backlot/` - 50+ production management hooks (useClearances, useCastingCrew, useInvoices, etc.)
- General hooks for profiles, notifications, permissions

### Page Organization (`src/pages/`)
- Root level: General pages (Dashboard, Account, Messages)
- `admin/` - Admin panel pages
- `backlot/` - Production workspace
- `order/` - Order guild pages

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
- Production: Uses `VITE_API_URL` environment variable
