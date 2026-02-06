---
description: Mobile screen optimization specialist - audit and fix a page/tab for mobile responsiveness
allowed-tools: Read, Edit, Write, Bash(*), Glob, Grep, WebSearch, WebFetch, Task
---

# Mobile Screen Optimization Specialist

You are an expert in mobile-first responsive design for the Second Watch Network platform. Your job is to audit a specific page or tab, identify mobile layout issues, and fix them.

## Usage

```
/mobile-optimize <page-or-route>
```

**Argument**: A page name, route path, tab name, or component name to optimize. Examples:
- `/mobile-optimize dashboard` - The main dashboard
- `/mobile-optimize backlot` - The backlot home page
- `/mobile-optimize admin/users` - The admin users page
- `/mobile-optimize hot-set` - The hot set view
- `/mobile-optimize landing` - The landing page
- `/mobile-optimize gear` - The gear house page

## Workflow

### Phase 1: Audit (Playwright Screenshot Agent)

Spawn a **Playwright audit agent** to capture the current state of the target page at mobile viewport sizes. This agent should:

1. Source test credentials: `source /home/estro/second-watch-network/frontend/.env.playwright`
2. Create a Playwright test file at `tests/e2e/mobile-audit-<page>.spec.ts`
3. Use the `chromium` project with stored auth from `playwright/.auth/user.json`
4. Set viewport to common mobile sizes:
   - **iPhone SE**: 375x667
   - **iPhone 14 Pro**: 393x852
   - **iPad Mini**: 768x1024
5. Navigate to the target page/tab
6. Take full-page screenshots at each viewport size
7. Save screenshots to `tests/e2e/screenshots/mobile-audit/`
8. Log element measurements: any element wider than viewport, horizontal overflow, text truncation, touch target sizes < 44px
9. Run the test: `cd /home/estro/second-watch-network/frontend && npx playwright test tests/e2e/mobile-audit-<page>.spec.ts --project=chromium --reporter=list`

### Phase 2: Analysis

After screenshots are captured, read each screenshot image and analyze for these common mobile issues:

**Layout Issues:**
- Horizontal overflow / horizontal scrolling
- Elements wider than viewport (tables, cards, forms)
- Fixed-width containers that don't flex
- Side-by-side layouts that should stack on mobile
- Modals/dialogs that overflow the screen

**Typography Issues:**
- Text too small to read (< 14px effective)
- Long text not wrapping or truncating
- Headings too large for mobile

**Touch Target Issues:**
- Buttons/links smaller than 44x44px
- Clickable elements too close together
- No visible tap states

**Navigation Issues:**
- Tabs overflowing horizontally without scroll indicators
- Sidebars not collapsing on mobile
- Fixed headers/footers taking too much vertical space

**Content Issues:**
- Images not responsive (fixed width)
- Tables not scrollable or not adapted for mobile
- Cards not stacking vertically
- Grid layouts not collapsing to single column

### Phase 3: Fix Implementation

For each identified issue, make targeted CSS/layout fixes using Tailwind responsive utilities:

**Responsive Prefix Reference:**
- `sm:` → 640px+
- `md:` → 768px+
- `lg:` → 1024px+
- `xl:` → 1280px+

**Common Fix Patterns:**
```tsx
{/* Stack on mobile, side-by-side on desktop */}
<div className="flex flex-col md:flex-row gap-4">

{/* Full width on mobile, constrained on desktop */}
<div className="w-full md:w-1/2 lg:w-1/3">

{/* Hide on mobile, show on desktop */}
<div className="hidden md:block">

{/* Mobile-only element */}
<div className="block md:hidden">

{/* Responsive text */}
<h1 className="text-xl md:text-2xl lg:text-3xl">

{/* Responsive padding */}
<div className="px-3 md:px-6 lg:px-8">

{/* Responsive grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

{/* Scrollable table wrapper */}
<div className="overflow-x-auto -mx-4 px-4">
  <table className="min-w-full">

{/* Touch-friendly buttons */}
<button className="min-h-[44px] min-w-[44px] px-4 py-3">
```

**Rules:**
- Mobile-first: default styles are for mobile, add `md:` / `lg:` for larger screens
- Never use fixed pixel widths on containers (use max-w-* or w-full)
- Prefer `gap-*` over margin for spacing between flex/grid children
- Use `overflow-x-auto` for tables and horizontal content
- Ensure minimum 44px touch targets for interactive elements
- Use `truncate` or `line-clamp-*` for text that might overflow
- Preserve the existing desktop layout — only add/modify responsive behavior

### Phase 4: Verification (Playwright Verification Agent)

After fixes are applied, spawn another **Playwright agent** to re-screenshot at the same viewports and verify:

1. No horizontal overflow at any mobile viewport
2. All content is readable and accessible
3. Touch targets are adequate
4. Desktop layout is preserved (take a 1440px screenshot too)
5. Compare before/after screenshots

## Key File Paths

### Frontend
- Pages: `/home/estro/second-watch-network/frontend/src/pages/`
- Components: `/home/estro/second-watch-network/frontend/src/components/`
- Backlot workspace: `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/`
- Gear components: `/home/estro/second-watch-network/frontend/src/components/gear/`
- Admin components: `/home/estro/second-watch-network/frontend/src/components/admin/`
- UI primitives: `/home/estro/second-watch-network/frontend/src/components/ui/`
- Routes: `/home/estro/second-watch-network/frontend/src/App.tsx`

### Test Infrastructure
- Playwright config: `/home/estro/second-watch-network/frontend/playwright.config.ts`
- Auth state: `/home/estro/second-watch-network/frontend/playwright/.auth/user.json`
- Screenshots dir: `/home/estro/second-watch-network/frontend/tests/e2e/screenshots/mobile-audit/`
- Test credentials: `/home/estro/second-watch-network/frontend/.env.playwright`

## Design System

| Color | Hex | Tailwind Class |
|-------|-----|----------------|
| Primary Red | #FF3C3C | `text-primary-red` |
| Charcoal Black | #121212 | `bg-charcoal-black` |
| Bone White | #F9F5EF | `text-bone-white` |
| Muted Gray | #4C4C4C | `text-muted-gray` |
| Accent Yellow | #FCDC58 | `text-accent-yellow` |

**Fonts**: Space Grotesk (headings), IBM Plex Sans (body)

## Agent Strategy

Use multiple agents in parallel when possible:

1. **Explore agent** — Find the component files for the target page/tab
2. **Playwright audit agent** — Capture screenshots at mobile viewports
3. **Analysis** — Read screenshots and identify issues (do this yourself)
4. **Fix implementation** — Edit component files (do this yourself)
5. **Playwright verification agent** — Re-capture and verify fixes

For complex pages with many sub-components, spawn separate agents to audit different sections in parallel.
