# Collab Edit Form Population Debugging Guide

## Problem Statement

When clicking "Edit" on a collab posting in the Backlot CastingCrewTab, the form fields are not being pre-populated with the original values:

- Position/Role dropdown is empty
- Network dropdown is empty
- Production Company dropdown is empty
- Cast requirement toggles (requires_reel, requires_headshot, requires_self_tape) are not set
- Tape instructions and format preferences are empty

## How to Run the Debug Test

### Prerequisites

1. **Backend must be running** on `http://localhost:8000`
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend must be running** on `http://localhost:8080`
   ```bash
   cd frontend
   npm run dev
   ```

3. **You must have at least one Backlot project with at least one collab posting**
   - If you don't have one, create a project and post a role from the Casting & Crew tab

### Running the Test

1. From the `frontend` directory, run:
   ```bash
   npx playwright test tests/e2e/collab-edit-debug.spec.ts --headed
   ```

2. When prompted, **manually login** to the application in the Playwright browser window
   - The test will wait for up to 2 minutes for you to complete the login

3. The test will automatically:
   - Navigate to your Backlot projects
   - Open the first project
   - Open the Casting & Crew tab
   - Click Edit on a collab posting
   - Capture all relevant debug data

4. Review the console output and screenshots

### What to Look For in the Output

#### 1. Console Logs

Look for logs starting with `[CollabForm]` and `[SearchableCombobox]`:

```
[CollabForm] editCollab: { ... }
[CollabForm] initialPosition: null | { id, name, department }
[CollabForm] initialCastPosition: null | { id, name, slug }
[CollabForm] initialCompany: null | { id, name, logo_url, is_verified }
[CollabForm] initialNetwork: null | { id, name, slug, logo_url, category }
[CollabForm] formData: { ... }
[SearchableCombobox] value: "some-id" initialSelectedItem: null | { ... } selectedItem: null | { ... }
```

**Key Questions:**
- Is `editCollab` populated with data?
- Are the `initial*` values being computed correctly?
- Is the `initialSelectedItem` being passed to SearchableCombobox?
- Is SearchableCombobox receiving and using the `initialSelectedItem`?

#### 2. API Response

Look for the API call to `/api/v1/community/collabs/by-project/{projectId}`:

```json
{
  "id": "...",
  "title": "Director",
  "type": "looking_for_crew",
  "network_id": "some-uuid",
  "network": {                    // ← Check if this exists
    "id": "some-uuid",
    "name": "Netflix",
    "slug": "netflix",
    "logo_url": "...",
    "category": "streaming"
  },
  "company_id": "some-uuid",
  "company_data": {               // ← Check if this exists
    "id": "some-uuid",
    "name": "Second Watch Films",
    "logo_url": "...",
    "is_verified": true
  },
  "cast_position_type_id": "some-uuid",
  "cast_position_type": {         // ← Check if this exists (for cast postings)
    "id": "some-uuid",
    "name": "Lead",
    "slug": "lead"
  },
  "requires_reel": true,
  "requires_headshot": true,
  "requires_self_tape": false,
  "tape_instructions": "Please perform the scene...",
  "tape_format_preferences": "1080p MP4"
}
```

**Key Questions:**
- Does the response include the `network` object (not just `network_id`)?
- Does the response include the `company_data` object (not just `company_id`)?
- Does the response include the `cast_position_type` object (not just `cast_position_type_id`)?
- Are the cast requirement fields present in the response?

#### 3. Form Field Values

The test will capture what's actually displayed in the form:

```json
{
  "position": "Select...",        // ← Should show position name
  "network": "Select...",          // ← Should show network name
  "company": "Select...",          // ← Should show company name
  "requires_reel": false,          // ← Should match API data
  "requires_headshot": false,      // ← Should match API data
  "requires_self_tape": false,     // ← Should match API data
  "tape_instructions": "",         // ← Should match API data
  "tape_format_preferences": ""    // ← Should match API data
}
```

**Key Questions:**
- Are the dropdowns showing "Select..." or the actual values?
- Do the toggle states match the API data?
- Do the text fields match the API data?

#### 4. Screenshots

Check `tests/screenshots/collab-edit-form.png` to see the actual form state.

## Expected Root Causes

Based on the code analysis, the likely issues are:

### 1. API Response Missing Related Objects

**Problem:** The backend endpoint `/api/v1/community/collabs/by-project/{projectId}` might not be including the related objects (`network`, `company_data`, `cast_position_type`).

**Solution:** Check the backend code to ensure these relationships are being joined/included in the query.

**Code Location:** Backend API endpoint for getting project collabs

### 2. SearchableCombobox Not Using initialSelectedItem

**Problem:** The `SearchableCombobox` component might not be properly using the `initialSelectedItem` prop on mount.

**Solution:** The component already has logic for this (lines 95-99 in SearchableCombobox.tsx), but it might need adjustment.

**Code Location:** `/home/estro/second-watch-network/frontend/src/components/shared/SearchableCombobox.tsx`

### 3. Timing Issue with Async Data

**Problem:** The `editCollab` data might be set before the component mounts, or the `initialSelectedItem` useMemo might not be recomputing.

**Solution:** Check dependency arrays in useMemo hooks and ensure proper effect ordering.

**Code Location:** `/home/estro/second-watch-network/frontend/src/components/community/CollabForm.tsx` (lines 162-256)

## Next Steps After Running the Test

1. **Review all captured data** in the console output
2. **Compare API response to expected format**
3. **Check if initialSelectedItem is computed correctly**
4. **Verify SearchableCombobox receives the data**
5. **Fix the root cause** (likely backend API response format)

## Manual Testing Alternative

If you prefer to test manually:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter for "CollabForm" or "SearchableCombobox"
4. Navigate to a project's Casting & Crew tab
5. Click Edit on a collab posting
6. Review the console logs
7. Check Network tab for the API response

## Contact

If you need help interpreting the results, share:
- Console logs with [CollabForm] and [SearchableCombobox]
- API response JSON
- Screenshot of the form
