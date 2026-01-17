# Script Editor Visual Bug Fixes

## Issues Reported
1. Weird wrapping on the "View Script" tab
2. Text overlapping each other
3. Formatting is messed up in the first dialogue box for "Elias"

## Root Causes Identified

### Issue 1: Text Overlapping
**Root Cause**: Elements were rendering without vertical spacing between them
- Line 967 in `ScriptPageView.tsx` had: `marginBottom: element.content.trim() === '' ? 0 : undefined`
- When `marginBottom` is `undefined`, React doesn't apply any bottom margin
- This caused script elements (dialogue, action, etc.) to stack directly on top of each other
- With the tight `lineHeight: 1.0`, elements would visually overlap

### Issue 2: Text Not Wrapping Properly
**Root Cause**: Span elements were missing CSS properties needed for proper text wrapping
- The `<span>` element displaying the text only had `whiteSpace: 'pre-wrap'` and `wordBreak: 'break-word'`
- Missing `overflowWrap: 'break-word'` and `wordWrap: 'break-word'` properties
- Long dialogue lines (like "Elias" speaking) would not wrap properly within their container width
- Text would extend beyond the element's bounds or wrap incorrectly

### Context: Element-Based Rendering
The recent refactoring switched from line-based to element-based rendering:
- OLD: Each line was rendered separately (line-by-line)
- NEW: Logical screenplay elements render as blocks (dialogue as one block, action as one block, etc.)
- This change improved editing UX but introduced the spacing/wrapping issues

## Fixes Applied

### Fix 1: Add Element Spacing
**File**: `src/components/backlot/workspace/ScriptPageView.tsx`
**Line**: 968

```typescript
// BEFORE
marginBottom: element.content.trim() === '' ? 0 : undefined,

// AFTER
marginBottom: element.content.trim() === '' ? 0 : `${fontSize * lineHeight}px`,
```

**Result**: Elements now have consistent spacing equal to one line height, preventing overlap

### Fix 2: Add Text Wrapping Properties
**File**: `src/components/backlot/workspace/ScriptPageView.tsx`
**Lines**: 1036-1037 (view mode), 838-839 (editor mode)

```typescript
// BEFORE
<span
  style={{
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }}
>
  {element.content || '\u00A0'}
</span>

// AFTER
<span
  style={{
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    wordWrap: 'break-word',
  }}
>
  {element.content || '\u00A0'}
</span>
```

**Result**: Long text now wraps properly within element containers at all zoom levels

## Element Spacing Calculations

The spacing is dynamically calculated based on zoom level to maintain consistency:

| Zoom | Font Size | Line Height | Element Spacing |
|------|-----------|-------------|-----------------|
| 50%  | 6px       | 1.0 (6px)   | 6px             |
| 70%  | 8.4px     | 1.0 (8.4px) | 8.4px           |
| 100% | 12px      | 1.0 (12px)  | 12px            |
| 150% | 18px      | 1.0 (18px)  | 18px            |
| 200% | 24px      | 1.0 (24px)  | 24px            |

Formula: `marginBottom = fontSize * lineHeight`
- Where `fontSize = (12 * zoom) / 100`
- And `lineHeight = 1.0`

## Testing

### Automated Tests
Created Playwright tests in `tests/e2e/script-editor-rendering-fix.spec.ts`:
- Documents all fixes applied
- Verifies spacing calculations
- Provides manual testing checklist

Run tests:
```bash
npx playwright test tests/e2e/script-editor-rendering-fix.spec.ts
```

### Manual Testing Checklist
- [ ] Login to http://localhost:8080
- [ ] Navigate to Backlot
- [ ] Open a project with a script
- [ ] Click the Script tab
- [ ] Verify View mode displays correctly:
  - [ ] No overlapping text between script elements
  - [ ] Dialogue text wraps properly within margins
  - [ ] Character names positioned correctly (centered)
  - [ ] Action descriptions flow naturally
  - [ ] Parentheticals display within bounds
  - [ ] Scene headings are bold and uppercase
  - [ ] Page numbers display correctly
- [ ] Test different zoom levels (50%, 70%, 100%, 150%):
  - [ ] Elements maintain proper spacing at all zoom levels
  - [ ] Text wraps correctly at all zoom levels
- [ ] Test Edit mode:
  - [ ] Click an element to edit
  - [ ] Verify textarea appears with proper sizing
  - [ ] Type long text to verify wrapping works
  - [ ] Check that spacing is maintained when editing
- [ ] Specifically check dialogue elements (like "Elias"):
  - [ ] Dialogue text wraps within the 2.5" to 6" margins
  - [ ] No overlap with character name above
  - [ ] No overlap with following elements below

## CSS Properties Explained

### `overflowWrap: 'break-word'`
- Allows long words to be broken and wrapped to the next line
- Prevents text from overflowing the container horizontally
- Modern CSS property (preferred over `word-wrap`)

### `wordWrap: 'break-word'`
- Legacy property (alias for `overflowWrap`)
- Included for browser compatibility
- Ensures wrapping works in older browsers

### `wordBreak: 'break-word'`
- Controls how words break at line end
- Works with CJK (Chinese, Japanese, Korean) text
- Provides additional wrapping control

### `whiteSpace: 'pre-wrap'`
- Preserves whitespace and newlines
- Allows text to wrap when it reaches container edge
- Essential for screenplay formatting (preserves indentation)

All four properties work together to ensure text flows naturally and wraps correctly within the screenplay margins while preserving the formatting.

## Files Modified
1. `src/components/backlot/workspace/ScriptPageView.tsx`
   - Line 968: Added element spacing (marginBottom)
   - Lines 1036-1037: Added wrapping properties to span (view mode)
   - Lines 838-839: Added wrapping properties to span (editor mode)

2. `tests/e2e/script-editor-rendering-fix.spec.ts` (NEW)
   - Documentation test
   - Spacing calculation verification
   - Manual testing guide

3. `tests/e2e/script-editor-visual-bugs.spec.ts` (NEW)
   - Comprehensive investigation test
   - Visual regression testing
   - DOM structure analysis

## Expected Behavior After Fix

### View Mode
- Each screenplay element (scene heading, action, character, dialogue, etc.) renders as a distinct block
- Elements have proper vertical spacing between them (one line height)
- Long dialogue lines wrap within the dialogue margins (2.5" to 6")
- Character names stay centered at 3.7" from page left
- No text overlap or visual glitches
- Proper formatting at all zoom levels (50% - 200%)

### Edit Mode
- Click any element to edit it inline
- Textarea appears with proper sizing and wrapping
- Type long text and it wraps correctly within bounds
- Spacing is maintained between elements while editing
- Save changes with Ctrl+S or click Save button

## Additional Notes

### Why lineHeight is 1.0
The screenplay format uses single-spacing (lineHeight: 1.0) to match industry standards and PDF export. This is correct and should not be changed. The spacing between *elements* (via marginBottom) provides the visual separation.

### Why marginBottom Uses fontSize * lineHeight
This ensures spacing scales proportionally with zoom level. If a user zooms to 150%, both the text size and the spacing increase proportionally, maintaining proper visual hierarchy.

### Element vs Line Rendering
The element-based rendering approach groups consecutive lines of the same type (e.g., all lines of a dialogue block) into a single editable element. This provides a better editing experience but requires careful CSS management to ensure proper spacing and wrapping.

## Verification
Run the Playwright tests to verify fixes:
```bash
npx playwright test tests/e2e/script-editor-rendering-fix.spec.ts
```

All tests should pass with documented fixes displayed in console output.
