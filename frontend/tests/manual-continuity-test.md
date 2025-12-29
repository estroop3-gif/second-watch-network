# Manual Test Plan: Continuity Tab (ScriptyWorkspace)

## Test Environment
- **Application URL**: http://localhost:8080
- **Browser**: Chrome/Chromium (headless Playwright browser requires system dependencies)
- **Date**: 2025-12-28

## Navigation Path
1. Navigate to http://localhost:8080
2. Log in if required
3. Click on "Backlot" link/button
4. Select a project from the Backlot home page
5. In the project workspace, click "Script" in the sidebar
6. Click on the "Continuity" tab

---

## Test Cases

### 1. ScriptyWorkspace Layout & Controls

#### Test 1.1: Three-Panel Layout
- **Expected**: Three distinct regions visible:
  - Left: Scenes list panel
  - Center: Script viewer with PDF
  - Right: Tabs panel (Takes, Notes, Photos)
- **Steps**:
  1. Navigate to Continuity tab
  2. Verify left panel shows "Scenes" header
  3. Verify center panel shows PDF viewer or script content
  4. Verify right panel shows three tab buttons: Takes, Notes, Photos
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 1.2: Script Selector Dropdown
- **Expected**: Dropdown/select element for choosing script version
- **Steps**:
  1. Look for script selector (should show current script name)
  2. Click to open dropdown
  3. Verify script options are displayed
  4. Select a different script (if available)
  5. Verify page updates with selected script
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 1.3: Production Day Selector
- **Expected**: Dropdown/select element for choosing production day
- **Steps**:
  1. Look for "Day" or production day selector
  2. Click to open dropdown
  3. Verify day options are displayed (e.g., "Day 1", "Day 2")
  4. Select a different day
  5. Verify takes/notes update for selected day
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 1.4: Rolling Button Toggle
- **Expected**: Button toggles between "Rolling" and "Stop" states
- **Steps**:
  1. Locate "Rolling" button (should have Play icon)
  2. Click to start rolling
  3. Verify button changes to "Stop" with different styling (red, pulsing)
  4. Verify toast notification appears
  5. Click "Stop"
  6. Verify button returns to "Rolling" state
  7. Verify toast notification appears
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 1.5: Export Dropdown
- **Expected**: Dropdown menu with 5 export options
- **Steps**:
  1. Click Export button (download icon)
  2. Verify dropdown menu appears
  3. Verify options are present:
     - Takes (CSV)
     - Takes (JSON)
     - Notes (CSV)
     - Notes (JSON)
     - Daily Report (JSON)
  4. Click outside to close menu
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 1.6: Fullscreen Toggle
- **Expected**: Button toggles fullscreen mode for workspace
- **Steps**:
  1. Locate Fullscreen button (maximize/fullscreen icon)
  2. Click to enter fullscreen
  3. Verify workspace expands to full browser window
  4. Verify "Fullscreen" badge appears
  5. Click exit fullscreen button (X or minimize icon)
  6. Verify workspace returns to normal layout
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 2. Left Panel - Scenes List

#### Test 2.1: Scenes Display
- **Expected**: List of scenes from imported script
- **Steps**:
  1. View left panel
  2. Verify "Scenes" header is visible
  3. Verify scene items are displayed OR "No scenes" message
  4. If scenes exist, verify they have scene numbers
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 2.2: Scene Numbers
- **Expected**: Scene numbers displayed correctly (e.g., "1", "2A", "10")
- **Steps**:
  1. Look at scene list items
  2. Verify each has a bold scene number
  3. Verify scene numbers follow screenplay conventions
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 2.3: Scene Selection
- **Expected**: Clicking scene updates center and right panels
- **Steps**:
  1. Note current scene (if any is selected)
  2. Click on a different scene
  3. Verify scene is highlighted/selected (yellow accent)
  4. Verify center panel updates to show scene's page
  5. Verify right panel shows takes/notes for that scene
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 2.4: Scene Details
- **Expected**: Scene cards show INT/EXT, location, time of day
- **Steps**:
  1. Look at scene list items
  2. Verify each shows:
     - INT/EXT indicator
     - Set/location name
     - Time of day (if available)
  3. Check for coverage status icon (checkmark for shot scenes)
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 3. Center Panel - Script Viewer with Lined Script

#### Test 3.1: PDF Viewer or Placeholder
- **Expected**: PDF viewer loads or "No PDF Available" message shown
- **Steps**:
  1. Look at center panel
  2. Verify PDF pages render OR placeholder message displays
  3. If PDF is present, verify it's readable
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 3.2: Page Navigation Controls
- **Expected**: Previous/Next buttons and page selector
- **Steps**:
  1. Locate page navigation bar (top of center panel)
  2. Verify Previous button (left chevron)
  3. Verify Next button (right chevron)
  4. Verify page number selector/dropdown
  5. Verify "Page X of Y" text
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 3.3: Page Number Display
- **Expected**: Current page and total page count shown
- **Steps**:
  1. Look at page navigation
  2. Verify format like "Page 1 of 120"
  3. Verify page selector shows current page
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 3.4: Next Page Navigation
- **Expected**: Clicking Next advances to next page
- **Steps**:
  1. Note current page number
  2. Click Next button
  3. Verify page number increments
  4. Verify PDF content updates
  5. Verify Previous button is enabled
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 3.5: Script Viewer Fullscreen
- **Expected**: Maximize button expands script viewer
- **Steps**:
  1. Locate maximize button (in center panel header)
  2. Click to expand script viewer
  3. Verify left and right panels are hidden
  4. Verify script takes full width
  5. Click minimize to restore layout
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 4. Right Panel - Takes Tab

#### Test 4.1: Takes Tab Selection
- **Expected**: Tab is selectable and shows active state
- **Steps**:
  1. Click "Takes" tab
  2. Verify tab shows active/selected styling
  3. Verify aria-selected="true" attribute
  4. Verify takes content panel is displayed
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.2: New Take Button (Scene Selected)
- **Expected**: Button appears when scene is selected
- **Steps**:
  1. Select a scene from left panel
  2. Click Takes tab
  3. Verify "New Take" button is visible
  4. Verify button styling (yellow accent)
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.3: New Take Form Display
- **Expected**: Form shows all required fields
- **Steps**:
  1. Select a scene
  2. Click "New Take" button
  3. Verify form displays with:
     - Take number input (auto-incremented)
     - Camera label input
     - Setup label input
     - Status buttons (OK, Print, Circled, Hold, NG, Wild, MOS)
     - Notes textarea
     - "Log Take" submit button
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.4: Take Number Auto-Increment
- **Expected**: Take number automatically set to next available
- **Steps**:
  1. Open New Take form
  2. Verify take number is pre-filled (e.g., "1" if no takes exist)
  3. If takes exist, verify number is max take + 1
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.5: Take Status Buttons
- **Expected**: All status buttons visible and functional
- **Steps**:
  1. Open New Take form
  2. Verify status buttons:
     - OK (gray)
     - Print (green)
     - Circled (yellow)
     - Hold (blue)
     - NG (red)
     - Wild (purple)
     - MOS (orange)
  3. Click each button
  4. Verify selected state changes
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.6: Create Take
- **Expected**: Take is logged and appears in list
- **Steps**:
  1. Open New Take form
  2. Set camera label (e.g., "A")
  3. Set setup label (e.g., "1")
  4. Select status (e.g., "Print")
  5. Enter notes (e.g., "Good take, actor nailed the line")
  6. Click "Log Take"
  7. Verify success toast appears
  8. Verify take appears in takes list
  9. Verify form closes
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.7: No Scene Selected Message
- **Expected**: Message shown when no scene selected
- **Steps**:
  1. Deselect all scenes (if possible) or start fresh
  2. Click Takes tab
  3. Verify "Select a scene to log takes" message
  4. Verify camera icon is displayed
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.8: Existing Takes Display
- **Expected**: Takes show status, camera, notes, timestamp
- **Steps**:
  1. If takes exist for selected scene, verify each shows:
     - Take number (e.g., "Take 1")
     - Status badge with color coding
     - Camera label badge
     - Notes text
     - Timecode
     - Quick status update buttons
     - Delete button
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.9: Quick Status Update
- **Expected**: Status can be changed via quick buttons
- **Steps**:
  1. Find an existing take
  2. Click a status button (e.g., change from OK to Print)
  3. Verify status badge updates
  4. Verify toast notification appears
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 4.10: Delete Take
- **Expected**: Take can be deleted with confirmation
- **Steps**:
  1. Find an existing take
  2. Click delete button (trash icon)
  3. Verify confirmation dialog appears
  4. Click "OK" to confirm
  5. Verify take is removed from list
  6. Verify toast notification appears
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 5. Right Panel - Notes Tab

#### Test 5.1: Notes Tab Selection
- **Expected**: Tab is selectable and shows active state
- **Steps**:
  1. Click "Notes" tab
  2. Verify tab shows active/selected styling
  3. Verify notes content panel is displayed
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.2: Category Filter Dropdown
- **Expected**: Dropdown filters notes by category
- **Steps**:
  1. Click Notes tab
  2. Locate category filter dropdown (header)
  3. Click to open
  4. Verify options: All Notes, General, Blocking, Props, Wardrobe, etc.
  5. Select a category
  6. Verify notes list filters
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.3: Add Button
- **Expected**: Button appears when scene is selected
- **Steps**:
  1. Select a scene
  2. Click Notes tab
  3. Verify "Add" button is visible
  4. Verify button styling (yellow accent)
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.4: Add Note Form
- **Expected**: Form displays with all fields
- **Steps**:
  1. Click "Add" button
  2. Verify form displays with:
     - Category selector dropdown
     - Content textarea
     - Critical checkbox
     - "Add Note" submit button
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.5: Note Categories
- **Expected**: All categories available in selector
- **Steps**:
  1. Open Add Note form
  2. Click category selector
  3. Verify categories:
     - General
     - Blocking
     - Props
     - Wardrobe
     - Hair/Makeup
     - Eyelines
     - Dialogue
     - Timing
     - Set Dressing
     - Sound
     - Other
  4. Each should have appropriate icon
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.6: Critical Flag
- **Expected**: Checkbox marks note as critical
- **Steps**:
  1. Open Add Note form
  2. Verify "Critical" checkbox with warning icon
  3. Check the checkbox
  4. Verify checked state
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.7: Create Note
- **Expected**: Note is created and appears in list
- **Steps**:
  1. Open Add Note form
  2. Select category (e.g., "Wardrobe")
  3. Enter content (e.g., "Actor should be wearing blue jacket")
  4. Check "Critical" if needed
  5. Click "Add Note"
  6. Verify success toast
  7. Verify note appears in list with category badge
  8. Verify form closes
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.8: Edit Note
- **Expected**: Existing note can be edited
- **Steps**:
  1. Find an existing note
  2. Click edit button (pencil icon)
  3. Verify note switches to edit mode
  4. Change category, content, or critical flag
  5. Click "Save"
  6. Verify changes are saved
  7. Verify toast notification
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.9: Delete Note
- **Expected**: Note can be deleted with confirmation
- **Steps**:
  1. Find an existing note
  2. Click delete button (trash icon)
  3. Verify confirmation dialog
  4. Confirm deletion
  5. Verify note is removed
  6. Verify toast notification
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 5.10: Critical Note Display
- **Expected**: Critical notes show warning indicator
- **Steps**:
  1. Create a note with Critical flag checked
  2. Verify note shows:
     - Red border
     - Warning triangle icon
     - "Critical" indicator
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 6. Right Panel - Photos Tab

#### Test 6.1: Photos Tab Selection
- **Expected**: Tab is selectable and shows active state
- **Steps**:
  1. Click "Photos" tab
  2. Verify tab shows active/selected styling
  3. Verify photos content panel is displayed
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.2: Category Filter
- **Expected**: Dropdown filters photos by category
- **Steps**:
  1. Click Photos tab
  2. Locate category filter dropdown
  3. Click to open
  4. Verify options: All Photos, General, Wardrobe, Props, Hair, Makeup, etc.
  5. Select a category
  6. Verify photo grid filters
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.3: Compare Mode Button
- **Expected**: Button toggles compare mode
- **Steps**:
  1. Click "Compare" button
  2. Verify button shows active state
  3. Verify instructions appear
  4. Click button again to deactivate
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.4: Search Input
- **Expected**: Search filters photos by filename/description
- **Steps**:
  1. Locate search input
  2. Verify placeholder text ("Search photos...")
  3. Enter search term
  4. Verify photo grid filters to matching photos
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.5: Drag-and-Drop Upload Area
- **Expected**: Upload area accepts photo files
- **Steps**:
  1. Select a scene
  2. Verify upload area is visible
  3. Verify text: "Drop photos or click to upload"
  4. Verify dashed border styling
  5. (Manual) Try dragging a photo file
  6. Verify upload initiates
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.6: Upload Category Selector
- **Expected**: Selector sets category for uploaded photos
- **Steps**:
  1. Locate "Upload as:" label and selector
  2. Click selector
  3. Verify category options (General, Wardrobe, Props, etc.)
  4. Select a category
  5. Verify selection persists
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.7: Photo Grid Display
- **Expected**: Photos displayed in 2-column grid
- **Steps**:
  1. If photos exist, verify:
     - 2-column grid layout
     - Square aspect ratio
     - Category badge on hover
     - Favorite star icon (if favorited)
     - Action buttons on hover (favorite, delete)
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.8: Photo Click to View
- **Expected**: Clicking photo opens detail modal
- **Steps**:
  1. Click on a photo
  2. Verify modal/dialog opens
  3. Verify full-size photo is displayed
  4. Verify category badge
  5. Verify favorite badge (if applicable)
  6. Verify description (if available)
  7. Verify upload timestamp
  8. Close modal
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.9: Favorite Toggle
- **Expected**: Star icon toggles favorite status
- **Steps**:
  1. Hover over a photo
  2. Click favorite/star icon
  3. Verify icon changes to filled star
  4. Verify photo updates
  5. Click again to unfavorite
  6. Verify icon returns to outline
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.10: Delete Photo
- **Expected**: Photo can be deleted with confirmation
- **Steps**:
  1. Hover over a photo
  2. Click delete button (trash icon)
  3. Verify confirmation dialog
  4. Confirm deletion
  5. Verify photo is removed from grid
  6. Verify toast notification
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.11: Compare Mode - Select Photos
- **Expected**: Can select 2 photos for comparison
- **Steps**:
  1. Enable Compare mode
  2. Click first photo
  3. Verify photo is selected (yellow border)
  4. Click second photo
  5. Verify photo is selected
  6. Verify "View Comparison" button appears
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.12: Compare Mode - View Comparison
- **Expected**: Side-by-side comparison modal displays
- **Steps**:
  1. Select 2 photos in Compare mode
  2. Click "View Comparison" button
  3. Verify modal opens with:
     - Both photos side-by-side
     - Category badges
     - Favorite indicators
     - Filenames
     - Upload dates
  4. Verify "Select Different Photos" button
  5. Verify "Done" button
  6. Close comparison
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 6.13: Empty State
- **Expected**: Message shown when no photos exist
- **Steps**:
  1. Select a scene with no photos
  2. Verify "No photos yet" message
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 7. Export Functionality

#### Test 7.1: Open Export Menu
- **Expected**: Dropdown menu opens with options
- **Steps**:
  1. Click Export button (download icon)
  2. Verify dropdown menu appears
  3. Verify menu stays open until dismissed
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.2: Takes CSV Export
- **Expected**: Exports takes to CSV file
- **Steps**:
  1. Open Export menu
  2. Click "Takes (CSV)"
  3. Verify file download initiates
  4. Verify filename format: `takes_YYYY-MM-DD.csv`
  5. Verify toast notification appears
  6. Open file and verify CSV format
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.3: Takes JSON Export
- **Expected**: Exports takes to JSON file
- **Steps**:
  1. Open Export menu
  2. Click "Takes (JSON)"
  3. Verify file download initiates
  4. Verify filename format: `takes_YYYY-MM-DD.json`
  5. Verify toast notification
  6. Open file and verify JSON structure
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.4: Notes CSV Export
- **Expected**: Exports notes to CSV file
- **Steps**:
  1. Open Export menu
  2. Click "Notes (CSV)"
  3. Verify file download initiates
  4. Verify filename format: `continuity_notes_YYYY-MM-DD.csv`
  5. Verify toast notification
  6. Open file and verify CSV format
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.5: Notes JSON Export
- **Expected**: Exports notes to JSON file
- **Steps**:
  1. Open Export menu
  2. Click "Notes (JSON)"
  3. Verify file download initiates
  4. Verify filename format: `continuity_notes_YYYY-MM-DD.json`
  5. Verify toast notification
  6. Open file and verify JSON structure
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.6: Daily Report Export
- **Expected**: Exports comprehensive daily report
- **Steps**:
  1. Select a production day
  2. Open Export menu
  3. Click "Daily Report (JSON)"
  4. Verify file download initiates
  5. Verify filename format: `daily_report_day_N_YYYY-MM-DD.json`
  6. Verify toast notification
  7. Open file and verify:
     - Production day info
     - All takes for the day
     - All notes
     - Scene coverage status
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.7: Export Without Day Selected
- **Expected**: Warning shown for Daily Report
- **Steps**:
  1. Deselect production day (if possible)
  2. Open Export menu
  3. Click "Daily Report (JSON)"
  4. Verify error toast: "Please select a production day"
  5. Verify no file downloads
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 7.8: Export Menu Dismiss
- **Expected**: Menu closes when clicking outside
- **Steps**:
  1. Open Export menu
  2. Click outside menu area
  3. Verify menu closes
  4. Click Export button again
  5. Click menu item
  6. Verify menu closes after selection
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 8. Error Handling & Edge Cases

#### Test 8.1: No Script Available
- **Expected**: Informative message displayed
- **Steps**:
  1. Navigate to Continuity tab in project with no script
  2. Verify message: "No Scripts Available"
  3. Verify instructions: "Import a script to start using..."
  4. Verify icon is displayed
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 8.2: Script Selector Change
- **Expected**: Workspace updates with new script
- **Steps**:
  1. Have multiple scripts in project
  2. Change script via selector
  3. Verify:
     - PDF updates
     - Scenes list updates
     - Page count updates
     - Takes/notes remain filtered by scene
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 8.3: Production Day Change
- **Expected**: Takes filter to selected day
- **Steps**:
  1. Have takes logged on different days
  2. Change production day via selector
  3. Verify takes list updates to show only that day's takes
  4. Verify notes are not affected
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 8.4: Create Take Without Scene
- **Expected**: Error message shown
- **Steps**:
  1. Deselect all scenes
  2. Try to open New Take form
  3. Verify error toast: "Please select a scene"
  4. Verify form doesn't open
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 8.5: Create Note Without Scene
- **Expected**: Error message shown
- **Steps**:
  1. Deselect all scenes
  2. Click Add button in Notes tab
  3. Try to submit empty note
  4. Verify error toast
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 8.6: Network Error Handling
- **Expected**: Graceful error messages
- **Steps**:
  1. Disconnect network (if possible)
  2. Try to create a take
  3. Verify error toast with clear message
  4. Verify data is not corrupted
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

### 9. Accessibility

#### Test 9.1: ARIA Labels
- **Expected**: Interactive elements have proper labels
- **Steps**:
  1. Inspect tabs (role="tab", aria-selected)
  2. Inspect buttons (aria-label or descriptive text)
  3. Inspect form fields (associated labels)
  4. Use screen reader to verify (if available)
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 9.2: Keyboard Navigation
- **Expected**: All interactive elements are keyboard accessible
- **Steps**:
  1. Use Tab key to navigate through interface
  2. Verify focus indicators are visible
  3. Use arrow keys in tab lists
  4. Use Enter/Space to activate buttons
  5. Use Escape to close modals/dropdowns
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 9.3: Button Labels
- **Expected**: Icon-only buttons have titles/aria-labels
- **Steps**:
  1. Hover over icon buttons
  2. Verify tooltips appear
  3. Inspect for title or aria-label attributes
  4. Verify labels are descriptive (e.g., "Export", "Delete", "Edit")
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 9.4: Color Contrast
- **Expected**: Text meets WCAG AA standards
- **Steps**:
  1. Use browser dev tools or contrast checker
  2. Check text on backgrounds:
     - Scene numbers (white on dark)
     - Button text
     - Form labels
     - Badge text
  3. Verify minimum 4.5:1 ratio for normal text
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

#### Test 9.5: Focus Management
- **Expected**: Focus moves logically through interface
- **Steps**:
  1. Open New Take form
  2. Verify focus moves to first input
  3. Tab through form fields
  4. Submit form
  5. Verify focus returns to New Take button or first take
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:

---

## Summary

**Total Tests**: 86
**Passed**: ___
**Failed**: ___
**Blocked**: ___

### Critical Issues Found
1.
2.
3.

### Minor Issues Found
1.
2.
3.

### Recommendations
1.
2.
3.

### Test Environment Notes
- Browser: _______________
- Screen Resolution: _______________
- Date Tested: _______________
- Tester: _______________
