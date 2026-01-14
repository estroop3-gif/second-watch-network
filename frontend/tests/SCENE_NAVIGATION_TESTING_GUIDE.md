# Scene Navigation Testing Guide

## Overview

This guide provides instructions for testing the scene navigation feature in the Continuity tab of a Backlot project. The scene navigation was recently updated to use `scene_mappings` from continuity exports.

## Quick Start

### Automated Testing (Requires Auth)

The automated Playwright tests are available but require authentication:

```bash
# Run all scene navigation tests
npx playwright test tests/e2e/continuity-scene-navigation.spec.ts

# Run with browser visible
npx playwright test tests/e2e/continuity-scene-navigation.spec.ts --headed

# Run specific test
npx playwright test tests/e2e/continuity-scene-navigation.spec.ts -g "should display scenes"
```

**Note:** Tests will skip if authentication is not configured. See "Setup Authentication" section below.

### Manual Testing (Recommended)

1. **Start the application:**
   ```bash
   # Terminal 1 - Backend
   cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. **Navigate to Continuity tab:**
   - Go to http://localhost:8080
   - Log in with test credentials
   - Navigate to Backlot → Select a project → Script tab → Continuity tab

3. **Use the debug console script:**
   - Open browser DevTools (F12)
   - Copy contents of `/home/estro/second-watch-network/frontend/tests/scene-navigation-debug.js`
   - Paste into Console and press Enter
   - Run: `sceneDebug.runFullDiagnostic()`

## What to Test

### 1. Scene List Display
- [ ] Scenes are displayed in the left panel
- [ ] Scene numbers are visible (1, 2, 3, etc.)
- [ ] Scene details show INT/EXT, location, time of day
- [ ] Scenes are in the correct order

### 2. Scene Navigation
- [ ] Clicking a scene highlights it with yellow accent color
- [ ] Clicking a scene navigates PDF to the correct page
- [ ] Page number indicator updates
- [ ] Multiple scene clicks work correctly
- [ ] Page changes are visible in the PDF viewer

### 3. Scene Mappings from Exports
- [ ] Version selector is visible (if exports exist)
- [ ] Version selector shows available continuity exports
- [ ] Current export is marked with a star
- [ ] Scene navigation works with selected export
- [ ] Switching exports updates scene navigation

### 4. Console and Network
- [ ] No JavaScript errors in console related to scene_mappings
- [ ] API requests to `/continuity/exports` include scene_mappings
- [ ] scene_mappings has correct structure (see below)

## Expected scene_mappings Structure

When you inspect the Network tab for a continuity export API response, it should include:

```json
{
  "id": "export-uuid",
  "project_id": "project-uuid",
  "scene_mappings": {
    "scenes": [
      {
        "scene_id": "scene-uuid-1",
        "scene_number": "1",
        "page_number": 5,
        "bookmark_title": "Scene 1 - INT. LIVING ROOM - DAY"
      },
      {
        "scene_id": "scene-uuid-2",
        "scene_number": "2",
        "page_number": 8,
        "bookmark_title": "Scene 2 - EXT. STREET - DAY"
      }
    ]
  }
}
```

## Using the Debug Console Script

The debug script provides several helpful functions:

### Quick Diagnostic
```javascript
sceneDebug.runFullDiagnostic()
```
Runs a complete diagnostic and prints:
- Whether ScriptyWorkspace is loaded
- List of all scenes
- Current page number
- Scene mappings status
- Version selector status

### Test Scene Navigation
```javascript
// Test clicking the first scene (index 0)
sceneDebug.testSceneClick(0)

// Test clicking the second scene (index 1)
sceneDebug.testSceneClick(1)

// Test clicking multiple scenes automatically
sceneDebug.testMultipleScenes()
```

### Inspect Scene Mappings
```javascript
sceneDebug.checkSceneMappings()
```
Attempts to access the React component props to see if scene_mappings are provided.

### List All Scenes
```javascript
sceneDebug.listScenes()
```
Lists all scenes in the left panel with their content and selection state.

### Check Version Selector
```javascript
sceneDebug.checkVersionSelector()
```
Checks if the version selector is present and lists available versions.

## Common Issues and Solutions

### Issue: No scenes displayed
**Symptoms:**
- Left panel is empty or shows "No scenes"

**Possible Causes:**
1. Project has no script imported
2. Script has no scene breakdowns
3. API request failed

**Debug:**
- Check Network tab for `/scenes` API request
- Verify script is selected in dropdown
- Check browser console for errors

### Issue: Clicking scenes doesn't change page
**Symptoms:**
- Page number doesn't update when clicking scenes
- PDF doesn't navigate

**Possible Causes:**
1. scene_mappings is missing from export
2. scene_id mismatch between mapping and scenes
3. PDF is not loaded

**Debug:**
- Run `sceneDebug.checkSceneMappings()`
- Check Network tab for export API response
- Verify scene_mappings structure
- Check if `sceneMappings` prop is passed to ScriptyWorkspace

### Issue: Page navigation is off by one
**Symptoms:**
- Clicking Scene 1 goes to page 2
- Page numbers are consistently off

**Possible Causes:**
1. Page numbers are 0-indexed in scene_mappings
2. PDF viewer uses different page indexing

**Debug:**
- Check scene_mappings.scenes[0].page_number value
- Compare with actual PDF page
- Check ScriptyWorkspace handlePageChange function

### Issue: No version selector visible
**Symptoms:**
- Cannot select different continuity exports
- No version dropdown in toolbar

**Possible Causes:**
1. No continuity exports exist for this project
2. Not using ContinuityView wrapper
3. API request failed

**Debug:**
- Check Network tab for `/continuity/exports` request
- Run `sceneDebug.checkVersionSelector()`
- Verify you're on the Continuity tab (not Script tab)

### Issue: scene_mappings not in API response
**Symptoms:**
- Network tab shows export without scene_mappings field
- Scene navigation falls back to page_start

**Possible Causes:**
1. Backend doesn't include scene_mappings in response
2. Export was created before scene_mappings feature
3. Database doesn't have scene_mappings stored

**Debug:**
- Check backend API endpoint: `/api/v1/backlot/projects/{project_id}/continuity/exports`
- Verify database column exists
- Re-export the PDF to generate new scene_mappings

## Files Involved

### Frontend Components
- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ContinuityView.tsx`
  - Wrapper that provides version selection
  - Fetches continuity exports
  - Passes scene_mappings to ScriptyWorkspace

- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptyWorkspace.tsx`
  - Main continuity workspace component
  - Handles scene click navigation (lines 493-507)
  - Uses scene_mappings or falls back to page_start

### Frontend Hooks
- `/home/estro/second-watch-network/frontend/src/hooks/backlot/useContinuityExports.ts`
  - Defines ContinuityExportSceneMappings type
  - Provides hooks for fetching/managing exports

### Test Files
- `/home/estro/second-watch-network/frontend/tests/e2e/continuity-scene-navigation.spec.ts`
  - Automated Playwright tests
  - 7 test cases covering all aspects

- `/home/estro/second-watch-network/frontend/tests/scene-navigation-debug.js`
  - Browser console debug script
  - Interactive testing functions

- `/home/estro/second-watch-network/frontend/tests/SCENE_NAVIGATION_TEST_REPORT.md`
  - Detailed test report
  - Architecture analysis
  - Manual testing checklist

## Network Tab Inspection

### What to Look For

1. **Continuity Exports Request**
   - URL: `GET /api/v1/backlot/projects/{project_id}/continuity/exports`
   - Status: 200 OK
   - Response: Array of continuity exports

2. **Single Export Request** (when selecting a version)
   - URL: `GET /api/v1/backlot/projects/{project_id}/continuity/exports/{export_id}`
   - Status: 200 OK
   - Response: Single export object with scene_mappings

3. **Key Fields to Check**
   - `scene_mappings` (object)
   - `scene_mappings.scenes` (array)
   - Each scene has: `scene_id`, `scene_number`, `page_number`, `bookmark_title`

### Using Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "XHR" or "Fetch"
4. Search for "continuity" or "export"
5. Click on a request
6. Go to "Response" tab
7. Look for scene_mappings in JSON

## Setup Authentication (For Automated Tests)

To enable automated Playwright tests, you need to configure authentication:

### Option 1: Use Existing Session
```typescript
// In tests/e2e/continuity-scene-navigation.spec.ts
test.beforeEach(async ({ page }) => {
  // Load saved auth state
  await page.context().addCookies([
    // Add your session cookies here
  ]);
});
```

### Option 2: Login Flow
```typescript
// Add to navigateToContinuityTab function
if (!isLoggedIn) {
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}
```

### Option 3: API Token
```typescript
// Set authorization header
await page.setExtraHTTPHeaders({
  'Authorization': 'Bearer YOUR_TOKEN_HERE'
});
```

## Report Issues

When reporting issues, please include:

1. **Steps to reproduce**
2. **Expected behavior vs actual behavior**
3. **Browser console errors** (if any)
4. **Network tab screenshot** showing API responses
5. **Scene mappings data** from API response
6. **Output from** `sceneDebug.runFullDiagnostic()`

## Summary of Implementation

The scene navigation feature works as follows:

1. **ContinuityView** fetches continuity exports using `useContinuityExports(projectId)`
2. User selects an export from the version dropdown
3. Selected export includes `scene_mappings` with scene-to-page mappings
4. **ContinuityView** passes `sceneMappings` and `continuityPdfUrl` to **ScriptyWorkspace**
5. When user clicks a scene in the left panel:
   - ScriptyWorkspace checks if `sceneMappings.scenes` exists
   - Finds mapping by `scene_id`
   - Navigates to `mapping.page_number`
   - Falls back to `scene.page_start` if no mapping found
6. PDF viewer updates to show the correct page
7. Scene is highlighted with accent-yellow styling

## Next Steps

1. ✅ Run the debug script to verify scene navigation is working
2. ✅ Check Network tab to confirm scene_mappings are in API responses
3. ✅ Test clicking multiple scenes to verify page changes
4. ✅ Check for console errors during navigation
5. ✅ Test with different continuity export versions
6. ✅ Report any issues with detailed information

## Additional Resources

- **Playwright Documentation:** https://playwright.dev
- **React Testing Best Practices:** https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- **Frontend Architecture:** See `/home/estro/second-watch-network/frontend/CLAUDE.md`
- **Project Overview:** See `/home/estro/second-watch-network/CLAUDE.md`
