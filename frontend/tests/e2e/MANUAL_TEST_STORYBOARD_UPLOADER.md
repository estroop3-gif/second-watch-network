# Manual Testing Guide - Storyboard Panel Image Uploader

## Prerequisites
- Dev server running on http://localhost:8080
- Backend server running on localhost:8000
- Valid user account with access to Backlot projects
- Test storyboard with sections and panels

## Test Setup

1. Start dev server (if not running):
```bash
cd /home/estro/second-watch-network/frontend
npm run dev
```

2. Open browser to http://localhost:8080
3. Log in with your credentials

## Test Case 1: Button Alignment (RIGHT side)

### Steps:
1. Navigate to any Backlot project
2. Click on "Storyboard" tab/view
3. Select a storyboard that has sections and panels
4. Find a panel that already has an image uploaded (or upload one first)
5. **Hover your mouse over the panel image**

### Expected Result:
- A dark overlay (50% black) should appear over the image
- Two buttons should be visible: "Replace" and "Remove"
- **CRITICAL**: Both buttons should be aligned to the **RIGHT side** of the panel
- The "Replace" button should appear first (on the left)
- The "Remove" button (red) should appear second (on the right)
- There should be small spacing between the buttons and the right edge (about 8px padding)

### How to Verify Button Position:
1. Open browser DevTools (F12)
2. Hover over the panel image
3. Inspect the button positions
4. Verify the parent div has classes: `justify-end` and `pr-2`
5. Visually confirm buttons are near the right edge, not the left or center

### Visual Reference:
```
┌─────────────────────────────────────────┐
│                                         │
│         Panel Image                     │
│                                         │
│              [Replace] [Remove]  │←8px│ │  ← Buttons on RIGHT
│                                         │
└─────────────────────────────────────────┘
```

### FAIL Criteria:
- ❌ Buttons appear on the LEFT side
- ❌ Buttons appear in the CENTER
- ❌ Buttons are not horizontally aligned
- ❌ "Remove" button appears before "Replace" button

### PASS Criteria:
- ✅ Both buttons appear on the RIGHT side of the panel
- ✅ Buttons have proper spacing from the right edge
- ✅ "Replace" button appears first, "Remove" button second
- ✅ Hover overlay transitions smoothly

---

## Test Case 2: Image Display After Upload

### Steps:
1. Navigate to any Backlot project storyboard
2. Find a panel WITHOUT an image (shows upload dropzone)
3. Prepare a test image file (JPG, PNG, or WebP)
4. **Click on the upload dropzone** or **drag-and-drop** the image

### Expected Result:
- Upload progress indicator should appear briefly
- "Image uploaded" success toast notification should appear
- **CRITICAL**: The image should display **IMMEDIATELY** (within 1 second)
- The image should be clearly visible, not broken
- The upload dropzone should be replaced by the image thumbnail

### How to Verify Image Display:
1. Watch the upload carefully
2. Note the time between "Image uploaded" toast and image appearing
3. Verify the image is not a broken image icon
4. Hover over the image to verify Replace/Remove buttons work

### Visual Sequence:
```
Before Upload:
┌─────────────────────────┐
│    🖼️ Drop image or    │
│    click to upload      │
└─────────────────────────┘

During Upload:
┌─────────────────────────┐
│         ⟳ 50%           │
└─────────────────────────┘

After Upload (IMMEDIATE):
┌─────────────────────────┐
│                         │
│    [Uploaded Image]     │
│                         │
└─────────────────────────┘
```

### FAIL Criteria:
- ❌ Image takes more than 3 seconds to appear
- ❌ Image appears as broken (missing image icon)
- ❌ Upload dropzone remains visible after upload
- ❌ Console shows CORS errors or 404s

### PASS Criteria:
- ✅ Image appears within 1 second after upload completes
- ✅ Image displays correctly (not broken)
- ✅ Image has proper aspect ratio
- ✅ No console errors related to image loading

---

## Test Case 3: Image Removal (Instant Feedback)

### Steps:
1. Navigate to a panel with an uploaded image
2. **Hover over the panel image**
3. **Click the "Remove" button**

### Expected Result:
- **CRITICAL**: The image should disappear **IMMEDIATELY**
- The upload dropzone should reappear instantly
- No loading spinner or delay
- No error messages

### Visual Sequence:
```
Before Remove:
┌─────────────────────────────────────────┐
│                                         │
│    [Panel Image]   [Replace] [Remove]  │
│                                         │
└─────────────────────────────────────────┘

After Remove (IMMEDIATE):
┌─────────────────────────┐
│    🖼️ Drop image or    │
│    click to upload      │
└─────────────────────────┘
```

### FAIL Criteria:
- ❌ Image takes time to disappear
- ❌ Loading spinner appears
- ❌ Error message appears
- ❌ Upload dropzone doesn't reappear

### PASS Criteria:
- ✅ Image disappears instantly on click
- ✅ Upload dropzone reappears immediately
- ✅ No error messages or loading states
- ✅ Panel state is clean and ready for new upload

---

## Test Case 4: Replace Image Functionality

### Steps:
1. Navigate to a panel with an uploaded image
2. **Hover over the panel image**
3. **Click the "Replace" button**
4. Select a different test image

### Expected Result:
- File picker dialog should open
- After selecting new image, upload should proceed
- **CRITICAL**: New image should replace old image **IMMEDIATELY**
- No flicker or broken image state

### FAIL Criteria:
- ❌ Old image persists after replacement
- ❌ Broken image appears during replacement
- ❌ Upload fails silently
- ❌ Both old and new images appear

### PASS Criteria:
- ✅ New image replaces old image instantly
- ✅ Smooth transition with no flicker
- ✅ Success toast notification appears
- ✅ Replace/Remove buttons still work on new image

---

## Test Case 5: Console Error Check

### Steps:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Clear console
4. Perform all upload/remove operations
5. Monitor for errors

### Expected Result:
- **No CORS errors**
- **No 404 errors** for image URLs
- **No React errors** or warnings
- **No TypeScript errors** in console

### Common Errors to Watch For:
```
❌ CORS policy: No 'Access-Control-Allow-Origin' header
❌ Failed to load resource: the server responded with a status of 404
❌ GET https://... 404 (Not Found)
❌ Uncaught (in promise) TypeError: Cannot read property...
```

### PASS Criteria:
- ✅ Console is clean (only info/debug messages)
- ✅ No CORS-related errors
- ✅ All image requests return 200 OK
- ✅ No unhandled promise rejections

---

## Test Case 6: Multi-Panel Testing

### Steps:
1. Navigate to a storyboard with multiple panels
2. Upload images to 3-5 different panels
3. Test hover behavior on all panels
4. Remove images from some panels
5. Replace images on other panels

### Expected Result:
- All panels should behave consistently
- Button alignment should be correct on ALL panels
- Images should display instantly on ALL panels
- No cross-panel interference

### FAIL Criteria:
- ❌ Some panels have buttons on left, others on right
- ❌ Some images load slowly, others instantly
- ❌ Inconsistent behavior across panels

### PASS Criteria:
- ✅ Consistent button alignment across all panels (RIGHT side)
- ✅ Consistent instant image display across all panels
- ✅ All hover overlays work independently
- ✅ No state leakage between panels

---

## Test Case 7: Different Image Formats

### Steps:
1. Upload a JPG image → Verify display
2. Upload a PNG image → Verify display
3. Upload a WebP image → Verify display
4. Upload a GIF image → Verify display

### Expected Result:
- All supported formats should display correctly
- Image quality should be reasonable (compression applied if needed)
- File size < 1MB should retain original quality
- File size > 1MB should be compressed automatically

### PASS Criteria:
- ✅ All formats display correctly
- ✅ Reasonable image quality maintained
- ✅ Large files are compressed automatically
- ✅ No format-specific errors

---

## Test Case 8: Edge Cases

### Test 8a: Very Large Image
1. Upload an image > 5MB
2. Verify compression occurs
3. Verify image still displays correctly

### Test 8b: Very Small Image
1. Upload a tiny image (< 10KB)
2. Verify image displays without distortion
3. Verify image scales appropriately

### Test 8c: Unusual Aspect Ratios
1. Upload a very wide image (panorama)
2. Upload a very tall image (portrait)
3. Verify both display with proper object-fit

### Test 8d: Network Issues
1. Open DevTools Network tab
2. Set throttling to "Slow 3G"
3. Upload an image
4. Verify graceful handling of slow upload

---

## Bug Report Template

If you find issues, use this template:

```
## Bug Report: Storyboard Panel Image Uploader

**Issue**: [Brief description]

**Test Case**: [Which test case from above]

**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Screenshots**:
[Attach screenshots if applicable]

**Console Errors**:
[Paste any console errors]

**Browser**: [Chrome/Firefox/Safari + version]

**URL**: http://localhost:8080/backlot/[project-id]/storyboard/[storyboard-id]

**Severity**: [Critical/High/Medium/Low]
```

---

## Success Criteria Summary

For the fixes to be considered successful, ALL of the following must be true:

1. ✅ Replace/Remove buttons appear on the RIGHT side when hovering (Test Case 1)
2. ✅ Images display within 1 second after upload (Test Case 2)
3. ✅ Images disappear instantly when removed (Test Case 3)
4. ✅ Replace functionality works smoothly (Test Case 4)
5. ✅ No console errors during operations (Test Case 5)
6. ✅ Consistent behavior across multiple panels (Test Case 6)
7. ✅ All image formats supported (Test Case 7)
8. ✅ Edge cases handled gracefully (Test Case 8)

---

## Additional Notes

### Browser Compatibility
Test in multiple browsers:
- Chrome/Chromium (primary)
- Firefox
- Safari (if available)

### Performance Considerations
- Image upload should complete in < 5 seconds on normal network
- UI should remain responsive during upload
- No memory leaks after multiple uploads/removes

### Accessibility
- Keyboard navigation should work (Tab to focus, Enter to activate)
- Screen readers should announce button labels correctly
- Focus indicators should be visible

---

## Automated Test

To run the automated Playwright test:

```bash
cd /home/estro/second-watch-network/frontend
npx playwright test tests/e2e/storyboard-panel-image-uploader.spec.ts --headed
```

This will run automated checks for button alignment, image display, and console errors.

Screenshots will be saved to: `tests/e2e/screenshots/`

---

## Contact

If you encounter issues or have questions about these tests, refer to:
- Fix documentation: `tests/e2e/STORYBOARD_IMAGE_UPLOADER_FIX.md`
- Component code: `src/components/backlot/workspace/storyboard/PanelImageUploader.tsx`
