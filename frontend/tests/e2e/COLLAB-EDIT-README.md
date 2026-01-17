# Collab Edit Form Testing

## TL;DR - Run This Now

```bash
cd /home/estro/second-watch-network/frontend

# Make sure backend and frontend are running first
# Then run the test:
npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
```

The test will:
1. Login (use existing auth or login manually)
2. Navigate to a Backlot project
3. Click Edit on a collab posting
4. Capture all debug data
5. Print a detailed report
6. Save a screenshot

## The Problem

When editing a collab posting, form fields aren't being populated:
- Position/Role dropdown is empty
- Network dropdown is empty
- Production Company dropdown is empty
- Cast requirements not set correctly
- Tape instructions/preferences empty

## The Diagnosis

The backend API `/api/v1/community/collabs/by-project/{id}` is likely returning only ID fields instead of the full nested objects that the frontend expects.

## Test Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `collab-edit-form.spec.ts` | ⭐ Main production test | Use this first |
| `collab-edit-automated.spec.ts` | Auto-login version | If you have test creds |
| `collab-edit-debug.spec.ts` | Verbose manual version | For deeper debugging |

## Running Tests

### Option 1: With Existing Auth (Easiest)

```bash
# Run auth setup first (one time)
export PLAYWRIGHT_TEST_EMAIL="your@email.com"
export PLAYWRIGHT_TEST_PASSWORD="yourpassword"
npx playwright test tests/e2e/auth.setup.ts

# Then run the test
npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
```

### Option 2: Manual Login

```bash
# Just run the test, it will wait for you to login
npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
```

### Option 3: Auto-Login

```bash
TEST_EMAIL="test@example.com" TEST_PASSWORD="pass" \
  npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed
```

## Understanding the Output

### Console Report

The test prints a detailed report like this:

```
=== COLLAB EDIT FORM DEBUG REPORT ===

--- Console Logs ---
1. [LOG] [CollabForm] editCollab: { ... }
2. [LOG] [CollabForm] initialNetwork: null       ← ❌ Should be object
3. [LOG] [CollabForm] initialCompany: null       ← ❌ Should be object

--- API Response ---
Title: Director
Type: looking_for_crew

Related Objects:
  network_id: abc-123
  network object: MISSING                         ← ❌ Problem!
  company_id: def-456
  company_data object: MISSING                    ← ❌ Problem!

--- Form Field State ---
{
  "position": "Select...",                        ← ❌ Empty
  "network": "Select...",                         ← ❌ Empty
  "company": "Select..."                          ← ❌ Empty
}

--- Issues Detected ---
1. API missing 'network' object (only has network_id: abc-123)
2. API missing 'company_data' object (only has company_id: def-456)
3. Position field not populated (shows "Select...")
4. Network field not populated (shows "Select...")
5. Company field not populated (shows "Select...")
```

### What to Look For

#### ✅ WORKING (What you want to see):
```
Related Objects:
  network_id: abc-123
  network object: PRESENT                         ← ✅ Good!
    - name: Netflix
    - id: abc-123

Form Field State:
  "network": "Netflix"                            ← ✅ Populated!

Issues Detected:
No issues detected - form appears to be working correctly!
```

#### ❌ BROKEN (What you're likely seeing now):
```
Related Objects:
  network_id: abc-123
  network object: MISSING                         ← ❌ Problem

Form Field State:
  "network": "Select..."                          ← ❌ Empty

Issues Detected:
1. API missing 'network' object (only has network_id: abc-123)
2. Network field not populated (shows "Select...")
```

## The Fix

### Backend Change Required

Find the endpoint: `GET /api/v1/community/collabs/by-project/{project_id}`

Add these joins to include related objects:

```python
from sqlalchemy.orm import joinedload

query = (
    select(Collab)
    .options(
        joinedload(Collab.network),           # Add this
        joinedload(Collab.company_data),      # Add this
        joinedload(Collab.cast_position_type) # Add this
    )
    .where(Collab.backlot_project_id == project_id)
)
```

### Why This Fixes It

The frontend code computes initial values like this:

```typescript
const initialNetwork = useMemo(() => {
  if (editCollab?.network) {  // ← Needs the OBJECT, not just ID
    return {
      id: editCollab.network.id,
      name: editCollab.network.name,
      // ...
    };
  }
  return null;  // ← Returns null if object missing, field stays empty
}, [editCollab?.network]);
```

Without the nested object, `initialNetwork` is `null`, and the field shows "Select...".

## Verification

After fixing the backend:

1. Restart the backend server
2. Run the test again:
   ```bash
   npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
   ```
3. Check the output shows "No issues detected"
4. Verify screenshot shows populated fields

## Screenshots

Tests save screenshots to `tests/screenshots/collab-edit-form.png`

You can visually verify the form state.

## Additional Documentation

For more details, see:

| File | Content |
|------|---------|
| `QUICK-START.md` | Quick reference guide |
| `README-COLLAB-EDIT-DEBUG.md` | Comprehensive debugging guide |
| `../../COLLAB-EDIT-DEBUG-SUMMARY.md` | Complete technical analysis |
| `../../TESTING-SUMMARY.md` | Overview of all test files |

## Code References

### Frontend (where the issue manifests)

**CollabForm** (`src/components/community/CollabForm.tsx`):
- Lines 162-256: Initial value computation (useMemo hooks)
- Line 242-256: `initialNetwork` computation
- Line 222-240: `initialCompany` computation
- Line 183-212: `initialCastPosition` computation

**SearchableCombobox** (`src/components/shared/SearchableCombobox.tsx`):
- Lines 94-99: `initialSelectedItem` handling

### Backend (where the fix is needed)

Look for the endpoint handler for:
```
GET /api/v1/community/collabs/by-project/{project_id}
```

Likely location: `backend/app/api/` (check files related to community/collabs)

## Prerequisites

Before running tests:

1. ✅ Backend running on `http://localhost:8000`
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. ✅ Frontend running on `http://localhost:8080`
   ```bash
   cd frontend
   npm run dev
   ```

3. ✅ At least one Backlot project with a collab posting
   - Create a project if needed
   - Go to Casting & Crew tab
   - Click "Post Role" to create a collab

## Troubleshooting

### "No collab postings found"

Create a collab posting first:
1. Navigate to a Backlot project
2. Go to Casting & Crew tab
3. Click "Post Role"
4. Fill out the form and submit

### "Authentication failed"

Set credentials:
```bash
export PLAYWRIGHT_TEST_EMAIL="your@email.com"
export PLAYWRIGHT_TEST_PASSWORD="yourpassword"
```

### "Cannot find module @playwright/test"

Install Playwright:
```bash
npm install -D @playwright/test
npx playwright install
```

### Backend not responding

Check backend is running:
```bash
curl http://localhost:8000/health
```

## Summary

1. **Run the test**: `npx playwright test tests/e2e/collab-edit-form.spec.ts --headed`
2. **Check the report**: Look for "Issues Detected" in console output
3. **Fix the backend**: Add joins to include `network`, `company_data`, `cast_position_type` objects
4. **Re-run test**: Verify "No issues detected"
5. **Done!** 🎉

The test will tell you exactly what's wrong and what needs to be fixed.
