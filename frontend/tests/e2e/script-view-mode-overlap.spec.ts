/**
 * Script View Mode Text Overlapping Investigation
 *
 * This test investigates the reported issue where text overlaps in "View Script" mode
 * but displays correctly in "Edit Script" mode.
 *
 * The specific dialogue text that overlaps:
 * "We don't worship golden calves anymore. We worship comfort. We worship screens.
 * Our altars are digital, our prayers silent. We traded prophets for algorithms,
 * and somewhere along the way, we forgot we were at war"
 *
 * Expected behavior:
 * - View mode: Text should flow naturally without overlapping
 * - Edit mode: Text displays correctly (baseline)
 *
 * Suspected issue in ScriptPageView.tsx renderPage function:
 * - Elements might not have proper height calculation
 * - Elements might be positioned absolutely instead of flowing
 * - The spacing/margin between elements might be wrong
 */
import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'claude@secondwatchnetwork.com',
  password: 'TestPassword123!'
};

const SCREENSHOT_DIR = '/tmp/script-overlap-investigation/';

test.describe('Script View Mode Text Overlapping', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:8080/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('investigate text overlap in View mode vs Edit mode', async ({ page }) => {
    console.log('\n=== STEP 1: Navigate to Backlot Project with Script ===');

    // Navigate to Backlot
    const backlotLink = page.locator('a:has-text("Backlot"), button:has-text("Backlot")').first();
    await backlotLink.click();
    await page.waitForLoadState('networkidle');

    // Open first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="project"]').first();
    await projectCard.waitFor({ state: 'visible', timeout: 10000 });
    await projectCard.click();
    await page.waitForLoadState('networkidle');

    console.log('\n=== STEP 2: Navigate to Script Tab ===');
    const scriptTab = page.locator('button:has-text("Script"), a:has-text("Script")').first();
    await scriptTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('\n=== STEP 3: Ensure we are in View Mode ===');
    // Look for Edit button (indicates we're in view mode)
    const editButton = page.locator('button:has-text("Edit")').first();
    const isViewMode = await editButton.isVisible().catch(() => false);

    if (!isViewMode) {
      // We're in edit mode, need to cancel/save to get back to view mode
      const cancelButton = page.locator('button:has-text("Cancel")');
      const saveButton = page.locator('button:has-text("Save")');

      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
        await page.waitForTimeout(500);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}01-view-mode-initial.png`, fullPage: true });

    console.log('\n=== STEP 4: Find the Problematic Dialogue Text ===');
    // Search for the specific text that was reported to overlap
    const dialogueText = 'We don\'t worship golden calves anymore';

    // Find all script elements
    const scriptElements = page.locator('div.relative.cursor-text');
    const elementCount = await scriptElements.count();
    console.log(`Found ${elementCount} script elements`);

    let problematicElementIndex = -1;
    for (let i = 0; i < elementCount; i++) {
      const element = scriptElements.nth(i);
      const text = await element.textContent();
      if (text?.includes(dialogueText)) {
        problematicElementIndex = i;
        console.log(`Found problematic dialogue at element index ${i}`);
        console.log(`Full text: ${text}`);
        break;
      }
    }

    console.log('\n=== STEP 5: Analyze Element Positioning in View Mode ===');

    // Get all element positions and heights
    const viewModePositions = await scriptElements.evaluateAll((elements) => {
      return elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const span = el.querySelector('span');
        const textarea = el.querySelector('textarea');
        const computed = window.getComputedStyle(el);

        return {
          index,
          text: el.textContent?.substring(0, 50) || '',
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          height: rect.height,
          width: rect.width,
          marginBottom: computed.marginBottom,
          marginLeft: computed.marginLeft,
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          minHeight: computed.minHeight,
          hasSpan: !!span,
          hasTextarea: !!textarea,
          isEditing: !!textarea,
          spanHeight: span?.getBoundingClientRect().height || null,
          display: computed.display,
          position: computed.position,
          whiteSpace: computed.whiteSpace,
          wordBreak: computed.wordBreak,
        };
      });
    });

    // Check for overlaps
    console.log('\nChecking for overlaps in View Mode:');
    let overlapsFound = 0;
    const overlappingPairs = [];

    for (let i = 0; i < viewModePositions.length - 1; i++) {
      const current = viewModePositions[i];
      const next = viewModePositions[i + 1];

      // Check vertical overlap (current bottom should be above next top)
      const overlap = current.bottom - next.top;
      if (overlap > 0) {
        overlapsFound++;
        overlappingPairs.push({ index: i, overlap });
        console.log(`\n⚠️ OVERLAP #${overlapsFound}:`);
        console.log(`  Element ${i}: "${current.text}"`);
        console.log(`    Bottom: ${current.bottom}px, Height: ${current.height}px`);
        console.log(`    marginBottom: ${current.marginBottom}, minHeight: ${current.minHeight}`);
        console.log(`  Element ${i + 1}: "${next.text}"`);
        console.log(`    Top: ${next.top}px`);
        console.log(`  Overlap: ${overlap}px`);
      }
    }

    console.log(`\nTotal overlaps in View Mode: ${overlapsFound}`);

    // Detailed analysis of the problematic dialogue element
    if (problematicElementIndex >= 0) {
      const problematicData = viewModePositions[problematicElementIndex];
      console.log('\n=== Problematic Dialogue Element Analysis ===');
      console.log(JSON.stringify(problematicData, null, 2));

      // Take screenshot of just this element
      const problematicElement = scriptElements.nth(problematicElementIndex);
      await problematicElement.screenshot({
        path: `${SCREENSHOT_DIR}02-problematic-dialogue-view-mode.png`
      });

      // Also check elements before and after
      if (problematicElementIndex > 0) {
        console.log('\nElement BEFORE:');
        console.log(JSON.stringify(viewModePositions[problematicElementIndex - 1], null, 2));
      }
      if (problematicElementIndex < viewModePositions.length - 1) {
        console.log('\nElement AFTER:');
        console.log(JSON.stringify(viewModePositions[problematicElementIndex + 1], null, 2));
      }
    }

    console.log('\n=== STEP 6: Switch to Edit Mode ===');
    const startEditButton = page.locator('button:has-text("Edit")').first();
    await startEditButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}03-edit-mode-initial.png`, fullPage: true });

    console.log('\n=== STEP 7: Analyze Element Positioning in Edit Mode ===');

    // Get element positions in edit mode
    const editModePositions = await scriptElements.evaluateAll((elements) => {
      return elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const span = el.querySelector('span');
        const textarea = el.querySelector('textarea');
        const computed = window.getComputedStyle(el);

        return {
          index,
          text: el.textContent?.substring(0, 50) || '',
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          marginBottom: computed.marginBottom,
          minHeight: computed.minHeight,
          hasSpan: !!span,
          hasTextarea: !!textarea,
          textareaHeight: textarea?.getBoundingClientRect().height || null,
          spanHeight: span?.getBoundingClientRect().height || null,
        };
      });
    });

    // Check for overlaps in edit mode
    console.log('\nChecking for overlaps in Edit Mode:');
    let editOverlaps = 0;

    for (let i = 0; i < editModePositions.length - 1; i++) {
      const current = editModePositions[i];
      const next = editModePositions[i + 1];

      const overlap = current.bottom - next.top;
      if (overlap > 0) {
        editOverlaps++;
        console.log(`\n⚠️ EDIT MODE OVERLAP #${editOverlaps}:`);
        console.log(`  Element ${i}: "${current.text}"`);
        console.log(`    Bottom: ${current.bottom}px, Height: ${current.height}px`);
        console.log(`  Element ${i + 1}: "${next.text}"`);
        console.log(`    Top: ${next.top}px`);
        console.log(`  Overlap: ${overlap}px`);
      }
    }

    console.log(`\nTotal overlaps in Edit Mode: ${editOverlaps}`);

    // Compare the problematic element between modes
    if (problematicElementIndex >= 0) {
      console.log('\n=== Comparing Problematic Element: View vs Edit ===');
      const viewData = viewModePositions[problematicElementIndex];
      const editData = editModePositions[problematicElementIndex];

      console.log('\nView Mode:');
      console.log(`  Height: ${viewData.height}px`);
      console.log(`  marginBottom: ${viewData.marginBottom}`);
      console.log(`  minHeight: ${viewData.minHeight}`);
      console.log(`  spanHeight: ${viewData.spanHeight}px`);
      console.log(`  hasTextarea: ${viewData.hasTextarea}`);

      console.log('\nEdit Mode:');
      console.log(`  Height: ${editData.height}px`);
      console.log(`  marginBottom: ${editData.marginBottom}`);
      console.log(`  minHeight: ${editData.minHeight}`);
      console.log(`  textareaHeight: ${editData.textareaHeight}px`);
      console.log(`  hasTextarea: ${editData.hasTextarea}`);

      console.log('\nDifferences:');
      console.log(`  Height difference: ${Math.abs(viewData.height - editData.height)}px`);
    }

    console.log('\n=== STEP 8: Inspect Span vs Textarea Rendering ===');

    // Click on the problematic element to activate editing
    if (problematicElementIndex >= 0) {
      const problematicElement = scriptElements.nth(problematicElementIndex);
      await problematicElement.click();
      await page.waitForTimeout(500);

      // Take screenshot of editing state
      await page.screenshot({
        path: `${SCREENSHOT_DIR}04-editing-problematic-dialogue.png`,
        fullPage: true
      });

      // Get detailed textarea vs span comparison
      const editingDetails = await problematicElement.evaluate((el) => {
        const span = el.querySelector('span');
        const textarea = el.querySelector('textarea');
        const computed = window.getComputedStyle(el);

        const spanComputed = span ? window.getComputedStyle(span) : null;
        const textareaComputed = textarea ? window.getComputedStyle(textarea) : null;

        return {
          container: {
            height: el.getBoundingClientRect().height,
            marginBottom: computed.marginBottom,
            lineHeight: computed.lineHeight,
          },
          span: span ? {
            height: span.getBoundingClientRect().height,
            display: spanComputed?.display,
            whiteSpace: spanComputed?.whiteSpace,
            wordBreak: spanComputed?.wordBreak,
          } : null,
          textarea: textarea ? {
            height: textarea.getBoundingClientRect().height,
            scrollHeight: (textarea as HTMLTextAreaElement).scrollHeight,
            display: textareaComputed?.display,
            whiteSpace: textareaComputed?.whiteSpace,
            wordBreak: textareaComputed?.wordBreak,
            overflow: textareaComputed?.overflow,
          } : null,
        };
      });

      console.log('\nEditing State Details:');
      console.log(JSON.stringify(editingDetails, null, 2));
    }

    console.log('\n=== STEP 9: Test Side-by-Side Comparison ===');

    // Cancel editing to return to view mode
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Take final comparison screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}05-back-to-view-mode.png`,
      fullPage: true
    });

    console.log('\n=== STEP 10: Root Cause Analysis ===');

    // Analyze the renderPage function's span rendering
    const spanAnalysis = await page.evaluate(() => {
      // Find all span elements (view mode rendering)
      const spans = Array.from(document.querySelectorAll('div.relative.cursor-text span'));

      return spans.map((span, index) => {
        const parent = span.parentElement;
        const parentComputed = parent ? window.getComputedStyle(parent) : null;
        const spanComputed = window.getComputedStyle(span);
        const spanRect = span.getBoundingClientRect();
        const parentRect = parent?.getBoundingClientRect();

        const text = span.textContent || '';
        const isLongText = text.length > 80;

        return {
          index,
          textLength: text.length,
          textPreview: text.substring(0, 40),
          isLongText,
          span: {
            height: spanRect.height,
            display: spanComputed.display,
            whiteSpace: spanComputed.whiteSpace,
            wordBreak: spanComputed.wordBreak,
            overflowWrap: spanComputed.overflowWrap,
          },
          parent: parentComputed ? {
            height: parentRect?.height,
            marginBottom: parentComputed.marginBottom,
            lineHeight: parentComputed.lineHeight,
            minHeight: parentComputed.minHeight,
          } : null,
          heightMismatch: parentRect && Math.abs(spanRect.height - parentRect.height) > 2,
        };
      }).filter(item => item.isLongText); // Focus on long text that wraps
    });

    console.log('\nSpan Analysis (long text only):');
    spanAnalysis.forEach(item => {
      console.log(`\nElement ${item.index}:`);
      console.log(`  Text: "${item.textPreview}..." (${item.textLength} chars)`);
      console.log(`  Span height: ${item.span.height}px`);
      console.log(`  Parent height: ${item.parent?.height}px`);
      console.log(`  Parent marginBottom: ${item.parent?.marginBottom}`);
      console.log(`  Parent minHeight: ${item.parent?.minHeight}`);
      console.log(`  Height mismatch: ${item.heightMismatch ? '⚠️ YES' : 'No'}`);
    });

    console.log('\n=== Test Complete ===');
    console.log(`\nSummary:`);
    console.log(`  Overlaps in View Mode: ${overlapsFound}`);
    console.log(`  Overlaps in Edit Mode: ${editOverlaps}`);
    console.log(`  Screenshots saved to: ${SCREENSHOT_DIR}`);

    // Assertions
    expect(overlapsFound).toBeLessThan(editOverlaps + 1); // View mode should have no more overlaps than edit mode
  });

  test('analyze marginBottom calculation', async ({ page }) => {
    console.log('\n=== Margin Bottom Calculation Analysis ===');

    // Navigate to script
    await page.locator('a:has-text("Backlot"), button:has-text("Backlot")').first().click();
    await page.waitForLoadState('networkidle');
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="project"]').first();
    await projectCard.click();
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("Script"), a:has-text("Script")').first().click();
    await page.waitForTimeout(1000);

    // Analyze the marginBottom calculation logic
    const marginAnalysis = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div.relative.cursor-text'));

      return elements.map((el, index) => {
        const computed = window.getComputedStyle(el);
        const text = el.textContent?.trim() || '';
        const fontSize = parseFloat(computed.fontSize);
        const lineHeight = parseFloat(computed.lineHeight);
        const marginBottom = computed.marginBottom;

        // According to line 970 in ScriptPageView.tsx:
        // marginBottom: element.content.trim() === '' ? 0 : `${fontSize * lineHeight}px`
        const expectedMargin = text === '' ? 0 : fontSize * lineHeight;

        return {
          index,
          textPreview: text.substring(0, 30),
          isEmpty: text === '',
          fontSize,
          lineHeight,
          calculatedMargin: expectedMargin,
          actualMargin: marginBottom,
          match: marginBottom === `${expectedMargin}px` || (expectedMargin === 0 && marginBottom === '0px'),
        };
      });
    });

    console.log('\nMargin Bottom Analysis:');
    marginAnalysis.forEach(item => {
      if (!item.match) {
        console.log(`\n⚠️ Margin mismatch at element ${item.index}:`);
        console.log(`  Text: "${item.textPreview}"`);
        console.log(`  Expected: ${item.calculatedMargin}px`);
        console.log(`  Actual: ${item.actualMargin}`);
      }
    });

    const mismatches = marginAnalysis.filter(item => !item.match);
    console.log(`\nTotal margin mismatches: ${mismatches.length}`);
  });
});
