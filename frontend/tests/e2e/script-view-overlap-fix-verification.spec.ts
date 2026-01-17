/**
 * Script View Mode Overlap Fix Verification
 *
 * This test verifies the fix for text overlapping in the Script tab's "View Script" mode.
 *
 * Issue: Text overlapped in View mode but displayed correctly in Edit mode
 * Root Cause: Fixed marginBottom of fontSize * lineHeight (one line) didn't account for
 *             multi-line wrapped content in span elements
 * Fix: Set marginBottom to 0, allowing elements to flow naturally
 *
 * File: /home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx
 * Line: 971 (previously line 970)
 */
import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'claude@secondwatchnetwork.com',
  password: 'TestPassword123!'
};

test.describe('Script View Mode Overlap Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:8080/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to Backlot
    const backlotLink = page.locator('a:has-text("Backlot"), button:has-text("Backlot")').first();
    await backlotLink.click();
    await page.waitForLoadState('networkidle');

    // Open first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="project"]').first();
    await projectCard.waitFor({ state: 'visible', timeout: 10000 });
    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Go to Script tab
    const scriptTab = page.locator('button:has-text("Script"), a:has-text("Script")').first();
    await scriptTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('verify no text overlapping in View mode', async ({ page }) => {
    console.log('\n=== Verifying Script View Mode Overlap Fix ===');

    // Ensure we're in View mode (not editing)
    const editButton = page.locator('button:has-text("Edit")').first();
    const isViewMode = await editButton.isVisible().catch(() => false);

    if (!isViewMode) {
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Get all script elements
    const scriptElements = page.locator('div.relative.cursor-text');
    const elementCount = await scriptElements.count();
    console.log(`Found ${elementCount} script elements`);

    // Check for overlaps
    const positions = await scriptElements.evaluateAll((elements) => {
      return elements.map((el) => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          marginBottom: computed.marginBottom,
          text: el.textContent?.substring(0, 40) || '',
        };
      });
    });

    let overlapsFound = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const current = positions[i];
      const next = positions[i + 1];

      const overlap = current.bottom - next.top;
      if (overlap > 1) { // Allow 1px tolerance for rounding
        overlapsFound++;
        console.log(`\nOverlap detected:`);
        console.log(`  Element ${i}: "${current.text}"`);
        console.log(`    Bottom: ${current.bottom}px`);
        console.log(`  Element ${i + 1}: "${next.text}"`);
        console.log(`    Top: ${next.top}px`);
        console.log(`  Overlap: ${overlap}px`);
      }
    }

    console.log(`\nTotal overlaps found: ${overlapsFound}`);

    // Verify marginBottom is 0 (the fix)
    const marginBottoms = await scriptElements.evaluateAll((elements) => {
      return elements.map((el) => {
        const computed = window.getComputedStyle(el);
        return computed.marginBottom;
      });
    });

    const nonZeroMargins = marginBottoms.filter(m => m !== '0px' && m !== '0');
    console.log(`Elements with non-zero marginBottom: ${nonZeroMargins.length}`);
    if (nonZeroMargins.length > 0) {
      console.log('Non-zero margins:', nonZeroMargins);
    }

    // Take screenshot for visual verification
    await page.screenshot({ path: '/tmp/script-view-no-overlap.png', fullPage: true });

    // Assertions
    expect(overlapsFound).toBe(0);
    expect(nonZeroMargins.length).toBe(0); // All should have marginBottom: 0
  });

  test('verify specific dialogue text renders correctly', async ({ page }) => {
    console.log('\n=== Verifying Specific Dialogue Text ===');

    // Look for the reported problematic dialogue
    const dialogueText = 'We don\'t worship golden calves anymore';
    const allText = await page.textContent('body');

    if (allText?.includes(dialogueText)) {
      console.log('Found the problematic dialogue text');

      // Find the element containing this text
      const elements = page.locator('div.relative.cursor-text');
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const text = await elements.nth(i).textContent();
        if (text?.includes(dialogueText)) {
          console.log(`Found dialogue at element ${i}`);

          // Check this element and the next don't overlap
          const bounds = await elements.nth(i).boundingBox();
          console.log(`  Height: ${bounds?.height}px`);

          if (i < count - 1) {
            const nextBounds = await elements.nth(i + 1).boundingBox();
            const gap = (nextBounds?.y || 0) - ((bounds?.y || 0) + (bounds?.height || 0));
            console.log(`  Gap to next element: ${gap}px`);

            expect(gap).toBeGreaterThanOrEqual(-1); // Allow 1px tolerance
          }

          // Take a focused screenshot
          await elements.nth(i).screenshot({ path: '/tmp/dialogue-element.png' });
          break;
        }
      }
    } else {
      console.log('Problematic dialogue text not found in current script');
    }
  });

  test('compare span heights with container heights', async ({ page }) => {
    console.log('\n=== Span vs Container Height Analysis ===');

    const analysis = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div.relative.cursor-text'));

      return elements.map((el, index) => {
        const span = el.querySelector('span');
        const containerRect = el.getBoundingClientRect();
        const spanRect = span?.getBoundingClientRect();
        const computed = window.getComputedStyle(el);

        return {
          index,
          text: el.textContent?.substring(0, 40) || '',
          containerHeight: containerRect.height,
          spanHeight: spanRect?.height || 0,
          marginBottom: computed.marginBottom,
          heightDiff: Math.abs(containerRect.height - (spanRect?.height || 0)),
        };
      });
    });

    console.log('\nElement height analysis:');
    analysis.forEach(item => {
      if (item.text.length > 20) { // Focus on elements with content
        console.log(`\nElement ${item.index}: "${item.text}"`);
        console.log(`  Container height: ${item.containerHeight}px`);
        console.log(`  Span height: ${item.spanHeight}px`);
        console.log(`  marginBottom: ${item.marginBottom}`);
        console.log(`  Height diff: ${item.heightDiff}px`);
      }
    });

    // All elements should have marginBottom: 0
    const nonZeroMargins = analysis.filter(a => a.marginBottom !== '0px');
    expect(nonZeroMargins).toHaveLength(0);
  });
});
