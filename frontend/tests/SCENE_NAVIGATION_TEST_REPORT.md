# Scene Navigation Test Report - Continuity Tab

**Date:** 2026-01-10
**Component:** ScriptyWorkspace / Continuity Tab
**Feature:** Scene Navigation with scene_mappings

## Test Overview

This report documents testing of the scene navigation feature in the Continuity tab, specifically the implementation that uses `scene_mappings` from continuity exports to navigate to the correct PDF page when a scene is clicked.

## Architecture Analysis

### Components Involved

1. **ContinuityView.tsx** (`/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ContinuityView.tsx`)
   - Wraps ScriptyWorkspace
   - Fetches continuity exports using `useContinuityExports(projectId)`
   - Passes `sceneMappings` and `continuityPdfUrl` to ScriptyWorkspace

2. **ScriptyWorkspace.tsx** (`/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptyWorkspace.tsx`)
   - Receives `sceneMappings?: ContinuityExportSceneMappings` prop (line 73)
   - Receives `continuityPdfUrl?: string` prop (line 72)
   - Scene click handler (lines 493-507):
     ```typescript
     onClick={() => {
       setSelectedSceneId(scene.id);
       // Use scene mappings from continuity export if available
       if (sceneMappings?.scenes) {
         const mapping = sceneMappings.scenes.find(m => m.scene_id === scene.id);
         if (mapping) {
           setCurrentPage(mapping.page_number);
           return;
         }
       }
       // Fallback to scene's page_start
       if (scene.page_start) {
         setCurrentPage(scene.page_start);
       }
     }}
     ```

3. **useContinuityExports.ts** (`/home/estro/second-watch-network/frontend/src/hooks/backlot/useContinuityExports.ts`)
   - Defines `ContinuityExportSceneMappings` interface (lines 22-28):
     ```typescript
     export interface ContinuityExportSceneMappings {
       scenes: ContinuityExportSceneMapping[];
       addendums?: {
         notes?: { page_number: number; title: string };
         highlights?: { page_number: number; title: string };
       };
     }
     ```
   - Defines `ContinuityExportSceneMapping` interface (lines 15-20):
     ```typescript
     export interface ContinuityExportSceneMapping {
       scene_number: string;
       scene_id: string;
       page_number: number;
       bookmark_title: string;
     }
     ```
   - `ContinuityExport` interface includes `scene_mappings?: ContinuityExportSceneMappings` (line 46)

## Expected Behavior

1. **Scene List Display**: Left panel should show a list of scenes (Scene 1, Scene 2, etc.) with details like INT/EXT, location, time of day
2. **Scene Selection**: Clicking a scene should:
   - Highlight the scene with accent-yellow styling
   - Navigate to the corresponding PDF page
3. **Scene Mappings Priority**: Navigation should use:
   - Primary: `scene_mappings.scenes[].page_number` from continuity export
   - Fallback: `scene.page_start` from scene data
4. **Export Version Selection**: ContinuityView should display a version selector dropdown allowing users to switch between different continuity exports
5. **Network Requests**: When a continuity export is selected, the API response should include `scene_mappings` field

## Test Implementation

Created comprehensive Playwright test suite in `/home/estro/second-watch-network/frontend/tests/e2e/continuity-scene-navigation.spec.ts` with the following test cases:

1. ✅ **should display scenes in the left panel** - Verifies scenes list is visible and populated
2. ✅ **should navigate to PDF page when clicking a scene** - Tests basic scene click functionality
3. ✅ **should check for scene_mappings in continuity export API** - Monitors network requests for scene_mappings data
4. ✅ **should verify scene click updates page number** - Tests navigation between multiple scenes
5. ✅ **should check for console errors related to scene mappings** - Captures any JavaScript errors
6. ✅ **should display scene details (INT/EXT, location)** - Verifies scene metadata display
7. ✅ **should maintain scene selection visual state** - Tests active scene highlighting

## Test Results

### Automated Test Run
- **Status**: All tests skipped due to authentication requirement
- **Issue**: Tests require login credentials to access Backlot projects
- **Console Errors**: 0 errors detected during navigation attempts
- **Network Requests**: 0 export-related requests (not authenticated)

### Code Analysis Findings

✅ **PASS**: Scene mappings are properly typed and integrated
- `ContinuityExportSceneMappings` interface is well-defined
- Props are correctly passed from ContinuityView to ScriptyWorkspace
- Scene click handler properly checks for scene_mappings before fallback

✅ **PASS**: Scene navigation logic is correctly implemented
- Lines 496-501 in ScriptyWorkspace.tsx show proper scene_mappings lookup
- Fallback to `scene.page_start` is in place (lines 504-506)
- Scene selection state is maintained (`setSelectedSceneId`)

✅ **PASS**: API integration looks correct
- `useContinuityExports` hook fetches from `/api/v1/backlot/projects/{projectId}/continuity/exports`
- Response type includes `scene_mappings` field
- Export selection updates the `selectedExport` which is passed to ScriptyWorkspace

⚠️ **POTENTIAL ISSUE**: Visual feedback for scene selection
- Scene items have `data-testid` for testing (line 492)
- Selected scene gets accent-yellow styling (line 511)
- **To verify**: Does the styling actually apply when scene_mappings updates the page?

⚠️ **POTENTIAL ISSUE**: Race conditions
- Scene click sets both `selectedSceneId` and `currentPage`
- **To verify**: Is there any asynchronous PDF loading that could cause issues?

## Manual Testing Checklist

Since automated tests require authentication, here's a manual testing checklist:

### Prerequisites
- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:8080
- [ ] Valid test credentials
- [ ] Project with scenes and continuity PDF exports

### Test Steps

1. **Navigate to Continuity Tab**
   - [ ] Go to http://localhost:8080
   - [ ] Log in with test credentials
   - [ ] Navigate to Backlot section
   - [ ] Open a project that has scenes with PDFs
   - [ ] Click on the "Continuity" tab

2. **Verify Scene List**
   - [ ] Left panel shows a list of scenes
   - [ ] Scene numbers are displayed (1, 2, 3, etc.)
   - [ ] Scene details show INT/EXT, location, time of day
   - [ ] Scenes are in correct order

3. **Test Scene Navigation**
   - [ ] Click on Scene 1
   - [ ] Verify PDF viewer navigates to the correct page
   - [ ] Verify scene is highlighted with accent-yellow styling
   - [ ] Click on Scene 2
   - [ ] Verify PDF page changes
   - [ ] Click on Scene 3
   - [ ] Verify PDF page changes

4. **Check Export Version Selection**
   - [ ] Version selector dropdown is visible in toolbar
   - [ ] Dropdown shows available continuity exports
   - [ ] Current version is marked with star icon
   - [ ] Selecting different version loads different PDF
   - [ ] Scene navigation still works after switching versions

5. **Browser Console Inspection**
   - [ ] Open browser DevTools (F12)
   - [ ] Go to Console tab
   - [ ] Click on various scenes
   - [ ] Check for any errors related to:
     - "scene_mappings"
     - "undefined"
     - "page_number"
     - "Cannot read property"

6. **Network Tab Inspection**
   - [ ] Open browser DevTools (F12)
   - [ ] Go to Network tab
   - [ ] Filter for "continuity" or "export"
   - [ ] Select a continuity export from dropdown
   - [ ] Check the API response for the export
   - [ ] Verify response includes `scene_mappings` field
   - [ ] Verify `scene_mappings.scenes` array has entries
   - [ ] Verify each entry has: `scene_id`, `page_number`, `scene_number`, `bookmark_title`

## Example Expected API Response

```json
{
  "id": "export-uuid-123",
  "project_id": "project-uuid-456",
  "file_url": "https://...",
  "file_name": "continuity_export.pdf",
  "version_number": 1,
  "is_current": true,
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
    ],
    "addendums": {
      "notes": { "page_number": 45, "title": "Continuity Notes" },
      "highlights": { "page_number": 50, "title": "Important Highlights" }
    }
  }
}
```

## Common Issues to Watch For

1. **Scene IDs Don't Match**
   - Scene mappings use `scene_id` to match scenes
   - If scene IDs in the export don't match current scene IDs, navigation won't work
   - **Symptom**: Clicking scenes always falls back to `page_start`

2. **Missing scene_mappings Field**
   - If backend doesn't return `scene_mappings` in the API response
   - **Symptom**: Always uses fallback `page_start` navigation

3. **Incorrect Page Numbers**
   - Page numbers in scene_mappings might be 0-indexed vs 1-indexed
   - **Symptom**: Navigation is off by one page

4. **Stale Export Data**
   - Scene mappings from old export might not match current scene list
   - **Symptom**: Some scenes navigate correctly, others don't

5. **No Continuity Exports**
   - Project has scenes but no continuity PDF exports yet
   - **Symptom**: No version selector, no PDF viewer

## Recommendations

1. **Add Logging**: Add console.log statements in ScriptyWorkspace scene click handler to debug:
   ```typescript
   console.log('Scene clicked:', scene.id, scene.scene_number);
   console.log('Scene mappings available:', !!sceneMappings?.scenes);
   console.log('Found mapping:', mapping);
   console.log('Navigating to page:', mapping?.page_number || scene.page_start);
   ```

2. **Add Error Boundary**: Wrap scene navigation in try-catch to handle errors gracefully

3. **Add Loading State**: Show loading indicator while PDF is navigating to new page

4. **Add Toast Notifications**: When navigation fails or falls back to page_start, notify user

5. **Add Test Data Fixtures**: Create test fixtures with known scene mappings for automated testing

6. **Add E2E Authentication**: Set up Playwright with authentication flow for automated testing

## Conclusion

The scene navigation feature appears to be **correctly implemented** from a code analysis perspective. The architecture properly:
- Fetches continuity exports with scene_mappings
- Passes mappings to ScriptyWorkspace
- Uses mappings for navigation with fallback
- Maintains selection state

**Next Steps:**
1. Run manual tests with valid credentials to verify actual behavior
2. Check browser console and network tab for any issues
3. Verify API backend returns scene_mappings correctly
4. Test with multiple continuity export versions
5. Capture screenshots of any issues found

## Files Reviewed

- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptyWorkspace.tsx`
- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ContinuityView.tsx`
- `/home/estro/second-watch-network/frontend/src/hooks/backlot/useContinuityExports.ts`
- `/home/estro/second-watch-network/frontend/tests/e2e/continuity-tab.spec.ts`
- `/home/estro/second-watch-network/frontend/tests/e2e/continuity-scene-navigation.spec.ts` (created)
