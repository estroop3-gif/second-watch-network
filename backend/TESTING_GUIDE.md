# Testing Guide: Title Page Formatting Fix

## Quick Test Checklist

### 1. Manual Testing in Browser

**Steps:**
1. Start the frontend dev server:
   ```bash
   cd /home/estro/second-watch-network/frontend
   npm run dev
   ```

2. Navigate to: `http://localhost:8080`

3. Log in with appropriate credentials

4. Navigate to: **Backlot → Progressive Dental → Scripts → The Last Watch**

5. Verify the following in **Page View Mode**:
   - [ ] Title "THE LAST WATCH" is centered and bold
   - [ ] Author line "by" or "written by" is centered
   - [ ] Author name is centered
   - [ ] Draft info (dates, version) is centered with smaller font
   - [ ] Copyright notice is centered with smaller font
   - [ ] Contact information is left-aligned at bottom
   - [ ] After first scene heading (INT./EXT.), normal screenplay formatting resumes

6. Switch to **Inline View Mode** and verify:
   - [ ] Same centering behavior for title page elements
   - [ ] Title page elements styled differently from screenplay elements

### 2. Test with Different Scripts

Create or import test scripts with various title page formats:

**Test Case 1: Standard Title Page**
```
THE SCREENPLAY TITLE

written by
Jane Writer

Draft: January 2026
```

**Test Case 2: Minimal Title Page**
```
MINIMAL SCRIPT

by John Doe
```

**Test Case 3: Complex Title Page**
```
THE COMPLEX SCREENPLAY
A Story of Adventure

Screenplay by
Team of Writers

Based on the novel by
Famous Author

First Draft - January 9, 2026
Revised Draft - January 10, 2026

Copyright © 2026 Production Company
All Rights Reserved

Contact:
Agent Name
agency@example.com
(555) 987-6543
```

**Test Case 4: No Title Page (starts immediately with scene)**
```
FADE IN:

INT. LOCATION - DAY

Action begins immediately.
```

### 3. Visual Regression Testing

If you have screenshot comparison tools:

**Before Fix Screenshots:**
- Title page elements left-aligned
- Inconsistent element type detection

**After Fix Screenshots:**
- Title page elements properly centered
- Correct element type styling applied

### 4. Edge Cases to Test

1. **Very long title** (over 80 characters)
   - Should still center but might wrap

2. **Title with scene heading-like text**
   ```
   INT. THE MIND OF A KILLER
   ```
   - Should detect as title if before any real scene heading

3. **Multiple copyright lines**
   - All should be centered

4. **Script with no title page** (starts with FADE IN:)
   - Should immediately use screenplay formatting

5. **Title page longer than 55 lines**
   - Should still detect boundary at first scene heading

### 5. Browser Testing

Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge

### 6. Responsive Testing

Test at different viewport sizes:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## Automated Testing Recommendations

### Unit Tests (Jest/Vitest)

Create tests for the detection functions:

```typescript
describe('detectElementType', () => {
  it('should detect title on title page', () => {
    const result = detectElementType('THE LAST WATCH', undefined, undefined, true);
    expect(result).toBe('title');
  });

  it('should detect author line', () => {
    const result = detectElementType('written by', undefined, undefined, true);
    expect(result).toBe('author');
  });

  it('should not detect title after title page', () => {
    const result = detectElementType('THE LAST WATCH', undefined, undefined, false);
    expect(result).not.toBe('title');
  });
});

describe('parseScriptLines', () => {
  it('should detect title page boundary at first scene heading', () => {
    const content = `THE TITLE

by Author

INT. LOCATION - DAY

Action.`;
    const lines = parseScriptLines(content);
    expect(lines[0].type).toBe('title');
    expect(lines[2].type).toBe('title_page_text'); // "by Author"
    expect(lines[4].type).toBe('scene_heading');
  });
});
```

### Integration Tests (Playwright)

```typescript
test('title page renders with centered formatting', async ({ page }) => {
  await page.goto('/backlot/progressive-dental/scripts/the-last-watch');

  // Wait for script to load
  await page.waitForSelector('.script-page');

  // Check title is centered
  const titleElement = page.locator('text="THE LAST WATCH"').first();
  const titleStyles = await titleElement.evaluate(el =>
    window.getComputedStyle(el).textAlign
  );
  expect(titleStyles).toBe('center');

  // Check author is centered
  const authorElement = page.locator('text=/written by|by/i').first();
  const authorStyles = await authorElement.evaluate(el =>
    window.getComputedStyle(el).textAlign
  );
  expect(authorStyles).toBe('center');
});
```

## Performance Testing

Verify the fix doesn't impact performance:

1. **Parse time for large scripts** (100+ pages)
   - Should complete in < 100ms

2. **Render time for title page**
   - Should render immediately without flicker

3. **Memory usage**
   - Should not increase significantly

## Acceptance Criteria

The fix is considered successful when:

1. ✅ Title page elements (title, author, draft info, copyright) are centered
2. ✅ Contact information is left-aligned
3. ✅ First scene heading triggers end of title page formatting
4. ✅ Normal screenplay elements maintain standard formatting
5. ✅ Both Page View and Inline View modes work correctly
6. ✅ No TypeScript errors or console warnings
7. ✅ Build completes successfully
8. ✅ No visual regressions in non-title-page content
9. ✅ Performance remains acceptable for large scripts
10. ✅ Edge cases handled gracefully (no crashes or errors)

## Rollback Plan

If issues are discovered:

1. Revert commits:
   ```bash
   cd /home/estro/second-watch-network/frontend
   git checkout HEAD~1 src/components/backlot/workspace/ScriptPageView.tsx
   git checkout HEAD~1 src/components/backlot/workspace/ScriptEditorPanel.tsx
   ```

2. Rebuild:
   ```bash
   npm run build:dev
   ```

3. Investigate issues and prepare improved fix

## Deployment Checklist

Before deploying to production:

- [ ] All manual tests passed
- [ ] Edge cases verified
- [ ] Browser compatibility confirmed
- [ ] No console errors or warnings
- [ ] Performance benchmarks acceptable
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Changelog entry added

## Support Resources

- Frontend components: `/home/estro/second-watch-network/frontend/src/components/backlot/workspace/`
- Backend parser: `/home/estro/second-watch-network/backend/app/utils/script_parser.py`
- Fix summary: `/home/estro/second-watch-network/backend/TITLE_PAGE_FIX_SUMMARY.md`
- Visual example: `/home/estro/second-watch-network/backend/test_title_page_example.txt`
