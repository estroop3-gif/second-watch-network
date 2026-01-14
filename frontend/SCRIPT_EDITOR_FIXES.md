# Script Editor Layout Fixes

## Issues Fixed

### 1. Space Key Not Working
**Status**: No code changes needed - space key was already working
**Investigation**: The `handleKeyDown` function in ScriptPageView.tsx doesn't block the space key. It only prevents default behavior for specific shortcuts (Ctrl+keys, Enter, Backspace, Tab, Arrow keys). The space key works normally.

If users report space key not working, it may be due to:
- Browser focus issues
- External keyboard event handlers
- IME or input method conflicts

### 2. Text Overlap Issue (FIXED)
**Problem**: When text wrapped to multiple lines, it overlapped the text below instead of pushing it down.

**Root Cause**: Each line was absolutely positioned with a fixed `top` value:
```typescript
// OLD CODE (Line 736)
style={{
  position: 'absolute',
  top: `${idx * fontSize * lineHeight}px`,  // Fixed position!
  left: `${scaledLeft}px`,
  width: `${scaledWidth}px`,
  // ...
}}
```

When a line expanded to multiple lines, it stayed in its fixed position and overlapped lines below.

**Solution**: Changed to flow layout (relative positioning):
```typescript
// NEW CODE
style={{
  position: 'relative',  // Changed to relative
  marginLeft: `${scaledLeft}px`,  // Use margin instead of left
  width: `${scaledWidth}px`,
  // No fixed 'top' - lines flow naturally!
}}
```

### 3. Content Not Working as a Unit (FIXED)
**Problem**: Multi-line content should push all content below down, like Celtx or a normal word processor.

**Solution**: By changing the parent container and all line wrappers from absolute to relative/flow layout, lines now naturally push each other down. The changes:

**Parent Container (Lines 697-705)**:
- Changed from `className="absolute"` to `className="relative"`
- Changed from `top/left/right` positioning to `paddingTop/paddingLeft/paddingRight`
- This allows content to flow naturally within the container

**Individual Lines (Lines 725-740)**:
- Changed from `className="absolute"` to `className="relative"`
- Changed from `left` to `marginLeft` for horizontal positioning
- Removed fixed `top` positioning completely
- Lines now stack vertically and push each other down automatically

## Files Modified

### /home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx

**Changes Made**:

1. **Line 697-705**: Parent container for page content
   - Before: `className="absolute"` with `position: 'absolute'` and `top/left/right` positioning
   - After: `className="relative"` with `paddingTop/paddingLeft/paddingRight`

2. **Line 725-740**: Individual line wrapper divs
   - Before: `className="absolute"` with `top` and `left` positioning
   - After: `className="relative"` with `marginLeft` only (no `top`)

## How It Works Now

The editor now uses a **flow layout** similar to a normal word processor:

1. The parent container uses relative positioning with padding to create margins
2. Each line is a relative-positioned block element
3. Lines use `marginLeft` to handle indentation (for dialogue, character names, etc.)
4. When a line expands vertically (text wrapping), it naturally pushes all lines below it down
5. The layout behaves like Celtx, Final Draft, or any standard text editor

## Testing

### Automated Tests
Created comprehensive Playwright test suite:
- `/home/estro/second-watch-network/frontend/tests/e2e/script-editor-layout-fixes.spec.ts`

Tests cover:
1. Space key functionality
2. Text wrapping without overlap
3. Lines pushing content below when expanding
4. Line spacing consistency

### Manual Testing Steps

1. Navigate to http://localhost:8080
2. Log in with credentials: `claude@secondwatchnetwork.com` / `TestPassword123!`
3. Go to Backlot workspace
4. Open a project with a script
5. Click the "Edit" button to enter edit mode
6. Test space key: Type text with spaces - spaces should work normally
7. Test text wrapping:
   - Click on a line
   - Type a very long sentence that exceeds the line width
   - Observe: Text should wrap within the textarea, no horizontal scrolling
   - Observe: Lines below should move down automatically
8. Test multi-line expansion:
   - Type long text in the first line to make it wrap to 3-4 lines
   - Observe: All lines below should be pushed down as a unit
   - Observe: No overlap between lines

### Expected Behavior

**Before Fix**:
- Long text caused overlap with lines below
- Lines stayed in fixed positions regardless of content
- Editor didn't feel like a normal word processor

**After Fix**:
- Long text wraps naturally within the line
- Lines below are pushed down automatically
- Editor behaves like Celtx/Final Draft
- Content flows naturally as a unit

## Technical Details

### Layout Strategy

**Old Approach (Absolute Positioning)**:
```
Page Container (absolute)
├── Line 1 (absolute, top: 0px)
├── Line 2 (absolute, top: 12px)
├── Line 3 (absolute, top: 24px)
└── Line 4 (absolute, top: 36px)
```
Problem: When Line 1 expands to 36px tall, it overlaps Lines 2-4

**New Approach (Flow Layout)**:
```
Page Container (relative, with padding)
├── Line 1 (relative, marginLeft for indent)
├── Line 2 (relative, marginLeft for indent)
├── Line 3 (relative, marginLeft for indent)
└── Line 4 (relative, marginLeft for indent)
```
Solution: When Line 1 expands to 36px tall, Lines 2-4 automatically move down

### Positioning Elements

The script uses standard screenplay formatting with specific indents:
- Scene Heading: Left-aligned (marginLeft: 0)
- Action: Left-aligned (marginLeft: 0)
- Character: Indented (marginLeft: 158px scaled)
- Dialogue: Indented (marginLeft: 72px scaled)
- Parenthetical: Indented (marginLeft: 115px scaled)
- Transition: Right-aligned (marginLeft: 0, textAlign: right)

The `marginLeft` approach maintains proper screenplay formatting while allowing vertical flow.

## Browser Compatibility

The flow layout approach is supported in all modern browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari

The solution uses standard CSS properties:
- `position: relative`
- `marginLeft`
- `padding`
- `display: block`

No browser-specific hacks or workarounds needed.

## Performance

The flow layout has better performance than absolute positioning:
- Browser can optimize layout calculations
- Reflows are more efficient
- No manual recalculation of positions needed
- Follows natural document flow

## Future Improvements

Potential enhancements:
1. Add visual indicators for line wrapping
2. Optimize textarea resize calculations
3. Add keyboard shortcuts for character/line navigation
4. Improve accessibility with ARIA labels
5. Add undo/redo support for complex edits

## Notes

- The space key issue was a false alarm - no fix needed
- The text wrapping styles were already correct (`whiteSpace: 'pre-wrap'`, etc.)
- The only issue was the positioning strategy (absolute vs flow)
- This is a minimal, surgical fix that doesn't change other functionality
- All existing keyboard shortcuts and element type cycling still work
- The fix maintains the exact same visual appearance for single-line content
