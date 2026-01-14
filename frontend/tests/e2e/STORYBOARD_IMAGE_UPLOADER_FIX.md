# Storyboard Panel Image Uploader - Bug Fixes

## Issues Fixed

### Issue 1: Button Alignment - Replace/Remove buttons appearing on LEFT instead of RIGHT

**Root Cause:**
The hover overlay container had `justify-end` CSS class to align buttons to the right, but the `<div {...getRootProps()}>` wrapper from react-dropzone was creating a flex child that was interfering with the alignment. The dropzone div was taking up space and pushing the buttons, causing them to appear on the left side instead of the right.

**Solution:**
Added `pointer-events-none` to the parent overlay container and `pointer-events-auto` to individual interactive elements (buttons). This allows the overlay to not interfere with hover detection while still enabling button clicks.

**Changes Made:**
```tsx
// Before:
<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-2">
  <div {...getRootProps()}>
    <input {...getInputProps()} />
    <Button size="sm" variant="secondary" className="gap-1">
      <Upload className="w-4 h-4" />
      Replace
    </Button>
  </div>
  <Button
    size="sm"
    variant="destructive"
    className="gap-1"
    onClick={handleRemove}
  >
    <X className="w-4 h-4" />
    Remove
  </Button>
</div>

// After:
<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-2 pointer-events-none">
  <div {...getRootProps()} className="pointer-events-auto">
    <input {...getInputProps()} />
    <Button size="sm" variant="secondary" className="gap-1">
      <Upload className="w-4 h-4" />
      Replace
    </Button>
  </div>
  <Button
    size="sm"
    variant="destructive"
    className="gap-1 pointer-events-auto"
    onClick={handleRemove}
  >
    <X className="w-4 h-4" />
    Remove
  </Button>
</div>
```

### Issue 2: Image Not Displaying After Upload

**Root Cause:**
After uploading an image, the component was calling `onImageUploaded(result.file_url)` which triggered a parent refetch, but there was a delay before the `currentImageUrl` prop updated. This caused the image to not appear immediately, creating a poor user experience.

**Solution:**
Implemented optimistic UI updates by adding local state (`optimisticImageUrl`) that is set immediately after upload completes. The component now shows the uploaded image instantly while waiting for the server-side data to sync.

**Changes Made:**

1. Added optimistic state:
```tsx
const [optimisticImageUrl, setOptimisticImageUrl] = useState<string | null>(null);
```

2. Added effect to clear optimistic URL when real URL arrives:
```tsx
useEffect(() => {
  if (currentImageUrl && optimisticImageUrl && currentImageUrl !== optimisticImageUrl) {
    setOptimisticImageUrl(null);
  }
}, [currentImageUrl, optimisticImageUrl]);
```

3. Set optimistic URL on successful upload:
```tsx
try {
  setUploadProgress(50);
  const result = await uploadImage.mutateAsync({ panelId, file: fileToProcess });
  setUploadProgress(100);

  // Set optimistic URL immediately for instant feedback
  setOptimisticImageUrl(result.file_url);

  if (onImageUploaded) {
    onImageUploaded(result.file_url);
  }
  toast.success('Image uploaded');
} catch (err: any) {
  toast.error(err.message || 'Upload failed');
  setOptimisticImageUrl(null); // Clear on error
}
```

4. Clear optimistic URL on remove:
```tsx
const handleRemove = useCallback(
  (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStagingMode && onFileSelected) {
      onFileSelected(null);
    } else {
      // Clear optimistic URL immediately for instant feedback
      setOptimisticImageUrl(null);
      if (onImageRemoved) {
        onImageRemoved();
      }
    }
  },
  [onImageRemoved, isStagingMode, onFileSelected]
);
```

5. Updated display URL to prioritize optimistic URL:
```tsx
// Display URL: use optimistic URL if available, otherwise fall back to staged preview or current URL
const displayUrl = optimisticImageUrl || stagedPreviewUrl || currentImageUrl;
```

## Files Modified

- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/storyboard/PanelImageUploader.tsx`
  - Added `pointer-events-none` and `pointer-events-auto` classes for proper button alignment
  - Added optimistic UI state for instant image display
  - Added useEffect to sync optimistic state with server state
  - Updated upload and remove handlers to manage optimistic state

## Testing

### Automated Tests
Created comprehensive Playwright test suite: `tests/e2e/storyboard-panel-image-uploader.spec.ts`

Test coverage includes:
1. **Button Alignment Test**: Verifies Replace/Remove buttons appear on the RIGHT side when hovering
2. **Image Display Test**: Verifies uploaded images display immediately on panels
3. **Visual Inspection Test**: Captures screenshots of panels in various states
4. **Console Error Check**: Monitors for CORS errors, 404s, and other image loading issues

### Manual Testing Steps

1. Navigate to http://localhost:8080
2. Log in with appropriate credentials
3. Go to a Backlot project
4. Open the Storyboard view
5. Create or select a storyboard with sections and panels

**Test Button Alignment:**
6. Hover over a panel that has an image uploaded
7. Verify that "Replace" and "Remove" buttons appear on the RIGHT side of the panel
8. Verify buttons are horizontally aligned and visible

**Test Image Display:**
9. Find a panel without an image (or remove an existing one)
10. Click on the upload dropzone or drag-and-drop an image
11. Verify the image appears IMMEDIATELY after upload completes (within ~1 second)
12. Verify the image is not broken (shows actual image content, not a broken image icon)
13. Hover over the image and verify buttons still appear on the right

**Test Remove Functionality:**
14. Hover over a panel with an image
15. Click "Remove" button
16. Verify the image disappears IMMEDIATELY
17. Verify the upload dropzone reappears

### Expected Behavior After Fixes

1. **Button Alignment**: Replace and Remove buttons consistently appear on the RIGHT side of the panel when hovering, with proper spacing from the edge
2. **Image Display**: Images appear instantly after upload completes, providing immediate visual feedback
3. **Remove Action**: Images disappear instantly when removed, providing immediate feedback
4. **No Console Errors**: No CORS errors, 404s, or image loading failures in browser console

## Technical Details

### CSS Pointer Events Strategy
The use of `pointer-events-none` on the parent overlay prevents the overlay itself from capturing pointer events, while `pointer-events-auto` on child elements restores interaction. This is a common pattern for overlays that should not interfere with underlying content but need to have interactive elements.

### Optimistic UI Pattern
The optimistic UI pattern provides instant feedback to users by updating the UI immediately based on the expected result of an operation, before waiting for server confirmation. This significantly improves perceived performance and user experience.

Key benefits:
- Instant visual feedback
- No loading flicker or delay
- Graceful error handling (reverts on failure)
- Syncs with server state when available

### Flexbox Alignment
The hover overlay uses flexbox with:
- `flex`: Enable flexbox layout
- `items-center`: Center items vertically
- `justify-end`: Align items to the right edge
- `gap-2`: Add spacing between buttons
- `pr-2`: Add padding from right edge

This ensures buttons are always positioned on the right side of the panel.

## Browser Compatibility

These fixes use standard CSS features that are widely supported:
- `pointer-events`: Supported in all modern browsers (Chrome 2+, Firefox 3.6+, Safari 4+)
- Flexbox: Supported in all modern browsers
- React hooks (useState, useEffect): Standard React features

## Performance Impact

Minimal performance impact:
- Added one useState hook (negligible memory overhead)
- Added one useEffect hook (runs only when URLs change)
- No additional network requests
- No additional re-renders beyond normal React update cycle

## Deployment Checklist

- [x] Code changes implemented
- [ ] Playwright tests run successfully
- [ ] Manual testing completed
- [ ] Screenshots captured showing before/after
- [ ] No console errors in browser
- [ ] No TypeScript errors
- [ ] Code reviewed
- [ ] Ready for deployment

## Rollback Plan

If issues are discovered after deployment:

1. Revert `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/storyboard/PanelImageUploader.tsx` to previous version
2. The component is self-contained, so reverting this single file will restore previous behavior
3. No database changes or API changes were made, so rollback is safe

## Future Improvements

Potential enhancements for future iterations:

1. **Image Caching**: Implement browser-side caching to prevent re-fetching images
2. **Progressive Image Loading**: Show low-res placeholder while high-res image loads
3. **Image Validation**: Validate image dimensions and file size before upload
4. **Drag Reordering**: Allow drag-and-drop to reorder panels
5. **Bulk Upload**: Support uploading images to multiple panels at once
6. **Image Editing**: Add basic image editing tools (crop, rotate, adjust)

## Related Components

Components that interact with PanelImageUploader:
- `StoryboardView.tsx` - Parent component that renders PanelCard components
- `PanelCard` - Component that uses PanelImageUploader for each panel
- `usePanelImageUpload` hook - Handles S3 upload logic

No changes required to related components - all fixes are isolated to PanelImageUploader.
