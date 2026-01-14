# Script Editing Bug - Visual Explanation

## The Bug: Line Position Shift During Editing

### Before the Fix

```
STORED CONTENT (with indentation):
┌─────────────────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY                          │ ← Scene (0 spaces)
│                                                 │
│ John walks to the counter.                      │ ← Action (0 spaces)
│                                                 │
│                       JOHN                      │ ← Character (22 spaces)
│           Hi, can I get a coffee?               │ ← Dialogue (10 spaces) ← USER EDITS THIS
│                                                 │
│                       BARISTA                   │ ← Character (22 spaces)
│           Coming right up!                      │ ← Dialogue (10 spaces)
└─────────────────────────────────────────────────┘

STEP 1: parseScriptLines() detects types using indentation
        ↓ Detects "Hi, can I get a coffee?" as DIALOGUE (has 10 spaces)
        ↓ Stores trimmed content: "Hi, can I get a coffee?" (no spaces!)

STEP 2: User clicks dialogue line to edit
        ↓ Shows textarea with trimmed content

STEP 3: User types new text: "Actually, make it a tea."
        ↓ updateLine() saves it back

STORED CONTENT AFTER OLD updateLine() (BUG!):
┌─────────────────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY                          │ ← Scene (0 spaces)
│                                                 │
│ John walks to the counter.                      │ ← Action (0 spaces)
│                                                 │
│                       JOHN                      │ ← Character (22 spaces)
│ Actually, make it a tea.                        │ ← DIALOGUE (0 spaces!) ⚠️ LOST INDENTATION!
│                                                 │
│                       BARISTA                   │ ← Character (22 spaces)
│           Coming right up!                      │ ← Dialogue (10 spaces)
└─────────────────────────────────────────────────┘

STEP 4: Content re-parsed by parseScriptLines()
        ↓ detectByIndent() looks at leading spaces
        ↓ "Actually, make it a tea." has 0 spaces
        ↓ Thinks it's ACTION (left-aligned)!

VISUAL RESULT (BUG):
┌─────────────────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY                          │
│                                                 │
│ John walks to the counter.                      │
│                                                 │
│                       JOHN                      │
│ Actually, make it a tea.                        │ ← SHIFTED LEFT! Wrong position!
│                                                 │
│                       BARISTA                   │
│           Coming right up!                      │
└─────────────────────────────────────────────────┘

Lines below also affected - the whole dialogue block breaks!
```

---

### After the Fix

```
STORED CONTENT (with indentation):
┌─────────────────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY                          │ ← Scene (0 spaces)
│                                                 │
│ John walks to the counter.                      │ ← Action (0 spaces)
│                                                 │
│                       JOHN                      │ ← Character (22 spaces)
│           Hi, can I get a coffee?               │ ← Dialogue (10 spaces) ← USER EDITS THIS
│                                                 │
│                       BARISTA                   │ ← Character (22 spaces)
│           Coming right up!                      │ ← Dialogue (10 spaces)
└─────────────────────────────────────────────────┘

STEP 1: parseScriptLines() detects types AND stores original indent
        ↓ Detects "Hi, can I get a coffee?" as DIALOGUE (has 10 spaces)
        ↓ Stores: { content: "Hi, can I get a coffee?", originalIndent: 10 } ✓

STEP 2: User clicks dialogue line to edit
        ↓ Shows textarea with trimmed content

STEP 3: User types new text: "Actually, make it a tea."
        ↓ NEW updateLine() preserves original indentation!

STORED CONTENT AFTER NEW updateLine() (FIXED!):
┌─────────────────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY                          │ ← Scene (0 spaces)
│                                                 │
│ John walks to the counter.                      │ ← Action (0 spaces)
│                                                 │
│                       JOHN                      │ ← Character (22 spaces)
│           Actually, make it a tea.              │ ← DIALOGUE (10 spaces) ✓ INDENTATION PRESERVED!
│                                                 │
│                       BARISTA                   │ ← Character (22 spaces)
│           Coming right up!                      │ ← Dialogue (10 spaces)
└─────────────────────────────────────────────────┘

NEW updateLine() logic:
┌───────────────────────────────────────────────────────────┐
│ const lineData = lines.find(l => l.lineIndex === 5)      │
│ const originalIndent = lineData.originalIndent  // = 10  │
│ const indent = ' '.repeat(10)                            │
│ rawLines[5] = indent + "Actually, make it a tea."        │
│             = "          Actually, make it a tea."       │
└───────────────────────────────────────────────────────────┘

STEP 4: Content re-parsed by parseScriptLines()
        ↓ detectByIndent() looks at leading spaces
        ↓ "          Actually, make it a tea." has 10 spaces
        ↓ Correctly identifies as DIALOGUE! ✓

VISUAL RESULT (FIXED):
┌─────────────────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY                          │
│                                                 │
│ John walks to the counter.                      │
│                                                 │
│                       JOHN                      │
│           Actually, make it a tea.              │ ← CORRECT POSITION! ✓
│                                                 │
│                       BARISTA                   │
│           Coming right up!                      │ ← CORRECT POSITION! ✓
└─────────────────────────────────────────────────┘

All lines maintain correct positions throughout editing!
```

---

## Code Flow Comparison

### OLD (Buggy) updateLine():
```typescript
const updateLine = (lineIndex, newContent) => {
  const rawLines = content.split('\n');
  rawLines[lineIndex] = newContent;  // ⚠️ No indentation!
  onContentChange(rawLines.join('\n'));
}

// Result: "Actually, make it a tea." (0 spaces)
```

### NEW (Fixed) updateLine():
```typescript
const updateLine = (lineIndex, newContent) => {
  const rawLines = content.split('\n');

  // Find original indent
  const lineData = lines.find(l => l.lineIndex === lineIndex);
  const originalIndent = lineData?.originalIndent || 0;

  // Restore indentation
  const indent = ' '.repeat(originalIndent);
  rawLines[lineIndex] = indent + newContent.trim();  // ✓ Preserves indent!

  onContentChange(rawLines.join('\n'));
}

// Result: "          Actually, make it a tea." (10 spaces)
```

---

## Key Insight

The bug occurred because of a **data representation mismatch**:

- **Display Layer**: Uses CSS `marginLeft` for positioning (no actual indentation in text)
- **Storage Layer**: Uses actual leading spaces for element type detection
- **The Gap**: When editing, we lost the indentation during the display→storage transition

The fix bridges this gap by:
1. Capturing original indentation during parsing
2. Restoring indentation during saving
3. Maintaining round-trip integrity

This ensures that the **storage representation** always has correct indentation, even though the **display representation** uses trimmed content with CSS positioning.

---

## Indentation Reference Chart

```
Element Type      Indent   Detection Range   Visual Position
──────────────────────────────────────────────────────────────
Scene Heading        0         0-8 spaces     Left edge
Action              0         0-8 spaces     Left edge
Dialogue           10         8-14 spaces    Indented ~1.4"
Parenthetical      15        12-18 spaces    Indented ~2.1"
Character          22        15-30 spaces    Indented ~3.7"
Transition         40        35+ spaces      Right-aligned

Legend: Indent = spaces added when saving
        Detection Range = what detectByIndent() looks for
        Visual Position = where CSS renders it on page
```

---

## Testing the Fix

Run unit tests:
```bash
npx vitest run tests/unit/script-indentation-preservation.test.ts
```

Run E2E test (requires app running):
```bash
npx playwright test tests/e2e/script-dialogue-editing-bug.spec.ts --headed
```

Build to verify no errors:
```bash
npm run build:dev
```

All tests pass! ✓
