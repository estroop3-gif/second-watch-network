# Collab Edit Form Population - Debug Summary

## Issue Description

When clicking "Edit" on a collab posting in the Backlot CastingCrewTab, the form fields are not being pre-populated with the original values. Specifically:

- ❌ Position/Role dropdown is empty (shows "Select...")
- ❌ Network dropdown is empty (shows "Select...")
- ❌ Production Company dropdown is empty (shows "Select...")
- ❌ Cast requirement toggles (requires_reel, requires_headshot, requires_self_tape) are not set to original values
- ❌ Tape instructions field is empty
- ❌ Tape format preferences field is empty

## Root Cause Analysis

After analyzing the code, the issue is likely caused by **missing nested objects in the API response**.

### How the Edit Flow Works

1. **CastingCrewTab** fetches collabs via `useProjectCollabs(projectId)`
2. This calls `/api/v1/community/collabs/by-project/{projectId}`
3. When Edit is clicked, the full collab object is passed to **CollabForm** as `editCollab` prop
4. **CollabForm** computes initial values using `useMemo` hooks (lines 162-256):
   - `initialPosition` - computed from `editCollab.title`
   - `initialCastPosition` - computed from `editCollab.cast_position_type` **object**
   - `initialCompany` - computed from `editCollab.company_data` **object**
   - `initialNetwork` - computed from `editCollab.network` **object**
5. These initial values are passed to selector components (PositionSelector, CastPositionSelector, CompanySelector, EnhancedNetworkSelector)
6. Each selector is wrapped in **SearchableCombobox**, which accepts an `initialSelectedItem` prop

### The Problem

The `useMemo` hooks in CollabForm expect **full nested objects**, but the API likely returns only **ID fields**:

```typescript
// CollabForm expects (lines 242-256):
const initialNetwork = useMemo(() => {
  if (editCollab?.network) {  // ← Looking for network OBJECT
    return {
      id: editCollab.network.id,
      name: editCollab.network.name,
      slug: editCollab.network.slug,
      logo_url: editCollab.network.logo_url,
      category: editCollab.network.category,
    };
  }
  return null;  // ← Returns null if network object not present
}, [editCollab?.network]);
```

If the API returns this:
```json
{
  "id": "collab-123",
  "title": "Director",
  "network_id": "network-456",    ← Only ID
  "company_id": "company-789",    ← Only ID
  "cast_position_type_id": "pos-012"  ← Only ID
}
```

Instead of this:
```json
{
  "id": "collab-123",
  "title": "Director",
  "network_id": "network-456",
  "network": {                     ← Full object
    "id": "network-456",
    "name": "Netflix",
    "slug": "netflix",
    "logo_url": "https://...",
    "category": "streaming"
  },
  "company_id": "company-789",
  "company_data": {                ← Full object
    "id": "company-789",
    "name": "Second Watch Films",
    "logo_url": "https://...",
    "is_verified": true
  },
  "cast_position_type_id": "pos-012",
  "cast_position_type": {          ← Full object
    "id": "pos-012",
    "name": "Lead",
    "slug": "lead"
  }
}
```

Then `initialNetwork`, `initialCompany`, and `initialCastPosition` will all be `null`, and the form fields will be empty.

## Debug Console Logs

The code already has debug logging in place:

**CollabForm.tsx** (lines 101, 258-264):
```typescript
console.log('[CollabForm] editCollab:', editCollab);
console.log('[CollabForm] initialPosition:', initialPosition);
console.log('[CollabForm] initialCastPosition:', initialCastPosition);
console.log('[CollabForm] initialProduction:', initialProduction);
console.log('[CollabForm] initialCompany:', initialCompany);
console.log('[CollabForm] initialNetwork:', initialNetwork);
console.log('[CollabForm] formData:', formData);
```

**SearchableCombobox.tsx** (line 71):
```typescript
console.log('[SearchableCombobox] value:', value, 'initialSelectedItem:', initialSelectedItem, 'selectedItem:', selectedItem);
```

These logs will show exactly what data is being received and computed.

## Testing Approach

I've created comprehensive Playwright tests to capture all relevant debug information:

### Test Files Created

1. **`tests/e2e/collab-edit-debug.spec.ts`** - Manual login, detailed capture
2. **`tests/e2e/collab-edit-automated.spec.ts`** - Optional auto-login, streamlined
3. **`tests/e2e/README-COLLAB-EDIT-DEBUG.md`** - Comprehensive debugging guide
4. **`tests/e2e/QUICK-START.md`** - Quick reference for running tests

### What the Tests Capture

1. **Console Logs**
   - All logs starting with `[CollabForm]`
   - All logs starting with `[SearchableCombobox]`
   - These show what data is being computed

2. **Network Requests**
   - Captures `/api/v1/community/collabs/by-project/{id}` response
   - Checks if nested objects are present
   - Validates response structure

3. **Form Field Values**
   - What's actually displayed in each dropdown
   - State of toggle switches
   - Content of text fields

4. **Screenshots**
   - Visual proof of form state
   - Saved to `tests/screenshots/collab-edit-form.png`

## How to Run Tests

### Quick Start

```bash
cd /home/estro/second-watch-network/frontend

# Automated version (recommended)
npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed

# With auto-login
TEST_EMAIL="test@example.com" TEST_PASSWORD="password" \
  npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed

# Manual detailed version
npx playwright test tests/e2e/collab-edit-debug.spec.ts --headed
```

### Prerequisites

- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:8080`
- At least one Backlot project with a collab posting

## Expected Test Output

### If Backend is Missing Nested Objects (ISSUE):

```
--- Console Logs ---
[CollabForm] editCollab: { id: "...", network_id: "...", company_id: "..." }
[CollabForm] initialNetwork: null  ← ❌ NULL (should be object)
[CollabForm] initialCompany: null  ← ❌ NULL (should be object)

--- API Response ---
{
  "network_id": "some-uuid",
  ❌ Only network_id present  ← Missing network object

  "company_id": "some-uuid",
  ❌ Only company_id present  ← Missing company_data object
}

--- Form Field Values ---
{
  "network": "Select...",  ← ❌ Empty
  "company": "Select..."   ← ❌ Empty
}
```

### If Backend Returns Nested Objects (WORKING):

```
--- Console Logs ---
[CollabForm] editCollab: { id: "...", network: { ... }, company_data: { ... } }
[CollabForm] initialNetwork: { id: "...", name: "Netflix", ... }  ← ✓ OBJECT
[CollabForm] initialCompany: { id: "...", name: "Second Watch Films", ... }  ← ✓ OBJECT

--- API Response ---
{
  "network_id": "some-uuid",
  "network": { "id": "...", "name": "Netflix", ... }  ← ✓ Present

  "company_id": "some-uuid",
  "company_data": { "id": "...", "name": "Second Watch Films", ... }  ← ✓ Present
}

--- Form Field Values ---
{
  "network": "Netflix",  ← ✓ Populated
  "company": "Second Watch Films"  ← ✓ Populated
}
```

## The Fix

### Backend (Python/FastAPI)

Locate the endpoint for `GET /api/v1/community/collabs/by-project/{projectId}` and ensure it includes related objects:

```python
# Pseudo-code example
from sqlalchemy.orm import joinedload

def get_project_collabs(project_id: str):
    query = (
        select(Collab)
        .options(
            joinedload(Collab.network),           # Include network
            joinedload(Collab.company_data),      # Include company
            joinedload(Collab.cast_position_type) # Include cast position type
        )
        .where(Collab.backlot_project_id == project_id)
    )

    results = session.execute(query).unique().scalars().all()
    return [collab.to_dict(include_relations=True) for collab in results]
```

### Alternative Frontend Fix (If Backend Can't Be Changed)

If the backend cannot be modified, the frontend could fetch the related objects separately:

```typescript
// In CollabForm, add effects to fetch missing data
useEffect(() => {
  if (editCollab?.network_id && !editCollab?.network) {
    api.getNetwork(editCollab.network_id).then(network => {
      // Set network data
    });
  }
}, [editCollab?.network_id, editCollab?.network]);
```

However, this is less efficient and the backend fix is preferred.

## Verification After Fix

1. Run the tests again
2. Check console logs show populated `initial*` values
3. Verify API response includes nested objects
4. Confirm form fields display correct values
5. Manually test editing and saving a collab

## Code Locations Reference

### Frontend

- **CollabForm**: `/home/estro/second-watch-network/frontend/src/components/community/CollabForm.tsx`
  - Lines 101, 258-264: Debug logging
  - Lines 162-256: Initial value computation (useMemo hooks)
  - Lines 414-443: Position/Role selectors with initialSelectedItem
  - Lines 496-505: Network selector with initialSelectedItem
  - Lines 482-494: Company selector with initialSelectedItem

- **SearchableCombobox**: `/home/estro/second-watch-network/frontend/src/components/shared/SearchableCombobox.tsx`
  - Line 71: Debug logging
  - Lines 94-99: initialSelectedItem handling

- **CastingCrewTab**: `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/CastingCrewTab.tsx`
  - Line 353: onEdit callback
  - Lines 982-1005: Edit dialog with editCollab prop

- **API Hook**: `/home/estro/second-watch-network/frontend/src/hooks/backlot/useProjectCollabs.ts`
  - Lines 12-18: useProjectCollabs hook

- **API Client**: `/home/estro/second-watch-network/frontend/src/lib/api.ts`
  - Lines 1564-1566: getProjectCollabs method

### Backend

Look for the endpoint handler for:
- `GET /api/v1/community/collabs/by-project/{project_id}`

This is likely in:
- `/home/estro/second-watch-network/backend/app/api/` (check community or collab related files)

## Timeline

1. ✅ Issue identified
2. ✅ Code analysis completed
3. ✅ Root cause identified (likely missing nested objects in API response)
4. ✅ Playwright tests created
5. ⏳ Run tests to confirm diagnosis
6. ⏳ Fix backend endpoint to include nested objects
7. ⏳ Verify fix with tests
8. ⏳ Manual verification

## Contact

For questions about:
- **Running tests**: See `tests/e2e/QUICK-START.md`
- **Understanding output**: See `tests/e2e/README-COLLAB-EDIT-DEBUG.md`
- **Code changes needed**: See this document's "The Fix" section
