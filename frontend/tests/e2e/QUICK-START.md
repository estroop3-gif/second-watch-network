# Quick Start: Debugging Collab Edit Form

## The Problem

When editing a collab posting in the Backlot Casting & Crew tab, form fields are not pre-populated:
- Position/Role dropdown is empty
- Network dropdown is empty
- Production Company dropdown is empty
- Cast requirement toggles not set
- Tape instructions/preferences empty

## Quick Test (Recommended)

**Automated version with optional auto-login:**

```bash
cd /home/estro/second-watch-network/frontend

# With auto-login (if you have test credentials)
TEST_EMAIL="your@email.com" TEST_PASSWORD="yourpass" \
  npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed

# Without auto-login (you'll login manually)
npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed
```

**Manual debug version (more detailed):**

```bash
npx playwright test tests/e2e/collab-edit-debug.spec.ts --headed
```

## Prerequisites

1. Backend running: `http://localhost:8000`
2. Frontend running: `http://localhost:8080`
3. At least one Backlot project with a collab posting

## What to Check

### 1. Console Output

Look for these debug logs:
```
[CollabForm] editCollab: { ... }
[CollabForm] initialNetwork: null  ← Should be an object!
[SearchableCombobox] initialSelectedItem: null  ← Should be an object!
```

### 2. API Response

Check if `/api/v1/community/collabs/by-project/{id}` returns:
```json
{
  "network": { "id": "...", "name": "..." },      ← Required for network field
  "company_data": { "id": "...", "name": "..." }, ← Required for company field
  "cast_position_type": { "id": "...", "name": "..." }  ← Required for cast position
}
```

**NOT just:**
```json
{
  "network_id": "...",      ← Only ID, missing object
  "company_id": "...",      ← Only ID, missing object
  "cast_position_type_id": "..."  ← Only ID, missing object
}
```

### 3. Screenshots

Check `tests/screenshots/collab-edit-form.png` to see the actual form state.

## Expected Root Cause

The backend API endpoint `/api/v1/community/collabs/by-project/{projectId}` is likely returning only IDs instead of the full nested objects for:
- `network` (only returning `network_id`)
- `company_data` (only returning `company_id`)
- `cast_position_type` (only returning `cast_position_type_id`)

## The Fix (Backend)

Find the endpoint that handles `GET /api/v1/community/collabs/by-project/{projectId}` and ensure it joins/includes these related objects:

```python
# Backend example (pseudo-code)
query = (
    select(Collab)
    .options(
        joinedload(Collab.network),          # Include network object
        joinedload(Collab.company_data),     # Include company object
        joinedload(Collab.cast_position_type) # Include cast position type
    )
    .where(Collab.backlot_project_id == project_id)
)
```

## Frontend Code Locations

- **CollabForm component**: `/home/estro/second-watch-network/frontend/src/components/community/CollabForm.tsx`
  - Lines 162-256: Initial value computation
  - Lines 414-443: Position/Role selectors
  - Lines 496-505: Network selector
  - Lines 482-494: Company selector

- **SearchableCombobox**: `/home/estro/second-watch-network/frontend/src/components/shared/SearchableCombobox.tsx`
  - Lines 94-99: initialSelectedItem handling

- **CastingCrewTab**: `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/CastingCrewTab.tsx`
  - Lines 982-1005: Edit dialog invocation

## After Running Tests

1. Review console output for [CollabForm] and [SearchableCombobox] logs
2. Check API response structure
3. Verify if backend is returning nested objects or just IDs
4. Fix backend endpoint to include related objects
5. Re-test to confirm fix

## Manual Testing Alternative

1. Open DevTools (F12) → Console tab
2. Navigate to a project's Casting & Crew tab
3. Click Edit on a collab posting
4. Look for console logs starting with `[CollabForm]`
5. Check Network tab for API response structure

## Need Help?

Share:
- Console logs with [CollabForm] and [SearchableCombobox]
- API response JSON from Network tab
- Screenshot from `tests/screenshots/collab-edit-form.png`
