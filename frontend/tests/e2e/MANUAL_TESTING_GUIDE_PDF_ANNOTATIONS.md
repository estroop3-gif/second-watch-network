# Manual Testing Guide: Continuity Tab PDF Annotations

**Version**: 1.0
**Date**: 2026-01-10
**Purpose**: Manual verification of PDF annotation features in the Continuity tab

---

## Prerequisites

Before starting this manual test, ensure you have:

- [ ] Access to https://www.secondwatchnetwork.com
- [ ] Valid user account with login credentials
- [ ] Access to at least one Backlot project
- [ ] Project has a PDF script uploaded
- [ ] Project has continuity data/scenes configured
- [ ] Modern web browser (Chrome, Firefox, Safari, or Edge)
- [ ] Screen resolution of at least 1280x720 (1920x1080 recommended)

---

## Test Environment Setup

### Step 1: Navigate to Test Location

1. Open browser
2. Go to: https://www.secondwatchnetwork.com
3. Click **LOG IN** button (top right)
4. Enter your credentials
5. Log in successfully

**✓ Checkpoint**: You should see your user menu/avatar in the top right

### Step 2: Navigate to Continuity Tab

1. Click **Backlot** in the main navigation
2. Select a project that has:
   - An uploaded PDF script
   - At least one scene configured
3. Click **Script** in the project sidebar
4. Click **Continuity** tab

**✓ Checkpoint**: You should see:
- Left panel: List of scenes
- Center panel: PDF viewer with script
- Right panel: Tabs for Takes, Notes, Photos

---

## Test Procedures

### Test 1: Identify Annotation Toolbar

**Objective**: Locate and document all annotation tools

**Steps**:
1. Look at the top of the PDF viewer area
2. Identify the toolbar with annotation tools
3. Document each button/tool visible

**Expected Tools** (check all that you find):
- [ ] Highlight/Rectangle tool
- [ ] Note/Comment tool
- [ ] Pen/Draw tool
- [ ] Select/Pointer tool
- [ ] Delete/Erase tool
- [ ] Undo button
- [ ] Redo button
- [ ] Color picker (if available)

**Screenshot**: Take a screenshot of the toolbar

**Notes**:
```
[Record what you see here]
```

---

### Test 2: Highlight Tool (Rectangle)

**Objective**: Create rectangular highlights on the PDF

**Steps**:
1. Click the **Highlight** tool button (may be labeled "Rectangle" or have a rectangle icon)
2. Move mouse over the PDF viewer
3. Click and drag to create a rectangle
4. Release mouse button
5. Observe the created highlight

**Expected Results**:
- [ ] Button activates (changes color or shows active state)
- [ ] Cursor changes to indicate drawing mode
- [ ] Rectangle appears while dragging
- [ ] Rectangle persists after mouse release
- [ ] Rectangle has visible border or fill color

**Try Multiple Times**:
- [ ] Create small rectangle
- [ ] Create large rectangle
- [ ] Create rectangle across text
- [ ] Create overlapping rectangles

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Capture PDF with multiple highlights

---

### Test 3: Note Tool (Highlight + Text)

**Objective**: Create notes with text annotations

**Steps**:
1. Click the **Note** tool button (may be labeled "Comment" or "Annotation")
2. Move mouse over the PDF
3. Click and drag to create a highlight area
4. Release mouse button
5. Look for a text input field or dialog
6. Type: "This is a test note"
7. Save/submit the note (click OK, Save, or press Enter)

**Expected Results**:
- [ ] Tool activates when clicked
- [ ] Highlight area is created
- [ ] Text input appears (popup, sidebar, or inline)
- [ ] Text can be entered
- [ ] Note is saved successfully
- [ ] Note appears with an indicator (icon, highlight, etc.)

**Try Different Scenarios**:
- [ ] Short note (one word)
- [ ] Long note (multiple sentences)
- [ ] Note with special characters (!@#$%^&*)
- [ ] Empty note (no text)

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Capture note creation process and final result

---

### Test 4: Pen/Draw Tool

**Objective**: Create freehand drawings on the PDF

**Steps**:
1. Click the **Pen** or **Draw** tool button
2. Move mouse over the PDF
3. Click and hold mouse button
4. Draw a curved line or shape
5. Release mouse button
6. Observe the drawing

**Expected Results**:
- [ ] Tool activates
- [ ] Cursor indicates drawing mode
- [ ] Path follows mouse movement
- [ ] Drawing is smooth (not choppy)
- [ ] Drawing persists after mouse release
- [ ] Drawing has consistent color and thickness

**Try Different Drawings**:
- [ ] Short straight line
- [ ] Long curved line
- [ ] Circle/loop shape
- [ ] Zigzag pattern
- [ ] Very fast movement
- [ ] Very slow movement

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Capture PDF with various drawings

---

### Test 5: Select Tool

**Objective**: Select existing annotations

**Steps**:
1. Ensure you have at least one annotation created (from previous tests)
2. Click the **Select** or **Pointer** tool button
3. Click on a highlight/drawing you created earlier
4. Observe what happens

**Expected Results**:
- [ ] Tool activates
- [ ] Clicking an annotation selects it
- [ ] Selected annotation shows visual feedback (handles, border, highlight)
- [ ] Can select different annotations
- [ ] Clicking empty space deselects

**Try Selecting**:
- [ ] Highlight/rectangle annotation
- [ ] Note annotation
- [ ] Freehand drawing
- [ ] Click between annotations (should deselect)

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Capture selected annotation showing selection handles

---

### Test 6: Undo/Redo (Keyboard Shortcuts)

**Objective**: Test undo and redo functionality

**Steps for Undo**:
1. Create a new highlight annotation
2. Press **Ctrl+Z** (Windows/Linux) or **Cmd+Z** (Mac)
3. Observe what happens to the annotation

**Expected Results**:
- [ ] Annotation disappears
- [ ] PDF returns to previous state
- [ ] Can undo multiple times (if multiple annotations exist)

**Steps for Redo**:
1. After undoing, press **Ctrl+Shift+Z** (Windows/Linux) or **Cmd+Shift+Z** (Mac)
2. Observe what happens

**Expected Results**:
- [ ] Undone annotation reappears
- [ ] PDF returns to state before undo
- [ ] Can redo multiple times

**Test Sequence**:
1. Create annotation #1 → Take screenshot
2. Create annotation #2 → Take screenshot
3. Create annotation #3 → Take screenshot
4. Press Ctrl+Z → Take screenshot (should remove #3)
5. Press Ctrl+Z → Take screenshot (should remove #2)
6. Press Ctrl+Shift+Z → Take screenshot (should restore #2)
7. Press Ctrl+Shift+Z → Take screenshot (should restore #3)

**Issues Found**:
```
[Record any problems here]
```

**Screenshots**: Capture each step of the undo/redo sequence

---

### Test 7: Delete Annotations

**Objective**: Delete selected annotations

**Steps**:
1. Create a test annotation (highlight or drawing)
2. Select the annotation with the Select tool
3. **Try Method 1**: Press **Delete** key
4. Observe result

If annotation still exists:
5. Select it again
6. **Try Method 2**: Press **Backspace** key
7. Observe result

If annotation still exists:
8. Select it again
9. **Try Method 3**: Look for and click a **Delete** or **Trash** button in toolbar
10. Observe result

**Expected Results**:
- [ ] Delete key removes selected annotation
- OR [ ] Backspace key removes selected annotation
- OR [ ] Delete button removes selected annotation
- [ ] Annotation completely disappears
- [ ] Can delete different types of annotations (highlight, note, drawing)

**Test Deleting**:
- [ ] Single annotation
- [ ] Multiple annotations (one at a time)
- [ ] Newly created annotation
- [ ] Older annotation

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Before and after deletion

---

### Test 8: Note Tooltip on Hover

**Objective**: Verify note annotations show tooltips

**Steps**:
1. Create a note annotation (if not already done)
2. Add text: "Hover test - this should appear in tooltip"
3. Save the note
4. Switch to **Select** or **Pointer** tool
5. Move mouse over the note annotation
6. Wait 1-2 seconds
7. Observe what appears

**Expected Results**:
- [ ] Tooltip appears on hover
- [ ] Tooltip contains the note text
- [ ] Tooltip is readable (good contrast, proper size)
- [ ] Tooltip appears near the note
- [ ] Tooltip disappears when mouse moves away

**Test Different Scenarios**:
- [ ] Short note text (few words)
- [ ] Long note text (multiple lines)
- [ ] Hover over note icon vs highlight area
- [ ] Hover briefly vs extended hover

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Capture tooltip displayed

---

### Test 9: Complete Workflow Integration

**Objective**: Test all features working together

**Steps**:
1. Start with a clean PDF (or clear all existing annotations)
2. Create 3 highlight annotations at different locations
   - Top of page
   - Middle of page
   - Bottom of page
3. Create 2 note annotations with text:
   - Note 1: "Important scene detail"
   - Note 2: "Continuity note for wardrobe"
4. Create 1 freehand drawing (arrow or circle around text)
5. Press Ctrl+Z to undo the drawing
6. Press Ctrl+Shift+Z to redo (bring drawing back)
7. Select one of the highlights
8. Delete it with Delete key
9. Hover over one of the notes to see tooltip
10. Take a final screenshot showing all remaining annotations

**Expected Final State**:
- [ ] 2 highlights visible (3 created, 1 deleted)
- [ ] 2 notes visible with tooltips working
- [ ] 1 drawing visible
- [ ] All annotations properly rendered
- [ ] No visual glitches

**Issues Found**:
```
[Record any problems here]
```

**Screenshot**: Final state with all annotations

---

## Additional Tests (If Time Permits)

### Test 10: Color Selection (If Available)
1. Look for color picker or color options
2. Create annotation with different colors
3. Verify colors are applied correctly

### Test 11: Annotation Persistence
1. Create several annotations
2. Navigate away from Continuity tab
3. Navigate back to Continuity tab
4. Verify annotations are still present

### Test 12: Multi-Page Annotations
1. If script has multiple pages, navigate to different pages
2. Create annotations on different pages
3. Navigate between pages
4. Verify annotations appear on correct pages

### Test 13: Annotation Export (If Available)
1. Create several annotations
2. Look for Export or Download option
3. Try to export annotations
4. Verify export contains annotation data

---

## Bug Report Template

If you find any issues, please report them using this template:

```
BUG REPORT #[number]
==================

Title: [Brief description]

Severity: [Critical / High / Medium / Low]

Steps to Reproduce:
1.
2.
3.

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happens]

Screenshots:
[Attach screenshots]

Browser: [Chrome/Firefox/Safari/Edge version]
OS: [Windows/Mac/Linux]
Screen Resolution: [e.g., 1920x1080]

Additional Notes:
[Any other relevant information]
```

---

## Test Completion Checklist

After completing all tests, verify:

- [ ] All 9 main tests completed
- [ ] Screenshots captured for each test
- [ ] Issues documented with bug reports
- [ ] Notes recorded for each test
- [ ] Summary created (see below)

---

## Test Summary

**Date Tested**: _______________
**Tester Name**: _______________
**Browser**: _______________
**OS**: _______________

### Results Summary

| Test | Pass | Fail | Partial | Notes |
|------|------|------|---------|-------|
| 1. Identify Toolbar | ☐ | ☐ | ☐ | |
| 2. Highlight Tool | ☐ | ☐ | ☐ | |
| 3. Note Tool | ☐ | ☐ | ☐ | |
| 4. Pen/Draw Tool | ☐ | ☐ | ☐ | |
| 5. Select Tool | ☐ | ☐ | ☐ | |
| 6. Undo/Redo | ☐ | ☐ | ☐ | |
| 7. Delete Annotations | ☐ | ☐ | ☐ | |
| 8. Note Tooltips | ☐ | ☐ | ☐ | |
| 9. Complete Workflow | ☐ | ☐ | ☐ | |

**Total Pass**: _____ / 9
**Total Fail**: _____ / 9
**Total Partial**: _____ / 9

### Overall Assessment

```
[Provide overall summary of annotation features:
- What works well?
- What needs improvement?
- Any critical issues?
- Recommendations for development team]
```

### Top Issues Found

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Recommendations

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Appendix: Common Issues & Troubleshooting

### Issue: Can't find annotation toolbar
- **Check**: Look at the top, bottom, or sides of PDF viewer
- **Check**: Look for floating toolbar or menu
- **Check**: Right-click on PDF to see context menu

### Issue: Tools don't activate
- **Try**: Refresh the page
- **Try**: Click tool button again
- **Check**: Console for JavaScript errors (F12 → Console)

### Issue: Annotations don't appear
- **Check**: Zoom level of PDF
- **Check**: If PDF fully loaded
- **Try**: Different area of PDF
- **Check**: If annotation is behind text layer

### Issue: Can't select annotations
- **Try**: Click exactly on the annotation border/edge
- **Try**: Different Select tool option
- **Check**: If annotation layer is blocked

### Issue: Keyboard shortcuts don't work
- **Check**: Focus is on PDF viewer (click PDF first)
- **Try**: Click in PDF area before pressing keys
- **Check**: Browser doesn't have conflicting shortcuts

---

**End of Manual Testing Guide**
