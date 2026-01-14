# Title Page Preview Scaling Fix

## Issue Summary
The title page preview panel in the Backlot script editor was not scaling responsively with screen size. The preview had a fixed `maxWidth: 320px` which prevented it from using available vertical space and scaling appropriately at different viewport sizes.

## Files Modified
- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/TitlePageEditForm.tsx` (lines 277-297)

## CSS Changes

### Before (Problematic):
```tsx
<div className="bg-white shadow-lg" style={{
  width: '100%',
  maxWidth: '320px',        // Fixed max width prevented scaling
  aspectRatio: '8.5 / 11',
}}>
```

### After (Fixed):
```tsx
<div className="bg-white shadow-lg h-full" style={{
  aspectRatio: '8.5 / 11',  // Maintains paper aspect ratio
  maxWidth: '100%',         // Prevents horizontal overflow
}}>
```

## Key Changes
1. **Removed**: `maxWidth: '320px'` - This was constraining the preview to a fixed size
2. **Added**: `h-full` class - Makes preview use full available vertical space
3. **Added**: `maxWidth: '100%'` - Prevents horizontal overflow while allowing scaling
4. **Kept**: `aspectRatio: '8.5 / 11'` - Maintains standard US letter paper dimensions

## How It Works Now

### Height-Based Scaling
The preview now scales based on the **available vertical space** in the modal:
- The outer container has `flex-1` which fills available space
- The preview wrapper has `h-full` which uses that full height
- The `aspectRatio: '8.5 / 11'` constraint automatically calculates the correct width
- `maxWidth: '100%'` ensures it doesn't overflow horizontally

### Responsive Behavior
- **Large Screens (1920px+)**: Preview fills the available height in the modal, appearing larger and more readable
- **Desktop (1440px)**: Preview scales proportionally, still using full vertical space
- **Laptop (1024px)**: Preview remains appropriately sized with maintained aspect ratio
- **Tablet (768px)**: Preview scales down but remains visible and proportional
- **Mobile (375px)**: Preview uses available space efficiently, no clipping

## Testing

### Automated Tests
Created comprehensive Playwright tests:
- `tests/e2e/title-page-preview-scaling.spec.ts` - Scaling behavior analysis
- `tests/e2e/title-page-preview-visual.spec.ts` - Visual testing and structure verification

### Manual Testing Steps
1. Navigate to a Backlot project script page
2. Open the title page edit modal
3. Resize browser window from 375px to 1920px width
4. Verify:
   - Preview fills available vertical space
   - Maintains 8.5:11 aspect ratio at all sizes
   - No horizontal overflow
   - Content remains centered and readable

### Run Tests
```bash
# Verify CSS structure
npx playwright test tests/e2e/title-page-preview-visual.spec.ts -g "structure"

# View manual test guide
npx playwright test tests/e2e/title-page-preview-visual.spec.ts -g "manual test"
```

## Technical Details

### Aspect Ratio Explained
The `aspectRatio: '8.5 / 11'` = 0.7727 represents standard US Letter paper dimensions:
- 8.5 inches wide
- 11 inches tall
- This matches professional screenplay title page formatting

### CSS Flexbox Interaction
```
Container (w-[45%]):          ← 45% of modal width
  └─ Flex wrapper (flex-1):   ← Fills available height
      └─ Preview (h-full):    ← Uses full wrapper height
          - aspectRatio sets width based on height
          - maxWidth prevents overflow
```

### Browser Compatibility
The `aspectRatio` CSS property is supported in all modern browsers:
- Chrome 88+
- Firefox 89+
- Safari 15+
- Edge 88+

## Benefits
1. **Better UX**: Preview is larger and more readable on all screen sizes
2. **Responsive**: Automatically adapts to viewport changes
3. **Maintains Quality**: Aspect ratio is always correct (8.5:11)
4. **No Overflow**: `maxWidth: '100%'` prevents clipping
5. **Future-Proof**: Uses modern CSS features (aspect-ratio, flexbox)

## Related Components
The fix only affects the preview panel in the edit modal. The actual `ScriptTitlePage` component (lines 61-69 of `ScriptTitlePage.tsx`) already has its own aspect ratio styling and is unaffected.

## Verification
Run the structure test to confirm the fix is in place:
```bash
npx playwright test tests/e2e/title-page-preview-visual.spec.ts -g "verify TitlePageEditForm"
```

Expected output:
```
✓ Preview panel found
✓ Correct CSS applied (h-full)
✓ Old maxWidth removed
✓ CSS fix successfully applied!
```
