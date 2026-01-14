# Bug Fix: Script Dialogue Line Position Shift During Editing

## Issue Summary

**Bug Report**: When typing in a dialogue field in the script editor, lines below it shift position to the left incorrectly.

**Status**: FIXED

**Affected Component**: `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx`

**Date**: 2026-01-09

---

## Root Cause Analysis

### The Problem

The script editor uses a sophisticated dual-mode detection system for screenplay elements:

1. **Import/Display Mode** (`FORGIVING_CONFIG`): Uses indentation + pattern matching to detect element types
2. **Editing Mode**: Displays content without indentation (trimmed) because CSS handles positioning

The bug occurred in the **edit-save-reparse cycle**:

```
1. User clicks dialogue line → Line displayed with trimmed content
2. User types new text → updateLine() saves trimmed content back
3. Content re-parsed → parseScriptLines() detects element types using indentation
4. Problem: Saved content has NO indentation
5. Result: detectByIndent() misidentifies dialogue as "action" (left-aligned)
6. Lines below render with wrong positioning (shifted left)
```

### Technical Details

The `detectByIndent()` function in `scriptFormatting.ts` uses specific indentation ranges:

```typescript
- Left-aligned (0-8 spaces):   scene_heading, action
- Dialogue (8-14 spaces):       dialogue
- Parenthetical (12-18 spaces): parenthetical
- Character (15-30 spaces):     character
- Right-aligned (35+ spaces):   transition
```

When `updateLine()` saved trimmed content (0 leading spaces), the re-parser interpreted dialogue lines as "action" elements, causing the visual shift.

---

## The Fix

### Changes Made

#### 1. Extended `ScriptLine` Interface

**File**: `ScriptPageView.tsx` (line 80-85)

```typescript
interface ScriptLine {
  type: ScriptElementType;
  content: string;
  lineIndex: number;
  originalIndent?: number; // NEW: Preserve original indentation for editing
}
```

#### 2. Store Original Indentation During Parsing

**File**: `ScriptPageView.tsx` (line 260-266)

```typescript
lines.push({
  type,
  content: trimmedContent,
  lineIndex: i,
  // Store original indentation so we can preserve it during editing
  originalIndent: line.length - line.trimStart().length
});
```

#### 3. Added `getElementIndent()` Helper Function

**File**: `ScriptPageView.tsx` (line 231-260)

```typescript
function getElementIndent(type: ScriptElementType): number {
  switch (type) {
    case 'scene_heading':
    case 'action':
    case 'general':
    case 'shot':
      return 0; // Left-aligned
    case 'dialogue':
      return 10; // 10 spaces - within dialogue range (8-14)
    case 'parenthetical':
      return 15; // 15 spaces - within parenthetical range (12-18)
    case 'character':
      return 22; // 22 spaces - within character range (15-30)
    case 'transition':
      return 40; // 40 spaces - right-aligned (35+)
    // ... other cases
  }
}
```

#### 4. Updated `updateLine()` to Preserve Indentation

**File**: `ScriptPageView.tsx` (line 409-423)

```typescript
const updateLine = useCallback((lineIndex: number, newContent: string) => {
  const rawLines = content.split('\n');

  // Find the original indent for this line
  const lineData = lines.find(l => l.lineIndex === lineIndex);
  const originalIndent = lineData?.originalIndent || 0;

  // Preserve the original indentation when updating
  // This is crucial to prevent re-detection from changing element types
  const indent = ' '.repeat(originalIndent);
  rawLines[lineIndex] = indent + newContent.trim();

  onContentChange?.(rawLines.join('\n'));
}, [content, onContentChange, lines]);
```

#### 5. Updated `insertLine()` to Add Proper Indentation

**File**: `ScriptPageView.tsx` (line 456-467)

```typescript
const insertLine = useCallback((afterIndex: number, newContent: string = '') => {
  const rawLines = content.split('\n');

  // Determine appropriate indentation for the new line based on currentElementType
  const indent = getElementIndent(currentElementType);
  const indentedContent = ' '.repeat(indent) + newContent.trim();

  rawLines.splice(afterIndex + 1, 0, indentedContent);
  onContentChange?.(rawLines.join('\n'));
  setEditingLineIndex(afterIndex + 1);
}, [content, onContentChange, currentElementType]);
```

#### 6. Updated `formatAsElement()` to Add Indentation

**File**: `ScriptPageView.tsx` (line 548-550)

```typescript
// Add proper indentation for the new element type
const indent = getElementIndent(elementType);
rawLines[lineIndex] = ' '.repeat(indent) + formattedContent;
```

---

## Testing

### Unit Tests Created

**File**: `/home/estro/second-watch-network/frontend/tests/unit/script-indentation-preservation.test.ts`

All 6 unit tests pass, covering:
- Dialogue indentation preservation (10 spaces)
- Character indentation preservation (22 spaces)
- Parenthetical indentation preservation (15 spaces)
- Action indentation preservation (0 spaces)
- Multi-line script content with mixed indentations
- Demonstration of bug vs. fix comparison

### Test Results

```
✓ tests/unit/script-indentation-preservation.test.ts (6 tests) 4ms

Test Files  1 passed (1)
     Tests  6 passed (6)
  Duration  353ms
```

### E2E Test Created

**File**: `/home/estro/second-watch-network/frontend/tests/e2e/script-dialogue-editing-bug.spec.ts`

Comprehensive end-to-end test that:
1. Logs into the application
2. Navigates to Backlot workspace
3. Opens a project with a script
4. Activates edit mode
5. Clicks on a dialogue line
6. Types new content
7. Measures line positions before and after editing
8. Verifies no horizontal shifts occurred

---

## Verification Checklist

- [x] Build succeeds without errors
- [x] Unit tests pass (6/6)
- [x] Code follows existing patterns
- [x] Indentation preserved for all element types
- [x] No TypeScript errors
- [x] Fix applies to all edit operations (update, insert, format)

---

## Impact Assessment

### Before Fix
- Editing any indented element (dialogue, character, parenthetical) caused visual bugs
- Lines below would shift left unexpectedly
- User experience was confusing and broken
- Re-detection logic incorrectly classified elements

### After Fix
- All indentation is preserved through edit-save-reparse cycle
- Lines maintain correct positions during editing
- Element type detection remains accurate
- User experience is smooth and predictable

---

## Files Modified

1. `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx`
   - Extended `ScriptLine` interface
   - Added `getElementIndent()` helper
   - Updated `parseScriptLines()` to store original indentation
   - Updated `updateLine()` to preserve indentation
   - Updated `insertLine()` to add proper indentation
   - Updated `formatAsElement()` to add proper indentation

## Files Created

1. `/home/estro/second-watch-network/frontend/tests/unit/script-indentation-preservation.test.ts`
   - Unit tests for indentation preservation logic

2. `/home/estro/second-watch-network/frontend/tests/e2e/script-dialogue-editing-bug.spec.ts`
   - End-to-end test for the complete user flow

3. `/home/estro/second-watch-network/frontend/docs/BUG-FIX-SCRIPT-DIALOGUE-POSITION-SHIFT.md`
   - This documentation

---

## Technical Notes

### Indentation Standards

The fix uses standard screenplay indentation values that match industry software:

| Element Type   | Indent (spaces) | Range Used by Detector |
|----------------|-----------------|------------------------|
| Scene Heading  | 0               | 0-8                    |
| Action         | 0               | 0-8                    |
| Dialogue       | 10              | 8-14                   |
| Parenthetical  | 15              | 12-18                  |
| Character      | 22              | 15-30                  |
| Transition     | 40              | 35+                    |

### Why This Approach Works

1. **Separation of Concerns**: Display formatting (CSS) is separate from data storage (indented text)
2. **Round-trip Integrity**: Content maintains its structure through parse → edit → save → reparse
3. **Backward Compatibility**: Imported scripts retain their original indentation
4. **Forward Compatibility**: New lines get correct indentation for their type

### Alternative Approaches Considered

1. **Store element type in metadata**: Would require separate tracking and synchronization
2. **Use strict pattern-only detection**: Would break imported scripts with inconsistent formatting
3. **Remove indent-based detection**: Would reduce accuracy for ambiguous cases

The chosen solution (preserve original indentation) is the simplest and most robust.

---

## Deployment Notes

- No database migrations required
- No API changes required
- Frontend-only fix
- Safe to deploy immediately
- No breaking changes to existing data

---

## Related Code

- `/home/estro/second-watch-network/frontend/src/utils/scriptFormatting.ts` - Element detection logic
- `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx` - Script editor component

---

## Future Improvements

1. Consider adding visual indicators for element types during editing
2. Add keyboard shortcuts for changing element types
3. Implement auto-format on paste for imported content
4. Add element type tooltips for new users
5. Consider adding undo/redo for formatting changes
