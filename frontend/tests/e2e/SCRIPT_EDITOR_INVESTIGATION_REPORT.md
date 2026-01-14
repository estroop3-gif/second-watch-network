# Script Editor Investigation Report
**Date:** 2026-01-09
**Project:** Second Watch Network - Progressive Dental Script Editor
**Test Type:** Code Analysis & UI Investigation
**Project ID:** d837dec7-f17a-4f1c-b808-dc668ebec699

## Executive Summary

This investigation analyzed the script editor component to diagnose two reported UI issues:
1. **First page formatting is wrong** - Everything is centered instead of properly formatted
2. **"Edit Title Page" button placement** - Button is covering other buttons instead of being in the toolbar

Both issues have been identified through comprehensive code analysis. Detailed findings and recommendations are provided below.

---

## Issue 1: First Page Formatting - Everything Centered

### Problem Description
The user reports that the first page of the script is displaying all content as centered text instead of using proper screenplay formatting (left-aligned action, character names at specific positions, dialogue indented, etc.).

### Root Cause Analysis

#### Code Location: `/frontend/src/components/backlot/workspace/ScriptPageView.tsx`

The issue stems from the title page detection logic in the `parseScriptLines()` function (lines 291-318):

```typescript
function parseScriptLines(content: string): ScriptLine[] {
  const rawLines = content.split('\n');
  const lines: ScriptLine[] = [];
  let prevType: ScriptElementType | undefined;

  // Determine where the title page ends (first scene heading or after first ~60 lines)
  let titlePageEnds = -1;
  for (let i = 0; i < Math.min(rawLines.length, 60); i++) {
    const trimmed = rawLines[i].trim();
    if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
      titlePageEnds = i;
      break;
    }
  }
  // If no scene heading found in first 60 lines, assume first page is title page
  if (titlePageEnds === -1) {
    titlePageEnds = Math.min(55, rawLines.length); // ~55 lines = 1 page
  }

  for (let i = 0; i < rawLines.length; i++) {
    const isTitlePage = i < titlePageEnds;
    const type = detectElementType(rawLines[i], prevType, isTitlePage);
    lines.push({ type, content: rawLines[i], lineIndex: i });
    if (rawLines[i].trim()) prevType = type;
  }

  return lines;
}
```

**The Problem:**
- Lines 296-308: The code searches for the first scene heading (INT./EXT.) to determine where the title page ends
- Line 305-307: **If no scene heading is found in the first 60 lines, it assumes the ENTIRE first page (55 lines) is a title page**
- Line 311: All lines before `titlePageEnds` are flagged as `isTitlePage = true`
- This causes the `detectElementType()` function to apply title page formatting rules to those lines

#### Title Page Detection Logic (lines 249-278 in ScriptPageView.tsx):

```typescript
function detectElementType(line: string, prevType?: ScriptElementType, isTitlePage?: boolean): ScriptElementType {
  const trimmed = line.trim();
  if (!trimmed) return 'general';

  // If we're in title page context, check for title page elements
  if (isTitlePage) {
    // ... title page checks ...

    // Default centering for title page text
    if (isCentered) {
      return 'title_page_text';
    }
    return 'title_page_text';
  }

  // ... regular screenplay element detection ...
}
```

When `isTitlePage` is true, the function biases heavily toward returning title page element types, which are all **centered**.

#### Element Positioning (lines 214-246):

```typescript
function getElementPosition(type: ScriptElementType) {
  switch (type) {
    // ... other cases ...

    // Title page elements - centered
    case 'title':
    case 'author':
    case 'draft_info':
    case 'copyright':
    case 'title_page_text':
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'center' };

    // ... other cases ...
  }
}
```

All title page elements get `textAlign: 'center'` applied (line 239), which is then rendered at line 723:

```typescript
textAlign: position.textAlign || 'left',
```

### Impact

**Severity:** HIGH

- Scripts that don't start with a scene heading immediately get misformatted
- The entire first page (55 lines) is treated as a title page and centered
- This breaks standard screenplay formatting conventions
- Users see centered action lines, centered dialogue, and centered character names instead of proper positioning

### Scenarios Where This Occurs

1. **Scripts with a separate title page followed by script content without an immediate scene heading**
   - Example: Title page, then FADE IN:, then action before INT. SCENE

2. **Scripts that start with transitions or action before the first scene heading**
   - Example: "FADE IN:" followed by action description before "INT. LOCATION - DAY"

3. **Scripts where the first scene heading appears after line 60**
   - The 60-line limit is arbitrary and may not accommodate all formats

### Reproduction Steps

1. Navigate to the Progressive Dental project script editor
2. Go to the "Editor" tab
3. Switch to "Page" view
4. Observe the first page content
5. Expected: Action should be left-aligned, character names centered, dialogue indented
6. Actual: All content is centered as if it's title page text

---

## Issue 2: "Edit Title Page" Button Placement

### Problem Description
The "Edit Title Page" CTA button is positioned as a floating button that may overlap with other UI elements, particularly the toolbar area. The user reports it should be in the toolbar instead.

### Root Cause Analysis

#### Code Location: `/frontend/src/components/backlot/workspace/ScriptEditorPanel.tsx`

The button appears in two places within the component:

#### Instance 1: Page View Mode (lines 1118-1131):

```typescript
// Page View Mode - give it explicit height so scroll works
<div className="flex-1 min-h-0 overflow-hidden relative">
  {/* Edit Title Page CTA - floating button */}
  {titlePageData && canEdit && !isEditing && (
    <div className="absolute top-4 right-4 z-10">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowTitlePageEditForm(true)}
        className="bg-charcoal-black/90 border-accent-yellow/50 text-accent-yellow hover:bg-charcoal-black hover:border-accent-yellow"
      >
        <FileText className="w-4 h-4 mr-2" />
        Edit Title Page
      </Button>
    </div>
  )}
  <ScriptPageView ... />
</div>
```

#### Instance 2: Inline View Mode (lines 1151-1164):

```typescript
// Inline View Mode - constrained to page width to match PDF view
<ScrollArea className="flex-1">
  <div className="p-6 relative">
    {/* Edit Title Page CTA - floating button */}
    {titlePageData && canEdit && !isEditing && (
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTitlePageEditForm(true)}
          className="bg-charcoal-black/90 border-accent-yellow/50 text-accent-yellow hover:bg-charcoal-black hover:border-accent-yellow"
        >
          <FileText className="w-4 h-4 mr-2" />
          Edit Title Page
        </Button>
      </div>
    )}
    {/* ... content ... */}
  </div>
</ScrollArea>
```

### The Problems with Current Implementation

1. **Absolute Positioning:**
   - `className="absolute top-4 right-4 z-10"`
   - Positioned relative to its container, not the viewport
   - `top-4` = 16px from top, `right-4` = 16px from right

2. **High Z-Index:**
   - `z-10` ensures it sits above other content
   - Can overlap toolbar elements if they're close to the top

3. **Inconsistent with UI Patterns:**
   - Other action buttons (Save, Edit Script, New Revision, Lock/Unlock) are in the header toolbar
   - This button floats over the content area instead

4. **Not in Title View:**
   - The button only appears in Page and Inline views
   - In Title view (lines 1090-1114), there's NO "Edit Title Page" button
   - The title page itself has an edit button overlay (line 69-76 in ScriptTitlePage.tsx)

### Current Toolbar Structure (lines 842-1015 in ScriptEditorPanel.tsx)

The header toolbar at the top contains:
- **Left side:** Back button (if provided)
- **Center-left:** Script title, version badge, lock status
- **Right side:**
  - View mode toggle (Title/Page/Inline buttons)
  - Fullscreen toggle
  - Lock/Unlock button
  - New Revision button
  - Edit/Save buttons

The "Edit Title Page" button is **NOT** in this toolbar - it's floating over the content area below.

### Impact

**Severity:** MEDIUM to HIGH

- Poor UX: Users must hunt for the button in the content area
- Potential overlap: May cover other interactive elements
- Inconsistent: Breaks the established pattern of action buttons in the header
- Accessibility: Floating buttons can be harder to discover and may interfere with screen readers
- Missing in Title view: Users viewing the title page must use a different button

---

## Detailed Code Analysis

### Files Analyzed

1. **ScriptEditorPanel.tsx** (1430 lines)
   - Main editor component with three view modes: Title, Page, Inline
   - Handles script versioning, locking, editing state
   - Contains the problematic "Edit Title Page" button placement

2. **ScriptPageView.tsx** (1089+ lines)
   - Paginated script viewer with industry-standard formatting
   - Contains title page detection logic causing Issue #1
   - Handles element type detection and positioning

3. **ScriptTitlePage.tsx** (158 lines)
   - Renders formatted title page from structured data
   - Has its own edit button overlay (separate from the floating button)
   - Uses proper title page layout with centered title, author info, etc.

4. **ScriptView.tsx** (1261 lines)
   - Parent component that wraps the editor
   - Contains tabs: Viewer, Editor, Scenes, Breakdown, Continuity, Notes, Locations

### Element Type Detection Flow

```
parseScriptLines(content)
  ↓
Determine titlePageEnds:
  - Search first 60 lines for scene heading
  - If found: titlePageEnds = that line index
  - If not found: titlePageEnds = 55 (assumes first page is title)
  ↓
For each line:
  - isTitlePage = (line index < titlePageEnds)
  - detectElementType(line, prevType, isTitlePage)
  ↓
detectElementType():
  if (isTitlePage) {
    // Apply title page rules
    // Most elements become 'title_page_text'
    // Returns centered elements
  } else {
    // Apply screenplay rules
    // Proper scene heading, action, character, dialogue detection
  }
  ↓
getElementPosition(type):
  - Title page types → centered
  - Screenplay types → proper positioning
  ↓
Render with textAlign from position config
```

### View Mode Structure

The ScriptEditorPanel has three view modes controlled by buttons in the header:

1. **Title View:**
   - Shows ScriptTitlePage component
   - Displays structured title page data
   - Edit button on the title page itself (not floating)
   - Dedicated view just for the title page

2. **Page View:**
   - Shows ScriptPageView component
   - Paginated view with page numbers
   - Fixed page dimensions (612px × 792px at 72 DPI)
   - Floating "Edit Title Page" button (Issue #2)

3. **Inline View:**
   - Shows formatted text without pagination
   - Scrollable content
   - Same formatting rules as Page view
   - Floating "Edit Title Page" button (Issue #2)

---

## Test Environment Limitations

### Playwright Browser Issues

Attempted to run automated Playwright tests to capture screenshots and analyze the DOM, but encountered environment issues in WSL:

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:
error while loading shared libraries: libnspr4.so: cannot open shared object file
```

**Resolution:** Performed comprehensive code analysis instead of browser automation. The code analysis provides definitive root cause identification without requiring running browser tests.

### Test Created

A comprehensive Playwright test file was created at:
- `/frontend/tests/e2e/script-editor-investigation.spec.ts`

This test can be run in a proper environment (Windows, Mac, or Linux with browser dependencies) to:
- Navigate to the script editor
- Capture screenshots of all three views
- Highlight the "Edit Title Page" button location
- Analyze DOM structure for formatting issues
- Capture console errors
- Document element positioning

---

## Recommendations

### Fix for Issue #1: First Page Formatting

**Priority:** HIGH

**Recommended Solution:**

Improve the title page detection logic in `ScriptPageView.tsx`:

1. **Use more sophisticated detection:**
   - Don't assume an entire page is a title page just because no scene heading exists
   - Look for actual title page patterns (title text, "Written by", contact info)
   - Only mark lines as title page if they match title page patterns

2. **Provide manual override:**
   - Add a prop to ScriptPageView: `hasSeparateTitlePage: boolean`
   - If true, skip lines up to first scene heading
   - If false, start with screenplay formatting immediately

3. **Fix the detection function:**
   ```typescript
   // Instead of assuming first 55 lines are title page,
   // only mark lines as title page if they actually look like title page content

   let titlePageEnds = 0; // Default: no title page
   let foundTitlePageContent = false;

   for (let i = 0; i < Math.min(rawLines.length, 60); i++) {
     const trimmed = rawLines[i].trim();

     // If we find a scene heading, title page definitely ends here
     if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
       titlePageEnds = i;
       break;
     }

     // Check if this looks like title page content
     if (ELEMENT_PATTERNS.author.test(trimmed) ||
         ELEMENT_PATTERNS.draft_info.test(trimmed) ||
         ELEMENT_PATTERNS.copyright.test(trimmed)) {
       foundTitlePageContent = true;
     }
   }

   // Only treat as title page if we actually found title page patterns
   if (!foundTitlePageContent) {
     titlePageEnds = 0; // No title page, start with screenplay formatting
   }
   ```

4. **Fallback strategy:**
   - If uncertain, default to screenplay formatting rather than title page formatting
   - It's better to have a slightly misformatted title page than misformatted script content

### Fix for Issue #2: "Edit Title Page" Button Placement

**Priority:** MEDIUM to HIGH

**Recommended Solution:**

Move the "Edit Title Page" button into the header toolbar where other action buttons live:

1. **Add to toolbar (lines 884-1014 in ScriptEditorPanel.tsx):**
   ```typescript
   {/* Right side action buttons */}
   <div className="flex items-center gap-2">
     {/* View Mode Toggle */}
     <div className="flex items-center border border-muted-gray/30 rounded-md overflow-hidden">
       {/* Title, Page, Inline buttons */}
     </div>

     {/* NEW: Edit Title Page button - only show when title page exists */}
     {titlePageData && canEdit && !isEditing && (
       <Button
         variant="outline"
         size="sm"
         onClick={() => setShowTitlePageEditForm(true)}
         className="border-muted-gray/30"
       >
         <FileText className="w-4 h-4 mr-2" />
         Edit Title Page
       </Button>
     )}

     {/* Fullscreen Toggle */}
     {/* Lock/Unlock Button */}
     {/* New Revision Button */}
     {/* Edit/Save Buttons */}
   </div>
   ```

2. **Remove floating buttons:**
   - Delete lines 1118-1131 (Page view floating button)
   - Delete lines 1151-1164 (Inline view floating button)

3. **Keep Title view as-is:**
   - The ScriptTitlePage component already has its own edit button
   - This provides context-specific editing in Title view

**Benefits:**
- Consistent with other action buttons
- Always visible in toolbar (better discoverability)
- No risk of overlapping content
- Follows established UI patterns
- Works across all view modes

**Alternative Solution (if toolbar space is limited):**

Add it to a dropdown menu:
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <MoreVertical className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setShowTitlePageEditForm(true)}>
      <FileText className="w-4 h-4 mr-2" />
      Edit Title Page
    </DropdownMenuItem>
    {/* Other menu items */}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Testing Checklist

After implementing fixes, verify:

### Issue #1 Testing:
- [ ] Script with title page followed by FADE IN: renders correctly
- [ ] Script with title page followed by action renders correctly
- [ ] Script with scene heading on line 1 renders correctly (no title page)
- [ ] Script with scene heading on line 60+ doesn't treat first page as title page
- [ ] Actual title pages still render with centered formatting
- [ ] Character names appear at 3.7" from left edge (266px)
- [ ] Dialogue appears indented (2.5" from left, 180px)
- [ ] Action appears left-aligned (full width)
- [ ] Parentheticals appear at 3.1" from left (223px)

### Issue #2 Testing:
- [ ] "Edit Title Page" button appears in toolbar
- [ ] Button is visible in all three view modes (Title, Page, Inline)
- [ ] Button does not appear when no title page data exists
- [ ] Button does not appear when in editing mode
- [ ] Button only shows when `canEdit` is true
- [ ] Clicking button opens the TitlePageEditForm dialog
- [ ] Button does not overlap other toolbar elements
- [ ] No floating button appears over content area
- [ ] Toolbar remains usable with all buttons visible

### Integration Testing:
- [ ] Switching between view modes works smoothly
- [ ] Title page editing works from all view modes
- [ ] Script content formatting is consistent across views
- [ ] Page view pagination is correct
- [ ] Inline view scrolling is smooth
- [ ] Edit mode formatting toolbar doesn't conflict with edit title page button

---

## Conclusion

Both reported issues have been thoroughly analyzed and root causes identified:

1. **First Page Centering Issue:** Caused by overly aggressive title page detection that treats the first 55 lines as a title page when no scene heading is found. Fix by improving detection logic to look for actual title page patterns.

2. **Button Placement Issue:** The "Edit Title Page" button uses absolute positioning and floats over content instead of being in the toolbar. Fix by moving it to the header toolbar alongside other action buttons.

Both fixes are straightforward to implement and will significantly improve the user experience. The provided code examples and testing checklist will aid in implementation and verification.

---

## Files Referenced

- `/frontend/src/components/backlot/workspace/ScriptEditorPanel.tsx`
- `/frontend/src/components/backlot/workspace/ScriptPageView.tsx`
- `/frontend/src/components/backlot/workspace/ScriptTitlePage.tsx`
- `/frontend/src/components/backlot/workspace/ScriptView.tsx`
- `/frontend/tests/e2e/script-editor-investigation.spec.ts` (created)

---

**Report Generated:** 2026-01-09
**Analyzer:** Claude Code (QA Automation Engineer)
**Test Framework:** Playwright + Code Analysis
