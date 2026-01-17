# Collab Edit Form Testing - Complete Summary

## Test Files Created

I've created comprehensive Playwright tests to debug the collab edit form population issue:

### 1. Production Test (Recommended)
**File**: `tests/e2e/collab-edit-form.spec.ts`

Uses existing Playwright auth setup, includes assertions, generates detailed report.

```bash
# Run with existing auth
npx playwright test tests/e2e/collab-edit-form.spec.ts --headed

# Or set credentials
PLAYWRIGHT_TEST_EMAIL="your@email.com" PLAYWRIGHT_TEST_PASSWORD="pass" \
  npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
```

### 2. Manual Debug Version
**File**: `tests/e2e/collab-edit-debug.spec.ts`

More verbose, allows manual login, captures everything.

```bash
npx playwright test tests/e2e/collab-edit-debug.spec.ts --headed
```

### 3. Automated Version
**File**: `tests/e2e/collab-edit-automated.spec.ts`

Can auto-login with environment variables.

```bash
TEST_EMAIL="test@example.com" TEST_PASSWORD="pass" \
  npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed
```

## Documentation Created

### 1. Quick Start Guide
**File**: `tests/e2e/QUICK-START.md`

Quick reference for running tests and interpreting results.

### 2. Comprehensive Debug Guide
**File**: `tests/e2e/README-COLLAB-EDIT-DEBUG.md`

Detailed explanation of the issue, what to look for, and how to fix it.

### 3. Complete Analysis
**File**: `COLLAB-EDIT-DEBUG-SUMMARY.md`

Full technical analysis of the issue with code references.

## What the Tests Do

### Capture
1. **Console Logs** - All logs starting with `[CollabForm]` or `[SearchableCombobox]`
2. **API Response** - Full response from `/api/v1/community/collabs/by-project/{id}`
3. **Form State** - What's actually displayed in each field
4. **Screenshots** - Visual proof saved to `tests/screenshots/collab-edit-form.png`

### Analyze
- Checks if API includes nested objects (`network`, `company_data`, `cast_position_type`)
- Verifies form fields are populated (not showing "Select...")
- Compares API data to form state
- Identifies mismatches and missing data

### Report
Generates detailed console output showing:
- What data the API returned
- What the form is displaying
- Which fields are not populating correctly
- Specific issues detected

## Example Output

### If Issue Exists (Expected):
```
--- Issues Detected ---
1. API missing 'network' object (only has network_id: abc-123)
2. API missing 'company_data' object (only has company_id: def-456)
3. Network field not populated (shows "Select...")
4. Company field not populated (shows "Select...")
```

### If Working Correctly:
```
--- Issues Detected ---
No issues detected - form appears to be working correctly!
```

## Root Cause (Expected)

The backend endpoint `/api/v1/community/collabs/by-project/{projectId}` is likely returning only ID fields instead of the full nested objects:

**Current (Wrong)**:
```json
{
  "id": "collab-123",
  "network_id": "network-456",
  "company_id": "company-789"
}
```

**Should Be**:
```json
{
  "id": "collab-123",
  "network_id": "network-456",
  "network": {
    "id": "network-456",
    "name": "Netflix",
    "slug": "netflix"
  },
  "company_id": "company-789",
  "company_data": {
    "id": "company-789",
    "name": "Second Watch Films"
  }
}
```

## The Fix

### Backend (Python/FastAPI)

Find the endpoint for `GET /api/v1/community/collabs/by-project/{project_id}` and add joins:

```python
from sqlalchemy.orm import joinedload

query = (
    select(Collab)
    .options(
        joinedload(Collab.network),
        joinedload(Collab.company_data),
        joinedload(Collab.cast_position_type)
    )
    .where(Collab.backlot_project_id == project_id)
)
```

## Running the Tests

### Prerequisites
1. Backend running on `http://localhost:8000`
2. Frontend running on `http://localhost:8080`
3. Have at least one Backlot project with a collab posting

### Quick Start

```bash
cd /home/estro/second-watch-network/frontend

# Recommended: Production test with auth
npx playwright test tests/e2e/collab-edit-form.spec.ts --headed

# Alternative: Manual debug version
npx playwright test tests/e2e/collab-edit-debug.spec.ts --headed
```

### Setting Up Auth

```bash
# Set credentials
export PLAYWRIGHT_TEST_EMAIL="your@email.com"
export PLAYWRIGHT_TEST_PASSWORD="yourpassword"

# Run auth setup
npx playwright test tests/e2e/auth.setup.ts

# Then run any test
npx playwright test tests/e2e/collab-edit-form.spec.ts
```

## What to Do Next

1. **Run the test**:
   ```bash
   npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
   ```

2. **Review the console output** - Look for the "Issues Detected" section

3. **Check the API response** - Does it include `network`, `company_data`, `cast_position_type` objects?

4. **View the screenshot** - `tests/screenshots/collab-edit-form.png`

5. **Fix the backend** - Add joins to include related objects in the API response

6. **Re-run the test** - Verify the fix works

## Files Overview

```
frontend/
├── tests/
│   ├── e2e/
│   │   ├── collab-edit-form.spec.ts           ⭐ Main test (use this)
│   │   ├── collab-edit-automated.spec.ts       Alternative automated version
│   │   ├── collab-edit-debug.spec.ts           Alternative manual version
│   │   ├── QUICK-START.md                      Quick reference guide
│   │   └── README-COLLAB-EDIT-DEBUG.md         Comprehensive debug guide
│   └── screenshots/                            Test screenshots saved here
├── COLLAB-EDIT-DEBUG-SUMMARY.md               ⭐ Complete technical analysis
└── TESTING-SUMMARY.md                          ⭐ This file
```

## Code Locations Reference

### Frontend
- CollabForm: `src/components/community/CollabForm.tsx`
  - Lines 162-256: Initial value computation
  - Lines 101, 258-264: Debug logging
- SearchableCombobox: `src/components/shared/SearchableCombobox.tsx`
  - Lines 94-99: initialSelectedItem handling
- CastingCrewTab: `src/components/backlot/workspace/CastingCrewTab.tsx`
  - Lines 982-1005: Edit dialog

### Backend
Find the endpoint handler for:
- `GET /api/v1/community/collabs/by-project/{project_id}`

This is likely in `/home/estro/second-watch-network/backend/app/api/` directory.

## Support

For questions:
- **Quick how-to**: See `tests/e2e/QUICK-START.md`
- **Understanding output**: See `tests/e2e/README-COLLAB-EDIT-DEBUG.md`
- **Technical details**: See `COLLAB-EDIT-DEBUG-SUMMARY.md`
- **This summary**: See `TESTING-SUMMARY.md`

## Expected Timeline

1. ✅ Tests created
2. ⏳ Run test to confirm diagnosis
3. ⏳ Fix backend endpoint (add joins for related objects)
4. ⏳ Re-run test to verify fix
5. ⏳ Manual verification

Total time: ~30 minutes to 1 hour (depending on backend code structure)
