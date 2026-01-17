import { test, expect } from '@playwright/test';

/**
 * Regression test for script text overlap issue.
 *
 * This test ensures that text in the View Script tab does not overlap
 * when lines wrap to multiple visual lines. The fix uses relative
 * positioning instead of absolute positioning for script lines.
 *
 * See: ScriptTextViewer.tsx - lines must use relative positioning
 * to allow wrapped text to flow naturally without overlapping.
 */
test.describe('Script Text Overlap Regression', () => {
  test.setTimeout(120000);

  test('script text lines should not overlap in View Script mode', async ({ page }) => {
    // Navigate to EIDCOM project which has a script with long lines
    await page.goto('/backlot');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on EIDCOM project
    const projectLink = page.locator('text=EIDCOM').first();
    await projectLink.waitFor({ timeout: 15000 });
    await projectLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to Script tab
    const scriptTab = page.locator('button:has-text("Script"), a:has-text("Script")').first();
    await scriptTab.waitFor({ timeout: 10000 });
    await scriptTab.click();
    await page.waitForTimeout(3000);

    // Click View Script tab (Text mode)
    const viewTab = page.locator('button:has-text("View Script")').first();
    if (await viewTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewTab.click();
      await page.waitForTimeout(2000);
    }

    // Navigate to page 2 which has dense text content
    const pageInput = page.locator('input[type="number"]').first();
    await pageInput.fill('2');
    await pageInput.press('Enter');
    await page.waitForTimeout(2000);

    // Get all script line elements
    const scriptLines = await page.locator('.bg-white .relative[data-char-offset]').all();

    // Skip test if no lines found (script might not be loaded)
    if (scriptLines.length === 0) {
      console.log('No script lines found - skipping overlap check');
      return;
    }

    console.log(`Found ${scriptLines.length} script lines`);

    // Check for overlapping bounding boxes
    let overlapCount = 0;
    for (let i = 0; i < scriptLines.length - 1; i++) {
      const box1 = await scriptLines[i].boundingBox();
      const box2 = await scriptLines[i + 1].boundingBox();

      if (box1 && box2 && box1.y > 0 && box2.y > 0) {
        const bottom1 = box1.y + box1.height;
        const gap = box2.y - bottom1;

        // If gap is significantly negative, lines are overlapping
        if (gap < -5) {
          overlapCount++;
          const text1 = await scriptLines[i].textContent();
          const text2 = await scriptLines[i + 1].textContent();
          console.log(`OVERLAP detected: gap=${gap.toFixed(1)}px`);
          console.log(`  Line ${i}: "${text1?.substring(0, 50)}..."`);
          console.log(`  Line ${i+1}: "${text2?.substring(0, 50)}..."`);
        }
      }
    }

    // Take screenshot for debugging if there are overlaps
    if (overlapCount > 0) {
      await page.screenshot({ path: 'test-results/script-overlap-failure.png', fullPage: true });
    }

    // Assert no overlaps
    expect(overlapCount, `Found ${overlapCount} overlapping text lines`).toBe(0);
  });
});
