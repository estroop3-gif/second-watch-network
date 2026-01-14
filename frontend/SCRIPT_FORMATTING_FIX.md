# Script Formatting Fix - Double Indentation Issue

## Problem Description

After recent changes to the script editor, imported scripts were displaying with broken formatting:
- **Character names were pushed all the way to the left** (should be centered at ~266px from page edge)
- **Dialogue formatting was "wonky"** (incorrect indentation)

## Root Cause Analysis

### The Issue
Imported scripts (from PDF or other sources) come with pre-existing indentation in the text content. For example:
```
INT. COFFEE SHOP - DAY

John walks in.

                    JOHN
          Hey, how's it going?
```

The `parseScriptLines` function in `ScriptPageView.tsx` was:
1. Using `detectElementType` with FORGIVING_CONFIG to detect element types based on indentation
2. **Storing the full line INCLUDING leading whitespace** in `ScriptLine.content`
3. Then applying CSS `marginLeft` for positioning during render

This caused **double-indentation**:
```
Content: "                    JOHN"  (20 spaces + "JOHN")
CSS:     marginLeft: 158px
Result:  Character appears at 158px + (width of 20 spaces) = WRONG!
```

### Why This Happened
- The detection logic (FORGIVING_CONFIG) needs the indentation to determine element types
- BUT the rendering logic applies CSS positioning (marginLeft) separately
- We were rendering BOTH the text indentation AND the CSS indentation

## The Fix

**Location**: `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx`

**Line**: ~258 in the `parseScriptLines` function

**Change**: Trim leading whitespace from content before storing it, since positioning is handled by CSS:

```typescript
// BEFORE (broken - double indent):
const type = detectElementType(line, undefined, prevType, false, FORGIVING_CONFIG);
lines.push({ type, content: line, lineIndex: i });  // ← stores line WITH indentation

// AFTER (fixed):
const type = detectElementType(line, undefined, prevType, false, FORGIVING_CONFIG);
const trimmedContent = line.trim();  // ← trim the indentation
lines.push({ type, content: trimmedContent, lineIndex: i });  // ← stores trimmed content
```

## How It Works Now

1. **Detection Phase**: `detectElementType` receives the FULL line with indentation to analyze spacing patterns
   - Character with 20 leading spaces → detected as 'character'
   - Dialogue with 10 leading spaces → detected as 'dialogue'

2. **Storage Phase**: Store the TRIMMED content without indentation
   - `"                    JOHN"` becomes `"JOHN"`
   - `"          Hey there"` becomes `"Hey there"`

3. **Rendering Phase**: Apply CSS positioning via `getElementPosition`
   - Character: `marginLeft: 158px` (266px - 108px page margin)
   - Dialogue: `marginLeft: 72px` (180px - 108px page margin)

Result: Characters appear at the correct position (158px from content edge) without extra spacing from the text.

## Industry Standard Positions

At 72 DPI (PDF standard):
- **Page size**: 8.5" × 11" (612px × 792px)
- **Left margin**: 1.5" (108px) for binding
- **Right margin**: 1" (72px)
- **Content width**: 6" (432px)

Element positions from PAGE left edge:
- Scene Heading: 1.5" (108px)
- Action: 1.5" (108px)
- **Character**: 3.7" (266px) - centered-ish
- **Dialogue**: 2.5" to 6" (180px to 432px)
- Parenthetical: 3.1" to 5.6" (223px to 403px)

Element positions from CONTENT left edge (CSS marginLeft values):
- Scene Heading: 0px
- Action: 0px
- **Character**: 158px (266 - 108)
- **Dialogue**: 72px (180 - 108), width 252px
- Parenthetical: 115px (223 - 108), width 180px

## Testing

Created comprehensive tests in:
- `/home/estro/second-watch-network/frontend/tests/e2e/script-formatting-fix-verification.spec.ts`

All 8 tests passed, verifying:
- ✓ Position calculations are correct (character at 158px, dialogue at 72px)
- ✓ Simulated imported content with indentation is handled correctly
- ✓ Realistic screenplay sample demonstrates the fix
- ✓ Visual regression prevention documented

## Files Modified

1. **ScriptPageView.tsx** (lines 256-261)
   - Modified `parseScriptLines` to trim content before storing
   - Added comments explaining the fix

## Verification Steps

To manually verify the fix:
1. Navigate to Backlot → Open a project with an imported script
2. Click on Scripts tab → View a script
3. Verify:
   - Character names appear centered (not at left edge)
   - Dialogue is indented but not excessively
   - All elements follow standard screenplay formatting

## Technical Details

### Detection Config
The `FORGIVING_CONFIG` in `scriptFormatting.ts` enables:
- Pattern-based detection (INT./EXT., ALL CAPS character names, etc.)
- Indent-based fallback for ambiguous cases
- Used for imported content where indentation hints are valuable

### Position Calculation
The `getElementPosition` function returns:
```typescript
character: { left: 158, width: 274 }
dialogue: { left: 72, width: 252 }
```

These values are scaled by zoom and applied as CSS:
```typescript
const scaledLeft = (position.left * zoom) / 100;
style={{ marginLeft: `${scaledLeft}px` }}
```

## Impact

- ✅ Fixes formatting for ALL imported scripts
- ✅ Character names now appear centered as expected
- ✅ Dialogue formatting is clean and consistent
- ✅ No impact on manually typed scripts (already trimmed during editing)
- ✅ Maintains compatibility with FORGIVING_CONFIG detection

## Future Considerations

- The fix is defensive: it works whether imported content has indentation or not
- If backend import changes to pre-trim content, this will still work correctly
- Detection phase still uses indentation as a hint, which is valuable for PDFs
